import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expandQuery, getAnswer } from "@/lib/groq";
import { searchChunks, formatContext } from "@/lib/retrieval/search";

export const runtime = "nodejs";
export const maxDuration = 60; // Allow enough time for retrieval + LLM

async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  
  const TELEGRAM_API = `https://api.telegram.org/bot${token}`;
  
  // Telegram has a 4096 char limit per message.
  const safeText = text.slice(0, 4000) + (text.length > 4000 ? "\n\n...(truncated)" : "");
  
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: safeText,
        // Intentionally omitting parse_mode to prevent Telegram from rejecting 
        // the message if the LLM produces malformed markdown (which happens often).
      }),
    });
    
    if (!res.ok) {
      console.error("[telegram] Failed to send message:", await res.text());
    }
  } catch (err) {
    console.error("[telegram] Fetch error:", err);
  }
}

async function sendTypingAction(chatId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  
  const TELEGRAM_API = `https://api.telegram.org/bot${token}`;
  fetch(`${TELEGRAM_API}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      action: "typing",
    }),
  }).catch(() => {}); // Fire and forget
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Telegram webhook payload has a `message` object
    const message = body.message;
    if (!message || !message.text) {
      return NextResponse.json({ ok: true }); // Acknowledge non-text updates (edits, etc)
    }
    
    const chatId = message.chat.id;
    const text = message.text.trim();
    
    // Immediately tell Telegram we are "typing..."
    sendTypingAction(chatId);
    
    let question = text;
    let siteId: string | null = null;
    let siteNamePrefix = "";
    
    // Check for /site command: e.g. "/site 101cookbooks how to make pasta"
    const siteMatch = text.match(/^\/site\s+([^\s]+)\s+(.*)$/i);
    if (siteMatch) {
      const siteKeyword = siteMatch[1].toLowerCase();
      question = siteMatch[2].trim();
      
      // Try to find a matching site by name or URL in the DB
      const site = await prisma.site.findFirst({
        where: {
          name: { contains: siteKeyword, mode: "insensitive" }
        }
      });
      
      if (site) {
        siteId = site.id;
        siteNamePrefix = `[Searching ${site.name || siteKeyword}]\n\n`;
      } else {
        await sendTelegramMessage(chatId, `❌ Could not find any site matching "${siteKeyword}". Try checking the site name in your web dashboard.`);
        return NextResponse.json({ ok: true });
      }
    }
    
    // Fast-path: detect greetings
    const GREETING_PATTERNS = /^(hi|hey|hello|yo|sup|hola|howdy|good\s*(morning|afternoon|evening|night)|what'?s?\s*up|how\s*are\s*you|thanks?|thank\s*you|bye|goodbye|see\s*ya|ok|okay|cool|nice|great|awesome|got\s*it)[\s!?.]*$/i;
    const isGreeting = GREETING_PATTERNS.test(question);
    
    let context = "";
    if (!isGreeting) {
      const expandedQuery = await expandQuery(question);
      const chunks = await searchChunks(siteId, expandedQuery, 10);
      
      if (chunks.length === 0) {
        await sendTelegramMessage(chatId, `${siteNamePrefix}I don't have any information on that. Try scraping some pages on your web dashboard first!`);
        return NextResponse.json({ ok: true });
      }
      
      context = formatContext(chunks);
    }
    
    const answer = await getAnswer(question, context);
    await sendTelegramMessage(chatId, siteNamePrefix + answer);
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[telegram] Webhook Error:", error);
    return NextResponse.json({ ok: false, error: error.stack || String(error) }, { status: 500 });
  }
}
