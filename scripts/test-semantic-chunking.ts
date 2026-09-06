import { fetchPage } from "../src/lib/scraper/fetchPage";
import { chunkDocument } from "../src/lib/scraper/chunk";

async function main() {
  const page = await fetchPage("https://nextjs.org/docs/getting-started/installation");
  const chunks = chunkDocument(page.textContent);
  console.log(`Found ${chunks.length} chunks`);
  
  for (let i = 0; i < Math.min(5, chunks.length); i++) {
    console.log(`\n--- CHUNK ${i} ---`);
    console.log(`Heading: ${chunks[i].heading}`);
    console.log(`Content:\n${chunks[i].content}`);
  }
}

main().catch(console.error);
