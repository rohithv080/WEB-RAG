import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        site: {
          select: { id: true, name: true, userId: true, isPublic: true },
        },
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
            isWebFallback: true,
            createdAt: true,
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // If the bot is explicitly private and owned, verify caller is owner or admin
    if (session.site.isPublic === false && session.site.userId) {
      const { userId: currentUserId, isAdmin } = await getAuthUser();
      if (session.site.userId !== currentUserId && !isAdmin) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
    }

    return NextResponse.json({
      session: {
        id: session.id,
        siteId: session.siteId,
        createdAt: session.createdAt,
      },
      messages: session.messages,
    });
  } catch (error: any) {
    console.error("[get session messages] Error:", error);
    return NextResponse.json({ error: "Failed to fetch session messages" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing session ID" }, { status: 400 });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id },
      include: {
        site: {
          select: { userId: true },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const { userId: currentUserId, isAdmin } = await getAuthUser();

    // Verify ownership
    if (session.site.userId && session.site.userId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Cascade deletes all related messages
    await prisma.chatSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedSessionId: id, siteId: session.siteId });
  } catch (error: any) {
    console.error("[delete session] Error:", error);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
