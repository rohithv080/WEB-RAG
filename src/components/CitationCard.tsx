"use client";

import { useState } from "react";

export type Citation = {
  index: number;
  chunkId: string;
  heading: string | null;
  snippet: string;
  score: number;
  pageUrl: string;
};

type Props = {
  citation: Citation;
};

export function CitationCard({ citation }: Props) {
  const [expanded, setExpanded] = useState(false);

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
      return `https://www.google.com/s2/favicons?domain=${host}&sz=16`;
    } catch {
      return null;
    }
  })();

  return (
    <button className="cite-chip" onClick={() => setExpanded(!expanded)}>
      <span className="cite-idx">[{citation.index}]</span>
      {favicon && (
        <img src={favicon} alt="" width={14} height={14} style={{ borderRadius: 2, flexShrink: 0 }} />
      )}
      <span className="cite-domain">{domain}</span>

      {expanded && (
        <div className="cite-expanded" onClick={(e) => e.stopPropagation()}>
          <p className="cite-heading">{citation.heading || "Untitled"}</p>
          <p className="cite-snippet">{citation.snippet}</p>
          <a
            className="cite-link"
            href={citation.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            ↗ Open source
          </a>
        </div>
      )}

      <style jsx>{`
        .cite-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.6rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted);
          font-size: 0.72rem;
          cursor: pointer;
          transition: all 0.12s ease;
          position: relative;
          text-align: left;
        }
        .cite-chip:hover {
          border-color: var(--accent-dim);
          color: var(--accent);
          background: var(--accent-soft);
        }
        .cite-idx {
          font-family: var(--font-mono);
          color: var(--accent);
          font-weight: 600;
          font-size: 0.7rem;
        }
        .cite-domain {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 120px;
        }

        .cite-expanded {
          position: absolute;
          bottom: calc(100% + 6px);
          left: 0;
          width: 280px;
          padding: 0.75rem;
          background: var(--bg-elevated);
          backdrop-filter: blur(12px);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          animation: fadeUp 0.15s ease;
          z-index: 10;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .cite-heading {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text);
        }
        .cite-snippet {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cite-link {
          font-size: 0.72rem;
          font-family: var(--font-mono);
          color: var(--accent);
          text-decoration: none;
        }
        .cite-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </button>
  );
}
