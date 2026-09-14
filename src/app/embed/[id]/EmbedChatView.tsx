"use client";

import { useState, useRef, useEffect, FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Citation = {
  index: number;
  chunkId: string;
  heading: string | null;
  snippet: string;
  score: number;
  isBoilerplate: boolean;
  pageUrl: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type Props = {
  siteId: string;
  siteName: string;
  description: string | null;
  accentColor: string;
  initialGreeting?: string;
  starterQuestions?: string[] | null;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      title="Copy answer"
    >
      {copied ? "✓ Copied" : "Copy"}
      <style jsx>{`
        .copy-btn {
          margin-top: 0.4rem;
          font-size: 0.72rem;
          color: rgba(255, 255, 255, 0.5);
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 2px 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .copy-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.12);
        }
      `}</style>
    </button>
  );
}

export function EmbedChatView({
  siteId,
  siteName,
  description,
  accentColor,
  initialGreeting,
  starterQuestions,
}: Props) {
  const greeting =
    initialGreeting ||
    `Hello! 👋 I'm the AI assistant for ${siteName}. How can I help you today?`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "greeting", role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [language, setLanguage] = useState<string>("auto");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  function handleClose() {
    try {
      if (window.parent) {
        window.parent.postMessage({ type: "webrag_close" }, "*");
      }
    } catch (e) {}
  }

  async function askQuestion(q: string) {
    const questionText = q.trim();
    if (!questionText || streaming) return;

    setInput("");
    setStreaming(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: questionText,
    };
    const assistantId = `a-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          siteId,
          sessionId: sessionId || undefined,
          language: language === "auto" ? null : language,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let citations: Citation[] | undefined;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = JSON.parse(line.slice(6));

          if (payload.type === "meta") {
            if (payload.sessionId) setSessionId(payload.sessionId);
            citations = payload.citations;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, citations: payload.citations } : m
              )
            );
          } else if (payload.type === "token" && payload.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + payload.content }
                  : m
              )
            );
          } else if (payload.type === "done" && payload.sessionId) {
            setSessionId(payload.sessionId);
          } else if (payload.type === "error") {
            throw new Error(payload.error || "Stream error");
          }
        }
      }

      if (citations) {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, citations } : m))
        );
      }
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Error generating answer";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: `⚠️ ${msg}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    askQuestion(input);
  }

  return (
    <div
      className="embed-chat-container"
      style={{ "--accent": accentColor } as React.CSSProperties}
    >
      {/* Top Navigation Header */}
      <header className="embed-header">
        <div className="header-left">
          <div className="avatar">{siteName.slice(0, 1).toUpperCase()}</div>
          <div className="header-info">
            <h1 className="header-title">{siteName}</h1>
            <div className="status-indicator">
              <span className="dot" />
              <span>Online</span>
            </div>
          </div>
        </div>

        <div className="header-right">
          {/* Language Selector */}
          <select
            className="lang-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            title="AI Response Language"
          >
            <option value="auto">🌐 Auto</option>
            <option value="English">🇬🇧 EN</option>
            <option value="Spanish">🇪🇸 ES</option>
            <option value="French">🇫🇷 FR</option>
            <option value="Hindi">🇮🇳 HI</option>
            <option value="Tamil">🇮🇳 TA</option>
          </select>

          {/* Close Button */}
          <button
            type="button"
            className="close-btn"
            onClick={handleClose}
            aria-label="Close Chatbot"
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Messages Scroll Area */}
      <main className="messages-area">
        {messages.map((m) => (
          <div key={m.id} className={`message-row ${m.role}`}>
            {m.role === "assistant" && (
              <div className="bot-msg-avatar">
                {siteName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="bubble-wrapper">
              <div className="bubble">
                {m.content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content}
                  </ReactMarkdown>
                ) : (
                  <div className="typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                )}
              </div>

              {/* Citations */}
              {m.citations && m.citations.length > 0 && (
                <div className="citations-tray">
                  <span className="citations-label">Sources:</span>
                  <div className="citations-list">
                    {m.citations.slice(0, 3).map((c) => (
                      <a
                        key={c.chunkId}
                        href={c.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="citation-pill"
                        title={c.snippet}
                      >
                        🔗 {c.heading || "Page"}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Copy button on assistant replies */}
              {m.role === "assistant" && m.content && (
                <CopyButton text={m.content} />
              )}
            </div>
          </div>
        ))}

        {messages.length === 1 && starterQuestions && starterQuestions.length > 0 && (
          <div className="starter-questions-tray">
            <span className="starter-tray-label">Suggested questions:</span>
            <div className="starter-pills-list">
              {starterQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="starter-question-pill"
                  onClick={() => askQuestion(q)}
                >
                  💬 {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input Area */}
      <footer className="embed-footer">
        <form className="input-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="chat-input"
            placeholder={`Ask about ${siteName}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={streaming}
          />
          <button
            type="submit"
            className="send-btn"
            disabled={!input.trim() || streaming}
            aria-label="Send question"
          >
            <svg viewBox="0 0 24 24" width={18} height={18} fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
        <div className="branding">
          <span>Powered by </span>
          <a
            href="https://web-rag-two.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Web RAG
          </a>
        </div>
      </footer>

      <style jsx>{`
        .embed-chat-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          height: 100dvh;
          width: 100%;
          background: #0d1117;
          color: #f0f6fc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          overflow: hidden;
        }

        .embed-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: rgba(22, 27, 34, 0.85);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          z-index: 10;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }

        .avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .header-info {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .header-title {
          font-size: 0.95rem;
          font-weight: 600;
          margin: 0;
          color: #fff;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          color: #3fb950;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #3fb950;
          display: inline-block;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .lang-select {
          background: rgba(255, 255, 255, 0.08);
          color: #c9d1d9;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 6px;
          font-size: 0.75rem;
          padding: 4px 6px;
          cursor: pointer;
          outline: none;
        }
        .lang-select:hover {
          border-color: rgba(255, 255, 255, 0.25);
        }

        .close-btn {
          background: transparent;
          border: none;
          color: #8b949e;
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }
        .close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
        }

        .messages-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .message-row {
          display: flex;
          gap: 8px;
          max-width: 88%;
        }

        .message-row.user {
          align-self: flex-end;
          flex-direction: row-reverse;
        }

        .message-row.assistant {
          align-self: flex-start;
        }

        .bot-msg-avatar {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          margin-top: 4px;
        }

        .bubble-wrapper {
          display: flex;
          flex-direction: column;
          max-width: 100%;
        }

        .bubble {
          padding: 10px 14px;
          border-radius: 14px;
          font-size: 0.88rem;
          line-height: 1.48;
          word-break: break-word;
        }

        .message-row.user .bubble {
          background: var(--accent);
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .message-row.assistant .bubble {
          background: rgba(255, 255, 255, 0.06);
          color: #e6edf3;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-bottom-left-radius: 4px;
        }

        .bubble :global(p) {
          margin: 0 0 0.5rem 0;
        }
        .bubble :global(p:last-child) {
          margin-bottom: 0;
        }
        .bubble :global(ul), .bubble :global(ol) {
          margin: 0.4rem 0;
          padding-left: 1.2rem;
        }
        .bubble :global(code) {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 5px;
          border-radius: 4px;
          font-size: 0.8rem;
        }

        .typing-dots {
          display: flex;
          gap: 4px;
          padding: 4px 6px;
        }
        .typing-dots span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #8b949e;
          animation: bounce 1.4s infinite both;
        }
        .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
        .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
        .typing-dots span:nth-child(3) { animation-delay: 0s; }

        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }

        .citations-tray {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 0.72rem;
          color: #8b949e;
          flex-wrap: wrap;
        }
        .citations-list {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }
        .citation-pill {
          color: #58a6ff;
          background: rgba(56, 139, 253, 0.1);
          border: 1px solid rgba(56, 139, 253, 0.2);
          padding: 1px 6px;
          border-radius: 4px;
          text-decoration: none;
          max-width: 140px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .citation-pill:hover {
          text-decoration: underline;
        }

        .starter-questions-tray {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 4px;
          margin-left: 34px;
          animation: fadeIn 0.3s ease;
        }
        .starter-tray-label {
          font-size: 0.72rem;
          color: #8b949e;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .starter-pills-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-start;
        }
        .starter-question-pill {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          padding: 6px 12px;
          color: #c9d1d9;
          font-size: 0.8rem;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s ease;
          line-height: 1.35;
        }
        .starter-question-pill:hover {
          background: rgba(56, 189, 248, 0.15);
          border-color: var(--accent);
          color: #fff;
          transform: translateX(3px);
        }

        .embed-footer {
          padding: 12px 14px 8px;
          background: rgba(22, 27, 34, 0.85);
          backdrop-filter: blur(12px);
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .input-form {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 24px;
          padding: 4px 6px 4px 14px;
          transition: border-color 0.2s ease;
        }
        .input-form:focus-within {
          border-color: var(--accent);
        }

        .chat-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: #fff;
          font-size: 0.88rem;
          min-width: 0;
        }

        .send-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--accent);
          color: #fff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: opacity 0.15s ease, transform 0.15s ease;
        }
        .send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }
        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .branding {
          text-align: center;
          font-size: 0.68rem;
          color: #8b949e;
          margin-top: 6px;
        }
        .branding a {
          color: #c9d1d9;
          text-decoration: none;
          font-weight: 500;
        }
        .branding a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
