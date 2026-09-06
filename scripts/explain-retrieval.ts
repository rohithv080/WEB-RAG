/**
 * EXPLAIN ANALYZE a cosine retrieval query — note whether IVFFlat is used.
 * Usage: npx tsx scripts/explain-retrieval.ts <siteId>
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { embedQuery, embeddingToSql } from "../src/lib/embeddings/embed";

async function main() {
  const siteId = process.argv[2];
  if (!siteId) {
    console.error("Usage: npx tsx scripts/explain-retrieval.ts <siteId>");
    process.exit(1);
  }

  const emb = await embedQuery("What is retrieval-augmented generation?");
  const vectorSql = embeddingToSql(emb);

  const plan = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": string }>>(
    `
    EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
    SELECT id, 1 - (embedding <=> CAST($1 AS vector)) AS score
    FROM "Chunk"
    WHERE "siteId" = $2
    ORDER BY embedding <=> CAST($1 AS vector)
    LIMIT 5
    `,
    vectorSql,
    siteId
  );

  const text = plan.map((r) => r["QUERY PLAN"]).join("\n");
  console.log(text);

  const usesIvfflat = /Index Scan|chunk_embedding_cosine_idx|ivfflat/i.test(text);
  const seqScan = /Seq Scan on "Chunk"/i.test(text);

  console.log("\n--- summary ---");
  console.log("IVFFlat / index scan hinted:", usesIvfflat);
  console.log("Seq Scan on Chunk:", seqScan);
  if (seqScan && !usesIvfflat) {
    console.log(
      "Note: at small row counts Postgres often prefers seq scan over IVFFlat — expected for a few sites."
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
