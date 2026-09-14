import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { expandQuery, getAnswer, condenseQuery, type ChatHistoryItem } from "@/lib/groq";
import { searchChunks, formatContext } from "@/lib/retrieval/search";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatMarkdownToTelegramHTML(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
    .replace(/\*(.*?)\*/g, "<i>$1</i>")
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
}

async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const TELEGRAM_API = `https://api.telegram.org/bot${token}`;
  
  const safeText = text.slice(0, 4000) + (text.length > 4000 ? "\n\n...(truncated)" : "");
  const htmlText = formatMarkdownToTelegramHTML(safeText);
  
  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: "HTML",
      }),
    });
    if (!res.ok) console.error("[telegram] Failed to send message:", await res.text());
  } catch (err) {
    console.error("[telegram] Fetch error:", err);
  }
}

async function sendTypingAction(chatId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {});
}

async function syncCommands(chatId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  
  const sites = await prisma.site.findMany();
  const commands = [
    { command: "sites", description: "Choose a website bot" },
    { command: "language", description: "Change AI Response Language" },
    { command: "all", description: "Search all websites" },
    ...sites.map(s => ({
      command: (s.name || s.id).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32),
      description: `Search ${(s.name || s.id).slice(0, 50)}`
    }))
  ];

  const res = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  });
  
  if (res.ok) {
    const list = sites.map(s => {
      const cmd = (s.name || s.id).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32);
      return `• <b>${s.name}</b>: /${cmd}`;
    }).join("\n");
    await sendTelegramMessage(chatId, `✅ <b>Commands Synced! (${sites.length} bots available)</b>\n\n${list}\n\nType <code>/</code>, or tap /sites to choose a bot!`);
    await sendSiteMenu(chatId);
  } else {
    await sendTelegramMessage(chatId, "❌ Failed to sync commands.");
  }
}

async function sendSiteMenu(chatId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;

  const sites = await prisma.site.findMany();
  const keyboard: any[][] = [];
  keyboard.push([{ text: "🌍 Search ALL Websites", callback_data: "site_all" }]);

  for (let i = 0; i < sites.length; i += 2) {
    const row = [];
    row.push({ text: `🤖 ${sites[i].name || "Bot"}`, callback_data: `site_${sites[i].id}` });
    if (sites[i + 1]) {
      row.push({ text: `🤖 ${sites[i + 1].name || "Bot"}`, callback_data: `site_${sites[i + 1].id}` });
    }
    keyboard.push(row);
  }

  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "📚 <b>Choose a website bot:</b>",
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: keyboard },
    }),
  });
}

async function sendLanguageMenu(chatId: number) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: "🌐 Choose a language for my answers:",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🌐 Auto", callback_data: "lang_auto" },
            { text: "🇬🇧 EN", callback_data: "lang_en" },
            { text: "🇪🇸 ES", callback_data: "lang_es" }
          ],
          [
            { text: "🇫🇷 FR", callback_data: "lang_fr" },
            { text: "🇮🇳 HI", callback_data: "lang_hi" },
            { text: "🇮🇳 TA", callback_data: "lang_ta" }
          ]
        ]
      }
    })
  });
}

