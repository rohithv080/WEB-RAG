import { NextRequest, NextResponse } from "next/server";
import { JSDOM } from "jsdom";

export const runtime = "nodejs";

const MAX_PAGES = 100; // Maximum total pages to discover
const CONCURRENCY = 5; // How many pages to fetch in parallel during BFS

/**
 * Extract all same-origin links from an HTML string.
 */
function extractLinks(html: string, baseUrl: URL): string[] {
  const dom = new JSDOM(html, { url: baseUrl.href });
  const anchors = dom.window.document.querySelectorAll("a");
  const links: string[] = [];

  anchors.forEach((a) => {
    try {
      const href = a.getAttribute("href");
      if (!href) return;

      const parsed = new URL(href, baseUrl.href);

      // Same origin only
      if (parsed.origin !== baseUrl.origin) return;

      // Skip non-HTML resources
      const path = parsed.pathname.toLowerCase();
      if (/\.(jpg|jpeg|png|gif|svg|webp|pdf|zip|css|js|xml|json|ico|woff|woff2|ttf|eot)$/.test(path)) return;

      // Remove hash fragments and trailing query noise
      parsed.hash = "";

      links.push(parsed.href);
    } catch {
      // ignore invalid URLs
    }
  });

  return links;
}

/**
 * Fetch a page's HTML. Returns null on failure (non-blocking).
 */
async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; WebRAGBot/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(15_000),
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
 * Multi-level BFS crawl. Discovers internal links across multiple depth levels.
 *
 * Depth 0 = starting URL
 * Depth 1 = links found on the starting URL
 * Depth 2 = links found on depth-1 pages (the actual content pages!)
 *
 * This is what makes the difference: category pages link to recipe/article pages.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url;
    const maxDepth = Math.min(body.depth ?? 2, 3); // Default depth 2, max 3

    if (!url) return NextResponse.json({ error: "Missing url" }, { status: 400 });

    const startUrl = new URL(url);
    const visited = new Set<string>();
    const discovered: string[] = [];

    // BFS queue: each entry is [url, depth]
    let queue: [string, number][] = [[startUrl.href, 0]];

    while (queue.length > 0 && discovered.length < MAX_PAGES) {
      // Group by current depth level
      const currentBatch = queue.splice(0, queue.length);
      const nextQueue: [string, number][] = [];

      // Process in batches of CONCURRENCY
      for (let i = 0; i < currentBatch.length && discovered.length < MAX_PAGES; i += CONCURRENCY) {
        const batch = currentBatch.slice(i, i + CONCURRENCY);

        const results = await Promise.all(
          batch.map(async ([batchUrl, depth]) => {
            if (visited.has(batchUrl)) return null;
            visited.add(batchUrl);

            // Add to discovered list
            if (!discovered.includes(batchUrl)) {
              discovered.push(batchUrl);
            }

            // Only crawl deeper if we haven't hit max depth
            if (depth >= maxDepth) return null;

            const result = await fetchHtml(batchUrl);
            if (!result) return null;

            const finalUrl = new URL(result.finalUrl);
            const links = extractLinks(result.html, finalUrl);

            return links
              .filter((link) => !visited.has(link))
              .map((link) => [link, depth + 1] as [string, number]);
          })
        );

        // Collect next-level links
        for (const childLinks of results) {
          if (!childLinks) continue;
          for (const entry of childLinks) {
            if (!visited.has(entry[0]) && discovered.length + nextQueue.length < MAX_PAGES * 2) {
              nextQueue.push(entry);
            }
          }
        }
      }

      queue = nextQueue;
    }

    // Deduplicate and cap at MAX_PAGES
    const uniqueUrls = [...new Set(discovered)].slice(0, MAX_PAGES);

    console.log(`[crawl] Discovered ${uniqueUrls.length} pages from ${url} (depth ${maxDepth})`);

    return NextResponse.json({ urls: uniqueUrls });
  } catch (error: any) {
    console.error("[crawl] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
