"use client";

import { useEffect, useState } from "react";
import type { Citation } from "./CitationCard";

type Props = {
  citation: Citation;
  onClose: () => void;
};

export function SourceInspectModal({ citation, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const domain = (() => {
    try {
      return new URL(citation.pageUrl).hostname.replace(/^www\./, "");
    } catch {
      return citation.pageUrl;
    }
  })();

  const favicon = (() => {
    try {
      const host = new URL(citation.pageUrl).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
    } catch {
      return null;
    }
  })();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(citation.snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const relevancePct = Math.min(100, Math.max(1, Math.round(citation.score * 100)));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="header-left">
            <span className="cite-badge">[{citation.index}]</span>
            {favicon && <img src={favicon} alt="" width={18} height={18} className="site-icon" />}
            <div>
              <h3 className="source-domain">{domain}</h3>
              <p className="source-heading">{citation.heading || "General Content"}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Relevance and metadata */}
        <div className="metadata-bar">
          <div className="score-pill">
            <span className="score-dot" />
            <span>{relevancePct}% Relevance Score</span>
          </div>
          <div className="chunk-id">
            Chunk ID: <code>{citation.chunkId ? citation.chunkId.slice(0, 10) : "verified"}</code>
          </div>
        </div>

        {/* Verified Chunk Content */}
        <div className="content-container">
          <div className="content-label">Verified Extracted Knowledge:</div>
          <div className="chunk-text">
            {citation.snippet}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleCopy}>
            {copied ? "✓ Copied to Clipboard" : "📋 Copy Text"}
          </button>
          <a
            className="btn-primary"
            href={citation.pageUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Source Webpage ↗
          </a>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
          animation: fadeIn 0.15s ease-out;
        }

        .modal-card {
          width: 100%;
          max-width: 580px;
          background: #0f1117;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: scaleUp 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.1rem 1.25rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .cite-badge {
          font-family: var(--font-mono, monospace);
          font-size: 0.85rem;
          font-weight: 700;
          color: #6366f1;
          background: rgba(99, 102, 241, 0.12);
          padding: 0.2rem 0.5rem;
          border-radius: 6px;
          border: 1px solid rgba(99, 102, 241, 0.25);
        }

        .site-icon {
          border-radius: 4px;
        }

        .source-domain {
          margin: 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: #f3f4f6;
        }

        .source-heading {
          margin: 0;
          font-size: 0.75rem;
          color: #9ca3af;
          max-width: 320px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #9ca3af;
          font-size: 1.1rem;
          cursor: pointer;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          transition: all 0.12s ease;
        }
        .close-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #ffffff;
        }

        .metadata-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1.25rem;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.75rem;
        }

        .score-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          color: #10b981;
          font-weight: 500;
        }

        .score-dot {
          width: 6px;
          height: 6px;
          background: #10b981;
          border-radius: 50%;
          box-shadow: 0 0 8px #10b981;
        }

        .chunk-id {
          color: #6b7280;
          font-family: var(--font-mono, monospace);
        }

        .content-container {
          padding: 1.25rem;
          max-height: 340px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .content-label {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
        }

        .chunk-text {
          font-size: 0.88rem;
          line-height: 1.6;
          color: #e5e7eb;
          white-space: pre-wrap;
          word-break: break-word;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          padding: 1rem;
        }

        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.75rem;
          padding: 1rem 1.25rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }

        .btn-secondary {
          padding: 0.45rem 0.85rem;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          color: #d1d5db;
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .btn-primary {
          padding: 0.45rem 0.95rem;
          background: #6366f1;
          border: none;
          border-radius: 6px;
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.12s ease;
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }
        .btn-primary:hover {
          background: #4f46e5;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes scaleUp {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
