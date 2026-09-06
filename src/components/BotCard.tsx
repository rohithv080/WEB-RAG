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

// ---------------------------------------------------------------------------
// Color palette — deterministic pick from site name
// ---------------------------------------------------------------------------
const PALETTE = [
  { accent: "#3d9cf0", glow: "rgba(61,156,240,0.18)" },
  { accent: "#a78bfa", glow: "rgba(167,139,250,0.18)" },
  { accent: "#34d399", glow: "rgba(52,211,153,0.18)" },
  { accent: "#fb923c", glow: "rgba(251,146,60,0.18)" },
  { accent: "#f472b6", glow: "rgba(244,114,182,0.18)" },
  { accent: "#22d3ee", glow: "rgba(34,211,238,0.18)" },
];

function pickColor(name: string) {
  let h = 0;
  for (const ch of name) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type BotCardProps = {
  site: SiteSummary;
  onClick: () => void;
  onDelete?: (id: string) => void;
};

export function BotCard({ site, onClick, onDelete }: BotCardProps) {
  const { accent, glow } = pickColor(site.name);
  const abbr = initials(site.name) || "?";
  const updated = relativeTime(site.lastScrapedAt);

  return (
    <article
      className="bot-card"
      style={
        {
          "--accent": accent,
          "--glow": glow,
        } as React.CSSProperties
      }
    >
      <div className="bot-card-header">
        <div className="bot-avatar">{abbr}</div>
        <div className="bot-badges">
          <span className="badge">
            {site.pages.length} page{site.pages.length !== 1 ? "s" : ""}
          </span>
          <span className="badge">{site.totalChunks} chunks</span>
        </div>
      </div>

      <div className="bot-body">
        <h3 className="bot-name">{site.name}</h3>
        {site.description && (
          <p className="bot-desc">{site.description}</p>
        )}
      </div>

      <div className="bot-card-actions">
        {onDelete && (
          <button 
            className="bot-delete-btn"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(site.id);
            }}
            title="Delete bot"
          >
            🗑️
          </button>
        )}
        <button className="bot-chat-btn" onClick={onClick}>
          Chat
        </button>
      </div>

      <style jsx>{`
        .bot-card {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 1.2rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 14px;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
          cursor: default;
          overflow: hidden;
        }
        .bot-card::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--accent);
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .bot-card:hover {
          border-color: var(--accent);
          box-shadow: 0 6px 28px var(--glow);
          transform: translateY(-2px);
        }
        .bot-card:hover::before {
          opacity: 1;
        }

        /* Header */
        .bot-card-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .bot-avatar {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: var(--accent);
          color: #fff;
          font-size: 0.95rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          letter-spacing: -0.02em;
          opacity: 0.9;
        }
        .bot-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.3rem;
          justify-content: flex-end;
        }
        .badge {
          padding: 0.2rem 0.5rem;
          border: 1px solid var(--border);
          border-radius: 99px;
          font-size: 0.7rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
          white-space: nowrap;
        }

        /* Body */
        .bot-body {
          flex: 1;
        }
        .bot-name {
          margin: 0 0 0.3rem;
          font-size: 1rem;
          font-weight: 600;
          color: var(--text);
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

        /* Footer */
        .bot-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-top: auto;
        }
        .bot-updated {
          font-size: 0.72rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }
        .bot-chat-btn {
          padding: 0.45rem 1rem;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: #fff;
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          transition: opacity 0.15s ease, transform 0.1s ease;
        }
        .bot-chat-btn:hover {
          opacity: 0.88;
          transform: scale(1.03);
        }
        .bot-chat-btn:active {
          transform: scale(0.97);
        }
      `}</style>
    </article>
  );
}
