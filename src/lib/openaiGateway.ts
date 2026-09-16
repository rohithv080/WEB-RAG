import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { verifyApiKey, type VerifiedApiKey } from "@/lib/apiKey";
import {
  streamAnswer,
  GroqBusyError,
  GROQ_BUSY_MESSAGE,
  expandQuery,
  condenseQuery,
  type ChatHistoryItem,
} from "@/lib/groq";
import { searchChunks, formatContext, buildCitations } from "@/lib/retrieval/search";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-api-key",
};

export function handleOptions() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChatBody = {
  model?: string;
  messages?: OpenAIChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
};

const GREETING_PATTERNS =
  /^(hi|hey|hello|yo|sup|hola|howdy|good\s*(morning|afternoon|evening|night)|what'?s?\s*up|how\s*are\s*you|thanks?|thank\s*you|bye|goodbye|see\s*ya|ok|okay|cool|nice|great|awesome|got\s*it)[\s!?.]*$/i;

/**
 * Core handler for /v1/chat/completions conforming to OpenAI API specification
 */
export async function handleChatCompletions(req: NextRequest) {
  const verifiedKey = await verifyApiKey(req);
  if (!verifiedKey) {
    return NextResponse.json(
      {
        error: {
          message:
            "Incorrect API key provided. You must provide a valid API key using Bearer authentication (e.g. Authorization: Bearer wr_live_...).",
          type: "invalid_request_error",
          param: null,
          code: "invalid_api_key",
        },
      },
      { status: 401, headers: corsHeaders }
    );
  }

  let body: OpenAIChatBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          message: "Malformed JSON body in request",
          type: "invalid_request_error",
          param: null,
          code: "malformed_json",
        },
      },
      { status: 400, headers: corsHeaders }
    );
  }

  const { model, messages, stream = false } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      {
        error: {
          message: "'messages' is a required property and must be a non-empty array",
          type: "invalid_request_error",
          param: "messages",
          code: null,
        },
      },
      { status: 400, headers: corsHeaders }
    );
  }

  // Resolve target bot (Site)
  let targetSiteId = verifiedKey.siteId;

  if (model && model.trim()) {
    const requestedModel = model.trim();
    // Lookup site by ID or case-insensitive Name
    const foundSite = await prisma.site.findFirst({
      where: {
        OR: [
          { id: requestedModel },
          { name: { equals: requestedModel, mode: "insensitive" } },
        ],
        AND: [
          verifiedKey.siteId ? { id: verifiedKey.siteId } : {},
          {
            OR: [
              { userId: verifiedKey.userId },
              { isPublic: true },
            ],
          },
        ],
      },
      select: { id: true, name: true, systemPrompt: true, tone: true },
    });

    if (foundSite) {
      targetSiteId = foundSite.id;
    } else {
      return NextResponse.json(
        {
          error: {
            message: `The model '${model}' does not exist or you do not have permission to access it.`,
            type: "invalid_request_error",
            param: "model",
            code: "model_not_found",
          },
        },
        { status: 404, headers: corsHeaders }
      );
    }
  }

  if (!targetSiteId) {
    // If no model specified and key is global, pick the user's primary/latest bot
    const defaultSite = await prisma.site.findFirst({
      where: { userId: verifiedKey.userId },
      orderBy: { scrapedAt: "desc" },
      select: { id: true },
    });
    if (defaultSite) {
      targetSiteId = defaultSite.id;
    } else {
      return NextResponse.json(
        {
          error: {
            message:
              "No bot found. Please specify a bot 'model' ID in your payload or create a bot first.",
            type: "invalid_request_error",
            param: "model",
            code: "no_bot_available",
          },
        },
        { status: 400, headers: corsHeaders }
      );
    }
  }

  const site = await prisma.site.findUnique({
    where: { id: targetSiteId },
    select: { id: true, name: true, systemPrompt: true, tone: true },
  });

  if (!site) {
    return NextResponse.json(
      {
        error: {
          message: "Target bot not found",
          type: "invalid_request_error",
          param: "model",
          code: "bot_not_found",
        },
      },
      { status: 404, headers: corsHeaders }
    );
  }

  // Extract query and history
  const userMessages = messages.filter((m) => m.role === "user");
  const lastUserMsg = userMessages[userMessages.length - 1];

  if (!lastUserMsg || !lastUserMsg.content || !lastUserMsg.content.trim()) {
    return NextResponse.json(
      {
        error: {
          message: "'messages' must contain at least one user message with non-empty content",
          type: "invalid_request_error",
          param: "messages",
          code: null,
        },
      },
      { status: 400, headers: corsHeaders }
    );
  }

  const question = lastUserMsg.content.trim();
  const lastUserIndex = messages.lastIndexOf(lastUserMsg);
  const previousMessages = messages.slice(0, lastUserIndex);

  const history: ChatHistoryItem[] = previousMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-6)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

  const startTime = Date.now();
  const isGreeting = GREETING_PATTERNS.test(question);

  let context = "";
  let citations: any[] = [];
  let standaloneQuery: string | undefined;

  if (!isGreeting) {
    standaloneQuery = await condenseQuery(question, history);
    const expandedQuery = await expandQuery(standaloneQuery);
    const chunks = await searchChunks(site.id, standaloneQuery, 6, 12000, expandedQuery);

    if (chunks.length > 0) {
      context = formatContext(chunks);
      citations = buildCitations(chunks);
    }
  }

  let groqStream;
  try {
    groqStream = await streamAnswer(
      question,
      context,
      null,
      history,
      site.systemPrompt,
      site.tone
    );
  } catch (err: any) {
    if (err instanceof GroqBusyError) {
      return NextResponse.json(
        {
          error: {
            message: GROQ_BUSY_MESSAGE,
            type: "api_error",
            code: "rate_limit_exceeded",
          },
        },
        { status: 429, headers: corsHeaders }
      );
    }
    return NextResponse.json(
      {
        error: {
          message: err.message || "Upstream model inference failed",
          type: "api_error",
          code: "internal_error",
        },
      },
      { status: 500, headers: corsHeaders }
    );
  }

  const completionId = `chatcmpl-${crypto.randomBytes(16).toString("hex")}`;
  const createdTimestamp = Math.floor(Date.now() / 1000);

  // ── 1. Streaming Mode (SSE) ──────────────────────────────────────────────
  if (stream) {
    const encoder = new TextEncoder();
    let fullAnswer = "";

    const readableStream = new ReadableStream({
      async start(controller) {
        const sendChunk = (data: any) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Initial role & citations announcement chunk
          sendChunk({
            id: completionId,
            object: "chat.completion.chunk",
            created: createdTimestamp,
            model: site.id,
            choices: [
              {
                index: 0,
                delta: {
                  role: "assistant",
                  content: "",
                },
                finish_reason: null,
              },
            ],
            citations: citations.length > 0 ? citations : undefined,
          });

          for await (const part of groqStream) {
            const token = part.choices[0]?.delta?.content ?? "";
            if (token) {
              fullAnswer += token;
              sendChunk({
                id: completionId,
                object: "chat.completion.chunk",
                created: createdTimestamp,
                model: site.id,
                choices: [
                  {
                    index: 0,
                    delta: { content: token },
                    finish_reason: null,
                  },
                ],
              });
            }
          }

          // Final closing chunk
          sendChunk({
            id: completionId,
            object: "chat.completion.chunk",
            created: createdTimestamp,
            model: site.id,
            choices: [
              {
                index: 0,
                delta: {},
                finish_reason: "stop",
              },
            ],
          });

          // Terminate stream in OpenAI format
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (streamErr) {
          console.error("[openai stream error]", streamErr);
          controller.error(streamErr);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        ...corsHeaders,
      },
    });
  }

  // ── 2. Non-Streaming Mode (Single JSON Response) ──────────────────────────
  let fullAnswer = "";
  for await (const part of groqStream) {
    fullAnswer += part.choices[0]?.delta?.content ?? "";
  }

  const promptTokenEst = Math.round((context.length + question.length) / 4) + 120;
  const completionTokenEst = Math.round(fullAnswer.length / 4);

  return NextResponse.json(
    {
      id: completionId,
      object: "chat.completion",
      created: createdTimestamp,
      model: site.id,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: fullAnswer,
            citations: citations.length > 0 ? citations : undefined,
          },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: promptTokenEst,
        completion_tokens: completionTokenEst,
        total_tokens: promptTokenEst + completionTokenEst,
      },
    },
    { headers: corsHeaders }
  );
}

