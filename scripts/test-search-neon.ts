import { embedQuery } from "../src/lib/embeddings/embed";

async function main() {
  console.log("Testing Groq embedding API...");
  try {
    const vec = await embedQuery("pasta recipe");
    console.log(`✅ Embedding works! Dimension: ${vec.length}`);
  } catch (err) {
    console.error("❌ Embedding failed:", err);
  }
}

main().catch(console.error);
