"use client";

import { useState, useEffect, useMemo } from "react";
import type { SiteSummary } from "./BotCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  site: SiteSummary | null;
  isOpen: boolean;
  onClose: () => void;
};

type CitationItem = {
  chunkId?: string;
  heading?: string;
  snippet?: string;
  pageUrl?: string;
  url?: string;
};

type AnalyticsMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: CitationItem[] | null;
  rating?: "up" | "down" | null;
  feedback?: string | null;
  latencyMs?: number | null;
  createdAt: string;
};

type AnalyticsTranscript = {
  id: string;
  createdAt: string;
  messageCount: number;
  messages: AnalyticsMessage[];
};

type ContentGap = {
  question: string;
  answerSnippet: string;
  createdAt: string;
  sessionId: string;
};

type TopSource = {
  url: string;
  heading?: string;
  count: number;
};

type AnalyticsData = {
  site: {
    id: string;
    name: string;
    totalPages: number;
  };
  metrics: {
    totalQueries: number;
    totalSessions: number;
    totalResponses: number;
    thumbsUpCount: number;
    thumbsDownCount: number;
    satisfactionRate: number | null;
    avgLatencyMs: number | null;
  };
  topCitedSources: TopSource[];
  contentGaps: ContentGap[];
  activityTimeline: { date: string; count: number }[];
  transcripts: AnalyticsTranscript[];
};

