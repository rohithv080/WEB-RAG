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
  const scoreTier =
    relevancePct >= 80 ? "high" : relevancePct >= 60 ? "medium" : "fallback";

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
                {scoreTier === "high" ? "High Relevance" : scoreTier === "medium" ? "Strong Match" : "Semantic Candidate"}
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

          <div className="chunk-text">
            {highlightedSnippet}
          </div>

          {/* Adjacent Surrounding Context Section */}
          <div className="adjacent-context-box">
            <button
              type="button"
              className="adjacent-toggle-btn"
              onClick={() => setShowAdjacentContext((v) => !v)}
            >
              <span>{showAdjacentContext ? "▾ Hide Surrounding Context" : "▸ Show Surrounding Document Context"}</span>
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
                          <span className="adj-tag">← Preceding Context (Chunk #{adjacentContext.prev.order + 1})</span>
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
                          <span className="adj-tag">Succeeding Context (Chunk #{adjacentContext.next.order + 1}) →</span>
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
          background: rgba(0, 0, 0, 0.75);
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
          max-width: 640px;
          background: #0d0e15;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          box-shadow: 0 24px 56px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.06);
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .cite-badge {
          font-family: ui-monospace, monospace;
          font-size: 0.85rem;
          font-weight: 700;
          color: #7c7cff;
          background: rgba(124, 124, 255, 0.12);
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          border: 1px solid rgba(124, 124, 255, 0.25);
        }

        .site-icon {
          border-radius: 4px;
        }

        .source-domain {
          margin: 0;
          font-size: 0.92rem;
          font-weight: 600;
          color: #f3f4f6;
        }

        .source-heading {
          margin: 0;
          font-size: 0.75rem;
          color: #9ca3af;
          max-width: 360px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 1.1rem;
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.12s ease;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        /* Telemetry Bar */
        .telemetry-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          background: rgba(0, 0, 0, 0.35);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
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
          box-shadow: 0 0 8px #10b981;
        }
        .score-dot.medium {
          background: #6366f1;
          box-shadow: 0 0 8px #6366f1;
        }
        .score-dot.fallback {
          background: #f59e0b;
          box-shadow: 0 0 8px #f59e0b;
        }

        .score-text {
          color: #e4e4e7;
        }
        .score-badge {
          font-size: 0.65rem;
          padding: 1px 5px;
          border-radius: 4px;
          font-weight: 500;
        }
        .score-badge.high {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
        }
        .score-badge.medium {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
        }
        .score-badge.fallback {
          background: rgba(245, 158, 11, 0.15);
          color: #fcd34d;
        }

        .score-progress-track {
          width: 100%;
          max-width: 180px;
          height: 4px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 2px;
          overflow: hidden;
        }
        .score-progress-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
        .score-progress-fill.high { background: #10b981; }
        .score-progress-fill.medium { background: #6366f1; }
        .score-progress-fill.fallback { background: #f59e0b; }

        .engine-meta-col {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .engine-pill {
          font-size: 0.68rem;
          color: #a1a1aa;
          background: rgba(255, 255, 255, 0.04);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.07);
        }
        .chunk-id-text {
          font-size: 0.65rem;
          color: #71717a;
          font-family: ui-monospace, monospace;
        }

        /* Content Container */
        .content-container {
          padding: 1rem 1.25rem;
          max-height: 420px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .content-header-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .content-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #8a8f98;
        }
        .matched-terms-hint {
          font-size: 0.68rem;
          color: #fbbf24;
        }

        .chunk-text {
          font-size: 0.85rem;
          line-height: 1.6;
          color: #e5e7eb;
          white-space: pre-wrap;
          word-break: break-word;
          background: #11121a;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 1rem;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }

        :global(.kw-highlight) {
          background: rgba(245, 158, 11, 0.25);
          color: #fef08a;
          padding: 1px 3px;
          border-radius: 3px;
          font-weight: 600;
        }

        /* Adjacent Context */
        .adjacent-context-box {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 0.5rem;
        }
        .adjacent-toggle-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          border: none;
          color: #a78bfa;
          font-size: 0.76rem;
          font-weight: 500;
          cursor: pointer;
          padding: 4px 0;
        }
        .adjacent-toggle-btn:hover {
          color: #c4b5fd;
        }
        .adjacent-subtext {
          color: #71717a;
          font-size: 0.7rem;
          font-weight: 400;
        }
        .adjacent-content-panel {
          margin-top: 8px;
          padding: 8px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 6px;
        }
        .adjacent-loading {
          font-size: 0.74rem;
          color: #8a8f98;
          font-style: italic;
          padding: 6px;
        }
        .adjacent-cards-col {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .adjacent-chunk-item {
          padding: 8px 10px;
          background: rgba(255, 255, 255, 0.03);
          border-left: 2px solid #7c7cff;
          border-radius: 4px;
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
          color: #7c7cff;
        }
        .adj-heading {
          font-size: 0.68rem;
          color: #a1a1aa;
        }
        .adj-body {
          margin: 0;
          font-size: 0.76rem;
          line-height: 1.45;
          color: #9ca3af;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .adj-boundary {
          font-size: 0.7rem;
          color: #71717a;
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
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .btn-secondary {
          padding: 0.45rem 0.85rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #d1d5db;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .btn-primary {
          padding: 0.45rem 0.95rem;
          background: #7c7cff;
          border: none;
          border-radius: 6px;
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.12s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .btn-primary:hover {
          background: #6a6aff;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
