/**
 * Burst stress: STRESS_N parallel calls through the real groq retry path.
 * Run: STRESS_N=50 npx tsx scripts/stress-groq-retry.ts
 *
 * Light pace (default off): LIGHT=1 npx tsx scripts/stress-groq-retry.ts
 */
import "dotenv/config";
import {
  createChatStreamWithRetry,
  GroqBusyError,
  getRetryAfterMs,
} from "../src/lib/groq";

const PAD = "The quick brown fox jumps over the lazy dog. ".repeat(80);
const CONTEXT = Array.from({ length: 8 }, (_, i) => `[${i + 1}] (Pad ${i + 1})\n${PAD}`).join(
  "\n\n"
);
const QUESTION =
  "Using only the context, what is the capital of France? If missing, say you could not find it.";

type CallResult = {
  ok: boolean;
  hit429: boolean;
  usedRetryAfter: boolean;
  hitBudgetCap: boolean;
  retries: number;
  waitedMs: number;
  error?: string;
};

async function oneCall(label: string): Promise<CallResult> {
  console.log(`[${label}] starting request at ${new Date().toISOString()}`);
  const started = Date.now();
  try {
    const { stream, stats } = await createChatStreamWithRetry({
      messages: [
        {
          role: "system",
          content:
            "Answer briefly from context only. Cite [n]. If missing, say: I couldn't find that in the source.",
        },
        { role: "user", content: `Context:\n${CONTEXT}\n\nQuestion: ${QUESTION}` },
      ],
      temperature: 0.2,
      max_tokens: 64,
    });

    let text = "";
    for await (const part of stream) {
      text += part.choices[0]?.delta?.content ?? "";
    }

    console.log(
      `[${label}] OK in ${Date.now() - started}ms retries=${stats.retries} waited=${stats.waitedMs}ms retryAfter=${stats.usedRetryAfter} — ${text.slice(0, 50).replace(/\n/g, " ")}`
    );
    console.log(`[${label}] request settled (success) at ${new Date().toISOString()}`);

    return {
      ok: true,
      hit429: stats.saw429,
      usedRetryAfter: stats.usedRetryAfter,
      hitBudgetCap: false,
      retries: stats.retries,
      waitedMs: stats.waitedMs,
    };
  } catch (err) {
    const busy = err instanceof GroqBusyError;
    const msg = err instanceof Error ? err.message : String(err);
    // Probe whether the underlying/cause error carried Retry-After
    const cause = (err as { cause?: unknown }).cause;
    const hadRetryAfter =
      (busy && err.usedRetryAfter) || getRetryAfterMs(err) != null || getRetryAfterMs(cause) != null;

    console.error(
      `[${label}] FAIL in ${Date.now() - started}ms budgetCap=${busy ? err.hitBudgetCap : false} retryAfter=${hadRetryAfter} — ${msg.slice(0, 120)}`
    );
    console.log(`[${label}] request settled (failure) at ${new Date().toISOString()}`);

    return {
      ok: false,
      hit429: busy || /rate limit|429/i.test(msg),
      usedRetryAfter: hadRetryAfter,
      hitBudgetCap: busy ? err.hitBudgetCap : false,
      retries: busy ? Math.max(0, err.attempts - 1) : 0,
      waitedMs: busy ? err.waitedMs : 0,
      error: msg,
    };
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function summarize(label: string, results: CallResult[]) {
  const n = results.length;
  const ok = results.filter((r) => r.ok).length;
  const saw429 = results.filter((r) => r.hit429).length;
  const usedRa = results.filter((r) => r.usedRetryAfter).length;
  const budgetCap = results.filter((r) => r.hitBudgetCap).length;
  const recovered = results.filter((r) => r.ok && r.hit429).length;

  console.log(`\n=== ${label} ===`);
  console.log(`Succeeded: ${ok}/${n}`);
  console.log(`Observed 429 (then retried or failed): ${saw429}/${n}`);
  console.log(`Recovered after 429: ${recovered}/${n}`);
  console.log(`Used Retry-After header: ${usedRa}/${n}`);
  console.log(`Hit 20s wait budget cap: ${budgetCap}/${n}`);
  return { ok, n, saw429, usedRa, budgetCap, recovered };
}

async function runBurst() {
  const n = Number(process.env.STRESS_N || 50);
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  console.log(`Burst stress: model=${model} parallel=${n}`);
  const results = await Promise.all(Array.from({ length: n }, (_, i) => oneCall(`req-${i + 1}`)));
  return summarize("BURST", results);
}

async function runLight() {
  const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
  console.log(`\nLight pace: model=${model} — 5 requests, 3–5s apart`);
  const results: CallResult[] = [];
  for (let i = 0; i < 5; i++) {
    console.log(`\n=== Starting light request ${i + 1}/5 ===`);
    if (i > 0) {
      const gap = 3000 + Math.floor(Math.random() * 2001); // 3–5s
      console.log(`(waiting ${gap}ms before next…)`);
      await sleep(gap);
    }
    results.push(await oneCall(`light-${i + 1}`));
    console.log(`=== Light request ${i + 1}/5 completed ===`);
  }
  console.log(`\n=== All light requests completed ===`);
  return summarize("LIGHT", results);
}

async function main() {
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY missing");
    process.exit(1);
  }

  console.log(`=== Test script started at ${new Date().toISOString()} ===`);

  const args = new Set(process.argv.slice(2));
  const lightOnly = process.env.LIGHT === "1" || args.has("--light");
  const skipLight = process.env.SKIP_LIGHT === "1" || args.has("--burst-only");

  let burst: ReturnType<typeof summarize> | null = null;
  if (!lightOnly) {
    burst = await runBurst();
  }

  let light: ReturnType<typeof summarize> | null = null;
  if (!skipLight) {
    // Cool down after burst so light test isn't poisoned by TPM debt
    if (burst) {
      console.log("\nCooling down 25s before light-pace test…");
      await sleep(25_000);
    }
    light = await runLight();
  }

  console.log("\n=== REPORT ===");
  if (burst) {
    console.log(
      `Burst recovery: ${burst.ok}/${burst.n} succeeded; ${burst.recovered} recovered after 429; Retry-After used on ${burst.usedRa}; budget-cap fails ${burst.budgetCap}`
    );
  }
  if (light) {
    console.log(
      `Light pace: ${light.ok}/${light.n} succeeded; 429s=${light.saw429} (want 0)`
    );
    if (light.saw429 > 0) {
      console.error("FAIL: light-pace chat should not hit 429");
      process.exit(1);
    }
  }

  if (burst && burst.ok === 0) process.exit(1);

  console.log(`=== Test script completed at ${new Date().toISOString()} ===`);
}

main().catch((err) => {
  console.error(`Test script error at ${new Date().toISOString()}:`, err);
  process.exit(1);
});
