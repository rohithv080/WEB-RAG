export const EMBEDDING_DIM = 768;
const EMBED_MODEL = "jina-embeddings-v3";

async function embedText(text: string, task?: string): Promise<number[] | null> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey) {
    console.warn("[embed] No JINA_API_KEY found.");
    return null;
  }

  try {
    const res = await fetch("https://api.jina.ai/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        dimensions: EMBEDDING_DIM,
        normalized: true,
        embedding_type: "float",
        input: [text],
        ...(task ? { task } : {}),
      }),
    });

    if (!res.ok) {
      console.warn("[embed] Jina API failed:", await res.text());
      return null;
    }

    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error("[embed] Jina API error:", err);
    return null;
  }
}

/** Embed a document chunk */
export async function embedDocument(text: string): Promise<number[] | null> {
  return embedText(text, "retrieval.passage");
}

/** Embed a search query */
export async function embedQuery(text: string): Promise<number[] | null> {
  return embedText(text, "retrieval.query");
}

export async function embedDocuments(texts: string[]): Promise<(number[] | null)[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || texts.length === 0) return texts.map(() => null);

  const BATCH_SIZE = 32; // Batch chunks to minimize network round-trips
  const allEmbeddings: (number[] | null)[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch("https://api.jina.ai/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: EMBED_MODEL,
          dimensions: EMBEDDING_DIM,
          normalized: true,
          embedding_type: "float",
          input: batch,
          task: "retrieval.passage",
        }),
      });

      if (!res.ok) {
        console.warn("[embed] Jina batch embed failed:", await res.text());
        allEmbeddings.push(...batch.map(() => null));
        continue;
      }

      const data = await res.json();
      const batchEmbeddings = (data.data as Array<{ index: number; embedding: number[] }>)
        .sort((a, b) => a.index - b.index)
        .map((d) => d.embedding);

      allEmbeddings.push(...batchEmbeddings);
    } catch (err) {
      console.error("[embed] Jina batch embed error:", err);
      allEmbeddings.push(...batch.map(() => null));
    }
  }

  return allEmbeddings;
}

export function embeddingToSql(vector: number[]): string {
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(`[embed] sql dim mismatch: got ${vector.length}, expected ${EMBEDDING_DIM}`);
  }
  return `[${vector.join(",")}]`;
}

export type RerankResultItem = {
  index: number;
  score: number;
};

/**
 * Rerank: uses Jina AI Cross-Encoder API for high precision.
 * Returns top-K results with original indices and cross-encoder relevance scores (0 to 1).
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  topK = 5
): Promise<RerankResultItem[]> {
  const apiKey = process.env.JINA_API_KEY;
  if (!apiKey || documents.length === 0) {
    console.warn("[rerank] No JINA_API_KEY found (or no docs). Skipping rerank.");
    return Array.from({ length: Math.min(topK, documents.length) }, (_, i) => ({
      index: i,
      score: Math.max(0.1, 1.0 - i * 0.15),
    }));
  }

  try {
    const res = await fetch("https://api.jina.ai/v1/rerank", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "jina-reranker-v2-base-multilingual",
        query: query,
        documents: documents,
        top_n: Math.min(topK, documents.length),
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.warn("[rerank] Jina API failed:", errorText);
      return Array.from({ length: Math.min(topK, documents.length) }, (_, i) => ({
        index: i,
        score: Math.max(0.1, 1.0 - i * 0.15),
      }));
    }

    const data = await res.json();
    if (!Array.isArray(data.results)) {
      return Array.from({ length: Math.min(topK, documents.length) }, (_, i) => ({
        index: i,
        score: Math.max(0.1, 1.0 - i * 0.15),
      }));
    }

    return data.results.map((r: any) => ({
      index: Number(r.index),
      score: Number(r.relevance_score ?? 0),
    }));
  } catch (error) {
    console.warn("[rerank] Jina API error:", error);
    return Array.from({ length: Math.min(topK, documents.length) }, (_, i) => ({
      index: i,
      score: Math.max(0.1, 1.0 - i * 0.15),
    }));
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
