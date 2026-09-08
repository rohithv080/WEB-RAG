import Groq from "groq-sdk";

const apiKeys = (process.env.GROQ_API_KEYS || process.env.GROQ_API_KEY || "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

let currentKeyIndex = 0;

export function getGroqClient() {
  if (apiKeys.length === 0) {
    return new Groq({ apiKey: "missing-key" });
  }
  const key = apiKeys[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
  return new Groq({ apiKey: key });
}

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1_000;
const MAX_DELAY_MS = 15_000;
const MAX_WAIT_BUDGET_MS = 45_000;
const MAX_RETRY_AFTER_RATIO = 0.6; // Cap Retry-After to 60% of remaining budget

export const NO_ANSWER_PHRASE = "I couldn't find that in the source.";
export const GROQ_BUSY_MESSAGE =
  "High demand right now, please try again in a moment";

const SYSTEM_PROMPT = `You are an expert AI assistant grounded entirely in a specific knowledge base.

GREETING BEHAVIOR:
For simple greetings (e.g., "hi", "hello"), respond warmly and briefly in 1 sentence.

ANALYSIS & THINKING:
Before answering the user's question, you MUST think step-by-step in a <thinking> block.
1. Analyze the user's question to understand exactly what they are asking.
2. Read through the provided <document> tags carefully.
3. Identify which documents contain relevant information.
4. Formulate your answer based ONLY on those documents.

ANSWERING RULES:
1. Answer ONLY using the provided <document> blocks. Do NOT invent or guess any facts outside the context.
2. When you use information from a document, cite it inline using the document ID like this: [1], [2], etc.
3. If multiple documents are relevant, synthesize them into a single coherent answer.
4. DO NOT USE MARKDOWN TABLES. Use bulleted lists instead.
5. Ensure your final answer (outside the <thinking> block) is beautifully formatted, concise, and direct.

REFUSAL:
If the documents do not contain the answer at all, your final answer must be EXACTLY: "${NO_ANSWER_PHRASE}"`;

export class GroqBusyError extends Error {
  readonly hitBudgetCap: boolean;
  readonly usedRetryAfter: boolean;
  readonly attempts: number;
  readonly waitedMs: number;

  constructor(opts: {
    hitBudgetCap: boolean;
    usedRetryAfter: boolean;
    attempts: number;
    waitedMs: number;
    cause?: unknown;
  }) {
    super(GROQ_BUSY_MESSAGE);
    this.name = "GroqBusyError";
    this.hitBudgetCap = opts.hitBudgetCap;
    this.usedRetryAfter = opts.usedRetryAfter;
    this.attempts = opts.attempts;
    this.waitedMs = opts.waitedMs;
    if (opts.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = opts.cause;
    }
  }
}

export type GroqRetryStats = {
  attempts: number;
  retries: number;
  waitedMs: number;
  usedRetryAfter: boolean;
  hitBudgetCap: boolean;
  saw429: boolean;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; error?: { code?: string }; message?: string };
  return (
    e.status === 429 ||
    e.error?.code === "rate_limit_exceeded" ||
    (typeof e.message === "string" && e.message.toLowerCase().includes("rate limit"))
  );
}

/** Read Retry-After (seconds or HTTP-date) from Groq APIError.headers. */
export function getRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const headers = (err as { headers?: Record<string, string | null | undefined> }).headers;
  if (!headers) return null;

  const raw =
    headers["retry-after"] ??
    headers["Retry-After"] ??
    headers["RETRY-AFTER"] ??
    null;
  if (raw == null || raw === "") return null;

  const asSeconds = Number(raw);
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return Math.round(asSeconds * 1000);
  }

  const asDate = Date.parse(raw);
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
}

/**
 * delay = min(baseDelay * 2^attempt + random(0, 500ms), maxDelay)
 * Prefer Retry-After when present (still capped by maxDelay).
 */
export function computeBackoffMs(
  attempt: number,
  retryAfterMs: number | null
): { delayMs: number; usedRetryAfter: boolean } {
  if (retryAfterMs != null && retryAfterMs >= 0) {
    return {
      delayMs: Math.min(retryAfterMs, MAX_DELAY_MS),
      usedRetryAfter: true,
    };
  }

  const jitter = Math.floor(Math.random() * 501); // 0..500 inclusive
  const exponential = BASE_DELAY_MS * 2 ** attempt + jitter;
  return {
    delayMs: Math.min(exponential, MAX_DELAY_MS),
    usedRetryAfter: false,
  };
}

