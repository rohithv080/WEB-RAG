import { PrismaClient } from "@prisma/client";
import { embedDocument, embeddingToSql } from "../src/lib/embeddings/embed";
// load env vars if run directly
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting vector migration to Jina AI Multilingual...");

  // Fetch all chunks
  const chunks = await prisma.chunk.findMany({
    select: { id: true, content: true }
  });

  console.log(`Found ${chunks.length} chunks to re-embed.`);

  let successCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    console.log(`[${i + 1}/${chunks.length}] Re-embedding chunk ${chunk.id}...`);

    try {
      const vector = await embedDocument(chunk.content);
      if (vector) {
        const vectorSql = embeddingToSql(vector);
        await prisma.$executeRawUnsafe(
          `UPDATE "Chunk" SET embedding = CAST($1 AS vector) WHERE id = $2`,
          vectorSql,
          chunk.id
        );
        successCount++;
      } else {
        console.warn(`Failed to embed chunk ${chunk.id}`);
      }
    } catch (err) {
      console.error(`Error on chunk ${chunk.id}:`, err);
    }
    
    // Add a small delay to avoid hitting rate limits on the Jina API
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`Migration complete! Successfully re-embedded ${successCount}/${chunks.length} chunks.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
