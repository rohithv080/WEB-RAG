import { prisma } from "@/lib/db";
import { indexPagesBatch } from "@/app/api/scrape/route";

/**
 * Fast regex link extraction from HTML.
 */
function extractLinksFast(html: string, baseUrl: URL): string[] {
  const links: string[] = [];
  const hrefRegex = /<a\s+(?:[^>]*?\s+)?href=(["'])(.*?)\1/gi;
  let match: RegExpExecArray | null;

  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const rawHref = match[2]?.trim();
      if (!rawHref || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:") || rawHref.startsWith("tel:")) {
        continue;
      }

      const parsed = new URL(rawHref, baseUrl.href);
      if (parsed.origin !== baseUrl.origin) continue;

      const path = parsed.pathname.toLowerCase();
      if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|xml|json|ico|woff|woff2|ttf)$/.test(path)) {
        continue;
      }

      parsed.hash = "";
      links.push(parsed.href);
    } catch {
      // ignore invalid
    }
  }

  return links;
}

/**
 * Probes sitemap XML for newly published URLs.
 */
async function fetchSitemapUrls(baseUrl: URL): Promise<string[]> {
  const sitemapEndpoints = [
    `${baseUrl.origin}/sitemap.xml`,
    `${baseUrl.origin}/sitemap_index.xml`,
    `${baseUrl.origin}/news-sitemap.xml`,
  ];

  for (const sitemapUrl of sitemapEndpoints) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebRAGBot/1.0; +https://github.com/local/web-rag)" },
        signal: AbortSignal.timeout(2_500),
      });
      if (!res.ok) continue;

      const xml = await res.text();
      const locRegex = /<loc>(.*?)<\/loc>/gi;
      const discovered: string[] = [];
      let match: RegExpExecArray | null;

      while ((match = locRegex.exec(xml)) !== null) {
        try {
          const loc = match[1].trim();
          const parsed = new URL(loc);
          if (parsed.origin === baseUrl.origin) {
            const path = parsed.pathname.toLowerCase();
            if (!/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|xml|json|ico)$/.test(path)) {
              parsed.hash = "";
              discovered.push(parsed.href);
            }
          }
        } catch {
          // skip
        }
      }

      if (discovered.length > 0) {
        return discovered;
      }
    } catch {
      // try next
    }
  }

  return [];
}

export type SyncSiteResult = {
  success: boolean;
  siteId: string;
  siteName: string | null;
  newPagesCount: number;
  newUrls: string[];
  message: string;
};

/**
 * Discovers and ingests new, unindexed articles for a bot.
 * Enforces a strict timeout budget to guarantee safe execution on Vercel Hobby.
 */
export async function syncSite(
  siteId: string,
  options: {
    maxNewPages?: number;
    deadlineMs?: number;
  } = {}
): Promise<SyncSiteResult> {
  const maxNewPages = options.maxNewPages ?? 5;
  const deadlineMs = options.deadlineMs ?? 8_000;
  const startTime = Date.now();

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      pages: {
        select: { id: true, url: true },
      },
    },
  });

  if (!site) {
    return {
      success: false,
      siteId,
      siteName: null,
      newPagesCount: 0,
      newUrls: [],
      message: "Site not found",
    };
  }

  // 1. Resolve Seed URL
  let seedUrl = (site as any).sourceUrl;
  if (!seedUrl) {
    const firstWebPage = site.pages.find((p) => p.url.startsWith("http://") || p.url.startsWith("https://"));
    if (firstWebPage) {
      seedUrl = firstWebPage.url;
    }
  }

  if (!seedUrl) {
    return {
      success: false,
      siteId,
      siteName: site.name,
      newPagesCount: 0,
      newUrls: [],
      message: "No web URL found for this bot (uploaded documents cannot be auto-synced).",
    };
  }

  const parsedSeed = new URL(seedUrl);
  const discovered: string[] = [];

  // 2. Probes sitemaps first (<500ms)
  const sitemapUrls = await fetchSitemapUrls(parsedSeed);
  if (sitemapUrls.length > 0) {
    discovered.push(...sitemapUrls);
  }

  // 3. If sitemap is missing, fetch homepage links
  if (discovered.length === 0 && Date.now() - startTime < deadlineMs) {
    try {
      const res = await fetch(parsedSeed.href, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebRAGBot/1.0)" },
        signal: AbortSignal.timeout(2_500),
      });
      if (res.ok) {
        const html = await res.text();
        const extracted = extractLinksFast(html, parsedSeed);
        discovered.push(...extracted);
      }
    } catch (err) {
      console.warn(`[sync] Failed to fetch homepage ${parsedSeed.href}:`, err);
    }
  }

  // 4. Compare with existing pages and identify newly published articles
  const cleanUrl = (u: string) => u.trim().replace(/\/+$/, "").toLowerCase();
  const existingSet = new Set(site.pages.map((p) => cleanUrl(p.url)));

  const unindexedUrls: string[] = [];
  for (const u of discovered) {
    if (!existingSet.has(cleanUrl(u)) && !unindexedUrls.includes(u)) {
      unindexedUrls.push(u);
      if (unindexedUrls.length >= maxNewPages) break;
    }
  }

  if (unindexedUrls.length === 0) {
    await prisma.site.update({
      where: { id: siteId },
      data: { lastSyncedAt: new Date() } as any,
    });

    return {
      success: true,
      siteId,
      siteName: site.name,
      newPagesCount: 0,
      newUrls: [],
      message: "Bot is already up-to-date. No new articles detected.",
    };
  }

  // 5. Ingest new articles via batch ingestion
  try {
    const batchResult = await indexPagesBatch(unindexedUrls, {
      existingSiteId: siteId,
    });

    await prisma.site.update({
      where: { id: siteId },
      data: { lastSyncedAt: new Date() } as any,
    });

    return {
      success: true,
      siteId,
      siteName: site.name,
      newPagesCount: batchResult.processedCount,
      newUrls: unindexedUrls.slice(0, batchResult.processedCount),
      message: `Successfully synced ${batchResult.processedCount} new page(s)!`,
    };
  } catch (err: any) {
    console.error(`[sync] Failed to ingest new pages for ${site.name}:`, err);
    return {
      success: false,
      siteId,
      siteName: site.name,
      newPagesCount: 0,
      newUrls: [],
      message: err.message || "Failed to ingest new pages during sync",
    };
  }
}
