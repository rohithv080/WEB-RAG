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
  if (mins < 1) return "just now";
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

export function BotCard({ site, onClick, onDelete, onEmbed, onSettings, onAnalytics }: BotCardProps) {
  const abbr = initials(site.name) || "?";
  const favicon = getFavicon(site.pages);
  const updated = relativeTime(site.lastScrapedAt);

  return (
    <article className="bot-card" onClick={onClick}>
      {/* Header section */}
      <div className="bot-card-header">
        <div className="bot-avatar">
          {favicon ? (
            <img src={favicon} alt="" width={16} height={16} className="avatar-img" />
          ) : (
            <span className="avatar-text">{abbr}</span>
          )}
        </div>

        <div className="bot-badges">
          {site.isPublic === false && (
            <span className="badge badge-private" title="Private bot">
              Private
            </span>
          )}
          {site.enableWebSearch !== false && (
            <span className="badge badge-web" title="Live Web Search Fallback Enabled">
              🌐 Web
            </span>
          )}
          {site.autoSync && (
            <span className="badge badge-sync" title={`Auto-sync scheduled (${site.syncFrequency || "daily"})`}>
              ⚡ Sync
            </span>
          )}
          {site.systemPrompt && (
            <span className="badge badge-custom" title="Custom AI Persona Active">
              Custom
            </span>
          )}
          {site.tone && site.tone !== "balanced" && (
            <span className="badge badge-tone" title={`Tone: ${site.tone}`}>
              {site.tone === "concise" ? "Concise" : "Detailed"}
            </span>
          )}
          <span className="badge badge-metric">
            {site.pages.length} {site.pages.length === 1 ? "page" : "pages"}
          </span>
          <span className="badge badge-metric">
            {site.totalChunks.toLocaleString()} chunks
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="bot-body">
        <h3 className="bot-name">{site.name}</h3>
        <p className="bot-desc">
          {site.description || (site.pages[0]?.title ? `Knowledge from ${site.pages[0].title}` : "Indexed knowledge base ready for chat.")}
        </p>
      </div>

      {/* Footer */}
      <div className="bot-card-footer">
        <span className="status-text" title={`Last indexed ${updated}`}>
          {updated}
        </span>

        <div className="bot-card-actions">
          {onDelete && (
            <button
              className="action-btn delete-btn"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(site.id);
              }}
              title="Delete bot"
            >
              <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}

          {onSettings && (
            <button
              className="action-btn settings-btn"
              onClick={(e) => {
                e.stopPropagation();
                onSettings(site);
              }}
              title="Configure persona, tone & prompts"
            >
              <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          )}

          {onAnalytics && (
            <button
              className="action-btn analytics-btn"
              onClick={(e) => {
                e.stopPropagation();
                onAnalytics(site);
              }}
              title="View bot analytics, query logs & metrics"
            >
              <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>Logs</span>
            </button>
          )}

          {onEmbed && (
            <button
              className="action-btn embed-btn"
              onClick={(e) => {
                e.stopPropagation();
                onEmbed(site);
              }}
              title="Get website embed snippet"
            >
              <span>&lt;/&gt;</span>
              <span>Embed</span>
            </button>
          )}

          <button
            className="action-btn chat-btn"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <span>Chat</span>
            <span className="arrow-icon">→</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        .bot-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 1.15rem 1.25rem 1rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          cursor: pointer;
          overflow: hidden;
          transition: all 0.15s ease;
        }

        .bot-card:hover {
          background: var(--bg-card-hover);
          border-color: rgba(255, 255, 255, 0.14);
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }

        .bot-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent 0%, rgba(99, 102, 241, 0.5) 50%, transparent 100%);
          opacity: 0;
          transition: opacity 0.25s ease;
          pointer-events: none;
        }

        .bot-card:hover::before {
          opacity: 1;
        }

        /* ── Header ─────────────────────────────────────────────── */
        .bot-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.65rem;
        }

        .bot-avatar {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .avatar-img {
          border-radius: 4px;
        }

        .avatar-text {
          color: var(--text);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .bot-badges {
          display: flex;
          gap: 0.3rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }

        .badge {
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          font-size: 0.68rem;
          font-weight: 500;
          white-space: nowrap;
          border: 1px solid var(--border);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted);
        }

        .badge-metric {
          font-family: var(--font-mono);
          color: var(--text-dim);
          font-size: 0.65rem;
        }

        .badge-custom {
          background: rgba(124, 124, 255, 0.08);
          border-color: rgba(124, 124, 255, 0.2);
          color: #a78bfa;
        }

        .badge-sync {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        .badge-web {
          background: rgba(6, 182, 212, 0.1);
          border-color: rgba(6, 182, 212, 0.3);
          color: #22d3ee;
        }

        .badge-tone {
          background: rgba(255, 255, 255, 0.04);
          border-color: var(--border);
          color: var(--text-muted);
        }

        .badge-private {
          background: rgba(248, 113, 113, 0.08);
          border-color: rgba(248, 113, 113, 0.2);
          color: #f87171;
        }

        /* ── Body ───────────────────────────────────────────────── */
        .bot-body {
          flex: 1;
        }

        .bot-name {
          margin: 0 0 0.3rem;
          font-size: 0.95rem;
          font-weight: 600;
          color: #f7f7f8;
          letter-spacing: -0.015em;
          line-height: 1.35;
        }

        .bot-desc {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        /* ── Footer ─────────────────────────────────────────────── */
        .bot-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 0.65rem;
          border-top: 1px solid var(--border-subtle);
          margin-top: auto;
        }

        .status-text {
          font-size: 0.68rem;
          font-family: var(--font-mono);
          color: var(--text-dim);
        }

        .bot-card-actions {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .action-btn {
          border-radius: 6px;
          transition: all 0.12s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          font-size: 0.74rem;
          font-weight: 500;
          cursor: pointer;
        }

        .delete-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-dim);
          padding: 4px 6px;
          opacity: 0;
        }
        .bot-card:hover .delete-btn {
          opacity: 0.7;
        }
        .delete-btn:hover {
          opacity: 1 !important;
          color: #f87171;
          background: rgba(248, 113, 113, 0.08);
          border-color: rgba(248, 113, 113, 0.2);
        }

        .settings-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 4px 6px;
        }
        .settings-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .analytics-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 4px 8px;
        }
        .analytics-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .embed-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 4px 8px;
        }
        .embed-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.16);
        }

        .chat-btn {
          background: var(--accent);
          border: 1px solid transparent;
          color: #ffffff;
          padding: 4px 10px;
        }
        .chat-btn:hover {
          background: #6e6eff;
        }

        .arrow-icon {
          font-size: 0.8rem;
          transition: transform 0.12s ease;
        }
        .chat-btn:hover .arrow-icon {
          transform: translateX(2px);
        }
      `}</style>
    </article>
  );
}