type CreateArgs = {
  model?: string;
  messages: Groq.Chat.ChatCompletionMessageParam[];
  temperature?: number;
  max_tokens?: number;
};

/**
 * Shared chat-completions create with exponential backoff + jitter,
 * Retry-After respect, and a ~45s cumulative wait budget.
 */
export async function createChatStreamWithRetry(args: CreateArgs): Promise<{
  stream: AsyncIterable<Groq.Chat.ChatCompletionChunk>;
  stats: GroqRetryStats;
}> {
  const DECOMMISSIONED_MODELS = new Set([
    "llama3-8b-8192",
    "llama3-70b-8192",
  ]);
  const DEFAULT_MODEL = "llama-3.3-70b-versatile";
  let envModel = (process.env.GROQ_MODEL || DEFAULT_MODEL).trim();
  if (DECOMMISSIONED_MODELS.has(envModel)) {
    envModel = DEFAULT_MODEL;
  }
  const model = args.model || envModel;
  let lastError: unknown;
  let waitedMs = 0;
  let usedRetryAfter = false;
  let saw429 = false;
  const waitTimeline: { attempt: number; before: number; after: number; sleepMs: number }[] = [];

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        console.warn(`[groq] retry attempt ${attempt + 1}/${MAX_RETRIES}`);
      }

      const stream = await getGroqClient().chat.completions.create({
        model,
        messages: args.messages,
        stream: true,
        temperature: args.temperature ?? 0.2,
        ...(args.max_tokens != null ? { max_tokens: args.max_tokens } : {}),
      });

      return {
        stream,
        stats: {
          attempts: attempt + 1,
          retries: attempt,
          waitedMs,
          usedRetryAfter,
          hitBudgetCap: false,
          saw429,
        },
      };
    } catch (err) {
      lastError = err;
      if (!isRateLimitError(err)) throw err;

      saw429 = true;
      const retryAfterMs = getRetryAfterMs(err);
      const { delayMs, usedRetryAfter: usedRa } = computeBackoffMs(attempt, retryAfterMs);
      if (usedRa) usedRetryAfter = true;

      const isLastAttempt = attempt === MAX_RETRIES - 1;
      if (isLastAttempt) {
        throw new GroqBusyError({
          hitBudgetCap: false,
          usedRetryAfter,
          attempts: attempt + 1,
          waitedMs,
          cause: err,
        });
      }

      const remainingBudget = MAX_WAIT_BUDGET_MS - waitedMs;
      if (remainingBudget <= 0) {
        console.warn(`[groq] wait budget exhausted (waited=${waitedMs}ms, cap=${MAX_WAIT_BUDGET_MS}ms)`);
        throw new GroqBusyError({
          hitBudgetCap: true,
          usedRetryAfter,
          attempts: attempt + 1,
          waitedMs,
          cause: err,
        });
      }

      // Cap Retry-After to 60% of remaining budget to allow room for retries
      let cappedDelayMs = delayMs;
      if (usedRa && delayMs > remainingBudget * MAX_RETRY_AFTER_RATIO) {
        cappedDelayMs = Math.floor(remainingBudget * MAX_RETRY_AFTER_RATIO);
        console.warn(
          `[groq] Retry-After ${delayMs}ms capped to ${cappedDelayMs}ms (60% of remaining budget ${remainingBudget}ms)`
        );
      }

      // Prefer full backoff; if it won't fit, spend whatever budget remains and try once more.
      let sleepMs = cappedDelayMs;
      let budgetCapImminent = false;
      if (cappedDelayMs > remainingBudget) {
        if (remainingBudget < 250) {
          console.warn(
            `[groq] wait budget exhausted (waited=${waitedMs}ms, next=${cappedDelayMs}ms, cap=${MAX_WAIT_BUDGET_MS}ms)`
          );
          throw new GroqBusyError({
            hitBudgetCap: true,
            usedRetryAfter,
            attempts: attempt + 1,
            waitedMs,
            cause: err,
          });
        }
        sleepMs = remainingBudget;
        budgetCapImminent = true;
        console.warn(
          `[groq] 429 — Retry-After/backoff ${cappedDelayMs}ms exceeds remaining budget; sleeping ${sleepMs}ms then final attempt`
        );
      } else {
        console.warn(
          `[groq] 429 — backing off ${sleepMs}ms` +
            (usedRa ? ` (Retry-After, original=${delayMs}ms)` : ` (exp+jitter)`) +
            ` budget_remaining=${remainingBudget - sleepMs}ms`
        );
      }

      const waitStart = Date.now();
      await sleep(sleepMs);
      const waitEnd = Date.now();
      const actualWaitMs = waitEnd - waitStart;
      waitedMs += actualWaitMs;
      waitTimeline.push({ attempt: attempt + 1, before: waitStart, after: waitEnd, sleepMs: actualWaitMs });
      console.warn(`[groq] wait timeline: attempt ${attempt + 1} waited ${actualWaitMs}ms (total ${waitedMs}ms)`);

      if (budgetCapImminent) {
        // One last try after spending the rest of the budget; if it 429s, fail friendly.
        console.warn(`[groq] final attempt with exhausted budget (total waited=${waitedMs}ms)`);
        try {
          const stream = await getGroqClient().chat.completions.create({
            model,
            messages: args.messages,
            stream: true,
            temperature: args.temperature ?? 0.2,
            ...(args.max_tokens != null ? { max_tokens: args.max_tokens } : {}),
          });
          console.warn(`[groq] final attempt succeeded after ${waitedMs}ms total wait`);
          return {
            stream,
            stats: {
              attempts: attempt + 2,
              retries: attempt + 1,
              waitedMs,
              usedRetryAfter,
              hitBudgetCap: false,
              saw429,
            },
          };
        } catch (finalErr) {
          lastError = finalErr;
          console.warn(`[groq] final attempt failed after ${waitedMs}ms total wait`);
          if (!isRateLimitError(finalErr)) throw finalErr;
          throw new GroqBusyError({
            hitBudgetCap: true,
            usedRetryAfter: usedRetryAfter || getRetryAfterMs(finalErr) != null,
            attempts: attempt + 2,
            waitedMs,
            cause: finalErr,
          });
        }
      }
    }
  }

  throw new GroqBusyError({
    hitBudgetCap: false,
    usedRetryAfter,
    attempts: MAX_RETRIES,
    waitedMs,
    cause: lastError,
  });
}

