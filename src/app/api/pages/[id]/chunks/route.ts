import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing page ID" }, { status: 400 });
    }

    const page = await prisma.page.findUnique({
      where: { id },
      select: {
        id: true,
        siteId: true,
        url: true,
        title: true,
        scrapedAt: true,
      },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const chunks = await prisma.chunk.findMany({
      where: { pageId: id },
      select: {
        id: true,
        order: true,
        heading: true,
        content: true,
        isBoilerplate: true,
      },
      orderBy: { order: "asc" },
    });

    return NextResponse.json({ page, chunks });
  } catch (error: any) {
    console.error("[get page chunks] Error:", error);
    return NextResponse.json({ error: "Failed to fetch page chunks" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing page ID" }, { status: 400 });
    }

    const page = await prisma.page.findUnique({
      where: { id },
      include: {
        site: {
          select: { userId: true },
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const { userId: currentUserId, isAdmin } = await getAuthUser();

    // Verify ownership if site is owned
    if (page.site.userId && page.site.userId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized to delete this page" }, { status: 403 });
    }

    // Cascade deletes all related chunks
    await prisma.page.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedPageId: id, siteId: page.siteId });
  } catch (error: any) {
    console.error("[delete page] Error:", error);
    return NextResponse.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
