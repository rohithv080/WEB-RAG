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
  scrapedAt: string;
  lastScrapedAt: string;
  latestSessionId: string | null;
  totalChunks: number;
  pages: PageSummary[];
};

// ── Color palette ───────────────────────────────────────────────────────
const PALETTE = [
  { accent: "#3d9cf0", glow: "rgba(61,156,240,0.20)" },
  { accent: "#a78bfa", glow: "rgba(167,139,250,0.20)" },
  { accent: "#34d399", glow: "rgba(52,211,153,0.20)" },
  { accent: "#fb923c", glow: "rgba(251,146,60,0.20)" },
  { accent: "#f472b6", glow: "rgba(244,114,182,0.20)" },
  { accent: "#22d3ee", glow: "rgba(34,211,238,0.20)" },
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
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
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
};

export function BotCard({ site, onClick, onDelete }: BotCardProps) {
  const { accent, glow } = pickColor(site.name);
  const abbr = initials(site.name) || "?";
  const favicon = getFavicon(site.pages);
  const fresh = freshness(site.lastScrapedAt);
  const updated = relativeTime(site.lastScrapedAt);

  return (
    <article
      className="bot-card glass"
      style={{ "--card-accent": accent, "--card-glow": glow } as React.CSSProperties}
      onClick={onClick}
    >
      {/* Top accent bar */}
      <div className="bot-card-accent-bar" />

      <div className="bot-card-header">
        <div className="bot-avatar">
          {favicon ? (
            <img src={favicon} alt="" width={22} height={22} style={{ borderRadius: 4 }} />
          ) : (
            abbr
          )}
        </div>
        <div className="bot-badges">
          <span className="badge">{site.pages.length} page{site.pages.length !== 1 ? "s" : ""}</span>
          <span className="badge">{site.totalChunks} chunks</span>
        </div>
      </div>

      <div className="bot-body">
        <h3 className="bot-name">{site.name}</h3>
        {site.description && <p className="bot-desc">{site.description}</p>}
      </div>

      <div className="bot-card-footer">
        <div className="bot-freshness">
          <span className={`freshness-dot dot-${fresh}`} />
          <span className="bot-updated">{updated}</span>
        </div>
        <div className="bot-card-actions">
          {onDelete && (
            <button
              className="bot-delete-btn"
              onClick={(e) => { e.stopPropagation(); onDelete(site.id); }}
              title="Delete bot"
            >
              🗑️
            </button>
          )}
          <button className="bot-chat-btn" onClick={(e) => { e.stopPropagation(); onClick(); }}>
            Chat
          </button>
        </div>
      </div>

      <style jsx>{`
        .bot-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          padding: 1.25rem;
          border-radius: var(--radius-lg);
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .bot-card-accent-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--card-accent);
          transform: scaleX(0);
          transition: transform 0.25s ease;
        }
        .bot-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 40px var(--card-glow);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .bot-card:hover .bot-card-accent-bar {
          transform: scaleX(1);
        }

        .bot-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .bot-avatar {
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: var(--card-accent);
          color: #fff;
          font-size: 0.9rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          opacity: 0.9;
        }
        .bot-badges {
          display: flex;
          gap: 0.3rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }
        .badge {
          padding: 0.2rem 0.5rem;
          border: 1px solid var(--border);
          border-radius: 99px;
          font-size: 0.68rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
          white-space: nowrap;
        }

        .bot-body { flex: 1; }
        .bot-name {
          margin: 0 0 0.25rem;
          font-size: 1rem;
          font-weight: 600;
          line-height: 1.3;
        }
        .bot-desc {
          margin: 0;
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .bot-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: auto;
        }
        .bot-freshness {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .freshness-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        .dot-fresh { background: var(--success); box-shadow: 0 0 6px var(--success); }
        .dot-stale { background: var(--warning); }
        .dot-old   { background: var(--text-dim); }
        .bot-updated {
          font-size: 0.7rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }

        .bot-card-actions {
          display: flex;
          gap: 0.4rem;
          align-items: center;
        }
        .bot-delete-btn {
          border: none;
          background: transparent;
          font-size: 0.8rem;
          padding: 0.3rem;
          opacity: 0;
          transition: opacity 0.15s ease;
          cursor: pointer;
        }
        .bot-card:hover .bot-delete-btn {
          opacity: 0.6;
        }
        .bot-delete-btn:hover {
          opacity: 1 !important;
        }
        .bot-chat-btn {
          padding: 0.4rem 0.9rem;
          border: none;
          border-radius: 8px;
          background: var(--card-accent);
          color: #fff;
          font-size: 0.8rem;
          font-weight: 600;
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .bot-chat-btn:hover {
          opacity: 0.88;
          transform: scale(1.03);
        }
      `}</style>
    </article>
  );
}