/**
 * Core handler for /v1/models conforming to OpenAI API specification
 */
export async function handleModels(req: NextRequest) {
  const verifiedKey = await verifyApiKey(req);
  if (!verifiedKey) {
    return NextResponse.json(
      {
        error: {
          message: "Incorrect API key provided.",
          type: "invalid_request_error",
          code: "invalid_api_key",
        },
      },
      { status: 401, headers: corsHeaders }
    );
  }

  const sites = await prisma.site.findMany({
    where: verifiedKey.siteId
      ? { id: verifiedKey.siteId }
      : {
          OR: [{ userId: verifiedKey.userId }, { isPublic: true }],
        },
    select: {
      id: true,
      name: true,
      description: true,
      scrapedAt: true,
      _count: { select: { pages: true } },
    },
    orderBy: { scrapedAt: "desc" },
  });

  const modelList = sites.map((s) => ({
    id: s.id,
    object: "model",
    created: Math.floor(new Date(s.scrapedAt).getTime() / 1000),
    owned_by: "web-rag",
    root: s.id,
    parent: null,
    permission: [],
    name: s.name || s.id,
    description: s.description || "",
    page_count: s._count.pages,
  }));

  return NextResponse.json(
    {
      object: "list",
      data: modelList,
    },
    { headers: corsHeaders }
  );
}
