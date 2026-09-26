import { createId } from "@/lib/id";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchPage, ScrapeContentError } from "@/lib/scraper/fetchPage";
import { chunkDocument, type Chunk } from "@/lib/scraper/chunk";
import { embedDocuments, embeddingToSql } from "@/lib/embeddings/embed";
import { syncTelegramBotCommands } from "@/lib/telegram";
import { verifyIngestionAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

// ---------------------------------------------------------------------------
// Core indexing logic (Single & Batch Support)
// ---------------------------------------------------------------------------

export type BatchIndexResult = {
  siteId: string;
  pageId: string;
  sessionId: string;
  siteName: string | null;
  title: string | null;
  url: string;
  processedCount: number;
  chunkCount: number;
  pageIds: string[];
  scrapedAt: Date;
};

/**
 * Bulk insert chunks using parameterized multi-row SQL queries.
 * (25 chunks per statement = ~120ms total round-trip to Neon Postgres)
 */
async function insertChunksBulk(
  items: Array<{ chunk: Chunk; pageId: string; embedding: number[] }>
) {
  const MULTI_ROW_BATCH = 25;
  for (let i = 0; i < items.length; i += MULTI_ROW_BATCH) {
    const batch = items.slice(i, i + MULTI_ROW_BATCH);
    const placeholders: string[] = [];
    const params: any[] = [];

    batch.forEach((item, idx) => {
      const offset = idx * 7;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, CAST($${offset + 7} AS vector))`
      );
      params.push(
        createId(),
        item.pageId,
        item.chunk.content,
        item.chunk.heading,
        item.chunk.order,
        item.chunk.isBoilerplate || false,
        embeddingToSql(item.embedding)
      );
    });

    if (placeholders.length > 0) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Chunk" (id, "pageId", content, heading, "order", "isBoilerplate", embedding) VALUES ${placeholders.join(", ")}`,
        ...params
      );
    }
  }
}

/**
 * Scrape a batch of 1 to 5 URLs in parallel, chunk them, embed in a single Jina call,
 * and persist via bulk multi-row SQL insert.
 */
export async function indexPagesBatch(
  rawUrls: string[],
  options: {
    existingSiteId?: string;
    siteName?: string;
    siteDescription?: string;
    userId?: string | null;
    autoSync?: boolean;
  } = {}
): Promise<BatchIndexResult> {
  const { existingSiteId, siteName, siteDescription, userId, autoSync } = options;

  if (rawUrls.length === 0) {
    throw new Error("No URLs provided to scrape");
  }

  // 1. Fetch pages in parallel
  const fetchResults = await Promise.allSettled(rawUrls.map((u) => fetchPage(u)));

  const successfulPages: Array<{ page: Awaited<ReturnType<typeof fetchPage>>; url: string }> = [];
  fetchResults.forEach((res, idx) => {
    if (res.status === "fulfilled") {
      successfulPages.push({ page: res.value, url: rawUrls[idx] });
    } else {
      console.warn(
        `[scrape batch] Failed to fetch ${rawUrls[idx]}:`,
        res.reason?.message || res.reason
      );
    }
  });

  if (successfulPages.length === 0) {
    throw new ScrapeContentError(
      "Failed to fetch or extract content from any of the requested URLs."
    );
  }

  // 2. Resolve target Site
  let siteId: string;
  let siteFinalName: string | null = null;

  if (existingSiteId) {
    const existing = await prisma.site.findUnique({ where: { id: existingSiteId } });
    if (!existing) throw new Error("Site not found");
    siteId = existing.id;
    siteFinalName = existing.name;
  } else {
    // Brand new site
    const firstTitle = successfulPages[0].page.title;
    const newSite = await prisma.site.create({
      data: {
        name: siteName?.trim() || firstTitle || null,
        description: siteDescription?.trim() || null,
        userId: userId || null,
        sourceUrl: rawUrls[0] || successfulPages[0].url || null,
        autoSync: Boolean(autoSync),
        syncFrequency: "daily",
      } as any,
    });
    siteId = newSite.id;
    siteFinalName = newSite.name;

    // Auto-sync Telegram commands in background
    syncTelegramBotCommands().catch((e) => console.error("[scrape] Telegram auto-sync failed:", e));
  }

  // 3. Create Page records and chunk documents
  const pageRecords: Array<{ id: string; url: string; title: string | null }> = [];
  const chunkWorkQueue: Array<{ chunk: Chunk; pageId: string }> = [];

  for (const { page } of successfulPages) {
    const chunks = chunkDocument(page.textContent);
    if (chunks.length === 0) continue;

    const pageRecord = await prisma.page.create({
      data: {
        siteId,
        url: page.url,
        title: page.title,
      },
    });

    pageRecords.push(pageRecord);
    for (const c of chunks) {
      chunkWorkQueue.push({ chunk: c, pageId: pageRecord.id });
    }
  }

  if (pageRecords.length === 0 || chunkWorkQueue.length === 0) {
    throw new ScrapeContentError("No readable content or chunks produced from the pages.");
  }

  // 4. Batch Embed All Chunks in ONE single Jina call
  const embedTexts = chunkWorkQueue.map((item) =>
    item.chunk.heading ? `${item.chunk.heading}\n\n${item.chunk.content}` : item.chunk.content
  );
  const embeddings = await embedDocuments(embedTexts);

  // 5. Bulk Multi-Row SQL Insert
  const itemsToInsert = chunkWorkQueue
    .map((item, idx) => ({
      chunk: item.chunk,
      pageId: item.pageId,
      embedding: embeddings[idx],
    }))
    .filter((item): item is { chunk: Chunk; pageId: string; embedding: number[] } =>
      Boolean(item.embedding)
    );

  await insertChunksBulk(itemsToInsert);

  // 6. Ensure ChatSession exists
  let session = await prisma.chatSession.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    session = await prisma.chatSession.create({ data: { siteId } });
  }

  const scrapedAt = new Date();

  return {
    siteId,
    pageId: pageRecords[0].id,
    sessionId: session.id,
    siteName: siteFinalName,
    title: pageRecords[0].title,
    url: pageRecords[0].url,
    processedCount: pageRecords.length,
    chunkCount: itemsToInsert.length,
    pageIds: pageRecords.map((p) => p.id),
    scrapedAt,
  };
}

