/**
 * Scrape a few public pages into the DB for retrieval / explain tests.
 * Run: npx tsx scripts/seed-sites.ts
 */
import "dotenv/config";
import { createId } from "../src/lib/id";
import { prisma } from "../src/lib/db";
import { fetchPage } from "../src/lib/scraper/fetchPage";
import { chunkDocument } from "../src/lib/scraper/chunk";
import { embedDocuments, embeddingToSql } from "../src/lib/embeddings/embed";

const URLS = [
  "https://en.wikipedia.org/wiki/Retrieval-augmented_generation",
  "https://en.wikipedia.org/wiki/Vector_database",
  "https://en.wikipedia.org/wiki/Cosine_similarity",
];

async function indexUrl(url: string) {
  console.log("Scraping", url);
  const page = await fetchPage(url);
  const chunks = chunkDocument(page.textContent);
  console.log(`  title="${page.title}" chunks=${chunks.length}`);

  const site = await prisma.site.create({
    data: { name: page.title },
  });
  const pg = await prisma.page.create({
    data: { siteId: site.id, url: page.url, title: page.title },
  });

  const embeddings = await embedDocuments(chunks.map((c) => c.content));
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Chunk" (id, "pageId", content, heading, "order", embedding)
      VALUES ($1, $2, $3, $4, $5, CAST($6 AS vector))
      `,
      createId(),
      pg.id,
      c.content,
      c.heading,
      c.order,
      embeddingToSql(embeddings[i])
    );
  }

  console.log(`  siteId=${site.id} pageId=${pg.id}`);
  return site.id;
}

async function main() {
  const ids: string[] = [];
  for (const url of URLS) {
    ids.push(await indexUrl(url));
  }
  console.log("\nSITE_IDS=" + ids.join(","));
  console.log("Primary site for tests:", ids[0]);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
