"use client";

export type PageSummary = {
  id: string;
  url: string;
  title: string | null;
  scrapedAt: string;
  chunkCount: number;
};

export type SiteSummary = {
  id: string;
  name: string;
  description: string | null;
  systemPrompt?: string | null;
  starterQuestions?: string[] | null;
  tone?: "concise" | "balanced" | "detailed" | null;
  isPublic?: boolean;
  userId?: string | null;
  autoSync?: boolean;
  syncFrequency?: string | null;
  lastSyncedAt?: string | null;
  sourceUrl?: string | null;
  enableWebSearch?: boolean;
  scrapedAt: string;
  lastScrapedAt: string;
  latestSessionId: string | null;
  totalChunks: number;
  pages: PageSummary[];
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function getFavicon(pages: PageSummary[]): string | null {
  try {
    if (!pages[0]) return null;
    const domain = new URL(pages[0].url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

// ── Component ───────────────────────────────────────────────────────────

export type BotCardProps = {
  site: SiteSummary;
  onClick: () => void;
  onDelete?: (id: string) => void;
  onEmbed?: (site: SiteSummary) => void;
  onSettings?: (site: SiteSummary) => void;
  onAnalytics?: (site: SiteSummary) => void;
};

export function BotCard({
  site,
  onClick,
  onDelete,
  onEmbed,
  onSettings,
  onAnalytics,
}: BotCardProps) {
  const abbr = initials(site.name) || "KB";
  const favicon = getFavicon(site.pages);
  const updated = relativeTime(site.lastScrapedAt);

  return (
    <article className="bot-card" onClick={onClick}>
      {/* Top row: Avatar + Title + Status Pill */}
      <div className="card-header">
        <div className="card-avatar-group">
          <div className="card-avatar">
            {favicon ? (
              <img src={favicon} alt="" width={16} height={16} className="avatar-img" />
            ) : (
              <span className="avatar-abbr">{abbr}</span>
            )}
          </div>
          <div className="card-title-box">
            <h3 className="card-title">{site.name}</h3>
            <span className="card-meta-line">
              {site.pages.length} {site.pages.length === 1 ? "source" : "sources"} &middot;{" "}
              {site.totalChunks.toLocaleString()} chunks
            </span>
          </div>
        </div>

        {/* Single restrained status indicator (dot + text, no filled colorful pills) */}
        <div className="card-status-indicator">
          {site.autoSync ? (
            <span className="status-dot-indicator" title="Automated sync active">
              <span className="status-dot status-dot-live" />
              <span>Auto-sync</span>
            </span>
          ) : site.enableWebSearch !== false ? (
            <span className="status-dot-indicator" title="Live web search enabled">
              <span className="status-dot status-dot-live" />
              <span>Web</span>
            </span>
          ) : site.isPublic === false ? (
            <span className="status-dot-indicator" title="Private workspace">
              <span className="status-dot status-dot-idle" />
              <span>Private</span>
            </span>
          ) : (
            <span className="status-dot-indicator" title="Indexed and ready">
              <span className="status-dot status-dot-live" />
              <span>Ready</span>
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="card-desc">
        {site.description ||
          (site.pages[0]?.title
            ? `Indexed knowledge from ${site.pages[0].title}.`
            : "Autonomous knowledge base ready for retrieval and citations.")}
      </p>

      {/* Footer bar */}
      <div className="card-footer">
        <span className="card-timestamp" title={`Last indexed: ${site.lastScrapedAt}`}>
          Updated {updated}
        </span>

        <div className="card-actions" onClick={(e) => e.stopPropagation()}>
          <div className="secondary-actions-group">
            {onAnalytics && (
              <button
                type="button"
                className="action-icon-btn"
                onClick={() => onAnalytics(site)}
                title="Query Analytics & Logs"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              </button>
            )}

            {onEmbed && (
              <button
                type="button"
                className="action-icon-btn"
                onClick={() => onEmbed(site)}
                title="Get Embed Widget"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
              </button>
            )}

            {onSettings && (
              <button
                type="button"
                className="action-icon-btn"
                onClick={() => onSettings(site)}
                title="Bot Settings & Persona"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                className="action-icon-btn action-danger"
                onClick={() => onDelete(site.id)}
                title="Delete Knowledge Base"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
            )}
          </div>

          <button type="button" className="action-chat-btn" onClick={onClick}>
            <span>Open</span>
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </div>

      <style jsx>{`
        .bot-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 16px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          cursor: pointer;
          transition: border-color var(--transition-fast), background-color var(--transition-fast);
        }

        .bot-card:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-hover);
        }

        /* ── Header ─────────────────────────────────────────────── */
        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
        }

        .card-avatar-group {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .card-avatar {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-xs);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-img {
          border-radius: 2px;
        }

        .avatar-abbr {
          color: var(--text-secondary);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .card-title-box {
          min-width: 0;
        }

        .card-title {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-meta-line {
          font-size: 12px;
          color: var(--text-muted);
          font-family: var(--font-mono);
          margin-top: 1px;
          display: block;
        }

        .card-status-indicator {
          flex-shrink: 0;
          padding-top: 2px;
        }

        /* ── Description ────────────────────────────────────────── */
        .card-desc {
          margin: 0;
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 38px;
        }

        /* ── Footer ─────────────────────────────────────────────── */
        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 12px;
          border-top: 1px solid var(--border-subtle);
          gap: 8px;
        }

        .card-timestamp {
          font-size: 12px;
          color: var(--text-muted);
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .secondary-actions-group {
          display: flex;
          align-items: center;
          gap: 2px;
          opacity: 0.8;
          transition: opacity var(--transition-fast);
        }
        .bot-card:hover .secondary-actions-group {
          opacity: 1;
        }

        .action-icon-btn {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-xs);
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }

        .action-icon-btn:hover {
          color: var(--text-primary);
          background: var(--bg-surface);
          border-color: var(--border);
        }

        .action-danger:hover {
          color: var(--status-error);
          background: var(--status-error-subtle);
          border-color: var(--status-error-border);
        }

        .action-chat-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          height: 26px;
          padding: 0 10px;
          border-radius: var(--radius-xs);
          border: 1px solid transparent;
          background: var(--accent);
          color: #ffffff;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }

        .action-chat-btn:hover {
          background: var(--accent-hover);
        }
      `}</style>
    </article>
  );
}
