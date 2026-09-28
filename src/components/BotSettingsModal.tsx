"use client";

import { useState, useEffect, FormEvent } from "react";
import type { SiteSummary } from "./BotCard";

type Props = {
  site: SiteSummary | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSite: SiteSummary) => void;
};

export function BotSettingsModal({ site, isOpen, onClose, onSave }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [tone, setTone] = useState<"concise" | "balanced" | "detailed">("balanced");
  const [starterQuestions, setStarterQuestions] = useState<string[]>([]);
  const [newQuestion, setNewQuestion] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [enableWebSearch, setEnableWebSearch] = useState(true);

  // Auto-Sync state
  const [autoSync, setAutoSync] = useState(false);
  const [syncFrequency, setSyncFrequency] = useState<"daily" | "weekly">("daily");
  const [sourceUrl, setSourceUrl] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ message: string; success: boolean } | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (site) {
      setName(site.name || "");
      setDescription(site.description || "");
      setSystemPrompt(site.systemPrompt || "");
      setTone(site.tone || "balanced");
      setStarterQuestions(Array.isArray(site.starterQuestions) ? site.starterQuestions : []);
      setIsPublic(site.isPublic !== false);
      setEnableWebSearch(site.enableWebSearch !== false);
      setAutoSync(Boolean(site.autoSync));
      setSyncFrequency((site.syncFrequency as any) || "daily");
      setSourceUrl(site.sourceUrl || site.pages?.[0]?.url || "");
      setSyncResult(null);
      setError(null);
      setNewQuestion("");
    }
  }, [site, isOpen]);

  if (!isOpen || !site) return null;

  function handleAddQuestion() {
    const q = newQuestion.trim();
    if (!q) return;
    if (starterQuestions.includes(q)) {
      setError("This starter question is already in the list.");
      return;
    }
    if (starterQuestions.length >= 6) {
      setError("Maximum 6 starter questions allowed for optimal UI.");
      return;
    }
    setStarterQuestions((prev) => [...prev, q]);
    setNewQuestion("");
    setError(null);
  }

  function handleRemoveQuestion(index: number) {
    setStarterQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSyncNow() {
    if (!site) return;
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch(`/api/sites/${site.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxPages: 5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      setSyncResult({
        success: true,
        message:
          data.message ||
          `Synced! ${data.addedPages} new pages indexed, ${data.addedChunks} chunks added.`,
      });

      if (data.site) {
        onSave({
          ...site,
          lastSyncedAt: data.site.lastSyncedAt || new Date().toISOString(),
          pages: data.site.pages
            ? data.site.pages.map((p: any) => ({
                id: p.id,
                url: p.url,
                title: p.title,
                scrapedAt: p.scrapedAt,
                chunkCount: 0,
              }))
            : site.pages,
        });
      }
    } catch (err: any) {
      setSyncResult({
        success: false,
        message: err.message || "Failed to trigger sync",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!site) return;
    if (!name.trim()) {
      setError("Bot name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/sites/${site.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          systemPrompt: systemPrompt.trim() || null,
          starterQuestions: starterQuestions.length > 0 ? starterQuestions : null,
          tone,
          isPublic,
          enableWebSearch,
          autoSync,
          syncFrequency,
          sourceUrl: sourceUrl.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update bot");

      onSave({
        ...site,
        name: name.trim(),
        description: description.trim() || null,
        systemPrompt: systemPrompt.trim() || null,
        starterQuestions: starterQuestions.length > 0 ? starterQuestions : null,
        tone,
        isPublic,
        enableWebSearch,
        autoSync,
        syncFrequency,
        sourceUrl: sourceUrl.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || "An error occurred while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div className="header-title-group">
            <span className="header-icon">
              <svg
                width="18"
                height="18"
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
            </span>
            <div>
              <h2 className="modal-title">Bot Customization</h2>
              <p className="modal-subtitle">
                Customize persona, response tone, and suggested prompts
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
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
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="modal-body">
          {/* General info */}
          <div className="form-section">
            <h3 className="section-heading">Basic Information</h3>
            <div className="field-group">
              <label className="field-label">Bot Display Name</label>
              <input
                className="field-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Next.js Assistant, Vijay Biographer"
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label">Description / Subtitle</label>
              <input
                className="field-input"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief summary of what this bot knows"
              />
            </div>
          </div>

          {/* Persona / System Instructions */}
          <div className="form-section">
            <div className="section-header-flex">
              <h3 className="section-heading">AI Persona & Custom Instructions</h3>
              <span className="badge-hint">Pro Feature</span>
            </div>
            <p className="section-hint">
              Give your bot a unique identity, role, or specific answering rules. (e.g.{" "}
              <i>"Speak like a pirate"</i>, <i>"Focus strictly on pricing"</i>, or{" "}
              <i>"Always include step-by-step code"</i>)
            </p>
            <textarea
              className="field-textarea"
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g., You are an empathetic customer support agent. Answer warmly, clearly, and always provide links where possible."
            />
          </div>

          {/* Response Tone */}
          <div className="form-section">
            <h3 className="section-heading">Response Tone & Length</h3>
            <div className="tone-grid">
              {[
                {
                  id: "concise",
                  title: "Concise",
                  desc: "Direct, bullet points, 1-2 sentence answers with no fluff",
                },
                {
                  id: "balanced",
                  title: "Balanced",
                  desc: "Standard informative, conversational, and natural style",
                },
                {
                  id: "detailed",
                  title: "Detailed",
                  desc: "Comprehensive deep-dives with thorough step-by-step explanations",
                },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`tone-card ${tone === t.id ? "active" : ""}`}
                  onClick={() => setTone(t.id as any)}
                >
                  <span className="tone-title">{t.title}</span>
                  <span className="tone-desc">{t.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Starter Questions */}
          <div className="form-section">
            <div className="section-header-flex">
              <h3 className="section-heading">Starter Questions (Suggested Prompts)</h3>
              <span className="badge-count">{starterQuestions.length}/6</span>
            </div>
            <p className="section-hint">
              These clickable chips will show up when visitors open your chatbot in the Web App or
              Embed Widget.
            </p>

            <div className="starter-input-row">
              <input
                className="field-input"
                type="text"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddQuestion();
                  }
                }}
                placeholder="e.g., What are the main features?"
                disabled={starterQuestions.length >= 6}
              />
              <button
                type="button"
                className="btn-add-q"
                onClick={handleAddQuestion}
                disabled={!newQuestion.trim() || starterQuestions.length >= 6}
              >
                Add
              </button>
            </div>

            {starterQuestions.length > 0 && (
              <div className="chips-list">
                {starterQuestions.map((q, idx) => (
                  <div key={idx} className="chip-item">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0 }}
                    >
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <span className="chip-text">{q}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => handleRemoveQuestion(idx)}
                      title="Remove question"
                    >
                      <svg
                        width="10"
                        height="10"
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
                ))}
              </div>
            )}
          </div>

          {/* Automated Scheduled Daily Re-Sync */}
          <div className="form-section sync-section">
            <div className="section-header-flex">
              <div>
                <div className="sync-title-row">
                  <h3 className="section-heading">Auto-Sync & Scheduled Re-Scrape</h3>
                  <span className="badge-sync-pill">Automated</span>
                </div>
                <p className="section-hint">
                  Keep daily news, fresh blog posts, or updated pages indexed automatically every
                  day.
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {autoSync && (
              <div className="sync-options-card">
                <div className="field-group">
                  <label className="field-label">Website or Sitemap URL to Monitor</label>
                  <input
                    className="field-input"
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://www.thehindu.com or https://site.com/sitemap.xml"
                  />
                  <span className="field-subtext">
                    The scraper will probe sitemaps and homepage links to ingest newly published
                    articles.
                  </span>
                </div>

                <div className="field-group">
                  <label className="field-label">Sync Schedule</label>
                  <div className="freq-selector">
                    <button
                      type="button"
                      className={`freq-btn ${syncFrequency === "daily" ? "active" : ""}`}
                      onClick={() => setSyncFrequency("daily")}
                    >
                      <span>Daily</span>
                      <small>06:30 AM IST</small>
                    </button>
                    <button
                      type="button"
                      className={`freq-btn ${syncFrequency === "weekly" ? "active" : ""}`}
                      onClick={() => setSyncFrequency("weekly")}
                    >
                      <span>Weekly</span>
                      <small>Every Monday</small>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Manual On-Demand Sync Trigger */}
            <div className="sync-trigger-box">
              <div className="sync-trigger-info">
                <div className="sync-trigger-title">One-Click Refresh</div>
                <div className="sync-trigger-sub">
                  {site.lastSyncedAt
                    ? `Last checked: ${new Date(site.lastSyncedAt).toLocaleString()}`
                    : "No automatic sync run yet"}
                </div>
              </div>
              <button
                type="button"
                className="btn-sync-now"
                onClick={handleSyncNow}
                disabled={syncing}
              >
                {syncing ? (
                  <>
                    <span className="sync-spinner" /> Checking for News…
                  </>
                ) : (
                  <>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ marginRight: 4 }}
                    >
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Sync Latest News Now
                  </>
                )}
              </button>
            </div>

            {syncResult && (
              <div className={`sync-banner ${syncResult.success ? "success" : "error"}`}>
                {syncResult.success ? (
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
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
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
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
                <span>{syncResult.message}</span>
              </div>
            )}
          </div>

          {/* Live Web Search Fallback */}
          <div className="form-section web-search-toggle-section">
            <div className="visibility-info">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <h3 className="section-heading" style={{ margin: 0 }}>
                  Live Web Search Fallback
                </h3>
                <span className="badge-sync-pill">Agentic RAG</span>
              </div>
              <p className="section-hint" style={{ marginTop: "0.25rem" }}>
                {enableWebSearch
                  ? "Active: When local site docs lack relevant answers, the bot automatically searches the live web."
                  : "Inactive: Strict local documents only. Will never query the external web."}
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={enableWebSearch}
                onChange={(e) => setEnableWebSearch(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {/* Visibility / Multi-Tenancy */}
          <div className="form-section visibility-section">
            <div className="visibility-info">
              <h3 className="section-heading">Bot Visibility</h3>
              <p className="section-hint">
                {isPublic
                  ? "Public: Anyone can view, chat, and embed this bot."
                  : "Private: Only you can view and chat with this bot."}
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
              />
              <span className="toggle-slider" />
            </label>
          </div>

          {error && <div className="modal-error-banner">{error}</div>}

          <footer className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving Changes…" : "Save Customization"}
            </button>
          </footer>
        </form>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
            animation: fadeIn 0.15s ease;
          }

          .modal {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
            animation: slideUp 0.15s ease;
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border);
            background: transparent;
          }

          .header-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .header-icon {
            display: flex;
            align-items: center;
            justify-content: center;
            color: var(--text-muted);
          }

          .modal-title {
            margin: 0;
            font-size: 1.05rem;
            font-weight: 600;
            color: var(--text-main);
          }

          .modal-subtitle {
            margin: 2px 0 0;
            font-size: 0.78rem;
            color: var(--text-muted);
          }

          .modal-close {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-muted);
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            border-radius: var(--radius-sm);
            transition: all 0.15s ease;
          }
          .modal-close:hover {
            color: var(--text-main);
            background: var(--bg-hover);
            border-color: var(--border-strong);
          }

          .modal-body {
            padding: 1.25rem 1.5rem;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
          }

          .form-section {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .section-header-flex {
            display: flex;
            align-items: center;
            justify-content: space-between;
          }

          .section-heading {
            margin: 0;
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .section-hint {
            margin: 0;
            font-size: 0.78rem;
            color: var(--text-muted);
            line-height: 1.4;
          }

          .badge-hint {
            font-size: 0.65rem;
            padding: 2px 6px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-muted);
            border-radius: var(--radius-micro);
            font-weight: 500;
            text-transform: uppercase;
          }

          .badge-count {
            font-size: 0.72rem;
            font-family: var(--font-mono, monospace);
            color: var(--text-muted);
          }

          .field-group {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
          }

          .field-label {
            font-size: 0.78rem;
            font-weight: 500;
            color: var(--text-muted);
          }

          .field-input,
          .field-textarea {
            width: 100%;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 0.55rem 0.75rem;
            color: var(--text-main);
            font-size: 0.85rem;
            outline: none;
            transition: all 0.15s ease;
          }
          .field-input:focus,
          .field-textarea:focus {
            border-color: var(--accent);
          }

          /* Tone Cards */
          .tone-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.6rem;
            margin-top: 0.2rem;
          }

          .tone-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 0.6rem;
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
            text-align: left;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .tone-card:hover {
            background: var(--bg-hover);
            border-color: var(--border-strong);
          }
          .tone-card.active {
            background: var(--bg-hover);
            border-color: var(--accent);
          }

          .tone-title {
            font-size: 0.82rem;
            font-weight: 600;
            color: var(--text-main);
          }

          .tone-desc {
            font-size: 0.68rem;
            color: var(--text-muted);
            line-height: 1.3;
          }

          /* Starter Questions Row */
          .starter-input-row {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.2rem;
          }

          .btn-add-q {
            background: var(--bg-card);
            color: var(--text-main);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 0 1rem;
            font-size: 0.82rem;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
          }
          .btn-add-q:hover:not(:disabled) {
            background: var(--bg-hover);
            border-color: var(--border-strong);
          }
          .btn-add-q:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          .chips-list {
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem;
            margin-top: 0.4rem;
          }

          .chip-item {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 0.3rem 0.65rem;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.78rem;
            color: var(--text-main);
            animation: fadeIn 0.15s ease;
          }

          .chip-remove {
            background: transparent;
            border: none;
            color: var(--text-muted);
            cursor: pointer;
            font-size: 0.75rem;
            padding: 0;
            display: flex;
            align-items: center;
          }
          .chip-remove:hover {
            color: var(--danger);
          }

          /* Sync Section */
          .sync-section {
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 1rem;
          }
          .sync-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 2px;
          }
          .badge-sync-pill {
            font-size: 0.65rem;
            padding: 2px 7px;
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--text-muted);
            border-radius: var(--radius-micro);
            font-weight: 500;
            text-transform: uppercase;
          }
          .sync-options-card {
            display: flex;
            flex-direction: column;
            gap: 0.85rem;
            padding: 0.9rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            margin-top: 0.5rem;
          }
          .field-subtext {
            font-size: 0.72rem;
            color: var(--text-muted);
          }
          .freq-selector {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.5rem;
          }
          .freq-btn {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 2px;
            padding: 0.55rem 0.75rem;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            color: var(--text-muted);
            font-size: 0.8rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .freq-btn small {
            font-size: 0.68rem;
            color: var(--text-muted);
            font-weight: normal;
          }
          .freq-btn:hover {
            background: var(--bg-hover);
          }
          .freq-btn.active {
            background: var(--bg-hover);
            border-color: var(--accent);
            color: var(--text-main);
          }
          .freq-btn.active small {
            color: var(--accent);
          }
          .sync-trigger-box {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            padding: 0.75rem 0.9rem;
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            margin-top: 0.4rem;
          }
          .sync-trigger-title {
            font-size: 0.82rem;
            font-weight: 500;
            color: var(--text-main);
          }
          .sync-trigger-sub {
            font-size: 0.72rem;
            color: var(--text-muted);
          }
          .btn-sync-now {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0.45rem 0.85rem;
            background: var(--accent);
            border: none;
            color: #fff;
            border-radius: var(--radius-sm);
            font-size: 0.78rem;
            font-weight: 500;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
          }
          .btn-sync-now:hover:not(:disabled) {
            background: var(--accent-hover);
          }
          .btn-sync-now:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .sync-spinner {
            width: 12px;
            height: 12px;
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-top-color: #fff;
            border-radius: 50%;
            animation: spin 0.7s linear infinite;
            display: inline-block;
          }
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
          .sync-banner {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 0.55rem 0.75rem;
            border-radius: var(--radius-sm);
            font-size: 0.78rem;
            margin-top: 0.3rem;
          }
          .sync-banner.success {
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--success);
          }
          .sync-banner.error {
            background: var(--bg-card);
            border: 1px solid var(--border);
            color: var(--danger);
          }

          /* Visibility Switch */
          .visibility-section {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem;
            background: var(--bg);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
          }

          .toggle-switch {
            position: relative;
            display: inline-block;
            width: 38px;
            height: 20px;
            flex-shrink: 0;
          }
          .toggle-switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }
          .toggle-slider {
            position: absolute;
            cursor: pointer;
            inset: 0;
            background-color: var(--border-strong);
            transition: 0.2s;
            border-radius: 20px;
          }
          .toggle-slider:before {
            position: absolute;
            content: "";
            height: 14px;
            width: 14px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.2s;
            border-radius: 50%;
          }
          input:checked + .toggle-slider {
            background-color: var(--accent);
          }
          input:checked + .toggle-slider:before {
            transform: translateX(18px);
          }

          .modal-error-banner {
            padding: 0.6rem 0.85rem;
            background: var(--bg-card);
            border: 1px solid var(--danger);
            color: var(--danger);
            border-radius: var(--radius-sm);
            font-size: 0.8rem;
          }

          .modal-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 0.75rem;
            padding: 1rem 1.5rem;
            border-top: 1px solid var(--border);
            background: transparent;
          }

          .btn-secondary {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-muted);
            padding: 0.5rem 1rem;
            border-radius: var(--radius-sm);
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .btn-secondary:hover {
            background: var(--bg-hover);
            color: var(--text-main);
            border-color: var(--border-strong);
          }

          .btn-primary {
            background: var(--accent);
            border: none;
            color: #fff;
            padding: 0.5rem 1.25rem;
            border-radius: var(--radius-sm);
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .btn-primary:hover:not(:disabled) {
            background: var(--accent-hover);
          }
          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }
          @keyframes slideUp {
            from {
              transform: translateY(8px);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