export async function streamAnswer(question: string, context: string) {
  const { stream } = await createChatStreamWithRetry({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Context:\n${context}\n\nQuestion: ${question}`,
      },
    ],
    temperature: 0.2,
  });
  return stream;
}

export async function getAnswer(question: string, context: string): Promise<string> {
  const stream = await streamAnswer(question, context);
  let answer = "";
  for await (const part of stream) {
    answer += part.choices[0]?.delta?.content ?? "";
  }
  return answer;
}

const EXPAND_PROMPT = `You are a search query expander. Given a short user query, output an expanded version that includes:
- The original query
- Synonyms and closely related terms
- Likely sub-topics or specific items the user might be looking for

Rules:
- Output ONLY the expanded query as a single line of comma-separated terms
- Keep it under 100 words
- Do NOT add explanations, do NOT number items
- If the query is already long and specific (>8 words), return it unchanged

Examples:
Input: "pasta"
Output: pasta, pasta recipes, spaghetti, penne, pappardelle, tortellini, noodles, macaroni, fettuccine, linguine, pasta sauce, homemade pasta

Input: "Daji counters"
Output: Daji counters, Daji counter picks, heroes that beat Daji, Daji weaknesses, how to counter Daji

Input: "how to make chocolate cake from scratch"
Output: how to make chocolate cake from scratch`;

/**
 * Expand short queries into richer search terms using the LLM.
 * Only expands queries with fewer than 6 words to avoid over-expanding
 * already-specific queries.
 */
export async function expandQuery(query: string): Promise<string> {
  const wordCount = query.trim().split(/\s+/).length;
  
  // Don't expand queries that are already specific enough
  if (wordCount > 6) return query;
  
  try {
    const { stream } = await createChatStreamWithRetry({
      messages: [
        { role: "system", content: EXPAND_PROMPT },
        { role: "user", content: query },
      ],
      temperature: 0.1,
      max_tokens: 150,
    });

    let expanded = "";
    for await (const part of stream) {
      const delta = part.choices[0]?.delta?.content ?? "";
      expanded += delta;
    }

    const result = expanded.trim();
    if (!result) return query;
    
    console.log(`[query expand] "${query}" → "${result}"`);
    return result;
  } catch (err) {
    // If expansion fails, just use original query — don't block the user
    console.warn("[query expand] failed, using original:", err);
    return query;
  }
}
