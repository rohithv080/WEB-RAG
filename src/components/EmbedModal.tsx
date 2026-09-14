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
      setGreeting(`Hello! 👋 Ask me anything about ${site.name}.`);
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
            <span className="badge-embed">🚀 Embed Anywhere</span>
            <h2 className="modal-title">Embed "{site.name}" on Your Website</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close">
            ✕
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
              <label className="form-label" htmlFor="embed-title">Chatbot Title</label>
              <input
                id="embed-title"
                type="text"
                className="text-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Vijay Wiki Assistant"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="embed-greeting">Greeting Message</label>
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
                ↗ Open Full Screen Embed Preview
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
                {copied ? "✓ Copied!" : "📋 Copy Code"}
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
                    <div className="preview-bubble user">Who is Vijay?</div>
                  </div>
                </div>
                <div className="preview-launcher" style={{ background: color }}>
                  💬
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
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-card {
          width: 100%;
          max-width: 860px;
          background: #11151f;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 20px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.5rem 1.75rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .badge-embed {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 700;
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.12);
          padding: 2px 8px;
          border-radius: 99px;
          margin-bottom: 0.4rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 700;
          color: #fff;
          margin: 0;
        }

        .modal-close-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #8b949e;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 1rem;
          transition: all 0.15s ease;
        }
        .modal-close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.12);
        }

        .modal-body {
          display: grid;
          grid-template-columns: 1fr 1.2fr;
          gap: 1.5rem;
          padding: 1.5rem 1.75rem;
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
          gap: 0.5rem;
        }

        .form-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: #c9d1d9;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .color-swatches {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .color-swatch {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 2px solid transparent;
          cursor: pointer;
          transition: transform 0.15s ease, border-color 0.15s ease;
        }
        .color-swatch:hover {
          transform: scale(1.15);
        }
        .color-swatch.active {
          border-color: #fff;
          box-shadow: 0 0 12px rgba(255, 255, 255, 0.4);
          transform: scale(1.1);
        }

        .text-input {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 8px 12px;
          color: #fff;
          font-size: 0.88rem;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .text-input:focus {
          border-color: #38bdf8;
        }

        .toggle-group {
          display: flex;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .toggle-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.04);
          color: #8b949e;
          border: none;
          padding: 8px 12px;
          font-size: 0.82rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .toggle-btn.active {
          background: #38bdf8;
          color: #0b1120;
          font-weight: 600;
        }

        .quick-links {
          margin-top: 0.5rem;
        }
        .test-link {
          font-size: 0.82rem;
          color: #38bdf8;
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
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 6px;
        }

        .tab-btn {
          background: transparent;
          border: none;
          color: #8b949e;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .tab-btn.active {
          color: #fff;
          background: rgba(255, 255, 255, 0.08);
        }

        .code-box-wrapper {
          position: relative;
        }

        .code-box {
          background: #090d14;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 1rem;
          font-family: "SFMono-Regular", Consolas, Menlo, monospace;
          font-size: 0.78rem;
          color: #7dd3fc;
          overflow-x: auto;
          line-height: 1.5;
          margin: 0;
          max-height: 190px;
        }

        .copy-code-btn {
          position: absolute;
          top: 10px;
          right: 10px;
          background: #38bdf8;
          color: #082f49;
          font-weight: 700;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.78rem;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
          transition: transform 0.15s ease, background 0.15s ease;
        }
        .copy-code-btn:hover {
          transform: scale(1.05);
          background: #7dd3fc;
        }
        .copy-code-btn.copied {
          background: #10b981;
          color: #fff;
        }

        .preview-card {
          background: #090d14;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 12px 14px;
        }
        .preview-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: #8b949e;
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
          background: #161b22;
          border-radius: 10px;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
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
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.25);
          font-size: 0.65rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .preview-title-text {
          font-size: 0.72rem;
          font-weight: 600;
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
          border-radius: 8px;
          line-height: 1.3;
          max-width: 85%;
        }
        .preview-bubble.bot {
          background: rgba(255, 255, 255, 0.08);
          color: #c9d1d9;
          align-self: flex-start;
        }
        .preview-bubble.user {
          background: #38bdf8;
          color: #0b1120;
          font-weight: 500;
          align-self: flex-end;
        }
        .preview-launcher {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.1rem;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }
      `}</style>
    </div>
  );
}
