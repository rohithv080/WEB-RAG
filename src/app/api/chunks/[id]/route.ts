import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing chunk ID" }, { status: 400 });
    }

    const targetChunk = await prisma.chunk.findUnique({
      where: { id },
      select: {
        id: true,
        pageId: true,
        order: true,
        heading: true,
        content: true,
        isBoilerplate: true,
        page: {
          select: {
            id: true,
            siteId: true,
            title: true,
            url: true,
          },
        },
      },
    });

    if (!targetChunk) {
      return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }

    // Fetch previous chunk (order - 1) and next chunk (order + 1) for full narrative context
    const [prevChunk, nextChunk] = await Promise.all([
      prisma.chunk.findFirst({
        where: {
          pageId: targetChunk.pageId,
          order: targetChunk.order - 1,
        },
        select: {
          id: true,
          order: true,
          heading: true,
          content: true,
        },
      }),
      prisma.chunk.findFirst({
        where: {
          pageId: targetChunk.pageId,
          order: targetChunk.order + 1,
        },
        select: {
          id: true,
          order: true,
          heading: true,
          content: true,
        },
      }),
    ]);

    return NextResponse.json({
      chunk: targetChunk,
      context: {
        prev: prevChunk,
        next: nextChunk,
      },
      page: targetChunk.page,
    });
  } catch (error: any) {
    console.error("[get chunk context] Error:", error);
    return NextResponse.json({ error: "Failed to fetch chunk context" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing chunk ID" }, { status: 400 });
    }

    const chunk = await prisma.chunk.findUnique({
      where: { id },
      include: {
        page: {
          include: {
            site: {
              select: { userId: true },
            },
          },
        },
      },
    });

    if (!chunk) {
      return NextResponse.json({ error: "Chunk not found" }, { status: 404 });
    }

    const { userId: currentUserId, isAdmin } = await getAuthUser();

    // Verify ownership
    if (chunk.page.site.userId && chunk.page.site.userId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized to delete this chunk" }, { status: 403 });
    }

    await prisma.chunk.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedChunkId: id, pageId: chunk.pageId });
  } catch (error: any) {
    console.error("[delete chunk] Error:", error);
    return NextResponse.json({ error: "Failed to delete chunk" }, { status: 500 });
  }
}
