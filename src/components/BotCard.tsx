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

        {/* Minimal status indicator */}
        <div className="card-badge-row">
          {site.isPublic === false && (
            <span className="status-chip chip-private" title="Private workspace">
              Private
            </span>
          )}
          {site.enableWebSearch !== false && (
            <span className="status-chip chip-web" title="Web search fallback enabled">
              Web Grounded
            </span>
          )}
          {site.autoSync && (
            <span className="status-chip chip-sync" title="Auto-sync active">
              Auto-Sync
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
          {onAnalytics && (
            <button
              type="button"
              className="action-icon-btn"
              onClick={() => onAnalytics(site)}
              title="Query Analytics & Logs"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
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
              title="Delete Bot"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}

          <button type="button" className="action-chat-btn" onClick={onClick}>
            <span>Open</span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
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
          gap: 0.85rem;
          padding: 1.2rem 1.25rem 1.1rem;
          background: #0d0d10;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          cursor: pointer;
          transition:
            border-color 0.15s ease,
            background 0.15s ease;
        }

        .bot-card:hover {
          background: #111115;
          border-color: rgba(255, 255, 255, 0.18);
        }

        /* ── Header ─────────────────────────────────────────────── */
        .card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .card-avatar-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          min-width: 0;
        }

        .card-avatar {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: #16161c;
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-img {
          border-radius: 4px;
        }

        .avatar-abbr {
          color: #f4f4f5;
          font-size: 0.76rem;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .card-title-box {
          min-width: 0;
        }

        .card-title {
          margin: 0;
          font-size: 0.94rem;
          font-weight: 600;
          color: #fafafa;
          letter-spacing: -0.015em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .card-meta-line {
          font-size: 0.74rem;
          color: #71717a;
        }

        .card-badge-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-shrink: 0;
        }

        .status-chip {
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-size: 0.68rem;
          font-weight: 500;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #a1a1aa;
        }

        .chip-web {
          color: #60a5fa;
          background: rgba(37, 99, 235, 0.08);
          border-color: rgba(37, 99, 235, 0.2);
        }

        .chip-sync {
          color: #34d399;
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .chip-private {
          color: #f87171;
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* ── Description ────────────────────────────────────────── */
        .card-desc {
          margin: 0;
          font-size: 0.82rem;
          color: #a1a1aa;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 2.45rem;
        }

        /* ── Footer ─────────────────────────────────────────────── */
        .card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.65rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          gap: 0.5rem;
        }

        .card-timestamp {
          font-size: 0.74rem;
          color: #71717a;
        }

        .card-actions {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .action-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 5px;
          border: 1px solid rgba(255, 255, 255, 0.07);
          background: rgba(255, 255, 255, 0.02);
          color: #a1a1aa;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .action-icon-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .action-danger:hover {
          color: #f87171;
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.25);
        }

        .action-chat-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.65rem;
          border-radius: 5px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: #f4f4f5;
          color: #09090b;
          font-size: 0.76rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.12s ease;
          margin-left: 0.25rem;
        }

        .action-chat-btn:hover {
          background: #ffffff;
          box-shadow: 0 2px 8px rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </article>
  );
}
