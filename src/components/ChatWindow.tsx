"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CitationCard, type Citation } from "./CitationCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

type Props = {
  siteId: string | null;
  sessionId: string | null;
  onSessionId: (id: string) => void;
  siteTitle?: string | null;
};

export function ChatWindow({ siteId, sessionId, onSessionId, siteTitle }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [siteId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!siteId || streaming) return;

    const question = input.trim();
    if (!question) return;

    setInput("");
    setError(null);
    setStreaming(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question,
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
        body: JSON.stringify({ question, siteId, sessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Chat failed (${res.status})`);
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
          const payload = JSON.parse(line.slice(6)) as {
            type: string;
            content?: string;
            sessionId?: string;
            citations?: Citation[];
            error?: string;
          };

          if (payload.type === "meta") {
            if (payload.sessionId) onSessionId(payload.sessionId);
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
            onSessionId(payload.sessionId);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Chat failed";
      setError(message);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId && !m.content
            ? { ...m, content: `Error: ${message}` }
            : m
        )
      );
    } finally {
      setStreaming(false);
    }
  }

  const ready = Boolean(siteId);

  return (
    <section className="chat">
      <header className="chat-header">
        <h2>Chat</h2>
        <p className="chat-sub">
          {ready
            ? `Grounded on ${siteTitle || "scraped page"}`
            : "Scrape a URL first to enable chat"}
        </p>
      </header>

      <div className="chat-messages" role="log" aria-live="polite">
        {messages.length === 0 && (
          <p className="chat-empty">
            Ask a question about the indexed page. Answers cite retrieved chunks as [1], [2], …
          </p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <div className="msg-role">{m.role === "user" ? "You" : "Assistant"}</div>
            <div className="msg-body">
              {m.role === "assistant" ? (
                <div className="md-content">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content || (streaming ? "…" : "")}
                  </ReactMarkdown>
                </div>
              ) : (
                m.content || (streaming ? "…" : "")
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form onSubmit={handleSubmit} className="chat-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ready ? "Ask about this page…" : "Index a page to start"}
          disabled={!ready || streaming}
          className="chat-input"
        />
        <button type="submit" disabled={!ready || streaming || !input.trim()} className="chat-send">
          {streaming ? "…" : "Send"}
        </button>
      </form>

      <style jsx>{`
        .chat {
          display: flex;
          flex-direction: column;
          min-height: 420px;
          height: min(70vh, 640px);
          border: 1px solid var(--border);
          border-radius: calc(var(--radius) + 2px);
          background: var(--bg-elevated);
          overflow: hidden;
        }
        .chat-header {
          padding: 1rem 1.15rem 0.75rem;
          border-bottom: 1px solid var(--border);
        }
        .chat-header h2 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
        }
        .chat-sub {
          margin: 0.2rem 0 0;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.15rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .chat-empty {
          margin: auto;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.9rem;
          max-width: 28rem;
        }
        .msg-role {
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          margin-bottom: 0.25rem;
        }
        .msg-user .msg-body {
          color: var(--text);
        }
        .msg-assistant .msg-body {
          line-height: 1.6;
        }
        /* Markdown content styles */
        .md-content :global(h1),
        .md-content :global(h2),
        .md-content :global(h3) {
          margin: 0.8rem 0 0.4rem;
          font-weight: 600;
          color: var(--text);
        }
        .md-content :global(h1) { font-size: 1.1rem; }
        .md-content :global(h2) { font-size: 1rem; }
        .md-content :global(h3) { font-size: 0.95rem; }
        .md-content :global(p) {
          margin: 0.4rem 0;
        }
        .md-content :global(ul),
        .md-content :global(ol) {
          margin: 0.4rem 0;
          padding-left: 1.5rem;
        }
        .md-content :global(li) {
          margin: 0.2rem 0;
        }
        .md-content :global(strong) {
          color: var(--text);
          font-weight: 600;
        }
        .md-content :global(a) {
          color: var(--accent);
          text-decoration: none;
        }
        .md-content :global(a:hover) {
          text-decoration: underline;
        }
        .md-content :global(hr) {
          border: none;
          border-top: 1px solid var(--border);
          margin: 0.8rem 0;
        }
        .md-content :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 0.6rem 0;
          font-size: 0.85rem;
        }
        .md-content :global(th),
        .md-content :global(td) {
          border: 1px solid var(--border);
          padding: 0.4rem 0.6rem;
          text-align: left;
        }
        .md-content :global(th) {
          background: rgba(255,255,255,0.05);
          font-weight: 600;
        }
        .md-content :global(code) {
          background: rgba(255,255,255,0.08);
          padding: 0.15rem 0.35rem;
          border-radius: 4px;
          font-size: 0.85em;
          font-family: var(--font-mono);
        }
        .md-content :global(pre) {
          background: rgba(0,0,0,0.3);
          padding: 0.75rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.5rem 0;
        }
        .md-content :global(pre code) {
          background: none;
          padding: 0;
        }
        .md-content :global(blockquote) {
          border-left: 3px solid var(--accent-dim);
          margin: 0.5rem 0;
          padding: 0.3rem 0.8rem;
          color: var(--text-muted);
        }
        .msg-cites {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .chat-error {
          margin: 0;
          padding: 0.5rem 1.15rem;
          font-size: 0.85rem;
          color: var(--danger);
          border-top: 1px solid var(--border);
        }
        .chat-form {
          display: flex;
          gap: 0.5rem;
          padding: 0.85rem 1.15rem;
          border-top: 1px solid var(--border);
          background: rgba(0, 0, 0, 0.2);
        }
        .chat-input {
          flex: 1;
          padding: 0.65rem 0.85rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-input);
          color: var(--text);
          outline: none;
        }
        .chat-input:focus {
          border-color: var(--accent);
        }
        .chat-send {
          padding: 0.65rem 1rem;
          border: none;
          border-radius: var(--radius);
          background: var(--accent);
          color: #061018;
          font-weight: 600;
        }
        .chat-send:hover:not(:disabled) {
          background: #5aadf5;
        }
      `}</style>
    </section>
  );
}
