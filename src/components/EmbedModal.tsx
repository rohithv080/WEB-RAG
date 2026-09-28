"use client";

import { useState, useEffect } from "react";
import type { SiteSummary } from "./BotCard";

type Props = {
  site: SiteSummary | null;
  isOpen: boolean;
  onClose: () => void;
};

const COLOR_PALETTE = [
  "#3d9cf0", // Blue
  "#a78bfa", // Purple
  "#34d399", // Green
  "#fb923c", // Orange
  "#f472b6", // Pink
  "#22d3ee", // Cyan
  "#facc15", // Amber
  "#6366f1", // Indigo
];

export function EmbedModal({ site, isOpen, onClose }: Props) {
  const [color, setColor] = useState("#3d9cf0");
  const [title, setTitle] = useState("");
  const [greeting, setGreeting] = useState("");
  const [position, setPosition] = useState<"bottom-right" | "bottom-left">("bottom-right");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"script" | "iframe">("script");
  const [origin, setOrigin] = useState("https://rohith-rag.vercel.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (site) {
      setTitle(site.name);
      setGreeting(`Hello! Ask me anything about ${site.name}.`);
    }
  }, [site]);

  if (!isOpen || !site) return null;

  const scriptCode = `<!-- Web RAG Chatbot Widget -->
<script
  src="${origin}/widget.js"
  data-bot-id="${site.id}"
  data-color="${color}"
  data-title="${title || site.name}"
  data-greeting="${greeting}"
  data-position="${position}"
  defer>
</script>`;

  const iframeCode = `<iframe
  src="${origin}/embed/${site.id}?color=${encodeURIComponent(color)}&title=${encodeURIComponent(title || site.name)}"
  width="100%"
  height="600"
  style="border: none; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.25);"
  allow="clipboard-write">
</iframe>`;

  const codeToCopy = activeTab === "script" ? scriptCode : iframeCode;

  function handleCopy() {
    navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="modal-card glass">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <span className="badge-embed">Widget Integration</span>
            <h2 className="modal-title">Embed &quot;{site.name}&quot; on Your Website</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
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
        </div>

        {/* Body Content */}
        <div className="modal-body">
          {/* Left Column: Configuration Controls */}
          <div className="config-column">
            <div className="form-group">
              <label className="form-label">Brand Color</label>
              <div className="color-swatches">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${color === c ? "active" : ""}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="embed-title">
                Chatbot Title
              </label>
              <input
                id="embed-title"
                type="text"
                className="text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Wiki Assistant"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="embed-greeting">
                Greeting Message
              </label>
              <input
                id="embed-greeting"
                type="text"
                className="text-input"
                value={greeting}
                onChange={(e) => setGreeting(e.target.value)}
                placeholder="e.g. Hi! How can I help you today?"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Launcher Position</label>
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${position === "bottom-right" ? "active" : ""}`}
                  onClick={() => setPosition("bottom-right")}
                >
                  Bottom Right
                </button>
                <button
                  type="button"
                  className={`toggle-btn ${position === "bottom-left" ? "active" : ""}`}
                  onClick={() => setPosition("bottom-left")}
                >
                  Bottom Left
                </button>
              </div>
            </div>

            <div className="quick-links">
              <a
                href={`${origin}/embed/${site.id}?color=${encodeURIComponent(color)}&title=${encodeURIComponent(title || site.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="test-link"
              >
                <span>Open Full Screen Embed Preview</span>
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
                  <line x1="7" y1="17" x2="17" y2="7" />
                  <polyline points="7 7 17 7 17 17" />
                </svg>
              </a>
            </div>
          </div>

          {/* Right Column: Code Generator & Preview */}
          <div className="code-column">
            <div className="tab-bar">
              <button
                type="button"
                className={`tab-btn ${activeTab === "script" ? "active" : ""}`}
                onClick={() => setActiveTab("script")}
              >
                Floating Widget (&lt;script&gt;)
              </button>
              <button
                type="button"
                className={`tab-btn ${activeTab === "iframe" ? "active" : ""}`}
                onClick={() => setActiveTab("iframe")}
              >
                Inline &lt;iframe&gt;
              </button>
            </div>

            <div className="code-box-wrapper">
              <pre className="code-box">
                <code>{codeToCopy}</code>
              </pre>
              <button
                type="button"
                className={`copy-code-btn ${copied ? "copied" : ""}`}
                onClick={handleCopy}
              >
                {copied ? (
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
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Copied</span>
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
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Visual Micro Preview */}
            <div className="preview-card">
              <div className="preview-label">Live Appearance:</div>
              <div className="preview-mockup">
                <div className="preview-window">
                  <div className="preview-window-header" style={{ background: color }}>
                    <div className="preview-avatar">{title.slice(0, 1).toUpperCase() || "A"}</div>
                    <div className="preview-title-text">{title || site.name}</div>
                  </div>
                  <div className="preview-window-body">
                    <div className="preview-bubble bot">{greeting}</div>
                    <div className="preview-bubble user">Hello assistant</div>
                  </div>
                </div>
                <div className="preview-launcher" style={{ background: color }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          z-index: 99999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: fadeIn 0.15s ease-out;
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
          max-width: 860px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.25rem 1.5rem 1rem;
          border-bottom: 1px solid var(--border);
        }

        .badge-embed {
          display: inline-block;
          font-size: 0.68rem;
          font-weight: 600;
          color: var(--text-muted);
          background: var(--bg-card);
          border: 1px solid var(--border);
          padding: 2px 8px;
          border-radius: var(--radius-micro);
          margin-bottom: 0.35rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .modal-title {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--text-main);
          margin: 0;
        }

        .modal-close-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          width: 28px;
          height: 28px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .modal-close-btn:hover {
          color: var(--text-main);
          background: var(--bg-hover);
          border-color: var(--border-strong);
        }

        .modal-body {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 1.5rem;
          padding: 1.5rem;
          overflow-y: auto;
        }

        @media (max-width: 768px) {
          .modal-body {
            grid-template-columns: 1fr;
          }
        }

        .config-column {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .form-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .color-swatches {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .color-swatch {
          width: 28px;
          height: 28px;
          border-radius: var(--radius-micro);
          border: 2px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .color-swatch:hover {
          transform: scale(1.08);
        }
        .color-swatch.active {
          border-color: var(--text-main);
          box-shadow: 0 0 0 1px var(--bg-surface);
        }

        .text-input {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          color: var(--text-main);
          font-size: 0.85rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .text-input:focus {
          border-color: var(--accent);
        }

        .toggle-group {
          display: flex;
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid var(--border);
        }

        .toggle-btn {
          flex: 1;
          background: var(--bg-card);
          color: var(--text-muted);
          border: none;
          padding: 8px 12px;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .toggle-btn.active {
          background: var(--accent);
          color: #fff;
          font-weight: 500;
        }

        .quick-links {
          margin-top: 0.5rem;
        }
        .test-link {
          font-size: 0.82rem;
          color: var(--accent);
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .test-link:hover {
          text-decoration: underline;
        }

        .code-column {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .tab-bar {
          display: flex;
          gap: 6px;
          border-bottom: 1px solid var(--border);
          padding-bottom: 6px;
        }

        .tab-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-weight: 500;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .tab-btn.active {
          color: var(--text-main);
          background: var(--bg-card);
          border-color: var(--border);
        }

        .code-box-wrapper {
          position: relative;
        }

        .code-box {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 1rem;
          font-family: var(--font-mono, monospace);
          font-size: 0.78rem;
          color: var(--text-main);
          overflow-x: auto;
          line-height: 1.5;
          margin: 0;
          max-height: 190px;
        }

        .copy-code-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: var(--accent);
          color: #fff;
          font-weight: 500;
          border: none;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          transition: background 0.15s ease;
        }
        .copy-code-btn:hover {
          background: var(--accent-hover);
        }
        .copy-code-btn.copied {
          background: var(--success);
          color: #fff;
        }

        .preview-card {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 12px 14px;
        }
        .preview-label {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .preview-mockup {
          display: flex;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 10px;
        }
        .preview-window {
          width: 220px;
          background: var(--bg-card);
          border-radius: var(--radius-sm);
          overflow: hidden;
          border: 1px solid var(--border);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        }
        .preview-window-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          color: #fff;
        }
        .preview-avatar {
          width: 18px;
          height: 18px;
          border-radius: var(--radius-micro);
          background: rgba(255, 255, 255, 0.2);
          font-size: 0.65rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .preview-title-text {
          font-size: 0.72rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .preview-window-body {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .preview-bubble {
          font-size: 0.68rem;
          padding: 4px 8px;
          border-radius: var(--radius-micro);
          line-height: 1.3;
          max-width: 85%;
        }
        .preview-bubble.bot {
          background: var(--bg-surface);
          color: var(--text-muted);
          border: 1px solid var(--border);
          align-self: flex-start;
        }
        .preview-bubble.user {
          background: var(--accent);
          color: #fff;
          font-weight: 400;
          align-self: flex-end;
        }
        .preview-launcher {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        }
      `}</style>
    </div>
  );
}
