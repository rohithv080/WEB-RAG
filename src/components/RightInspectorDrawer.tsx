"use client";

import { useState, useEffect, useRef, FormEvent } from "react";
import type { SiteSummary } from "./BotCard";
import { UrlInput } from "./UrlInput";
import { ChunkExplorerView } from "./ChunkExplorerView";

export type DrawerTab = "pages" | "analytics" | "settings" | "embed";

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

  // Analytics State
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Embed Customizer State
  const [embedColor, setEmbedColor] = useState("#7c7cff");
  const [embedPosition, setEmbedPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
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
  const origin = typeof window !== "undefined" ? window.location.origin : "https://rohith-rag.vercel.app";
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
          ✕
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
          <span>📁 Pages</span>
          <span className="tab-count">{site.pages.length}</span>
        </button>
        <button
          type="button"
          className={`drawer-tab ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("analytics");
          }}
        >
          <span>📊 Analytics</span>
        </button>
        <button
          type="button"
          className={`drawer-tab ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("settings");
          }}
        >
          <span>⚙️ Settings</span>
        </button>
        <button
          type="button"
          className={`drawer-tab ${activeTab === "embed" ? "active" : ""}`}
          onClick={() => {
            setInspectingPageId(null);
            onTabChange("embed");
          }}
        >
          <span>&lt;/&gt; Embed</span>
        </button>
      </div>

      {/* Tab Content Container */}
      <div className="drawer-content">
        {/* ── TAB 1: PAGES & DOCUMENTS ──────────────────────────────── */}
        {activeTab === "pages" && (
          inspectingPageId ? (
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
                    <span className="upload-icon">📎</span>
                    <div className="upload-texts">
                      <span className="upload-primary">
                        {uploadingDoc ? "Extracting & Indexing Document..." : "Upload Document"}
                      </span>
                      <span className="upload-sub">Supports PDF, Word (.docx), TXT, Markdown, CSV, JSON</span>
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
                    const displayTitle = p.title || (isDocument ? p.url.replace("doc://", "") : domain);

                    return (
                      <div
                        key={p.id}
                        className="drawer-page-card"
                        onClick={() => setInspectingPageId(p.id)}
                        title="Click to inspect all pgvector chunks"
                      >
                        <div className="page-card-icon">
                          {isDocument ? "📄" : "🌐"}
                        </div>
                        <div className="page-card-info">
                          <span className="page-card-title">
                            {displayTitle}
                          </span>
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
                              <span className={refreshingPageId === p.id ? "spinning" : ""}>↻</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}

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
                      <div className="empty-subtext">No content gaps detected. Knowledge base is strong!</div>
                    ) : (
                      analytics.contentGaps.slice(0, 4).map((g, idx) => (
                        <div key={idx} className="gap-card">
                          <span className="gap-q">❓ "{g.question}"</span>
                          <span className="gap-time">{new Date(g.createdAt).toLocaleDateString()}</span>
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
              <label className="field-label">Suggested Starter Prompts ({starterQuestions.length}/6)</label>
              <div className="starter-chips-wrap">
                {starterQuestions.map((q, idx) => (
                  <span key={idx} className="starter-chip">
                    <span>{q}</span>
                    <button
                      type="button"
                      className="chip-del-btn"
                      onClick={() => handleRemoveQuestion(idx)}
                    >
                      ×
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
                Paste this single script tag right before the closing <code>&lt;/body&gt;</code> tag on any website.
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
      </div>

      <style jsx>{`
        .right-drawer {
          width: 380px;
          height: 100%;
          background: #0f0f13;
          border-left: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          z-index: 20;
          animation: slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes slideInRight {
          0% { transform: translateX(100%); }
          100% { transform: translateX(0); }
        }

        .drawer-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
        }
        .drawer-title-wrap {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
        }
        .drawer-bot-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: #f4f4f5;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .drawer-badge {
          font-size: 0.68rem;
          padding: 2px 6px;
          background: rgba(124, 124, 255, 0.1);
          color: #a78bfa;
          border: 1px solid rgba(124, 124, 255, 0.2);
          border-radius: 4px;
          flex-shrink: 0;
        }
        .drawer-close-btn {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #a1a1aa;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.8rem;
          transition: all 0.15s ease;
        }
        .drawer-close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .drawer-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(0, 0, 0, 0.2);
          overflow-x: auto;
        }
        .drawer-tab {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 10px 6px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: #8a8f98;
          font-size: 0.76rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s ease;
        }
        .drawer-tab:hover {
          color: #e4e4e7;
          background: rgba(255, 255, 255, 0.02);
        }
        .drawer-tab.active {
          color: #7c7cff;
          border-bottom-color: #7c7cff;
          background: rgba(124, 124, 255, 0.05);
        }
        .tab-count {
          font-size: 0.65rem;
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 5px;
          border-radius: 10px;
        }

        .drawer-content {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem;
        }
        .tab-panel {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .panel-section {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .section-label {
          font-size: 0.76rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #8a8f98;
        }
        .section-desc {
          margin: 0;
          font-size: 0.78rem;
          color: #a1a1aa;
          line-height: 1.4;
        }
        .section-desc code {
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 4px;
          border-radius: 3px;
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
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: #e4e4e7;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }
        .upload-dropzone-btn:hover {
          background: rgba(124, 124, 255, 0.05);
          border-color: rgba(124, 124, 255, 0.3);
        }
        .upload-icon {
          font-size: 1.1rem;
        }
        .upload-texts {
          display: flex;
          flex-direction: column;
        }
        .upload-primary {
          font-size: 0.8rem;
          font-weight: 500;
          color: #f4f4f5;
        }
        .upload-sub {
          font-size: 0.68rem;
          color: #8a8f98;
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
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          transition: background 0.15s ease;
        }
        .drawer-page-card:hover {
          background: rgba(255, 255, 255, 0.04);
        }
        .page-card-icon {
          font-size: 0.95rem;
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
          color: #e4e4e7;
          text-decoration: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .page-card-title:hover {
          color: #7c7cff;
        }
        .page-card-meta {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.68rem;
          color: #8a8f98;
          margin-top: 2px;
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
          gap: 3px;
          background: rgba(124, 124, 255, 0.1);
          border: 1px solid rgba(124, 124, 255, 0.25);
          color: #c7d2fe;
          font-size: 0.68rem;
          font-weight: 500;
          padding: 2px 7px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .inspect-chunks-btn:hover {
          background: rgba(124, 124, 255, 0.2);
          border-color: #7c7cff;
          color: #ffffff;
        }
        .re-scrape-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #8a8f98;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.15s ease;
        }
        .re-scrape-btn:hover {
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
        }
        .spinning {
          display: inline-block;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        /* Analytics Tab */
        .metric-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }
        .metric-card {
          padding: 10px 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }
        .metric-num {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f4f4f5;
        }
        .metric-num.satisfaction {
          color: #34d399;
        }
        .metric-lbl {
          font-size: 0.64rem;
          color: #8a8f98;
          margin-top: 2px;
        }

        .top-sources-list, .gaps-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .top-source-row {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
          font-size: 0.74rem;
        }
        .source-rank {
          color: #8a8f98;
          font-weight: 600;
          font-size: 0.68rem;
        }
        .source-name {
          flex: 1;
          color: #e4e4e7;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .source-hits {
          color: #a78bfa;
          font-weight: 500;
          font-size: 0.7rem;
        }
        .gap-card {
          padding: 8px 10px;
          background: rgba(248, 113, 113, 0.06);
          border: 1px solid rgba(248, 113, 113, 0.15);
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.74rem;
        }
        .gap-q {
          color: #fca5a5;
        }
        .gap-time {
          color: #8a8f98;
          font-size: 0.65rem;
        }
        .empty-subtext {
          font-size: 0.74rem;
          color: #8a8f98;
          font-style: italic;
          padding: 4px 0;
        }

        /* Settings Form */
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .field-label {
          font-size: 0.74rem;
          font-weight: 600;
          color: #a1a1aa;
        }
        .field-input, .field-textarea {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 6px;
          padding: 8px 10px;
          color: #f4f4f5;
          font-size: 0.8rem;
          font-family: inherit;
        }
        .field-input:focus, .field-textarea:focus {
          outline: none;
          border-color: #7c7cff;
        }
        .tone-pills {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
        }
        .tone-pill {
          padding: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          color: #8a8f98;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .tone-pill.active {
          background: rgba(124, 124, 255, 0.15);
          border-color: #7c7cff;
          color: #fff;
          font-weight: 600;
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
          gap: 4px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          font-size: 0.72rem;
          color: #d4d4d8;
        }
        .chip-del-btn {
          background: transparent;
          border: none;
          color: #8a8f98;
          cursor: pointer;
          font-size: 0.85rem;
          padding: 0;
        }
        .chip-del-btn:hover {
          color: #ef4444;
        }
        .add-starter-row {
          display: flex;
          gap: 6px;
        }
        .field-input-sm {
          flex: 1;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 5px 8px;
          color: #f4f4f5;
          font-size: 0.75rem;
        }
        .add-starter-btn {
          padding: 5px 10px;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          color: #f4f4f5;
          font-size: 0.74rem;
          cursor: pointer;
        }
        .toggle-row {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .toggle-text {
          font-size: 0.76rem;
          color: #d4d4d8;
        }
        .save-settings-btn {
          margin-top: 0.5rem;
          padding: 9px;
          background: #7c7cff;
          color: #fff;
          border: none;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .save-settings-btn:hover:not(:disabled) {
          background: #6a6aff;
        }

        /* Embed Tab */
        .embed-code-box {
          position: relative;
          background: #09090c;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          overflow: hidden;
        }
        .embed-code-pre {
          margin: 0;
          padding: 10px;
          overflow-x: auto;
          font-size: 0.74rem;
          color: #93c5fd;
          font-family: monospace;
          line-height: 1.45;
        }
        .embed-copy-btn {
          position: absolute;
          top: 6px;
          right: 6px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 4px;
          color: #fff;
          font-size: 0.7rem;
          cursor: pointer;
        }
        .embed-settings-form {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .form-row-embed {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .field-label-embed {
          font-size: 0.74rem;
          color: #a1a1aa;
        }
        .color-pick-wrap {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .color-input {
          width: 28px;
          height: 28px;
          padding: 0;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          background: transparent;
        }
        .color-val {
          font-size: 0.72rem;
          color: #8a8f98;
          font-family: monospace;
        }
        .select-embed {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #f4f4f5;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.74rem;
        }
        .form-group-embed {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
      `}</style>
    </aside>
  );
}