export async function POST(req: NextRequest) {
  let body: any = null;
  try {
    body = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;

    // 1. Handle Callback Queries (Inline button clicks)
    if (body.callback_query) {
      const cb = body.callback_query;
      const callbackId = cb.id;
      const chatId = cb.message?.chat?.id;
      const messageId = cb.message?.message_id;
      const data = cb.data;

      if (data && data.startsWith("lang_") && chatId && token) {
        const langCode = data.replace("lang_", "");
        let langName = "Auto";
        if (langCode === "en") langName = "English";
        else if (langCode === "es") langName = "Spanish";
        else if (langCode === "fr") langName = "French";
        else if (langCode === "hi") langName = "Hindi";
        else if (langCode === "ta") langName = "Tamil";
        
        const dbLang = langCode === "auto" ? null : langName;

        await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "language") VALUES (${chatId}, ${dbLang}) ON CONFLICT ("chatId") DO UPDATE SET "language" = ${dbLang};`;
        
        // Immediately acknowledge so the button stops loading
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ callback_query_id: callbackId })
        }).catch(console.error);

        // Edit the message text seamlessly
        if (messageId) {
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ Language updated to ${langName}`
            })
          }).catch(console.error);
        }
      }

      if (data && data.startsWith("site_") && chatId && token) {
        const selectedSiteId = data.replace("site_", "");
        if (selectedSiteId === "all") {
          await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, NULL, NULL) ON CONFLICT ("chatId") DO UPDATE SET "siteId" = NULL, "sessionId" = NULL;`;
          
          await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ callback_query_id: callbackId, text: "🌍 Searching ALL websites" })
          }).catch(console.error);

          if (messageId) {
            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: "🌍 <b>Now searching ALL websites.</b>\n\nWhat would you like to know?",
                parse_mode: "HTML"
              })
            }).catch(console.error);
          }
        } else {
          const site = await prisma.site.findUnique({ where: { id: selectedSiteId } });
          if (site) {
            await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, ${site.id}, NULL) ON CONFLICT ("chatId") DO UPDATE SET "siteId" = ${site.id}, "sessionId" = NULL;`;
            
            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ callback_query_id: callbackId, text: `Locked onto ${site.name}` })
            }).catch(console.error);

            if (messageId) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  text: `🎯 <b>Locked onto: ${site.name}</b>\nAnswers will now come ONLY from this website.\n\nWhat would you like to know?`,
                  parse_mode: "HTML"
                })
              }).catch(console.error);
            }
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    // 2. Handle Text Messages
    const message = body.message;
    if (!message || !message.text) return NextResponse.json({ ok: true });
    
    const chatId = message.chat.id;
    const text = message.text.trim();
    sendTypingAction(chatId);
    
    // Command handling
    if (text === "/language") {
      await sendLanguageMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text === "/sites" || text === "/bots") {
      await sendSiteMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text === "/sync" || text === "/start") {
      await syncCommands(chatId);
      if (text === "/start") {
        await prisma.$executeRaw`UPDATE "TelegramState" SET "sessionId" = NULL WHERE "chatId" = ${chatId};`;
        await sendTelegramMessage(chatId, "Welcome! Tap /sites or select a bot above to begin, or just ask me anything!");
        await sendLanguageMenu(chatId); // Show language menu on start
      }
      return NextResponse.json({ ok: true });
    }

    if (text === "/all") {
      await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, NULL, NULL) ON CONFLICT ("chatId") DO UPDATE SET "siteId" = NULL, "sessionId" = NULL;`;
      await sendTelegramMessage(chatId, "🌍 <b>Now searching ALL websites.</b>\nWhat would you like to know?");
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/")) {
      const rawCmd = text.split(" ")[0].slice(1).toLowerCase();
      const commandName = rawCmd.split("@")[0];
      const sites = await prisma.site.findMany();
      const matchedSite = sites.find(s => {
        const name = (s.name || s.id).toLowerCase();
        const cmdWithUnderscore = name.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').slice(0, 32);
        const cmdWithoutUnderscore = name.replace(/[^a-z0-9]/g, '').slice(0, 32);
        return commandName === cmdWithUnderscore || commandName === cmdWithoutUnderscore;
      });
      
      if (matchedSite) {
        await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, ${matchedSite.id}, NULL) ON CONFLICT ("chatId") DO UPDATE SET "siteId" = ${matchedSite.id}, "sessionId" = NULL;`;
        await sendTelegramMessage(chatId, `🎯 <b>Locked onto: ${matchedSite.name}</b>\nAnswers will now come ONLY from this website.\n\nWhat would you like to know?`);
        return NextResponse.json({ ok: true });
      }
    }
    
    // State lookup
    const state = await prisma.$queryRaw<any[]>`SELECT "siteId", "language", "sessionId" FROM "TelegramState" WHERE "chatId" = ${chatId} LIMIT 1`;
    let siteId = state.length > 0 ? state[0].siteId : null;
    let sessionId = state.length > 0 ? state[0].sessionId : null;
    const userLanguage = state.length > 0 ? state[0].language : null;
    let siteNamePrefix = "";

    if (siteId) {
      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (site) {
        siteNamePrefix = `[Searching ${site.name}]\n\n`;
      } else {
        siteId = null; // Site was deleted
      }
    }

    // Ensure a chat session exists for multi-turn conversational history
    if (!sessionId) {
      let sessionSiteId = siteId;
      if (!sessionSiteId) {
        const anySite = await prisma.site.findFirst({ select: { id: true } });
        sessionSiteId = anySite?.id ?? null;
      }
      if (sessionSiteId) {
        const session = await prisma.chatSession.create({
          data: { siteId: sessionSiteId },
        });
        sessionId = session.id;
        await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, ${siteId}, ${sessionId}) ON CONFLICT ("chatId") DO UPDATE SET "sessionId" = ${sessionId};`;
      }
    }

    // Fetch recent conversation history
    let history: ChatHistoryItem[] = [];
    if (sessionId) {
      const recentDbMessages = await prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { role: true, content: true },
      });
      history = recentDbMessages
        .reverse()
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        }));
    }
    
    const GREETING = /^(hi|hey|hello|yo|sup|hola|howdy)[\s!?.]*$/i;
    let context = "";
    if (!GREETING.test(text)) {
      const standaloneQuery = await condenseQuery(text, history);
      console.log(`[telegram] question="${text}", standalone="${standaloneQuery}"`);
      const expandedQuery = await expandQuery(standaloneQuery);
      const chunks = await searchChunks(siteId, expandedQuery, 6);
      
      if (chunks.length === 0) {
        await sendTelegramMessage(chatId, `${siteNamePrefix}I don't have any information on that.`);
        return NextResponse.json({ ok: true });
      }
      context = formatContext(chunks);
    }
    
    // Save user question to session
    if (sessionId) {
      await prisma.message.create({
        data: {
          sessionId,
          role: "user",
          content: text,
        },
      });
    }

    const answer = await getAnswer(text, context, userLanguage, history);
    // Strip out the CoT <thinking> block so it doesn't break Telegram HTML parsing
    const cleanAnswer = answer.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "").trim();

    // Save assistant response to session
    if (sessionId) {
      await prisma.message.create({
        data: {
          sessionId,
          role: "assistant",
          content: cleanAnswer,
        },
      });
    }

    await sendTelegramMessage(chatId, siteNamePrefix + cleanAnswer);
    
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("[telegram] Webhook Error:", error);
    try {
      const message = error instanceof Error ? error.message : String(error);
      const friendly = /rate limit|413|request too large|tokens per minute/i.test(message)
        ? "⚠️ High demand right now, please try again in a moment."
        : "⚠️ Sorry, I encountered an error processing your request. Please try again.";
      if (body?.message?.chat?.id) {
        await sendTelegramMessage(body.message.chat.id, friendly);
      }
    } catch {}
    return NextResponse.json({ ok: false, error: error.stack || String(error) }, { status: 500 });
  }
}
