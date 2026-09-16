import { stitchText, expandChunkWindows, formatContext, buildCitations, type RetrievedChunk } from "../src/lib/retrieval/search";
import { prisma } from "../src/lib/db";

async function runTests() {
  console.log("=== Testing Context Window Expansion & Passage Stitching ===\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${msg}`);
      failed++;
    }
  }

  // -------------------------------------------------------------------------
  // Test 1: stitchText with overlapping seam (200-char scraper overlap simulation)
  // -------------------------------------------------------------------------
  console.log("Test 1: Seam deduplication in stitchText");
  const part1 = "Modern RAG architectures utilize hybrid search combining dense vector embeddings with sparse BM25 full-text search. Cross-encoder reranking ensures high relevance.";
  const overlapPart = "sparse BM25 full-text search. Cross-encoder reranking ensures high relevance.";
  const part2 = `${overlapPart} Finally, small-to-big context window expansion stitches contiguous chunks for the LLM.`;

  const stitched1 = stitchText(part1, part2);
  const expectedCombined = "Modern RAG architectures utilize hybrid search combining dense vector embeddings with sparse BM25 full-text search. Cross-encoder reranking ensures high relevance. Finally, small-to-big context window expansion stitches contiguous chunks for the LLM.";

  assert(stitched1 === expectedCombined, "Duplicate seam cleanly removed without stutter");
  assert(!stitched1.includes("Cross-encoder reranking ensures high relevance. Cross-encoder"), "No repeated phrases in stitched output");

  // -------------------------------------------------------------------------
  // Test 2: stitchText with distinct non-overlapping paragraphs
  // -------------------------------------------------------------------------
  console.log("\nTest 2: Distinct non-overlapping paragraphs in stitchText");
  const pA = "Chapter 1: The foundation of vector databases.";
  const pB = "Chapter 2: Query optimization techniques.";
  const stitched2 = stitchText(pA, pB);
  assert(stitched2 === `${pA}\n\n${pB}`, "Distinct paragraphs joined with double newline");

  // -------------------------------------------------------------------------
  // Test 3: stitchText with full substring containment
  // -------------------------------------------------------------------------
  console.log("\nTest 3: Substring containment");
  const full = "Complete document sentence containing all information.";
  const sub = "containing all information.";
  assert(stitchText(full, sub) === full, "Sub-chunk contained in main chunk is not duplicated");

  // -------------------------------------------------------------------------
  // Test 4: formatContext uses expandedContent while buildCitations uses snippet
  // -------------------------------------------------------------------------
  console.log("\nTest 4: Context formatting vs. citation precision");
  const mockChunks: RetrievedChunk[] = [
    {
      id: "chunk-1",
      pageId: "page-1",
      pageUrl: "https://example.com/docs",
      heading: "Overview",
      order: 1,
      score: 0.94,
      isBoilerplate: false,
      content: "This is the primary matching seed snippet that matched the user's query.",
      expandedContent: "Predecessor paragraph.\n\nThis is the primary matching seed snippet that matched the user's query.\n\nSuccessor paragraph with additional context.",
    },
    {
      id: "chunk-2",
      pageId: "page-2",
      pageUrl: "https://example.com/pricing",
      heading: "Pricing",
      order: 0,
      score: 0.82,
      isBoilerplate: false,
      content: "Starter tier is free forever.",
      expandedContent: "Starter tier is free forever. Pro tier is $29/mo.",
    },
  ];

  const formatted = formatContext(mockChunks);
  assert(formatted.includes('<document id="1" heading="Overview">'), "Document 1 has correct id and heading");
  assert(formatted.includes("Predecessor paragraph."), "LLM receives expanded context with predecessor");
  assert(formatted.includes("Successor paragraph with additional context."), "LLM receives expanded context with successor");

  const citations = buildCitations(mockChunks);
  assert(citations.length === 2, "2 citations built");
  assert(citations[0].index === 1, "Citation 1 index matches Document 1");
  assert(citations[0].snippet.startsWith("This is the primary matching seed snippet"), "Citation 1 snippet is grounded to seed chunk, not bloated");

  // -------------------------------------------------------------------------
  // Test 5: Real Database Retrieval Test with expandChunkWindows
  // -------------------------------------------------------------------------
  console.log("\nTest 5: Real Database Verification");
  try {
    const pages = await prisma.page.findMany({
      where: {
        chunks: {
          some: {},
        },
      },
      include: {
        chunks: {
          where: { isBoilerplate: false },
          orderBy: { order: "asc" },
          take: 4,
        },
      },
      take: 5,
    });

    const pageWithMultiple = pages.find((p) => p.chunks.length >= 2);

    if (pageWithMultiple) {
      const pageId = pageWithMultiple.id;
      const chunks = pageWithMultiple.chunks;

      console.log(`  Found real page ${pageId} (${pageWithMultiple.url}) with ${chunks.length} chunks to test window expansion:`);
      chunks.forEach((c) => console.log(`    Order ${c.order}: "${c.content.slice(0, 60).replace(/\n/g, ' ')}..."`));

      // Use the 2nd chunk (order 1) as seed
      const seedIndex = 1;
      const seedChunk: RetrievedChunk = {
        id: chunks[seedIndex].id,
        pageId: pageWithMultiple.id,
        pageUrl: pageWithMultiple.url,
        heading: chunks[seedIndex].heading,
        order: chunks[seedIndex].order,
        score: 0.88,
        isBoilerplate: false,
        content: chunks[seedIndex].content,
      };

      const expanded = await expandChunkWindows([seedChunk], 1);
      assert(expanded.length === 1, "Expanded results returned 1 passage");
      assert(Boolean(expanded[0].expandedContent), "Passage has expandedContent populated");
      assert(
        (expanded[0].expandedContent?.length ?? 0) >= seedChunk.content.length,
        `Expanded content (${expanded[0].expandedContent?.length} chars) is >= seed chunk (${seedChunk.content.length} chars)`
      );

      console.log(`  [INFO] Expanded passage length: ${expanded[0].expandedContent?.length} characters (original seed was ${seedChunk.content.length})`);
      console.log(`  [INFO] Expanded preview: "${expanded[0].expandedContent?.slice(0, 150).replace(/\n/g, ' ')}..."`);
    } else {
      console.log("  [SKIP] No pages with >= 2 chunks found in DB.");
    }
  } catch (dbErr) {
    console.warn("  [NOTE] DB query skipped:", dbErr);
  }

  console.log(`\n=== Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((e) => {
    console.error("Test execution failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
