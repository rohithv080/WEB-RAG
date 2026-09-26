"use client";

import { useState, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SourceInspectModal } from "./SourceInspectModal";
import type { Citation } from "./CitationCard";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
  citations?: Citation[];
  onInspectCitation?: (citation: Citation) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Block with Copy Action
// ─────────────────────────────────────────────────────────────────────────────

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const displayLang = (language || "code").toUpperCase();

  return (
    <div className="code-block-wrapper">
      <div className="code-header">
        <div className="code-lang">
          <svg
            className="code-icon"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <polyline points="5 4 1 8 5 12" />
            <polyline points="11 4 15 8 11 12" />
            <line x1="9" y1="3" x2="7" y2="13" />
          </svg>
          <span>{displayLang}</span>
        </div>
        <button
          type="button"
          className="code-copy-btn"
          onClick={handleCopy}
          title="Copy code to clipboard"
        >
          {copied ? (
            <>
              <span className="copy-check">✓</span>
              <span>Copied</span>
            </>
          ) : (
            <>
              <svg
                className="copy-svg"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <rect x="5" y="5" width="8" height="8" rx="1.5" />
                <path d="M3 11V3.5A1.5 1.5 0 014.5 2H11" />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="code-pre">
        <code>{code}</code>
      </pre>

      <style jsx>{`
        .code-block-wrapper {
          margin: 0.85rem 0;
          background: #0d0d10;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          overflow: hidden;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .code-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.03);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.72rem;
          user-select: none;
        }
        .code-lang {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #8a8f98;
          font-weight: 600;
          letter-spacing: 0.04em;
        }
        .code-icon {
          width: 13px;
          height: 13px;
          opacity: 0.7;
        }
        .code-copy-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          color: #a1a1aa;
          font-size: 0.72rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .code-copy-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f4f4f5;
          border-color: rgba(255, 255, 255, 0.18);
        }
        .copy-svg {
          width: 12px;
          height: 12px;
        }
        .copy-check {
          color: #34d399;
          font-weight: bold;
        }
        .code-pre {
          margin: 0;
          padding: 12px 14px;
          overflow-x: auto;
          font-size: 0.82rem;
          line-height: 1.55;
          color: #e4e4e7;
        }
        .code-pre code {
          background: transparent !important;
          border: none !important;
          padding: 0 !important;
          color: inherit !important;
          font-size: inherit !important;
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Interactive Table with CSV Export
// ─────────────────────────────────────────────────────────────────────────────

function TableWithCsvCopy({ children }: { children: React.ReactNode }) {
  const tableRef = useRef<HTMLTableElement>(null);
  const [copied, setCopied] = useState(false);

  function copyAsCsv() {
    if (!tableRef.current) return;
    const rows = Array.from(tableRef.current.querySelectorAll("tr"));
    const csvContent = rows
      .map((row) => {
        const cells = Array.from(row.querySelectorAll("th, td"));
        return cells
          .map((cell) => {
            let text = (cell as HTMLElement).innerText || "";
            text = text.replace(/"/g, '""');
            return `"${text}"`;
          })
          .join(",");
      })
      .join("\n");

    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="table-enhanced-wrapper">
      <div className="table-top-bar">
        <span className="table-badge">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2zm15 2h-4v3h4V4zm0 4h-4v3h4V8zm0 4h-4v3h3a1 1 0 0 0 1-1v-2zm-5 3v-3H6v3h4zm-5 0v-3H1v2a1 1 0 0 0 1 1h3zm-4-4h4V8H1v3zm0-4h4V4H1v3zm5-3v3h4V4H6zm4 4H6v3h4V8z" />
          </svg>
          Structured Table
        </span>
        <button
          type="button"
          className="table-copy-csv-btn"
          onClick={copyAsCsv}
          title="Export table data as CSV"
        >
          {copied ? (
            <>
              <span className="copy-check">✓</span>
              <span>CSV Copied</span>
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M4 2v12M8 2v12M12 2v12M2 5h12M2 11h12" />
              </svg>
              <span>Copy CSV</span>
            </>
          )}
        </button>
      </div>
      <div className="table-scroll-area">
        <table ref={tableRef} className="styled-table">
          {children}
        </table>
      </div>

      <style jsx>{`
        .table-enhanced-wrapper {
          margin: 0.95rem 0;
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.09);
          background: rgba(255, 255, 255, 0.02);
          overflow: hidden;
        }
        .table-top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          background: rgba(255, 255, 255, 0.035);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.72rem;
        }
        .table-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          color: #94a3b8;
          font-weight: 600;
          letter-spacing: 0.02em;
        }
        .table-copy-csv-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 4px;
          color: #a1a1aa;
          font-size: 0.7rem;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .table-copy-csv-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.18);
        }
        .copy-check {
          color: #34d399;
          font-weight: bold;
        }
        .table-scroll-area {
          overflow-x: auto;
        }
        .styled-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.84rem;
          text-align: left;
        }
        .styled-table :global(th) {
          background: rgba(255, 255, 255, 0.04);
          color: #f4f4f5;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          font-weight: 600;
        }
        .styled-table :global(td) {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: #d4d4d8;
        }
        .styled-table :global(tr:last-child td) {
          border-bottom: none;
        }
        .styled-table :global(tr:hover td) {
          background: rgba(255, 255, 255, 0.025);
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Perplexity-Style Interactive Inline Citation Chip & Popover
// ─────────────────────────────────────────────────────────────────────────────

function InlineCitationChip({
  index,
  citation,
  onInspect,
}: {
  index: number;
  citation?: Citation;
  onInspect?: (c: Citation) => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const domain = citation
    ? (() => {
        try {
          return new URL(citation.pageUrl).hostname.replace(/^www\./, "");
        } catch {
          return citation.pageUrl;
        }
      })()
    : null;

  const displayTitle = citation
    ? (() => {
        if (citation.heading && citation.heading.trim()) {
          return citation.heading.trim();
        }
        try {
          const url = new URL(citation.pageUrl);
          const pathParts = url.pathname.split("/").filter(Boolean);
          if (pathParts.length > 0) {
            const last = pathParts[pathParts.length - 1]
              .replace(/[-_]/g, " ")
              .replace(/\.[a-zA-Z0-9]+$/, "");
            if (last.length > 1) {
              return last.charAt(0).toUpperCase() + last.slice(1);
            }
          }
          return domain || "Source Document";
        } catch {
          return domain || "Source Document";
        }
      })()
    : `Source [${index}]`;

  const favicon = citation
    ? (() => {
        try {
          const host = new URL(citation.pageUrl).hostname;
          return `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
        } catch {
          return null;
        }
      })()
    : null;

  const matchPercent = citation
    ? Math.min(99, Math.max(70, Math.round(citation.score * 100)))
    : null;

  const isWebCitation = Boolean(citation?.chunkId?.startsWith("web-") || (citation as any)?.isWeb);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 140);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHovered(false);
    if (citation) {
      if (isWebCitation && citation.pageUrl) {
        window.open(citation.pageUrl, "_blank", "noopener,noreferrer");
        return;
      }
      if (onInspect) {
        onInspect(citation);
      } else {
        setShowModal(true);
      }
    }
  };

  return (
    <span
      className="inline-cite-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        className={`inline-cite-badge ${citation ? "has-data" : "pending"} ${isWebCitation ? "is-web" : ""}`}
        onClick={handleClick}
        title={
          citation
            ? isWebCitation
              ? `[${index}] ${displayTitle} — Click to open live article`
              : `[${index}] ${displayTitle} — Click to inspect source`
            : `[${index}] Source reference`
        }
      >
        <span className="cite-num">{index}</span>
      </button>

      {/* Floating Rich Popover Preview on Hover */}
      {isHovered && (
        <span className="inline-cite-popover" onClick={handleClick}>
          {citation ? (
            <>
              <span className="popover-header">
                <span className="popover-meta">
                  {favicon && (
                    <img
                      src={favicon}
                      alt=""
                      width={14}
                      height={14}
                      className="popover-favicon"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  )}
                  <span className="popover-domain">{domain}</span>
                </span>
                {isWebCitation ? (
                  <span className="popover-badge popover-web-badge">🌐 Web</span>
                ) : (
                  matchPercent && <span className="popover-badge">{matchPercent}% match</span>
                )}
              </span>

              <span className="popover-title">{displayTitle}</span>

              <span className="popover-snippet">
                &ldquo;{citation.snippet.slice(0, 180).trim()}&hellip;&rdquo;
              </span>

              <span className="popover-footer">
                <span>{isWebCitation ? "Click to open article" : "Click to inspect passage"}</span>
                <span className="popover-arrow">↗</span>
              </span>
            </>
          ) : (
            <span className="popover-loading">
              <span className="popover-spinner" />
              <span>Referencing source chunk [{index}]...</span>
            </span>
          )}
        </span>
      )}

      {showModal && citation && !isWebCitation && (
        <SourceInspectModal citation={citation} onClose={() => setShowModal(false)} />
      )}

      <style jsx>{`
        .inline-cite-wrapper {
          position: relative;
          display: inline-flex;
          vertical-align: baseline;
          margin: 0 2px;
          user-select: none;
        }

        .inline-cite-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 17px;
          height: 17px;
          padding: 0 4px;
          border-radius: 4px;
          font-size: 0.68rem;
          font-weight: 700;
          font-family: inherit;
          line-height: 1;
          vertical-align: baseline;
          position: relative;
          top: -0.22em;
          cursor: pointer;
          background: rgba(99, 102, 241, 0.18);
          border: 1px solid rgba(139, 92, 246, 0.35);
          color: #c4b5fd;
          transition: all 0.16s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .inline-cite-badge.is-web {
          background: rgba(6, 182, 212, 0.18);
          border-color: rgba(6, 182, 212, 0.4);
          color: #67e8f9;
        }

        .inline-cite-badge:hover {
          background: rgba(139, 92, 246, 0.35);
          border-color: rgba(167, 139, 250, 0.6);
          color: #ffffff;
          transform: translateY(-1px);
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.45);
        }

        .inline-cite-badge.is-web:hover {
          background: rgba(6, 182, 212, 0.35);
          border-color: rgba(6, 182, 212, 0.65);
          color: #ffffff;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.45);
        }

        .inline-cite-badge.pending {
          opacity: 0.7;
          border-style: dashed;
        }

        .cite-num {
          letter-spacing: -0.02em;
        }

        /* Floating Rich Popover */
        .inline-cite-popover {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          width: 270px;
          padding: 10px 12px;
          background: #111116;
          border: 1px solid rgba(139, 92, 246, 0.25);
          border-radius: 10px;
          box-shadow:
            0 14px 34px -4px rgba(0, 0, 0, 0.7),
            0 0 14px rgba(139, 92, 246, 0.18);
          z-index: 1000;
          display: flex;
          flex-direction: column;
          gap: 6px;
          pointer-events: auto;
          text-align: left;
          animation: popover-fade-in 0.15s ease-out;
        }

        .inline-cite-popover::after {
          content: "";
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-width: 5px;
          border-style: solid;
          border-color: #111116 transparent transparent transparent;
        }

        @keyframes popover-fade-in {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .popover-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.7rem;
        }

        .popover-meta {
          display: flex;
          align-items: center;
          gap: 5px;
          min-width: 0;
        }

        .popover-favicon {
          border-radius: 2px;
          flex-shrink: 0;
        }

        .popover-domain {
          color: #94a3b8;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .popover-badge {
          padding: 1px 5px;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.25);
          color: #34d399;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 600;
          flex-shrink: 0;
        }

        .popover-web-badge {
          background: rgba(6, 182, 212, 0.15) !important;
          border-color: rgba(6, 182, 212, 0.35) !important;
          color: #22d3ee !important;
        }

        .popover-title {
          font-size: 0.78rem;
          font-weight: 600;
          color: #f1f5f9;
          line-height: 1.3;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .popover-snippet {
          font-size: 0.72rem;
          line-height: 1.45;
          color: #94a3b8;
          font-style: italic;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin: 0;
        }

        .popover-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 4px;
          border-top: 1px solid var(--border-subtle);
          font-size: 0.68rem;
          color: var(--accent);
          font-weight: 600;
        }

        .popover-arrow {
          font-size: 0.75rem;
        }

        .popover-loading {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: #94a3b8;
          padding: 4px 0;
        }

        .popover-spinner {
          width: 10px;
          height: 10px;
          border: 1.5px solid rgba(139, 92, 246, 0.3);
          border-top-color: #8b5cf6;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Linkify Citations Helper
// Converts [1], [2], [1, 2] in prose into [cite:1](citation:1) links
// Keeps code blocks and inline code untouched
// ─────────────────────────────────────────────────────────────────────────────

function linkifyCitations(text: string): string {
  if (!text) return "";
  // Split by fenced code blocks (```...```) and inline code (`...`)
  const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
  return parts
    .map((part, i) => {
      // Odd indexes are code blocks or inline code - preserve untouched
      if (i % 2 === 1) return part;

      // In prose:
      // 1. Grouped citations like [1, 2] or [1, 2, 3] or [^1, ^2]
      let processed = part.replace(
        /(^|[\s.,;:!?()"]|\])\[\^?(\d+)(?:\s*,\s*\^?(\d+))+\](?!\()/g,
        (match, prefix) => {
          const inner = match.slice(match.indexOf("[") + 1, match.lastIndexOf("]"));
          const nums = inner.split(",").map((s) => s.replace("^", "").trim());
          const links = nums.map((n) => `[${n}](#citation-${n})`).join(" ");
          return `${prefix}${links}`;
        }
      );

      // 2. Single citations like [1], [2], [^1]
      processed = processed.replace(
        /(^|[\s.,;:!?()"]|\])\[\^?(\d+)\](?!\()/g,
        "$1[$2](#citation-$2)"
      );

      return processed;
    })
    .join("");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Markdown Renderer Component
// ─────────────────────────────────────────────────────────────────────────────

export function MarkdownRenderer({
  content,
  isStreaming = false,
  citations,
  onInspectCitation,
}: MarkdownRendererProps) {
  const [showThinking, setShowThinking] = useState(false);

  // Parse <thinking> tags if present
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/i);
  const thinkingContent = thinkingMatch ? thinkingMatch[1].trim() : null;
  const isStillThinking = thinkingMatch && !content.includes("</thinking>");
  const cleanContent = content.replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, "").trim();

  // Convert inline citation brackets to recognizable markdown links
  const formattedContent = linkifyCitations(cleanContent);

  return (
    <div className="markdown-renderer">
      {/* Collapsible Thinking Accordion */}
      {thinkingContent && (
        <div className="thinking-accordion">
          <button
            type="button"
            className="thinking-toggle"
            onClick={() => setShowThinking((prev) => !prev)}
            title="Toggle model reasoning"
          >
            <div className="thinking-title">
              <span className="thinking-icon">💭</span>
              <span>{isStillThinking ? "Reasoning & Analyzing..." : "Thought Process"}</span>
              {isStillThinking && <span className="thinking-pulse" />}
            </div>
            <span className={`thinking-chevron ${showThinking ? "open" : ""}`}>▾</span>
          </button>
          {(showThinking || isStillThinking) && (
            <div className="thinking-body">
              <div className="thinking-text">{thinkingContent}</div>
            </div>
          )}
        </div>
      )}

      {/* Main Markdown Content */}
      {formattedContent && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={(url) => url}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              const codeString = String(children).replace(/\n$/, "");

              if (!inline && (match || codeString.includes("\n"))) {
                return <CodeBlock language={match ? match[1] : ""} code={codeString} />;
              }

              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            },
            table({ children }) {
              return <TableWithCsvCopy>{children}</TableWithCsvCopy>;
            },
            a({ href, children, ...props }: any) {
              // Intercept citation links
              if (href && (href.startsWith("#citation-") || href.startsWith("citation:"))) {
                const citationIndex = parseInt(href.replace(/^(#citation-|citation:)/, ""), 10);
                const citation =
                  citations?.find((c) => c.index === citationIndex) ||
                  citations?.[citationIndex - 1];

                return (
                  <InlineCitationChip
                    index={citationIndex}
                    citation={citation}
                    onInspect={onInspectCitation}
                  />
                );
              }

              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="md-link"
                  {...props}
                >
                  {children}
                  <span className="link-arrow">↗</span>
                </a>
              );
            },
          }}
        >
          {formattedContent}
        </ReactMarkdown>
      )}

      {/* Pulsing Streaming Caret */}
      {isStreaming && <span className="streaming-caret" />}

      <style jsx global>{`
        .markdown-renderer {
          font-size: 0.92rem;
          line-height: 1.65;
          color: #e4e4e7;
          word-break: break-word;
        }
        .markdown-renderer p {
          margin: 0.5rem 0;
        }
        .markdown-renderer p:first-child {
          margin-top: 0;
        }
        .markdown-renderer p:last-child {
          margin-bottom: 0;
        }
        .markdown-renderer ul,
        .markdown-renderer ol {
          margin: 0.5rem 0;
          padding-left: 1.4rem;
        }
        .markdown-renderer li {
          margin: 0.25rem 0;
        }
        .markdown-renderer blockquote {
          margin: 0.75rem 0;
          padding: 0.4rem 0.9rem;
          border-left: 3px solid var(--accent);
          background: var(--accent-subtle);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          color: var(--text-secondary);
        }
        .markdown-renderer h1,
        .markdown-renderer h2,
        .markdown-renderer h3,
        .markdown-renderer h4 {
          margin: 1.1rem 0 0.4rem 0;
          color: var(--text-primary);
          font-weight: 600;
        }
        .inline-code {
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          color: var(--text-primary);
          font-size: 0.85em;
          padding: 2px 5px;
          border-radius: var(--radius-sm);
          font-family: var(--font-mono, monospace);
        }
        .md-link {
          color: var(--accent);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s ease;
        }
        .md-link:hover {
          color: var(--accent-hover);
        }
        .link-arrow {
          font-size: 0.75em;
          margin-left: 2px;
          opacity: 0.75;
        }
        /* Thinking Accordion */
        .thinking-accordion {
          margin-bottom: 0.85rem;
          background: var(--accent-subtle);
          border: 1px solid var(--accent-dim);
          border-radius: var(--radius-md);
          overflow: hidden;
        }
        .thinking-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: transparent;
          border: none;
          cursor: pointer;
          color: var(--accent);
          font-size: 0.8rem;
          font-weight: 600;
          transition: background 0.15s ease;
        }
        .thinking-toggle:hover {
          background: var(--bg-hover);
        }
        .thinking-title {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .thinking-icon {
          font-size: 0.9rem;
        }
        .thinking-chevron {
          font-size: 0.9rem;
          transition: transform 0.2s ease;
        }
        .thinking-chevron.open {
          transform: rotate(180deg);
        }
        .thinking-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          display: inline-block;
          animation: pulse-dot 1.2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%,
          100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
        .thinking-body {
          padding: 8px 12px 10px 12px;
          border-top: 1px solid var(--accent-dim);
          font-size: 0.8rem;
          line-height: 1.5;
          color: var(--text-secondary);
          background: var(--bg-surface);
          max-height: 250px;
          overflow-y: auto;
        }
        .thinking-text {
          white-space: pre-wrap;
          font-style: italic;
        }
        /* Streaming Caret */
        .streaming-caret {
          display: inline-block;
          width: 6px;
          height: 14px;
          margin-left: 3px;
          vertical-align: -1px;
          background: var(--accent);
          border-radius: 1px;
          animation: caret-blink 0.8s ease-in-out infinite;
        }
        @keyframes caret-blink {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
