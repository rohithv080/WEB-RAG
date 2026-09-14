import { NextRequest, NextResponse } from "next/server";
import { verifyIngestionAuth } from "@/lib/auth";

export const runtime = "nodejs";

const MAX_PAGES = 100;
const CONCURRENCY = 8;
const DEADLINE_MS = 8_500; // Guaranteed to respond within Vercel's 15s Hobby limit

/**
 * Fast regex-based same-origin link extraction without JSDOM overhead.
 * ~100x faster than full DOM parsing on large HTML pages.
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

      // Same origin only
      if (parsed.origin !== baseUrl.origin) continue;

      // Skip static assets
      const path = parsed.pathname.toLowerCase();
      if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|xml|json|ico|woff|woff2|ttf|eot)$/.test(path)) {
        continue;
      }

      // Strip hash and trailing slash noise for uniform deduplication
      parsed.hash = "";
      links.push(parsed.href);
    } catch {
      // ignore invalid URLs
    }
  }

  return links;
}

/**
 * Fetch HTML with short timeout. Returns null on failure.
 */
async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WebRAGBot/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    const html = await res.text();
    return { html, finalUrl: res.url };
  } catch {
    return null;
  }
}

/**
 * Attempt to fetch and parse sitemap.xml for instant URL queue discovery (<300ms).
 */
async function fetchSitemapUrls(baseUrl: URL, maxPages: number): Promise<string[]> {
  const sitemapEndpoints = [
    `${baseUrl.origin}/sitemap.xml`,
    `${baseUrl.origin}/sitemap_index.xml`,
  ];

  for (const sitemapUrl of sitemapEndpoints) {
    try {
      const res = await fetch(sitemapUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; WebRAGBot/1.0)" },
        signal: AbortSignal.timeout(2_000),
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
              if (discovered.length >= maxPages * 2) break;
            }
          }
        } catch {
          // ignore invalid loc entries
        }
      }

      if (discovered.length > 0) {
        console.log(`[crawl] Discovered ${discovered.length} URLs via sitemap (${sitemapUrl})`);
        return discovered;
      }
    } catch {
      // continue to next endpoint or HTML crawl
    }
  }

  return [];
}

/**
 * URL Queue Discovery:
 * 1. Checks sitemap.xml first for near-instant link collection.
 * 2. Falls back to fast regex BFS crawl with safety deadline.
 * 3. Returns the complete URL queue to the client for sequential batch processing.
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const authCheck = await verifyIngestionAuth(req.headers);
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await req.json();
    const url = body.url;
    const maxPages = Math.min(Math.max(Number(body.maxPages) || 15, 1), MAX_PAGES);
    const maxDepth = Math.min(body.depth ?? (maxPages <= 5 ? 1 : 2), 3);

    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const startUrl = new URL(url);
    const visited = new Set<string>();
    const discovered: string[] = [startUrl.href];
    visited.add(startUrl.href);

    // 1. Try sitemap first for instant discovery
    const sitemapUrls = await fetchSitemapUrls(startUrl, maxPages);
    let sitemapFound = false;

    if (sitemapUrls.length > 0) {
      sitemapFound = true;
      for (const u of sitemapUrls) {
        if (!visited.has(u)) {
          visited.add(u);
          discovered.push(u);
          if (discovered.length >= maxPages) break;
        }
      }
    }

    // 2. If sitemap did not provide enough URLs, do fast regex HTML BFS crawl
    if (discovered.length < maxPages) {
      let queue: [string, number][] = [[startUrl.href, 0]];

      while (queue.length > 0 && discovered.length < maxPages) {
        if (Date.now() - startTime > DEADLINE_MS) {
          console.log(`[crawl] Approaching Vercel safety deadline (${DEADLINE_MS}ms), returning ${discovered.length} pages`);
          break;
        }

        const currentBatch = queue.splice(0, queue.length);
        const nextQueue: [string, number][] = [];

        for (let i = 0; i < currentBatch.length && discovered.length < maxPages; i += CONCURRENCY) {
          if (Date.now() - startTime > DEADLINE_MS) break;

          const batch = currentBatch.slice(i, i + CONCURRENCY);

          const results = await Promise.all(
            batch.map(async ([batchUrl, depth]) => {
              if (depth >= maxDepth) return null;

              const result = await fetchHtml(batchUrl);
              if (!result) return null;

              const finalUrl = new URL(result.finalUrl);
              const links = extractLinksFast(result.html, finalUrl);

              return links
                .filter((link) => !visited.has(link))
                .map((link) => [link, depth + 1] as [string, number]);
            })
          );

          for (const childLinks of results) {
            if (!childLinks) continue;
            for (const [link, nextDepth] of childLinks) {
              if (!visited.has(link)) {
                visited.add(link);
                discovered.push(link);
                if (discovered.length < maxPages * 2) {
                  nextQueue.push([link, nextDepth]);
                }
              }
            }
          }
        }

        queue = nextQueue;
      }
    }

    const uniqueUrls = [...new Set(discovered)].slice(0, maxPages);
    const elapsed = Date.now() - startTime;

    console.log(`[crawl] Discovered ${uniqueUrls.length} pages in ${elapsed}ms (sitemap: ${sitemapFound})`);

    return NextResponse.json({
      urls: uniqueUrls,
      total: uniqueUrls.length,
      sitemapFound,
      elapsedMs: elapsed,
    });
  } catch (error: any) {
    console.error("[crawl] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
