"use client";

export function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-icon-wrap">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="empty-svg">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      </div>
      <h2 className="empty-title">No bots created</h2>
      <p className="empty-sub">
        Index your first website or upload documents to get started. Scrape any page, and your assistant will be ready to answer questions.
      </p>

      <style jsx>{`
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem 2rem;
        }
        .empty-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: var(--radius);
          background: var(--bg-card);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
          border: 1px solid var(--border);
          color: var(--text-muted);
        }
        .empty-svg {
          color: var(--text-muted);
        }
        .empty-title {
          margin: 0 0 0.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .empty-sub {
          margin: 0;
          font-size: 0.84rem;
          color: var(--text-muted);
          max-width: 380px;
          line-height: 1.55;
        }
      `}</style>
    </div>
  );
}
