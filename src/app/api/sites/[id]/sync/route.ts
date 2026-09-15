import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncSite } from "@/lib/sync";
import { getAuthUser } from "@/lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * On-Demand Manual Sync Endpoint
 * Triggered by the user clicking "Sync Latest News Now" in the dashboard or settings.
 */
export async function POST(
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
      select: { id: true, userId: true },
    });

    if (!site) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    // Verify ownership or admin secret
    const { userId, isAdmin } = await getAuthUser();
    const adminSecret = process.env.ADMIN_SECRET;
    const isSecretAdmin = adminSecret && req.headers.get("x-admin-secret") === adminSecret;

    if (site.userId && site.userId !== userId && !isAdmin && !isSecretAdmin) {
      return NextResponse.json({ error: "Unauthorized to sync this bot" }, { status: 403 });
    }

    const result = await syncSite(id, {
      maxNewPages: 10,
      deadlineMs: 25_000,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[manual sync] Error:", err);
    return NextResponse.json({ error: err.message || "Manual sync failed" }, { status: 500 });
  }
}
