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
            {favicon && <img src={favicon} alt="" width={16} height={16} className="site-icon" />}
            <div>
              <h3 className="source-domain">{domain}</h3>
              <p className="source-heading">{citation.heading || "Extracted Section"}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
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
            <span className="engine-pill">Vector (Nomic-768) + BM25 Hybrid</span>
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
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: showAdjacentContext ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>
                {showAdjacentContext
                  ? "Hide Surrounding Context"
                  : "Show Surrounding Document Context"}
              </span>
              <span className="adjacent-subtext">(Preceding & succeeding chunks)</span>
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
                            Preceding Context (Chunk #{adjacentContext.prev.order + 1})
                          </span>
                          {adjacentContext.prev.heading && (
                            <span className="adj-heading">{adjacentContext.prev.heading}</span>
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
                            Succeeding Context (Chunk #{adjacentContext.next.order + 1})
                          </span>
                          {adjacentContext.next.heading && (
                            <span className="adj-heading">{adjacentContext.next.heading}</span>
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
            {copied ? (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>Copy Snippet</span>
              </>
            )}
          </button>
          <a
            className="btn-primary"
            href={citation.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Open Source Webpage</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </a>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
          animation: fadeIn 0.15s ease-out;
        }

        .modal-card {
          width: 100%;
          max-width: 620px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-surface);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .cite-badge {
          font-family: monospace;
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--accent);
          background: var(--bg-card);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
        }

        .site-icon {
          border-radius: var(--radius-micro);
        }

        .source-domain {
          margin: 0;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }

        .source-heading {
          margin: 0;
          font-size: 0.72rem;
          color: var(--text-muted);
          max-width: 360px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .close-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          cursor: pointer;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
        }
        .close-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        /* Telemetry Bar */
        .telemetry-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border);
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
          font-size: 0.74rem;
        }

        .score-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .score-dot.high {
          background: #22c55e;
        }
        .score-dot.medium {
          background: var(--accent);
        }
        .score-dot.fallback {
          background: #888888;
        }

        .score-text {
          color: var(--text-secondary);
        }
        .score-badge {
          font-size: 0.65rem;
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          font-weight: 500;
          font-family: monospace;
          background: var(--bg-hover);
          border: 1px solid var(--border);
          color: var(--text-secondary);
        }

        .score-progress-track {
          width: 100%;
          max-width: 160px;
          height: 3px;
          background: var(--border);
          border-radius: 2px;
          overflow: hidden;
        }
        .score-progress-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
          background: var(--accent);
        }

        .engine-meta-col {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .engine-pill {
          font-size: 0.68rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
          font-weight: 500;
        }
        .chunk-id-text {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        /* Content Container */
        .content-container {
          padding: 16px;
          max-height: 420px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .content-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .content-label {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .matched-terms-hint {
          font-size: 0.68rem;
          color: var(--accent);
          font-weight: 500;
        }

        .chunk-text {
          font-size: 0.82rem;
          line-height: 1.6;
          color: var(--text-primary);
          white-space: pre-wrap;
          word-break: break-word;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 14px;
          font-family: inherit;
        }

        :global(.kw-highlight) {
          background: rgba(37, 99, 235, 0.2);
          color: var(--accent);
          padding: 1px 4px;
          border-radius: 2px;
          font-weight: 500;
        }

        /* Adjacent Context */
        .adjacent-context-box {
          border-top: 1px solid var(--border);
          padding-top: 10px;
        }
        .adjacent-toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 0;
          transition: color 0.15s ease;
        }
        .adjacent-toggle-btn:hover {
          color: var(--text-primary);
        }
        .adjacent-subtext {
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 400;
        }
        .adjacent-content-panel {
          margin-top: 8px;
          padding: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
        }
        .adjacent-loading {
          font-size: 0.74rem;
          color: var(--text-muted);
          padding: 6px;
        }
        .adjacent-cards-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .adjacent-chunk-item {
          padding: 8px 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
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
          padding: 2px 4px;
        }

        /* Footer */
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 16px;
          border-top: 1px solid var(--border);
          background: var(--bg-surface);
        }

        .btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          color: var(--text-secondary);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .btn-secondary:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: var(--accent);
          border: 1px solid transparent;
          border-radius: var(--radius);
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s ease;
        }
        .btn-primary:hover {
          background: var(--accent-hover);
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
