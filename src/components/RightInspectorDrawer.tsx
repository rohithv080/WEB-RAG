"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import type { SiteSummary } from "./BotCard";
import { UrlInput } from "./UrlInput";
import { ChunkExplorerView } from "./ChunkExplorerView";

export type DrawerTab = "pages" | "history" | "analytics" | "settings" | "embed";

type Props = {
  isOpen: boolean;
  activeTab: DrawerTab;
  onTabChange: (tab: DrawerTab) => void;
  onClose: () => void;
  site: SiteSummary | null;
  onSaveSettings: (updatedSite: SiteSummary) => void;
  onRefreshPage: (pageId: string) => Promise<void>;
  refreshingPageId: string | null;
  onPageAdded: () => Promise<void>;
  onToast: (message: string, type: "success" | "error" | "info") => void;
  currentSessionId?: string | null;
  onSelectSession?: (sessionId: string) => void;
  onNewChat?: () => void;
};

export type ChatSessionItem = {
  id: string;
  createdAt: string;
  messageCount: number;
  preview: string;
};

type AnalyticsData = {
  metrics: {
    totalQueries: number;
    avgLatencyMs: number;
    thumbsUp: number;
    thumbsDown: number;
    satisfactionRate: number | null;
  };
  contentGaps: Array<{ question: string; answerSnippet: string; createdAt: string }>;
  topSources: Array<{ url: string; heading?: string; count: number }>;
};

