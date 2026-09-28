import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { isAdmin } = await getAuthUser();
    if (!isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized. Admin privileges required." },
        { status: 403 }
      );
    }

    // 1. Core platform counts
    const [
      totalSites,
      autoSyncSites,
      publicSites,
      totalPages,
      totalChunks,
      totalSessions,
      totalQueries,
      totalResponses,
      thumbsUp,
      thumbsDown,
      totalApiKeys,
      activeApiKeys,
    ] = await Promise.all([
      prisma.site.count(),
      prisma.site.count({ where: { autoSync: true } }),
      prisma.site.count({ where: { isPublic: true } }),
      prisma.page.count(),
      prisma.chunk.count(),
      prisma.chatSession.count(),
      prisma.message.count({ where: { role: "user" } }),
      prisma.message.count({ where: { role: "assistant" } }),
      prisma.message.count({ where: { role: "assistant", rating: "up" } }),
      prisma.message.count({ where: { role: "assistant", rating: "down" } }),
      prisma.apiKey.count(),
      prisma.apiKey.count({ where: { lastUsedAt: { not: null } } }),
    ]);

    // 2. Unique creators count
    const uniqueUserSites = await prisma.site.findMany({
      select: { userId: true },
      distinct: ["userId"],
    });
    const totalCreators = uniqueUserSites.filter((s) => Boolean(s.userId)).length;

    // 3. Average latency across recent responses
    const recentLatencySamples = await prisma.message.findMany({
      where: {
        role: "assistant",
        latencyMs: { not: null, gt: 0 },
      },
      select: { latencyMs: true },
      take: 100,
      orderBy: { createdAt: "desc" },
    });

    const avgLatencyMs =
      recentLatencySamples.length > 0
        ? Math.round(
            recentLatencySamples.reduce((sum, m) => sum + (m.latencyMs || 0), 0) /
              recentLatencySamples.length
          )
        : null;

    // 4. Daily Query Activity (last 14 days)
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 13);
    fourteenDaysAgo.setHours(0, 0, 0, 0);

    const recentUserMessages = await prisma.message.findMany({
      where: {
        role: "user",
        createdAt: { gte: fourteenDaysAgo },
      },
      select: { createdAt: true },
    });

    // Bucket into 14 days
    const dailyMap = new Map<string, number>();
    for (let i = 0; i < 14; i++) {
      const d = new Date(fourteenDaysAgo);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailyMap.set(key, 0);
    }

    for (const msg of recentUserMessages) {
      const key = msg.createdAt.toISOString().slice(0, 10);
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
      }
    }

    const activityTimeline = Array.from(dailyMap.entries()).map(([dateStr, count]) => {
      const d = new Date(dateStr + "T00:00:00Z");
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: dateStr,
        label,
        count,
      };
    });

    // 5. Recent Platform Audit Stream (last 20 messages)
    const recentAuditMessages = await prisma.message.findMany({
      where: { role: "user" },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        session: {
          select: {
            id: true,
            site: {
              select: { id: true, name: true, userId: true },
            },
            messages: {
              where: { role: "assistant" },
              select: { id: true, rating: true, latencyMs: true, isWebFallback: true },
              take: 1,
            },
          },
        },
      },
    });

    const auditLogs = recentAuditMessages.map((msg) => {
      const reply = msg.session?.messages?.[0];
      return {
        id: msg.id,
        sessionId: msg.sessionId,
        botId: msg.session?.site?.id || null,
        botName: msg.session?.site?.name || "Unknown Bot",
        botOwner: msg.session?.site?.userId || "Public / Unassigned",
        userQuery: msg.content,
        latencyMs: reply?.latencyMs ?? null,
        rating: reply?.rating ?? null,
        isWebFallback: reply?.isWebFallback ?? false,
        createdAt: msg.createdAt,
      };
    });

    // 6. Satisfaction calculation
    const totalRated = thumbsUp + thumbsDown;
    const satisfactionRate = totalRated > 0 ? Math.round((thumbsUp / totalRated) * 100) : null;

    return NextResponse.json({
      summary: {
        totalSites,
        autoSyncSites,
        publicSites,
        totalPages,
        totalChunks,
        totalSessions,
        totalQueries,
        totalResponses,
        thumbsUp,
        thumbsDown,
        satisfactionRate,
        totalApiKeys,
        activeApiKeys,
        totalCreators,
        avgLatencyMs,
      },
      activityTimeline,
      auditLogs,
    });
  } catch (err: any) {
    console.error("[api/admin/metrics] Error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load admin metrics" },
      { status: 500 }
    );
  }
}
