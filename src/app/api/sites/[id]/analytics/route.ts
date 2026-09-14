import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing site ID" }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        userId: true,
        scrapedAt: true,
        pages: { select: { id: true, url: true, title: true } },
      },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Tenant authorization check
    const { userId: currentUserId, isAdmin } = await getAuthUser();
    if (site.userId && site.userId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // 1. Total counts
    const [totalSessions, totalQueries, totalResponses, thumbsUpCount, thumbsDownCount] =
      await Promise.all([
        prisma.chatSession.count({ where: { siteId: id } }),
        prisma.message.count({
          where: { session: { siteId: id }, role: "user" },
        }),
        prisma.message.count({
          where: { session: { siteId: id }, role: "assistant" },
        }),
        prisma.message.count({
          where: { session: { siteId: id }, role: "assistant", rating: "up" },
        }),
        prisma.message.count({
          where: { session: { siteId: id }, role: "assistant", rating: "down" },
        }),
      ]);

    const totalRatings = thumbsUpCount + thumbsDownCount;
    const satisfactionRate =
      totalRatings > 0 ? Math.round((thumbsUpCount / totalRatings) * 100) : null;

    // 2. Fetch recent sessions with messages for transcripts, latency, citations, and content gap analysis
    const sessions = await prisma.chatSession.findMany({
      where: { siteId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            citations: true,
            rating: true,
            feedback: true,
            latencyMs: true,
            createdAt: true,
          },
        },
      },
    });

    // 3. Average latency calculation
    let totalLatency = 0;
    let latencyCount = 0;
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === "assistant" && typeof msg.latencyMs === "number" && msg.latencyMs > 0) {
          totalLatency += msg.latencyMs;
          latencyCount++;
        }
      }
    }
    const avgLatencyMs = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null;

    // 4. Citation frequency aggregation
    const citationMap = new Map<string, { url: string; heading?: string; count: number }>();
    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === "assistant" && Array.isArray(msg.citations)) {
          for (const cite of msg.citations as any[]) {
            const pageUrl = cite.pageUrl || cite.url;
            if (pageUrl && typeof pageUrl === "string") {
              const existing = citationMap.get(pageUrl) || {
                url: pageUrl,
                heading: cite.heading || undefined,
                count: 0,
              };
              existing.count++;
              citationMap.set(pageUrl, existing);
            }
          }
        }
      }
    }

    const topCitedSources = Array.from(citationMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // 5. Detect content gaps / unanswered queries
    // Looking for assistant messages indicating missing info or 0 citations on non-greeting questions
    const GAP_PATTERNS = [
      /not found in the provided/i,
      /don'?t have enough information/i,
      /couldn'?t find/i,
      /does not mention/i,
      /cannot find/i,
      /no information (available|provided)/i,
      /not covered in/i,
    ];

    const contentGaps: {
      question: string;
      answerSnippet: string;
      createdAt: Date;
      sessionId: string;
    }[] = [];

    for (const session of sessions) {
      for (let i = 0; i < session.messages.length; i++) {
        const msg = session.messages[i];
        if (msg.role === "assistant") {
          const isGap = GAP_PATTERNS.some((pattern) => pattern.test(msg.content));
          if (isGap) {
            const prevUserMsg = session.messages[i - 1];
            if (prevUserMsg && prevUserMsg.role === "user") {
              contentGaps.push({
                question: prevUserMsg.content,
                answerSnippet: msg.content.slice(0, 160) + (msg.content.length > 160 ? "..." : ""),
                createdAt: prevUserMsg.createdAt,
                sessionId: session.id,
              });
            }
          }
        }
      }
    }

    // 6. Query activity by date (last 14 days)
    const dateMap = new Map<string, number>();
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split("T")[0];
      dateMap.set(key, 0);
    }

    for (const session of sessions) {
      for (const msg of session.messages) {
        if (msg.role === "user") {
          const key = new Date(msg.createdAt).toISOString().split("T")[0];
          if (dateMap.has(key)) {
            dateMap.set(key, (dateMap.get(key) || 0) + 1);
          }
        }
      }
    }

    const activityTimeline = Array.from(dateMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));

    return NextResponse.json({
      site: {
        id: site.id,
        name: site.name || "Untitled Bot",
        totalPages: site.pages.length,
      },
      metrics: {
        totalQueries,
        totalSessions,
        totalResponses,
        thumbsUpCount,
        thumbsDownCount,
        satisfactionRate,
        avgLatencyMs,
      },
      topCitedSources,
      contentGaps: contentGaps.slice(0, 15),
      activityTimeline,
      transcripts: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt,
        messageCount: s.messages.length,
        messages: s.messages,
      })),
    });
  } catch (err: any) {
    console.error("[analytics error]", err);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
