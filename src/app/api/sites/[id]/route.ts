import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncTelegramBotCommands } from "@/lib/telegram";
import { getAuthUser } from "@/lib/auth";

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
      include: {
        pages: {
          select: { id: true, url: true, title: true, scrapedAt: true },
        },
      },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    return NextResponse.json({ site });
  } catch (error: any) {
    console.error("[get site] Error:", error);
    return NextResponse.json({ error: "Failed to fetch site" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing site ID" }, { status: 400 });
    }

    const existing = await prisma.site.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const { userId: currentUserId, isAdmin } = await getAuthUser();

    // Protect bot settings: if owned by another user, allow only if Super Admin
    if (existing.userId && existing.userId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized to modify this bot" }, { status: 403 });
    }

    const body = await req.json();
    const { name, description, systemPrompt, starterQuestions, tone, isPublic, autoSync, syncFrequency, sourceUrl } = body;

    const dataToUpdate: any = {};
    if (typeof name === "string") dataToUpdate.name = name.trim();
    if (description !== undefined) {
      dataToUpdate.description = typeof description === "string" ? description.trim() || null : null;
    }
    if (systemPrompt !== undefined) {
      dataToUpdate.systemPrompt = typeof systemPrompt === "string" ? systemPrompt.trim() || null : null;
    }
    if (starterQuestions !== undefined) {
      if (Array.isArray(starterQuestions)) {
        dataToUpdate.starterQuestions = starterQuestions
          .map((q: any) => (typeof q === "string" ? q.trim() : ""))
          .filter(Boolean);
      } else {
        dataToUpdate.starterQuestions = null;
      }
    }
    if (typeof tone === "string" && ["concise", "balanced", "detailed"].includes(tone)) {
      dataToUpdate.tone = tone;
    }
    if (typeof isPublic === "boolean") {
      dataToUpdate.isPublic = isPublic;
    }
    if (typeof autoSync === "boolean") {
      dataToUpdate.autoSync = autoSync;
    }
    if (typeof syncFrequency === "string" && ["daily", "weekly", "hourly"].includes(syncFrequency)) {
      dataToUpdate.syncFrequency = syncFrequency;
    }
    if (sourceUrl !== undefined) {
      dataToUpdate.sourceUrl = typeof sourceUrl === "string" ? sourceUrl.trim() || null : null;
    }

    const updated = await prisma.site.update({
      where: { id },
      data: dataToUpdate,
    });

    return NextResponse.json({ success: true, site: updated });
  } catch (error: any) {
    console.error("[patch site] Error:", error);
    return NextResponse.json({ error: "Failed to update site" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Missing site ID" }, { status: 400 });
    }

    const existing = await prisma.site.findUnique({ where: { id }, select: { userId: true } });
    if (!existing) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const { userId: currentUserId, isAdmin } = await getAuthUser();

    // Protect deletion: prevent any other user from deleting this bot unless Super Admin
    if (existing.userId && existing.userId !== currentUserId && !isAdmin) {
      return NextResponse.json({ error: "Unauthorized to delete this bot" }, { status: 403 });
    }

    // Since we added onDelete: Cascade, deleting the Site will delete Pages, Chunks, and ChatSessions
    await prisma.site.delete({
      where: { id },
    });

    syncTelegramBotCommands().catch((e) => console.error("[delete site] Telegram auto-sync failed:", e));

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[delete site] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete site" },
      { status: 500 }
    );
  }
}

