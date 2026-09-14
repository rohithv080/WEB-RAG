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
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <span className="sidebar-title">Web RAG</span>
        </div>
      </button>

      {/* Search */}
      <div className="sidebar-search-wrap">
        <div className="sidebar-search-box">
          <svg className="sidebar-search-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                  <img src={favicon} alt="" width={16} height={16} style={{ borderRadius: 3 }} />
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
        <span>RAG Engine Online</span>
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
          padding: 0.9rem 0.9rem;
          border: none;
          background: transparent;
          color: var(--text);
          cursor: pointer;
          text-align: left;
          width: 100%;
          border-bottom: 1px solid var(--border-subtle);
          transition: background 0.12s ease;
        }
        .sidebar-brand:hover {
          background: rgba(255, 255, 255, 0.02);
        }

        .sidebar-logo-box {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: rgba(124, 124, 255, 0.12);
          border: 1px solid rgba(124, 124, 255, 0.25);
          color: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .sidebar-brand-text {
          display: flex;
          align-items: center;
        }

        .sidebar-title {
          font-size: 0.88rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: #f7f7f8;
        }

        /* Search */
        .sidebar-search-wrap {
          padding: 0.6rem 0.6rem 0.25rem;
        }

        .sidebar-search-box {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .sidebar-search-icon {
          position: absolute;
          left: 0.6rem;
          color: var(--text-dim);
          pointer-events: none;
        }

        .sidebar-search {
          width: 100%;
          padding: 0.4rem 1.8rem 0.4rem 1.85rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.025);
          color: var(--text);
          font-size: 0.78rem;
          outline: none;
          transition: all 0.12s ease;
        }

        .sidebar-search:focus {
          border-color: var(--accent);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 0 0 1px var(--accent);
        }

        .sidebar-search::placeholder {
          color: var(--text-dim);
        }

        .sidebar-search-kbd {
          position: absolute;
          right: 0.5rem;
          font-size: 0.62rem;
          font-family: var(--font-mono);
          color: var(--text-dim);
          padding: 1px 4px;
          border-radius: 3px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.06);
          pointer-events: none;
        }

        /* Site list */
        .sidebar-list {
          flex: 1;
          overflow-y: auto;
          padding: 0.4rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          padding: 0.42rem 0.55rem;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          width: 100%;
          position: relative;
          transition: all 0.12s ease;
        }

        .sidebar-item:hover {
          background: rgba(255, 255, 255, 0.035);
          color: var(--text);
        }

        .sidebar-item-active {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }

        .active-pill {
          position: absolute;
          left: -0.5rem;
          top: 50%;
          transform: translateY(-50%);
          width: 2.5px;
          height: 16px;
          border-radius: 0 2px 2px 0;
          background: var(--accent);
        }

        .sidebar-item-icon {
          width: 22px;
          height: 22px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.04);
        }

        .sidebar-item-letter {
          width: 22px;
          height: 22px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.06);
          color: var(--text);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.72rem;
          font-weight: 600;
        }

        .sidebar-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .sidebar-item-name {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-item-active .sidebar-item-name {
          color: #ffffff;
          font-weight: 600;
        }

        .sidebar-item-meta {
          font-size: 0.65rem;
          color: var(--text-dim);
          font-family: var(--font-mono);
          margin-top: 1px;
        }

        /* Add button */
        .sidebar-add {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          margin: 0.35rem 0.5rem 0.45rem;
          padding: 0.48rem 0.65rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .sidebar-add:hover {
          border-color: rgba(255, 255, 255, 0.16);
          color: #ffffff;
          background: rgba(255, 255, 255, 0.04);
        }

        .sidebar-add-icon {
          font-size: 0.95rem;
          font-weight: 400;
          line-height: 1;
        }

        /* Footer */
        .sidebar-footer {
          padding: 0.6rem 0.85rem;
          font-size: 0.64rem;
          font-family: var(--font-mono);
          color: var(--text-dim);
          border-top: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
        }

        .footer-status-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #34d399;
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
