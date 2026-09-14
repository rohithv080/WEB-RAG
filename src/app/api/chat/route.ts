import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  streamAnswer,
  GroqBusyError,
  GROQ_BUSY_MESSAGE,
  expandQuery,
  condenseQuery,
  type ChatHistoryItem,
} from "@/lib/groq";
import { searchChunks, formatContext, buildCitations } from "@/lib/retrieval/search";
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
        return NextResponse.json({ error: "Session not found" }, { status: 404, headers: corsHeaders });
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
    const history: ChatHistoryItem[] = recentDbMessages
      .reverse()
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Fast-path: detect greetings/chitchat — skip expensive search pipeline
    const GREETING_PATTERNS = /^(hi|hey|hello|yo|sup|hola|howdy|good\s*(morning|afternoon|evening|night)|what'?s?\s*up|how\s*are\s*you|thanks?|thank\s*you|bye|goodbye|see\s*ya|ok|okay|cool|nice|great|awesome|got\s*it)[\s!?.]*$/i;
    const isGreeting = GREETING_PATTERNS.test(question);

    let context = "";
    let citations: any[] = [];
    let standaloneQuery: string | undefined;

    if (!isGreeting) {
      // 1. Condense follow-up questions using recent chat history into a standalone query
      standaloneQuery = await condenseQuery(question, history);
      console.log(`[chat] question="${question}", standalone="${standaloneQuery}"`);

      // 2. Expand short queries for better keyword/BM25 coverage
      const expandedQuery = await expandQuery(standaloneQuery);
      console.log(`[chat] standalone="${standaloneQuery}", expanded="${expandedQuery}"`);

      // 3. Decoupled search: vector & reranker use standaloneQuery, BM25 uses expandedQuery
      const chunks = await searchChunks(siteId, standaloneQuery, 6, 12000, expandedQuery);
      if (chunks.length === 0) {
        return NextResponse.json(
          { error: "No indexed chunks for this site. Scrape a URL first." },
          { status: 422, headers: corsHeaders }
        );
      }

      context = formatContext(chunks);
      citations = buildCitations(chunks);
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

    let groqStream;
    try {
      groqStream = await streamAnswer(
        question,
        context,
        language,
        history,
        site.systemPrompt,
        site.tone
      );
    } catch (err) {
      if (err instanceof GroqBusyError) {
        return NextResponse.json({ error: GROQ_BUSY_MESSAGE }, { status: 429, headers: corsHeaders });
      }
      const message = err instanceof Error ? err.message : "Groq request failed";
      const friendly = /rate limit|413|request too large|tokens per minute/i.test(message)
        ? GROQ_BUSY_MESSAGE
        : message;
      return NextResponse.json({ error: friendly }, { status: 429, headers: corsHeaders });
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
            standaloneQuery: isRewritten ? standaloneQuery : undefined,
          });

          for await (const part of groqStream) {
            const delta = part.choices[0]?.delta?.content ?? "";
            if (delta) {
              fullAnswer += delta;
              send({ type: "token", content: delta });
            }
          }

          const assistantMessage = await prisma.message.create({
            data: {
              sessionId,
              role: "assistant",
              content: fullAnswer,
              citations,
              latencyMs: Date.now() - startTime,
            },
          });

          send({ type: "done", sessionId, messageId: assistantMessage.id });
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
