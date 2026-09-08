"use client";

export function EmptyState() {
  return (
    <div className="empty">
      <div className="empty-icon-wrap">
        <span className="empty-icon">⚡</span>
      </div>
      <h2 className="empty-title">No bots yet</h2>
      <p className="empty-sub">
        Add your first website to get started. Scrape any page, and your AI bot will be ready to answer questions about it.
      </p>

      <style jsx>{`
        .empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 4rem 2rem;
          animation: fadeUp 0.5s ease both;
        }
        .empty-icon-wrap {
          width: 80px;
          height: 80px;
          border-radius: 20px;
          background: var(--accent-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(61, 156, 240, 0.15);
        }
        .empty-icon {
          font-size: 2.5rem;
          filter: drop-shadow(0 0 12px var(--accent-glow));
        }
        .empty-title {
          margin: 0 0 0.5rem;
          font-size: 1.4rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .empty-sub {
          margin: 0;
          font-size: 0.92rem;
          color: var(--text-muted);
          max-width: 360px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  );
}
