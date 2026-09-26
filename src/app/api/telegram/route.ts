import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  expandQuery,
  getAnswer,
  condenseQuery,
  transcribeAudio,
  type ChatHistoryItem,
} from "@/lib/groq";
import { searchChunks, formatContext } from "@/lib/retrieval/search";
import { syncTelegramBotCommands } from "@/lib/telegram";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatMarkdownToTelegramHTML(text: string): string {
  // 1. Escape HTML special characters in the raw input so raw text or LLM brackets don't break Telegram HTML
  let out = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // 2. Preformatted code blocks ```lang ... ``` or ``` ... ```
  out = out.replace(/```(?:[a-zA-Z0-9_-]+)?\n?([\s\S]*?)```/g, "<pre><code>$1</code></pre>");

  // 3. Inline code `code`
  out = out.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // 4. Bold: **text** or __text__
  out = out.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  out = out.replace(/__([^_]+)__/g, "<b>$1</b>");

  // 5. Italic: *text* (not surrounded by *) or _text_
  out = out.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "<i>$1</i>");

  // 6. Markdown links: [anchor text](https://url) -> <a href="url">anchor text</a>
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // 7. Clean bullet points: convert markdown lists "- " or "* " to clean Telegram bullets "• "
  out = out.replace(/^[\t ]*[-*]\s+/gm, "• ");

  return out;
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
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.warn(
        "[telegram] HTML sendMessage failed, falling back to plain text:",
        await res.text()
      );
      // Fail-safe delivery: send as raw text without HTML parse_mode so user is never ghosted
      await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: safeText,
          disable_web_page_preview: true,
        }),
      });
    }
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

async function generateTTSAudio(
  text: string,
  languageCode?: string | null
): Promise<Buffer | null> {
  try {
    const cleanSpeechText = text
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/\[\d+\]/g, "")
      .replace(/https?:\/\/\S+/g, "")
      .replace(/[*_#`~>•]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!cleanSpeechText) return null;

    // Up to 350 chars for a concise spoken summary
    const voiceSnippet = cleanSpeechText.slice(0, 350);

    let tl = "en";
    const lowerLang = (languageCode || "").toLowerCase();
    if (lowerLang.includes("tamil") || lowerLang === "ta") tl = "ta";
    else if (lowerLang.includes("hindi") || lowerLang === "hi") tl = "hi";
    else if (lowerLang.includes("spanish") || lowerLang === "es") tl = "es";
    else if (lowerLang.includes("french") || lowerLang === "fr") tl = "fr";

    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(voiceSnippet)}&tl=${tl}&client=tw-ob`;
    const res = await fetch(ttsUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(8_000),
    });

    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.warn("[telegram tts error]:", err);
    return null;
  }
}

async function sendTelegramVoice(chatId: number, audioBuffer: Buffer) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  try {
    const formData = new FormData();
    formData.append("chat_id", String(chatId));
    const blob = new Blob([new Uint8Array(audioBuffer)], { type: "audio/mpeg" });
    formData.append("voice", blob, "voice.mp3");

    await fetch(`https://api.telegram.org/bot${token}/sendVoice`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    console.warn("[telegram sendVoice error]:", err);
  }
}

async function syncCommands(chatId: number) {
  const sites = await prisma.site.findMany();
  const ok = await syncTelegramBotCommands();

  if (ok) {
    const list = sites
      .slice(0, 15)
      .map((s) => {
        let cmd = (s.name || s.id)
          .toLowerCase()
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 32);
        if (!cmd) cmd = `site_${s.id.slice(-8)}`.toLowerCase();
        return `• **${s.name}**: \`/${cmd}\``;
      })
      .join("\n");
    await sendTelegramMessage(
      chatId,
      `✅ **Commands Synced! (${sites.length} bots available)**\n\n${list}\n\nType \`/\`, or tap \`/sites\` to choose a bot!`
    );
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
      row.push({
        text: `🤖 ${sites[i + 1].name || "Bot"}`,
        callback_data: `site_${sites[i + 1].id}`,
      });
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
            { text: "🇪🇸 ES", callback_data: "lang_es" },
          ],
          [
            { text: "🇫🇷 FR", callback_data: "lang_fr" },
            { text: "🇮🇳 HI", callback_data: "lang_hi" },
            { text: "🇮🇳 TA", callback_data: "lang_ta" },
          ],
        ],
      },
    }),
  });
}

