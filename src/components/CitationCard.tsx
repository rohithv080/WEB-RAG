"use client";

import { useState, useRef } from "react";
import { SourceInspectModal } from "./SourceInspectModal";

export type Citation = {
  index: number;
  chunkId: string;
  heading: string | null;
  snippet: string;
  score: number;
  pageUrl: string;
  isWeb?: boolean;
};

type Props = {
  citation: Citation;
  query?: string;
};

export function CitationCard({ citation, query }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isWebCitation = citation.chunkId?.startsWith("web-") || citation.isWeb;

  const handleClick = () => {
    setIsHovered(false);
    if (isWebCitation && citation.pageUrl) {
      window.open(citation.pageUrl, "_blank", "noopener,noreferrer");
    } else {
      setShowModal(true);
    }
  };

  const domain = (() => {
    try {
      return new URL(citation.pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return citation.pageUrl;
    }
  })();

  const displayTitle = (() => {
    if (citation.heading && citation.heading.trim()) {
      return citation.heading.trim();
    }
    try {
      const url = new URL(citation.pageUrl);
      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts.length > 0) {
        const last = pathParts[pathParts.length - 1]
          .replace(/[-_]/g, " ")
          .replace(/\.[a-zA-Z0-9]+$/, "");
        if (last.length > 1) {
          return last.charAt(0).toUpperCase() + last.slice(1);
        }
      }
      return domain;
    } catch {
      return domain;
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

  const matchPercent = Math.min(99, Math.max(70, Math.round(citation.score * 100)));

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 120);
  };

  return (
    <div className="cite-wrapper" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <button
        type="button"
        className={`cite-chip ${isWebCitation ? "cite-chip-web" : ""}`}
        onClick={handleClick}
        title={
          isWebCitation
            ? `[${citation.index}] ${displayTitle} — Click to open external webpage`
            : `[${citation.index}] ${displayTitle} — Click to inspect source passage`
        }
      >
        <span className="cite-idx">[{citation.index}]</span>
        {favicon && (
          <img
            src={favicon}
            alt=""
            width={13}
            height={13}
            className="cite-favicon"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        )}
        <span className="cite-label">{displayTitle}</span>
        <span className="cite-arrow">↗</span>
      </button>

      {/* Floating Rich Popover Preview on Hover */}
      {isHovered && (
        <div className="cite-popover" onClick={handleClick}>
          <div className="cite-popover-header">
            <div className="cite-popover-meta">
              {favicon && (
                <img
                  src={favicon}
                  alt=""
                  width={14}
                  height={14}
                  className="cite-popover-favicon"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                  }}
                />
              )}
              <span className="cite-popover-domain">{domain}</span>
            </div>
            <span className={`cite-match-badge ${isWebCitation ? "cite-web-tag" : ""}`}>
              {isWebCitation ? "🌐 Web Search" : `${matchPercent}% match`}
            </span>
          </div>

          <h5 className="cite-popover-title">{displayTitle}</h5>

          <p className="cite-popover-snippet">
            &ldquo;{citation.snippet.slice(0, 180).trim()}&hellip;&rdquo;
          </p>

          <div className="cite-popover-footer">
            <span>
              {isWebCitation ? "Click to open article ↗" : "Click to inspect verified context"}
            </span>
            <span className="cite-popover-key">{isWebCitation ? "Open URL" : "Space / ⏎"}</span>
          </div>
        </div>
      )}

      {showModal && !isWebCitation && (
        <SourceInspectModal citation={citation} query={query} onClose={() => setShowModal(false)} />
      )}

      <style jsx>{`
        .cite-wrapper {
          position: relative;
          display: inline-flex;
        }

        .cite-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.55rem;
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          color: var(--text-secondary);
          font-size: 0.74rem;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: left;
          user-select: none;
        }
        .cite-chip-web {
          border-color: rgba(6, 182, 212, 0.3);
          background: rgba(6, 182, 212, 0.06);
        }
        .cite-chip-web:hover {
          border-color: rgba(6, 182, 212, 0.6);
          background: rgba(6, 182, 212, 0.12);
          box-shadow: 0 2px 8px rgba(6, 182, 212, 0.2);
        }
        .cite-chip-web .cite-idx {
          color: #06b6d4;
        }
        .cite-web-tag {
          background: rgba(6, 182, 212, 0.12) !important;
          border-color: rgba(6, 182, 212, 0.3) !important;
          color: #06b6d4 !important;
        }
        .cite-chip:hover {
          border-color: var(--accent);
          color: var(--text-primary);
          background: var(--accent-subtle);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px var(--accent-dim);
        }
        .cite-idx {
          font-family: var(--font-mono, monospace);
          color: var(--accent);
          font-weight: 700;
          font-size: 0.72rem;
          letter-spacing: -0.01em;
        }
        .cite-favicon {
          border-radius: 3px;
          flex-shrink: 0;
          opacity: 0.9;
        }
        .cite-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .cite-chip:hover .cite-label {
          color: var(--text-primary);
        }
        .cite-arrow {
          font-size: 0.65rem;
          color: var(--text-muted);
          transition: transform 0.15s ease;
        }
        .cite-chip:hover .cite-arrow {
          color: var(--accent);
          transform: translate(1px, -1px);
        }

        /* Rich Floating Popover */
        .cite-popover {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          width: 300px;
          padding: 0.85rem 0.95rem;
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-lg), 0 0 0 1px var(--border-subtle);
          backdrop-filter: blur(12px);
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          cursor: pointer;
          animation: popoverFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .cite-popover-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.7rem;
        }
        .cite-popover-meta {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--text-muted);
        }
        .cite-popover-favicon {
          border-radius: 2px;
        }
        .cite-popover-domain {
          font-weight: 500;
          font-size: 0.68rem;
          letter-spacing: 0.01em;
        }
        .cite-match-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 4px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #10b981;
          font-size: 0.65rem;
          font-weight: 600;
          font-family: var(--font-mono, monospace);
        }

        .cite-popover-title {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cite-popover-snippet {
          margin: 0;
          font-size: 0.74rem;
          line-height: 1.5;
          color: var(--text-secondary);
          font-style: italic;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          background: var(--bg-surface);
          padding: 0.4rem 0.6rem;
          border-radius: var(--radius-sm);
          border-left: 2px solid var(--accent);
        }

        .cite-popover-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.65rem;
          color: var(--text-muted);
          border-top: 1px solid var(--border-subtle);
          padding-top: 0.4rem;
          margin-top: 0.1rem;
        }
        .cite-popover-key {
          font-family: var(--font-mono, monospace);
          font-size: 0.62rem;
          padding: 1px 5px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: 3px;
          color: var(--text-secondary);
        }

        @keyframes popoverFadeIn {
          from {
            opacity: 0;
            transform: translateY(4px) scale(0.97);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}
