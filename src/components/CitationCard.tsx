"use client";

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
  const domain = (() => {
    try {
      return new URL(citation.pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return citation.pageUrl;
    }
  })();

  return (
    <aside className="cite">
      <header className="cite-head">
        <span className="cite-idx">[{citation.index}]</span>
        <span className="cite-heading">{citation.heading || "Untitled section"}</span>
        <span className="cite-score">{(citation.score * 100).toFixed(0)}%</span>
      </header>
      <p className="cite-snippet">{citation.snippet}</p>
      <a
        className="cite-source"
        href={citation.pageUrl}
        target="_blank"
        rel="noopener noreferrer"
        title={citation.pageUrl}
      >
        ↗ {domain}
      </a>

      <style jsx>{`
        .cite {
          border-left: 2px solid var(--accent-dim);
          padding: 0.45rem 0 0.45rem 0.75rem;
          margin: 0;
        }
        .cite-head {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 0.25rem;
        }
        .cite-idx {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--accent);
          font-weight: 500;
        }
        .cite-heading {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text);
        }
        .cite-score {
          margin-left: auto;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .cite-snippet {
          margin: 0 0 0.35rem;
          font-size: 0.8rem;
          color: var(--text-muted);
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .cite-source {
          display: inline-block;
          font-size: 0.72rem;
          font-family: var(--font-mono);
          color: var(--accent);
          text-decoration: none;
          opacity: 0.8;
          transition: opacity 0.1s ease;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cite-source:hover {
          opacity: 1;
          text-decoration: underline;
        }
      `}</style>
    </aside>
  );
}
