"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CitationCard, type Citation } from "./CitationCard";
import { WelcomeScreen } from "./WelcomeScreen";
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      className="copy-btn"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      title="Copy response"
    >
      {copied ? "✓" : "⎘"}

      <style jsx>{`
        .copy-btn {
          position: absolute;
          top: 0.5rem;
          right: 0.5rem;
          border: 1px solid var(--border);
          background: var(--bg);
          color: var(--text-muted);
          width: 28px;
          height: 28px;
          border-radius: 6px;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          transition: all 0.15s ease;
        }
        .copy-btn:hover {
          color: var(--accent);
          border-color: var(--accent);
        }
      `}</style>
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="typing">
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />

      <style jsx>{`
        .typing {
          display: flex;
          gap: 4px;
          padding: 0.75rem 1rem;
        }
        .typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--text-muted);
          animation: bounce 1.4s ease-in-out infinite both;
        }
        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }
        .typing-dot:nth-child(3) { animation-delay: 0s; }
      `}</style>
    </div>
  );
}

export function ChatWindow({ siteId, sessionId, onSessionId, siteTitle }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  useEffect(() => {
    setMessages([]);
    setError(null);
  }, [siteId]);

  function submitQuestion(question: string) {
    if (!siteId || streaming || !question.trim()) return;

    setInput("");
    setError(null);
    setStreaming(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question.trim(),
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: assistantId, role: "assistant", content: "" },
    ]);

    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim(), siteId, sessionId }),
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
            const payload = JSON.parse(line.slice(6));

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
        inputRef.current?.focus();
      }
    })();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submitQuestion(input);
  }

  const ready = Boolean(siteId);

  return (
    <section className="chat">
      <div className="chat-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <WelcomeScreen
            siteName={siteTitle || "this site"}
            onSuggest={(q) => submitQuestion(q)}
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`msg msg-${m.role}`}>
              <div className="msg-bubble">
                {m.role === "assistant" && m.content && <CopyButton text={m.content} />}
                {m.role === "assistant" ? (
                  m.content ? (
                    <div className="md-content">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  ) : streaming ? (
                    <TypingIndicator />
                  ) : null
                ) : (
                  m.content
                )}
              </div>
              {m.citations && m.citations.length > 0 && (
                <div className="msg-citations">
                  {m.citations.map((c) => (
                    <CitationCard key={c.chunkId} citation={c} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="chat-error">{error}</p>}

      <form onSubmit={handleSubmit} className="chat-form">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={ready ? "Ask about this site…" : "Index a page first"}
          disabled={!ready || streaming}
          className="chat-input"
        />
        <button
          type="submit"
          disabled={!ready || streaming || !input.trim()}
          className="chat-send"
        >
          {streaming ? "…" : "→"}
        </button>
      </form>

      <style jsx>{`
        .chat {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        /* Message layout */
        .msg {
          display: flex;
          flex-direction: column;
          max-width: 85%;
          animation: fadeUp 0.2s ease both;
        }
        .msg-user {
          align-self: flex-end;
          align-items: flex-end;
        }
        .msg-assistant {
          align-self: flex-start;
          align-items: flex-start;
        }

        .msg-bubble {
          position: relative;
          padding: 0.7rem 1rem;
          border-radius: 14px;
          font-size: 0.9rem;
          line-height: 1.55;
          word-break: break-word;
        }
        .msg-user .msg-bubble {
          background: var(--accent);
          color: #fff;
          border-bottom-right-radius: 4px;
        }
        .msg-assistant .msg-bubble {
          background: var(--glass-bg);
          backdrop-filter: blur(8px);
          border: 1px solid var(--glass-border);
          border-bottom-left-radius: 4px;
          color: var(--text);
        }
        .msg-assistant .msg-bubble:hover :global(.copy-btn) {
          opacity: 1;
        }

        .msg-citations {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.4rem;
          padding-left: 0.25rem;
        }

        /* Markdown */
        .md-content :global(h1),
        .md-content :global(h2),
        .md-content :global(h3) {
          margin: 0.6rem 0 0.3rem;
          font-weight: 600;
          color: var(--text);
        }
        .md-content :global(h1) { font-size: 1.05rem; }
        .md-content :global(h2) { font-size: 0.98rem; }
        .md-content :global(h3) { font-size: 0.92rem; }
        .md-content :global(p) { margin: 0.35rem 0; }
        .md-content :global(ul), .md-content :global(ol) {
          margin: 0.3rem 0;
          padding-left: 1.4rem;
        }
        .md-content :global(li) { margin: 0.15rem 0; }
        .md-content :global(strong) { color: var(--text); font-weight: 600; }
        .md-content :global(a) { color: var(--accent); }
        .md-content :global(a:hover) { text-decoration: underline; }
        .md-content :global(code) {
          background: rgba(255,255,255,0.08);
          padding: 0.12rem 0.3rem;
          border-radius: 4px;
          font-size: 0.84em;
          font-family: var(--font-mono);
        }
        .md-content :global(pre) {
          background: rgba(0,0,0,0.35);
          padding: 0.75rem;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.4rem 0;
        }
        .md-content :global(pre code) { background: none; padding: 0; }
        .md-content :global(blockquote) {
          border-left: 3px solid var(--accent-dim);
          margin: 0.4rem 0;
          padding: 0.25rem 0.75rem;
          color: var(--text-muted);
        }
        .md-content :global(table) {
          width: 100%;
          border-collapse: collapse;
          margin: 0.5rem 0;
          font-size: 0.84rem;
        }
        .md-content :global(th), .md-content :global(td) {
          border: 1px solid var(--border);
          padding: 0.35rem 0.5rem;
        }
        .md-content :global(th) {
          background: rgba(255,255,255,0.04);
          font-weight: 600;
        }

        /* Form */
        .chat-error {
          margin: 0;
          padding: 0.5rem 1.15rem;
          font-size: 0.82rem;
          color: var(--danger);
          border-top: 1px solid var(--border);
        }
        .chat-form {
          display: flex;
          gap: 0.5rem;
          padding: 0.85rem 1.15rem;
          border-top: 1px solid var(--border);
          background: rgba(0, 0, 0, 0.15);
        }
        .chat-input {
          flex: 1;
          padding: 0.7rem 0.9rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-input);
          color: var(--text);
          outline: none;
          transition: border-color 0.15s ease;
        }
        .chat-input:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-soft);
        }
        .chat-send {
          width: 42px;
          height: 42px;
          border: none;
          border-radius: var(--radius);
          background: var(--accent);
          color: #fff;
          font-size: 1.1rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s ease;
        }
        .chat-send:hover:not(:disabled) {
          opacity: 0.85;
        }
      `}</style>
    </section>
  );
}
