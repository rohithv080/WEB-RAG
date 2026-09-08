import { getGroqClient } from "@/lib/groq";

// Use Groq's nomic-embed-text-v1.5 API — no local model download needed.
// Dimensions: 768 (matches our pgvector schema)
export const EMBEDDING_DIM = 768;
const EMBED_MODEL = "nomic-embed-text-v1.5";

// On Vercel, we use BM25-only search (no vector search) to avoid model download timeouts.
// Locally, we still use the full embedding pipeline if available.
const IS_SERVERLESS = !!process.env.VERCEL;

async function embedTextViaGroq(text: string): Promise<number[] | null> {
  try {
    const client = getGroqClient();
    // Try Groq embeddings — may not be available on all plans
    const response = await (client as any).embeddings.create({
      model: EMBED_MODEL,
      input: text,
    });
    const vector: number[] = response.data[0].embedding;
    if (vector.length !== EMBEDDING_DIM) return null;
    return vector;
  } catch {
    return null; // Fall back to BM25-only
  }
}

async function embedTextLocally(text: string): Promise<number[]> {
  // Dynamic import so it only loads locally, not on Vercel
  const { pipeline, env } = await import("@xenova/transformers");
  env.cacheDir = process.env.TRANSFORMERS_CACHE ?? "./.cache/transformers";
  env.allowLocalModels = false;
  const extractor = await pipeline("feature-extraction", "Xenova/nomic-embed-text-v1") as any;
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return Array.from(output.data) as number[];
}

/**
 * Returns an embedding vector, or null if running on Vercel (BM25-only mode).
 * Null signals the search layer to skip vector search.
 */
async function embedText(text: string): Promise<number[] | null> {
  if (IS_SERVERLESS) {
    // Try Groq embeddings first; if unavailable, return null → BM25-only
    return embedTextViaGroq(text);
  }
  return embedTextLocally(text);
}

/** Embed a document chunk (nomic task prefix). */
export async function embedDocument(text: string): Promise<number[] | null> {
  return embedText(`search_document: ${text}`);
}

/** Embed a search query (nomic task prefix). */
export async function embedQuery(text: string): Promise<number[] | null> {
  return embedText(`search_query: ${text}`);
}

export async function embedDocuments(texts: string[]): Promise<(number[] | null)[]> {
  const results: (number[] | null)[] = [];
  for (const text of texts) {
    results.push(await embedDocument(text));
  }
  return results;
}

export function embeddingToSql(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(`[embed] sql dim mismatch: got ${vector.length}, expected ${EMBEDDING_DIM}`);
  }
  return `[${vector.join(",")}]`;
}

/**
 * Rerank: uses Jina AI Cross-Encoder API for high precision.
 * Returns top-K indices of the most relevant documents.
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  topK = 5
): Promise<number[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || documents.length === 0) {
    console.warn("[rerank] No JINA_API_KEY found (or no docs). Skipping rerank.");
    return Array.from({ length: Math.min(topK, documents.length) }, (_, i) => i);
  }

  try {
    const res = await fetch("https://api.jina.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "jina-reranker-v2-base-multilingual",
        query: query,
        documents: documents,
        top_n: topK
      })
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.warn("[rerank] Jina API failed:", errorText);
      return Array.from({ length: Math.min(topK, documents.length) }, (_, i) => i);
    }

    const data = await res.json();
    return data.results.map((r: any) => r.index);
  } catch (error) {
    console.warn("[rerank] Jina API error:", error);
    return Array.from({ length: Math.min(topK, documents.length) }, (_, i) => i);
  }
}

/** Diagnostic: verify embedding dimension. */
export async function probeEmbeddingDim(sample = "Web RAG dimension check"): Promise<{
  model: string;
  dims: number[] | undefined;
  pooledLength: number;
  matchesSchema: boolean;
}> {
  const vector = await embedDocument(sample);
  if (!vector) {
    return { model: EMBED_MODEL, dims: undefined, pooledLength: 0, matchesSchema: false };
  }
  const result = {
    model: EMBED_MODEL,
    dims: [vector.length],
    pooledLength: vector.length,
    matchesSchema: vector.length === EMBEDDING_DIM,
  };
  console.log("[embed probe]", JSON.stringify(result));
  return result;
}
