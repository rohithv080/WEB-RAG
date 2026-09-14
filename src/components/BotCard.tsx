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
  scrapedAt: string;
  lastScrapedAt: string;
  latestSessionId: string | null;
  totalChunks: number;
  pages: PageSummary[];
};

// ── Harmonious Color Palette ───────────────────────────────────────────
const PALETTE = [
  { accent: "#38bdf8", glow: "rgba(56,189,248,0.25)", bg: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)" },
  { accent: "#818cf8", glow: "rgba(129,140,248,0.25)", bg: "linear-gradient(135deg, #4f46e5 0%, #818cf8 100%)" },
  { accent: "#34d399", glow: "rgba(52,211,153,0.25)", bg: "linear-gradient(135deg, #059669 0%, #34d399 100%)" },
  { accent: "#fb923c", glow: "rgba(251,146,60,0.25)", bg: "linear-gradient(135deg, #ea580c 0%, #fb923c 100%)" },
  { accent: "#f472b6", glow: "rgba(244,114,182,0.25)", bg: "linear-gradient(135deg, #db2777 0%, #f472b6 100%)" },
  { accent: "#a78bfa", glow: "rgba(167,139,250,0.25)", bg: "linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)" },
];

function pickColor(name: string) {
  let h = 0;
  for (const ch of name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

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
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch {
    return null;
  }
}

function freshness(iso: string): "fresh" | "stale" | "old" {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600_000) return "fresh";
  if (diff < 86400_000) return "stale";
  return "old";
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
  const { accent, glow, bg } = pickColor(site.name);
  const abbr = initials(site.name) || "?";
  const favicon = getFavicon(site.pages);
  const fresh = freshness(site.lastScrapedAt);
  const updated = relativeTime(site.lastScrapedAt);

  return (
    <article
      className="bot-card"
      style={
        {
          "--card-accent": accent,
          "--card-glow": glow,
          "--card-avatar-bg": bg,
        } as React.CSSProperties
      }
      onClick={onClick}
    >
      {/* Top subtle highlight border line */}
      <div className="bot-card-edge-glow" />

      {/* Header section */}
      <div className="bot-card-header">
        <div className="bot-avatar">
          {favicon ? (
            <img src={favicon} alt="" width={24} height={24} className="avatar-img" />
          ) : (
            <span className="avatar-text">{abbr}</span>
          )}
        </div>

        <div className="bot-badges">
          {site.isPublic === false && (
            <span className="badge badge-private" title="Private bot">
              🔒 Private
            </span>
          )}
          {site.systemPrompt && (
            <span className="badge badge-custom" title="Custom AI Persona Active">
              ✨ Custom
            </span>
          )}
          {site.tone && site.tone !== "balanced" && (
            <span className="badge badge-tone" title={`Tone: ${site.tone}`}>
              {site.tone === "concise" ? "⚡ Concise" : "📚 Detailed"}
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
        <div className="bot-status" title={`Last indexed ${updated}`}>
          <span className={`status-dot dot-${fresh}`} />
          <span className="status-text">{updated}</span>
        </div>

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
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
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
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
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
              <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
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
          gap: 1rem;
          padding: 1.35rem 1.4rem 1.25rem;
          background: linear-gradient(180deg, rgba(18, 26, 43, 0.75) 0%, rgba(11, 16, 28, 0.85) 100%);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 18px;
          cursor: pointer;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1);
          transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      box-shadow 0.22s cubic-bezier(0.16, 1, 0.3, 1),
                      border-color 0.22s ease;
        }

        .bot-card-edge-glow {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, var(--card-accent), transparent);
          opacity: 0;
          transition: opacity 0.25s ease;
        }

        .bot-card:hover {
          transform: translateY(-4px);
          border-color: rgba(255, 255, 255, 0.18);
          box-shadow: 0 18px 45px rgba(0, 0, 0, 0.5), 0 0 30px var(--card-glow), inset 0 1px 0 rgba(255, 255, 255, 0.15);
        }

        .bot-card:hover .bot-card-edge-glow {
          opacity: 1;
        }

        /* ── Header ─────────────────────────────────────────────── */
        .bot-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
        }

        .bot-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: var(--card-avatar-bg);
          box-shadow: 0 4px 14px var(--card-glow);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .avatar-img {
          border-radius: 6px;
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.4));
        }

        .avatar-text {
          color: #fff;
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }

        .bot-badges {
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
          justify-content: flex-end;
          align-items: center;
        }

        .badge {
          padding: 0.22rem 0.6rem;
          border-radius: 99px;
          font-size: 0.7rem;
          font-weight: 500;
          white-space: nowrap;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-muted);
        }

        .badge-metric {
          font-family: var(--font-mono);
          background: rgba(255, 255, 255, 0.03);
          color: #94a3b8;
        }

        .badge-custom {
          background: rgba(234, 179, 8, 0.12);
          border-color: rgba(234, 179, 8, 0.35);
          color: #facc15;
          font-weight: 600;
        }

        .badge-tone {
          background: rgba(56, 189, 248, 0.12);
          border-color: rgba(56, 189, 248, 0.35);
          color: #38bdf8;
          font-weight: 600;
        }

        .badge-private {
          background: rgba(248, 113, 113, 0.12);
          border-color: rgba(248, 113, 113, 0.35);
          color: #f87171;
          font-weight: 600;
        }

        /* ── Body ───────────────────────────────────────────────── */
        .bot-body {
          flex: 1;
        }

        .bot-name {
          margin: 0 0 0.35rem;
          font-size: 1.08rem;
          font-weight: 700;
          color: #fff;
          letter-spacing: -0.02em;
          line-height: 1.3;
        }

        .bot-desc {
          margin: 0;
          font-size: 0.82rem;
          color: #94a3b8;
          line-height: 1.5;
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
          padding-top: 0.75rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          margin-top: auto;
        }

        .bot-status {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
        }

        .dot-fresh {
          background: #34d399;
          box-shadow: 0 0 8px #34d399;
        }
        .dot-stale {
          background: #fbbf24;
        }
        .dot-old {
          background: #64748b;
        }

        .status-text {
          font-size: 0.72rem;
          font-family: var(--font-mono);
          color: #64748b;
        }

        .bot-card-actions {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .action-btn {
          border-radius: 8px;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          font-size: 0.78rem;
          font-weight: 600;
        }

        .delete-btn {
          background: transparent;
          border: 1px solid transparent;
          color: #64748b;
          padding: 6px;
          opacity: 0;
        }
        .bot-card:hover .delete-btn {
          opacity: 0.7;
        }
        .delete-btn:hover {
          opacity: 1 !important;
          color: #f87171;
          background: rgba(248, 113, 113, 0.1);
          border-color: rgba(248, 113, 113, 0.25);
        }

        .settings-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          padding: 6px 8px;
        }
        .settings-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.22);
          transform: rotate(30deg);
        }

        .analytics-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #38bdf8;
          padding: 6px 10px;
        }
        .analytics-btn:hover {
          color: #fff;
          background: rgba(56, 189, 248, 0.16);
          border-color: rgba(56, 189, 248, 0.35);
        }

        .embed-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          padding: 6px 10px;
        }
        .embed-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.22);
        }

        .chat-btn {
          background: var(--card-accent);
          background: linear-gradient(135deg, var(--card-accent) 0%, #4f46e5 100%);
          border: none;
          color: #ffffff;
          padding: 6px 14px;
          box-shadow: 0 4px 12px var(--card-glow);
        }
        .chat-btn:hover {
          opacity: 0.92;
          transform: translateY(-1px) scale(1.02);
          box-shadow: 0 6px 18px var(--card-glow);
        }

        .arrow-icon {
          font-size: 0.9rem;
          transition: transform 0.15s ease;
        }
        .chat-btn:hover .arrow-icon {
          transform: translateX(2px);
        }
      `}</style>
    </article>
  );
}
