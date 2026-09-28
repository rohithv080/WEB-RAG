"use client";

import { useEffect, useState, useMemo } from "react";
import type { SiteSummary } from "./BotCard";
import { BotCard } from "./BotCard";

type AdminMetrics = {
  summary: {
    totalSites: number;
    autoSyncSites: number;
    publicSites: number;
    totalPages: number;
    totalChunks: number;
    totalSessions: number;
    totalQueries: number;
    totalResponses: number;
    thumbsUp: number;
    thumbsDown: number;
    satisfactionRate: number | null;
    totalApiKeys: number;
    activeApiKeys: number;
    totalCreators: number;
    avgLatencyMs: number | null;
  };
  activityTimeline: Array<{
    date: string;
    label: string;
    count: number;
  }>;
  auditLogs: Array<{
    id: string;
    sessionId: string;
    botId: string | null;
    botName: string;
    botOwner: string;
    userQuery: string;
    latencyMs: number | null;
    rating: string | null;
    isWebFallback: boolean;
    createdAt: string;
  }>;
};

type Props = {
  sites: SiteSummary[];
  onSelectSite: (site: SiteSummary) => void;
  onDeleteSite: (siteId: string) => void;
  onSettings: (site: SiteSummary) => void;
  onAnalytics: (site: SiteSummary) => void;
  onEmbed: (site: SiteSummary) => void;
  onSyncSite: (siteId: string) => Promise<void>;
  onOpenApiKeys: () => void;
  onRefreshAll: () => Promise<void>;
};