export function AnalyticsModal({ site, isOpen, onClose }: Props) {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"logs" | "gaps" | "sources">("logs");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen || !site) return;

    setLoading(true);
    setError(null);
    setSearchQuery("");

    fetch(`/api/sites/${site.id}/analytics`)
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `Failed to fetch analytics (${res.status})`);
        }
        return res.json();
      })
      .then((json) => {
        setData(json);
        // Expand first 2 sessions by default
        if (json.transcripts && json.transcripts.length > 0) {
          const initialExpanded: Record<string, boolean> = {};
          json.transcripts.slice(0, 2).forEach((s: AnalyticsTranscript) => {
            initialExpanded[s.id] = true;
          });
          setExpandedSessions(initialExpanded);
        }
      })
      .catch((err) => {
        console.error("[analytics error]", err);
        setError(err.message || "Failed to load analytics");
      })
      .finally(() => setLoading(false));
  }, [isOpen, site]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => ({
      ...prev,
      [sessionId]: !prev[sessionId],
    }));
  };

  const filteredTranscripts = useMemo(() => {
    if (!data?.transcripts) return [];
    if (!searchQuery.trim()) return data.transcripts;

    const q = searchQuery.toLowerCase();
    return data.transcripts.filter((t) =>
      t.messages.some((m) => m.content.toLowerCase().includes(q))
    );
  }, [data?.transcripts, searchQuery]);

  // Export handlers
  const exportCSV = () => {
    if (!data?.transcripts) return;

    const rows: string[] = [
      "Session ID,Timestamp,Role,Content,Citations Count,Latency (ms),Rating,Feedback",
    ];

    for (const session of data.transcripts) {
      for (const m of session.messages) {
        const escapedContent = `"${m.content.replace(/"/g, '""')}"`;
        const citeCount = Array.isArray(m.citations) ? m.citations.length : 0;
        const latency = m.latencyMs ?? "";
        const rating = m.rating ?? "";
        const feedback = m.feedback ? `"${m.feedback.replace(/"/g, '""')}"` : "";
        rows.push(
          `${session.id},${m.createdAt},${m.role},${escapedContent},${citeCount},${latency},${rating},${feedback}`
        );
      }
    }

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${site?.name || "bot"}-chat-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJSON = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${site?.name || "bot"}-analytics-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen || !site) return null;

  const maxActivityCount = data?.activityTimeline
    ? Math.max(...data.activityTimeline.map((a) => a.count), 1)
    : 1;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="header-left">
            <div className="bot-avatar">📊</div>
            <div>
              <div className="title-row">
                <h2 className="modal-title">{site.name} Analytics</h2>
                <span className="live-pill">
                  <span className="live-dot" /> Live Metrics
                </span>
              </div>
              <p className="modal-subtitle">
                Inspect real-time queries, satisfaction feedback, cited documentation, and content
                gaps.
              </p>
            </div>
          </div>

          <div className="header-actions">
            {data && (
              <div className="export-dropdown">
                <button
                  type="button"
                  className="export-btn"
                  onClick={exportCSV}
                  title="Export as CSV spreadsheet"
                >
                  📥 Export CSV
                </button>
                <button
                  type="button"
                  className="export-btn-secondary"
                  onClick={exportJSON}
                  title="Export full JSON"
                >
                  JSON
                </button>
              </div>
            )}
            <button type="button" className="close-btn" onClick={onClose} title="Close">
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Gathering conversation logs and computing metrics…</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <span className="error-icon">⚠️</span>
              <p>{error}</p>
              <button
                type="button"
                className="retry-btn"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  fetch(`/api/sites/${site.id}/analytics`)
                    .then((r) => r.json())
                    .then(setData)
                    .catch((e) => setError(e.message))
                    .finally(() => setLoading(false));
                }}
              >
                Retry
              </button>
            </div>
          ) : data ? (
            <>
              {/* KPI Cards Row */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <span className="kpi-label">💬 Total Queries</span>
                  <div className="kpi-value">{data.metrics.totalQueries}</div>
                  <span className="kpi-hint">User questions asked</span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">👥 Conversations</span>
                  <div className="kpi-value">{data.metrics.totalSessions}</div>
                  <span className="kpi-hint">Unique chat sessions</span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">⭐ Satisfaction Score</span>
                  <div className="kpi-value">
                    {data.metrics.satisfactionRate !== null ? (
                      <span
                        className={
                          data.metrics.satisfactionRate >= 75 ? "text-success" : "text-warning"
                        }
                      >
                        {data.metrics.satisfactionRate}%
                      </span>
                    ) : (
                      <span className="text-muted">N/A</span>
                    )}
                  </div>
                  <span className="kpi-hint">
                    👍 {data.metrics.thumbsUpCount} &nbsp;|&nbsp; 👎 {data.metrics.thumbsDownCount}
                  </span>
                </div>

                <div className="kpi-card">
                  <span className="kpi-label">⚡ Avg Latency</span>
                  <div className="kpi-value">
                    {data.metrics.avgLatencyMs ? (
                      `${data.metrics.avgLatencyMs}ms`
                    ) : (
                      <span className="text-muted">Real-time</span>
                    )}
                  </div>
                  <span className="kpi-hint">Groq inference speed</span>
                </div>
              </div>

              {/* Activity Timeline Bar Chart */}
              {data.activityTimeline && data.activityTimeline.length > 0 && (
                <div className="activity-card">
                  <div className="activity-header">
                    <span className="activity-title">📈 Query Activity (Last 14 Days)</span>
                    <span className="activity-count">
                      {data.activityTimeline.reduce((acc, cur) => acc + cur.count, 0)} total in
                      period
                    </span>
                  </div>
                  <div className="chart-bars">
                    {data.activityTimeline.map((item) => {
                      const heightPercent = Math.max(
                        Math.round((item.count / maxActivityCount) * 100),
                        6
                      );
                      const dayLabel = item.date.slice(5); // MM-DD
                      return (
                        <div
                          key={item.date}
                          className="bar-wrapper"
                          title={`${item.date}: ${item.count} queries`}
                        >
                          <div className="bar-column">
                            <span className="bar-count-popup">{item.count}</span>
                            <div
                              className="bar-fill"
                              style={{
                                height: `${heightPercent}%`,
                                background:
                                  item.count > 0 ? "var(--accent)" : "rgba(255,255,255,0.06)",
                              }}
                            />
                          </div>
                          <span className="bar-date">{dayLabel}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Navigation Tabs */}
              <div className="tabs-nav">
                <button
                  type="button"
                  className={`tab-btn ${activeTab === "logs" ? "active" : ""}`}
                  onClick={() => setActiveTab("logs")}
                >
                  📜 Query Transcripts ({data.transcripts.length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === "gaps" ? "active" : ""}`}
                  onClick={() => setActiveTab("gaps")}
                >
                  ⚠️ Content Gaps ({data.contentGaps.length})
                </button>
                <button
                  type="button"
                  className={`tab-btn ${activeTab === "sources" ? "active" : ""}`}
                  onClick={() => setActiveTab("sources")}
                >
                  🔗 Top Cited Pages ({data.topCitedSources.length})
                </button>
              </div>

              {/* Tab 1: Transcripts & Query Logs */}
              {activeTab === "logs" && (
                <div className="tab-pane">
                  <div className="search-bar-row">
                    <input
                      type="text"
                      className="search-input"
                      placeholder="🔍 Search questions, answers, or keywords across conversations…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="clear-search"
                        onClick={() => setSearchQuery("")}
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  {filteredTranscripts.length === 0 ? (
                    <div className="empty-logs">
                      <p>No chat conversations matched your criteria.</p>
                    </div>
                  ) : (
                    <div className="transcripts-list">
                      {filteredTranscripts.map((t) => {
                        const isExpanded = Boolean(expandedSessions[t.id]);
                        const firstUserMsg = t.messages.find((m) => m.role === "user");
                        const dateStr = new Date(t.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div key={t.id} className="transcript-session-card">
                            <div className="session-header" onClick={() => toggleSession(t.id)}>
                              <div className="session-summary">
                                <span className="session-chevron">{isExpanded ? "▼" : "▶"}</span>
                                <span className="session-preview">
                                  {firstUserMsg
                                    ? firstUserMsg.content
                                    : `Session #${t.id.slice(-6)}`}
                                </span>
                              </div>

                              <div className="session-meta">
                                <span className="meta-badge msg-count">
                                  {t.messageCount} msg{t.messageCount !== 1 ? "s" : ""}
                                </span>
                                <span className="meta-date">{dateStr}</span>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="session-body">
                                {t.messages.map((m) => (
                                  <div key={m.id} className={`transcript-msg msg-${m.role}`}>
                                    <div className="msg-header">
                                      <span className="msg-role-tag">
                                        {m.role === "user" ? "👤 User" : "🤖 Assistant"}
                                      </span>
                                      <span className="msg-time">
                                        {new Date(m.createdAt).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          second: "2-digit",
                                        })}
                                      </span>
                                      {m.latencyMs && (
                                        <span className="msg-latency">⚡ {m.latencyMs}ms</span>
                                      )}
                                      {m.rating && (
                                        <span
                                          className={`rating-badge ${
                                            m.rating === "up" ? "rating-up" : "rating-down"
                                          }`}
                                        >
                                          {m.rating === "up" ? "👍 Upvoted" : "👎 Downvoted"}
                                        </span>
                                      )}
                                    </div>

                                    <div className="msg-content">
                                      {m.role === "assistant" ? (
                                        <div className="markdown-render">
                                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {m.content}
                                          </ReactMarkdown>
                                        </div>
                                      ) : (
                                        <p className="user-text">{m.content}</p>
                                      )}
                                    </div>

                                    {/* Citations used */}
                                    {m.citations && m.citations.length > 0 && (
                                      <div className="msg-citations-strip">
                                        <span className="cite-label">📚 Referenced Sources:</span>
                                        <div className="cite-tags">
                                          {m.citations.map((c, i) => {
                                            const label =
                                              c.heading || c.pageUrl || c.url || `Source ${i + 1}`;
                                            return (
                                              <span
                                                key={i}
                                                className="cite-tag"
                                                title={c.snippet || ""}
                                              >
                                                {label}
                                              </span>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}

                                    {/* User feedback note */}
                                    {m.feedback && (
                                      <div className="feedback-note">
                                        💬 <em>User note: "{m.feedback}"</em>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Content Gaps */}
              {activeTab === "gaps" && (
                <div className="tab-pane">
                  <div className="gaps-explainer">
                    <span className="explainer-icon">💡</span>
                    <div>
                      <strong>What are Content Gaps?</strong>
                      <p>
                        These are questions asked by users where your bot couldn't find the answers
                        in the crawled documentation. Add pages or documents answering these queries
                        to boost your bot's coverage!
                      </p>
                    </div>
                  </div>

                  {data.contentGaps.length === 0 ? (
                    <div className="empty-gaps">
                      <span className="check-icon">✨</span>
                      <h3>Zero Content Gaps Detected</h3>
                      <p>
                        Your documentation successfully provided answers for all recent user
                        inquiries!
                      </p>
                    </div>
                  ) : (
                    <div className="gaps-list">
                      {data.contentGaps.map((gap, idx) => (
                        <div key={idx} className="gap-card">
                          <div className="gap-header">
                            <span className="gap-badge">Missing Documentation</span>
                            <span className="gap-date">
                              {new Date(gap.createdAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <h4 className="gap-question">"{gap.question}"</h4>
                          <div className="gap-bot-reply">
                            <span className="bot-reply-label">Bot Response:</span>
                            <p>{gap.answerSnippet}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Top Cited Sources */}
              {activeTab === "sources" && (
                <div className="tab-pane">
                  <div className="sources-explainer">
                    <p>
                      The most frequently referenced documentation URLs retrieved and cited across
                      user conversations.
                    </p>
                  </div>

                  {data.topCitedSources.length === 0 ? (
                    <div className="empty-sources">
                      <p>No citation references recorded yet.</p>
                    </div>
                  ) : (
                    <div className="sources-list">
                      {data.topCitedSources.map((source, index) => {
                        return (
                          <div key={source.url} className="source-row">
                            <div className="source-rank">#{index + 1}</div>
                            <div className="source-info">
                              <a
                                href={source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="source-url"
                              >
                                {source.heading ? `${source.heading} — ` : ""}
                                {source.url}
                              </a>
                            </div>
                            <div className="source-count-badge">
                              {source.count} reference{source.count !== 1 ? "s" : ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .modal-card {
          width: 100%;
          max-width: 960px;
          max-height: 88vh;
          background: var(--bg-elevated);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.6),
            0 0 40px rgba(37, 99, 235, 0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes scaleUp {
          from {
            transform: scale(0.96);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .bot-avatar {
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.3rem;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
        }

        .title-row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
        }

        .live-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          font-weight: 600;
          color: #34d399;
          background: rgba(52, 211, 153, 0.12);
          border: 1px solid rgba(52, 211, 153, 0.25);
          padding: 0.15rem 0.55rem;
          border-radius: 20px;
        }

        .live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
        }

        .modal-subtitle {
          font-size: 0.82rem;
          color: #94a3b8;
          margin: 0.25rem 0 0 0;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .export-dropdown {
          display: flex;
          align-items: center;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          overflow: hidden;
        }

        .export-btn {
          padding: 0.45rem 0.75rem;
          background: transparent;
          border: none;
          color: #f1f5f9;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .export-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        .export-btn-secondary {
          padding: 0.45rem 0.6rem;
          background: transparent;
          border: none;
          border-left: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .export-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f1f5f9;
        }

        .close-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.04);
          color: #94a3b8;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Loading & Error */
        .loading-state,
        .error-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          gap: 1rem;
          color: #94a3b8;
          font-size: 0.9rem;
        }
        .spinner {
          width: 36px;
          height: 36px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .retry-btn {
          padding: 0.5rem 1.25rem;
          background: var(--accent);
          color: #fff;
          font-weight: 600;
          border: none;
          border-radius: var(--radius);
          cursor: pointer;
        }

        /* KPI Cards */
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1rem;
        }

        .kpi-card {
          padding: 1.1rem 1.2rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          box-shadow: var(--card-highlight);
        }

        .kpi-label {
          font-size: 0.76rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .kpi-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: #f8fafc;
          line-height: 1.2;
        }

        .kpi-hint {
          font-size: 0.72rem;
          color: #64748b;
        }

        .text-success {
          color: #34d399;
        }
        .text-warning {
          color: #fbbf24;
        }
        .text-muted {
          color: #64748b;
        }

        /* Activity Card */
        .activity-card {
          padding: 1rem 1.25rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .activity-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .activity-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: #cbd5e1;
        }

        .activity-count {
          font-size: 0.74rem;
          color: #94a3b8;
        }

        .chart-bars {
          display: flex;
          align-items: flex-end;
          gap: 8px;
          height: 80px;
          padding-top: 15px;
        }

        .bar-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 100%;
          position: relative;
        }

        .bar-column {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: flex-end;
          position: relative;
        }

        .bar-fill {
          width: 100%;
          border-radius: 4px 4px 0 0;
          transition: height 0.3s ease;
        }

        .bar-count-popup {
          position: absolute;
          top: -16px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--accent-dim);
          opacity: 0;
          transition: opacity 0.15s ease;
          pointer-events: none;
        }

        .bar-wrapper:hover .bar-count-popup {
          opacity: 1;
        }

        .bar-date {
          font-size: 0.62rem;
          color: #64748b;
          margin-top: 4px;
        }

        /* Tabs Nav */
        .tabs-nav {
          display: flex;
          gap: 0.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 0.5rem;
        }

        .tab-btn {
          padding: 0.55rem 1rem;
          background: transparent;
          border: none;
          color: #94a3b8;
          font-size: 0.84rem;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          color: #f1f5f9;
          background: rgba(255, 255, 255, 0.04);
        }

        .tab-btn.active {
          color: var(--accent-dim);
          background: var(--accent-soft);
        }

        .tab-pane {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        /* Search */
        .search-bar-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .search-input {
          flex: 1;
          padding: 0.65rem 0.95rem;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #f8fafc;
          font-size: 0.84rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .search-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-soft);
        }

        .clear-search {
          padding: 0.65rem 0.9rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          color: #94a3b8;
          font-size: 0.78rem;
          cursor: pointer;
        }

        /* Transcripts */
        .transcripts-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .transcript-session-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          overflow: hidden;
        }

        .session-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1.1rem;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.01);
          transition: background 0.15s ease;
        }
        .session-header:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .session-summary {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .session-chevron {
          font-size: 0.7rem;
          color: #64748b;
        }

        .session-preview {
          font-size: 0.86rem;
          font-weight: 600;
          color: #f1f5f9;
        }

        .session-meta {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-shrink: 0;
        }

        .meta-badge {
          font-size: 0.7rem;
          font-weight: 600;
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.05);
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
        }

        .meta-date {
          font-size: 0.74rem;
          color: #64748b;
        }

        .session-body {
          padding: 1rem 1.1rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background: rgba(0, 0, 0, 0.15);
        }

        .transcript-msg {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          padding: 0.75rem 0.95rem;
          border-radius: 10px;
        }

        .msg-user {
          background: var(--accent-soft);
          border: 1px solid rgba(37, 99, 235, 0.2);
        }

        .msg-assistant {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .msg-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.72rem;
        }

        .msg-role-tag {
          font-weight: 700;
          color: #cbd5e1;
        }

        .msg-time {
          color: #64748b;
        }

        .msg-latency {
          font-weight: 600;
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.1);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
        }

        .rating-badge {
          font-weight: 700;
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
        }
        .rating-up {
          color: #34d399;
          background: rgba(52, 211, 153, 0.12);
        }
        .rating-down {
          color: #f87171;
          background: rgba(248, 113, 113, 0.12);
        }

        .msg-content {
          font-size: 0.86rem;
          line-height: 1.55;
          color: #e2e8f0;
        }

        .user-text {
          margin: 0;
          font-weight: 500;
        }

        .markdown-render :global(p) {
          margin: 0 0 0.5rem 0;
        }
        .markdown-render :global(p:last-child) {
          margin-bottom: 0;
        }

        .msg-citations-strip {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.4rem;
          padding-top: 0.4rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.72rem;
        }

        .cite-label {
          color: #94a3b8;
          font-weight: 600;
        }

        .cite-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .cite-tag {
          background: rgba(255, 255, 255, 0.06);
          color: #cbd5e1;
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          max-width: 260px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .feedback-note {
          font-size: 0.74rem;
          color: #fbbf24;
          margin-top: 0.25rem;
        }

        /* Gaps */
        .gaps-explainer,
        .sources-explainer {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.9rem 1.1rem;
          background: var(--accent-soft);
          border: 1px solid rgba(37, 99, 235, 0.15);
          border-radius: var(--radius-lg);
          font-size: 0.82rem;
          color: #94a3b8;
          line-height: 1.45;
        }
        .gaps-explainer strong {
          color: #f8fafc;
          display: block;
          margin-bottom: 0.2rem;
        }
        .explainer-icon {
          font-size: 1.2rem;
        }

        .gaps-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .gap-card {
          padding: 1rem 1.2rem;
          background: rgba(239, 68, 68, 0.04);
          border: 1px solid rgba(239, 68, 68, 0.18);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .gap-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .gap-badge {
          font-size: 0.68rem;
          font-weight: 700;
          color: #f87171;
          background: rgba(239, 68, 68, 0.12);
          padding: 0.15rem 0.5rem;
          border-radius: 6px;
        }

        .gap-date {
          font-size: 0.72rem;
          color: #64748b;
        }

        .gap-question {
          font-size: 0.95rem;
          font-weight: 700;
          color: #f8fafc;
          margin: 0;
        }

        .gap-bot-reply {
          font-size: 0.82rem;
          color: #94a3b8;
          background: rgba(0, 0, 0, 0.2);
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
        }

        .bot-reply-label {
          font-weight: 600;
          color: #cbd5e1;
          display: block;
          margin-bottom: 0.2rem;
        }

        .empty-gaps,
        .empty-sources,
        .empty-logs {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 3rem 1rem;
          text-align: center;
          color: #94a3b8;
          gap: 0.5rem;
        }

        .check-icon {
          font-size: 2rem;
        }

        /* Sources */
        .sources-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .source-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1.1rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          gap: 1rem;
          transition: background 0.15s ease;
        }
        .source-row:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .source-rank {
          font-size: 0.84rem;
          font-weight: 800;
          color: var(--accent-dim);
          width: 28px;
        }

        .source-info {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .source-url {
          font-size: 0.85rem;
          color: #f1f5f9;
          text-decoration: none;
        }
        .source-url:hover {
          color: var(--accent-dim);
          text-decoration: underline;
        }

        .source-count-badge {
          font-size: 0.74rem;
          font-weight: 700;
          color: var(--accent-dim);
          background: var(--accent-soft);
          padding: 0.25rem 0.65rem;
          border-radius: 20px;
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .kpi-grid {
            grid-template-columns: repeat(2, 1fr);
          }
          .modal-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 1rem;
          }
          .header-actions {
            width: 100%;
            justify-content: space-between;
          }
        }
      `}</style>
    </div>
  );
}
