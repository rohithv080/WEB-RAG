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
          icon: "+",
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
        icon: "💬",
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
        icon: "📁",
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
        icon: "📊",
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
        icon: "⚙️",
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
        icon: "</>",
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
          icon: "↻",
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
      icon: "+",
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
        icon: "🔑",
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
        icon: "◀ / ▶",
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
      icon: "🏠",
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
        icon: "🤖",
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
          backdrop-filter: blur(10px);
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 14vh;
          z-index: 10000;
          animation: fadeIn 0.12s ease;
        }

        .palette-dialog {
          width: 100%;
          max-width: 620px;
          background: #0d0e15;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          box-shadow:
            0 24px 64px rgba(0, 0, 0, 0.8),
            0 0 0 1px rgba(124, 124, 255, 0.15);
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
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .palette-search-icon {
          width: 18px;
          height: 18px;
          color: #8a8f98;
          flex-shrink: 0;
        }

        .palette-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #f4f4f5;
          font-size: 0.95rem;
          font-family: inherit;
        }

        .palette-input::placeholder {
          color: #71717a;
        }

        .palette-kbd {
          font-family: ui-monospace, monospace;
          font-size: 0.68rem;
          color: #71717a;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 2px 5px;
          border-radius: 4px;
        }

        /* Results List */
        .palette-list {
          max-height: 380px;
          overflow-y: auto;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .palette-empty {
          padding: 36px 16px;
          text-align: center;
          color: #71717a;
          font-size: 0.84rem;
        }

        .palette-group {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .palette-group-header {
          padding: 6px 10px 4px;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #71717a;
        }

        .palette-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.1s ease;
          border: 1px solid transparent;
        }

        .palette-item.selected {
          background: rgba(124, 124, 255, 0.12);
          border-color: rgba(124, 124, 255, 0.25);
        }

        .palette-item-icon {
          width: 24px;
          height: 24px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.82rem;
          color: #c7d2fe;
          flex-shrink: 0;
        }

        .palette-item.selected .palette-item-icon {
          background: rgba(124, 124, 255, 0.25);
          color: #ffffff;
        }

        .palette-item-text {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .palette-item-title {
          font-size: 0.84rem;
          font-weight: 500;
          color: #f4f4f5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .palette-item.selected .palette-item-title {
          color: #ffffff;
          font-weight: 600;
        }

        .palette-item-sub {
          font-size: 0.7rem;
          color: #8a8f98;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .palette-item-badge {
          font-size: 0.65rem;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.05);
          color: #a1a1aa;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .palette-item-badge.active {
          background: rgba(16, 185, 129, 0.15);
          border-color: rgba(16, 185, 129, 0.3);
          color: #34d399;
        }

        /* Footer */
        .palette-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 14px;
          background: rgba(0, 0, 0, 0.4);
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.7rem;
          color: #71717a;
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
          font-family: ui-monospace, monospace;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 3px;
          padding: 1px 4px;
          font-size: 0.65rem;
          color: #a1a1aa;
        }

        .footer-branding {
          font-size: 0.68rem;
          font-family: ui-monospace, monospace;
          color: #52525b;
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