export async function GET(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const origin = req.nextUrl.origin || "https://rohith-rag.vercel.app";
  const webhookUrl = `${origin}/api/telegram`;

  if (!token) {
    return NextResponse.json({
      status: "unconfigured",
      message: "TELEGRAM_BOT_TOKEN is not set in environment variables.",
      instructions: [
        "1. Open Telegram and search for @BotFather.",
        "2. Send /newbot to create a new bot and copy your Bot API Token.",
        "3. Add TELEGRAM_BOT_TOKEN to your .env file and Vercel project environment variables.",
        "4. Visit this endpoint with ?setup=1 to automatically link Telegram to this app.",
      ],
      webhookUrl,
    });
  }

  const setupRequested = req.nextUrl.searchParams.get("setup") === "1";
  if (setupRequested) {
    try {
      // 1. Set Telegram Webhook
      const setRes = await fetch(
        `https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}`
      );
      const setData = await setRes.json();

      // 2. Sync Bot Commands
      const syncOk = await syncTelegramBotCommands();

      return NextResponse.json({
        status: "configured",
        webhookResult: setData,
        commandsSynced: syncOk,
        webhookUrl,
        message: "Telegram Bot webhook and commands successfully initialized!",
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: "Failed to setup webhook", details: err.message },
        { status: 500 }
      );
    }
  }

  // Check current webhook info
  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
    const infoData = await infoRes.json();
    return NextResponse.json({
      status: "ready",
      tokenConfigured: true,
      webhookInfo: infoData.result || infoData,
      setupUrl: `${webhookUrl}?setup=1`,
    });
  } catch {
    return NextResponse.json({
      status: "ready",
      tokenConfigured: true,
      setupUrl: `${webhookUrl}?setup=1`,
    });
  }
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
          body: JSON.stringify({ callback_query_id: callbackId }),
        }).catch(console.error);

        // Edit the message text seamlessly
        if (messageId) {
          await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              message_id: messageId,
              text: `✅ Language updated to ${langName}`,
            }),
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
            body: JSON.stringify({
              callback_query_id: callbackId,
              text: "🌍 Searching ALL websites",
            }),
          }).catch(console.error);

          if (messageId) {
            await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: "🌍 <b>Now searching ALL websites.</b>\n\nWhat would you like to know?",
                parse_mode: "HTML",
              }),
            }).catch(console.error);
          }
        } else {
          const site = await prisma.site.findUnique({ where: { id: selectedSiteId } });
          if (site) {
            await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, ${site.id}, NULL) ON CONFLICT ("chatId") DO UPDATE SET "siteId" = ${site.id}, "sessionId" = NULL;`;

            await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                callback_query_id: callbackId,
                text: `Locked onto ${site.name}`,
              }),
            }).catch(console.error);

            if (messageId) {
              await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  chat_id: chatId,
                  message_id: messageId,
                  text: `🎯 <b>Locked onto: ${site.name}</b>\nAnswers will now come ONLY from this website.\n\nWhat would you like to know?`,
                  parse_mode: "HTML",
                }),
              }).catch(console.error);
            }
          }
        }
      }
      return NextResponse.json({ ok: true });
    }

    // 2. Handle Text & Voice Messages
    const message = body.message;
    if (!message) return NextResponse.json({ ok: true });

    const chatId = message.chat.id;
    sendTypingAction(chatId);

    // State lookup (site, language, session)
    const state = await prisma.$queryRaw<
      any[]
    >`SELECT "siteId", "language", "sessionId" FROM "TelegramState" WHERE "chatId" = ${chatId} LIMIT 1`;
    let siteId = state.length > 0 ? state[0].siteId : null;
    let sessionId = state.length > 0 ? state[0].sessionId : null;
    const userLanguage = state.length > 0 ? state[0].language : null;
    let siteNamePrefix = "";
    let sitePrompt: string | null = null;
    let siteTone: string | null = null;

    let text = message.text ? message.text.trim() : "";
    let isVoiceQuery = false;

    // If message is a voice note or audio file, transcribe via Groq Whisper!
    if (!text && (message.voice || message.audio) && token) {
      isVoiceQuery = true;
      const voiceObj = message.voice || message.audio;
      try {
        const fileRes = await fetch(
          `https://api.telegram.org/bot${token}/getFile?file_id=${voiceObj.file_id}`
        );
        const fileData = await fileRes.json();
        if (fileData.ok && fileData.result?.file_path) {
          const downloadUrl = `https://api.telegram.org/file/bot${token}/${fileData.result.file_path}`;
          const audioRes = await fetch(downloadUrl);
          const audioArrayBuffer = await audioRes.arrayBuffer();
          const audioBuffer = Buffer.from(audioArrayBuffer);

          const transcribed = await transcribeAudio(audioBuffer, "voice.ogg", userLanguage);
          if (transcribed && transcribed.trim()) {
            text = transcribed.trim();
            await sendTelegramMessage(chatId, `🎙️ *"${text}"*`);
          } else {
            await sendTelegramMessage(
              chatId,
              "⚠️ Could not understand the voice message clearly. Please try speaking again or type your question."
            );
            return NextResponse.json({ ok: true });
          }
        }
      } catch (voiceErr) {
        console.error("[telegram voice error]", voiceErr);
        await sendTelegramMessage(chatId, "⚠️ Failed to process audio. Please type your question.");
        return NextResponse.json({ ok: true });
      }
    }

    if (!text) return NextResponse.json({ ok: true });

    // Command handling
    if (text === "/language") {
      await sendLanguageMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text === "/sites" || text === "/bots") {
      await sendSiteMenu(chatId);
      return NextResponse.json({ ok: true });
    }

    if (text === "/help") {
      const helpText = [
        "🤖 **Web-RAG Assistant**",
        "",
        "Ask me any question via text or **voice note**! I retrieve verified answers with clickable citations from indexed websites.",
        "",
        "**Available Commands:**",
        "• `/sites` — Select a website bot to focus on",
        "• `/all` — Search across all indexed websites",
        "• `/language` — Change AI response language",
        "• `/status` — Check active bot target & language",
        "• `/clear` — Start a fresh chat session (clears history)",
        "• `/sync` — Refresh bot commands",
        "• `/help` — Show this guide",
      ].join("\n");
      await sendTelegramMessage(chatId, helpText);
      return NextResponse.json({ ok: true });
    }

    if (text === "/clear" || text === "/new" || text === "/reset") {
      await prisma.$executeRaw`UPDATE "TelegramState" SET "sessionId" = NULL WHERE "chatId" = ${chatId};`;
      await sendTelegramMessage(
        chatId,
        "🧹 **Conversation cleared!** Started a fresh session. What would you like to know?"
      );
      return NextResponse.json({ ok: true });
    }

    if (text === "/status") {
      let currentSiteName = "🌍 All Websites";
      if (siteId) {
        const s = await prisma.site.findUnique({ where: { id: siteId }, select: { name: true } });
        if (s) currentSiteName = `🎯 ${s.name}`;
      }
      const currentLang = userLanguage || "🌐 Auto (matches question)";
      const statusMsg = [
        "📊 **Bot Status**",
        `• **Active Target:** ${currentSiteName}`,
        `• **Language:** ${currentLang}`,
        `• **Session:** ${sessionId ? "Active conversation" : "Fresh session"}`,
        "",
        "💡 *Tip: Send `/sites` to switch bots or `/clear` to reset conversation.*",
      ].join("\n");
      await sendTelegramMessage(chatId, statusMsg);
      return NextResponse.json({ ok: true });
    }

    if (text === "/sync" || text === "/start") {
      await syncCommands(chatId);
      if (text === "/start") {
        await prisma.$executeRaw`UPDATE "TelegramState" SET "sessionId" = NULL WHERE "chatId" = ${chatId};`;
        await sendTelegramMessage(
          chatId,
          "Welcome! Tap /sites or select a bot above to begin, or just ask me anything!"
        );
        await sendLanguageMenu(chatId); // Show language menu on start
      }
      return NextResponse.json({ ok: true });
    }

    if (text === "/all") {
      await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, NULL, NULL) ON CONFLICT ("chatId") DO UPDATE SET "siteId" = NULL, "sessionId" = NULL;`;
      await sendTelegramMessage(
        chatId,
        "🌍 **Now searching ALL websites.**\nWhat would you like to know?"
      );
      return NextResponse.json({ ok: true });
    }

    if (text.startsWith("/")) {
      const rawCmd = text.split(" ")[0].slice(1).toLowerCase();
      const commandName = rawCmd.split("@")[0];
      const sites = await prisma.site.findMany();
      const matchedSite = sites.find((s) => {
        const name = (s.name || s.id).toLowerCase();
        const cmdWithUnderscore = name
          .replace(/\s+/g, "_")
          .replace(/[^a-z0-9_]/g, "")
          .slice(0, 32);
        const cmdWithoutUnderscore = name.replace(/[^a-z0-9]/g, "").slice(0, 32);
        const fallbackCmd = `site_${s.id.slice(-8)}`.toLowerCase();
        return (
          commandName === cmdWithUnderscore ||
          commandName === cmdWithoutUnderscore ||
          commandName === fallbackCmd
        );
      });

      if (matchedSite) {
        await prisma.$executeRaw`INSERT INTO "TelegramState" ("chatId", "siteId", "sessionId") VALUES (${chatId}, ${matchedSite.id}, NULL) ON CONFLICT ("chatId") DO UPDATE SET "siteId" = ${matchedSite.id}, "sessionId" = NULL;`;
        await sendTelegramMessage(
          chatId,
          `🎯 **Locked onto: ${matchedSite.name}**\nAnswers will now come ONLY from this website.\n\nWhat would you like to know?`
        );
        return NextResponse.json({ ok: true });
      }
    }

    if (siteId) {
      const site = await prisma.site.findUnique({ where: { id: siteId } });
      if (site) {
        siteNamePrefix = `[Searching ${site.name}]\n\n`;
        sitePrompt = site.systemPrompt ?? null;
        siteTone = site.tone ?? null;
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
      history = recentDbMessages.reverse().map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
    }

    const GREETING_PATTERNS =
      /^(hi|hey|hello|yo|sup|hola|howdy|good\s*(morning|afternoon|evening|night)|what'?s?\s*up|how\s*are\s*you|thanks?|thank\s*you|bye|goodbye|see\s*ya|ok|okay|cool|nice|great|awesome|got\s*it)[\s!?.]*$/i;
    let context = "";
    let sourcesFooter = "";

    if (!GREETING_PATTERNS.test(text)) {
      const standaloneQuery = await condenseQuery(text, history);
      console.log(`[telegram] question="${text}", standalone="${standaloneQuery}"`);
      const expandedQuery = await expandQuery(standaloneQuery);
      console.log(`[telegram] standalone="${standaloneQuery}", expanded="${expandedQuery}"`);

      // Decoupled search: vector & reranker use standaloneQuery, BM25 uses expandedQuery
      const chunks = await searchChunks(siteId, standaloneQuery, 6, 12000, expandedQuery);

      if (chunks.length === 0) {
        await sendTelegramMessage(
          chatId,
          `${siteNamePrefix}I don't have any verified information on that in the indexed pages.`
        );
        return NextResponse.json({ ok: true });
      }
      context = formatContext(chunks);

      // Build clean, deduplicated clickable sources footnote
      const seenUrls = new Set<string>();
      const sourceLinks: string[] = [];
      for (const c of chunks) {
        if (c.pageUrl && !seenUrls.has(c.pageUrl)) {
          seenUrls.add(c.pageUrl);
          let label = (c.heading || "").trim();
          if (!label || label.length < 3) {
            try {
              const u = new URL(c.pageUrl);
              const segments = u.pathname.split("/").filter(Boolean);
              const last = segments.pop() || "";
              label = last ? last.replace(/[-_]/g, " ") : u.hostname.replace(/^www\./, "");
            } catch {
              label = c.pageUrl.slice(0, 32);
            }
          }
          label = label.charAt(0).toUpperCase() + label.slice(1);
          const safeTitle = label.replace(/[\[\]()]/g, "").trim();
          sourceLinks.push(`• [${safeTitle}](${c.pageUrl})`);
          if (sourceLinks.length >= 3) break;
        }
      }

      if (sourceLinks.length > 0) {
        sourcesFooter = `\n\n📖 **Sources:**\n${sourceLinks.join("\n")}`;
      }
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

    const answer = await getAnswer(text, context, userLanguage, history, sitePrompt, siteTone);
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

    await sendTelegramMessage(chatId, siteNamePrefix + cleanAnswer + sourcesFooter);

    // Two-way voice: if user sent a voice note, speak the answer back with a Telegram voice bubble!
    if (isVoiceQuery) {
      try {
        const audioBuffer = await generateTTSAudio(cleanAnswer, userLanguage);
        if (audioBuffer) {
          await sendTelegramVoice(chatId, audioBuffer);
        }
      } catch (voiceErr) {
        console.warn("[telegram] Failed to generate/send voice reply:", voiceErr);
      }
    }

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