export function RightInspectorDrawer({
  isOpen,
  activeTab,
  onTabChange,
  onClose,
  site,
  onSaveSettings,
  onRefreshPage,
  refreshingPageId,
  onPageAdded,
  onToast,
  currentSessionId,
  onSelectSession,
  onNewChat,
}: Props) {
  // Settings Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tone, setTone] = useState<"concise" | "balanced" | "detailed">("balanced");
  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [autoSync, setAutoSync] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState<"daily" | "weekly">("daily");
  const [savingSettings, setSavingSettings] = useState(false);

  // Chat Sessions History State
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionSearch, setSessionSearch] = useState("");
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  // Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Embed Customizer State
  const [embedColor, setEmbedColor] = useState("#0066cc");
  const [embedPosition, setEmbedPosition] = useState<"bottom-right" | "bottom-left">(
    "bottom-right"
  );
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedGreeting, setEmbedGreeting] = useState("");
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  // File Upload State
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chunk Explorer Drilldown State
  const [inspectingPageId, setInspectingPageId] = useState<string | null>(null);

  // Sync state when site changes
  useEffect(() => {
    if (site) {
      setInspectingPageId(null);
      setName(site.name || "");
      setDescription(site.description || "");
      setSystemPrompt(site.systemPrompt || "");
      setTone(site.tone || "balanced");
      setStarterQuestions(Array.isArray(site.starterQuestions) ? site.starterQuestions : []);
      setAutoSync(Boolean(site.autoSync));
      setSyncFrequency((site.syncFrequency as any) || "daily");
      setEmbedTitle(site.name || "AI Assistant");
      setEmbedGreeting(`Hello! Ask me anything about ${site.name || "this site"}.`);
    }
  }, [site]);

  // Fetch analytics when analytics tab is selected
  useEffect(() => {
    if (isOpen && activeTab === "analytics" && site) {
      setAnalyticsLoading(true);
      fetch(`/api/sites/${site.id}/analytics`)
        .then((r) => r.json())
        .then((data) => setAnalytics(data))
        .catch(() => {})
        .finally(() => setAnalyticsLoading(false));
    }
  }, [isOpen, activeTab, site]);

  // Fetch session history when history tab is selected
  useEffect(() => {
    if (isOpen && activeTab === "history" && site) {
      loadSessions();
    }
  }, [isOpen, activeTab, site]);

  async function loadSessions() {
    if (!site) return;
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/sites/${site.id}/sessions`);
      if (!res.ok) throw new Error("Failed to load chat history");
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        setSessions(data.sessions);
      }
    } catch (err: any) {
      console.error("[loadSessions error]", err);
    } finally {
      setLoadingSessions(false);
    }
  }

  async function handleDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this conversation thread?")) return;
    setDeletingSessionId(sessionId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete conversation");
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      onToast("Conversation deleted", "info");
      if (currentSessionId === sessionId && onNewChat) {
        onNewChat();
      }
    } catch (err: any) {
      onToast(err.message || "Failed to delete session", "error");
    } finally {
      setDeletingSessionId(null);
    }
  }

  const filteredSessions = sessions.filter((s) => {
    if (!sessionSearch.trim()) return true;
    const q = sessionSearch.toLowerCase();
    return s.preview.toLowerCase().includes(q) || s.id.toLowerCase().includes(q);
  });

  if (!isOpen || !site) return null;

  // Settings Handlers
  function handleAddQuestion() {
    const q = newQuestion.trim();
    if (!q || starterQuestions.includes(q) || starterQuestions.length >= 6) return;
    setStarterQuestions((prev) => [...prev, q]);
    setNewQuestion("");
  }

  function handleRemoveQuestion(idx: number) {
    setStarterQuestions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSaveSettingsSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/sites/${site!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || site!.name,
          description: description.trim() || null,
          systemPrompt: systemPrompt.trim() || null,
          tone,
          starterQuestions,
          autoSync,
          syncFrequency,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");
      onSaveSettings(data.site);
      onToast("Bot settings saved successfully!", "success");
    } catch (err: any) {
      onToast(err.message || "Could not save settings", "error");
    } finally {
      setSavingSettings(false);
    }
  }

  // Document Upload Handler
  async function handleFileUpload(file: File) {
    if (!file || !site) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("siteId", site.id);
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Document upload failed");
      await onPageAdded();
      onToast(`Indexed ${file.name} (${data.chunkCount} chunks)!`, "success");
    } catch (err: any) {
      onToast(err.message || "Failed to upload document", "error");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  // Generate Embed Snippet
  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://rohith-rag.vercel.app";
  const embedSnippet = `<script
  src="${origin}/widget.js"
  data-bot-id="${site.id}"
  data-color="${embedColor}"
  data-position="${embedPosition}"
  data-title="${embedTitle || site.name}"
  data-greeting="${embedGreeting}"
  defer
></script>`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedSnippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
    onToast("Widget code copied to clipboard!", "success");
  }

  return (
    <aside className="right-drawer" aria-label="Bot Inspector">
      {/* Drawer Header */}
      <div className="drawer-header">
        <div className="drawer-title-wrap">
          <span className="drawer-bot-name">{site.name}</span>
          <span className="drawer-badge">{site.pages.length} Pages</span>
        </div>
        <button type="button" className="drawer-close-btn" onClick={onClose} title="Close drawer">
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="drawer-tabs">
        <button
          type="button"
          className={`drawer-tab ${activeTab === "pages" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("pages");
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Pages</span>
          <span className="tab-count">{site.pages.length}</span>
        </button>
        <button
          type="button"
          className={`drawer-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("history");
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span>History</span>
          {sessions.length > 0 && <span className="tab-count">{sessions.length}</span>}
        </button>
        <button
          type="button"
          className={`drawer-tab ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("analytics");
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Analytics</span>
        </button>
        <button
          type="button"
          className={`drawer-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("settings");
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="4" y1="21" x2="4" y2="14" />
            <line x1="4" y1="10" x2="4" y2="3" />
            <line x1="12" y1="21" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12" y2="3" />
            <line x1="20" y1="21" x2="20" y2="16" />
            <line x1="20" y1="12" x2="20" y2="3" />
            <line x1="1" y1="14" x2="7" y2="14" />
            <line x1="9" y1="8" x2="15" y2="8" />
            <line x1="17" y1="16" x2="23" y2="16" />
          </svg>
          <span>Settings</span>
        </button>
        <button
          type="button"
          className={`drawer-tab ${activeTab === "embed" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("embed");
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
          <span>Embed</span>
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="drawer-content">
        {/* ── TAB 1: PAGES & DOCUMENTS ──────────────────────────────── */}
        {activeTab === "pages" &&
          (inspectingPageId ? (
            <ChunkExplorerView
              pageId={inspectingPageId}
              onBack={() => setInspectingPageId(null)}
              onToast={onToast}
              onChunksUpdated={onPageAdded}
            />
          ) : (
            <div className="tab-panel">
              <div className="panel-section">
                <label className="section-label">Index More Knowledge</label>
                <UrlInput
                  siteId={site.id}
                  compact
                  onScraped={async () => {
                    await onPageAdded();
                    onToast("Webpage indexed successfully!", "success");
                  }}
                />
                <div className="doc-upload-box">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md,.markdown,.csv,.json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileUpload(f);
                    }}
                  />
                  <button
                    type="button"
                    className="upload-dropzone-btn"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingDoc}
                  >
                    <div className="upload-icon">
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                      </svg>
                    </div>
                    <div className="upload-texts">
                      <span className="upload-primary">
                        {uploadingDoc ? "Extracting & Indexing Document..." : "Upload Document"}
                      </span>
                      <span className="upload-sub">
                        Supports PDF, Word (.docx), TXT, Markdown, CSV, JSON
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              <div className="panel-section">
                <div className="section-header-row">
                  <label className="section-label">Indexed Sources ({site.pages.length})</label>
                </div>
                <div className="pages-scroll-list">
                  {site.pages.map((p) => {
                    let domain = "";
                    try {
                      domain = new URL(p.url).hostname.replace(/^www\./, "");
                    } catch {
                      domain = p.url.slice(0, 30);
                    }
                    const isDocument = p.url.startsWith("doc://");
                    const displayTitle =
                      p.title || (isDocument ? p.url.replace("doc://", "") : domain);

                    return (
                      <div
                        key={p.id}
                        className="drawer-page-card"
                        onClick={() => setInspectingPageId(p.id)}
                        title="Click to inspect all pgvector chunks"
                      >
                        <div className="page-card-icon">
                          {isDocument ? (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                          ) : (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="2" y1="12" x2="22" y2="12" />
                              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                            </svg>
                          )}
                        </div>
                        <div className="page-card-info">
                          <span className="page-card-title">{displayTitle}</span>
                          <div className="page-card-meta">
                            <span className="meta-chunk-count">{p.chunkCount} chunks</span>
                            <span className="meta-dot">•</span>
                            <span className="meta-date">
                              {new Date(p.scrapedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <div className="page-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="inspect-chunks-btn"
                            onClick={() => setInspectingPageId(p.id)}
                            title="Inspect chunks"
                          >
                            <span>Inspect</span>
                          </button>
                          {!isDocument && (
                            <button
                              type="button"
                              className="re-scrape-btn"
                              onClick={() => onRefreshPage(p.id)}
                              disabled={refreshingPageId === p.id}
                              title="Re-scrape and update chunks"
                            >
                              <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className={refreshingPageId === p.id ? "spinning" : ""}
                              >
                                <polyline points="23 4 23 10 17 10" />
                                <polyline points="1 20 1 14 7 14" />
                                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}

        {/* ── TAB 2: ANALYTICS ───────────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="tab-panel">
            {analyticsLoading ? (
              <div className="analytics-loading">Loading telemetry & query logs...</div>
            ) : analytics ? (
              <>
                <div className="metric-cards-grid">
                  <div className="metric-card">
                    <span className="metric-num">{analytics.metrics.totalQueries}</span>
                    <span className="metric-lbl">Total Queries</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-num">
                      {analytics.metrics.avgLatencyMs
                        ? `${(analytics.metrics.avgLatencyMs / 1000).toFixed(1)}s`
                        : "0s"}
                    </span>
                    <span className="metric-lbl">Avg Response Time</span>
                  </div>
                  <div className="metric-card">
                    <span className="metric-num satisfaction">
                      {analytics.metrics.satisfactionRate !== null
                        ? `${analytics.metrics.satisfactionRate}%`
                        : "100%"}
                    </span>
                    <span className="metric-lbl">Satisfaction Rate</span>
                  </div>
                </div>

                <div className="panel-section">
                  <label className="section-label">Most Referenced Sources</label>
                  <div className="top-sources-list">
                    {analytics.topSources.length === 0 ? (
                      <div className="empty-subtext">No citations recorded yet.</div>
                    ) : (
                      analytics.topSources.slice(0, 5).map((s, idx) => (
                        <div key={idx} className="top-source-row">
                          <span className="source-rank">#{idx + 1}</span>
                          <span className="source-name" title={s.url}>
                            {s.heading || s.url}
                          </span>
                          <span className="source-hits">{s.count} hits</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="panel-section">
                  <label className="section-label">Content Gaps & Missing Knowledge</label>
                  <div className="gaps-list">
                    {analytics.contentGaps.length === 0 ? (
                      <div className="empty-subtext">
                        No content gaps detected. Knowledge base is strong!
                      </div>
                    ) : (
                      analytics.contentGaps.slice(0, 4).map((g, idx) => (
                        <div key={idx} className="gap-card">
                          <span className="gap-q">"{g.question}"</span>
                          <span className="gap-time">
                            {new Date(g.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-subtext">Unable to load analytics.</div>
            )}
          </div>
        )}

        {/* ── TAB 3: SETTINGS ────────────────────────────────────────── */}
        {activeTab === "settings" && (
          <form onSubmit={handleSaveSettingsSubmit} className="tab-panel">
            <div className="form-group">
              <label className="field-label">Bot Name</label>
              <input
                type="text"
                className="field-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="field-label">Description</label>
              <input
                type="text"
                className="field-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </div>

            <div className="form-group">
              <label className="field-label">AI Persona & Custom Instructions</label>
              <textarea
                className="field-textarea"
                rows={4}
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="e.g. You are a senior technical support specialist for this product. Answer directly with code samples."
              />
            </div>

            <div className="form-group">
              <label className="field-label">Response Tone</label>
              <div className="tone-pills">
                {(["concise", "balanced", "detailed"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`tone-pill ${tone === t ? "active" : ""}`}
                    onClick={() => setTone(t)}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="field-label">
                Suggested Starter Prompts ({starterQuestions.length}/6)
              </label>
              <div className="starter-chips-wrap">
                {starterQuestions.map((q, idx) => (
                  <span key={idx} className="starter-chip">
                    <span>{q}</span>
                    <button
                      type="button"
                      className="chip-del-btn"
                      onClick={() => handleRemoveQuestion(idx)}
                      title="Remove starter prompt"
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              {starterQuestions.length < 6 && (
                <div className="add-starter-row">
                  <input
                    type="text"
                    className="field-input-sm"
                    placeholder="Add suggested prompt..."
                    value={newQuestion}
                    onChange={(e) => setNewQuestion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddQuestion();
                      }
                    }}
                  />
                  <button type="button" className="add-starter-btn" onClick={handleAddQuestion}>
                    + Add
                  </button>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                />
                <span className="toggle-text">Daily Automated Re-Sync (Vercel Cron)</span>
              </label>
            </div>

            <button type="submit" className="save-settings-btn" disabled={savingSettings}>
              {savingSettings ? "Saving Changes..." : "Save Bot Configuration"}
            </button>
          </form>
        )}

        {/* ── TAB 4: EMBED CODE ──────────────────────────────────────── */}
        {activeTab === "embed" && (
          <div className="tab-panel">
            <div className="panel-section">
              <label className="section-label">1-Line Script Installation</label>
              <p className="section-desc">
                Paste this single script tag right before the closing <code>&lt;/body&gt;</code> tag
                on any website.
              </p>
              <div className="embed-code-box">
                <pre className="embed-code-pre">
                  <code>{embedSnippet}</code>
                </pre>
                <button type="button" className="embed-copy-btn" onClick={copyEmbed}>
                  {copiedEmbed ? "✓ Copied" : "Copy Snippet"}
                </button>
              </div>
            </div>

            <div className="panel-section">
              <label className="section-label">Customize Widget Appearance</label>
              <div className="embed-settings-form">
                <div className="form-row-embed">
                  <label className="field-label-embed">Accent Color</label>
                  <div className="color-pick-wrap">
                    <input
                      type="color"
                      className="color-input"
                      value={embedColor}
                      onChange={(e) => setEmbedColor(e.target.value)}
                    />
                    <span className="color-val">{embedColor}</span>
                  </div>
                </div>

                <div className="form-row-embed">
                  <label className="field-label-embed">Launcher Position</label>
                  <select
                    className="select-embed"
                    value={embedPosition}
                    onChange={(e: any) => setEmbedPosition(e.target.value)}
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                  </select>
                </div>

                <div className="form-group-embed">
                  <label className="field-label-embed">Header Title</label>
                  <input
                    type="text"
                    className="field-input-sm"
                    value={embedTitle}
                    onChange={(e) => setEmbedTitle(e.target.value)}
                    placeholder="AI Assistant"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 5: CONVERSATION HISTORY ──────────────────────────── */}
        {activeTab === "history" && (
          <div className="tab-panel">
            <div className="history-header-actions">
              <div className="history-search-wrap">
                <svg
                  className="search-icon"
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
                  type="text"
                  placeholder="Search conversations…"
                  value={sessionSearch}
                  onChange={(e) => setSessionSearch(e.target.value)}
                  className="history-search-input"
                />
                {sessionSearch && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setSessionSearch("")}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                className="new-chat-drawer-btn"
                onClick={() => {
                  if (onNewChat) onNewChat();
                  onToast("Started a fresh conversation session", "info");
                }}
                title="Start a new conversation thread"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ marginRight: 6 }}
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>New Chat</span>
              </button>
            </div>

            {loadingSessions ? (
              <div className="sessions-loading-state">
                <span className="history-spinner" />
                <span>Loading conversation history…</span>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="sessions-empty-state">
                <div className="empty-icon">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h4 className="empty-title">
                  {sessionSearch ? "No matching conversations" : "No conversation history yet"}
                </h4>
                <p className="empty-desc">
                  {sessionSearch
                    ? "Try a different search keyword"
                    : "Ask questions in chat to automatically save multi-turn threads here."}
                </p>
                {!sessionSearch && (
                  <button
                    type="button"
                    className="empty-start-btn"
                    onClick={() => {
                      if (onNewChat) onNewChat();
                    }}
                  >
                    Start First Chat
                  </button>
                )}
              </div>
            ) : (
              <div className="session-list">
                {filteredSessions.map((s) => {
                  const isActive = currentSessionId === s.id;
                  const dateFormatted = new Date(s.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={s.id}
                      className={`session-card ${isActive ? "active-session" : ""}`}
                      onClick={() => {
                        if (onSelectSession) {
                          onSelectSession(s.id);
                          onToast("Resumed conversation thread", "info");
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="session-card-top">
                        <span className="session-date">{dateFormatted}</span>
                        <div className="session-badges">
                          {isActive && <span className="active-tag">Current</span>}
                          <span className="msg-count-tag">
                            {s.messageCount} {s.messageCount === 1 ? "msg" : "msgs"}
                          </span>
                        </div>
                      </div>

                      <p className="session-preview">{s.preview}</p>

                      <div className="session-card-footer">
                        <span className="resume-hint">
                          Resume thread
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ marginLeft: 4 }}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                        <button
                          type="button"
                          className="delete-session-btn"
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          disabled={deletingSessionId === s.id}
                          title="Delete conversation"
                        >
                          {deletingSessionId === s.id ? (
                            "…"
                          ) : (
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .right-drawer {
          width: 380px;
          height: 100%;
          background: var(--bg-surface);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          z-index: 20;
          animation: slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes slideInRight {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(0);
          }
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg-surface);
        }
        .drawer-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }
        .drawer-bot-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: -0.01em;
        }
        .drawer-badge {
          font-size: 0.68rem;
          padding: 2px 6px;
          background: var(--bg-card);
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          flex-shrink: 0;
          font-weight: 500;
        }
        .drawer-close-btn {
          width: 26px;
          height: 26px;
          border-radius: var(--radius-sm);
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          transition: all 0.15s ease;
        }
        .drawer-close-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .drawer-tabs {
          display: flex;
          border-bottom: 1px solid var(--border);
          background: var(--bg-surface);
          overflow-x: auto;
        }
        .drawer-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px 8px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .drawer-tab:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .drawer-tab.active {
          color: var(--text-primary);
          border-bottom-color: var(--accent);
          background: transparent;
        }
        .tab-count {
          font-size: 0.65rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 1px 5px;
          border-radius: 999px;
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .tab-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .panel-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .section-label {
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .section-desc {
          margin: 0;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }
        .section-desc code {
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 1px 4px;
          border-radius: var(--radius-micro);
          color: var(--text-primary);
          font-family: monospace;
          font-size: 0.74rem;
        }

        .doc-upload-box {
          margin-top: 0.4rem;
        }
        .upload-dropzone-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: var(--bg-card);
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .upload-dropzone-btn:hover {
          background: var(--bg-hover);
          border-color: var(--accent);
        }
        .upload-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }
        .upload-texts {
          display: flex;
          flex-direction: column;
        }
        .upload-primary {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-primary);
        }
        .upload-sub {
          font-size: 0.68rem;
          color: var(--text-muted);
        }

        .pages-scroll-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-height: 380px;
          overflow-y: auto;
        }
        .drawer-page-card {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          transition: all 0.15s ease;
        }
        .drawer-page-card:hover {
          background: var(--bg-hover);
          border-color: var(--border-hover);
        }
        .page-card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          flex-shrink: 0;
        }
        .page-card-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }
        .page-card-title {
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text-primary);
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .page-card-title:hover {
          color: var(--accent);
        }
        .page-card-meta {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 2px;
          font-family: monospace;
        }
        .page-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .inspect-chunks-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--bg-hover);
          border: 1px solid var(--border);
          color: var(--text-primary);
          font-size: 0.68rem;
          font-weight: 500;
          padding: 2px 7px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .inspect-chunks-btn:hover {
          background: var(--bg-card);
          border-color: var(--border-hover);
        }
        .re-scrape-btn {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-micro);
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .re-scrape-btn:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
          border-color: var(--border-hover);
        }
        .spinning {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        /* Analytics Tab */
        .metric-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .metric-card {
          padding: 10px 8px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .metric-num {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          font-family: monospace;
          letter-spacing: -0.02em;
        }
        .metric-num.satisfaction {
          color: var(--text-primary);
        }
        .metric-lbl {
          font-size: 0.64rem;
          color: var(--text-muted);
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .top-sources-list,
        .gaps-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .top-source-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 8px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 0.74rem;
        }
        .source-rank {
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.68rem;
          font-family: monospace;
        }
        .source-name {
          flex: 1;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .source-hits {
          color: var(--accent);
          font-weight: 600;
          font-size: 0.7rem;
          font-family: monospace;
        }
        .gap-card {
          padding: 8px 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.74rem;
        }
        .gap-q {
          color: var(--text-secondary);
        }
        .gap-time {
          color: var(--text-muted);
          font-size: 0.65rem;
          font-family: monospace;
        }
        .empty-subtext {
          font-size: 0.74rem;
          color: var(--text-muted);
          padding: 4px 0;
        }

        /* Settings Form */
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .field-label {
          font-size: 0.74rem;
          font-weight: 500;
          color: var(--text-secondary);
        }
        .field-input,
        .field-textarea {
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          color: var(--text-primary);
          font-size: 0.8rem;
          font-family: inherit;
          transition: border-color 0.15s ease;
        }
        .field-input:focus,
        .field-textarea:focus {
          outline: none;
          border-color: var(--accent);
        }
        .tone-pills {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .tone-pill {
          padding: 6px 8px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 0.75rem;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s ease;
        }
        .tone-pill:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }
        .tone-pill.active {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
          font-weight: 500;
        }
        .starter-chips-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 4px;
        }
        .starter-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 8px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          font-size: 0.72rem;
          color: var(--text-secondary);
        }
        .chip-del-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: color 0.15s ease;
        }
        .chip-del-btn:hover {
          color: var(--text-primary);
        }
        .add-starter-row {
          display: flex;
          gap: 6px;
        }
        .field-input-sm {
          flex: 1;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 5px 8px;
          color: var(--text-primary);
          font-size: 0.75rem;
        }
        .field-input-sm:focus {
          outline: none;
          border-color: var(--accent);
        }
        .add-starter-btn {
          padding: 5px 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.74rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .add-starter-btn:hover {
          background: var(--bg-hover);
          border-color: var(--border-hover);
        }
        .toggle-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .toggle-text {
          font-size: 0.76rem;
          color: var(--text-secondary);
        }
        .save-settings-btn {
          margin-top: 0.5rem;
          padding: 8px 14px;
          background: var(--accent);
          color: #ffffff;
          border: none;
          border-radius: var(--radius);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .save-settings-btn:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        /* Embed Tab */
        .embed-code-box {
          position: relative;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }
        .embed-code-pre {
          margin: 0;
          padding: 12px;
          overflow-x: auto;
          font-size: 0.74rem;
          color: var(--text-secondary);
          font-family: monospace;
          line-height: 1.45;
        }
        .embed-copy-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 4px 8px;
          background: var(--bg-hover);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.7rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .embed-copy-btn:hover {
          background: var(--bg-card);
          border-color: var(--border-hover);
        }
        .embed-settings-form {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .form-row-embed {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .field-label-embed {
          font-size: 0.74rem;
          color: var(--text-secondary);
        }
        .color-pick-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .color-input {
          width: 24px;
          height: 24px;
          padding: 0;
          border: 1px solid var(--border);
          border-radius: var(--radius-micro);
          cursor: pointer;
          background: transparent;
        }
        .color-val {
          font-size: 0.72rem;
          color: var(--text-muted);
          font-family: monospace;
        }
        .select-embed {
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-primary);
          padding: 4px 8px;
          border-radius: var(--radius-sm);
          font-size: 0.74rem;
        }
        .select-embed:focus {
          outline: none;
          border-color: var(--accent);
        }
        .form-group-embed {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        /* History Tab */
        .history-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 0.75rem;
        }
        .history-search-wrap {
          flex: 1;
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
        }
        .search-icon {
          color: var(--text-muted);
          display: flex;
          align-items: center;
        }
        .history-search-input {
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-primary);
          font-size: 0.75rem;
          width: 100%;
        }
        .clear-search-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        .clear-search-btn:hover {
          color: var(--text-primary);
        }
        .new-chat-drawer-btn {
          display: inline-flex;
          align-items: center;
          padding: 6px 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-secondary);
          font-size: 0.74rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .new-chat-drawer-btn:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .sessions-loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 2.5rem 1rem;
          color: var(--text-muted);
          font-size: 0.8rem;
        }
        .history-spinner {
          width: 14px;
          height: 14px;
          border: 2px solid var(--border);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: histSpin 0.8s linear infinite;
        }
        @keyframes histSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .sessions-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 2.5rem 1.5rem;
        }
        .empty-icon {
          color: var(--text-muted);
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .empty-title {
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 0.35rem 0;
          letter-spacing: -0.01em;
        }
        .empty-desc {
          font-size: 0.76rem;
          color: var(--text-muted);
          line-height: 1.45;
          margin: 0 0 1rem 0;
        }
        .empty-start-btn {
          padding: 6px 14px;
          background: var(--accent);
          border: none;
          border-radius: var(--radius);
          color: #ffffff;
          font-size: 0.76rem;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .empty-start-btn:hover {
          background: var(--accent-hover);
        }

        .session-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .session-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 10px 12px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }
        .session-card:hover {
          background: var(--bg-hover);
          border-color: var(--border-hover);
        }
        .session-card.active-session {
          background: var(--bg-hover);
          border-color: var(--accent);
        }
        .session-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 6px;
        }
        .session-date {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: monospace;
        }
        .session-badges {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .active-tag {
          font-size: 0.65rem;
          padding: 1px 6px;
          background: var(--bg-card);
          border: 1px solid var(--border-hover);
          border-radius: var(--radius-sm);
          color: var(--accent);
          font-weight: 500;
        }
        .msg-count-tag {
          font-size: 0.68rem;
          color: var(--text-muted);
          font-family: monospace;
        }
        .session-preview {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin: 0 0 8px 0;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .session-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1px solid var(--border);
          padding-top: 6px;
        }
        .resume-hint {
          display: inline-flex;
          align-items: center;
          font-size: 0.7rem;
          color: var(--text-muted);
          transition: color 0.15s ease;
        }
        .session-card:hover .resume-hint {
          color: var(--text-primary);
        }
        .delete-session-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: var(--radius-micro);
          transition: all 0.15s ease;
        }
        .delete-session-btn:hover {
          color: var(--text-primary);
          background: var(--bg-card);
        }
      `}</style>
    </aside>
  );
}
