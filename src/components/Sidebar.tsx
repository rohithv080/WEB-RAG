"use client";

import { useState } from "react";
import type { SiteSummary } from "./BotCard";
import { AuthBar } from "./AuthBar";

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
        <div className="sidebar-logo-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="url(#brandGrad)" stroke="none" />
            <defs>
              <linearGradient id="brandGrad" x1="3" y1="2" x2="21" y2="22" gradientUnits="userSpaceOnUse">
                <stop stopColor="#60a5fa" />
                <stop offset="1" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <div className="sidebar-title-row">
            <span className="sidebar-title">Web RAG</span>
            <span className="sidebar-pro-pill">PRO</span>
          </div>
          <div className="sidebar-sub">Neural Knowledge Engine</div>
        </div>
      </button>

      {/* Search */}
      <div className="sidebar-search-wrap">
        <div className="sidebar-search-box">
          <svg className="sidebar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="sidebar-search"
            type="text"
            placeholder="Search bots…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <span className="sidebar-search-kbd">⌘K</span>
        </div>
      </div>

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
              {isActive && <span className="active-pill" />}
              <div className="sidebar-item-icon">
                {favicon ? (
                  <img src={favicon} alt="" width={18} height={18} style={{ borderRadius: 4 }} />
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
              <span className={`sidebar-dot dot-${fresh}`} title={`Status: ${fresh}`} />
            </button>
          );
        })}
      </nav>

      {/* Add bot button */}
      <button className="sidebar-add" onClick={() => { onAddBot(); setMobileOpen(false); }}>
        <span className="sidebar-add-icon">+</span>
        <span>New Knowledge Bot</span>
      </button>

      {/* Auth bar */}
      <AuthBar />

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="footer-status-dot" />
        <span>Hybrid RAG Engine Online</span>
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
          background: rgba(10, 14, 23, 0.85);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-right: 1px solid var(--border-subtle);
          z-index: 50;
          padding: 0;
          overflow: hidden;
        }

        /* Brand */
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 1.15rem 1rem;
          border: none;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          text-align: left;
          width: 100%;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.15s ease;
        }
        .sidebar-brand:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .sidebar-logo-box {
          width: 34px;
          height: 34px;
          border-radius: 9px;
          background: linear-gradient(135deg, rgba(79, 110, 247, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
          border: 1px solid rgba(129, 140, 248, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 16px rgba(79, 110, 247, 0.25);
          flex-shrink: 0;
        }

        .sidebar-brand-text {
          flex: 1;
          min-width: 0;
        }

        .sidebar-title-row {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .sidebar-title {
          font-size: 0.95rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: #f8fafc;
        }

        .sidebar-pro-pill {
          font-size: 0.62rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(79, 110, 247, 0.2);
          border: 1px solid rgba(79, 110, 247, 0.4);
          color: #93c5fd;
        }

        .sidebar-sub {
          font-size: 0.68rem;
          color: var(--text-dim);
          margin-top: 2px;
          letter-spacing: -0.01em;
        }

        /* Search */
        .sidebar-search-wrap {
          padding: 0.75rem 0.75rem 0.35rem;
        }

        .sidebar-search-box {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .sidebar-search-icon {
          position: absolute;
          left: 0.65rem;
          color: var(--text-dim);
          pointer-events: none;
        }

        .sidebar-search {
          width: 100%;
          padding: 0.45rem 1.8rem 0.45rem 2rem;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--text);
          font-size: 0.8rem;
          outline: none;
          transition: all 0.15s ease;
        }

        .sidebar-search:focus {
          border-color: rgba(79, 110, 247, 0.5);
          background: rgba(255, 255, 255, 0.05);
          box-shadow: 0 0 0 2px rgba(79, 110, 247, 0.15);
        }

        .sidebar-search::placeholder {
          color: var(--text-dim);
        }

        .sidebar-search-kbd {
          position: absolute;
          right: 0.5rem;
          font-size: 0.64rem;
          font-family: var(--font-mono);
          color: var(--text-dim);
          padding: 1px 4px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          pointer-events: none;
        }

        /* Site list */
        .sidebar-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.5rem 0.6rem;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.55rem 0.65rem;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text);
          border-radius: 8px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          position: relative;
          transition: all 0.15s ease;
        }

        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .sidebar-item-active {
          background: linear-gradient(90deg, rgba(79, 110, 247, 0.12) 0%, rgba(79, 110, 247, 0.03) 100%);
          border-color: rgba(79, 110, 247, 0.25);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
        }

        .active-pill {
          position: absolute;
          left: -0.6rem;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 18px;
          border-radius: 0 4px 4px 0;
          background: var(--accent);
          box-shadow: 0 0 8px var(--accent-glow);
        }

        .sidebar-item-icon {
          width: 26px;
          height: 26px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .sidebar-item-letter {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: rgba(79, 110, 247, 0.15);
          color: #93c5fd;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.76rem;
          font-weight: 700;
        }

        .sidebar-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sidebar-item-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-item-meta {
          font-size: 0.68rem;
          color: var(--text-dim);
          font-family: var(--font-mono);
          margin-top: 1px;
        }

        .sidebar-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-fresh { background: #10b981; box-shadow: 0 0 6px rgba(16, 185, 129, 0.7); }
        .dot-stale { background: #f59e0b; }
        .dot-old   { background: #475569; }

        /* Add button */
        .sidebar-add {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
          margin: 0.4rem 0.6rem 0.5rem;
          padding: 0.55rem 0.75rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.03);
          color: #cbd5e1;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sidebar-add:hover {
          border-color: rgba(79, 110, 247, 0.4);
          color: #ffffff;
          background: rgba(79, 110, 247, 0.1);
        }

        .sidebar-add-icon {
          font-size: 1.05rem;
          font-weight: 300;
          line-height: 1;
        }

        /* Footer */
        .sidebar-footer {
          padding: 0.7rem 1rem;
          font-size: 0.66rem;
          font-family: var(--font-mono);
          color: var(--text-dim);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.45rem;
        }

        .footer-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
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
            box-shadow: 4px 0 32px rgba(0, 0, 0, 0.6);
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
