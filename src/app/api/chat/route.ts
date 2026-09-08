import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { streamAnswer, GroqBusyError, GROQ_BUSY_MESSAGE, expandQuery } from "@/lib/groq";
import { searchChunks, formatContext, buildCitations } from "@/lib/retrieval/search";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatBody = {
  question?: string;
  siteId?: string;
  sessionId?: string;
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY && !process.env.GROQ_API_KEYS) {
      return NextResponse.json(
        { error: "GROQ_API_KEY or GROQ_API_KEYS is not configured" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as ChatBody;
    const question = typeof body.question === "string" ? body.question.trim() : "";
    const siteId = typeof body.siteId === "string" ? body.siteId : "";
    let sessionId = typeof body.sessionId === "string" ? body.sessionId : "";

    if (!question || !siteId) {
      return NextResponse.json(
        { error: "question and siteId are required" },
        { status: 400 }
      );
    }

    const site = await prisma.site.findUnique({ where: { id: siteId } });
    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    if (sessionId) {
      const session = await prisma.chatSession.findFirst({
        where: { id: sessionId, siteId },
      });
      if (!session) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
    } else {
      const session = await prisma.chatSession.create({ data: { siteId } });
      sessionId = session.id;
    }

    // Fast-path: detect greetings/chitchat — skip expensive search pipeline
    const GREETING_PATTERNS = /^(hi|hey|hello|yo|sup|hola|howdy|good\s*(morning|afternoon|evening|night)|what'?s?\s*up|how\s*are\s*you|thanks?|thank\s*you|bye|goodbye|see\s*ya|ok|okay|cool|nice|great|awesome|got\s*it)[\s!?.]*$/i;
    const isGreeting = GREETING_PATTERNS.test(question);

    let context = "";
    let citations: any[] = [];

    if (!isGreeting) {
      // Expand short queries for better retrieval
      const expandedQuery = await expandQuery(question);
      console.log(`[chat] original="${question}", expanded="${expandedQuery}"`);

      const chunks = await searchChunks(siteId, expandedQuery, 15);
      if (chunks.length === 0) {
        return NextResponse.json(
          { error: "No indexed chunks for this site. Scrape a URL first." },
          { status: 422 }
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
      groqStream = await streamAnswer(question, context);
    } catch (err) {
      if (err instanceof GroqBusyError) {
        return NextResponse.json({ error: GROQ_BUSY_MESSAGE }, { status: 429 });
      }
      const message = err instanceof Error ? err.message : "Groq request failed";
      const friendly = /rate limit/i.test(message) ? GROQ_BUSY_MESSAGE : message;
      return NextResponse.json({ error: friendly }, { status: 429 });
    }

    const encoder = new TextEncoder();
    let fullAnswer = "";

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        try {
          send({ type: "meta", sessionId, citations });

          for await (const part of groqStream) {
            const delta = part.choices[0]?.delta?.content ?? "";
            if (delta) {
              fullAnswer += delta;
              send({ type: "token", content: delta });
            }
          }

          await prisma.message.create({
            data: {
              sessionId,
              role: "assistant",
              content: fullAnswer,
              citations,
            },
          });

          send({ type: "done", sessionId });
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
      },
    });
  } catch (err) {
    console.error("[chat]", err);
    const message = err instanceof Error ? err.message : "Chat failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
