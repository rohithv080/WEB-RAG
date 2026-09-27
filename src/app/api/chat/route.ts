import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  streamAnswer,
  GroqBusyError,
  GROQ_BUSY_MESSAGE,
  NO_ANSWER_PHRASE,
  expandQuery,
  condenseQuery,
  type ChatHistoryItem,
} from "@/lib/groq";
import {
  searchChunks,
  formatContext,
  buildCitations,
  formatWebContext,
  buildWebCitations,
} from "@/lib/retrieval/search";
import { searchWeb } from "@/lib/retrieval/webSearch";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-admin-secret",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type ChatBody = {
  question?: string;
  siteId?: string;
  sessionId?: string;
  language?: string | null;
  forceWebSearch?: boolean;
  webSearchQuery?: string;
};

export async function POST(req: NextRequest) {
  try {
    // 1. Abuse defense: IP/User rate limiting (protects free-tier Groq quotas)
    let userId: string | null = null;
    try {
      const authData = await auth();
      userId = authData.userId;
    } catch {}

    const clientIp = getClientIp(req);
    const rateKey = userId ? `chat:user:${userId}` : `chat:ip:${clientIp}`;
    const limit = userId ? 60 : 30; // 60 msgs / 10 min for signed in users; 30 for anonymous
    const windowSeconds = 600;

    const rateResult = await rateLimit(rateKey, limit, windowSeconds);
    if (!rateResult.success) {
      return NextResponse.json(
        {
          error: `Rate limit reached. Please wait ${rateResult.retryAfterSeconds} seconds before sending more queries.`,
          retryAfter: rateResult.retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateResult.retryAfterSeconds),
            "X-RateLimit-Limit": String(rateResult.limit),
            "X-RateLimit-Remaining": String(rateResult.remaining),
            "X-RateLimit-Reset": String(rateResult.reset),
            ...corsHeaders,
          },
        }
      );
    }

    if (!process.env.GROQ_API_KEY && !process.env.GROQ_API_KEYS) {
      return NextResponse.json(
        { error: "GROQ_API_KEY or GROQ_API_KEYS is not configured" },
        { status: 500, headers: corsHeaders }
      );
    }

    const body = (await req.json()) as ChatBody;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const siteId = typeof body.siteId === "string" ? body.siteId : "";
    let sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
    const language = typeof body.language === "string" ? body.language : null;
    const forceWebSearch = Boolean(body.forceWebSearch);
    const requestedWebSearchQuery =
      typeof body.webSearchQuery === "string" ? body.webSearchQuery.trim() : "";

    if (!question || !siteId) {
      return NextResponse.json(
        { error: "question and siteId are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404, headers: corsHeaders });
    }

    const startTime = Date.now();

    if (sessionId) {
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, siteId },
      });
      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404, headers: corsHeaders }
        );
      }
    } else {
      const session = await prisma.chatSession.create({ data: { siteId } });
      sessionId = session.id;
    }

    // Fetch recent chat history from this session for multi-turn conversational memory
    const recentDbMessages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { role: true, content: true },
    });
    const history: ChatHistoryItem[] = recentDbMessages.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Detect if the previous assistant turn asked to search the web
    const lastAssistantMsg =
      history.length > 0 && history[history.length - 1].role === "assistant"
        ? history[history.length - 1].content
        : "";

    const isWebSearchOffered =
      /search the web/i.test(lastAssistantMsg) ||
      /search in web/i.test(lastAssistantMsg) ||
      /web search/i.test(lastAssistantMsg);

    const AFFIRMATIVE_CONFIRMATION_REGEX =
      /^(yes|yeah|yep|sure|please|please\s*do|search(\s+the)?\s*web|go\s*ahead|do\s*it|ok|okay|why\s*not|proceed|definitely)[\s!.?]*$/i;

    const isAffirmativeConfirmation =
      isWebSearchOffered && AFFIRMATIVE_CONFIRMATION_REGEX.test(question);

    const EXPLICIT_WEB_COMMAND_REGEX =
      /^(search(\s+the)?\s*web\s*(for)?\s*:?|google\s*:?|look\s*up\s*on\s*(the)?\s*web\s*:?)\s*(.+)$/i;
    const explicitWebMatch = question.match(EXPLICIT_WEB_COMMAND_REGEX);

    const isConfirmedWebSearch =
      forceWebSearch || isAffirmativeConfirmation || Boolean(explicitWebMatch);

    let targetWebQuery = "";
    if (isConfirmedWebSearch) {
      if (requestedWebSearchQuery) {
        targetWebQuery = requestedWebSearchQuery;
      } else if (explicitWebMatch) {
        targetWebQuery = explicitWebMatch[explicitWebMatch.length - 1].trim();
      } else if (isAffirmativeConfirmation) {
        // Find previous user query in history before the offer
        for (let i = history.length - 2; i >= 0; i--) {
          if (history[i].role === "user") {
            targetWebQuery = history[i].content;
            break;
          }
        }
        if (!targetWebQuery) targetWebQuery = question;
      } else {
        targetWebQuery =
          question.replace(/^(search(\s+the)?\s*web\s*(for)?\s*:?)/i, "").trim() || question;
      }
    }

    // Fast-path: detect greetings/chitchat (only if not an affirmative confirmation or web search)
    const GREETING_PATTERNS =
      /^(hi|hey|hello|yo|sup|hola|howdy|good\s*(morning|afternoon|evening|night)|what'?s?\s*up|how\s*are\s*you|thanks?|thank\s*you|bye|goodbye|see\s*ya|cool|nice|great|awesome|got\s*it)[\s!?.]*$/i;
    const isGreeting = !isConfirmedWebSearch && GREETING_PATTERNS.test(question);

    let context = "";
    let citations: any[] = [];
    let standaloneQuery: string | undefined;
    let isWebFallback = false;
    let suggestWebSearch = false;
    let webSearchQuery: string | undefined;
    let staticResponseText: string | null = null;

    const isFallbackAllowed = (site as any).enableWebSearch !== false;

    if (isConfirmedWebSearch) {
      console.log(`[chat] User confirmed web search for: "${targetWebQuery}"`);
      isWebFallback = true;
      const webResults = await searchWeb(targetWebQuery);
      if (webResults.length > 0) {
        context = formatWebContext(webResults);
        citations = buildWebCitations(webResults);
      } else {
        staticResponseText = `I searched the web for **"${targetWebQuery}"**, but could not find any relevant results to answer your question.`;
      }
    } else if (!isGreeting) {
      // 1. Condense follow-up questions using recent chat history into a standalone query
      standaloneQuery = await condenseQuery(question, history);
      console.log(`[chat] question="${question}", standalone="${standaloneQuery}"`);

      // 2. Expand short queries for better keyword/BM25 coverage
      const expandedQuery = await expandQuery(standaloneQuery);
      console.log(`[chat] standalone="${standaloneQuery}", expanded="${expandedQuery}"`);

      // 3. Decoupled search: vector & reranker use standaloneQuery, BM25 uses expandedQuery
      const chunks = await searchChunks(siteId, standaloneQuery, 6, 12000, expandedQuery);

      // Pre-generation confidence evaluation
      const fallbackThreshold = Number(process.env.RERANKER_FALLBACK_THRESHOLD || 0.28);
      const topScore = chunks.length > 0 ? Math.max(...chunks.map((c) => c.score)) : 0;
      const notFoundOnSite = chunks.length === 0 || topScore < fallbackThreshold;

      if (notFoundOnSite) {
        console.log(
          `[chat] Local confidence low (topScore=${topScore.toFixed(3)} < ${fallbackThreshold} or chunks=${chunks.length}). Not searching web automatically — asking user first.`
        );
        const queryForWeb = standaloneQuery || question;
        if (isFallbackAllowed) {
          suggestWebSearch = true;
          webSearchQuery = queryForWeb;
          if (language === "Spanish") {
            staticResponseText = `No pude encontrar información sobre eso en **${site.name}**.\n\n¿Le gustaría que busque en la web sobre esto?`;
          } else if (language === "French") {
            staticResponseText = `Je n'ai pas trouvé d'informations à ce sujet sur **${site.name}**.\n\nSouhaitez-vous que je recherche sur le web à ce sujet ?`;
          } else if (language === "Hindi") {
            staticResponseText = `मुझे **${site.name}** पर इसके बारे में जानकारी नहीं मिली।\n\nक्या आप चाहते हैं कि मैं इसके लिए वेब पर खोज करूं?`;
          } else if (language === "Tamil") {
            staticResponseText = `**${site.name}** தளத்தில் இதைப் பற்றிய தகவல் கிடைக்கவில்லை.\n\nஇதற்காக நான் இணையத்தில் தேட வேண்டுமா?`;
          } else {
            staticResponseText = `I couldn't find information about that on **${site.name}**.\n\nWould you like me to search the web for this?`;
          }
        } else {
          staticResponseText = `I couldn't find information about that in the documents for **${site.name}**.`;
        }
      } else {
        context = formatContext(chunks);
        citations = buildCitations(chunks);
      }
    } else {
      console.log(`[chat] greeting detected, skipping search: "${question}"`);
    }

    await prisma.message.create({
      data: {
        sessionId,
        role: "user",
        content: question,
      },
    });

    let groqStream = null;
    if (!staticResponseText) {
      const activeCustomPrompt = isWebFallback
        ? `You are an expert AI assistant providing a live, web-grounded answer to the user's question because the specific details were not found in the local site documents.\nAnswer using ONLY the provided web search document blocks. Cite them inline using [1], [2], etc. Keep your tone objective, clear, and direct.`
        : site.systemPrompt;

      const promptQuestion = isConfirmedWebSearch ? targetWebQuery : question;

      try {
        groqStream = await streamAnswer(
          promptQuestion,
          context,
          language,
          history,
          activeCustomPrompt,
          site.tone
        );
      } catch (err) {
        if (err instanceof GroqBusyError) {
          return NextResponse.json(
            { error: GROQ_BUSY_MESSAGE },
            { status: 429, headers: corsHeaders }
          );
        }
        const message = err instanceof Error ? err.message : "Groq request failed";
        const friendly = /rate limit|413|request too large|tokens per minute/i.test(message)
          ? GROQ_BUSY_MESSAGE
          : message;
        return NextResponse.json({ error: friendly }, { status: 429, headers: corsHeaders });
      }
    }

    const encoder = new TextEncoder();
    let fullAnswer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          const isRewritten =
            Boolean(standaloneQuery) &&
            standaloneQuery!.toLowerCase().trim() !== question.toLowerCase().trim();

          send({
            type: "meta",
            sessionId,
            citations,
            standaloneQuery: isRewritten
              ? standaloneQuery
              : isConfirmedWebSearch
                ? targetWebQuery
                : undefined,
            isWebFallback,
            suggestWebSearch,
            webSearchQuery,
          });

          if (groqStream) {
            for await (const part of groqStream) {
              const delta = part.choices[0]?.delta?.content ?? "";
              if (delta) {
                fullAnswer += delta;
                send({ type: "token", content: delta });
              }
            }

            const isNoAnswer =
              fullAnswer.trim() === NO_ANSWER_PHRASE ||
              fullAnswer.trim().startsWith(NO_ANSWER_PHRASE) ||
              fullAnswer.toLowerCase().includes("i couldn't find that in the source");

            if (isNoAnswer && isFallbackAllowed && !isWebFallback) {
              const offer = "\n\nWould you like me to search the web for this?";
              fullAnswer += offer;
              send({ type: "token", content: offer });
              suggestWebSearch = true;
              webSearchQuery = standaloneQuery || question;
            }
          } else if (staticResponseText) {
            fullAnswer = staticResponseText;
            send({ type: "token", content: staticResponseText });
          }

          const assistantMessage = await (prisma.message.create as any)({
            data: {
              sessionId,
              role: "assistant",
              content: fullAnswer,
              citations,
              isWebFallback,
              latencyMs: Date.now() - startTime,
            },
          });

          send({
            type: "done",
            sessionId,
            messageId: assistantMessage.id,
            isWebFallback,
            latencyMs: assistantMessage.latencyMs,
            suggestWebSearch,
            webSearchQuery,
          });
          controller.close();
        } catch (err) {
          console.error("[chat stream]", err);
          const message = err instanceof Error ? err.message : "Stream failed";
          send({ type: "error", error: message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-RateLimit-Limit": String(rateResult.limit),
        "X-RateLimit-Remaining": String(rateResult.remaining),
        ...corsHeaders,
      },
    });
  } catch (err) {
    console.error("[chat]", err);
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
