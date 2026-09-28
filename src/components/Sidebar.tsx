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
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenCommandPalette?: () => void;
  onOpenApiKeys?: () => void;
  isAdmin?: boolean;
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

export function Sidebar({
  sites,
  activeSiteId,
  onSelect,
  onAddBot,
  onHome,
  isCollapsed = false,
  onToggleCollapse,
  onOpenCommandPalette,
  onOpenApiKeys,
  isAdmin = false,
}: Props) {
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);

  const filtered = search
    ? sites.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : sites;

  const content = (
    <aside
      className={`sidebar ${mobileOpen ? "sidebar-open" : ""} ${isCollapsed ? "sidebar-collapsed" : ""}`}
    >
      {/* Brand & Collapse */}
      <div className="sidebar-brand-row">
        <button
          className="sidebar-brand"
          onClick={() => {
            onHome();
            setMobileOpen(false);
          }}
        >
          <div className="sidebar-logo-box">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon
                points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                fill="currentColor"
                stroke="none"
              />
            </svg>
          </div>
          {!isCollapsed && (
            <div className="sidebar-brand-text">
              <span className="sidebar-title">Web RAG</span>
            </div>
          )}
        </button>
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Collapsed Search Icon */}
      {isCollapsed && onOpenCommandPalette && (
        <div className="sidebar-collapsed-search-wrap">
          <button
            type="button"
            className="sidebar-collapsed-search-btn"
            onClick={onOpenCommandPalette}
            title="Search & Commands (⌘K)"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      )}

      {/* Search */}
      <div className="sidebar-search-wrap">
        <div
          className="sidebar-search-box"
          onClick={() => {
            if (onOpenCommandPalette) onOpenCommandPalette();
          }}
          style={{ cursor: onOpenCommandPalette ? "pointer" : "default" }}
        >
          <svg
            className="sidebar-search-icon"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="sidebar-search"
            type="text"
            placeholder="Search or press ⌘K…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={(e) => {
              if (onOpenCommandPalette) {
                e.target.blur();
                onOpenCommandPalette();
              }
            }}
          />
          <button
            type="button"
            className="sidebar-search-kbd"
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenCommandPalette) onOpenCommandPalette();
            }}
            title="Open Command Palette (Cmd + K)"
          >
            ⌘K
          </button>
        </div>
      </div>

      {/* Section 1: WORKSPACE */}
      <div className="sidebar-section">
        {!isCollapsed && <div className="sidebar-section-label">Workspace</div>}
        <div className="sidebar-nav-group">
          <button
            type="button"
            className={`sidebar-nav-btn ${!activeSiteId ? "active" : ""}`}
            onClick={() => {
              onHome();
              setMobileOpen(false);
            }}
            title="All Knowledge Bases"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            {!isCollapsed && <span>{isAdmin ? "Admin Console" : "Overview"}</span>}
          </button>

          {!isAdmin && (
            <button
              type="button"
              className="sidebar-nav-btn sidebar-create-btn"
              onClick={() => {
                onAddBot();
                setMobileOpen(false);
              }}
              title="Create Knowledge Base"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              {!isCollapsed && <span>New Knowledge Base</span>}
            </button>
          )}
        </div>
      </div>

      {/* Section 2: KNOWLEDGE BASES */}
      <div className="sidebar-section sidebar-kb-section">
        {!isCollapsed && (
          <div className="sidebar-section-label">
            <span>Knowledge Bases</span>
            <span className="sidebar-section-count">{sites.length}</span>
          </div>
        )}
        <nav className="sidebar-list">
          {filtered.length === 0 ? (
            !isCollapsed && (
              <div className="sidebar-empty-hint">
                {search ? "No matching bots" : "No knowledge bases yet"}
              </div>
            )
          ) : (
            filtered.map((site) => {
              const favicon = getFavicon(site);
              const isActive = site.id === activeSiteId;

              return (
                <button
                  key={site.id}
                  className={`sidebar-item ${isActive ? "sidebar-item-active" : ""}`}
                  onClick={() => {
                    onSelect(site);
                    setMobileOpen(false);
                  }}
                  title={isCollapsed ? site.name : undefined}
                >
                  {isActive && <span className="active-pill" />}
                  <div className="sidebar-item-icon">
                    {favicon ? (
                      <img src={favicon} alt="" width={15} height={15} style={{ borderRadius: 2 }} />
                    ) : (
                      <span className="sidebar-item-letter">{site.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  {!isCollapsed && (
                    <div className="sidebar-item-info">
                      <span className="sidebar-item-name">{site.name}</span>
                      <span className="sidebar-item-meta">
                        {site.totalChunks.toLocaleString()} chunks
                      </span>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </nav>
      </div>

      {/* Section 3: ACCOUNT & DEVELOPER */}
      <div className="sidebar-section sidebar-account-section">
        {!isCollapsed && <div className="sidebar-section-label">Account</div>}
        {onOpenApiKeys && (
          <button
            type="button"
            className="sidebar-nav-btn"
            onClick={() => {
              onOpenApiKeys();
              setMobileOpen(false);
            }}
            title="Developer API Keys & OpenAI SDK Endpoints"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5M16 7l-2 2m0 0l-3 3-4-4L2 13l5 5 4-4 3 3 5-5-2-2z" />
            </svg>
            {!isCollapsed && <span>API Keys</span>}
          </button>
        )}

        <AuthBar />
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <span className="footer-status-dot" />
        {!isCollapsed && <span>Operational</span>}
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
          transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .sidebar.sidebar-collapsed {
          width: var(--sidebar-collapsed-width);
        }
        .sidebar.sidebar-collapsed .sidebar-brand-row {
          justify-content: center;
          padding: 0.75rem 0;
          flex-direction: column;
          gap: 6px;
        }
        .sidebar.sidebar-collapsed .sidebar-brand {
          padding: 0;
          justify-content: center;
          flex: none;
        }
        .sidebar.sidebar-collapsed :global(.sidebar-search-wrap),
        .sidebar.sidebar-collapsed :global(.sidebar-item-info),
        .sidebar.sidebar-collapsed :global(.sidebar-add span:not(.sidebar-add-icon)),
        .sidebar.sidebar-collapsed :global(.sidebar-keys-btn span:last-child),
        .sidebar.sidebar-collapsed :global(.sidebar-footer span:last-child),
        .sidebar.sidebar-collapsed :global(.active-pill),
        .sidebar.sidebar-collapsed :global(.user-text-col),
        .sidebar.sidebar-collapsed :global(.logout-icon-btn),
        .sidebar.sidebar-collapsed :global(.auth-hint),
        .sidebar.sidebar-collapsed :global(.status-badge span:last-child),
        .sidebar.sidebar-collapsed :global(.auth-button-group) {
          display: none !important;
        }
        .sidebar.sidebar-collapsed :global(.sidebar-add),
        .sidebar.sidebar-collapsed :global(.sidebar-keys-btn) {
          justify-content: center;
          padding: 0.5rem 0;
        }
        .sidebar.sidebar-collapsed :global(.sidebar-item) {
          justify-content: center;
          padding: 0.5rem 0;
        }
        .sidebar.sidebar-collapsed :global(.auth-bar-fallback),
        .sidebar.sidebar-collapsed :global(.signed-in-card) {
          justify-content: center;
          padding: 0.4rem 0;
          margin: 0 4px 6px;
        }
        .sidebar-collapsed-search-wrap {
          display: flex;
          justify-content: center;
          padding: 8px 0;
        }
        .sidebar-collapsed-search-btn {
          width: 32px;
          height: 32px;
          border-radius: var(--radius-sm);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .sidebar-collapsed-search-btn:hover {
          background: var(--bg-card-hover);
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .sidebar-brand-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 0.85rem;
          border-bottom: 1px solid var(--border-subtle);
        }
        .sidebar-collapse-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          cursor: pointer;
          font-size: 0.75rem;
          padding: 4px 6px;
          border-radius: var(--radius-xs);
          transition: all var(--transition-fast);
        }
        .sidebar-collapse-btn:hover {
          color: var(--text-primary);
          background: var(--bg-card-hover);
        }

        /* Brand */
        .sidebar-brand {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0;
          border: none;
          background: transparent;
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          flex: 1;
        }

        .sidebar-logo-box {
          width: 22px;
          height: 22px;
          border-radius: var(--radius-xs);
          background: var(--bg-surface);
          border: 1px solid var(--border);
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
          font-size: 13px;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: var(--text-primary);
        }

        /* Search */
        .sidebar-search-wrap {
          padding: 0.5rem 0.5rem 0.25rem;
        }

        .sidebar-search-box {
          position: relative;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .sidebar-search-icon {
          position: absolute;
          left: 0.55rem;
          color: var(--text-dim);
          pointer-events: none;
        }

        .sidebar-search {
          width: 100%;
          padding: 0.35rem 1.6rem 0.35rem 1.75rem;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          background: var(--bg-input);
          color: var(--text-primary);
          font-size: 12px;
          outline: none;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }

        .sidebar-search:focus {
          border-color: var(--border-focus);
          box-shadow: 0 0 0 1px var(--accent);
        }

        .sidebar-search::placeholder {
          color: var(--text-dim);
        }

        .sidebar-search-kbd {
          position: absolute;
          right: 0.45rem;
          font-size: 10px;
          font-family: var(--font-mono);
          color: var(--text-dim);
          padding: 1px 4px;
          border-radius: 3px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          pointer-events: none;
        }

        /* Section Architecture */
        .sidebar-section {
          padding: 0.35rem 0.5rem;
          display: flex;
          flex-direction: column;
        }

        .sidebar-section-label {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.4rem 0.55rem 0.25rem;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-dim);
        }

        .sidebar-section-count {
          font-size: 11px;
          font-family: var(--font-mono);
          color: var(--text-dim);
        }

        .sidebar-nav-group {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .sidebar-nav-btn {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          width: 100%;
          height: 30px;
          padding: 0 0.55rem;
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
          transition: all var(--transition-fast);
        }

        .sidebar-nav-btn:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }

        .sidebar-nav-btn.active {
          background: var(--bg-surface);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .sidebar-create-btn {
          color: var(--text-secondary);
        }
        .sidebar-create-btn:hover {
          color: var(--text-primary);
        }

        /* Knowledge Bases section */
        .sidebar-kb-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
          padding-bottom: 0;
        }

        .sidebar-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 1px;
          padding-top: 1px;
        }

        .sidebar-empty-hint {
          padding: 0.85rem 0.5rem;
          font-size: 12px;
          color: var(--text-dim);
          text-align: center;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          height: 32px;
          padding: 0 0.55rem;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          border-radius: var(--radius-sm);
          cursor: pointer;
          text-align: left;
          width: 100%;
          position: relative;
          transition: all var(--transition-fast);
        }

        .sidebar-item:hover {
          background: var(--bg-card-hover);
          color: var(--text-primary);
        }

        .sidebar-item-active {
          background: var(--bg-surface);
          border-color: var(--border-subtle);
          color: var(--text-primary);
        }

        .active-pill {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 2px;
          height: 14px;
          border-radius: 0 1px 1px 0;
          background: var(--accent);
        }

        .sidebar-item-icon {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          border-radius: var(--radius-xs);
          background: var(--bg-surface);
        }

        .sidebar-item-letter {
          width: 18px;
          height: 18px;
          border-radius: var(--radius-xs);
          background: var(--bg-input);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
        }

        .sidebar-item-info {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 6px;
        }

        .sidebar-item-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-item-active .sidebar-item-name {
          color: var(--text-primary);
          font-weight: 500;
        }

        .sidebar-item-meta {
          font-size: 11px;
          color: var(--text-dim);
          font-family: var(--font-mono);
          flex-shrink: 0;
        }

        /* Account & Developer section */
        .sidebar-account-section {
          border-top: 1px solid var(--border-subtle);
          margin-top: auto;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        /* Footer */
        .sidebar-footer {
          padding: 0.5rem 0.75rem;
          font-size: 11px;
          font-family: var(--font-mono);
          color: var(--text-dim);
          border-top: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
        }

        .footer-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--status-live);
        }

        /* ── Collapsed Overrides ─────────────────────────────────────── */
        .sidebar.sidebar-collapsed :global(.sidebar-section-label),
        .sidebar.sidebar-collapsed :global(.sidebar-item-info),
        .sidebar.sidebar-collapsed :global(.sidebar-nav-btn span),
        .sidebar.sidebar-collapsed :global(.sidebar-footer span:last-child),
        .sidebar.sidebar-collapsed :global(.sidebar-empty-hint),
        .sidebar.sidebar-collapsed :global(.user-text-col),
        .sidebar.sidebar-collapsed :global(.logout-icon-btn),
        .sidebar.sidebar-collapsed :global(.auth-hint),
        .sidebar.sidebar-collapsed :global(.status-badge span:last-child),
        .sidebar.sidebar-collapsed :global(.auth-button-group) {
          display: none !important;
        }

        .sidebar.sidebar-collapsed :global(.sidebar-nav-btn) {
          justify-content: center;
          padding: 0.45rem 0;
        }

        .sidebar.sidebar-collapsed :global(.sidebar-item) {
          justify-content: center;
          padding: 0.45rem 0;
        }

        /* ── Mobile ──────────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
            transition: transform 0.2s ease;
            box-shadow: none;
          }
          .sidebar-open {
            transform: translateX(0);
            box-shadow: 4px 0 24px rgba(0, 0, 0, 0.5);
          }
        }
      `}</style>
    </aside>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle navigation menu"
      >
        {mobileOpen ? (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}
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
          .mobile-menu-btn {
            display: flex;
          }
          .mobile-overlay {
            display: block;
          }
        }
      `}</style>
    </>
  );
}
