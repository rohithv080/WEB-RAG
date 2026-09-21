import { JSDOM } from "jsdom";

export type WebSearchResult = {
  title: string;
  snippet: string;
  url: string;
  source: "tavily" | "duckduckgo" | "wikipedia";
};

const REQUEST_TIMEOUT_MS = 4000;

/**
 * Searches using Tavily API if configured via TAVILY_API_KEY.
 */
async function searchTavily(query: string, apiKey: string): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data.results)) return [];

    return data.results.map((r: any) => ({
      title: (r.title || "").trim(),
      snippet: (r.content || r.snippet || "").trim(),
      url: (r.url || "").trim(),
      source: "tavily",
    }));
  } catch (err) {
    console.warn("[webSearch] Tavily query failed:", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Searches using DuckDuckGo HTML POST interface.
 * Decodes redirection URLs (uddg=) and filters out ads.
 */
async function searchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const params = new URLSearchParams();
    params.append("q", query);

    const res = await fetch("https://html.duckduckgo.com/html/", {
      method: "POST",
      body: params,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: controller.signal,
    });

    if (!res.ok && res.status !== 202) return [];

    const html = await res.text();
    const dom = new JSDOM(html);
    const bodies = dom.window.document.querySelectorAll(".result__body");
    const results: WebSearchResult[] = [];

    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      // Skip advertisement results
      if (b.querySelector(".badge--ad") || b.textContent?.includes("Viewing ads is privacy protected")) {
        continue;
      }

      const titleEl = b.querySelector(".result__title a");
      const snippetEl = b.querySelector(".result__snippet");
      if (!titleEl || !snippetEl) continue;

      const title = titleEl.textContent?.trim() || "";
      const snippet = snippetEl.textContent?.trim() || "";
      let href = titleEl.getAttribute("href") || "";

      // Extract real canonical URL from DuckDuckGo redirect wrapper /l/?kh=-1&uddg=<url>
      if (href.includes("uddg=")) {
        try {
          const raw = href.split("uddg=")[1]?.split("&")[0];
          if (raw) {
            href = decodeURIComponent(raw);
          }
        } catch {
          // keep original href if decode fails
        }
      }

      if (title && snippet && href && href.startsWith("http")) {
        results.push({
          title,
          snippet,
          url: href,
          source: "duckduckgo",
        });
      }

      if (results.length >= 5) break;
    }

    return results;
  } catch (err) {
    console.warn("[webSearch] DuckDuckGo query failed:", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fallback to Wikipedia REST/Action Search API.
 * Never throttles, has 0 cost, requires no API key, and works reliably from cloud Lambdas.
 */
async function searchWikipedia(query: string): Promise<WebSearchResult[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&utf8=&format=json&srlimit=4`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "WebRAG-AgenticSearch/1.0 (https://github.com/rohithv080/WEB-RAG)",
      },
      signal: controller.signal,
    });

    if (!res.ok) return [];
    const data = await res.json();
    const items = data.query?.search;
    if (!Array.isArray(items)) return [];

    return items.map((item: any) => ({
      title: item.title,
      snippet: (item.snippet || "").replace(/<[^>]+>/g, "").trim(),
      url: `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/\s+/g, "_"))}`,
      source: "wikipedia",
    }));
  } catch (err) {
    console.warn("[webSearch] Wikipedia search failed:", err);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Main Web Search Entrypoint with tiered fallbacks:
 * 1. Tavily (if TAVILY_API_KEY is configured)
 * 2. DuckDuckGo (zero-config, free web search)
 * 3. Wikipedia API (cloud data center IP safe fallback)
 */
export async function searchWeb(query: string, maxResults = 5): Promise<WebSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 1. Tavily (Priority if key present)
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (tavilyKey) {
    const tavilyResults = await searchTavily(trimmed, tavilyKey);
    if (tavilyResults.length > 0) {
      return tavilyResults.slice(0, maxResults);
    }
  }

  // 2. DuckDuckGo POST Search
  const ddgResults = await searchDuckDuckGo(trimmed);
  if (ddgResults.length > 0) {
    return ddgResults.slice(0, maxResults);
  }

  // 3. Wikipedia Fallback (protects cloud environments if DDG challenge occurs)
  console.log(`[webSearch] DDG returned 0 results, attempting Wikipedia fallback for "${trimmed}"`);
  const wikiResults = await searchWikipedia(trimmed);
  if (wikiResults.length > 0) {
    return wikiResults.slice(0, maxResults);
  }

  return [];
}
