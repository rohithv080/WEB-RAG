import { createId } from "@/lib/id";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchPage, ScrapeContentError } from "@/lib/scraper/fetchPage";
import { chunkDocument } from "@/lib/scraper/chunk";
import { embedDocuments, embeddingToSql } from "@/lib/embeddings/embed";

export const runtime = "nodejs";
export const maxDuration = 120;



// ---------------------------------------------------------------------------
// Core indexing logic
// ---------------------------------------------------------------------------

type IndexResult = {
  siteId: string;
  pageId: string;
  sessionId: string;
  siteName: string | null;
  title: string | null;
  url: string;
  chunkCount: number;
  scrapedAt: Date;
};

/**
 * Scrape `url`, chunk + embed, persist to DB.
 *
 * Modes:
 *  - existingPageId  → re-scrape a single page (replace its chunks)
 *  - existingSiteId  → append a new page to an existing site
 *  - neither         → create a brand-new site + first page
 */
async function indexPage(
  url: string,
  opts: {
    existingSiteId?: string;
    existingPageId?: string;
    siteName?: string;
    siteDescription?: string;
  } = {}
): Promise<IndexResult> {
  const { existingSiteId, existingPageId, siteName, siteDescription } = opts;

  const page = await fetchPage(url);
  const chunks = chunkDocument(page.textContent);

  if (chunks.length === 0) {
    throw new ScrapeContentError("No content chunks produced from the page.");
  }

  let siteId: string;
  let siteFinalName: string | null;
  let pageId: string;
  let scrapedAt: Date;

  if (existingPageId) {
    // Re-scrape an existing page: replace its chunks, update metadata
    const existing = await prisma.page.findUnique({
      where: { id: existingPageId },
      include: { site: true },
    });
    if (!existing) throw new Error("Page not found");

    await prisma.chunk.deleteMany({ where: { pageId: existingPageId } });

    const updated = await prisma.page.update({
      where: { id: existingPageId },
      data: { url: page.url, title: page.title, scrapedAt: new Date() },
    });

    siteId = updated.siteId;
    siteFinalName = existing.site.name;
    pageId = updated.id;
    scrapedAt = updated.scrapedAt;
  } else if (existingSiteId) {
    // Append a new page to an existing site
    const site = await prisma.site.findUnique({ where: { id: existingSiteId } });
    if (!site) throw new Error("Site not found");

    const newPage = await prisma.page.create({
      data: { siteId: existingSiteId, url: page.url, title: page.title },
    });

    siteId = existingSiteId;
    siteFinalName = site.name;
    pageId = newPage.id;
    scrapedAt = newPage.scrapedAt;
  } else {
    // Brand-new site + first page
    const site = await prisma.site.create({
      data: {
        name: siteName?.trim() || page.title || null,
        description: siteDescription?.trim() || null,
      },
    });

    const newPage = await prisma.page.create({
      data: { siteId: site.id, url: page.url, title: page.title },
    });

    siteId = site.id;
    siteFinalName = site.name;
    pageId = newPage.id;
    scrapedAt = newPage.scrapedAt;
  }

  // Prepend headings to embedding text for better semantic matching
  const embedTexts = chunks.map((c) =>
    c.heading ? `${c.heading}\n\n${c.content}` : c.content
  );
  const embeddings = await embedDocuments(embedTexts);

  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const embRaw = embeddings[i];
    if (!embRaw) continue; // skip if embedding unavailable (serverless mode)
    const emb = embeddingToSql(embRaw);
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO "Chunk" (id, "pageId", content, heading, "order", "isBoilerplate", embedding)
      VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS vector))
      `,
      createId(),
      pageId,
      c.content,
      c.heading,
      c.order,
      c.isBoilerplate || false,
      emb
    );
  }

  // Ensure a chat session exists for this site
  let session = await prisma.chatSession.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  });
  if (!session) {
    session = await prisma.chatSession.create({ data: { siteId } });
  }

  return {
    siteId,
    pageId,
    sessionId: session.id,
    siteName: siteFinalName,
    title: page.title,
    url: page.url,
    chunkCount: chunks.length,
    scrapedAt,
  };
}

function errorResponse(err: unknown) {
  console.error("[scrape]", err);
  if (err instanceof ScrapeContentError) {
    return NextResponse.json({ error: err.message }, { status: 422 });
  }
  const message = err instanceof Error ? err.message : "Scrape failed";
  const status =
    message === "Site not found" || message === "Page not found" ? 404 : 500;
  return NextResponse.json({ error: message }, { status });
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * POST { url, siteId?, name?, description? }
 *  - Creates a new site + first page, OR appends a page to an existing site.
 *  - Requires x-admin-secret when ADMIN_SECRET is configured.
 */
export async function POST(req: NextRequest) {

  try {
    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const siteId =
      typeof body.siteId === "string" ? body.siteId.trim() : undefined;
    const name = typeof body.name === "string" ? body.name : undefined;
    const description =
      typeof body.description === "string" ? body.description : undefined;

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let parsed: URL;
    try {
      parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error("invalid protocol");
      }
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const result = await indexPage(parsed.toString(), {
      existingSiteId: siteId,
      siteName: name,
      siteDescription: description,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * PATCH { pageId }
 *  - Re-scrapes an existing page and replaces its chunks.
 *  - Requires x-admin-secret when ADMIN_SECRET is configured.
 */
export async function PATCH(req: NextRequest) {

  try {
    const body = await req.json();
    const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";

    if (!pageId) {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }

    const page = await prisma.page.findUnique({ where: { id: pageId } });
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const result = await indexPage(page.url, { existingPageId: pageId });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
