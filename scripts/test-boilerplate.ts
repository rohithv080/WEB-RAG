/**
 * Test boilerplate filtering on Wikipedia RAG page and other sites
 * Run: npx tsx scripts/test-boilerplate.ts
 */
import { fetchPage } from "../src/lib/scraper/fetchPage";
import { chunkDocument } from "../src/lib/scraper/chunk";

const TEST_URLS = [
  {
    name: "Wikipedia RAG page",
    url: "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
  },
  {
    name: "Blog with newsletter (example)",
    url: "https://blog.cloudflare.com/",
  },
  {
    name: "Docs page",
    url: "https://docs.python.org/3/tutorial/index.html",
  },
];

async function testUrl(name: string, url: string) {
  console.log(`\n=== Testing ${name} ===`);
  console.log(`URL: ${url}`);
  
  try {
    const page = await fetchPage(url);
    console.log(`Title: ${page.title}`);
    console.log(`Text content: ${page.textContent.length} chars`);
    console.log(`HTML content: ${page.contentHtml.length} chars`);
    
    const chunks = chunkDocument(page.textContent);
    console.log(`Total chunks: ${chunks.length}`);
    
    const boilerplateChunks = chunks.filter(c => c.isBoilerplate);
    console.log(`Boilerplate chunks: ${boilerplateChunks.length}`);
    
    if (boilerplateChunks.length > 0) {
      console.log("\nBoilerplate chunks detected:");
      boilerplateChunks.slice(0, 3).forEach((c, i) => {
        console.log(`  ${i + 1}. [${c.heading || 'no heading'}] ${c.content.slice(0, 100)}...`);
      });
    }
    
    const nonBoilerplateChunks = chunks.filter(c => !c.isBoilerplate);
    console.log(`Non-boilerplate chunks: ${nonBoilerplateChunks.length}`);
    
    // Show some example non-boilerplate chunks
    console.log("\nSample non-boilerplate chunks:");
    nonBoilerplateChunks.slice(0, 2).forEach((c, i) => {
      console.log(`  ${i + 1}. [${c.heading || 'no heading'}] ${c.content.slice(0, 100)}...`);
    });
    
    return { total: chunks.length, boilerplate: boilerplateChunks.length, nonBoilerplate: nonBoilerplateChunks.length };
  } catch (err) {
    console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

async function main() {
  console.log("=== Boilerplate Filtering Test ===");
  
  const results: Array<{ name: string; total: number; boilerplate: number; nonBoilerplate: number } | null> = [];
  
  for (const test of TEST_URLS) {
    const result = await testUrl(test.name, test.url);
    if (result) {
      results.push({ name: test.name, ...result });
    }
  }
  
  console.log("\n=== Summary ===");
  results.forEach(r => {
    if (r) {
      console.log(`${r.name}: ${r.total} total chunks, ${r.boilerplate} boilerplate (${((r.boilerplate / r.total) * 100).toFixed(1)}%), ${r.nonBoilerplate} non-boilerplate`);
    }
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
