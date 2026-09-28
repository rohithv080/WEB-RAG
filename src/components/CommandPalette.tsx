"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import type { SiteSummary } from "./BotCard";

export type PaletteTab = "pages" | "history" | "analytics" | "settings" | "embed";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  sites: SiteSummary[];
  selectedSite: SiteSummary | null;
  onSelectSite: (site: SiteSummary) => void;
  onDeployBot: () => void;
  onOpenDrawer: (tab: PaletteTab) => void;
  onSyncSite?: (siteId: string) => void;
  onToggleSidebar?: () => void;
  onHome: () => void;
  onNewChat?: () => void;
  onOpenApiKeys?: () => void;
};

type PaletteItem = {
  id: string;
  category: "Actions" | "Knowledge Bases";
  title: string;
  subtitle?: string;
  icon: string | React.ReactNode;
  badge?: string;
  action: () => void;
};

export function CommandPalette({
  isOpen,
  onClose,
  sites,
  selectedSite,
  onSelectSite,
  onDeployBot,
  onOpenDrawer,
  onSyncSite,
  onToggleSidebar,
  onHome,
  onNewChat,
  onOpenApiKeys,
}: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keyboard navigation & dismissal
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Build items list
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [];

    // ── Group 1: Actions ───────────────────────────────────────────────────
    if (selectedSite) {
      if (onNewChat) {
        items.push({
          id: "action-new-chat",
          category: "Actions",
          title: `Start New Chat in ${selectedSite.name}`,
          subtitle: "Reset screen to a fresh conversation session",
          icon: (
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
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          ),
          badge: "Chat",
          action: () => {
            onNewChat();
          },
        });
      }

      items.push({
        id: "action-history",
        category: "Actions",
        title: `View Chat History for ${selectedSite.name}`,
        subtitle: "Browse past conversation threads and multi-turn context",
        icon: (
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
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
        badge: "Drawer",
        action: () => {
          onOpenDrawer("history");
        },
      });

      items.push({
        id: "action-knowledge",
        category: "Actions",
        title: `Index Knowledge into ${selectedSite.name}`,
        subtitle: "Add URLs or upload PDF, Word, TXT, CSV documents",
        icon: (
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
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        ),
        badge: "Drawer",
        action: () => {
          onOpenDrawer("pages");
        },
      });

      items.push({
        id: "action-analytics",
        category: "Actions",
        title: `View Analytics for ${selectedSite.name}`,
        subtitle: "Live queries, response latency, and content gaps",
        icon: (
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
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
        badge: "Drawer",
        action: () => {
          onOpenDrawer("analytics");
        },
      });

      items.push({
        id: "action-settings",
        category: "Actions",
        title: `Customize Persona & Tone for ${selectedSite.name}`,
        subtitle: "Edit system prompt, starter questions, and response style",
        icon: (
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
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
        badge: "Drawer",
        action: () => {
          onOpenDrawer("settings");
        },
      });

      items.push({
        id: "action-embed",
        category: "Actions",
        title: `Get Embeddable Widget for ${selectedSite.name}`,
        subtitle: "1-line HTML script tag for external websites",
        icon: (
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
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        ),
        badge: "Drawer",
        action: () => {
          onOpenDrawer("embed");
        },
      });

      if (onSyncSite) {
        items.push({
          id: "action-sync",
          category: "Actions",
          title: `Sync News & Articles for ${selectedSite.name}`,
          subtitle: "Crawl sitemap and homepage for newly published pages",
          icon: (
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
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          ),
          badge: "Sync",
          action: () => {
            onSyncSite(selectedSite.id);
          },
        });
      }
    }

    items.push({
      id: "action-deploy",
      category: "Actions",
      title: "Deploy New Knowledge Bot",
      subtitle: "Scrape a website or upload knowledge files",
      icon: (
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
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
      badge: "Create",
      action: () => {
        onDeployBot();
      },
    });

    if (onOpenApiKeys) {
      items.push({
        id: "action-api-keys",
        category: "Actions",
        title: "Manage Developer API Keys",
        subtitle: "Generate keys & integrate bots via OpenAI Python SDK, cURL, or LangChain",
        icon: (
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
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
          </svg>
        ),
        badge: "API",
        action: () => {
          onOpenApiKeys();
        },
      });
    }

    if (onToggleSidebar) {
      items.push({
        id: "action-sidebar",
        category: "Actions",
        title: "Toggle Sidebar Rail",
        subtitle: "Collapse sidebar to 68px icon rail or expand",
        icon: (
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
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        ),
        badge: "Layout",
        action: () => {
          onToggleSidebar();
        },
      });
    }

    items.push({
      id: "action-home",
      category: "Actions",
      title: "Return to Knowledge Bases Grid",
      subtitle: "View all deployed bots and statistics overview",
      icon: (
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
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      ),
      badge: "Navigate",
      action: () => {
        onHome();
      },
    });

    // ── Group 2: Knowledge Bases (Bots) ───────────────────────────────────
    for (const site of sites) {
      items.push({
        id: `bot-${site.id}`,
        category: "Knowledge Bases",
        title: site.name,
        subtitle: `${site.pages.length} Pages • ${site.totalChunks} Chunks`,
        icon: (
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
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        ),
        badge: site.id === selectedSite?.id ? "Active" : "Switch",
        action: () => {
          onSelectSite(site);
        },
      });
    }

    return items;
  }, [
    sites,
    selectedSite,
    onOpenDrawer,
    onDeployBot,
    onSyncSite,
    onToggleSidebar,
    onHome,
    onSelectSite,
    onOpenApiKeys,
  ]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const q = query.toLowerCase().trim();
    return allItems.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
        item.category.toLowerCase().includes(q)
    );
  }, [allItems, query]);

  // Handle keyboard events inside palette
  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (filteredItems.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredItems.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        item.action();
        onClose();
      }
    }
  }

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Search Input Bar */}
        <div className="palette-search-box">
          <svg className="palette-search-icon" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
              clipRule="evenodd"
            />
          </svg>
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Type a command or search knowledge bases..."
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleInputKeyDown}
          />
          <kbd className="palette-kbd">esc</kbd>
        </div>

        {/* Results List */}
        <div className="palette-list" ref={listRef}>
          {filteredItems.length === 0 ? (
            <div className="palette-empty">
              <span>No commands or bots found for &ldquo;{query}&rdquo;</span>
            </div>
          ) : (
            (() => {
              let currentIndex = 0;
              const groups: { [cat: string]: PaletteItem[] } = {};
              for (const item of filteredItems) {
                if (!groups[item.category]) groups[item.category] = [];
                groups[item.category].push(item);
              }

              return Object.entries(groups).map(([category, items]) => (
                <div key={category} className="palette-group">
                  <div className="palette-group-header">{category}</div>
                  {items.map((item) => {
                    const itemIdx = currentIndex++;
                    const isSelected = itemIdx === selectedIndex;

                    return (
                      <div
                        key={item.id}
                        data-index={itemIdx}
                        className={`palette-item ${isSelected ? "selected" : ""}`}
                        onClick={() => {
                          item.action();
                          onClose();
                        }}
                        onMouseEnter={() => setSelectedIndex(itemIdx)}
                      >
                        <div className="palette-item-icon">{item.icon}</div>
                        <div className="palette-item-text">
                          <span className="palette-item-title">{item.title}</span>
                          {item.subtitle && (
                            <span className="palette-item-sub">{item.subtitle}</span>
                          )}
                        </div>
                        {item.badge && (
                          <span
                            className={`palette-item-badge ${item.badge === "Active" ? "active" : ""}`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ));
            })()
          )}
        </div>

        {/* Palette Footer */}
        <div className="palette-footer">
          <div className="footer-keys">
            <span className="key-hint">
              <kbd className="kbd-pill">↑</kbd> <kbd className="kbd-pill">↓</kbd> Navigate
            </span>
            <span className="key-hint">
              <kbd className="kbd-pill">↵</kbd> Select
            </span>
            <span className="key-hint">
              <kbd className="kbd-pill">esc</kbd> Close
            </span>
          </div>
          <span className="footer-branding">Web RAG Command Center</span>
        </div>
      </div>

      <style jsx>{`
        .palette-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 14vh;
          z-index: 10000;
          animation: fadeIn 0.12s ease;
        }

        .palette-dialog {
          width: 100%;
          max-width: 580px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* Search Box */
        .palette-search-box {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-surface);
        }

        .palette-search-icon {
          width: 16px;
          height: 16px;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .palette-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 0.9rem;
          font-family: inherit;
        }

        .palette-input::placeholder {
          color: var(--text-muted);
        }

        .palette-kbd {
          font-family: monospace;
          font-size: 0.68rem;
          color: var(--text-muted);
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 2px 5px;
          border-radius: var(--radius-micro);
        }

        /* Results List */
        .palette-list {
          max-height: 380px;
          overflow-y: auto;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .palette-empty {
          padding: 36px 16px;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.84rem;
        }

        .palette-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .palette-group-header {
          padding: 8px 10px 4px;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--text-muted);
        }

        .palette-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.12s ease;
          border: 1px solid transparent;
        }

        .palette-item.selected {
          background: var(--bg-hover);
          border-color: var(--border-hover);
        }

        .palette-item-icon {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-micro);
          background: var(--bg-card);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .palette-item.selected .palette-item-icon {
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .palette-item-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .palette-item-title {
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .palette-item.selected .palette-item-title {
          color: var(--text-primary);
        }

        .palette-item-sub {
          font-size: 0.7rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .palette-item-badge {
          font-size: 0.65rem;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: var(--radius-micro);
          background: var(--bg-card);
          color: var(--text-muted);
          border: 1px solid var(--border);
        }

        .palette-item-badge.active {
          background: var(--bg-card);
          border-color: var(--border-hover);
          color: var(--accent);
          font-weight: 600;
        }

        /* Footer */
        .palette-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          background: var(--bg-surface);
          border-top: 1px solid var(--border);
          font-size: 0.7rem;
          color: var(--text-muted);
        }

        .footer-keys {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .key-hint {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }

        .kbd-pill {
          font-family: monospace;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-micro);
          padding: 1px 4px;
          font-size: 0.65rem;
          color: var(--text-secondary);
        }

        .footer-branding {
          font-size: 0.68rem;
          font-family: monospace;
          color: var(--text-muted);
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes scaleUp {
          from {
            transform: scale(0.97);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
