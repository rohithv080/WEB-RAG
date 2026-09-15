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
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Use 'simple' for non-Latin languages (Tamil, Hindi, etc.) for exact token matching,
  // and 'english' for Latin text to match stemmed words in c.tsv (e.g. 'updates' -> 'updat')
  const isNonAscii = /[^\x00-\x7F]/.test(trimmed);
  const dict = isNonAscii ? "simple" : "english";

  try {
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
        ts_rank_cd(c.tsv, websearch_to_tsquery('${dict}', $1)) AS score
      FROM "Chunk" c
      JOIN "Page" p ON p.id = c."pageId"
      WHERE c.tsv @@ websearch_to_tsquery('${dict}', $1)
        ${siteId ? `AND p."siteId" = $2` : ``}
      ORDER BY score DESC
      LIMIT ${siteId ? "$3" : "$2"}
      `,
      trimmed,
      ...(siteId ? [siteId, limit] : [limit])
    );

    if (rows.length > 0) {
      return rows.map((r) => ({
        ...r,
        score: Number(r.score),
      }));
    }
  } catch (err) {
    console.warn(`[search] websearch_to_tsquery failed for "${trimmed}", falling back to plainto_tsquery:`, err);
  }

  // Fallback: plainto_tsquery (resilient to conversational punctuation and query syntax)
  try {
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
        ts_rank_cd(c.tsv, plainto_tsquery('${dict}', $1)) AS score
      FROM "Chunk" c
      JOIN "Page" p ON p.id = c."pageId"
      WHERE c.tsv @@ plainto_tsquery('${dict}', $1)
        ${siteId ? `AND p."siteId" = $2` : ``}
      ORDER BY score DESC
      LIMIT ${siteId ? "$3" : "$2"}
      `,
      trimmed,
      ...(siteId ? [siteId, limit] : [limit])
    );

    return rows.map((r) => ({
      ...r,
      score: Number(r.score),
    }));
  } catch (fallbackErr) {
    console.warn(`[search] plainto_tsquery fallback failed:`, fallbackErr);
    return [];
  }
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
  topK = 6,
  maxTotalChars = 12000,
  keywordQuery?: string
): Promise<RetrievedChunk[]> {
  const queryEmbedding = await embedQuery(question);

  // Run BM25 with keywordQuery (e.g. expanded terms) if provided, otherwise the natural question
  const bm25Term = keywordQuery && keywordQuery.trim() ? keywordQuery : question;
  const bm25Promise = bm25Search(siteId, bm25Term, 40);
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

  // Filter out noise, image badges, and boilerplate before reranking
  const cleanCandidates = candidates.filter((c) => {
    if (c.isBoilerplate) return false;
    const stripped = c.content.replace(/!\[.*?\]\(.*?\)/g, "").replace(/\[.*?\]\(.*?\)/g, "").trim();
    return stripped.length >= 35;
  });

  const pool = cleanCandidates.length > 0 ? cleanCandidates : candidates;

  // Prepare documents with section heading for cross-encoder context
  const documents = pool.map((c) =>
    c.heading ? `${c.heading}\n\n${c.content}` : c.content
  );

  // Rerank candidates with Jina Cross-Encoder
  const rerankResults = await rerankDocuments(question, documents, topK);

  // Filter out irrelevant chunks below relevance threshold
  const MIN_RELEVANCE_SCORE = 0.08;
  const validResults = rerankResults.filter((r) => r.score >= MIN_RELEVANCE_SCORE);

  // If even the top chunk does not meet the minimum threshold, no relevant context exists
  if (validResults.length === 0) {
    console.log(`[search] No chunks met relevance threshold (${MIN_RELEVANCE_SCORE}). Best was: ${rerankResults[0]?.score ?? 0}`);
    return [];
  }

  const reranked: RetrievedChunk[] = validResults.map((r) => ({
    ...pool[r.index],
    score: Math.round(r.score * 100) / 100,
  }));

  // Enforce context character budget to prevent exceeding LLM rate limits (TPM)
  let totalChars = 0;
  const budgeted: RetrievedChunk[] = [];
  for (const chunk of reranked) {
    if (totalChars + chunk.content.length > maxTotalChars && budgeted.length > 0) {
      break;
    }
    budgeted.push(chunk);
    totalChars += chunk.content.length;
  }

  return budgeted;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatContext(chunks: RetrievedChunk[], maxChars = 12000): string {
  let totalChars = 0;
  const selected: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    if (totalChars + chunk.content.length > maxChars && selected.length > 0) {
      break;
    }
    selected.push(chunk);
    totalChars += chunk.content.length;
  }

  return selected
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
