import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    let currentUserId: string | null = null;
    try {
      const authData = await auth();
      currentUserId = authData.userId;
    } catch {
      // Clerk keys unconfigured or request not authenticated
    }

    // Tenant Isolation:
    // If a user is logged in, show only bots they created + legacy bots (created before auth)
    // If user is unauthenticated, show public bots
    const whereClause: any = currentUserId
      ? {
          OR: [
            { userId: currentUserId },
            { userId: null },
          ],
        }
      : { isPublic: true };

    const sites = await prisma.site.findMany({
      where: whereClause,
      orderBy: { scrapedAt: "desc" },
      include: {
        pages: {
          orderBy: { scrapedAt: "asc" },
          include: {
            _count: { select: { chunks: true } },
          },
        },
        sessions: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, createdAt: true },
        },
      },
    });

    return NextResponse.json({
      sites: sites.map((s) => {
        const totalChunks = s.pages.reduce((n, p) => n + p._count.chunks, 0);
        // Derive lastScrapedAt as the most recent page.scrapedAt
        const lastScrapedAt = s.pages.reduce<Date | null>((max, p) => {
          return max === null || p.scrapedAt > max ? p.scrapedAt : max;
        }, null);

        return {
          id: s.id,
          // Backfill name from first page title when Site.name is null
          name: s.name ?? s.pages[0]?.title ?? "Untitled",
          description: s.description ?? null,
          systemPrompt: s.systemPrompt ?? null,
          starterQuestions: s.starterQuestions ?? null,
          tone: (s.tone as "concise" | "balanced" | "detailed") ?? "balanced",
          isPublic: s.isPublic ?? true,
          userId: s.userId ?? null,
          scrapedAt: s.scrapedAt,
          lastScrapedAt: lastScrapedAt ?? s.scrapedAt,
          latestSessionId: s.sessions[0]?.id ?? null,
          totalChunks,
          pages: s.pages.map((p) => ({
            id: p.id,
            url: p.url,
            title: p.title,
            scrapedAt: p.scrapedAt,
            chunkCount: p._count.chunks,
          })),
        };
      }),
    });
  } catch (err) {
    console.error("[sites]", err);
    const message = err instanceof Error ? err.message : "Failed to list sites";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
