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
  expandedContent?: string;
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

  // Context Window Expansion & Parent-Child Retrieval:
  // Fetch neighboring chunks (order - 1, order + 1) on the same page to expand context,
  // and merge contiguous segments into seamless, uninterrupted passages.
  const expandedPassages = await expandChunkWindows(reranked);

  // Enforce context character budget to prevent exceeding LLM rate limits (TPM)
  let totalChars = 0;
  const budgeted: RetrievedChunk[] = [];
  for (const chunk of expandedPassages) {
    const textLen = (chunk.expandedContent || chunk.content).length;
    if (totalChars + textLen > maxTotalChars && budgeted.length > 0) {
      break;
    }
    budgeted.push(chunk);
    totalChars += textLen;
  }

  return budgeted;
}

// ---------------------------------------------------------------------------
// Window Expansion & Passage Stitching Helpers
// ---------------------------------------------------------------------------

/**
 * Stitches two adjacent chunks of text together.
 * If chunk B begins with an overlapping suffix of chunk A (from the chunking overlap),
 * the duplicated seam is cleanly removed so the text reads continuously without stutter.
 */
export function stitchText(textA: string, textB: string): string {
  const trimmedA = textA.trimEnd();
  const trimmedB = textB.trimStart();

  if (!trimmedA) return trimmedB;
  if (!trimmedB) return trimmedA;

  // If one contains the other entirely, return the larger one
  if (trimmedA.includes(trimmedB)) return trimmedA;
  if (trimmedB.includes(trimmedA)) return trimmedB;

  // In chunk.ts, OVERLAP is 200 chars. We check possible overlap lengths up to 500 chars.
  const maxOverlap = Math.min(trimmedA.length, trimmedB.length, 500);
  for (let len = maxOverlap; len >= 10; len--) {
    if (trimmedA.slice(-len) === trimmedB.slice(0, len)) {
      return trimmedA + trimmedB.slice(len);
    }
  }

  return `${trimmedA}\n\n${trimmedB}`;
}

/**
 * Context Window Expansion & Parent-Child Retrieval:
 * For each top-scoring seed chunk, expands its context window by retrieving adjacent
 * sibling chunks (order - 1 and order + 1) on the same page from PostgreSQL.
 * Contiguous or overlapping chunk sequences on the same page are stitched into seamless
 * passages, stripping duplicate overlap seams.
 */
