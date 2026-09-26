import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncSite } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 15; // Vercel Hobby limit

/**
 * Automated Cron Sync Endpoint
 * Triggered by Vercel Cron according to `vercel.json` (e.g. daily at 6:30 AM IST).
 *
 * Safety & Security Guards:
 * 1. Cron Secret Auth: Verified via `Authorization: Bearer ${CRON_SECRET}` or `x-admin-secret`.
 * 2. Hard Deadline Guard: Caps execution at 8.5 seconds to guarantee zero 504 timeouts on Vercel Hobby.
 * 3. Oldest-First Rotation: Syncs sites ordered by `lastSyncedAt ASC NULLS FIRST`.
 */
export async function GET(req: NextRequest) {
  const startTime = Date.now();
  const DEADLINE_MS = 8_500;

  try {
    // 1. Dual Auth Defense: CRON_SECRET or ADMIN_SECRET
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    const adminSecret = process.env.ADMIN_SECRET;

    const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAdmin = adminSecret && req.headers.get("x-admin-secret") === adminSecret;

    // In local dev without secrets set, allow execution for easy testing
    const isDev = process.env.NODE_ENV !== "production" && !cronSecret && !adminSecret;

    if (!isVercelCron && !isAdmin && !isDev) {
      return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
    }

    // 2. Fetch sites enabled for autoSync, prioritized by oldest sync time
    const sitesToSync = await prisma.site.findMany({
      where: { autoSync: true },
      orderBy: { lastSyncedAt: "asc" },
      take: 5,
    });

    if (sitesToSync.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No sites have autoSync enabled.",
        syncedCount: 0,
      });
    }

    const results = [];

    // 3. Process sites sequentially until safety deadline
    for (const site of sitesToSync) {
      if (Date.now() - startTime > DEADLINE_MS) {
        console.log(
          `[cron sync] Approaching Vercel safety deadline (${DEADLINE_MS}ms). Exiting cleanly.`
        );
        break;
      }

      try {
        console.log(`[cron sync] Syncing site: "${site.name}" (${site.id})`);
        const syncResult = await syncSite(site.id, {
          maxNewPages: 5,
          deadlineMs: DEADLINE_MS - (Date.now() - startTime),
        });
        results.push(syncResult);
      } catch (err: any) {
        console.error(`[cron sync] Error syncing site ${site.id}:`, err);
        results.push({
          success: false,
          siteId: site.id,
          siteName: site.name,
          error: err.message || "Sync failed",
        });
      }
    }

    const elapsed = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      processedSites: results.length,
      totalAutoSyncSites: sitesToSync.length,
      elapsedMs: elapsed,
      results,
    });
  } catch (error: any) {
    console.error("[cron sync] Fatal error:", error);
    return NextResponse.json({ error: error.message || "Internal sync error" }, { status: 500 });
  }
}
