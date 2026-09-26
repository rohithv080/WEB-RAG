"use client";

import { useEffect, useState, useMemo } from "react";
import type { Citation } from "./CitationCard";

type AdjacentChunk = {
  id: string;
  order: number;
  heading: string | null;
  content: string;
};

type Props = {
  citation: Citation;
  query?: string;
  onClose: () => void;
};

export function SourceInspectModal({ citation, query = "", onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [showAdjacentContext, setShowAdjacentContext] = useState(false);
  const [loadingContext, setLoadingContext] = useState(false);
  const [adjacentContext, setAdjacentContext] = useState<{
    prev: AdjacentChunk | null;
    next: AdjacentChunk | null;
  } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch adjacent surrounding chunks when context toggle is activated
  useEffect(() => {
    if (showAdjacentContext && !adjacentContext && citation.chunkId) {
      setLoadingContext(true);
      fetch(`/api/chunks/${citation.chunkId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.context) {
            setAdjacentContext(data.context);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingContext(false));
    }
  }, [showAdjacentContext, adjacentContext, citation.chunkId]);

  const domain = (() => {
    try {
      return new URL(citation.pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return citation.pageUrl;
    }
  })();

  const favicon = (() => {
    try {
      const host = new URL(citation.pageUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
    } catch {
      return null;
    }
  })();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const relevancePct = Math.min(100, Math.max(1, Math.round(citation.score * 100)));
  const scoreTier = relevancePct >= 80 ? "high" : relevancePct >= 60 ? "medium" : "fallback";

  // Highlight query keywords in the snippet
  const highlightedSnippet = useMemo(() => {
    if (!query.trim()) return citation.snippet;
    const words = query
      .split(/\s+/)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter((w) => w.length > 2);
    if (words.length === 0) return citation.snippet;

    const regex = new RegExp(`(${words.join("|")})`, "gi");
    const parts = citation.snippet.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="kw-highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
  }, [citation.snippet, query]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <span className="cite-badge">[{citation.index}]</span>
            {favicon && <img src={favicon} alt="" width={18} height={18} className="site-icon" />}
            <div>
              <h3 className="source-domain">{domain}</h3>
              <p className="source-heading">{citation.heading || "Extracted Section"}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Relevance and Retrieval Telemetry */}
        <div className="telemetry-bar">
          <div className="score-col">
            <div className="score-row">
              <span className={`score-dot ${scoreTier}`} />
              <span className="score-text">
                <strong>{relevancePct}%</strong> Match Score
              </span>
              <span className={`score-badge ${scoreTier}`}>
                {scoreTier === "high"
                  ? "High Relevance"
                  : scoreTier === "medium"
                    ? "Strong Match"
                    : "Semantic Candidate"}
              </span>
            </div>
            <div className="score-progress-track">
              <div
                className={`score-progress-fill ${scoreTier}`}
                style={{ width: `${relevancePct}%` }}
              />
            </div>
          </div>

          <div className="engine-meta-col">
            <span className="engine-pill">⚡ Vector (Nomic-768) + BM25 Hybrid</span>
            <span className="chunk-id-text">
              Chunk: <code>{citation.chunkId ? citation.chunkId.slice(0, 10) : "verified"}</code>
            </span>
          </div>
        </div>

        {/* Verified Chunk Passage */}
        <div className="content-container">
          <div className="content-header-row">
            <span className="content-label">Verified Extracted Knowledge:</span>
            {query.trim().length > 2 && (
              <span className="matched-terms-hint">Keywords highlighted</span>
            )}
          </div>

          <div className="chunk-text">{highlightedSnippet}</div>

          {/* Adjacent Surrounding Context Section */}
          <div className="adjacent-context-box">
            <button
              type="button"
              className="adjacent-toggle-btn"
              onClick={() => setShowAdjacentContext((v) => !v)}
            >
              <span>
                {showAdjacentContext
                  ? "▾ Hide Surrounding Context"
                  : "▸ Show Surrounding Document Context"}
              </span>
              <span className="adjacent-subtext">(Preceding & succeeding chunks in document)</span>
            </button>

            {showAdjacentContext && (
              <div className="adjacent-content-panel">
                {loadingContext ? (
                  <div className="adjacent-loading">Loading adjacent chunks from database...</div>
                ) : adjacentContext ? (
                  <div className="adjacent-cards-col">
                    {adjacentContext.prev && (
                      <div className="adjacent-chunk-item">
                        <div className="adj-header">
                          <span className="adj-tag">
                            ← Preceding Context (Chunk #{adjacentContext.prev.order + 1})
                          </span>
                          {adjacentContext.prev.heading && (
                            <span className="adj-heading">§ {adjacentContext.prev.heading}</span>
                          )}
                        </div>
                        <p className="adj-body">{adjacentContext.prev.content}</p>
                      </div>
                    )}

                    {!adjacentContext.prev && (
                      <div className="adj-boundary">Beginning of document (no previous chunk)</div>
                    )}

                    {adjacentContext.next && (
                      <div className="adjacent-chunk-item">
                        <div className="adj-header">
                          <span className="adj-tag">
                            Succeeding Context (Chunk #{adjacentContext.next.order + 1}) →
                          </span>
                          {adjacentContext.next.heading && (
                            <span className="adj-heading">§ {adjacentContext.next.heading}</span>
                          )}
                        </div>
                        <p className="adj-body">{adjacentContext.next.content}</p>
                      </div>
                    )}

                    {!adjacentContext.next && (
                      <div className="adj-boundary">End of document (no following chunk)</div>
                    )}
                  </div>
                ) : (
                  <div className="adjacent-loading">No adjacent chunks available.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCopy}>
            {copied ? "✓ Copied to Clipboard" : "📋 Copy Snippet"}
          </button>
          <a
            className="btn-primary"
            href={citation.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Source Webpage ↗
          </a>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(10, 15, 29, 0.72);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
          animation: fadeIn 0.15s ease-out;
        }

        .modal-card {
          width: 100%;
          max-width: 660px;
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg), 0 0 0 1px var(--border-subtle);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-subtle);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .cite-badge {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.8rem;
          font-weight: 700;
          color: var(--accent);
          background: var(--accent-subtle);
          padding: 0.2rem 0.55rem;
          border-radius: var(--radius-sm);
          border: 1px solid var(--accent-dim);
          letter-spacing: 0.02em;
        }

        .site-icon {
          border-radius: 4px;
        }

        .source-domain {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
        }

        .source-heading {
          margin: 0;
          font-size: 0.75rem;
          color: var(--text-muted);
          max-width: 360px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .close-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 1.1rem;
          cursor: pointer;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-md);
          transition: all 0.15s ease;
        }
        .close-btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        /* Telemetry Bar */
        .telemetry-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          gap: 12px;
        }

        .score-col {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .score-row {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
        }

        .score-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }
        .score-dot.high {
          background: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
        }
        .score-dot.medium {
          background: var(--accent);
          box-shadow: 0 0 6px var(--accent-dim);
        }
        .score-dot.fallback {
          background: #f59e0b;
          box-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
        }

        .score-text {
          color: var(--text-secondary);
        }
        .score-badge {
          font-size: 0.65rem;
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 600;
          font-family: var(--font-mono, monospace);
        }
        .score-badge.high {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .score-badge.medium {
          background: var(--accent-subtle);
          color: var(--accent);
          border: 1px solid var(--accent-dim);
        }
        .score-badge.fallback {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.25);
        }

        .score-progress-track {
          width: 100%;
          max-width: 180px;
          height: 4px;
          background: var(--border-subtle);
          border-radius: 2px;
          overflow: hidden;
        }
        .score-progress-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .score-progress-fill.high {
          background: #10b981;
        }
        .score-progress-fill.medium {
          background: var(--accent);
        }
        .score-progress-fill.fallback {
          background: #f59e0b;
        }

        .engine-meta-col {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .engine-pill {
          font-size: 0.68rem;
          color: var(--text-secondary);
          background: var(--bg-card);
          padding: 2px 7px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-default);
          font-weight: 500;
        }
        .chunk-id-text {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-family: var(--font-mono, ui-monospace, monospace);
        }

        /* Content Container */
        .content-container {
          padding: 1.25rem;
          max-height: 440px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .content-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .content-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
        }
        .matched-terms-hint {
          font-size: 0.68rem;
          color: #fbbf24;
          font-weight: 500;
        }

        .chunk-text {
          font-size: 0.85rem;
          line-height: 1.65;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-break: break-word;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 1rem 1.15rem;
          font-family: var(--font-sans);
        }

        :global(.kw-highlight) {
          background: rgba(245, 158, 11, 0.22);
          color: #fde047;
          padding: 1px 4px;
          border-radius: 3px;
          font-weight: 600;
        }

        /* Adjacent Context */
        .adjacent-context-box {
          border-top: 1px solid var(--border-subtle);
          padding-top: 0.65rem;
        }
        .adjacent-toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--accent);
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.15s ease;
        }
        .adjacent-toggle-btn:hover {
          color: var(--accent-hover);
        }
        .adjacent-subtext {
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 400;
        }
        .adjacent-content-panel {
          margin-top: 8px;
          padding: 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
        }
        .adjacent-loading {
          font-size: 0.74rem;
          color: var(--text-muted);
          font-style: italic;
          padding: 6px;
        }
        .adjacent-cards-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .adjacent-chunk-item {
          padding: 8px 12px;
          background: var(--bg-card);
          border-left: 2px solid var(--accent);
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-subtle);
          border-left: 2px solid var(--accent);
        }
        .adj-header {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-bottom: 4px;
        }
        .adj-tag {
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--accent);
        }
        .adj-heading {
          font-size: 0.68rem;
          color: var(--text-secondary);
        }
        .adj-body {
          margin: 0;
          font-size: 0.76rem;
          line-height: 1.5;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .adj-boundary {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-style: italic;
          padding: 2px 4px;
        }

        /* Footer */
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 0.85rem 1.25rem;
          border-top: 1px solid var(--border-subtle);
          background: var(--bg-subtle);
        }

        .btn-secondary {
          padding: 0.45rem 0.9rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          color: var(--text-secondary);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-secondary:hover {
          background: var(--bg-hover);
          border-color: var(--border-focus);
          color: var(--text-primary);
        }

        .btn-primary {
          padding: 0.45rem 1rem;
          background: var(--accent);
          border: 1px solid transparent;
          border-radius: var(--radius-md);
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          box-shadow: 0 1px 3px rgba(0, 102, 204, 0.3);
        }
        .btn-primary:hover {
          background: var(--accent-hover);
          box-shadow: 0 2px 6px rgba(0, 102, 204, 0.45);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleUp {
          from {
            transform: scale(0.97);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
