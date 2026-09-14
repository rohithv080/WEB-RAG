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

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (site) {
      setName(site.name || "");
      setDescription(site.description || "");
      setSystemPrompt(site.systemPrompt || "");
      setTone(site.tone || "balanced");
      setStarterQuestions(
        Array.isArray(site.starterQuestions) ? site.starterQuestions : []
      );
      setIsPublic(site.isPublic !== false);
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
            <span className="header-icon">⚙️</span>
            <div>
              <h2 className="modal-title">Bot Customization</h2>
              <p className="modal-subtitle">Customize persona, response tone, and suggested prompts</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
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
              Give your bot a unique identity, role, or specific answering rules. (e.g. <i>"Speak like a pirate"</i>, <i>"Focus strictly on pricing"</i>, or <i>"Always include step-by-step code"</i>)
            </p>
            <textarea
              className="field-textarea"
              rows={3}
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="e.g., You are an empathetic customer support agent. Answer warmly, use friendly emojis, and always provide links where possible."
            />
          </div>

          {/* Response Tone */}
          <div className="form-section">
            <h3 className="section-heading">Response Tone & Length</h3>
            <div className="tone-grid">
              {[
                {
                  id: "concise",
                  title: "⚡ Concise",
                  desc: "Direct, bullet points, 1-2 sentence answers with no fluff",
                },
                {
                  id: "balanced",
                  title: "⚖️ Balanced",
                  desc: "Standard informative, conversational, and natural style",
                },
                {
                  id: "detailed",
                  title: "📚 Detailed",
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
              These clickable chips will show up when visitors open your chatbot in the Web App or Embed Widget.
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
                + Add
              </button>
            </div>

            {starterQuestions.length > 0 && (
              <div className="chips-list">
                {starterQuestions.map((q, idx) => (
                  <div key={idx} className="chip-item">
                    <span className="chip-text">💬 {q}</span>
                    <button
                      type="button"
                      className="chip-remove"
                      onClick={() => handleRemoveQuestion(idx)}
                      title="Remove question"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
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
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving}
            >
              {saving ? "Saving Changes…" : "Save Customization"}
            </button>
          </footer>
        </form>

        <style jsx>{`
          .modal-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            padding: 1rem;
            animation: fadeIn 0.2s ease;
          }

          .modal {
            background: #161b22;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 16px;
            width: 100%;
            max-width: 600px;
            max-height: 90vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
            animation: slideUp 0.25s ease;
          }

          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
          }

          .header-title-group {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .header-icon {
            font-size: 1.5rem;
          }

          .modal-title {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 700;
            color: #fff;
          }

          .modal-subtitle {
            margin: 2px 0 0;
            font-size: 0.78rem;
            color: #8b949e;
          }

          .modal-close {
            background: transparent;
            border: none;
            color: #8b949e;
            font-size: 1.1rem;
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            transition: all 0.15s ease;
          }
          .modal-close:hover {
            color: #fff;
            background: rgba(255, 255, 255, 0.1);
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
            font-size: 0.88rem;
            font-weight: 600;
            color: #c9d1d9;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }

          .section-hint {
            margin: 0;
            font-size: 0.78rem;
            color: #8b949e;
            line-height: 1.4;
          }

          .badge-hint {
            font-size: 0.68rem;
            padding: 2px 6px;
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            border-radius: 4px;
            font-weight: 600;
          }

          .badge-count {
            font-size: 0.72rem;
            font-family: monospace;
            color: #8b949e;
          }

          .field-group {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
          }

          .field-label {
            font-size: 0.8rem;
            font-weight: 500;
            color: #8b949e;
          }

          .field-input,
          .field-textarea {
            width: 100%;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 0.6rem 0.85rem;
            color: #fff;
            font-size: 0.88rem;
            outline: none;
            transition: all 0.15s ease;
          }
          .field-input:focus,
          .field-textarea:focus {
            border-color: #38bdf8;
            box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
            background: rgba(255, 255, 255, 0.08);
          }

          /* Tone Cards */
          .tone-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.6rem;
            margin-top: 0.2rem;
          }

          .tone-card {
            background: rgba(255, 255, 255, 0.04);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 10px;
            padding: 0.6rem;
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
            text-align: left;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .tone-card:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 255, 0.2);
          }
          .tone-card.active {
            background: rgba(56, 189, 248, 0.15);
            border-color: #38bdf8;
            box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
          }

          .tone-title {
            font-size: 0.82rem;
            font-weight: 600;
            color: #fff;
          }

          .tone-desc {
            font-size: 0.68rem;
            color: #8b949e;
            line-height: 1.3;
          }

          /* Starter Questions Row */
          .starter-input-row {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.2rem;
          }

          .btn-add-q {
            background: rgba(56, 189, 248, 0.15);
            color: #38bdf8;
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 8px;
            padding: 0 1rem;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            white-space: nowrap;
            transition: all 0.15s ease;
          }
          .btn-add-q:hover:not(:disabled) {
            background: rgba(56, 189, 248, 0.25);
            color: #fff;
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
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 20px;
            padding: 0.3rem 0.65rem;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            font-size: 0.78rem;
            color: #e6edf3;
            animation: fadeIn 0.15s ease;
          }

          .chip-remove {
            background: transparent;
            border: none;
            color: #8b949e;
            cursor: pointer;
            font-size: 0.75rem;
            padding: 0;
            display: flex;
            align-items: center;
          }
          .chip-remove:hover {
            color: #f85149;
          }

          /* Visibility Switch */
          .visibility-section {
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            padding: 0.75rem;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 10px;
          }

          .toggle-switch {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
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
            background-color: rgba(255, 255, 255, 0.2);
            transition: 0.3s;
            border-radius: 24px;
          }
          .toggle-slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: 0.3s;
            border-radius: 50%;
          }
          input:checked + .toggle-slider {
            background-color: #38bdf8;
          }
          input:checked + .toggle-slider:before {
            transform: translateX(20px);
          }

          .modal-error-banner {
            padding: 0.6rem 0.85rem;
            background: rgba(248, 81, 73, 0.15);
            border: 1px solid rgba(248, 81, 73, 0.3);
            color: #ff7b72;
            border-radius: 8px;
            font-size: 0.8rem;
          }

          .modal-footer {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 0.75rem;
            padding: 1rem 1.5rem;
            border-top: 1px solid rgba(255, 255, 255, 0.08);
            background: rgba(255, 255, 255, 0.02);
          }

          .btn-secondary {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #c9d1d9;
            padding: 0.5rem 1rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
          }

          .btn-primary {
            background: #38bdf8;
            border: none;
            color: #0d1117;
            padding: 0.5rem 1.25rem;
            border-radius: 8px;
            font-size: 0.85rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.15s ease;
          }
          .btn-primary:hover:not(:disabled) {
            opacity: 0.9;
            transform: translateY(-1px);
          }
          .btn-primary:disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }

          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(12px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>
    </div>
  );
}
