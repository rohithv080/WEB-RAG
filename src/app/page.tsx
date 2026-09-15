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
import { Show, SignInButton, SignUpButton, SignOutButton, useUser } from "@clerk/nextjs";
import { LandingPage } from "@/components/LandingPage";
import { CrawlProgressBar, type CrawlProgressState } from "@/components/CrawlProgressBar";

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
  const [modalAutoSync, setModalAutoSync] = useState(false);
  const [modalProgress, setModalProgress] = useState<CrawlProgressState | null>(null);
  const modalNameRef = useRef<HTMLInputElement>(null);

  // ── page manager ─────────────────────────────────────────────────────────
  const [pagesOpen, setPagesOpen] = useState(false);
  const [refreshingPageId, setRefreshingPageId] = useState<string | null>(null);
  const [refreshingSiteId, setRefreshingSiteId] = useState<string | null>(null);

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

  // Warn user if they try to close or refresh the tab while indexing is actively running
  useEffect(() => {
    if (!modalLoading) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [modalLoading]);

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
    setModalAutoSync(false);
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
      setModalProgress(null);
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

        // Client-driven chunked batching for large documents (PDF/Docs > 25 chunks)
        // Completely eliminates Vercel 15s serverless timeout traps
        if (!data.done && Array.isArray(data.pendingChunks) && data.pendingChunks.length > 0) {
          const total = data.totalChunks || (data.processedChunks + data.pendingChunks.length);
          let processed = data.processedChunks || 25;
          const CHUNK_BATCH_SIZE = 25;

          setModalProgress({
            current: processed,
            total,
            stage: "indexing",
            percent: Math.round((processed / total) * 100),
            itemType: "chunk",
            customLabel: `Indexing chunk ${processed} of ${total}... (${Math.round((processed / total) * 100)}%)`,
          });

          for (let i = 0; i < data.pendingChunks.length; i += CHUNK_BATCH_SIZE) {
            const batch = data.pendingChunks.slice(i, i + CHUNK_BATCH_SIZE);
            const batchRes = await fetch("/api/upload", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "embed-batch",
                pageId: data.pageId,
                siteId: data.siteId,
                chunks: batch,
              }),
            });

            if (!batchRes.ok) {
              const bErr = await batchRes.json();
              throw new Error(bErr.error || "Failed indexing document chunks");
            }

            processed += batch.length;
            const pct = Math.round((processed / total) * 100);
            setModalProgress({
              current: processed,
              total,
              stage: "indexing",
              percent: pct,
              itemType: "chunk",
              customLabel: `Indexing chunk ${processed} of ${total}... (${pct}%)`,
            });
          }
        }

        await loadSites();
        setShowModal(false);
        addToast(`Bot "${data.siteName}" created (${data.totalChunks || data.chunkCount} chunks)!`, "success");

        const fresh = await fetch("/api/sites").then((r) => r.json());
        const newSite = (fresh.sites as SiteSummary[]).find((s) => s.id === data.siteId);
        if (newSite) openChat(newSite);
      } catch (err: any) {
        setModalError(err.message || "Failed to upload file");
      } finally {
        setModalLoading(false);
        setModalProgress(null);
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
        setModalProgress({ current: 0, total: modalCrawlLimit, stage: "discovering", percent: 0 });
        const crawlRes = await fetch("/api/crawl", {
          method: "POST",
          headers,
          body: JSON.stringify({ url, maxPages: modalCrawlLimit }),
        });
        if (!crawlRes.ok) throw new Error("Crawl failed to discover links");
        const crawlData = await crawlRes.json();
        if (crawlData.urls?.length > 0) urlsToScrape = crawlData.urls;
      }

      // Process in sequential batches of 3-4 pages to completely eliminate Vercel serverless timeouts
      const PAGE_BATCH_SIZE = 3;
      const totalPages = urlsToScrape.length;
      let processedPages = 0;
      let createdSiteId: string | null = null;
      let lastSiteName: string | null = null;

      setModalProgress({
        current: 0,
        total: totalPages,
        stage: "indexing",
        currentUrl: urlsToScrape[0],
        percent: 0,
        customLabel: `Indexing page 0 of ${totalPages}... (0%)`,
      });

      for (let i = 0; i < urlsToScrape.length; i += PAGE_BATCH_SIZE) {
        const batchUrls = urlsToScrape.slice(i, i + PAGE_BATCH_SIZE);
        setModalProgress((prev) =>
          prev
            ? {
                ...prev,
                currentUrl: batchUrls[0],
                stage: "indexing",
              }
            : null
        );

        const scrapeRes: Response = await fetch("/api/scrape", {
          method: "POST",
          headers,
          body: JSON.stringify({
            urls: batchUrls,
            siteId: createdSiteId || undefined,
            name: !createdSiteId ? (modalName.trim() || undefined) : undefined,
            description: !createdSiteId ? (modalDesc.trim() || undefined) : undefined,
            autoSync: !createdSiteId ? modalAutoSync : undefined,
          }),
        });

        const scrapeData: any = await scrapeRes.json();
        if (!scrapeRes.ok) throw new Error(scrapeData.error || "Batch scrape failed");

        if (!createdSiteId && scrapeData.siteId) {
          createdSiteId = scrapeData.siteId;
          lastSiteName = scrapeData.siteName;
        }

        processedPages += batchUrls.length;
        const currentCount = Math.min(processedPages, totalPages);
        const percent = Math.round((currentCount / totalPages) * 100);

        setModalProgress({
          current: currentCount,
          total: totalPages,
          stage: "indexing",
          currentUrl: batchUrls[batchUrls.length - 1],
          percent,
          customLabel: `Indexing page ${currentCount} of ${totalPages}... (${percent}%)`,
        });
      }

      await loadSites();
      setShowModal(false);
      addToast(`Bot "${lastSiteName || modalName || "Web Bot"}" created (${totalPages} pages indexed)!`, "success");

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
                <div className="hero-headings">
                  <h1 className="hero-title">Knowledge Bases</h1>
                  <p className="hero-sub">
                    Manage indexed documents, web crawls, and deploy autonomous knowledge assistants.
                  </p>
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
                        All Bots
                      </button>
                    </div>
                  )}

                  <button type="button" className="hero-create-btn" onClick={openModal}>
                    <span className="hero-btn-icon">+</span>
                    <span>New Bot</span>
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
                  <span className="stat-lbl">Llama 3.3 70B</span>
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
                  <span className="add-bot-icon">+</span>
                  <div className="add-bot-info">
                    <span className="add-bot-title">Deploy New Bot</span>
                    <span className="add-bot-desc">Index a web URL or upload document</span>
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
                  className="chat-sync-btn"
                  onClick={async () => {
                    setRefreshingSiteId(selectedSite.id);
                    try {
                      const res = await fetch(`/api/sites/${selectedSite.id}/sync`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ maxPages: 5 }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || "Sync failed");
                      addToast(data.message || `Sync completed! ${data.addedPages} new pages added.`, "success");
                      await loadSites();
                    } catch (err: any) {
                      addToast(err.message || "Failed to sync site", "error");
                    } finally {
                      setRefreshingSiteId(null);
                    }
                  }}
                  disabled={refreshingSiteId === selectedSite.id}
                  title="Check sitemap and homepage for newly published articles"
                >
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                  </svg>
                  <span>{refreshingSiteId === selectedSite.id ? "Syncing…" : "Sync News"}</span>
                </button>
                <button
                  type="button"
                  className="chat-analytics-btn"
                  onClick={() => openAnalytics(selectedSite)}
                  title="View bot analytics, query logs & metrics"
                >
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="18" y1="20" x2="18" y2="10" />
                    <line x1="12" y1="20" x2="12" y2="4" />
                    <line x1="6" y1="20" x2="6" y2="14" />
                  </svg>
                  <span>Analytics</span>
                </button>
                <button
                  type="button"
                  className="chat-settings-btn"
                  onClick={() => openSettings(selectedSite)}
                  title="Customize bot persona, tone & prompts"
                >
                  <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={2}>
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  className="chat-embed-btn"
                  onClick={() => openEmbed(selectedSite)}
                  title="Get 1-line embed snippet for your website"
                >
                  <span>&lt;/&gt;</span>
                  <span>Embed</span>
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

                            // Chunked batching for large PDFs in side panel
                            if (!data.done && Array.isArray(data.pendingChunks) && data.pendingChunks.length > 0) {
                              const total = data.totalChunks || (data.processedChunks + data.pendingChunks.length);
                              let processed = data.processedChunks || 25;
                              const CHUNK_BATCH_SIZE = 25;

                              for (let i = 0; i < data.pendingChunks.length; i += CHUNK_BATCH_SIZE) {
                                const batch = data.pendingChunks.slice(i, i + CHUNK_BATCH_SIZE);
                                const batchRes = await fetch("/api/upload", {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    action: "embed-batch",
                                    pageId: data.pageId,
                                    siteId: data.siteId,
                                    chunks: batch,
                                  }),
                                });
                                if (!batchRes.ok) {
                                  const bErr = await batchRes.json();
                                  throw new Error(bErr.error || "Failed indexing chunks");
                                }
                                processed += batch.length;
                                const pct = Math.round((processed / total) * 100);
                                addToast(`Indexing ${f.name}: chunk ${processed}/${total} (${pct}%)`, "info");
                              }
                            }

                            await loadSites();
                            addToast(`Added ${f.name} (${data.totalChunks || data.chunkCount} chunks)!`, "success");
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
                    accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
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
                        Supports PDF, Word (.docx), TXT, Markdown, CSV, JSON
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
                      <span className="crawl-options-title">Crawl Depth</span>
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

                  <div className="modal-sync-toggle">
                    <div className="modal-sync-info">
                      <span className="modal-sync-title">🌅 Daily Auto-Sync (Cron)</span>
                      <span className="modal-sync-sub">Automatically scan for newly published articles & updates daily at 06:30 AM IST</span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={modalAutoSync}
                        onChange={(e) => setModalAutoSync(e.target.checked)}
                        disabled={modalLoading}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>
                </>
              )}

              {modalProgress && (
                <CrawlProgressBar progress={modalProgress} />
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
          max-width: 1080px;
          width: 100%;
          margin: 0 auto;
          padding: 2rem 2.5rem 5rem;
          animation: fadeUp 0.3s ease both;
        }

        .home-hero {
          margin-bottom: 2rem;
          padding: 0 0 1.75rem;
          border-bottom: 1px solid var(--border);
        }

        .hero-top-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .hero-headings {
          flex: 1;
          min-width: 280px;
        }

        .hero-title {
          margin: 0 0 0.35rem;
          font-size: 1.45rem;
          font-weight: 600;
          letter-spacing: -0.025em;
          color: #f7f7f8;
        }

        .hero-sub {
          margin: 0;
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.5;
          max-width: 540px;
        }

        .hero-top-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .admin-scope-toggle {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 2px;
        }

        .admin-toggle-btn {
          padding: 0.32rem 0.65rem;
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.74rem;
          font-weight: 500;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .admin-toggle-btn.active {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .hero-create-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.42rem 0.8rem;
          border-radius: 6px;
          background: var(--accent);
          border: 1px solid transparent;
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .hero-create-btn:hover {
          background: #6e6eff;
        }

        .hero-btn-icon {
          font-size: 0.95rem;
          line-height: 1;
        }

        .hero-auth-slot {
          display: flex;
          align-items: center;
        }

        .hero-logout-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.42rem 0.75rem;
          border-radius: 6px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .hero-logout-btn:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.06);
        }

        .hero-guest-auth {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .hero-signin-btn {
          padding: 0.42rem 0.75rem;
          border-radius: 6px;
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .hero-signin-btn:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.16);
          color: #ffffff;
        }

        .hero-signup-btn {
          padding: 0.42rem 0.8rem;
          border-radius: 6px;
          background: var(--accent);
          border: 1px solid transparent;
          color: #ffffff;
          font-size: 0.78rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .hero-signup-btn:hover {
          background: #6e6eff;
        }

        .hero-stats-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.65rem;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.65rem 0.85rem;
          border-radius: 6px;
          background: var(--bg-card);
          border: 1px solid var(--border);
        }

        .stat-num {
          font-size: 1.15rem;
          font-weight: 600;
          letter-spacing: -0.02em;
          color: #f7f7f8;
          font-family: var(--font-mono);
        }

        .stat-lbl {
          font-size: 0.66rem;
          font-weight: 500;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .status-row {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          margin-bottom: 0.15rem;
        }

        .pulse-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
        }

        .status-online {
          font-size: 0.78rem;
          font-weight: 600;
          color: #34d399;
        }

        .bot-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 1rem;
        }

        .add-bot-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.65rem;
          padding: 1.75rem 1.25rem;
          background: transparent;
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: var(--radius-lg);
          color: var(--text-muted);
          min-height: 180px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .add-bot-card:hover {
          border-color: var(--accent);
          background: rgba(124, 124, 255, 0.03);
          transform: translateY(-1px);
        }

        .add-bot-icon {
          font-size: 1.4rem;
          font-weight: 300;
          color: var(--text-dim);
          line-height: 1;
          transition: color 0.15s ease;
        }

        .add-bot-card:hover .add-bot-icon {
          color: var(--accent);
        }

        .add-bot-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          text-align: center;
        }

        .add-bot-title {
          font-size: 0.85rem;
          font-weight: 500;
          color: var(--text);
        }

        .add-bot-desc {
          font-size: 0.72rem;
          color: var(--text-dim);
          max-width: 190px;
          line-height: 1.4;
        }

        /* ── Chat View ─────────────────────────────────────────────── */
        .chat-view {
          display: flex;
          flex-direction: column;
          height: 100vh;
          max-width: 880px;
          width: 100%;
          margin: 0 auto;
          padding: 0 1.5rem;
          animation: fadeUp 0.2s ease both;
        }
        .chat-nav {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border);
        }
        .back-btn {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 500;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .back-btn:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          border-color: rgba(255, 255, 255, 0.16);
        }
        .chat-site-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .chat-site-name {
          font-size: 0.88rem;
          font-weight: 600;
          color: #f7f7f8;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-site-desc {
          font-size: 0.72rem;
          color: var(--text-dim);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-nav-actions {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .chat-sync-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          color: #34d399;
          font-size: 0.76rem;
          font-weight: 500;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .chat-sync-btn:hover:not(:disabled) {
          background: rgba(16, 185, 129, 0.2);
          border-color: #34d399;
          color: #fff;
        }
        .chat-sync-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .chat-analytics-btn,
        .chat-settings-btn,
        .chat-embed-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.76rem;
          font-weight: 500;
          padding: 0.35rem 0.65rem;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.12s ease;
          display: inline-flex;
          align-items: center;
          gap: 5px;
        }
        .chat-analytics-btn:hover,
        .chat-settings-btn:hover,
        .chat-embed-btn:hover {
          background: rgba(255, 255, 255, 0.04);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.16);
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
          font-size: 0.76rem;
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
          gap: 0.25rem;
        }
        .page-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.5rem;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border);
        }
        .page-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .page-url {
          font-size: 0.78rem;
          color: var(--text);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .page-url:hover { color: var(--accent); }
        .page-meta {
          font-size: 0.65rem;
          color: var(--text-dim);
          font-family: var(--font-mono);
        }
        .refresh-btn {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .refresh-btn:hover:not(:disabled) {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .add-page-wrap {
          border-top: 1px solid var(--border);
          padding-top: 0.5rem;
        }

        /* ── Modal ─────────────────────────────────────────────────── */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(8px);
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
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          overflow: hidden;
          animation: scaleIn 0.18s ease;
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.6);
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border);
        }
        .modal-title {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: #f7f7f8;
        }
        .modal-close {
          border: none;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.85rem;
          width: 26px;
          height: 26px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .modal-close:hover {
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
        }
        .modal-form {
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .field-label {
          font-size: 0.76rem;
          font-weight: 500;
          color: var(--text-muted);
          letter-spacing: 0.01em;
          margin-top: 0.2rem;
        }
        .field-optional {
          font-weight: 400;
          opacity: 0.6;
        }
        .field-input, .field-textarea {
          width: 100%;
          padding: 0.55rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: var(--bg-input);
          color: var(--text);
          font-size: 0.84rem;
          outline: none;
          transition: all 0.12s ease;
          resize: vertical;
        }
        .field-input:focus, .field-textarea:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent);
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
          font-size: 0.76rem;
          font-weight: 500;
          color: var(--text-muted);
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
          gap: 0.15rem;
          padding: 0.45rem 0.6rem;
          background: var(--bg-input);
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
          transition: all 0.12s ease;
        }
        .crawl-pill:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.03);
        }
        .crawl-pill.active {
          border-color: var(--accent);
          background: rgba(124, 124, 255, 0.08);
        }
        .pill-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }
        .pill-label {
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text);
        }
        .crawl-pill.active .pill-label {
          color: var(--accent);
        }
        .pill-tag {
          font-size: 0.65rem;
          color: var(--text-dim);
        }
        .pill-desc {
          font-size: 0.65rem;
          color: var(--text-dim);
        }
        .modal-error {
          margin: 0;
          font-size: 0.78rem;
          color: var(--danger);
        }
        .modal-actions {
          display: flex;
          gap: 0.5rem;
          justify-content: flex-end;
          margin-top: 0.5rem;
        }
        .modal-cancel {
          padding: 0.45rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .modal-cancel:hover:not(:disabled) {
          border-color: rgba(255, 255, 255, 0.16);
          color: var(--text);
        }
        .modal-submit {
          padding: 0.45rem 1rem;
          border: 1px solid transparent;
          border-radius: 6px;
          background: var(--accent);
          color: #fff;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .modal-submit:hover:not(:disabled) {
          background: #6e6eff;
        }

        /* ── File Upload & Mode Tabs ────────────────────────────────── */
        .modal-mode-tabs {
          display: flex;
          border-radius: 6px;
          overflow: hidden;
          border: 1px solid var(--border);
          background: var(--bg-input);
          margin-bottom: 0.5rem;
          padding: 2px;
        }
        .mode-tab {
          flex: 1;
          padding: 0.45rem 0.65rem;
          font-size: 0.78rem;
          font-weight: 500;
          background: transparent;
          color: var(--text-muted);
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .mode-tab:hover:not(:disabled) {
          color: var(--text);
        }
        .mode-tab.active {
          background: rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .file-dropzone-wrapper {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .file-dropzone {
          border: 1px dashed rgba(255, 255, 255, 0.14);
          border-radius: 6px;
          padding: 1.5rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.3rem;
          cursor: pointer;
          transition: all 0.15s ease;
          background: rgba(255, 255, 255, 0.02);
        }
        .file-dropzone:hover {
          border-color: var(--accent);
          background: rgba(124, 124, 255, 0.03);
        }
        .dropzone-icon {
          font-size: 1.5rem;
          margin-bottom: 0.1rem;
        }
        .dropzone-text {
          font-size: 0.82rem;
          color: var(--text);
        }
        .dropzone-text strong {
          color: var(--accent);
        }
        .dropzone-sub {
          font-size: 0.68rem;
          color: var(--text-dim);
        }

        .file-selected-card {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          padding: 0.65rem 0.85rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: 6px;
        }
        .file-selected-icon {
          font-size: 1.2rem;
        }
        .file-selected-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .file-selected-name {
          font-size: 0.82rem;
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .file-selected-size {
          font-size: 0.68rem;
          color: var(--text-dim);
        }
        .file-remove-btn {
          background: transparent;
          border: none;
          color: var(--text-dim);
          font-size: 0.9rem;
          cursor: pointer;
          padding: 2px 5px;
          border-radius: 3px;
          transition: all 0.12s ease;
        }
        .file-remove-btn:hover {
          color: #f87171;
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
          font-size: 0.65rem;
          color: var(--text-dim);
          text-transform: uppercase;
        }

        .doc-upload-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.42rem 0.75rem;
          border: 1px dashed var(--border);
          border-radius: 6px;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .doc-upload-btn:hover {
          border-color: rgba(255, 255, 255, 0.16);
          color: var(--text);
        }

        /* ── Modal Auto-Sync Toggle ───────────────────────────────── */
        .modal-sync-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 0.75rem 0.85rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          margin-top: 0.75rem;
        }
        .modal-sync-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .modal-sync-title {
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--text);
        }
        .modal-sync-sub {
          font-size: 0.7rem;
          color: var(--text-dim);
          line-height: 1.35;
        }

        /* ── Responsive ────────────────────────────────────────────── */
        @media (max-width: 768px) {
          .main-content {
            margin-left: 0;
          }
          .home-view {
            padding: 3.5rem 1rem 3rem;
          }
          .chat-view {
            padding: 0 0.75rem;
          }
          .bot-grid {
            grid-template-columns: 1fr;
          }
          .hero-stats-strip {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Outer wrapper with ToastProvider
// ─────────────────────────────────────────────────────────────────────────────

function AuthGate() {
  const { isSignedIn, isLoaded } = useUser();

  // While Clerk is loading, show nothing to avoid flash
  if (!isLoaded) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "lpSpin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!isSignedIn) {
    return <LandingPage />;
  }

  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}

export default function HomePage() {
  return <AuthGate />;
}
