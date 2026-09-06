import { JSDOM } from "jsdom";

import TurndownService from "turndown";
// @ts-ignore
import { tables } from "turndown-plugin-gfm";
import { describeImage } from "./vision";

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

export async function fetchPage(url: string): Promise<ScrapedPage> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WebRAGBot/1.0; +https://github.com/local/web-rag)",
      Accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const rawHtmlLength = html.length;
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;
  
  // Try to find the main content area, fallback to body
  const mainNode = document.querySelector("main, [role='main'], article, #content, .content") || document.body;

  // Strip purely non-content or strictly navigational elements
  const unwantedSelectors = [
    "script", "style", "noscript", "iframe", "svg", "nav", "header", "footer", "aside",
    "[role='navigation']", "[role='banner']", "[role='contentinfo']", ".sidebar"
  ];
  mainNode.querySelectorAll(unwantedSelectors.join(", ")).forEach(el => el.remove());

  // --- VISION: Analyze up to 5 images ---
  const images = Array.from(mainNode.querySelectorAll("img")).filter(img => {
    const width = parseInt(img.getAttribute("width") || "0");
    const height = parseInt(img.getAttribute("height") || "0");
    // Ignore small icons
    if (width > 0 && width < 50) return false;
    if (height > 0 && height < 50) return false;
    return img.getAttribute("src") || img.getAttribute("data-src");
  }).slice(0, 5);

  if (images.length > 0) {
    console.log(`[scrape] Analyzing ${images.length} images with Groq Vision on ${url}...`);
    const descriptions = await Promise.all(
      images.map(async (img) => {
        let src = img.getAttribute("src") || img.getAttribute("data-src") || "";
        // Convert relative URL to absolute
        try {
          src = new URL(src, url).href;
          return await describeImage(src);
        } catch {
          return null;
        }
      })
    );
    
    images.forEach((img, i) => {
      const desc = descriptions[i];
      if (desc) {
        const caption = document.createElement("p");
        caption.innerHTML = `<strong>[Image: ${desc}]</strong>`;
        img.insertAdjacentElement("afterend", caption);
      }
    });
  }
  // --------------------------------------

  const turndownService = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  turndownService.use(tables);
  
  const contentHtml = mainNode.innerHTML || "";
  const textContent = turndownService.turndown(contentHtml);


  const articleHtmlLength = contentHtml.length;
  const extractionRatio = articleHtmlLength / rawHtmlLength;
  
  console.log(`[scrape] Extraction quality: raw=${rawHtmlLength} chars, article=${articleHtmlLength} chars, ratio=${(extractionRatio * 100).toFixed(1)}%, markdown=${textContent.length} chars`);
  
  if (textContent.length < MIN_CONTENT_CHARS) {
    throw new ScrapeContentError(
      `This page has no extractable article text (common on JS-heavy SPAs). Try a docs or blog URL with static HTML.`
    );
  }
  
  // Warn if extraction ratio is suspiciously low (might indicate poor extraction)
  if (extractionRatio < 0.05) {
    console.warn(`[scrape] Low extraction ratio (${(extractionRatio * 100).toFixed(1)}%) - structure may be mostly boilerplate or JS-rendered`);
  }

  return {
    url,
    title: document.title || url,
    textContent,
    contentHtml,
    rawHtml: html,
  };
}
