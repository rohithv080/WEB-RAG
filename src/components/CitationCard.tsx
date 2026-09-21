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
    <div
      className="cite-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
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
            <span>{isWebCitation ? "Click to open article ↗" : "Click to inspect verified context"}</span>
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
          padding: 0.28rem 0.55rem;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          color: #94a3b8;
          font-size: 0.74rem;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          text-align: left;
          user-select: none;
        }
        .cite-chip-web {
          border-color: rgba(6, 182, 212, 0.25);
          background: rgba(6, 182, 212, 0.04);
        }
        .cite-chip-web:hover {
          border-color: rgba(6, 182, 212, 0.5);
          background: rgba(6, 182, 212, 0.1);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 10px rgba(6, 182, 212, 0.2);
        }
        .cite-chip-web .cite-idx {
          color: #22d3ee;
        }
        .cite-web-tag {
          background: rgba(6, 182, 212, 0.12) !important;
          border-color: rgba(6, 182, 212, 0.3) !important;
          color: #22d3ee !important;
        }
        .cite-chip:hover {
          border-color: rgba(99, 102, 241, 0.4);
          color: #f1f5f9;
          background: rgba(99, 102, 241, 0.08);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3), 0 0 10px rgba(99, 102, 241, 0.15);
        }
        .cite-idx {
          font-family: var(--font-mono, monospace);
          color: #818cf8;
          font-weight: 700;
          font-size: 0.72rem;
          letter-spacing: -0.02em;
        }
        .cite-favicon {
          border-radius: 3px;
          flex-shrink: 0;
          opacity: 0.85;
        }
        .cite-label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 140px;
          font-weight: 500;
          color: #cbd5e1;
        }
        .cite-chip:hover .cite-label {
          color: #ffffff;
        }
        .cite-arrow {
          font-size: 0.65rem;
          color: #64748b;
          transition: transform 0.15s ease;
        }
        .cite-chip:hover .cite-arrow {
          color: #818cf8;
          transform: translate(1px, -1px);
        }

        /* Rich Floating Popover */
        .cite-popover {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 0;
          width: 290px;
          padding: 0.75rem 0.85rem;
          background: #11131a;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(99, 102, 241, 0.2);
          backdrop-filter: blur(16px);
          z-index: 100;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
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
          color: #94a3b8;
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
          border-radius: 999px;
          background: rgba(52, 211, 153, 0.12);
          border: 1px solid rgba(52, 211, 153, 0.25);
          color: #34d399;
          font-size: 0.65rem;
          font-weight: 600;
          font-family: var(--font-mono, monospace);
        }

        .cite-popover-title {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 600;
          color: #f8fafc;
          line-height: 1.35;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cite-popover-snippet {
          margin: 0;
          font-size: 0.74rem;
          line-height: 1.45;
          color: #94a3b8;
          font-style: italic;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          background: rgba(255, 255, 255, 0.02);
          padding: 0.35rem 0.5rem;
          border-radius: 6px;
          border-left: 2px solid #6366f1;
        }

        .cite-popover-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.65rem;
          color: #64748b;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          padding-top: 0.4rem;
          margin-top: 0.1rem;
        }
        .cite-popover-key {
          font-family: var(--font-mono, monospace);
          font-size: 0.62rem;
          padding: 1px 4px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 3px;
          color: #cbd5e1;
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
