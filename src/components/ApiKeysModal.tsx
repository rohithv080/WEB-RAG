"use client";

import { useEffect, useState, FormEvent } from "react";
import type { SiteSummary } from "./BotCard";

type ApiKeyItem = {
  id: string;
  name: string;
  maskedKey: string;
  siteId: string | null;
  siteName: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  sites: SiteSummary[];
  onToast: (message: string, type: "success" | "error" | "info") => void;
};

export function ApiKeysModal({ isOpen, onClose, sites, onToast }: Props) {
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"keys" | "docs">("keys");

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{ rawKey: string; name: string } | null>(
    null
  );

  // Docs state
  const [docsSiteId, setDocsSiteId] = useState<string>(sites[0]?.id || "");
  const [docsLang, setDocsLang] = useState<"python" | "curl" | "node">("python");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadKeys();
      setNewlyCreatedKey(null);
      setShowCreateForm(false);
      if (sites.length > 0 && !docsSiteId) {
        setDocsSiteId(sites[0].id);
      }
    }
  }, [isOpen, sites]);

  async function loadKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/keys");
      if (!res.ok) throw new Error("Failed to load API keys");
      const data = await res.json();
      if (Array.isArray(data.keys)) {
        setKeys(data.keys);
      }
    } catch (err: any) {
      console.error(err);
      onToast(err.message || "Failed to load keys", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateKey(e: FormEvent) {
    e.preventDefault();
    if (!keyName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: keyName.trim(),
          siteId: selectedSiteId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate key");

      setNewlyCreatedKey({
        rawKey: data.key.rawKey,
        name: data.key.name,
      });

      setKeyName("");
      setSelectedSiteId("");
      setShowCreateForm(false);
      onToast("API key generated successfully!", "success");
      await loadKeys();
    } catch (err: any) {
      onToast(err.message || "Could not generate key", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteKey(id: string, name: string) {
    if (
      !confirm(
        `Are you sure you want to revoke "${name}"? External apps using this key will be disconnected immediately.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke API key");

      setKeys((prev) => prev.filter((k) => k.id !== id));
      onToast(`API key "${name}" revoked`, "info");
    } catch (err: any) {
      onToast(err.message || "Failed to revoke key", "error");
    }
  }

  if (!isOpen) return null;

  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
  const targetBot = sites.find((s) => s.id === docsSiteId) || sites[0];
  const botIdentifier = targetBot?.name
    ? targetBot.name.toLowerCase().replace(/\s+/g, "-")
    : docsSiteId || "your-bot-id";

  const pythonSnippet = `from openai import OpenAI

# Initialize the OpenAI client pointing to your Web-RAG server
client = OpenAI(
    base_url="${origin}/v1",
    api_key="wr_live_YOUR_API_KEY",  # Replace with your generated key
)

# Stream completion from your knowledge bot
stream = client.chat.completions.create(
    model="${targetBot?.id || botIdentifier}",
    messages=[
        {"role": "user", "content": "What are your core features and tariffs?"}
    ],
    stream=True,
)

print(f"Response from ${targetBot?.name || "Bot"}:\\n")
for chunk in stream:
    token = chunk.choices[0].delta.content or ""
    print(token, end="", flush=True)
`;

  const curlSnippet = `curl -X POST "${origin}/v1/chat/completions" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer wr_live_YOUR_API_KEY" \\
  -d '{
    "model": "${targetBot?.id || botIdentifier}",
    "messages": [
      {"role": "user", "content": "What are your core features and tariffs?"}
    ],
    "stream": true
  }'`;

  const nodeSnippet = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${origin}/v1",
  apiKey: "wr_live_YOUR_API_KEY", // Replace with your generated key
});

async function askKnowledgeBot() {
  const stream = await client.chat.completions.create({
    model: "${targetBot?.id || botIdentifier}",
    messages: [
      { role: "user", content: "What are your core features and tariffs?" },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    process.stdout.write(chunk.choices[0]?.delta?.content || "");
  }
}

askKnowledgeBot().catch(console.error);`;

  function getCurrentSnippet() {
    if (docsLang === "python") return pythonSnippet;
    if (docsLang === "curl") return curlSnippet;
    return nodeSnippet;
  }

  function handleCopySnippet() {
    navigator.clipboard.writeText(getCurrentSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
    onToast("Code snippet copied to clipboard!", "success");
  }

  function handleCopySecret(key: string) {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    onToast("API Key copied to clipboard!", "success");
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal glass keys-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="modal-header">
          <div className="title-with-badge">
            <h2 className="modal-title">Developer API Keys</h2>
            <span className="endpoint-badge">/v1/chat/completions</span>
          </div>
          <button className="modal-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Tab switchers */}
        <div className="keys-tab-nav">
          <button
            type="button"
            className={`tab-btn ${activeTab === "keys" ? "active" : ""}`}
            onClick={() => setActiveTab("keys")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
            </svg>
            <span>API Keys ({keys.length})</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "docs" ? "active" : ""}`}
            onClick={() => setActiveTab("docs")}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
            <span>OpenAI SDK Integration</span>
          </button>
        </div>

        {/* Tab 1: API Keys List & Management */}
        {activeTab === "keys" && (
          <div className="keys-tab-content">
            {/* Newly Created Key Alert Banner */}
            {newlyCreatedKey && (
              <div className="new-key-alert">
                <div className="alert-top">
                  <span className="alert-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </span>
                  <div className="alert-text">
                    <strong>Save your API Key for &quot;{newlyCreatedKey.name}&quot;</strong>
                    <p>
                      Copy this key now. For your security, you will not be able to see it again.
                    </p>
                  </div>
                </div>
                <div className="secret-copy-box">
                  <code className="raw-key-text">{newlyCreatedKey.rawKey}</code>
                  <button
                    type="button"
                    className="copy-secret-btn"
                    onClick={() => handleCopySecret(newlyCreatedKey.rawKey)}
                  >
                    {copiedKey ? "✓ Copied" : "Copy Key"}
                  </button>
                </div>
              </div>
            )}

            {/* Top actions */}
            <div className="keys-action-bar">
              <span className="keys-hint">
                Keys authenticate programmatic requests to your bots via OpenAI SDKs, LangChain, or
                cURL.
              </span>
              {!showCreateForm && (
                <button
                  type="button"
                  className="create-key-btn"
                  onClick={() => setShowCreateForm(true)}
                >
                  + Create New Key
                </button>
              )}
            </div>

            {/* Create Form */}
            {showCreateForm && (
              <form onSubmit={handleCreateKey} className="create-key-form">
                <h4 className="form-heading">Create New API Key</h4>
                <div className="form-fields-grid">
                  <div className="form-field">
                    <label className="field-label">Key Name / Description</label>
                    <input
                      type="text"
                      className="field-input"
                      placeholder="e.g. Production Mobile App, LangChain Worker"
                      value={keyName}
                      onChange={(e) => setKeyName(e.target.value)}
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-field">
                    <label className="field-label">Bot Scope (Optional)</label>
                    <select
                      className="field-select"
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                    >
                      <option value="">All Bots (Global Access)</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || s.id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-btns-row">
                  <button
                    type="button"
                    className="cancel-form-btn"
                    onClick={() => setShowCreateForm(false)}
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="submit-key-btn"
                    disabled={creating || !keyName.trim()}
                  >
                    {creating ? "Generating…" : "Generate API Key"}
                  </button>
                </div>
              </form>
            )}

            {/* Keys Table / List */}
            {loading ? (
              <div className="keys-loading">
                <span className="key-spinner" /> Loading API keys…
              </div>
            ) : keys.length === 0 ? (
              <div className="keys-empty">
                <div className="empty-key-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                  </svg>
                </div>
                <h4>No API keys generated yet</h4>
                <p>
                  Generate your first key to connect your knowledge bots to custom applications,
                  scripts, or agent frameworks.
                </p>
                {!showCreateForm && (
                  <button
                    type="button"
                    className="create-first-btn"
                    onClick={() => setShowCreateForm(true)}
                  >
                    Create API Key
                  </button>
                )}
              </div>
            ) : (
              <div className="keys-table-wrap">
                <table className="keys-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Secret Key</th>
                      <th>Scope</th>
                      <th>Created</th>
                      <th>Last Used</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.map((k) => (
                      <tr key={k.id}>
                        <td className="key-name-cell">
                          <strong>{k.name}</strong>
                        </td>
                        <td>
                          <code className="masked-code">{k.maskedKey}</code>
                        </td>
                        <td>
                          <span className="scope-badge">{k.siteName}</span>
                        </td>
                        <td className="key-time">
                          {new Date(k.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>
                        <td className="key-time">
                          {k.lastUsedAt
                            ? new Date(k.lastUsedAt).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "Never"}
                        </td>
                        <td className="key-actions-cell">
                          <button
                            type="button"
                            className="revoke-key-btn"
                            onClick={() => handleDeleteKey(k.id, k.name)}
                            title="Revoke API Key"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: OpenAI Compatible Integration Docs */}
        {activeTab === "docs" && (
          <div className="docs-tab-content">
            <div className="docs-top-bar">
              <div className="docs-target-bot">
                <label className="field-label">Target Bot / Model:</label>
                <select
                  className="docs-bot-select"
                  value={docsSiteId}
                  onChange={(e) => setDocsSiteId(e.target.value)}
                >
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name || s.id} ({s.pages.length} pages)
                    </option>
                  ))}
                </select>
              </div>

              <div className="docs-lang-pills">
                <button
                  type="button"
                  className={`lang-pill ${docsLang === "python" ? "active" : ""}`}
                  onClick={() => setDocsLang("python")}
                >
                  Python (OpenAI SDK)
                </button>
                <button
                  type="button"
                  className={`lang-pill ${docsLang === "curl" ? "active" : ""}`}
                  onClick={() => setDocsLang("curl")}
                >
                  cURL
                </button>
                <button
                  type="button"
                  className={`lang-pill ${docsLang === "node" ? "active" : ""}`}
                  onClick={() => setDocsLang("node")}
                >
                  Node.js / TS
                </button>
              </div>
            </div>

            <div className="snippet-container">
              <div className="snippet-header">
                <span className="snippet-lang-tag">
                  {docsLang === "python"
                    ? "Python 3.8+"
                    : docsLang === "curl"
                      ? "cURL"
                      : "TypeScript / ES6"}
                </span>
                <button type="button" className="copy-snippet-btn" onClick={handleCopySnippet}>
                  {copiedCode ? "✓ Copied" : "Copy Code"}
                </button>
              </div>
              <pre className="snippet-code-box">
                <code>{getCurrentSnippet()}</code>
              </pre>
            </div>

            <div className="docs-callout">
              <span className="callout-icon">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
              </span>
              <div className="callout-text">
                <strong>Standard OpenAI API Compatibility:</strong> Your bots can be plugged into
                any tool that supports custom OpenAI endpoints (Cursor, Continue.dev, LangChain,
                LlamaIndex, OpenWebUI). Point the base URL to <code>{origin}/v1</code> and use your
                bot ID as the model name.
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .keys-modal {
          max-width: 780px;
          width: 95%;
          max-height: 85vh;
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }

        .title-with-badge {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .endpoint-badge {
          font-size: 0.72rem;
          font-family: monospace;
          background: var(--bg-card);
          color: var(--text-muted);
          padding: 2px 8px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border);
        }

        .keys-tab-nav {
          display: flex;
          gap: 4px;
          padding: 0 1.5rem;
          border-bottom: 1px solid var(--border);
          background: var(--bg-surface);
        }

        .tab-btn {
          display: flex;
          align-items: center;
          padding: 10px 16px;
          background: transparent;
          border: none;
          border-bottom: 2px solid transparent;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tab-btn:hover {
          color: var(--text-primary);
        }

        .tab-btn.active {
          color: var(--text-primary);
          border-bottom-color: var(--accent);
        }

        .keys-tab-content,
        .docs-tab-content {
          padding: 1.25rem 1.5rem;
          overflow-y: auto;
          flex: 1;
        }

        /* New Key Alert */
        .new-key-alert {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 12px 14px;
          margin-bottom: 1rem;
        }

        .alert-top {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 8px;
        }

        .alert-icon {
          color: var(--accent);
          display: flex;
          align-items: center;
        }

        .alert-text strong {
          color: var(--text-primary);
          font-size: 0.84rem;
        }

        .alert-text p {
          color: var(--text-muted);
          font-size: 0.76rem;
          margin: 2px 0 0 0;
        }

        .secret-copy-box {
          display: flex;
          align-items: center;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 4px 6px 4px 10px;
        }

        .raw-key-text {
          flex: 1;
          color: var(--text-primary);
          font-family: monospace;
          font-size: 0.82rem;
          overflow-x: auto;
          white-space: nowrap;
        }

        .copy-secret-btn {
          background: var(--accent);
          color: #ffffff;
          border: none;
          font-weight: 500;
          font-size: 0.74rem;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .copy-secret-btn:hover {
          background: var(--accent-hover);
        }

        /* Action bar */
        .keys-action-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          gap: 12px;
        }

        .keys-hint {
          font-size: 0.78rem;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .create-key-btn {
          padding: 7px 14px;
          background: var(--accent);
          color: #ffffff;
          border: none;
          border-radius: var(--radius);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease;
        }

        .create-key-btn:hover {
          background: var(--accent-hover);
        }

        /* Create Form */
        .create-key-form {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1rem;
          margin-bottom: 1.25rem;
        }

        .form-heading {
          margin: 0 0 0.75rem 0;
          font-size: 0.86rem;
          color: var(--text-primary);
        }

        .form-fields-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 10px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .field-label {
          font-size: 0.74rem;
          color: var(--text-secondary);
        }

        .field-input,
        .field-select {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 7px 10px;
          color: var(--text-primary);
          font-size: 0.8rem;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .field-input:focus,
        .field-select:focus {
          border-color: var(--accent);
        }

        .form-btns-row {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .cancel-form-btn {
          padding: 5px 12px;
          background: transparent;
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 0.76rem;
          cursor: pointer;
        }
        .cancel-form-btn:hover {
          color: var(--text-primary);
        }

        .submit-key-btn {
          padding: 5px 14px;
          background: var(--accent);
          border: none;
          border-radius: var(--radius);
          color: #ffffff;
          font-size: 0.76rem;
          font-weight: 500;
          cursor: pointer;
        }
        .submit-key-btn:hover {
          background: var(--accent-hover);
        }

        /* Keys Table */
        .keys-table-wrap {
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
        }

        .keys-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.78rem;
        }

        .keys-table th {
          background: var(--bg-card);
          padding: 8px 12px;
          color: var(--text-muted);
          font-weight: 500;
          border-bottom: 1px solid var(--border);
        }

        .keys-table td {
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          color: var(--text-secondary);
        }

        .key-name-cell strong {
          color: var(--text-primary);
        }

        .masked-code {
          font-family: monospace;
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 2px 6px;
          border-radius: var(--radius-micro);
          color: var(--text-secondary);
        }

        .scope-badge {
          background: var(--bg-card);
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 2px 6px;
          border-radius: var(--radius-micro);
          font-size: 0.72rem;
        }

        .key-time {
          color: var(--text-muted);
          font-size: 0.74rem;
          font-family: monospace;
        }

        .key-actions-cell {
          text-align: right;
        }

        .revoke-key-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 0.85rem;
          padding: 4px;
          border-radius: var(--radius-micro);
          transition: all 0.15s ease;
        }

        .revoke-key-btn:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }

        .keys-loading,
        .keys-empty {
          text-align: center;
          padding: 2.5rem 1rem;
          color: var(--text-muted);
        }

        .empty-key-icon {
          color: var(--text-muted);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .keys-empty h4 {
          margin: 0 0 4px 0;
          color: var(--text-primary);
        }

        .keys-empty p {
          margin: 0 0 1rem 0;
          font-size: 0.78rem;
          color: var(--text-muted);
        }

        .create-first-btn {
          padding: 7px 16px;
          background: var(--accent);
          border: none;
          border-radius: var(--radius);
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
        }

        /* Docs Tab */
        .docs-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 1rem;
        }

        .docs-target-bot {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .docs-bot-select {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 6px 10px;
          color: var(--text-primary);
          font-size: 0.78rem;
          outline: none;
        }

        .docs-lang-pills {
          display: flex;
          gap: 6px;
        }

        .lang-pill {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-muted);
          font-size: 0.76rem;
          padding: 5px 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lang-pill:hover {
          color: var(--text-primary);
          background: var(--bg-hover);
        }

        .lang-pill.active {
          color: #ffffff;
          background: var(--accent);
          border-color: var(--accent);
        }

        .snippet-container {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          overflow: hidden;
          margin-bottom: 1rem;
        }

        .snippet-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: var(--bg-surface);
          border-bottom: 1px solid var(--border);
        }

        .snippet-lang-tag {
          font-size: 0.7rem;
          color: var(--text-muted);
          font-family: monospace;
        }

        .copy-snippet-btn {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-micro);
          color: var(--text-primary);
          font-size: 0.7rem;
          padding: 3px 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .copy-snippet-btn:hover {
          background: var(--bg-hover);
        }

        .snippet-code-box {
          margin: 0;
          padding: 12px;
          overflow-x: auto;
          font-family: monospace;
          font-size: 0.78rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .docs-callout {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 10px 14px;
        }

        .callout-icon {
          color: var(--text-muted);
          display: flex;
          align-items: center;
        }

        .callout-text {
          font-size: 0.76rem;
          color: var(--text-secondary);
          line-height: 1.45;
        }

        .callout-text code {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          padding: 1px 4px;
          border-radius: var(--radius-micro);
          color: var(--text-primary);
          font-family: monospace;
        }
      `}</style>
    </div>
  );
}
