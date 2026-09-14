import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createId } from "@/lib/id";
import { chunkDocument } from "@/lib/scraper/chunk";
import { embedDocuments, embeddingToSql } from "@/lib/embeddings/embed";
import { syncTelegramBotCommands } from "@/lib/telegram";
import { extractText } from "unpdf";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
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
      siteFinalName = existingSite.name;
    } else {
      let currentUserId: string | null = null;
      try {
        const authData = await auth();
        currentUserId = authData.userId;
      } catch {}

      // Create new site
      const defaultName = siteName || fileName.replace(/\.[^/.]+$/, "");
      const newSite = await prisma.site.create({
        data: {
          name: defaultName,
          description: siteDescription || `Created from ${fileName}`,
          userId: currentUserId || null,
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

    // Insert chunks in parallel batches of 10
    const CHUNK_BATCH_SIZE = 10;
    for (let i = 0; i < chunks.length; i += CHUNK_BATCH_SIZE) {
      const slice = chunks.slice(i, i + CHUNK_BATCH_SIZE);
      await Promise.all(
        slice.map(async (c, sliceIdx) => {
          const globalIdx = i + sliceIdx;
          const embRaw = embeddings[globalIdx];
          if (!embRaw) return;
          const emb = embeddingToSql(embRaw);
          await prisma.$executeRawUnsafe(
            `
            INSERT INTO "Chunk" (id, "pageId", content, heading, "order", "isBoilerplate", embedding)
            VALUES ($1, $2, $3, $4, $5, $6, CAST($7 AS vector))
            `,
            createId(),
            newPage.id,
            c.content,
            c.heading,
            c.order,
            c.isBoilerplate || false,
            emb
          );
        })
      );
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
