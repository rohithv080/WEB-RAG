import { JSDOM } from "jsdom";

import TurndownService from "turndown";
// @ts-ignore
import { tables } from "turndown-plugin-gfm";

export const MIN_CONTENT_CHARS = 200;

export class ScrapeContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScrapeContentError";
  }
}

export type ScrapedPage = {
  url: string;
  title: string;
  textContent: string;
  /** HTML content from Readability (for heading-aware chunking) */
  contentHtml: string;
  /** Raw HTML before Readability processing (for debugging) */
  rawHtml?: string;
};

async function fetchJinaReaderFallback(url: string): Promise<ScrapedPage | null> {
  try {
    console.log(`[scrape] Invoking Jina Reader headless SPA fallback for: ${url}`);
    const jinaUrl = `https://r.jina.ai/${encodeURI(url)}`;
    const headers: Record<string, string> = {
      Accept: "text/plain",
      "X-No-Cache": "true",
      "X-Timeout": "25",
    };

    const jinaKey = process.env.JINA_API_KEY;
    if (jinaKey) {
      headers["Authorization"] = `Bearer ${jinaKey}`;
    }

    const res = await fetch(jinaUrl, {
      headers,
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      console.warn(`[scrape] Jina Reader fallback returned status ${res.status}`);
      return null;
    }

    const raw = await res.text();
    if (!raw || raw.trim().length < MIN_CONTENT_CHARS) {
      return null;
    }

    // Extract title from "Title: ..." header if present
    let title = "";
    const titleMatch = raw.match(/^Title:\s*(.+)$/m);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    // Extract content starting after "Markdown Content:"
    let textContent = raw;
    const contentIndex = raw.indexOf("Markdown Content:");
    if (contentIndex !== -1) {
      textContent = raw.slice(contentIndex + "Markdown Content:".length).trim();
    }

    if (!title) {
      const h1Match = textContent.match(/^#\s+(.+)$/m);
      title = h1Match ? h1Match[1].trim() : url;
    }

    if (textContent.length < MIN_CONTENT_CHARS) {
      return null;
    }

    console.log(
      `[scrape] Jina Reader successfully extracted ${textContent.length} chars for: ${url}`
    );
    return {
      url,
      title: title || url,
      textContent,
      contentHtml: textContent,
      rawHtml: raw,
    };
  } catch (err) {
    console.warn(`[scrape] Jina Reader fallback error for ${url}:`, err);
    return null;
  }
}

export async function fetchPage(url: string): Promise<ScrapedPage> {
  let fetchFailed = false;
  let html = "";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 WebRAGBot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      console.warn(`[scrape] Standard fetch failed for ${url}: ${res.status} ${res.statusText}`);
      fetchFailed = true;
    } else {
      html = await res.text();
    }
  } catch (err) {
    console.warn(`[scrape] Standard fetch network error for ${url}:`, err);
    fetchFailed = true;
  }

  // If standard fetch succeeded, attempt local DOM extraction
  if (!fetchFailed && html) {
    try {
      const dom = new JSDOM(html, { url });
      const document = dom.window.document;

      const mainNode =
        document.querySelector("main, [role='main'], article, #content, .content") || document.body;

      const unwantedSelectors = [
        "script",
        "style",
        "noscript",
        "iframe",
        "svg",
        "nav",
        "header",
        "footer",
        "aside",
        "[role='navigation']",
        "[role='banner']",
        "[role='contentinfo']",
        ".sidebar",
      ];
      mainNode.querySelectorAll(unwantedSelectors.join(", ")).forEach((el) => el.remove());

      const turndownService = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
      });
      turndownService.use(tables);

      const contentHtml = mainNode.innerHTML || "";
      const textContent = turndownService.turndown(contentHtml);

      if (textContent.length >= MIN_CONTENT_CHARS) {
        return {
          url,
          title: document.title || url,
          textContent,
          contentHtml,
          rawHtml: html,
        };
      }
      console.log(
        `[scrape] Standard extraction yielded only ${textContent.length} chars. Triggering Jina Reader fallback.`
      );
    } catch (parseErr) {
      console.warn(`[scrape] Local DOM parsing failed for ${url}:`, parseErr);
    }
  }

  // Headless SPA & Cloudflare bypass via Jina Reader
  const jinaPage = await fetchJinaReaderFallback(url);
  if (jinaPage) {
    return jinaPage;
  }

  throw new ScrapeContentError(
    `This page has no extractable article text (common on JS-heavy SPAs or protected sites). Try a docs or blog URL with static HTML.`
  );
}
