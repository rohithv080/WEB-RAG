"use client";

export function Skeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton-card">
          <div className="skeleton-row">
            <div className="skeleton skeleton-avatar" />
            <div className="skeleton-badges">
              <div className="skeleton skeleton-badge" />
              <div className="skeleton skeleton-badge" />
            </div>
          </div>
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-line" />
          <div className="skeleton-row" style={{ marginTop: "auto" }}>
            <div className="skeleton skeleton-dot" />
            <div className="skeleton skeleton-btn" />
          </div>
        </div>
      ))}

      <style jsx>{`
        .skeleton-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1rem;
        }
        .skeleton-card {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.25rem;
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          min-height: 180px;
        }
        .skeleton-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .skeleton-badges {
          display: flex;
          gap: 0.3rem;
        }
        .skeleton-avatar {
          width: 42px;
          height: 42px;
          border-radius: 10px;
        }
        .skeleton-badge {
          width: 60px;
          height: 22px;
          border-radius: 99px;
        }
        .skeleton-title {
          width: 65%;
          height: 18px;
        }
        .skeleton-line {
          width: 90%;
          height: 14px;
        }
        .skeleton-dot {
          width: 80px;
          height: 14px;
        }
        .skeleton-btn {
          width: 70px;
          height: 34px;
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
}
