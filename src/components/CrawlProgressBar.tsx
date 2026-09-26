"use client";

export type CrawlProgressState = {
  current: number;
  total: number;
  stage: "discovering" | "indexing" | "complete";
  currentUrl?: string;
  percent: number;
  itemType?: "page" | "chunk";
  customLabel?: string;
};

type Props = {
  progress: CrawlProgressState;
  compact?: boolean;
};

export function CrawlProgressBar({ progress, compact = false }: Props) {
  const isDiscovering = progress.stage === "discovering";
  const itemType = progress.itemType || "page";

  const label = progress.customLabel
    ? progress.customLabel
    : isDiscovering
      ? "Discovering internal page links…"
      : `Indexing ${itemType} ${progress.current} of ${progress.total}`;

  return (
    <div className={`crawl-progress-card ${compact ? "compact" : ""}`}>
      <div className="progress-top-row">
        <div className="progress-status-group">
          <span className={`pulse-indicator ${isDiscovering ? "pulse-amber" : "pulse-violet"}`} />
          <span className="progress-status-label">{label}</span>
        </div>
        <span className="progress-percentage">
          {isDiscovering ? "Scanning" : `${progress.percent}%`}
        </span>
      </div>

      <div className="progress-track">
        <div
          className={`progress-fill ${isDiscovering ? "fill-indeterminate" : ""}`}
          style={isDiscovering ? undefined : { width: `${Math.max(progress.percent, 4)}%` }}
        />
      </div>

      {!compact && progress.currentUrl && !isDiscovering && (
        <div className="progress-url-row" title={progress.currentUrl}>
          <span className="url-prefix">Current:</span>
          <code className="url-code">{progress.currentUrl}</code>
        </div>
      )}

      <div className="progress-footer-badge">
        <span>🛡️ Vercel Timeout Safe • Client-Driven Chunked Batching</span>
      </div>

      <style jsx>{`
        .crawl-progress-card {
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
          padding: 0.75rem 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.5rem;
          box-shadow: var(--shadow-sm);
          animation: fadeIn 0.2s ease-out;
        }

        .crawl-progress-card.compact {
          padding: 0.55rem 0.7rem;
          gap: 0.35rem;
        }

        .progress-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.8rem;
        }

        .progress-status-group {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .pulse-indicator {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .pulse-violet {
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent-dim);
          animation: pulseGlow 1.5s infinite;
        }

        .pulse-amber {
          background: #f59e0b;
          box-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
          animation: pulseGlow 1.2s infinite;
        }

        .progress-status-label {
          color: var(--text-primary);
          font-weight: 500;
        }

        .progress-percentage {
          font-family: var(--font-mono, monospace);
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--accent);
        }

        .progress-track {
          width: 100%;
          height: 6px;
          background: var(--border-subtle);
          border-radius: 9999px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 9999px;
          transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 8px var(--accent-dim);
        }

        .fill-indeterminate {
          width: 40% !important;
          animation: indeterminateMove 1.4s infinite ease-in-out;
        }

        .progress-url-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.7rem;
          color: var(--text-muted);
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
        }

        .url-prefix {
          flex-shrink: 0;
          color: var(--text-muted);
        }

        .url-code {
          font-family: var(--font-mono, monospace);
          color: var(--text-secondary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .progress-footer-badge {
          font-size: 0.65rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.3rem;
          font-weight: 500;
        }

        @keyframes pulseGlow {
          0%,
          100% {
            opacity: 1;
            transform: scale(1);
          }
          50% {
            opacity: 0.5;
            transform: scale(0.9);
          }
        }

        @keyframes indeterminateMove {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(350%);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
