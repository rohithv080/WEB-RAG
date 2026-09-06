import { pipeline, env } from "@xenova/transformers";

import os from "os";
import path from "path";

// Cache models under /tmp on Vercel (read-only filesystem), or project .cache locally
env.cacheDir = process.env.TRANSFORMERS_CACHE ?? (process.env.VERCEL ? path.join(os.tmpdir(), "transformers") : "./.cache/transformers");
env.allowLocalModels = false;

const MODEL = "Xenova/nomic-embed-text-v1";
export const EMBEDDING_DIM = 768;

const RERANKER_MODEL = "Xenova/ms-marco-MiniLM-L-6-v2";

type FeatureExtractor = (
  text: string | string[],
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array | number[]; dims?: number[] }>;

type Reranker = (
  query: string,
  documents: string[],
  options?: { topk?: number }
) => Promise<{ output: { index: number; score: number }[] }>;

let extractorPromise: Promise<FeatureExtractor> | null = null;
let rerankerPromise: Promise<Reranker> | null = null;

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", MODEL) as Promise<FeatureExtractor>;
  }
  return extractorPromise;
}

function getReranker() {
  if (!rerankerPromise) {
    rerankerPromise = pipeline("text-classification", RERANKER_MODEL) as unknown as Promise<Reranker>;
  }
  return rerankerPromise;
}

function toArray(data: Float32Array | number[]): number[] {
  return Array.from(data);
}

function assertDim(vector: number[], label: string) {
  if (vector.length !== EMBEDDING_DIM) {
    throw new Error(
      `[embed] ${label} dim mismatch: got ${vector.length}, expected ${EMBEDDING_DIM} (model=${MODEL})`
    );
  }
}

/** Embed a document chunk (nomic task prefix). */
export async function embedDocument(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(`search_document: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  const vector = toArray(output.data);
  assertDim(vector, "document");
  return vector;
}

/** Embed a search query (nomic task prefix). */
export async function embedQuery(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(`search_query: ${text}`, {
    pooling: "mean",
    normalize: true,
  });
  const vector = toArray(output.data);
  assertDim(vector, "query");
  return vector;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  for (const text of texts) {
    results.push(await embedDocument(text));
  }
  return results;
}

export function embeddingToSql(vector: number[]): string {
  assertDim(vector, "sql");
  return `[${vector.join(",")}]`;
}

/**
 * Rerank documents using cross-encoder for better relevance.
 * Returns indices of top-k documents sorted by relevance score.
 */
export async function rerankDocuments(
  query: string,
  documents: string[],
  topK = 5
): Promise<number[]> {
  if (documents.length <= topK) {
    return Array.from({ length: documents.length }, (_, i) => i);
  }

  const reranker = await getReranker();
  
  // ms-marco-MiniLM-L-6-v2 expects query and document as a pair
  // We need to score each document against the query
  const scorePromises = documents.map(async (doc) => {
    const result = await reranker(query, [doc]);
    // The model outputs a relevance score (higher is better)
    return Array.isArray(result) ? result[0]?.score : (result as any).score || 0;
  });
  
  const scores = await Promise.all(scorePromises);

  // Sort by score and return top-k indices
  const indexed = scores.map((score: number, index: number) => ({ score, index }));
  indexed.sort((a, b) => b.score - a.score);
  return indexed.slice(0, topK).map(item => item.index);
}

/** One-shot diagnostic: log raw tensor shape + pooled length. */
export async function probeEmbeddingDim(sample = "Web RAG dimension check"): Promise<{
  model: string;
  dims: number[] | undefined;
  pooledLength: number;
  matchesSchema: boolean;
}> {
  const extractor = await getExtractor();
  const output = await extractor(`search_document: ${sample}`, {
    pooling: "mean",
    normalize: true,
  });
  const pooled = toArray(output.data);
  const result = {
    model: MODEL,
    dims: output.dims,
    pooledLength: pooled.length,
    matchesSchema: pooled.length === EMBEDDING_DIM,
  };
  console.log("[embed probe]", JSON.stringify(result));
  return result;
}
