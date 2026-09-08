import { prisma } from "@/lib/db";
import { embedQuery, embeddingToSql, rerankDocuments } from "@/lib/embeddings/embed";

export type RetrievedChunk = {
  id: string;
  content: string;
  heading: string | null;
  order: number;
  pageId: string;
  pageUrl: string;
  score: number;
  isBoilerplate: boolean;
};

const MIN_CHUNK_LENGTH = 50;

// ---------------------------------------------------------------------------
// Vector search (semantic similarity via pgvector cosine distance)
// ---------------------------------------------------------------------------

async function vectorSearch(
  siteId: string | null,
  queryEmbeddingSql: string,
  limit: number
): Promise<RetrievedChunk[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      content: string;
      heading: string | null;
      order: number;
      pageId: string;
      pageUrl: string;
      score: number;
      isBoilerplate: boolean;
    }>
  >(
    `
    SELECT
      c.id,
      c.content,
      c.heading,
      c."order",
      c."pageId",
      p.url AS "pageUrl",
      c."isBoilerplate",
      1 - (c.embedding <=> CAST($1 AS vector)) AS score
    FROM "Chunk" c
    JOIN "Page" p ON p.id = c."pageId"
    ${siteId ? `WHERE p."siteId" = $2` : ``}
    ORDER BY c.embedding <=> CAST($1 AS vector)
    LIMIT ${siteId ? "$3" : "$2"}
    `,
    queryEmbeddingSql,
    ...(siteId ? [siteId, limit] : [limit])
  );

  return rows.map((r) => {
    const rawScore = Number(r.score);
    const contentLength = r.content.length;

    let lengthPenalty = 0;
    if (contentLength < MIN_CHUNK_LENGTH) {
      lengthPenalty = 0.3;
    } else if (contentLength < 100) {
      lengthPenalty = 0.1;
    }

    const boilerplatePenalty = r.isBoilerplate ? 0.4 : 0;
    const adjustedScore = rawScore * (1 - lengthPenalty - boilerplatePenalty);

    return { ...r, score: Math.max(0, adjustedScore) };
  });
}

// ---------------------------------------------------------------------------
// BM25 full-text search (keyword matching via PostgreSQL tsvector/tsquery)
// ---------------------------------------------------------------------------

async function bm25Search(
  siteId: string | null,
  query: string,
  limit: number
): Promise<RetrievedChunk[]> {
  // Build a tsquery from the user's text.
  // plainto_tsquery handles most user input safely.
  // We also try websearch_to_tsquery for OR-style matching on short queries.
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      id: string;
      content: string;
      heading: string | null;
      order: number;
      pageId: string;
      pageUrl: string;
      score: number;
      isBoilerplate: boolean;
    }>
  >(
    `
    SELECT
      c.id,
      c.content,
      c.heading,
      c."order",
      c."pageId",
      p.url AS "pageUrl",
      c."isBoilerplate",
      ts_rank_cd(c.tsv, websearch_to_tsquery('english', $1)) AS score
    FROM "Chunk" c
    JOIN "Page" p ON p.id = c."pageId"
    WHERE c.tsv @@ websearch_to_tsquery('english', $1)
      ${siteId ? `AND p."siteId" = $2` : ``}
    ORDER BY score DESC
    LIMIT ${siteId ? "$3" : "$2"}
    `,
    query,
    ...(siteId ? [siteId, limit] : [limit])
  );

  return rows.map((r) => ({
    ...r,
    score: Number(r.score),
  }));
}

// ---------------------------------------------------------------------------
// Reciprocal Rank Fusion (RRF) — merges two ranked lists into one
// ---------------------------------------------------------------------------

const RRF_K = 60; // Standard RRF constant

function reciprocalRankFusion(
  vectorResults: RetrievedChunk[],
  bm25Results: RetrievedChunk[],
  topK: number
): RetrievedChunk[] {
  const scoreMap = new Map<string, { chunk: RetrievedChunk; rrfScore: number }>();

  // Score vector results
  vectorResults.forEach((chunk, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scoreMap.get(chunk.id);
    if (existing) {
      existing.rrfScore += rrfScore;
    } else {
      scoreMap.set(chunk.id, { chunk, rrfScore });
    }
  });

  // Score BM25 results
  bm25Results.forEach((chunk, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scoreMap.get(chunk.id);
    if (existing) {
      existing.rrfScore += rrfScore;
    } else {
      scoreMap.set(chunk.id, { chunk, rrfScore });
    }
  });

  // Sort by combined RRF score and take top-K
  const fused = Array.from(scoreMap.values())
    .sort((a, b) => b.rrfScore - a.rrfScore)
    .slice(0, topK);

  // Normalize scores to 0-1 range for display
  const maxScore = fused.length > 0 ? fused[0].rrfScore : 1;
  return fused.map((entry) => ({
    ...entry.chunk,
    score: entry.rrfScore / maxScore,
  }));
}

// ---------------------------------------------------------------------------
// Main search: hybrid vector + BM25 → RRF → cross-encoder rerank
// ---------------------------------------------------------------------------

/**
 * Hybrid search: runs both vector (semantic) and BM25 (keyword) search
 * in parallel, fuses results with RRF, then reranks with cross-encoder.
 */
export async function searchChunks(
  siteId: string | null,
  question: string,
  topK = 10
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(question);

  // Run BM25 always; vector search only when we have an embedding
  const bm25Promise = bm25Search(siteId, question, 40);
  const vectorPromise = queryEmbedding
    ? vectorSearch(siteId, embeddingToSql(queryEmbedding), 40)
    : Promise.resolve([] as RetrievedChunk[]);

  const [vectorResults, bm25Results] = await Promise.all([vectorPromise, bm25Promise]);

  console.log(
    `[search] vector=${vectorResults.length} hits, bm25=${bm25Results.length} hits`
  );

  // Fuse results — if no vector results (e.g., serverless BM25-only mode), use BM25 alone
  const candidates =
    vectorResults.length > 0 && bm25Results.length > 0
      ? reciprocalRankFusion(vectorResults, bm25Results, 30)
      : vectorResults.length > 0
      ? vectorResults.sort((a, b) => b.score - a.score).slice(0, 30)
      : bm25Results.sort((a, b) => b.score - a.score).slice(0, 30);

  if (candidates.length === 0) return [];

  // Rerank with cross-encoder for final precision
  const documents = candidates.map((c) =>
    c.heading ? `${c.heading}\n\n${c.content}` : c.content
  );
  const topIndices = await rerankDocuments(question, documents, topK);

  return topIndices.map((index) => candidates[index]);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => {
      const headingText = c.heading ? ` heading="${c.heading.replace(/"/g, '&quot;')}"` : "";
      return `<document id="${i + 1}"${headingText}>\n${c.content}\n</document>`;
    })
    .join("\n\n");
}

export function buildCitations(chunks: RetrievedChunk[]) {
  return chunks.map((c, i) => ({
    index: i + 1,
    chunkId: c.id,
    heading: c.heading,
    snippet: c.content.slice(0, 220) + (c.content.length > 220 ? "…" : ""),
    score: c.score,
    isBoilerplate: c.isBoilerplate,
    pageUrl: c.pageUrl,
  }));
}