export async function expandChunkWindows(
  seedChunks: RetrievedChunk[],
  windowSize = 1
): Promise<RetrievedChunk[]> {
  if (seedChunks.length === 0) return [];

  // 1. Determine all neighbor orders needed per page
  const ordersByPage = new Map<string, Set<number>>();
  for (const s of seedChunks) {
    if (s.isBoilerplate) continue;
    let orderSet = ordersByPage.get(s.pageId);
    if (!orderSet) {
      orderSet = new Set<number>();
      ordersByPage.set(s.pageId, orderSet);
    }
    for (let offset = -windowSize; offset <= windowSize; offset++) {
      const targetOrder = s.order + offset;
      if (targetOrder >= 0) {
        orderSet.add(targetOrder);
      }
    }
  }

  if (ordersByPage.size === 0) {
    return seedChunks;
  }

  // 2. Fetch neighbor chunks in a single round-trip query
  const pageConditions = Array.from(ordersByPage.entries()).map(([pageId, orders]) => ({
    pageId,
    order: { in: Array.from(orders) },
    isBoilerplate: false,
  }));

  try {
    const neighborRows = await prisma.chunk.findMany({
      where: {
        OR: pageConditions,
        isBoilerplate: false,
      },
      select: {
        id: true,
        pageId: true,
        order: true,
        content: true,
        heading: true,
      },
      orderBy: {
        order: "asc",
      },
    });

    // Map: pageId -> (order -> ChunkRow)
    const chunkLookup = new Map<string, Map<number, { id: string; content: string; heading: string | null }>>();
    for (const row of neighborRows) {
      let pageMap = chunkLookup.get(row.pageId);
      if (!pageMap) {
        pageMap = new Map();
        chunkLookup.set(row.pageId, pageMap);
      }
      pageMap.set(row.order, row);
    }

    // 3. For each page, partition needed orders into maximal contiguous intervals
    // Each interval is associated with the highest-scoring seed chunk that falls within it.
    type PassageGroup = {
      anchorSeed: RetrievedChunk;
      pageId: string;
      minOrder: number;
      maxOrder: number;
      seedScores: number[];
    };

    const passageGroups: PassageGroup[] = [];

    // Group seed chunks by page
    const seedsByPage = new Map<string, RetrievedChunk[]>();
    for (const seed of seedChunks) {
      if (!seedsByPage.has(seed.pageId)) {
        seedsByPage.set(seed.pageId, []);
      }
      seedsByPage.get(seed.pageId)!.push(seed);
    }

    for (const [pageId, seeds] of seedsByPage.entries()) {
      // Calculate intervals for this page
      // Each seed defines a range: [max(0, seed.order - windowSize), seed.order + windowSize]
      const rawRanges = seeds.map((s) => ({
        seed: s,
        min: Math.max(0, s.order - windowSize),
        max: s.order + windowSize,
      }));

      // Sort ranges by min order
      rawRanges.sort((a, b) => a.min - b.min);

      // Merge overlapping/contiguous ranges
      const mergedIntervals: Array<{
        min: number;
        max: number;
        seeds: RetrievedChunk[];
      }> = [];

      for (const range of rawRanges) {
        const last = mergedIntervals[mergedIntervals.length - 1];
        // If overlapping or directly adjacent (e.g. last.max >= range.min - 1)
        if (last && range.min <= last.max + 1) {
          last.max = Math.max(last.max, range.max);
          last.seeds.push(range.seed);
        } else {
          mergedIntervals.push({
            min: range.min,
            max: range.max,
            seeds: [range.seed],
          });
        }
      }

      // For each merged interval, select the best seed chunk as anchor
      for (const interval of mergedIntervals) {
        // Find seed with highest score in this interval
        interval.seeds.sort((a, b) => b.score - a.score);
        const anchor = interval.seeds[0];

        passageGroups.push({
          anchorSeed: anchor,
          pageId,
          minOrder: interval.min,
          maxOrder: interval.max,
          seedScores: interval.seeds.map((s) => s.score),
        });
      }
    }

    // 4. Stitch each passage group and construct RetrievedChunk
    const expandedResults: RetrievedChunk[] = [];

    for (const group of passageGroups) {
      const pageMap = chunkLookup.get(group.pageId);
      const chunksToStitch: Array<{ content: string; heading: string | null }> = [];

      for (let ord = group.minOrder; ord <= group.maxOrder; ord++) {
        const row = pageMap?.get(ord);
        if (row && row.content) {
          chunksToStitch.push(row);
        }
      }

      let expandedText = group.anchorSeed.content;
      if (chunksToStitch.length > 0) {
        expandedText = chunksToStitch[0].content;
        for (let i = 1; i < chunksToStitch.length; i++) {
          expandedText = stitchText(expandedText, chunksToStitch[i].content);
        }
      }

      expandedResults.push({
        ...group.anchorSeed,
        expandedContent: expandedText,
      });
    }

    // 5. Sort the resulting expanded passages by anchor score descending
    expandedResults.sort((a, b) => b.score - a.score);

    console.log(
      `[retrieval] Window expansion: ${seedChunks.length} seed chunks -> ${expandedResults.length} enriched passages`
    );

    return expandedResults;
  } catch (err) {
    console.warn(`[retrieval] expandChunkWindows failed, falling back to seed chunks:`, err);
    return seedChunks;
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export function formatContext(chunks: RetrievedChunk[], maxChars = 12000): string {
  let totalChars = 0;
  const selected: RetrievedChunk[] = [];
  for (const chunk of chunks) {
    const text = chunk.expandedContent || chunk.content;
    if (totalChars + text.length > maxChars && selected.length > 0) {
      break;
    }
    selected.push(chunk);
    totalChars += text.length;
  }

  return selected
    .map((c, i) => {
      const headingText = c.heading ? ` heading="${c.heading.replace(/"/g, '&quot;')}"` : "";
      const text = c.expandedContent || c.content;
      return `<document id="${i + 1}"${headingText}>\n${text}\n</document>`;
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
