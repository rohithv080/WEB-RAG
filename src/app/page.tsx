"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { BotCard, type SiteSummary } from "@/components/BotCard";
import { UrlInput } from "@/components/UrlInput";
import { ChatWindow } from "@/components/ChatWindow";
import { Sidebar } from "@/components/Sidebar";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ToastProvider, useToast } from "@/components/Toast";
import { EmbedModal } from "@/components/EmbedModal";
import { BotSettingsModal } from "@/components/BotSettingsModal";
import { AnalyticsModal } from "@/components/AnalyticsModal";
import { Show, SignInButton, SignUpButton, SignOutButton } from "@clerk/nextjs";

// ─────────────────────────────────────────────────────────────────────────────
// Inner app (needs ToastProvider context)
// ─────────────────────────────────────────────────────────────────────────────

type View = "home" | "chat";

function AppInner() {
  const { addToast } = useToast();

  // ── navigation ──────────────────────────────────────────────────────────
  const [view, setView] = useState<View>("home");
  const [selectedSite, setSelectedSite] = useState<SiteSummary | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // ── sites ────────────────────────────────────────────────────────────────
  const [sites, setSites] = useState<SiteSummary[]>([]);
  const [sitesLoading, setSitesLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminScope, setAdminScope] = useState<"user" | "all">("user");

  // ── modal ────────────────────────────────────────────────────────────────
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"url" | "file">("url");
  const [modalFile, setModalFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modalName, setModalName] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [modalUrl, setModalUrl] = useState("");
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalCrawlLimit, setModalCrawlLimit] = useState<number>(5);
  const [modalProgress, setModalProgress] = useState<{ current: number; total: number } | null>(null);
  const modalNameRef = useRef<HTMLInputElement>(null);

  // ── page manager ─────────────────────────────────────────────────────────
  const [pagesOpen, setPagesOpen] = useState(false);
  const [refreshingPageId, setRefreshingPageId] = useState<string | null>(null);

  // ── embed modal ──────────────────────────────────────────────────────────
  const [embedSite, setEmbedSite] = useState<SiteSummary | null>(null);
  const [showEmbedModal, setShowEmbedModal] = useState(false);

  function openEmbed(site: SiteSummary) {
    setEmbedSite(site);
    setShowEmbedModal(true);
  }

  // ── bot settings modal ───────────────────────────────────────────────────
  const [settingsSite, setSettingsSite] = useState<SiteSummary | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  function openSettings(site: SiteSummary) {
    setSettingsSite(site);
    setShowSettingsModal(true);
  }

  function handleSaveSettings(updatedSite: SiteSummary) {
    setSites((prev) => prev.map((s) => (s.id === updatedSite.id ? updatedSite : s)));
    if (selectedSite?.id === updatedSite.id) {
      setSelectedSite(updatedSite);
    }
    addToast(`Bot "${updatedSite.name}" updated!`, "success");
  }

  // ── bot analytics modal ──────────────────────────────────────────────────
  const [analyticsSite, setAnalyticsSite] = useState<SiteSummary | null>(null);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

  function openAnalytics(site: SiteSummary) {
    setAnalyticsSite(site);
    setShowAnalyticsModal(true);
  }

  // ── data loading ─────────────────────────────────────────────────────────
  const loadSites = useCallback(async () => {
    try {
      const url = adminScope === "all" ? "/api/sites?scope=all" : "/api/sites";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok) {
        setSites(data.sites ?? []);
        if (data.isAdmin !== undefined) setIsAdmin(Boolean(data.isAdmin));
      }
    } catch { /* ignore */ }
    finally { setSitesLoading(false); }
  }, [adminScope]);

  useEffect(() => { loadSites(); }, [loadSites]);

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
  }

  function goHome() {
    setView("home");
    setSelectedSite(null);
    setSessionId(null);
  }

  // ── modal ────────────────────────────────────────────────────────────────
  function openModal() {
    setShowModal(true);
    setModalMode("url");
    setModalFile(null);
    setModalName("");
    setModalDesc("");
    setModalUrl("");
    setModalCrawlLimit(5);
    setModalError(null);
    setTimeout(() => modalNameRef.current?.focus(), 80);
  }

  function handleFileSelect(file: File) {
    setModalFile(file);
    if (!modalName.trim()) {
      const base = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      const formatted = base.charAt(0).toUpperCase() + base.slice(1);
      setModalName(formatted);
    }
  }

  async function handleAddBot(e: FormEvent) {
    e.preventDefault();
    setModalError(null);

    if (modalMode === "file") {
      if (!modalFile) {
        setModalError("Please select a file to upload.");
        return;
      }

      setModalLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", modalFile);
        if (modalName.trim()) formData.append("siteName", modalName.trim());
        if (modalDesc.trim()) formData.append("siteDescription", modalDesc.trim());

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Upload failed");

        await loadSites();
        setShowModal(false);
        addToast(`Bot "${data.siteName}" created (${data.chunkCount} chunks)!`, "success");

        const fresh = await fetch("/api/sites").then((r) => r.json());
        const newSite = (fresh.sites as SiteSummary[]).find((s) => s.id === data.siteId);
        if (newSite) openChat(newSite);
      } catch (err: any) {
        setModalError(err.message || "Failed to upload file");
      } finally {
        setModalLoading(false);
      }
      return;
    }

    const url = modalUrl.trim();
    if (!url) { setModalError("URL is required."); return; }

    setModalLoading(true);
    setModalProgress(null);
    try {
      const headers = { "Content-Type": "application/json" };
      let urlsToScrape = [url];

      if (modalCrawlLimit > 1) {
        setModalProgress({ current: 0, total: 1 });
        const crawlRes = await fetch("/api/crawl", {
          method: "POST", headers, body: JSON.stringify({ url, maxPages: modalCrawlLimit }),
        });
        if (!crawlRes.ok) throw new Error("Crawl failed");
        const crawlData = await crawlRes.json();
        if (crawlData.urls?.length > 0) urlsToScrape = crawlData.urls;
      }

      let createdSiteId: string | null = null;

      for (let i = 0; i < urlsToScrape.length; i++) {
        if (modalCrawlLimit > 1) setModalProgress({ current: i + 1, total: urlsToScrape.length });
        const scrapeRes: Response = await fetch("/api/scrape", {
          method: "POST",
          headers,
          body: JSON.stringify({
            url: urlsToScrape[i],
            name: i === 0 ? (modalName.trim() || undefined) : undefined,
            description: i === 0 ? (modalDesc.trim() || undefined) : undefined,
            siteId: createdSiteId || undefined,
          }),
        });
        const scrapeData: any = await scrapeRes.json();
        if (!scrapeRes.ok) {
          if (i === 0) throw new Error(scrapeData.error || "Scrape failed");
          else continue;
        }
        if (i === 0) createdSiteId = scrapeData.siteId;
      }

      await loadSites();
      setShowModal(false);
      addToast("Bot created successfully!", "success");

      const fresh = await fetch("/api/sites").then((r) => r.json());
      const newSite = (fresh.sites as SiteSummary[]).find((s) => s.id === createdSiteId);
      if (newSite) openChat(newSite);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Failed");
    } finally {
      setModalLoading(false);
      setModalProgress(null);
    }
  }

  // ── page refresh ─────────────────────────────────────────────────────────
  async function refreshPage(pageId: string) {
    setRefreshingPageId(pageId);
    try {
      const res = await fetch("/api/scrape", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId }),
      });
      if (!res.ok) throw new Error("Refresh failed");
      await loadSites();
      addToast("Page refreshed!", "success");
    } catch (err: any) {
      addToast(err.message || "Refresh failed", "error");
    } finally {
      setRefreshingPageId(null);
    }
  }

  // ── delete ───────────────────────────────────────────────────────────────
  async function handleDeleteSite(siteId: string) {
    if (!confirm("Delete this bot? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      loadSites();
      if (selectedSite?.id === siteId) goHome();
      addToast("Bot deleted", "info");
    } catch (err: any) {
      addToast(err.message || "Delete failed", "error");
    }
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="app-layout">
      <Sidebar
        sites={sites}
        activeSiteId={selectedSite?.id ?? null}
        onSelect={openChat}
        onAddBot={openModal}
        onHome={goHome}
      />

      <main className="main-content">
        {/* ── HOME VIEW ─────────────────────────────────────────────── */}
        {view === "home" && (
          <div className="home-view">
            <header className="home-hero">
              <div className="hero-top-row">
                <div className="hero-badge">
                  <span className="badge-pulse" />
                  <span className="badge-text">Autonomous Knowledge Hub</span>
                  <span className="badge-sep">•</span>
                  <span className="badge-pill-tech">Hybrid BM25 + Jina Rerank v2</span>
                </div>

                <div className="hero-top-actions">
                  {isAdmin && (
                    <div className="admin-scope-toggle">
                      <button
                        type="button"
                        className={`admin-toggle-btn ${adminScope === "user" ? "active" : ""}`}
                        onClick={() => setAdminScope("user")}
                      >
                        My Bots
                      </button>
                      <button
                        type="button"
                        className={`admin-toggle-btn ${adminScope === "all" ? "active" : ""}`}
                        onClick={() => setAdminScope("all")}
                        title="View all bots created across the system"
                      >
                        🛡️ God Mode (All)
                      </button>
                    </div>
                  )}

                  <button type="button" className="hero-create-btn" onClick={openModal}>
                    <span className="hero-btn-icon">+</span>
                    <span>New Knowledge Bot</span>
                  </button>

                  <div className="hero-auth-slot">
                    <Show when="signed-in">
                      <SignOutButton>
                        <button className="hero-logout-btn" title="Sign out / Log out">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                          </svg>
                          <span>Log Out</span>
                        </button>
                      </SignOutButton>
                    </Show>
                    <Show when="signed-out">
                      <div className="hero-guest-auth">
                        <SignInButton mode="modal">
                          <button className="hero-signin-btn">Sign In</button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                          <button className="hero-signup-btn">Sign Up</button>
                        </SignUpButton>
                      </div>
                    </Show>
                  </div>
                </div>
              </div>

              <div className="hero-headings">
                <h1 className="hero-title">
                  Knowledge <span className="hero-title-highlight">Bots</span>
                </h1>
                <p className="hero-sub">
                  Production-grade conversational RAG trained on your web pages and uploaded documents. Multi-turn memory, cross-encoder precision, and 1-line website widget embedding.
                </p>
              </div>

              <div className="hero-stats-strip">
                <div className="stat-card">
                  <span className="stat-num">{sites.length}</span>
                  <span className="stat-lbl">Active Bots</span>
                </div>
                <div className="stat-card">
                  <span className="stat-num">
                    {sites.reduce((acc, s) => acc + (s.pages?.length || 0), 0).toLocaleString()}
                  </span>
                  <span className="stat-lbl">Indexed Sources</span>
                </div>
                <div className="stat-card">
                  <span className="stat-num">
                    {sites.reduce((acc, s) => acc + (s.totalChunks || 0), 0).toLocaleString()}
                  </span>
                  <span className="stat-lbl">Knowledge Chunks</span>
                </div>
                <div className="stat-card stat-card-status">
                  <div className="status-row">
                    <span className="pulse-dot" />
                    <span className="status-online">Operational</span>
                  </div>
                  <span className="stat-lbl">Llama 3.3 70B · Groq Free</span>
                </div>
              </div>
            </header>

            {sitesLoading ? (
              <Skeleton count={3} />
            ) : sites.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="bot-grid">
                {sites.map((s) => (
                  <BotCard
                    key={s.id}
                    site={s}
                    onClick={() => openChat(s)}
                    onDelete={handleDeleteSite}
                    onEmbed={openEmbed}
                    onSettings={openSettings}
                    onAnalytics={openAnalytics}
                  />
                ))}
                <button type="button" className="add-bot-card" onClick={openModal}>
                  <div className="add-bot-circle">
                    <span className="add-bot-icon">+</span>
                  </div>
                  <div className="add-bot-info">
                    <span className="add-bot-title">Deploy New Bot</span>
                    <span className="add-bot-desc">Crawl web URL or drop PDF / Docs</span>
                  </div>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT VIEW ─────────────────────────────────────────────── */}
        {view === "chat" && selectedSite && (
          <div className="chat-view">
            <nav className="chat-nav">
              <button className="back-btn" onClick={goHome}>← Back</button>
              <div className="chat-site-info">
                <span className="chat-site-name">{selectedSite.name}</span>
                {selectedSite.description && (
                  <span className="chat-site-desc">{selectedSite.description}</span>
                )}
              </div>
              <div className="chat-nav-actions">
                <button
                  type="button"
                  className="chat-analytics-btn"
                  onClick={() => openAnalytics(selectedSite)}
                  title="View bot analytics, query logs & metrics"
                >
                  📊 Analytics
                </button>
                <button
                  type="button"
                  className="chat-settings-btn"
                  onClick={() => openSettings(selectedSite)}
                  title="Customize bot persona, tone & prompts"
                >
                  ⚙️ Settings
                </button>
                <button
                  type="button"
                  className="chat-embed-btn"
                  onClick={() => openEmbed(selectedSite)}
                  title="Get 1-line embed snippet for your website"
                >
                  &lt;/&gt; Embed
                </button>
              </div>
            </nav>

            <div className="chat-body">
              <ChatWindow
                siteId={selectedSite.id}
                sessionId={sessionId}
                onSessionId={setSessionId}
                siteTitle={selectedSite.name}
                starterQuestions={selectedSite.starterQuestions as string[] | null}
              />
            </div>

            {/* Page manager */}
            <div className="page-manager">
              <button className="pages-toggle" onClick={() => setPagesOpen((v) => !v)}>
                {pagesOpen ? "▲" : "▼"} Pages ({selectedSite.pages.length})
              </button>
              {pagesOpen && (
                <div className="pages-panel">
                  <ul className="pages-list">
                    {selectedSite.pages.map((p) => (
                      <li key={p.id} className="page-row">
                        <div className="page-info">
                          <a href={p.url} target="_blank" rel="noopener noreferrer" className="page-url">
                            {p.url.replace(/^https?:\/\//, "")}
                          </a>
                          <span className="page-meta">
                            {p.chunkCount} chunks · {new Date(p.scrapedAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          className="refresh-btn"
                          disabled={refreshingPageId === p.id}
                          onClick={() => refreshPage(p.id)}
                        >
                          {refreshingPageId === p.id ? "…" : "↻"}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="add-page-wrap">
                    <UrlInput
                      siteId={selectedSite.id}
                      compact
                      onScraped={async () => { await loadSites(); addToast("Page added!", "success"); }}
                    />
                    <div className="doc-upload-divider">
                      <span>or</span>
                    </div>
                    <label className="doc-upload-btn">
                      📎 Upload Document (PDF/TXT)
                      <input
                        type="file"
                        accept=".pdf,.txt,.md,.markdown,.csv,.json"
                        style={{ display: "none" }}
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            const formData = new FormData();
                            formData.append("file", f);
                            formData.append("siteId", selectedSite.id);
                            addToast(`Uploading & indexing ${f.name}…`, "info");
                            const res = await fetch("/api/upload", { method: "POST", body: formData });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || "Upload failed");
                            await loadSites();
                            addToast(`Added ${f.name} (${data.chunkCount} chunks)!`, "success");
                          } catch (err: any) {
                            addToast(err.message || "Upload failed", "error");
                          } finally {
                            e.target.value = "";
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── ADD BOT MODAL ─────────────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()}>
            <header className="modal-header">
              <h2 className="modal-title">Add new bot</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </header>

            {/* Mode Switcher */}
            <div className="modal-mode-tabs">
              <button
                type="button"
                className={`mode-tab ${modalMode === "url" ? "active" : ""}`}
                onClick={() => setModalMode("url")}
                disabled={modalLoading}
              >
                🌐 Website URL
              </button>
              <button
                type="button"
                className={`mode-tab ${modalMode === "file" ? "active" : ""}`}
                onClick={() => setModalMode("file")}
                disabled={modalLoading}
              >
                📄 Upload Document (PDF / Text)
              </button>
            </div>

            <form onSubmit={handleAddBot} className="modal-form">
              <label className="field-label">Bot name</label>
              <input
                ref={modalNameRef}
                className="field-input"
                placeholder={modalMode === "file" ? "e.g., Biology Textbook" : "e.g., Next.js Docs"}
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                disabled={modalLoading}
              />

              <label className="field-label">
                Description <span className="field-optional">(optional)</span>
              </label>
              <textarea
                className="field-textarea"
                placeholder="Short description…"
                value={modalDesc}
                onChange={(e) => setModalDesc(e.target.value)}
                disabled={modalLoading}
                rows={2}
              />

              {modalMode === "file" ? (
                <div className="file-dropzone-wrapper">
                  <label className="field-label">Select Document</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md,.markdown,.csv,.json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                    }}
                  />
                  {!modalFile ? (
                    <div
                      className="file-dropzone"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0];
                        if (f) handleFileSelect(f);
                      }}
                    >
                      <div className="dropzone-icon">📄</div>
                      <div className="dropzone-text">
                        <strong>Click to browse</strong> or drag & drop file
                      </div>
                      <div className="dropzone-sub">
                        Supports PDF, TXT, Markdown, CSV, JSON
                      </div>
                    </div>
                  ) : (
                    <div className="file-selected-card">
                      <div className="file-selected-icon">📄</div>
                      <div className="file-selected-info">
                        <span className="file-selected-name">{modalFile.name}</span>
                        <span className="file-selected-size">
                          {(modalFile.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                      <button
                        type="button"
                        className="file-remove-btn"
                        onClick={() => setModalFile(null)}
                        disabled={modalLoading}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <label className="field-label">First page URL</label>
                  <input
                    type="url"
                    className="field-input"
                    placeholder="https://docs.example.com"
                    value={modalUrl}
                    onChange={(e) => setModalUrl(e.target.value)}
                    disabled={modalLoading}
                    required={modalMode === "url"}
                  />

                  <div className="crawl-options-wrapper">
                    <div className="crawl-options-header">
                      <span className="crawl-options-title">Crawl Scope</span>
                      <span className="vercel-badge">⚡ Vercel-Optimized</span>
                    </div>
                    <div className="crawl-pills-grid">
                      {[
                        { count: 1, label: "1 Page", tag: "⚡ Single", desc: "Instant (~2s)" },
                        { count: 5, label: "5 Pages", tag: "🚀 Quick", desc: "Fast & safe (~10s)" },
                        { count: 15, label: "15 Pages", tag: "⭐ Best", desc: "Recommended (~25s)" },
                        { count: 30, label: "30 Pages", tag: "📚 Deep", desc: "Thorough (~50s)" },
                        { count: 100, label: "100 Pages", tag: "🌐 Full", desc: "Complete (2-3m)" },
                      ].map((opt) => (
                        <button
                          key={opt.count}
                          type="button"
                          className={`crawl-pill ${modalCrawlLimit === opt.count ? "active" : ""}`}
                          onClick={() => setModalCrawlLimit(opt.count)}
                          disabled={modalLoading}
                        >
                          <div className="pill-top">
                            <span className="pill-label">{opt.label}</span>
                            <span className="pill-tag">{opt.tag}</span>
                          </div>
                          <span className="pill-desc">{opt.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {modalError && <p className="modal-error">{modalError}</p>}

              <div className="modal-actions">
                <button type="button" className="modal-cancel" onClick={() => setShowModal(false)} disabled={modalLoading}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-submit"
                  disabled={modalLoading || (modalMode === "url" ? !modalUrl.trim() : !modalFile)}
                >
                  {modalLoading
                    ? modalMode === "file"
                      ? "Uploading & Indexing…"
                      : modalProgress
                      ? `Scraping ${modalProgress.current}/${modalProgress.total}…`
                      : "Indexing…"
                    : modalMode === "file"
                    ? "Upload & Create Bot"
                    : "Scrape & add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── EMBED WIDGET MODAL ─────────────────────────────────────── */}
      <EmbedModal
        site={embedSite}
        isOpen={showEmbedModal}
        onClose={() => setShowEmbedModal(false)}
      />

      {/* ── BOT SETTINGS MODAL ───────────────────────────────────── */}
      <BotSettingsModal
        site={settingsSite}
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSave={handleSaveSettings}
      />

      {/* ── BOT ANALYTICS MODAL ─────────────────────────────────── */}
      <AnalyticsModal
        site={analyticsSite}
        isOpen={showAnalyticsModal}
        onClose={() => setShowAnalyticsModal(false)}
      />

      <style jsx>{`
        /* ── App Layout ────────────────────────────────────────────── */
        .app-layout {
          display: flex;
          min-height: 100vh;
        }
        .main-content {
          flex: 1;
          margin-left: var(--sidebar-width);
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }

        /* ── Home View ─────────────────────────────────────────────── */
        .home-view {
          max-width: 1040px;
          width: 100%;
          margin: 0 auto;
          padding: 2.5rem 2rem 5rem;
          animation: fadeUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .home-hero {
          margin-bottom: 2.5rem;
          padding: 2rem 2.2rem;
          border-radius: var(--radius-xl);
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0%, rgba(255, 255, 255, 0.01) 100%),
                      var(--surface);
          border: 1px solid var(--border-subtle);
          box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          position: relative;
          overflow: hidden;
        }

        .home-hero::before {
          content: "";
          position: absolute;
          top: -80px;
          right: -60px;
          width: 360px;
          height: 360px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(79, 110, 247, 0.16) 0%, transparent 70%);
          filter: blur(40px);
          pointer-events: none;
        }

        .hero-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.3rem 0.75rem;
          border-radius: 999px;
          background: rgba(79, 110, 247, 0.08);
          border: 1px solid rgba(79, 110, 247, 0.22);
          font-size: 0.76rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .badge-pulse {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.8);
          animation: pulse 2s infinite;
        }

        .badge-text {
          color: #e2e8f0;
          font-weight: 600;
        }

        .badge-sep {
          color: rgba(255, 255, 255, 0.2);
        }

        .badge-pill-tech {
          color: #a5b4fc;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .hero-top-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        .admin-scope-toggle {
          display: flex;
          align-items: center;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(192, 132, 252, 0.3);
          border-radius: var(--radius-md);
          padding: 2px;
          box-shadow: 0 0 12px rgba(192, 132, 252, 0.15);
        }

        .admin-toggle-btn {
          padding: 0.38rem 0.75rem;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 600;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .admin-toggle-btn.active {
          background: linear-gradient(135deg, rgba(168, 85, 247, 0.25) 0%, rgba(129, 140, 248, 0.25) 100%);
          color: #f1f5f9;
          border-color: rgba(192, 132, 252, 0.4);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .hero-create-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          padding: 0.55rem 1.1rem;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #4f6ef7 0%, #3b82f6 100%);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .hero-create-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
          background: linear-gradient(135deg, #5b79fc 0%, #4388ff 100%);
        }

        .hero-auth-slot {
          display: flex;
          align-items: center;
        }

        .hero-logout-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.55rem 0.95rem;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-muted);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .hero-logout-btn:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.4);
          background: rgba(248, 113, 113, 0.08);
        }

        .hero-guest-auth {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .hero-signin-btn {
          padding: 0.52rem 0.9rem;
          border-radius: var(--radius-md);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: var(--text);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .hero-signin-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.22);
          color: #ffffff;
        }

        .hero-signup-btn {
          padding: 0.52rem 0.95rem;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, rgba(79, 110, 247, 0.25) 0%, rgba(139, 92, 246, 0.25) 100%);
          border: 1px solid rgba(129, 140, 248, 0.4);
          color: #e0e7ff;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .hero-signup-btn:hover {
          background: linear-gradient(135deg, rgba(79, 110, 247, 0.4) 0%, rgba(139, 92, 246, 0.4) 100%);
          border-color: rgba(129, 140, 248, 0.6);
          color: #ffffff;
          box-shadow: 0 0 16px rgba(79, 110, 247, 0.3);
        }

        .hero-btn-icon {
          font-size: 1.1rem;
          line-height: 1;
        }

        .hero-headings {
          margin-bottom: 1.5rem;
        }

        .hero-title {
          margin: 0 0 0.45rem;
          font-size: 2.2rem;
          font-weight: 800;
          letter-spacing: -0.035em;
          color: #ffffff;
          line-height: 1.15;
        }

        .hero-title-highlight {
          background: linear-gradient(135deg, #60a5fa 0%, #c084fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .hero-sub {
          margin: 0;
          font-size: 0.94rem;
          color: var(--text-muted);
          max-width: 620px;
          line-height: 1.55;
        }

        .hero-stats-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.85rem;
          margin-top: 1.25rem;
          padding-top: 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.07);
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.6rem 0.85rem;
          border-radius: var(--radius-sm);
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .stat-num {
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.03em;
          color: #f8fafc;
          font-family: var(--font-mono);
        }

        .stat-lbl {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .status-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          margin-bottom: 0.2rem;
        }

        .pulse-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.8);
        }

        .status-online {
          font-size: 0.85rem;
          font-weight: 600;
          color: #34d399;
        }

        .bot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.25rem;
        }

        .add-bot-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          padding: 2.2rem 1.5rem;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.02) 0%, rgba(255, 255, 255, 0.005) 100%);
          border: 1px dashed rgba(255, 255, 255, 0.16);
          border-radius: var(--radius-xl);
          color: var(--text-muted);
          min-height: 240px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        .add-bot-card:hover {
          border-style: solid;
          border-color: rgba(79, 110, 247, 0.45);
          background: linear-gradient(135deg, rgba(79, 110, 247, 0.06) 0%, rgba(139, 92, 246, 0.03) 100%);
          transform: translateY(-2px);
          box-shadow: 0 12px 28px -6px rgba(0, 0, 0, 0.4), 0 0 24px -4px rgba(79, 110, 247, 0.2);
        }

        .add-bot-circle {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .add-bot-card:hover .add-bot-circle {
          background: var(--accent);
          border-color: var(--accent);
          box-shadow: 0 0 16px rgba(79, 110, 247, 0.6);
          transform: scale(1.08);
        }

        .add-bot-icon {
          font-size: 1.4rem;
          font-weight: 400;
          color: var(--text);
          line-height: 1;
          transition: color 0.2s ease;
        }

        .add-bot-card:hover .add-bot-icon {
          color: #ffffff;
        }

        .add-bot-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.3rem;
          text-align: center;
        }

        .add-bot-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text);
        }

        .add-bot-desc {
          font-size: 0.78rem;
          color: var(--text-dim);
          max-width: 200px;
          line-height: 1.4;
        }

        /* ── Chat View ─────────────────────────────────────────────── */
        .chat-view {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 860px;
          width: 100%;
          margin: 0 auto;
          padding: 0 1.5rem;
          animation: fadeUp 0.3s ease both;
        }
        .chat-nav {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.9rem 0;
          border-bottom: 1px solid var(--border);
        }
        .back-btn {
          border: none;
          background: transparent;
          color: var(--accent);
          font-size: 0.85rem;
          font-weight: 500;
          padding: 0.3rem 0.6rem;
          border-radius: 6px;
          transition: background 0.12s ease;
        }
        .back-btn:hover { background: var(--accent-soft); }
        .chat-site-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .chat-site-name {
          font-size: 0.95rem;
          font-weight: 600;
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
        .chat-nav-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .chat-analytics-btn {
          background: rgba(167, 139, 250, 0.12);
          border: 1px solid rgba(167, 139, 250, 0.25);
          color: #c084fc;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .chat-analytics-btn:hover {
          background: rgba(167, 139, 250, 0.22);
          color: #fff;
          border-color: #c084fc;
        }
        .chat-settings-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.14);
          color: #c9d1d9;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .chat-settings-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.25);
        }
        .chat-embed-btn {
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.25);
          color: #38bdf8;
          font-size: 0.78rem;
          font-weight: 600;
          padding: 5px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .chat-embed-btn:hover {
          background: rgba(56, 189, 248, 0.22);
          color: #fff;
          border-color: #38bdf8;
        }
        .chat-body {
          flex: 1;
          min-height: 0;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* Page manager */
        .page-manager {
          border-top: 1px solid var(--border);
          padding: 0.5rem 0 0.75rem;
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
        .pages-toggle:hover { color: var(--text); }
        .pages-panel {
          margin-top: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
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
        .page-url:hover { text-decoration: underline; }
        .page-meta {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-family: var(--font-mono);
        }
        .refresh-btn {
          flex-shrink: 0;
          width: 28px;
          height: 28px;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s ease;
        }
        .refresh-btn:hover:not(:disabled) {
          color: var(--accent);
          border-color: var(--accent-dim);
        }
        .add-page-wrap {
          border-top: 1px solid var(--border);
          padding-top: 0.5rem;
        }

        /* ── Modal ─────────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          z-index: 100;
          animation: fadeIn 0.15s ease;
        }
        .modal {
          width: 100%;
          max-width: 480px;
          border-radius: var(--radius-lg);
          overflow: hidden;
          animation: scaleIn 0.2s ease;
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
          font-size: 1.05rem;
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
          transition: background 0.12s ease;
        }
        .modal-close:hover { background: rgba(255,255,255,0.06); }
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
          opacity: 0.6;
        }
        .field-input, .field-textarea {
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
        .field-input:focus, .field-textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-soft);
        }
        .crawl-options-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 0.25rem;
        }
        .crawl-options-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .crawl-options-title {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-muted);
        }
        .vercel-badge {
          font-size: 0.7rem;
          color: var(--accent);
          background: var(--accent-soft);
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          font-weight: 600;
        }
        .crawl-pills-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.45rem;
        }
        .crawl-pill {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.2rem;
          padding: 0.5rem 0.65rem;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .crawl-pill:hover:not(:disabled) {
          border-color: var(--border-active);
          background: var(--bg-card);
        }
        .crawl-pill.active {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .pill-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .pill-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text);
        }
        .crawl-pill.active .pill-label {
          color: var(--accent);
        }
        .pill-tag {
          font-size: 0.68rem;
          color: var(--text-muted);
        }
        .pill-desc {
          font-size: 0.68rem;
          color: var(--text-muted);
        }
        .modal-error {
          margin: 0;
          font-size: 0.82rem;
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
        .modal-submit:hover:not(:disabled) { opacity: 0.85; }

        /* ── File Upload & Mode Tabs ────────────────────────────────── */
        .modal-mode-tabs {
          display: flex;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg-input);
          margin-bottom: 0.5rem;
        }
        .mode-tab {
          flex: 1;
          padding: 0.6rem 0.8rem;
          font-size: 0.82rem;
          font-weight: 500;
          background: transparent;
          color: var(--text-muted);
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mode-tab:hover:not(:disabled) {
          color: var(--text);
        }
        .mode-tab.active {
          background: var(--accent);
          color: #fff;
          font-weight: 600;
        }

        .file-dropzone-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .file-dropzone {
          border: 2px dashed rgba(255, 255, 255, 0.15);
          border-radius: var(--radius);
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.35rem;
          cursor: pointer;
          transition: all 0.2s ease;
          background: rgba(255, 255, 255, 0.02);
        }
        .file-dropzone:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
        }
        .dropzone-icon {
          font-size: 1.8rem;
          margin-bottom: 0.2rem;
        }
        .dropzone-text {
          font-size: 0.88rem;
          color: var(--text);
        }
        .dropzone-text strong {
          color: var(--accent);
        }
        .dropzone-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        .file-selected-card {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--border);
          border-radius: var(--radius);
        }
        .file-selected-icon {
          font-size: 1.4rem;
        }
        .file-selected-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .file-selected-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-selected-size {
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .file-remove-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 1rem;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.15s ease;
        }
        .file-remove-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .doc-upload-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0.4rem 0;
          position: relative;
        }
        .doc-upload-divider::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          height: 1px;
          background: var(--border);
        }
        .doc-upload-divider span {
          position: relative;
          background: var(--bg-card);
          padding: 0 0.5rem;
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }

        .doc-upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.45rem 0.8rem;
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .doc-upload-btn:hover {
          border-color: var(--accent);
          background: var(--accent-soft);
        }

        /* ── Responsive ────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
          }
          .home-view {
            padding: 4rem 1rem 3rem;
          }
          .chat-view {
            padding: 0 0.75rem;
          }
          .bot-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outer wrapper with ToastProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
