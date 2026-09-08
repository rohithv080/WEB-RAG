"use client";

import { useState } from "react";
import type { SiteSummary } from "./BotCard";

type Props = {
  sites: SiteSummary[];
  activeSiteId: string | null;
  onSelect: (site: SiteSummary) => void;
  onAddBot: () => void;
  onHome: () => void;
};

function getFavicon(site: SiteSummary): string {
  try {
    const firstPage = site.pages[0];
    if (!firstPage) return "";
    const domain = new URL(firstPage.url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return "";
  }
}

function freshness(iso: string): "fresh" | "stale" | "old" {
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 3600_000) return "fresh";       // < 1 hour
  if (diff < 86400_000) return "stale";      // < 24 hours
  return "old";
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

export function Sidebar({ sites, activeSiteId, onSelect, onAddBot, onHome }: Props) {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filtered = search
    ? sites.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : sites;

  const content = (
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      {/* Logo */}
      <button className="sidebar-brand" onClick={() => { onHome(); setMobileOpen(false); }}>
        <span className="sidebar-logo">⚡</span>
        <div>
          <div className="sidebar-title">Web RAG</div>
          <div className="sidebar-sub">AI bots on your docs</div>
        </div>
      </button>

      {/* Search (show when 4+ sites) */}
      {sites.length >= 4 && (
        <div className="sidebar-search-wrap">
          <input
            className="sidebar-search"
            type="text"
            placeholder="Search bots…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* Site list */}
      <nav className="sidebar-list">
        {filtered.map((site) => {
          const favicon = getFavicon(site);
          const fresh = freshness(site.lastScrapedAt);
          const isActive = site.id === activeSiteId;

          return (
            <button
              key={site.id}
              className={`sidebar-item ${isActive ? "sidebar-item-active" : ""}`}
              onClick={() => { onSelect(site); setMobileOpen(false); }}
            >
              <div className="sidebar-item-icon">
                {favicon ? (
                  <img src={favicon} alt="" width={20} height={20} style={{ borderRadius: 4 }} />
                ) : (
                  <span className="sidebar-item-letter">
                    {site.name.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="sidebar-item-info">
                <span className="sidebar-item-name">{site.name}</span>
                <span className="sidebar-item-meta">
                  {site.totalChunks} chunks · {relativeTime(site.lastScrapedAt)}
                </span>
              </div>
              <span className={`sidebar-dot dot-${fresh}`} />
            </button>
          );
        })}
      </nav>

      {/* Add bot button */}
      <button className="sidebar-add" onClick={() => { onAddBot(); setMobileOpen(false); }}>
        <span className="sidebar-add-icon">+</span>
        Add new bot
      </button>

      {/* Footer */}
      <div className="sidebar-footer">
        Scrape → chunk → embed → Groq
      </div>

      <style jsx>{`
        .sidebar {
          width: var(--sidebar-width);
          height: 100vh;
          position: fixed;
          top: 0;
          left: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg-sidebar);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-right: 1px solid var(--border);
          z-index: 50;
          padding: 0;
          overflow: hidden;
        }

        /* Brand */
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 1.25rem 1rem;
          border: none;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          text-align: left;
          width: 100%;
          border-bottom: 1px solid var(--border);
          transition: background 0.15s ease;
        }
        .sidebar-brand:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .sidebar-logo {
          font-size: 1.5rem;
          filter: drop-shadow(0 0 12px var(--accent-glow));
        }
        .sidebar-title {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.03em;
        }
        .sidebar-sub {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-top: 1px;
        }

        /* Search */
        .sidebar-search-wrap {
          padding: 0.75rem 0.75rem 0;
        }
        .sidebar-search {
          width: 100%;
          padding: 0.5rem 0.7rem;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text);
          font-size: 0.82rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .sidebar-search:focus {
          border-color: var(--accent);
        }
        .sidebar-search::placeholder {
          color: var(--text-dim);
        }

        /* Site list */
        .sidebar-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.75rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          padding: 0.55rem 0.6rem;
          border: none;
          background: transparent;
          color: var(--text);
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          transition: background 0.12s ease;
        }
        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }
        .sidebar-item-active {
          background: var(--accent-soft);
          box-shadow: inset 0 0 0 1px rgba(61, 156, 240, 0.15);
        }

        .sidebar-item-icon {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-item-letter {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: var(--accent-soft);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          font-weight: 700;
        }
        .sidebar-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .sidebar-item-name {
          font-size: 0.85rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-item-meta {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }

        .sidebar-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-fresh { background: var(--success); box-shadow: 0 0 6px var(--success); }
        .dot-stale { background: var(--warning); }
        .dot-old   { background: var(--text-dim); }

        /* Add button */
        .sidebar-add {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0.5rem 0.5rem;
          padding: 0.6rem 0.75rem;
          border: 1px dashed var(--border-active);
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sidebar-add:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-soft);
        }
        .sidebar-add-icon {
          font-size: 1.1rem;
          font-weight: 300;
          line-height: 1;
        }

        /* Footer */
        .sidebar-footer {
          padding: 0.75rem 1rem;
          font-size: 0.65rem;
          font-family: var(--font-mono);
          color: var(--text-dim);
          border-top: 1px solid var(--border);
          text-align: center;
        }

        /* ── Mobile ──────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.25s ease;
            box-shadow: none;
          }
          .sidebar-open {
            transform: translateX(0);
            box-shadow: 4px 0 32px rgba(0, 0, 0, 0.5);
          }
        }
      `}</style>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
        {mobileOpen ? "✕" : "☰"}
      </button>
      {mobileOpen && (
        <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />
      )}
      {content}

      <style jsx>{`
        .mobile-menu-btn {
          display: none;
          position: fixed;
          top: 0.75rem;
          left: 0.75rem;
          z-index: 60;
          width: 40px;
          height: 40px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg-sidebar);
          backdrop-filter: blur(12px);
          color: var(--text);
          font-size: 1.1rem;
          cursor: pointer;
          align-items: center;
          justify-content: center;
        }
        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 40;
        }
        @media (max-width: 768px) {
          .mobile-menu-btn { display: flex; }
          .mobile-overlay { display: block; }
        }
      `}</style>
    </>
  );
}