/**
 * Re-scrape an existing page and replace its chunks.
 */
async function reindexSinglePage(pageId: string): Promise<BatchIndexResult> {
  const existing = await prisma.page.findUnique({
    where: { id: pageId },
    include: { site: true },
  });
  if (!existing) throw new Error("Page not found");

  const page = await fetchPage(existing.url);
  const chunks = chunkDocument(page.textContent);
  if (chunks.length === 0) {
    throw new ScrapeContentError("No content chunks produced from page.");
  }

  await prisma.chunk.deleteMany({ where: { pageId } });
  const updatedPage = await prisma.page.update({
    where: { id: pageId },
    data: { url: page.url, title: page.title, scrapedAt: new Date() },
  });

  const embedTexts = chunks.map((c) => (c.heading ? `${c.heading}\n\n${c.content}` : c.content));
  const embeddings = await embedDocuments(embedTexts);

  const itemsToInsert = chunks
    .map((c, idx) => ({ chunk: c, pageId, embedding: embeddings[idx] }))
    .filter((item): item is { chunk: Chunk; pageId: string; embedding: number[] } =>
      Boolean(item.embedding)
    );

  await insertChunksBulk(itemsToInsert);

  let session = await prisma.chatSession.findFirst({
    where: { siteId: existing.siteId },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    session = await prisma.chatSession.create({ data: { siteId: existing.siteId } });
  }

  return {
    siteId: existing.siteId,
    pageId,
    sessionId: session.id,
    siteName: existing.site.name,
    title: updatedPage.title,
    url: updatedPage.url,
    processedCount: 1,
    chunkCount: itemsToInsert.length,
    pageIds: [pageId],
    scrapedAt: updatedPage.scrapedAt,
  };
}

function errorResponse(err: unknown) {
  console.error("[scrape]", err);
  if (err instanceof ScrapeContentError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  const message = err instanceof Error ? err.message : "Scrape failed";
  const status = message === "Site not found" || message === "Page not found" ? 404 : 500;
  return NextResponse.json({ error: message }, { status });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/scrape
 * Supports both:
 * - Single URL: { url, siteId?, name?, description? }
 * - Chunked Batch: { urls: string[], siteId?, name?, description? } (3-5 pages)
 */
export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyIngestionAuth(req.headers);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const siteId = typeof body.siteId === "string" ? body.siteId.trim() : undefined;
    const name = typeof body.name === "string" ? body.name : undefined;
    const description = typeof body.description === "string" ? body.description : undefined;

    // Support both single `url` and batch `urls`
    let targetUrls: string[] = [];
    if (Array.isArray(body.urls)) {
      targetUrls = (body.urls as unknown[])
        .filter((u: unknown): u is string => typeof u === "string" && u.trim().length > 0)
        .map((u: string) => u.trim());
    } else if (typeof body.url === "string" && body.url.trim().length > 0) {
      targetUrls = [body.url.trim()];
    }

    if (targetUrls.length === 0) {
      return NextResponse.json({ error: "url or urls array is required" }, { status: 400 });
    }

    // If appending to an existing bot, verify ownership
    if (siteId) {
      const existingSite = await prisma.site.findUnique({
        where: { id: siteId },
        select: { userId: true },
      });
      if (!existingSite) {
        return NextResponse.json({ error: "Site not found" }, { status: 404 });
      }
      if (existingSite.userId && existingSite.userId !== authCheck.userId && !authCheck.isAdmin) {
        return NextResponse.json(
          { error: "Unauthorized to add pages to this bot" },
          { status: 403 }
        );
      }
    }

    // Validate URL schemes
    const validatedUrls: string[] = [];
    for (const rawUrl of targetUrls) {
      try {
        const parsed = new URL(rawUrl);
        if (["http:", "https:"].includes(parsed.protocol)) {
          validatedUrls.push(parsed.toString());
        }
      } catch {
        // Skip malformed URLs
      }
    }

    if (validatedUrls.length === 0) {
      return NextResponse.json({ error: "No valid HTTP/HTTPS URLs provided" }, { status: 400 });
    }

    const result = await indexPagesBatch(validatedUrls, {
      existingSiteId: siteId,
      siteName: name,
      siteDescription: description,
      userId: authCheck.userId,
      autoSync: typeof body.autoSync === "boolean" ? body.autoSync : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH /api/scrape { pageId }
 * Re-scrapes an existing page and replaces its chunks.
 */
export async function PATCH(req: NextRequest) {
  try {
    const authCheck = await verifyIngestionAuth(req.headers);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";

    if (!pageId) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    const page = await prisma.page.findUnique({
      where: { id: pageId },
      include: { site: { select: { userId: true } } },
    });
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    if (page.site.userId && page.site.userId !== authCheck.userId && !authCheck.isAdmin) {
      return NextResponse.json({ error: "Unauthorized to re-scrape this page" }, { status: 403 });
    }

    const result = await reindexSinglePage(pageId);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
