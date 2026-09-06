"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BotCard, type SiteSummary } from "@/components/BotCard";
import { UrlInput } from "@/components/UrlInput";
import { ChatWindow } from "@/components/ChatWindow";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type View = "home" | "chat";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function HomePage() {
  // ── navigation ──────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("home");
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ── sites ────────────────────────────────────────────────────────────────
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);

  const isAdmin = true;

  function handleUnauthorized() {
    // API said 401 — no longer applicable, but kept for compatibility just in case
  }

  // ── add-bot modal ────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [modalName, setModalName] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalUrl, setModalUrl] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalDeepCrawl, setModalDeepCrawl] = useState(false);
  const [modalProgress, setModalProgress] = useState<{ current: number; total: number } | null>(null);
  const modalNameRef = useRef<HTMLInputElement>(null);

  // ── page manager (admin, chat view) ──────────────────────────────────────
  const [pagesOpen, setPagesOpen] = useState(false);
  const [refreshingPageId, setRefreshingPageId] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // ── data loading ─────────────────────────────────────────────────────────
  const loadSites = useCallback(async () => {
    try {
      const res = await fetch("/api/sites");
      const data = await res.json();
      if (res.ok) setSites(data.sites ?? []);
    } catch {
      /* ignore on first paint */
    } finally {
      setSitesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  // Sync selectedSite from latest sites list after refresh
  useEffect(() => {
    if (!selectedSite) return;
    const fresh = sites.find((s) => s.id === selectedSite.id);
    if (fresh) setSelectedSite(fresh);
  }, [sites]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── navigation handlers ──────────────────────────────────────────────────
  function openChat(site: SiteSummary) {
    setSelectedSite(site);
    setSessionId(site.latestSessionId);
    setView("chat");
    setPagesOpen(false);
    setRefreshError(null);
  }

  function goHome() {
    setView("home");
    setSelectedSite(null);
    setSessionId(null);
  }

  // ── add-bot modal ────────────────────────────────────────────────────────
  function openModal() {
    setShowModal(true);
    setModalName("");
    setModalDesc("");
    setModalUrl("");
    setModalError(null);
    setTimeout(() => modalNameRef.current?.focus(), 80);
  }

  function closeModal() {
    setShowModal(false);
    setModalError(null);
  }

  async function handleAddBot(e: FormEvent) {
    e.preventDefault();
    setModalError(null);

    const url = modalUrl.trim();
    if (!url) {
      setModalError("URL is required.");
      return;
    }

    setModalLoading(true);
    setModalProgress(null);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      let urlsToScrape = [url];
      if (modalDeepCrawl) {
        setModalProgress({ current: 0, total: 1 }); // Indeterminate state
        const crawlRes = await fetch("/api/crawl", {
          method: "POST",
          headers,
          body: JSON.stringify({ url }),
        });
        if (!crawlRes.ok) throw new Error("Crawl failed to discover links");
        const crawlData = await crawlRes.json();
        if (crawlData.urls && crawlData.urls.length > 0) {
          urlsToScrape = crawlData.urls;
        }
      }

      let createdSiteId: string | null = null;

      for (let i = 0; i < urlsToScrape.length; i++) {
        const u = urlsToScrape[i];
        if (modalDeepCrawl) setModalProgress({ current: i + 1, total: urlsToScrape.length });
        
        const scrapeRes: Response = await fetch("/api/scrape", {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: u,
            name: i === 0 ? (modalName.trim() || undefined) : undefined,
            description: i === 0 ? (modalDesc.trim() || undefined) : undefined,
            siteId: createdSiteId || undefined
          }),
        });

        const scrapeData: any = await scrapeRes.json();
        if (scrapeRes.status === 401) {
          setModalError("Unauthorized.");
          return;
        }
        if (!scrapeRes.ok) {
          if (i === 0) throw new Error(scrapeData.error || "Scrape failed");
          else continue; // ignore subsequent failures in deep crawl
        }
        if (i === 0) createdSiteId = scrapeData.siteId;
      }

      await loadSites();
      closeModal();
      // Auto-navigate to the new bot
      const fresh = await fetch("/api/sites").then((r) => r.json());
      const newSite = (fresh.sites as SiteSummary[]).find(
        (s) => s.id === createdSiteId
      );
      if (newSite) openChat(newSite);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed to add bot");
    } finally {
      setModalLoading(false);
      setModalProgress(null);
    }
  }

  // ── per-page refresh (admin, chat view) ──────────────────────────────────
  async function refreshPage(pageId: string) {
    setRefreshError(null);
    setRefreshingPageId(pageId);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      const res = await fetch("/api/scrape", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ pageId }),
      });
      const data = await res.json();

      if (res.status === 401) {
        setRefreshError("Unauthorized.");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Refresh failed");

      await loadSites();
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshingPageId(null);
    }
  }

  // ── delete bot ──────────────────────────────────────────────────────────
  async function handleDeleteSite(siteId: string) {
    if (!confirm("Are you sure you want to delete this bot? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete bot");
      loadSites();
    } catch (err: any) {
      alert(err.message || "Failed to delete bot");
    }
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="root">
      {/* ================================================================ */}
      {/* HOME VIEW                                                         */}
      {/* ================================================================ */}
      {view === "home" && (
        <div className="home">
          {/* Header */}
          <header className="home-header">
            <div className="home-brand">
              <span className="home-logo">⚡</span>
              <div>
                <h1 className="home-title">Web RAG</h1>
                <p className="home-sub">AI bots trained on your docs</p>
              </div>
            </div>

          </header>

          {/* Bot grid */}
          <main className="bot-grid-section">
            {sitesLoading ? (
              <p className="grid-empty">Loading bots…</p>
            ) : sites.length === 0 && !isAdmin ? (
              <div className="grid-empty-state">
                <p className="empty-icon">🤖</p>
                <p className="empty-title">No bots yet</p>
                <p className="empty-sub">
                  Click the button below to add your first bot.
                </p>
              </div>
            ) : (
              <div className="bot-grid">
                {sites.map((s) => (
                  <BotCard key={s.id} site={s} onClick={() => openChat(s)} onDelete={handleDeleteSite} />
                ))}

                {/* Admin: Add bot card */}
                {isAdmin && (
                  <button
                    type="button"
                    className="add-bot-card"
                    onClick={openModal}
                    title="Add a new bot"
                  >
                    <span className="add-bot-icon">+</span>
                    <span className="add-bot-label">Add new bot</span>
                  </button>
                )}
              </div>
            )}
          </main>

          {/* Footer */}
          <footer className="home-footer">
            <span>Scrape → chunk → embed → pgvector → Groq</span>
          </footer>
        </div>
      )}

      {/* ================================================================ */}
      {/* CHAT VIEW                                                         */}
      {/* ================================================================ */}
      {view === "chat" && selectedSite && (
        <div className="chat-layout">
          {/* Top nav bar */}
          <nav className="chat-nav">
            <button type="button" className="back-btn" onClick={goHome}>
              ← All bots
            </button>
            <div className="chat-site-info">
              <span className="chat-site-name">{selectedSite.name}</span>
              {selectedSite.description && (
                <span className="chat-site-desc">{selectedSite.description}</span>
              )}
            </div>

          </nav>

          {/* Chat window */}
          <div className="chat-body">
            <ChatWindow
              siteId={selectedSite.id}
              sessionId={sessionId}
              onSessionId={setSessionId}
              siteTitle={selectedSite.name}
            />
          </div>

          {/* Admin: page manager */}
          {isAdmin && (
            <div className="page-manager">
              <button
                type="button"
                className="pages-toggle"
                onClick={() => setPagesOpen((v) => !v)}
              >
                {pagesOpen ? "▲" : "▼"} Pages ({selectedSite.pages.length})
              </button>

              {pagesOpen && (
                <div className="pages-panel">
                  {refreshError && (
                    <p className="pages-error">{refreshError}</p>
                  )}
                  <ul className="pages-list">
                    {selectedSite.pages.map((p) => (
                      <li key={p.id} className="page-row">
                        <div className="page-info">
                          <a
                            href={p.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="page-url"
                            title={p.url}
                          >
                            {p.url.replace(/^https?:\/\//, "")}
                          </a>
                          <span className="page-meta">
                            {p.chunkCount} chunks ·{" "}
                            {new Date(p.scrapedAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="refresh-btn"
                          disabled={refreshingPageId === p.id}
                          onClick={() => refreshPage(p.id)}
                        >
                          {refreshingPageId === p.id ? "…" : "Refresh"}
                        </button>
                      </li>
                    ))}
                  </ul>

                  <div className="add-page-wrap">
                    <span className="add-page-label">Add page</span>
                    <UrlInput
                      siteId={selectedSite.id}
                      onUnauthorized={handleUnauthorized}
                      compact
                      onScraped={async () => {
                        await loadSites();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================ */}
      {/* ADD BOT MODAL                                                     */}
      {/* ================================================================ */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <header className="modal-header">
              <h2 id="modal-title" className="modal-title">
                Add new bot
              </h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                aria-label="Close"
              >
                ✕
              </button>
            </header>

            <form onSubmit={handleAddBot} className="modal-form">
              <label className="field-label" htmlFor="bot-name">
                Bot name
              </label>
              <input
                id="bot-name"
                ref={modalNameRef}
                type="text"
                className="field-input"
                placeholder="e.g., Next.js Docs, React Reference…"
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                disabled={modalLoading}
              />

              <label className="field-label" htmlFor="bot-desc">
                Description{" "}
                <span className="field-optional">(optional)</span>
              </label>
              <textarea
                id="bot-desc"
                className="field-textarea"
                placeholder="Short description of what this bot knows…"
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                disabled={modalLoading}
                rows={2}
              />

              <label className="field-label" htmlFor="bot-url">
                First page URL
              </label>
              <input
                id="bot-url"
                type="url"
                className="field-input"
                placeholder="https://docs.example.com/getting-started"
                value={modalUrl}
                onChange={(e) => setModalUrl(e.target.value)}
                disabled={modalLoading}
                required
              />

              {modalError && (
                <p className="modal-error">{modalError}</p>
              )}

              <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.5rem", fontSize: "0.9rem", color: "#888" }}>
                <input 
                  type="checkbox" 
                  checked={modalDeepCrawl} 
                  onChange={(e) => setModalDeepCrawl(e.target.checked)} 
                  disabled={modalLoading}
                />
                Deep Crawl (discover &amp; scrape up to 100 pages, 2 levels deep)
              </label>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel"
                  onClick={closeModal}
                  disabled={modalLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-submit"
                  disabled={modalLoading || !modalUrl.trim()}
                >
                  {modalLoading ? (modalProgress ? (modalProgress.total > 1 ? `Scraping ${modalProgress.current}/${modalProgress.total}…` : "Discovering pages…") : "Indexing…") : "Scrape & add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================ */}
      {/* STYLES                                                            */}
      {/* ================================================================ */}
      <style jsx>{`
        /* ── Root ─────────────────────────────────────────────────────── */
        .root {
          min-height: 100vh;
        }

        /* ── Home view ────────────────────────────────────────────────── */
        .home {
          max-width: 960px;
          margin: 0 auto;
          padding: 2.5rem 1.25rem 4rem;
          display: flex;
          flex-direction: column;
          gap: 2rem;
          animation: fadeUp 0.45s ease both;
        }

        /* Header */
        .home-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .home-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .home-logo {
          font-size: 2rem;
          line-height: 1;
          filter: drop-shadow(0 0 12px rgba(61,156,240,0.5));
        }
        .home-title {
          margin: 0;
          font-size: clamp(1.5rem, 3.5vw, 2rem);
          font-weight: 700;
          letter-spacing: -0.03em;
          color: var(--text);
        }
        .home-sub {
          margin: 0.15rem 0 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        /* Grid */
        .bot-grid-section {
          flex: 1;
        }
        .bot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
          gap: 1rem;
        }

        /* Add bot card */
        .add-bot-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 1.2rem;
          background: transparent;
          border: 1.5px dashed var(--border);
          border-radius: 14px;
          color: var(--text-muted);
          min-height: 160px;
          transition: border-color 0.15s ease, color 0.15s ease,
            background 0.15s ease;
          cursor: pointer;
        }
        .add-bot-card:hover {
          border-color: var(--accent-dim);
          color: var(--accent);
          background: var(--accent-soft);
        }
        .add-bot-icon {
          font-size: 1.8rem;
          line-height: 1;
          font-weight: 300;
        }
        .add-bot-label {
          font-size: 0.85rem;
          font-weight: 500;
        }

        /* Empty states */
        .grid-empty {
          color: var(--text-muted);
          font-size: 0.9rem;
          text-align: center;
          padding: 3rem 0;
        }
        .grid-empty-state {
          text-align: center;
          padding: 4rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }
        .empty-icon {
          font-size: 3rem;
          margin: 0;
        }
        .empty-title {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }
        .empty-sub {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.88rem;
          max-width: 28rem;
        }

        /* Footer */
        .home-footer {
          text-align: center;
          font-size: 0.72rem;
          font-family: var(--font-mono);
          color: var(--text-muted);
          opacity: 0.6;
        }

        /* ── Chat view ────────────────────────────────────────────────── */
        .chat-layout {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 820px;
          margin: 0 auto;
          padding: 0 1rem;
          animation: fadeUp 0.3s ease both;
        }

        /* Nav bar */
        .chat-nav {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 0;
          border-bottom: 1px solid var(--border);
          flex-wrap: wrap;
        }
        .back-btn {
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 500;
          padding: 0.25rem 0.5rem;
          border-radius: 6px;
          transition: background 0.12s ease;
          white-space: nowrap;
        }
        .back-btn:hover {
          background: var(--accent-soft);
        }
        .chat-site-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .chat-site-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-site-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Chat body */
        .chat-body {
          flex: 1;
          min-height: 0;
          padding: 0.75rem 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Page manager */
        .page-manager {
          border-top: 1px solid var(--border);
          padding: 0.5rem 0 0.75rem;
          font-size: 0.82rem;
        }
        .pages-toggle {
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 500;
          padding: 0.25rem 0;
          cursor: pointer;
          transition: color 0.12s ease;
        }
        .pages-toggle:hover {
          color: var(--text);
        }
        .pages-panel {
          margin-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .pages-error {
          margin: 0;
          font-size: 0.8rem;
          color: var(--danger);
        }
        .pages-list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .page-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .page-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .page-url {
          font-size: 0.8rem;
          color: var(--accent);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .page-url:hover {
          text-decoration: underline;
        }
        .page-meta {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }
        .refresh-btn {
          flex-shrink: 0;
          padding: 0.22rem 0.55rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.7rem;
          font-weight: 500;
          transition: color 0.12s, border-color 0.12s;
        }
        .refresh-btn:hover:not(:disabled) {
          color: var(--accent);
          border-color: var(--accent-dim);
        }
        .add-page-wrap {
          border-top: 1px solid var(--border);
          padding-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .add-page-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        /* ── Add Bot Modal ────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.65);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 100;
          animation: fadeIn 0.15s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .modal {
          width: 100%;
          max-width: 480px;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          animation: scaleIn 0.2s ease;
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.1rem 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .modal-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }
        .modal-close {
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.9rem;
          width: 28px;
          height: 28px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.12s ease, color 0.12s ease;
        }
        .modal-close:hover {
          background: var(--accent-soft);
          color: var(--text);
        }
        .modal-form {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .field-label {
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.02em;
          margin-top: 0.25rem;
        }
        .field-optional {
          font-weight: 400;
          opacity: 0.7;
        }
        .field-input,
        .field-textarea {
          width: 100%;
          padding: 0.65rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-input);
          color: var(--text);
          font-size: 0.9rem;
          outline: none;
          transition: border-color 0.15s ease;
          resize: vertical;
        }
        .field-input:focus,
        .field-textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 3px var(--accent-soft);
        }
        .modal-error {
          margin: 0.25rem 0 0;
          font-size: 0.83rem;
          color: var(--danger);
        }
        .modal-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          margin-top: 0.5rem;
        }
        .modal-cancel {
          padding: 0.6rem 1rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: transparent;
          color: var(--text-muted);
          font-size: 0.88rem;
          transition: border-color 0.12s ease;
        }
        .modal-cancel:hover:not(:disabled) {
          border-color: var(--text-muted);
          color: var(--text);
        }
        .modal-submit {
          padding: 0.6rem 1.25rem;
          border: none;
          border-radius: var(--radius);
          background: var(--accent);
          color: #fff;
          font-size: 0.88rem;
          font-weight: 600;
          transition: opacity 0.15s ease;
        }
        .modal-submit:hover:not(:disabled) {
          opacity: 0.85;
        }

        /* ── Shared animations ────────────────────────────────────────── */
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
