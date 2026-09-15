"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

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
          <svg className="code-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
              <svg className="copy-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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

export function MarkdownRenderer({ content, isStreaming = false }: MarkdownRendererProps) {
  const [showThinking, setShowThinking] = useState(false);

  // Parse <thinking> tags if present
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)(?:<\/thinking>|$)/i);
  const thinkingContent = thinkingMatch ? thinkingMatch[1].trim() : null;
  const isStillThinking = thinkingMatch && !content.includes("</thinking>");
  const cleanContent = content.replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, "").trim();

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
              <span>
                {isStillThinking ? "Reasoning & Analyzing..." : "Thought Process"}
              </span>
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

      {/* Main Markdown Text */}
      {cleanContent && (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || "");
              const codeString = String(children).replace(/\n$/, "");

              if (!inline && (match || codeString.includes("\n"))) {
                return (
                  <CodeBlock
                    language={match ? match[1] : ""}
                    code={codeString}
                  />
                );
              }

              return (
                <code className="inline-code" {...props}>
                  {children}
                </code>
              );
            },
            table({ children }) {
              return (
                <div className="table-wrapper">
                  <table className="styled-table">{children}</table>
                </div>
              );
            },
            a({ href, children }) {
              return (
                <a href={href} target="_blank" rel="noopener noreferrer" className="md-link">
                  {children}
                  <span className="link-arrow">↗</span>
                </a>
              );
            },
          }}
        >
          {cleanContent}
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
          border-left: 3px solid var(--accent, #7c7cff);
          background: rgba(124, 124, 255, 0.05);
          border-radius: 0 6px 6px 0;
          color: #a1a1aa;
        }
        .markdown-renderer h1,
        .markdown-renderer h2,
        .markdown-renderer h3,
        .markdown-renderer h4 {
          margin: 1.1rem 0 0.4rem 0;
          color: #f4f4f5;
          font-weight: 600;
        }
        .inline-code {
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #e4e4e7;
          font-size: 0.85em;
          padding: 2px 5px;
          border-radius: 4px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }
        .table-wrapper {
          overflow-x: auto;
          margin: 0.85rem 0;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .styled-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.84rem;
          text-align: left;
        }
        .styled-table th {
          background: rgba(255, 255, 255, 0.05);
          color: #f4f4f5;
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          font-weight: 600;
        }
        .styled-table td {
          padding: 8px 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          color: #d4d4d8;
        }
        .styled-table tr:last-child td {
          border-bottom: none;
        }
        .styled-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }
        .md-link {
          color: #93c5fd;
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 0.15s ease;
        }
        .md-link:hover {
          color: #bfdbfe;
        }
        .link-arrow {
          font-size: 0.75em;
          margin-left: 2px;
          opacity: 0.75;
        }
        /* Thinking Accordion */
        .thinking-accordion {
          margin-bottom: 0.85rem;
          background: rgba(124, 124, 255, 0.04);
          border: 1px solid rgba(124, 124, 255, 0.15);
          border-radius: 8px;
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
          color: #a78bfa;
          font-size: 0.8rem;
          font-weight: 500;
          transition: background 0.15s ease;
        }
        .thinking-toggle:hover {
          background: rgba(124, 124, 255, 0.08);
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
          background: #a78bfa;
          display: inline-block;
          animation: pulse-dot 1.2s ease-in-out infinite;
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        .thinking-body {
          padding: 8px 12px 10px 12px;
          border-top: 1px solid rgba(124, 124, 255, 0.1);
          font-size: 0.8rem;
          line-height: 1.5;
          color: #9ca3af;
          background: rgba(0, 0, 0, 0.2);
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
          background: var(--accent, #7c7cff);
          border-radius: 1px;
          animation: caret-blink 0.8s ease-in-out infinite;
        }
        @keyframes caret-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
