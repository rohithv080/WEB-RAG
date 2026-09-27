"use client";

import { FormEvent, useState } from "react";
import { CrawlProgressBar, type CrawlProgressState } from "./CrawlProgressBar";

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

export function UrlInput({ siteId, onScraped, onUnauthorized, disabled, compact }: Props) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [crawlLimit, setCrawlLimit] = useState<number>(1);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgressState | null>(null);
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
        setCrawlProgress({ current: 0, total: crawlLimit, stage: "discovering", percent: 0 });
        const crawlRes = await fetch("/api/crawl", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed, maxPages: crawlLimit }),
        });

        if (!crawlRes.ok) throw new Error("Failed to discover URLs");
        const { urls } = await crawlRes.json();
        if (urls && urls.length > 0) urlsToScrape = urls;
      }

      let currentSiteId = siteId;
      const totalPages = urlsToScrape.length;
      const BATCH_SIZE = 3;
      let completed = 0;
      let lastResult: any = null;

      setCrawlProgress({
        current: 0,
        total: totalPages,
        stage: "indexing",
        currentUrl: urlsToScrape[0],
        percent: 0,
        customLabel: `Indexing page 0 of ${totalPages}... (0%)`,
      });

      for (let i = 0; i < urlsToScrape.length; i += BATCH_SIZE) {
        const batchUrls = urlsToScrape.slice(i, i + BATCH_SIZE);
        setCrawlProgress((prev) =>
          prev
            ? {
                ...prev,
                currentUrl: batchUrls[0],
                stage: "indexing",
              }
            : null
        );

        const res = await fetch("/api/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            urls: batchUrls,
            siteId: currentSiteId || undefined,
          }),
        });

        if (res.status === 401) {
          onUnauthorized?.();
          throw new Error("Unauthorized");
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to scrape page batch");

        if (!currentSiteId && data.siteId) {
          currentSiteId = data.siteId;
        }
        lastResult = data;

        completed += batchUrls.length;
        const currentCount = Math.min(completed, totalPages);
        const percent = Math.round((currentCount / totalPages) * 100);

        setCrawlProgress({
          current: currentCount,
          total: totalPages,
          stage: "indexing",
          currentUrl: batchUrls[batchUrls.length - 1],
          percent,
          customLabel: `Indexing page ${currentCount} of ${totalPages}... (${percent}%)`,
        });
      }

      setStatus(`Indexed ${urlsToScrape.length} page(s) successfully!`);
      if (lastResult) onScraped(lastResult as ScrapeResult);
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
          <button type="submit" disabled={disabled || loading} className="add-page-btn">
            {loading ? "…" : "Add"}
          </button>
        </div>
        {crawlProgress && <CrawlProgressBar progress={crawlProgress} compact />}
        {status && <p className="add-page-status">{status}</p>}
        {error && <p className="add-page-error">{error}</p>}

        <style jsx>{`
          .add-page-form {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
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
            border-radius: var(--radius-sm);
            background: var(--bg-card);
            color: var(--text-primary);
            font-size: 0.8rem;
            outline: none;
            transition: border-color 0.15s ease;
          }
          .add-page-input:focus {
            border-color: var(--accent);
          }
          .add-page-btn {
            flex-shrink: 0;
            padding: 0.45rem 0.8rem;
            border: none;
            border-radius: var(--radius-sm);
            background: var(--accent);
            color: #ffffff;
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.15s ease;
          }
          .add-page-btn:hover:not(:disabled) {
            background: var(--accent-hover);
          }
          .add-page-status {
            margin: 0;
            font-size: 0.76rem;
            color: var(--text-secondary);
          }
          .add-page-error {
            margin: 0;
            font-size: 0.76rem;
            color: #ef4444;
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
        <button type="submit" className="url-btn" disabled={loading || disabled}>
          {loading
            ? crawlProgress
              ? `Scraping ${crawlProgress.current}/${crawlProgress.total}`
              : "Scraping..."
            : compact
              ? "Add"
              : "Create"}
        </button>
      </div>

      {!compact && (
        <div className="crawl-options-wrapper">
          <div className="crawl-options-header">
            <span className="url-label">Crawl Scope</span>
            <span className="vercel-badge">Vercel-Optimized</span>
          </div>
          <div className="crawl-pills-row">
            {[
              { count: 1, label: "1 Page", tag: "Single", desc: "Instant (~2s)" },
              { count: 5, label: "5 Pages", tag: "Quick", desc: "Fast (~10s)" },
              { count: 15, label: "15 Pages", tag: "Recommended", desc: "Balanced (~25s)" },
              { count: 30, label: "30 Pages", tag: "Deep", desc: "Thorough (~50s)" },
              { count: 100, label: "100 Pages", tag: "Full", desc: "Complete (2-3m)" },
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
      {crawlProgress && <CrawlProgressBar progress={crawlProgress} />}
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
          color: var(--text-muted);
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          font-weight: 500;
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
          padding: 8px 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .crawl-pill-mini:hover:not(:disabled) {
          border-color: var(--border-hover);
          background: var(--bg-hover);
        }
        .crawl-pill-mini.active {
          border-color: var(--accent);
          background: var(--bg-hover);
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
          color: var(--text-primary);
        }
        .crawl-pill-mini.active .pill-mini-label {
          color: var(--text-primary);
        }
        .pill-mini-tag {
          font-size: 0.62rem;
          color: var(--text-muted);
          font-family: monospace;
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
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .url-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }
        .url-input {
          flex: 1;
          min-width: 220px;
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-card);
          color: var(--text-primary);
          outline: none;
          font-size: 0.82rem;
          transition: border-color 0.15s ease;
        }
        .url-input:focus {
          border-color: var(--accent);
        }
        .url-btn {
          padding: 8px 16px;
          border: none;
          border-radius: var(--radius);
          background: var(--accent);
          color: #ffffff;
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .url-btn:hover:not(:disabled) {
          background: var(--accent-hover);
        }
        .url-status {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
        }
        .url-error {
          margin: 0;
          font-size: 0.78rem;
          color: #ef4444;
        }
      `}</style>
    </form>
  );
}
