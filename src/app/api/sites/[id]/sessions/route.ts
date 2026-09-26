import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing site ID" }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const { userId: currentUserId, isAdmin } = await getAuthUser();

    // Verify ownership if private site
    if (site.userId && site.userId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const sessions = await prisma.chatSession.findMany({
      where: { siteId: id },
      orderBy: { createdAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          take: 1,
          select: { role: true, content: true, createdAt: true },
        },
        _count: {
          select: { messages: true },
        },
      },
      take: 60,
    });

    const formatted = sessions.map((s) => {
      const firstMsg = s.messages[0];
      const previewText = firstMsg
        ? firstMsg.content.slice(0, 80).replace(/\n+/g, " ").trim()
        : "Empty conversation";

      return {
        id: s.id,
        createdAt: s.createdAt,
        messageCount: s._count.messages,
        preview: previewText,
      };
    });

    return NextResponse.json({ sessions: formatted });
  } catch (error: any) {
    console.error("[get site sessions] Error:", error);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}
