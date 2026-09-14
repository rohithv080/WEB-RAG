import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createId } from "@/lib/id";
import { chunkDocument } from "@/lib/scraper/chunk";
import { embedDocuments, embeddingToSql } from "@/lib/embeddings/embed";
import { syncTelegramBotCommands } from "@/lib/telegram";
import { extractText } from "unpdf";
import { verifyIngestionAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const authCheck = await verifyIngestionAuth(req.headers);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const siteName = (formData.get("siteName") as string | null)?.trim();
    const siteDescription = (formData.get("siteDescription") as string | null)?.trim();
    const existingSiteId = (formData.get("siteId") as string | null)?.trim();

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const fileName = file.name;
    const extension = fileName.split(".").pop()?.toLowerCase() || "";
    let extractedText = "";

    if (extension === "pdf") {
      const buffer = new Uint8Array(await file.arrayBuffer());
      const res = await extractText(buffer);
      if (Array.isArray(res.text)) {
        extractedText = res.text.join("\n\n");
      } else {
        extractedText = res.text || "";
      }
    } else if (["txt", "md", "markdown", "csv", "json"].includes(extension)) {
      extractedText = await file.text();
    } else {
      return NextResponse.json(
        { error: `Unsupported file type (.${extension}). Please upload a PDF, TXT, MD, or CSV.` },
        { status: 400 }
      );
    }

    extractedText = extractedText.trim();
    if (!extractedText) {
      return NextResponse.json(
        { error: "The uploaded file is empty or readable text could not be extracted." },
        { status: 422 }
      );
    }

    // Determine target site
    let siteId = existingSiteId;
    let siteFinalName: string | null = siteName || null;

    if (siteId) {
      const existingSite = await prisma.site.findUnique({ where: { id: siteId } });
      if (!existingSite) {
        return NextResponse.json({ error: "Target site not found" }, { status: 404 });
      }
      if (existingSite.userId && existingSite.userId !== authCheck.userId && !authCheck.isAdmin) {
        return NextResponse.json({ error: "Unauthorized to add files to this bot" }, { status: 403 });
      }
      siteFinalName = existingSite.name;
    } else {
      // Create new site
      const defaultName = siteName || fileName.replace(/\.[^/.]+$/, "");
      const newSite = await prisma.site.create({
        data: {
          name: defaultName,
          description: siteDescription || `Created from ${fileName}`,
          userId: authCheck.userId,
        },
      });
      siteId = newSite.id;
      siteFinalName = newSite.name;

      // Auto-sync Telegram commands in background
      syncTelegramBotCommands().catch((e) => console.error("[upload] Telegram auto-sync failed:", e));
    }

    // Create Page entry representing this file
    const newPage = await prisma.page.create({
      data: {
        siteId,
        url: `file://${encodeURIComponent(fileName)}`,
        title: fileName,
      },
    });

    // Chunk the text
    const chunks = chunkDocument(extractedText);
    if (chunks.length === 0) {
      return NextResponse.json(
        { error: "Could not generate chunks from this document." },
        { status: 422 }
      );
    }

    // Embed chunks
    const embedTexts = chunks.map((c) =>
      c.heading ? `${c.heading}\n\n${c.content}` : c.content
    );
    const embeddings = await embedDocuments(embedTexts);

    // Insert chunks in multi-row parameterized batches (25 chunks per SQL statement)
    const validItems = chunks
      .map((c, idx) => ({ c, emb: embeddings[idx] }))
      .filter((item): item is { c: typeof chunks[0]; emb: number[] } => Boolean(item.emb));

    const MULTI_ROW_BATCH = 25;
    for (let i = 0; i < validItems.length; i += MULTI_ROW_BATCH) {
      const batch = validItems.slice(i, i + MULTI_ROW_BATCH);
      const placeholders: string[] = [];
      const params: any[] = [];

      batch.forEach((item, idx) => {
        const offset = idx * 7;
        placeholders.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, CAST($${offset + 7} AS vector))`
        );
        params.push(
          createId(),
          newPage.id,
          item.c.content,
          item.c.heading,
          item.c.order,
          item.c.isBoilerplate || false,
          embeddingToSql(item.emb)
        );
      });

      if (placeholders.length > 0) {
        await prisma.$executeRawUnsafe(
          `INSERT INTO "Chunk" (id, "pageId", content, heading, "order", "isBoilerplate", embedding) VALUES ${placeholders.join(", ")}`,
          ...params
        );
      }
    }

    // Ensure a chat session exists
    let session = await prisma.chatSession.findFirst({
      where: { siteId },
      orderBy: { createdAt: "desc" },
    });
    if (!session) {
      session = await prisma.chatSession.create({ data: { siteId } });
    }

    return NextResponse.json({
      success: true,
      siteId,
      pageId: newPage.id,
      sessionId: session.id,
      siteName: siteFinalName,
      fileName,
      chunkCount: chunks.length,
    });
  } catch (error: any) {
    console.error("[upload error]:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "File upload failed" },
      { status: 500 }
    );
  }
}
