"use client";

import { useEffect, useState, useMemo } from "react";

export type PageChunk = {
  id: string;
  order: number;
  heading: string | null;
  content: string;
  isBoilerplate: boolean;
};

type PageInfo = {
  id: string;
  siteId: string;
  url: string;
  title: string | null;
  scrapedAt: string;
};

type Props = {
  pageId: string;
  onBack: () => void;
  onToast: (message: string, type: "success" | "error" | "info") => void;
  onChunksUpdated?: () => Promise<void> | void;
};

export function ChunkExplorerView({ pageId, onBack, onToast, onChunksUpdated }: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [chunks, setChunks] = useState<PageChunk[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Fetch all chunks for this page
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/pages/${pageId}/chunks`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load chunks");
        if (isMounted) {
          setPageInfo(data.page);
          setChunks(data.chunks || []);
        }
      })
      .catch((err: any) => {
        if (isMounted) setError(err.message || "Failed to load chunks");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [pageId]);

  // Client-side instant filter
  const filteredChunks = useMemo(() => {
    if (!searchQuery.trim()) return chunks;
    const q = searchQuery.toLowerCase().trim();
    return chunks.filter(
      (c) =>
        c.content.toLowerCase().includes(q) ||
        (c.heading && c.heading.toLowerCase().includes(q)) ||
        `chunk #${c.order + 1}`.includes(q)
    );
  }, [chunks, searchQuery]);

  // Total metrics
  const totalChars = useMemo(() => chunks.reduce((acc, c) => acc + c.content.length, 0), [chunks]);
  const totalWords = useMemo(
    () => chunks.reduce((acc, c) => acc + c.content.split(/\s+/).filter(Boolean).length, 0),
    [chunks]
  );

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleCopyChunk(chunk: PageChunk) {
    navigator.clipboard.writeText(chunk.content);
    setCopiedId(chunk.id);
    onToast(`Chunk #${chunk.order + 1} copied to clipboard!`, "success");
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleDeleteChunk(chunkId: string, orderNum: number) {
    if (
      !confirm(
        `Are you sure you want to delete Chunk #${orderNum}? This removes it from pgvector search.`
      )
    ) {
      return;
    }
    setDeletingId(chunkId);
    try {
      const res = await fetch(`/api/chunks/${chunkId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete chunk");
      setChunks((prev) => prev.filter((c) => c.id !== chunkId));
      onToast(`Chunk #${orderNum} deleted!`, "info");
      if (onChunksUpdated) await onChunksUpdated();
    } catch (err: any) {
      onToast(err.message || "Could not delete chunk", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const isDocument = pageInfo?.url.startsWith("doc://");
  const displayTitle = pageInfo
    ? pageInfo.title || (isDocument ? pageInfo.url.replace("doc://", "") : pageInfo.url)
    : "Document Chunks";

  return (
    <div className="chunk-explorer-panel">
      {/* Top Navigation Bar */}
      <div className="chunk-nav-bar">
        <button
          type="button"
          className="chunk-back-btn"
          onClick={onBack}
          title="Return to sources list"
        >
          <span className="back-arrow">←</span>
          <span>Sources</span>
        </button>
        <span className="nav-divider">/</span>
        <span className="nav-current-title" title={displayTitle}>
          {displayTitle}
        </span>
      </div>

      {/* Page Header Summary */}
      {pageInfo && (
        <div className="page-summary-card">
          <div className="summary-title-row">
            <span className="doc-icon">{isDocument ? "📄" : "🌐"}</span>
            <div className="doc-text-col">
              <h4 className="doc-name">{displayTitle}</h4>
              <a
                href={isDocument ? undefined : pageInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="doc-link"
                title={pageInfo.url}
              >
                {pageInfo.url} {!isDocument && "↗"}
              </a>
            </div>
          </div>

          <div className="summary-badges-strip">
            <span className="badge-pill chunks-badge">
              <strong>{chunks.length}</strong> Chunks
            </span>
            <span className="badge-pill words-badge">
              ~<strong>{totalWords.toLocaleString()}</strong> words
            </span>
            <span className="badge-pill chars-badge">
              <strong>{(totalChars / 1000).toFixed(1)}k</strong> chars
            </span>
            <span className="badge-pill embed-badge">
              <strong>768-dim</strong> Nomic
            </span>
          </div>
        </div>
      )}

      {/* Search Filter Row */}
      <div className="chunk-search-row">
        <div className="search-input-box">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-field"
            placeholder="Search chunks by keyword or heading..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="clear-search-btn"
              onClick={() => setSearchQuery("")}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <span className="search-match-count">
            {filteredChunks.length} of {chunks.length}
          </span>
        )}
      </div>

      {/* Chunks List Canvas */}
      <div className="chunks-list-canvas">
        {loading ? (
          <div className="chunks-state-box">
            <span className="chunks-spinner">↻</span>
            <span>Fetching vectors and extracting chunks...</span>
          </div>
        ) : error ? (
          <div className="chunks-state-box error-box">
            <span>⚠️ {error}</span>
            <button type="button" className="retry-btn" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        ) : filteredChunks.length === 0 ? (
          <div className="chunks-state-box empty-box">
            <span>
              {searchQuery
                ? "No chunks match your search query."
                : "No chunks found for this source."}
            </span>
          </div>
        ) : (
          filteredChunks.map((chunk) => {
            const isExpanded = expandedIds.has(chunk.id);
            const needsClamp = chunk.content.length > 240;
            const wordCount = chunk.content.split(/\s+/).filter(Boolean).length;

            return (
              <div key={chunk.id} className="chunk-card">
                <div className="chunk-card-header">
                  <div className="header-left">
                    <span className="chunk-order-badge">#{chunk.order + 1}</span>
                    {chunk.heading ? (
                      <span className="chunk-heading-pill" title={chunk.heading}>
                        § {chunk.heading}
                      </span>
                    ) : (
                      <span className="chunk-heading-pill general">§ Passage</span>
                    )}
                  </div>
                  <div className="header-right">
                    <span className="chunk-metrics">
                      {wordCount}w • {chunk.content.length}c
                    </span>
                    <button
                      type="button"
                      className="chunk-action-btn copy-btn"
                      onClick={() => handleCopyChunk(chunk)}
                      title="Copy chunk text"
                    >
                      {copiedId === chunk.id ? "✓ Copied" : "⎘ Copy"}
                    </button>
                    <button
                      type="button"
                      className="chunk-action-btn delete-btn"
                      onClick={() => handleDeleteChunk(chunk.id, chunk.order + 1)}
                      disabled={deletingId === chunk.id}
                      title="Delete chunk from pgvector"
                    >
                      {deletingId === chunk.id ? "…" : "🗑️"}
                    </button>
                  </div>
                </div>

                <div className="chunk-text-box">
                  <p className={`chunk-content ${!isExpanded && needsClamp ? "clamped" : ""}`}>
                    {chunk.content}
                  </p>
                  {needsClamp && (
                    <button
                      type="button"
                      className="expand-toggle-btn"
                      onClick={() => toggleExpand(chunk.id)}
                    >
                      {isExpanded ? "Show less ↑" : "Show full text ↓"}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        .chunk-explorer-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: var(--bg-subtle);
        }

        /* Nav Bar */
        .chunk-nav-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: var(--bg-card);
          border-bottom: 1px solid var(--border-subtle);
          font-size: 0.78rem;
        }
        .chunk-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          padding: 3px 8px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 0.75rem;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .chunk-back-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-focus);
        }
        .nav-divider {
          color: var(--text-muted);
          font-size: 0.8rem;
        }
        .nav-current-title {
          color: var(--text-primary);
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }

        /* Page Summary Card */
        .page-summary-card {
          padding: 12px 14px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .summary-title-row {
          display: flex;
          align-items: flex-start;
          gap: 8px;
        }
        .doc-icon {
          font-size: 1.1rem;
          margin-top: 1px;
        }
        .doc-text-col {
          flex: 1;
          min-width: 0;
        }
        .doc-name {
          margin: 0;
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .doc-link {
          font-size: 0.7rem;
          color: var(--accent);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: inline-block;
          max-width: 100%;
        }
        .doc-link:hover {
          text-decoration: underline;
        }
        .summary-badges-strip {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .badge-pill {
          font-size: 0.68rem;
          padding: 2px 7px;
          border-radius: var(--radius-sm);
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
        }
        .badge-pill strong {
          color: var(--text-primary);
        }
        .chunks-badge {
          background: var(--accent-subtle);
          border-color: var(--accent-dim);
          color: var(--accent);
        }
        .embed-badge {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        /* Search Filter Row */
        .chunk-search-row {
          padding: 8px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-card);
        }
        .search-input-box {
          position: relative;
          flex: 1;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 8px;
          font-size: 0.72rem;
          pointer-events: none;
          opacity: 0.6;
        }
        .search-field {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 5px 24px 5px 26px;
          color: var(--text-primary);
          font-size: 0.76rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .search-field:focus {
          border-color: var(--accent);
        }
        .clear-search-btn {
          position: absolute;
          right: 6px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.7rem;
          cursor: pointer;
        }
        .clear-search-btn:hover {
          color: var(--text-primary);
        }
        .search-match-count {
          font-size: 0.7rem;
          color: var(--text-muted);
          white-space: nowrap;
        }

        /* Chunks List */
        .chunks-list-canvas {
          flex: 1;
          overflow-y: auto;
          padding: 10px 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Chunk Card */
        .chunk-card {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .chunk-card:hover {
          border-color: var(--border-focus);
          box-shadow: var(--shadow-sm);
        }

        .chunk-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 7px 10px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border-subtle);
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .chunk-order-badge {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--accent);
          background: var(--accent-subtle);
          border: 1px solid var(--accent-dim);
          padding: 1px 5px;
          border-radius: var(--radius-sm);
        }
        .chunk-heading-pill {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
        }
        .chunk-heading-pill.general {
          color: var(--text-muted);
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .chunk-metrics {
          font-size: 0.65rem;
          color: var(--text-muted);
          font-family: var(--font-mono, monospace);
        }
        .chunk-action-btn {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          color: var(--text-secondary);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          font-size: 0.68rem;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .chunk-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-focus);
        }
        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
          color: #ef4444;
        }

        .chunk-text-box {
          padding: 9px 10px;
        }
        .chunk-content {
          margin: 0;
          font-family: var(--font-mono, monospace);
          font-size: 0.75rem;
          line-height: 1.55;
          color: var(--text-secondary);
          white-space: pre-wrap;
          word-break: break-word;
        }
        .chunk-content.clamped {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .expand-toggle-btn {
          background: transparent;
          border: none;
          color: var(--accent);
          font-size: 0.7rem;
          font-weight: 600;
          padding: 4px 0 0 0;
          cursor: pointer;
        }
        .expand-toggle-btn:hover {
          text-decoration: underline;
        }

        /* States */
        .chunks-state-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 40px 10px;
          color: var(--text-muted);
          font-size: 0.78rem;
          text-align: center;
        }
        .chunks-spinner {
          font-size: 1.2rem;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        .error-box {
          color: #f87171;
        }
        .retry-btn {
          padding: 4px 10px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.74rem;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
