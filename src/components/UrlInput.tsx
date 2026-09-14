"use client";

import { FormEvent, useState } from "react";

export type ScrapeResult = {
  siteId: string;
  pageId: string;
  sessionId: string;
  siteName: string | null;
  title: string | null;
  url: string;
  chunkCount: number;
};

type Props = {
  /** If provided, the scraped page is appended to this site (Add Page mode). */
  siteId?: string;
  onScraped: (result: ScrapeResult) => void;
  /** Called when the server returns 401 — parent should clear the stored secret. */
  onUnauthorized?: () => void;
  disabled?: boolean;
  /** Compact variant used inside site panels. */
  compact?: boolean;
};

export function UrlInput({
  siteId,
  onScraped,
  onUnauthorized,
  disabled,
  compact,
}: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [crawlLimit, setCrawlLimit] = useState<number>(1);
  const [crawlProgress, setCrawlProgress] = useState<{current: number; total: number} | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setStatus(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Enter a URL to scrape");
      return;
    }

    setLoading(true);
    setStatus("Fetching & extracting…");

    try {
      let urlsToScrape = [trimmed];

      if (crawlLimit > 1) {
        setCrawlProgress({ current: 0, total: 0 });
        const crawlRes = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed, maxPages: crawlLimit }),
        });
        
        if (!crawlRes.ok) throw new Error("Failed to discover URLs");
        const { urls } = await crawlRes.json();
        urlsToScrape = urls;
        setCrawlProgress({ current: 0, total: urls.length });
      }

      let currentSiteId = siteId;

      for (let i = 0; i < urlsToScrape.length; i++) {
        const u = urlsToScrape[i];
        if (crawlLimit > 1) setCrawlProgress({ current: i + 1, total: urlsToScrape.length });

        const res = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: u, siteId: currentSiteId }),
        });
        
        if (res.status === 401) {
          onUnauthorized?.();
          throw new Error("Unauthorized");
        }
        
        if (!res.ok) {
          const data = await res.json().catch(()=>({}));
          console.warn(`Failed to scrape ${u}: ${data.error}`);
          continue; // Skip failed pages in deep crawl
        }
        
        const data = await res.json();
        // The first page sets the siteId for subsequent pages
        if (!currentSiteId && data.siteId) {
          currentSiteId = data.siteId;
        }

        // Only call onScraped at the very end to avoid refreshing UI 50 times
        if (i === urlsToScrape.length - 1 || crawlLimit === 1) {
          setStatus(`Indexed ${data.chunkCount} chunks from "${data.title || data.url}"`);
          onScraped(data as ScrapeResult);
        }
      }
      
      setUrl("");
    } catch (err: any) {
      setError(err instanceof Error ? err.message : "Scrape failed");
      setStatus(null);
    } finally {
      setLoading(false);
      setCrawlProgress(null);
    }
  }

  if (compact) {
    return (
      <form onSubmit={handleSubmit} className="add-page-form">
        <div className="add-page-row">
          <input
            type="url"
            placeholder="https://example.com/docs/another-page…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={disabled || loading}
            className="add-page-input"
            autoComplete="off"
          />
          <button
            type="submit"
            disabled={disabled || loading}
            className="add-page-btn"
          >
            {loading ? "…" : "Add"}
          </button>
        </div>
        {status && <p className="add-page-status">{status}</p>}
        {error && <p className="add-page-error">{error}</p>}

        <style jsx>{`
          .add-page-form {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
          }
          .add-page-row {
            display: flex;
            gap: 0.4rem;
          }
          .add-page-input {
            flex: 1;
            min-width: 0;
            padding: 0.45rem 0.65rem;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--bg-input);
            color: var(--text);
            font-size: 0.82rem;
            outline: none;
          }
          .add-page-input:focus {
            border-color: var(--accent);
          }
          .add-page-btn {
            flex-shrink: 0;
            padding: 0.45rem 0.8rem;
            border: 1px solid var(--accent-dim);
            border-radius: var(--radius);
            background: transparent;
            color: var(--accent);
            font-size: 0.8rem;
            font-weight: 600;
            transition: background 0.12s ease;
          }
          .add-page-btn:hover:not(:disabled) {
            background: var(--accent-soft);
          }
          .add-page-status {
            margin: 0;
            font-size: 0.78rem;
            color: var(--success);
          }
          .add-page-error {
            margin: 0;
            font-size: 0.78rem;
            color: var(--danger);
          }
        `}</style>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="url-form">
      <label htmlFor="scrape-url" className="url-label">
        First page URL
      </label>
      <div className="url-row">
        <input
          id="scrape-url"
          type="url"
          className="url-input"
          placeholder={compact ? "Add another page..." : "Enter a URL to create a bot..."}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={loading || disabled}
          required
        />
        <button
          type="submit"
          className="url-btn"
          disabled={loading || disabled}
        >
          {loading ? (crawlProgress ? `Scraping ${crawlProgress.current}/${crawlProgress.total}` : "Scraping...") : compact ? "Add" : "Create"}
        </button>
      </div>
      
      {!compact && (
        <div className="crawl-options-wrapper">
          <div className="crawl-options-header">
            <span className="url-label">Crawl Scope</span>
            <span className="vercel-badge">⚡ Vercel-Optimized</span>
          </div>
          <div className="crawl-pills-row">
            {[
              { count: 1, label: "1 Page", tag: "⚡ Single", desc: "Instant (~2s)" },
              { count: 5, label: "5 Pages", tag: "🚀 Quick", desc: "Fast (~10s)" },
              { count: 15, label: "15 Pages", tag: "⭐ Best", desc: "Balanced (~25s)" },
              { count: 30, label: "30 Pages", tag: "📚 Deep", desc: "Thorough (~50s)" },
              { count: 100, label: "100 Pages", tag: "🌐 Full", desc: "Complete (2-3m)" },
            ].map((opt) => (
              <button
                key={opt.count}
                type="button"
                className={`crawl-pill-mini ${crawlLimit === opt.count ? "active" : ""}`}
                onClick={() => setCrawlLimit(opt.count)}
                disabled={loading || disabled}
              >
                <div className="pill-mini-top">
                  <span className="pill-mini-label">{opt.label}</span>
                  <span className="pill-mini-tag">{opt.tag}</span>
                </div>
                <span className="pill-mini-desc">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {status && <p className="url-status">{status}</p>}
      {error && <p className="url-error">{error}</p>}

      <style jsx>{`
        .crawl-options-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-top: 0.2rem;
        }
        .crawl-options-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .vercel-badge {
          font-size: 0.68rem;
          color: var(--accent);
          background: var(--accent-soft);
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-weight: 600;
        }
        .crawl-pills-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
          gap: 0.35rem;
        }
        .crawl-pill-mini {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.15rem;
          padding: 0.4rem 0.55rem;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .crawl-pill-mini:hover:not(:disabled) {
          border-color: var(--border-active);
          background: var(--bg-card);
        }
        .crawl-pill-mini.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .pill-mini-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .pill-mini-label {
          font-size: 0.76rem;
          font-weight: 600;
          color: var(--text);
        }
        .crawl-pill-mini.active .pill-mini-label {
          color: var(--accent);
        }
        .pill-mini-tag {
          font-size: 0.62rem;
          color: var(--text-muted);
        }
        .pill-mini-desc {
          font-size: 0.62rem;
          color: var(--text-muted);
        }
        .url-form {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .url-label {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.02em;
        }
        .url-row {
          display: flex;
          gap: 0.6rem;
          flex-wrap: wrap;
        }
        .url-input {
          flex: 1;
          min-width: 220px;
          padding: 0.7rem 0.9rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-input);
          color: var(--text);
          outline: none;
        }
        .url-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .url-btn {
          padding: 0.7rem 1.1rem;
          border: none;
          border-radius: var(--radius);
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .url-btn:hover:not(:disabled) {
          opacity: 0.85;
        }
        .url-btn:active:not(:disabled) {
          transform: scale(0.98);
        }
        .url-status {
          margin: 0;
          font-size: 0.85rem;
          color: var(--success);
        }
        .url-error {
          margin: 0;
          font-size: 0.85rem;
          color: var(--danger);
        }
      `}</style>
    </form>
  );
}