export function AdminPlatformDashboard({
  sites,
  onSelectSite,
  onDeleteSite,
  onSettings,
  onAnalytics,
  onEmbed,
  onSyncSite,
  onOpenApiKeys,
  onRefreshAll,
}: Props) {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [activeTab, setActiveTab] = useState<"governance" | "analytics" | "audit">("governance");
  const [viewLayout, setViewLayout] = useState<"table" | "grid">("table");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<"all" | "sync" | "web" | "private">("all");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load platform-wide metrics
  async function fetchMetrics() {
    setLoadingMetrics(true);
    try {
      const res = await fetch("/api/admin/metrics");
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to load admin metrics:", err);
    } finally {
      setLoadingMetrics(false);
    }
  }

  useEffect(() => {
    fetchMetrics();
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchMetrics(), onRefreshAll()]);
    setRefreshing(false);
  }

  async function handleTriggerSync(siteId: string) {
    setSyncingId(siteId);
    try {
      await onSyncSite(siteId);
    } finally {
      setSyncingId(null);
    }
  }

  // Filtered sites for governance table
  const filteredSites = useMemo(() => {
    return sites.filter((s) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchDesc = (s.description || "").toLowerCase().includes(q);
        const matchOwner = (s.userId || "").toLowerCase().includes(q);
        const matchUrl = s.pages?.some((p) => p.url.toLowerCase().includes(q));
        if (!matchName && !matchDesc && !matchOwner && !matchUrl) return false;
      }
      if (filterTag === "sync" && !s.autoSync) return false;
      if (filterTag === "web" && s.enableWebSearch === false) return false;
      if (filterTag === "private" && s.isPublic !== false) return false;
      return true;
    });
  }, [sites, searchQuery, filterTag]);

  // Max query count for bar scaling
  const maxQueryCount = useMemo(() => {
    if (!metrics?.activityTimeline) return 1;
    return Math.max(...metrics.activityTimeline.map((a) => a.count), 1);
  }, [metrics]);

  // Top bots by chunks
  const topBots = useMemo(() => {
    return [...sites].sort((a, b) => (b.totalChunks || 0) - (a.totalChunks || 0)).slice(0, 5);
  }, [sites]);

  return (
    <div className="admin-dashboard-container">
      {/* ── Executive Header ────────────────────────────────────────── */}
      <header className="admin-header">
        <div className="header-left">
          <div className="title-row">
            <h1 className="admin-title">Platform Administration</h1>
            <span className="admin-badge">Super Admin</span>
            <div className="system-status-pill">
              <span className="live-dot" />
              <span>Operational</span>
            </div>
          </div>
          <p className="admin-sub">
            System-wide telemetry, knowledge base governance, and AI infrastructure monitoring for{" "}
            <strong>rohithjune05@gmail.com</strong>.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="action-btn"
            onClick={onOpenApiKeys}
            title="Manage platform API keys"
          >
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
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            <span>API Keys</span>
          </button>

          <button
            type="button"
            className={`action-btn refresh-btn ${refreshing ? "loading" : ""}`}
            onClick={handleRefresh}
            title="Refresh metrics and bots"
            disabled={refreshing}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={refreshing ? "spin-icon" : ""}
            >
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </header>

      {/* ── KPI Metrics Grid ────────────────────────────────────────── */}
      <section className="kpi-grid">
        <div className="kpi-card">
          <span className="kpi-label">Knowledge Bases</span>
          <div className="kpi-value-row">
            <span className="kpi-num">{sites.length}</span>
            <span className="kpi-tag">{metrics?.summary.autoSyncSites ?? 0} auto-sync</span>
          </div>
          <span className="kpi-sub">Total deployed knowledge bots</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Platform Creators</span>
          <div className="kpi-value-row">
            <span className="kpi-num">{metrics?.summary.totalCreators ?? 0}</span>
            <span className="kpi-tag neutral">Accounts</span>
          </div>
          <span className="kpi-sub">Registered bot deployers</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Indexed Sources</span>
          <div className="kpi-value-row">
            <span className="kpi-num">
              {metrics?.summary.totalPages ??
                sites.reduce((acc, s) => acc + (s.pages?.length || 0), 0)}
            </span>
            <span className="kpi-tag">Documents & URLs</span>
          </div>
          <span className="kpi-sub">Parsed & sanitized pages</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Vector Chunks</span>
          <div className="kpi-value-row">
            <span className="kpi-num">
              {(
                metrics?.summary.totalChunks ??
                sites.reduce((acc, s) => acc + (s.totalChunks || 0), 0)
              ).toLocaleString()}
            </span>
            <span className="kpi-tag accent">768-dim</span>
          </div>
          <span className="kpi-sub">Nomic pgvector embeddings</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Total Queries</span>
          <div className="kpi-value-row">
            <span className="kpi-num">{metrics?.summary.totalQueries ?? 0}</span>
            <span className="kpi-tag">Prompts</span>
          </div>
          <span className="kpi-sub">User questions answered</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Average Latency</span>
          <div className="kpi-value-row">
            <span className="kpi-num">
              {metrics?.summary.avgLatencyMs
                ? `${(metrics.summary.avgLatencyMs / 1000).toFixed(2)}s`
                : "—"}
            </span>
            <span className="kpi-tag neutral">Llama 3.3 70B</span>
          </div>
          <span className="kpi-sub">End-to-end RAG response</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">User CSAT Score</span>
          <div className="kpi-value-row">
            <span className="kpi-num">
              {metrics?.summary.satisfactionRate !== null &&
              metrics?.summary.satisfactionRate !== undefined
                ? `${metrics.summary.satisfactionRate}%`
                : "100%"}
            </span>
            <span className="kpi-tag positive">
              +{metrics?.summary.thumbsUp ?? 0} / -{metrics?.summary.thumbsDown ?? 0}
            </span>
          </div>
          <span className="kpi-sub">Positive feedback rating</span>
        </div>

        <div className="kpi-card">
          <span className="kpi-label">Active API Keys</span>
          <div className="kpi-value-row">
            <span className="kpi-num">{metrics?.summary.activeApiKeys ?? 0}</span>
            <span className="kpi-tag neutral">Issued</span>
          </div>
          <span className="kpi-sub">OpenAI Gateway tokens</span>
        </div>
      </section>

      {/* ── Navigation Tabs ─────────────────────────────────────────── */}
      <nav className="admin-nav-tabs">
        <button
          type="button"
          className={`tab-btn ${activeTab === "governance" ? "active" : ""}`}
          onClick={() => setActiveTab("governance")}
        >
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
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
          <span>All Knowledge Bases ({sites.length})</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "analytics" ? "active" : ""}`}
          onClick={() => setActiveTab("analytics")}
        >
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
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          <span>Platform Analytics & Trends</span>
        </button>

        <button
          type="button"
          className={`tab-btn ${activeTab === "audit" ? "active" : ""}`}
          onClick={() => setActiveTab("audit")}
        >
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
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          <span>Live Audit Stream ({metrics?.auditLogs?.length ?? 0})</span>
        </button>
      </nav>

      {/* ── TAB 1: GOVERNANCE & ALL BOTS ────────────────────────────── */}
      {activeTab === "governance" && (
        <section className="tab-pane">
          <div className="governance-toolbar">
            <div className="search-wrap">
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
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search by bot name, owner ID, or indexed URL…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="governance-search-input"
              />
              {searchQuery && (
                <button type="button" className="clear-search" onClick={() => setSearchQuery("")}>
                  ✕
                </button>
              )}
            </div>

            <div className="filter-group">
              <button
                type="button"
                className={`filter-btn ${filterTag === "all" ? "active" : ""}`}
                onClick={() => setFilterTag("all")}
              >
                All ({sites.length})
              </button>
              <button
                type="button"
                className={`filter-btn ${filterTag === "sync" ? "active" : ""}`}
                onClick={() => setFilterTag("sync")}
              >
                Auto-Sync
              </button>
              <button
                type="button"
                className={`filter-btn ${filterTag === "web" ? "active" : ""}`}
                onClick={() => setFilterTag("web")}
              >
                Web Grounded
              </button>
              <button
                type="button"
                className={`filter-btn ${filterTag === "private" ? "active" : ""}`}
                onClick={() => setFilterTag("private")}
              >
                Private
              </button>
            </div>

            <div className="layout-toggle">
              <button
                type="button"
                className={`layout-btn ${viewLayout === "table" ? "active" : ""}`}
                onClick={() => setViewLayout("table")}
                title="Table View (Governance Standard)"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                type="button"
                className={`layout-btn ${viewLayout === "grid" ? "active" : ""}`}
                onClick={() => setViewLayout("grid")}
                title="Grid View (Cards)"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
            </div>
          </div>

          {filteredSites.length === 0 ? (
            <div className="empty-box">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p>No knowledge bases match your filter query.</p>
            </div>
          ) : viewLayout === "table" ? (
            <div className="table-responsive">
              <table className="governance-table">
                <thead>
                  <tr>
                    <th>Knowledge Base</th>
                    <th>Owner / Creator</th>
                    <th>Sources</th>
                    <th>Vector Chunks</th>
                    <th>Auto-Sync</th>
                    <th>Access</th>
                    <th>Created</th>
                    <th style={{ textAlign: "right" }}>Governance Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSites.map((site) => (
                    <tr key={site.id}>
                      <td className="bot-primary-cell">
                        <button
                          type="button"
                          className="bot-name-btn"
                          onClick={() => onSelectSite(site)}
                          title="Open bot in chat workspace"
                        >
                          <span className="bot-name-text">{site.name}</span>
                        </button>
                        {site.description && (
                          <span className="bot-desc-text">{site.description}</span>
                        )}
                      </td>
                      <td>
                        <span className="owner-badge">
                          {site.userId ? site.userId.slice(0, 16) : "Public / System"}
                        </span>
                      </td>
                      <td>
                        <span className="sources-count">{site.pages?.length || 0} pages</span>
                      </td>
                      <td>
                        <span className="chunks-badge">
                          {(site.totalChunks || 0).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        {site.autoSync ? (
                          <span className="sync-pill active">
                            <span className="sync-dot" />
                            <span>{site.syncFrequency || "daily"}</span>
                          </span>
                        ) : (
                          <span className="sync-pill manual">Manual</span>
                        )}
                      </td>
                      <td>
                        <span className={`access-pill ${site.isPublic ? "public" : "private"}`}>
                          {site.isPublic ? "Public" : "Private"}
                        </span>
                      </td>
                      <td className="date-cell">
                        {new Date(site.scrapedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="actions-cell">
                        <div className="action-button-row">
                          <button
                            type="button"
                            className="gov-action-btn"
                            onClick={() => onSelectSite(site)}
                            title="Test / Chat with bot"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            <span>Chat</span>
                          </button>

                          <button
                            type="button"
                            className="gov-action-btn"
                            onClick={() => onAnalytics(site)}
                            title="View bot telemetry & gaps"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <line x1="18" y1="20" x2="18" y2="10" />
                              <line x1="12" y1="20" x2="12" y2="4" />
                              <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                            <span>Stats</span>
                          </button>

                          <button
                            type="button"
                            className="gov-action-btn"
                            onClick={() => onSettings(site)}
                            title="Configure bot settings"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="3" />
                              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className={`gov-action-btn ${syncingId === site.id ? "loading" : ""}`}
                            onClick={() => handleTriggerSync(site.id)}
                            disabled={syncingId === site.id}
                            title="Force Sync Now"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className={syncingId === site.id ? "spin-icon" : ""}
                            >
                              <polyline points="23 4 23 10 17 10" />
                              <polyline points="1 20 1 14 7 14" />
                              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                            </svg>
                          </button>

                          <button
                            type="button"
                            className="gov-action-btn delete-btn"
                            onClick={() => onDeleteSite(site.id)}
                            title="Delete Knowledge Base"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid-container">
              {filteredSites.map((site) => (
                <BotCard
                  key={site.id}
                  site={site}
                  onClick={() => onSelectSite(site)}
                  onDelete={onDeleteSite}
                  onEmbed={onEmbed}
                  onSettings={onSettings}
                  onAnalytics={onAnalytics}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── TAB 2: PLATFORM ANALYTICS & TRENDS ───────────────────────── */}
      {activeTab === "analytics" && (
        <section className="tab-pane analytics-tab">
          <div className="chart-card">
            <div className="chart-header">
              <div>
                <h3 className="chart-title">Daily Platform Query Activity</h3>
                <p className="chart-sub">
                  Volume of user prompts processed across all knowledge bases over the last 14 days.
                </p>
              </div>
              <span className="chart-total-pill">
                {metrics?.activityTimeline.reduce((sum, a) => sum + a.count, 0) || 0} total queries
                (14d)
              </span>
            </div>

            <div className="chart-bars-wrap">
              {metrics?.activityTimeline.map((item) => {
                const heightPercent = Math.max(
                  Math.round((item.count / maxQueryCount) * 100),
                  item.count > 0 ? 8 : 2
                );
                return (
                  <div
                    key={item.date}
                    className="bar-col"
                    title={`${item.label}: ${item.count} queries`}
                  >
                    <span className="bar-count">{item.count > 0 ? item.count : ""}</span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ height: `${heightPercent}%` }} />
                    </div>
                    <span className="bar-label">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="analytics-split-row">
            {/* Top Bots */}
            <div className="sub-panel">
              <h4 className="sub-panel-title">Largest Knowledge Bases by Vector Density</h4>
              <p className="sub-panel-sub">Ranked by total pgvector 768-dim embeddings.</p>

              <div className="density-list">
                {topBots.map((bot, idx) => {
                  const maxChunks = topBots[0]?.totalChunks || 1;
                  const pct = Math.max(Math.round(((bot.totalChunks || 0) / maxChunks) * 100), 5);
                  return (
                    <div key={bot.id} className="density-item">
                      <div className="density-header">
                        <span className="density-rank">#{idx + 1}</span>
                        <span className="density-name">{bot.name}</span>
                        <span className="density-val">
                          {(bot.totalChunks || 0).toLocaleString()} chunks
                        </span>
                      </div>
                      <div className="density-bar-track">
                        <div className="density-bar-fill" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quality & Telemetry */}
            <div className="sub-panel">
              <h4 className="sub-panel-title">Quality & Telemetry Overview</h4>
              <p className="sub-panel-sub">Response satisfaction and infrastructure health.</p>

              <div className="quality-stats-list">
                <div className="quality-row">
                  <span className="q-label">Positive Feedback Ratio</span>
                  <span className="q-val positive">
                    {metrics?.summary.satisfactionRate ?? 100}%
                  </span>
                </div>
                <div className="quality-row">
                  <span className="q-label">Total Thumbs Up</span>
                  <span className="q-val">+{metrics?.summary.thumbsUp ?? 0}</span>
                </div>
                <div className="quality-row">
                  <span className="q-label">Total Thumbs Down</span>
                  <span className="q-val negative">-{metrics?.summary.thumbsDown ?? 0}</span>
                </div>
                <div className="quality-row">
                  <span className="q-label">Average Response Latency</span>
                  <span className="q-val">
                    {metrics?.summary.avgLatencyMs
                      ? `${(metrics.summary.avgLatencyMs / 1000).toFixed(2)}s`
                      : "—"}
                  </span>
                </div>
                <div className="quality-row">
                  <span className="q-label">Active API Key Integrations</span>
                  <span className="q-val accent">{metrics?.summary.activeApiKeys ?? 0} keys</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── TAB 3: SYSTEM AUDIT STREAM ──────────────────────────────── */}
      {activeTab === "audit" && (
        <section className="tab-pane">
          <div className="audit-header">
            <h3 className="chart-title">Live Platform Audit Stream</h3>
            <p className="chart-sub">
              Real-time log of the latest queries and AI generation events across all bots.
            </p>
          </div>

          {metrics?.auditLogs.length === 0 ? (
            <div className="empty-box">
              <p>No query logs recorded yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="governance-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Target Bot</th>
                    <th>User Query</th>
                    <th>Latency</th>
                    <th>Web Fallback</th>
                    <th>Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics?.auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="date-cell">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td>
                        <span className="bot-audit-tag">{log.botName}</span>
                      </td>
                      <td className="query-cell">
                        <span className="query-text" title={log.userQuery}>
                          {log.userQuery}
                        </span>
                      </td>
                      <td>
                        <span className="latency-pill">
                          {log.latencyMs ? `${(log.latencyMs / 1000).toFixed(2)}s` : "—"}
                        </span>
                      </td>
                      <td>
                        <span className={`web-badge ${log.isWebFallback ? "yes" : "no"}`}>
                          {log.isWebFallback ? "Live Web" : "Vector Only"}
                        </span>
                      </td>
                      <td>
                        {log.rating === "up" ? (
                          <span className="rating-pill up">Thumbs Up</span>
                        ) : log.rating === "down" ? (
                          <span className="rating-pill down">Thumbs Down</span>
                        ) : (
                          <span className="rating-pill unrated">Unrated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <style jsx>{`
        .admin-dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 24px 32px;
          background: var(--bg);
          min-height: 100vh;
        }

        /* Header */
        .admin-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .header-left {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .title-row {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .admin-title {
          margin: 0;
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--text-main);
        }
        .admin-badge {
          font-size: 0.68rem;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: var(--radius-micro);
          background: rgba(37, 99, 235, 0.12);
          border: 1px solid rgba(37, 99, 235, 0.25);
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .system-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.7rem;
          font-weight: 500;
          color: #10b981;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 2px 8px;
          border-radius: var(--radius-micro);
        }
        .live-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 6px rgba(16, 185, 129, 0.6);
        }
        .admin-sub {
          margin: 0;
          font-size: 0.82rem;
          color: var(--text-muted);
          line-height: 1.45;
        }
        .admin-sub strong {
          color: var(--text-main);
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .action-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-main);
          border-color: var(--border-hover);
        }
        .spin-icon {
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }

        /* KPI Grid */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
        }
        @media (max-width: 1200px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 640px) {
          .kpi-grid {
            grid-template-columns: 1fr;
          }
        }
        .kpi-card {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding: 14px 16px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          transition: border-color 0.15s ease;
        }
        .kpi-card:hover {
          border-color: var(--border-hover);
        }
        .kpi-label {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .kpi-value-row {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }
        .kpi-num {
          font-size: 1.45rem;
          font-weight: 700;
          color: var(--text-main);
          letter-spacing: -0.02em;
        }
        .kpi-tag {
          font-size: 0.68rem;
          font-weight: 500;
          padding: 1px 6px;
          border-radius: var(--radius-micro);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
        }
        .kpi-tag.accent {
          background: rgba(37, 99, 235, 0.1);
          border-color: rgba(37, 99, 235, 0.2);
          color: var(--accent);
        }
        .kpi-tag.positive {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }
        .kpi-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
        }

        /* Tabs Nav */
        .admin-nav-tabs {
          display: flex;
          gap: 6px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 2px;
        }
        .tab-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.78rem;
          font-weight: 500;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }
        .tab-btn:hover {
          color: var(--text-main);
          background: var(--bg-hover);
        }
        .tab-btn.active {
          color: var(--accent);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          font-weight: 600;
        }

        /* Tab Pane */
        .tab-pane {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Toolbar */
        .governance-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .search-wrap {
          position: relative;
          display: flex;
          align-items: center;
          flex: 1;
          min-width: 280px;
          max-width: 440px;
        }
        .search-wrap svg {
          position: absolute;
          left: 10px;
          color: var(--text-muted);
          pointer-events: none;
        }
        .governance-search-input {
          width: 100%;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 6px 28px 6px 30px;
          color: var(--text-main);
          font-size: 0.78rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .governance-search-input:focus {
          border-color: var(--accent);
        }
        .clear-search {
          position: absolute;
          right: 8px;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.7rem;
        }
        .filter-group {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .filter-btn {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
          font-size: 0.72rem;
          padding: 4px 9px;
          border-radius: var(--radius-micro);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-btn:hover {
          color: var(--text-main);
          border-color: var(--border-hover);
        }
        .filter-btn.active {
          color: var(--accent);
          background: var(--accent-soft);
          border-color: rgba(37, 99, 235, 0.3);
          font-weight: 600;
        }
        .layout-toggle {
          display: flex;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 2px;
          gap: 2px;
        }
        .layout-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px 7px;
          border: none;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: var(--radius-micro);
        }
        .layout-btn.active {
          background: var(--bg-card);
          color: var(--text-main);
        }

        /* Table */
        .table-responsive {
          overflow-x: auto;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-card);
        }
        .governance-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.78rem;
          text-align: left;
        }
        .governance-table th {
          padding: 10px 14px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
          color: var(--text-muted);
          font-weight: 600;
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .governance-table td {
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
          color: var(--text-main);
          vertical-align: middle;
        }
        .governance-table tr:last-child td {
          border-bottom: none;
        }
        .governance-table tr:hover td {
          background: var(--bg-hover);
        }
        .bot-primary-cell {
          max-width: 260px;
        }
        .bot-name-btn {
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
          display: block;
        }
        .bot-name-text {
          font-weight: 600;
          color: var(--text-main);
          font-size: 0.82rem;
          transition: color 0.15s ease;
        }
        .bot-name-btn:hover .bot-name-text {
          color: var(--accent);
          text-decoration: underline;
        }
        .bot-desc-text {
          display: block;
          font-size: 0.72rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 2px;
        }
        .owner-badge {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          padding: 2px 6px;
          border-radius: var(--radius-micro);
        }
        .sources-count {
          font-size: 0.75rem;
          color: var(--text-main);
        }
        .chunks-badge {
          font-family: var(--font-mono, monospace);
          font-size: 0.72rem;
          color: var(--accent);
          background: var(--accent-soft);
          border: 1px solid rgba(37, 99, 235, 0.2);
          padding: 2px 6px;
          border-radius: var(--radius-micro);
        }
        .sync-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.7rem;
          padding: 2px 6px;
          border-radius: var(--radius-micro);
          border: 1px solid var(--border);
        }
        .sync-pill.active {
          color: #10b981;
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.2);
        }
        .sync-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #10b981;
        }
        .sync-pill.manual {
          color: var(--text-muted);
          background: var(--bg-surface);
        }
        .access-pill {
          font-size: 0.68rem;
          font-weight: 500;
          padding: 1px 6px;
          border-radius: var(--radius-micro);
          border: 1px solid var(--border);
        }
        .access-pill.public {
          color: var(--text-muted);
          background: var(--bg-surface);
        }
        .access-pill.private {
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.08);
          border-color: rgba(251, 191, 36, 0.2);
        }
        .date-cell {
          font-size: 0.72rem;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .action-button-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 4px;
        }
        .gov-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 3px 7px;
          border-radius: var(--radius-micro);
          font-size: 0.7rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .gov-action-btn:hover {
          background: var(--bg-hover);
          color: var(--text-main);
          border-color: var(--border-hover);
        }
        .delete-btn:hover {
          background: rgba(239, 68, 68, 0.08);
          border-color: rgba(239, 68, 68, 0.3);
          color: #ef4444;
        }

        /* Grid */
        .grid-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(310px, 1fr));
          gap: 16px;
        }

        /* Analytics Tab */
        .analytics-tab {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .chart-card {
          padding: 18px 20px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .chart-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }
        .chart-title {
          margin: 0 0 4px 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--text-main);
        }
        .chart-sub {
          margin: 0;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .chart-total-pill {
          font-size: 0.72rem;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: var(--radius-micro);
          background: var(--accent-soft);
          border: 1px solid rgba(37, 99, 235, 0.25);
          color: var(--accent);
          white-space: nowrap;
        }
        .chart-bars-wrap {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          height: 160px;
          padding-top: 20px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 8px;
        }
        .bar-col {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          gap: 6px;
        }
        .bar-count {
          font-size: 0.65rem;
          font-weight: 600;
          color: var(--accent);
          height: 14px;
        }
        .bar-track {
          flex: 1;
          width: 100%;
          max-width: 32px;
          background: var(--bg-surface);
          border-radius: var(--radius-micro) var(--radius-micro) 0 0;
          display: flex;
          align-items: flex-end;
        }
        .bar-fill {
          width: 100%;
          background: var(--accent);
          border-radius: var(--radius-micro) var(--radius-micro) 0 0;
          transition:
            height 0.3s ease,
            background 0.15s ease;
        }
        .bar-col:hover .bar-fill {
          background: #3b82f6;
        }
        .bar-label {
          font-size: 0.65rem;
          color: var(--text-muted);
          white-space: nowrap;
        }
        .analytics-split-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .analytics-split-row {
            grid-template-columns: 1fr;
          }
        }
        .sub-panel {
          padding: 16px 18px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .sub-panel-title {
          margin: 0;
          font-size: 0.88rem;
          font-weight: 600;
          color: var(--text-main);
        }
        .sub-panel-sub {
          margin: 0;
          font-size: 0.74rem;
          color: var(--text-muted);
        }
        .density-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }
        .density-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .density-header {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.76rem;
        }
        .density-rank {
          font-weight: 700;
          color: var(--text-muted);
          font-size: 0.7rem;
        }
        .density-name {
          flex: 1;
          color: var(--text-main);
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .density-val {
          font-family: var(--font-mono, monospace);
          color: var(--accent);
          font-size: 0.72rem;
        }
        .density-bar-track {
          height: 4px;
          width: 100%;
          background: var(--bg-surface);
          border-radius: 2px;
          overflow: hidden;
        }
        .density-bar-fill {
          height: 100%;
          background: var(--accent);
          border-radius: 2px;
        }
        .quality-stats-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 4px;
        }
        .quality-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid var(--border);
          font-size: 0.76rem;
        }
        .quality-row:last-child {
          border-bottom: none;
        }
        .q-label {
          color: var(--text-muted);
        }
        .q-val {
          font-weight: 600;
          color: var(--text-main);
        }
        .q-val.positive {
          color: #10b981;
        }
        .q-val.negative {
          color: #ef4444;
        }
        .q-val.accent {
          color: var(--accent);
        }

        /* Audit Stream */
        .audit-header {
          margin-bottom: 4px;
        }
        .bot-audit-tag {
          font-size: 0.74rem;
          font-weight: 600;
          color: var(--text-main);
        }
        .query-cell {
          max-width: 320px;
        }
        .query-text {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 0.76rem;
          color: var(--text-muted);
        }
        .latency-pill {
          font-family: var(--font-mono, monospace);
          font-size: 0.7rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          padding: 1px 5px;
          border-radius: var(--radius-micro);
        }
        .web-badge {
          font-size: 0.68rem;
          padding: 1px 6px;
          border-radius: var(--radius-micro);
          border: 1px solid var(--border);
        }
        .web-badge.yes {
          color: var(--accent);
          background: var(--accent-soft);
          border-color: rgba(37, 99, 235, 0.25);
        }
        .web-badge.no {
          color: var(--text-muted);
          background: var(--bg-surface);
        }
        .rating-pill {
          font-size: 0.68rem;
          font-weight: 500;
          padding: 1px 6px;
          border-radius: var(--radius-micro);
        }
        .rating-pill.up {
          color: #10b981;
          background: rgba(16, 185, 129, 0.1);
        }
        .rating-pill.down {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
        .rating-pill.unrated {
          color: var(--text-muted);
          background: var(--bg-surface);
        }

        .empty-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: var(--text-muted);
          gap: 10px;
          text-align: center;
          border: 1px dashed var(--border);
          border-radius: var(--radius);
          background: var(--bg-card);
        }
      `}</style>
    </div>
  );
}
