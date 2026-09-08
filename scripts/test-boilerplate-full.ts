/**
 * Comprehensive test: scrape a page, then test retrieval with similarity threshold
 * Run: npx tsx scripts/test-boilerplate-full.ts <url>
 */
import "dotenv/config";
import { fetchPage } from "../src/lib/scraper/fetchPage";
import { chunkDocument } from "../src/lib/scraper/chunk";
import { streamAnswer, NO_ANSWER_PHRASE } from "../src/lib/groq";
import { searchChunks, formatContext } from "../src/lib/retrieval/search";
import { createId } from "../src/lib/id";
import { prisma } from "../src/lib/db";
import { embedDocuments, embeddingToSql } from "../src/lib/embeddings/embed";

async function testUrl(url: string) {
  console.log(`=== Testing ${url} ===`);
  
  // Scrape and chunk
  const page = await fetchPage(url);
  console.log(`Title: ${page.title}`);
  console.log(`Text content: ${page.textContent.length} chars`);
  
  // Check raw HTML for fundraising banner
  const rawHtml = (page.rawHtml || '').toLowerCase();
  const hasDonate = rawHtml.includes('donate');
  const hasFund = rawHtml.includes('fund');
  const hasSupport = rawHtml.includes('support');
  console.log(`Raw HTML contains donate: ${hasDonate}, fund: ${hasFund}, support: ${hasSupport}`);
  
  const chunks = chunkDocument(page.textContent);
  console.log(`Total chunks: ${chunks.length}`);
  const boilerplateChunks = chunks.filter(c => c.isBoilerplate);
  console.log(`Boilerplate chunks: ${boilerplateChunks.length}`);
  
  // Look for fundraising banner specifically in chunks
  const fundraisingChunks = chunks.filter(c => 
    c.content.toLowerCase().includes('donate') || 
    c.content.toLowerCase().includes('fund') ||
    c.content.toLowerCase().includes('support')
  );
  console.log(`Chunks mentioning donate/fund/support: ${fundraisingChunks.length}`);
  if (fundraisingChunks.length > 0) {
    console.log("Potential fundraising/banner chunks:");
    fundraisingChunks.forEach((c, i) => {
      console.log(`  ${i + 1}. isBoilerplate=${c.isBoilerplate}: ${c.content.slice(0, 200)}...`);
    });
  } else if (hasDonate || hasFund || hasSupport) {
    console.log("Raw HTML contains fundraising terms but they were filtered out by Readability");
  }
  
  // Create a test site in database
  const site = await prisma.site.create({
    data: { name: page.title },
  });
  const pg = await prisma.page.create({
    data: { siteId: site.id, url: page.url, title: page.title },
  });
  console.log(`Created test site: ${site.id} page: ${pg.id}`);
  
  // Embed and store chunks
  const embeddings = await embedDocuments(chunks.map((c) => c.content));
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const embedding = embeddings[i];
    if (!embedding) continue;
    const emb = embeddingToSql(embedding);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Chunk" (id, "pageId", content, heading, "order", "isBoilerplate", embedding)
      VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS vector))
      `,
      createId(),
      pg.id,
      c.content,
      c.heading,
      c.order,
      c.isBoilerplate || false,
      emb
    );
  }
  console.log(`Stored ${chunks.length} chunks`);
  
  // Test 1: Relevant question (should get answer)
  console.log("\n=== Test 1: Relevant question ===");
  const relevantQuestion = "What is this page about?";
  const relevantChunks = await searchChunks(site.id, relevantQuestion, 5);
  console.log(`Retrieved ${relevantChunks.length} chunks`);
  if (relevantChunks.length > 0) {
    console.log(`Top chunk score: ${relevantChunks[0].score.toFixed(3)}`);
    console.log(`Top chunk is boilerplate: ${relevantChunks[0].isBoilerplate}`);
  }
  
  const relevantContext = formatContext(relevantChunks);
  const relevantStream = await streamAnswer(relevantQuestion, relevantContext);
  let relevantAnswer = "";
  for await (const part of relevantStream) {
    relevantAnswer += part.choices[0]?.delta?.content ?? "";
  }
  console.log(`Answer: ${relevantAnswer.slice(0, 200)}...`);
  
  // Test 2: Unrelated question (should get no-answer phrase)
  console.log("\n=== Test 2: Unrelated question (LLM refusal test) ===");
  const unrelatedQuestion = "What is the exact orbital period of Kepler-186f according to NASA's secret appendix Z?";
  const unrelatedChunks = await searchChunks(site.id, unrelatedQuestion, 5);
  console.log(`Retrieved ${unrelatedChunks.length} chunks (no hard threshold, LLM will refuse)`);
  if (unrelatedChunks.length > 0) {
    console.log(`Top chunk score: ${unrelatedChunks[0].score.toFixed(3)}`);
    console.log(`Top chunk is boilerplate: ${unrelatedChunks[0].isBoilerplate}`);
    console.log(`Top chunk content: ${unrelatedChunks[0].content.slice(0, 150)}...`);
  }
  
  const unrelatedContext = formatContext(unrelatedChunks);
  const unrelatedStream = await streamAnswer(unrelatedQuestion, unrelatedContext);
  let unrelatedAnswer = "";
  for await (const part of unrelatedStream) {
    unrelatedAnswer += part.choices[0]?.delta?.content ?? "";
  }
  console.log(`Answer: ${unrelatedAnswer}`);
  
  const normalized = unrelatedAnswer.trim();
  const ok = normalized === NO_ANSWER_PHRASE || normalized.includes("couldn't find that in the source");
  
  if (ok) {
    console.log("✓ Similarity threshold working correctly - refused to answer from missing context");
  } else {
    console.error("✗ Similarity threshold may be too low - answered unrelated question");
  }
  
  // Cleanup — deleting site cascades to pages → chunks
  await prisma.site.delete({ where: { id: site.id } });
  console.log(`\nCleaned up test site ${site.id}`);
  
  return { 
    totalChunks: chunks.length, 
    boilerplateChunks: boilerplateChunks.length,
    relevantChunksRetrieved: relevantChunks.length,
    unrelatedChunksRetrieved: unrelatedChunks.length,
    thresholdTestPassed: ok
  };
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: npx tsx scripts/test-boilerplate-full.ts <url>");
    process.exit(1);
  }
  if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY missing");
    process.exit(1);
  }
  
  const result = await testUrl(url);
  
  console.log("\n=== Summary ===");
  console.log(`Total chunks: ${result.totalChunks}`);
  console.log(`Boilerplate chunks: ${result.boilerplateChunks}`);
  console.log(`Relevant question retrieved: ${result.relevantChunksRetrieved} chunks`);
  console.log(`Unrelated question retrieved: ${result.unrelatedChunksRetrieved} chunks`);
  console.log(`Similarity threshold test: ${result.thresholdTestPassed ? "PASS" : "FAIL"}`);
  
  process.exit(result.thresholdTestPassed ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
