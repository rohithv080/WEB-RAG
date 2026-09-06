/**
 * Probe Xenova/nomic-embed-text-v1 output shape vs vector(768) schema.
 * Run: npx tsx scripts/probe-embed-dim.ts
 */
import { probeEmbeddingDim, EMBEDDING_DIM } from "../src/lib/embeddings/embed";

async function main() {
  const result = await probeEmbeddingDim("Sample string for dimension verification.");
  console.log("Expected EMBEDDING_DIM:", EMBEDDING_DIM);
  console.log("Result:", result);
  if (!result.matchesSchema) {
    console.error("FAIL: dimension does not match schema — update prisma vector(N) before indexing.");
    process.exit(1);
  }
  console.log("OK: pooled embedding length matches vector(768).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
