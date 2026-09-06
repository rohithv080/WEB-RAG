/**
 * Ask an unrelated question against retrieved context; expect the fixed no-answer phrase.
 * Requires DATABASE_URL + scraped site. Run after scrape:
 *   npx tsx scripts/test-no-answer.ts <siteId>
 */
import "dotenv/config";
import { streamAnswer, NO_ANSWER_PHRASE } from "../src/lib/groq";
import { searchChunks, formatContext } from "../src/lib/retrieval/search";

async function main() {
  const siteId = process.argv[2];
  if (!siteId) {
    console.error("Usage: npx tsx scripts/test-no-answer.ts <siteId>");
    process.exit(1);
  }
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY missing");
    process.exit(1);
  }

  const question =
    "What is the exact orbital period of Kepler-186f according to NASA's secret appendix Z?";
  const chunks = await searchChunks(siteId, question, 5);
  const context = formatContext(chunks);
  console.log("Retrieved chunks:", chunks.length);
  console.log("--- context preview ---\n", context.slice(0, 400), "\n---");

  const stream = await streamAnswer(question, context);
  let answer = "";
  for await (const part of stream) {
    answer += part.choices[0]?.delta?.content ?? "";
  }

  console.log("Answer:\n", answer);
  const normalized = answer.trim();
  const ok =
    normalized === NO_ANSWER_PHRASE ||
    normalized.includes("couldn't find that in the source");
  const hallucinatedCite = /\[\d+\]/.test(normalized) && !ok;

  if (hallucinatedCite) {
    console.error("FAIL: model cited sources while answering an out-of-context question.");
    process.exit(1);
  }
  if (!ok) {
    console.error(`FAIL: expected phrase containing "${NO_ANSWER_PHRASE}"`);
    process.exit(1);
  }
  console.log("OK: refused to answer from missing context.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
