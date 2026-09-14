"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CitationCard, type Citation } from "./CitationCard";
import { WelcomeScreen } from "./WelcomeScreen";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type ChatMessage = {
  id: string;
  dbId?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  rating?: "up" | "down" | null;
  standaloneQuery?: string;
};

type Props = {
  siteId: string | null;
  sessionId: string | null;
  onSessionId: (id: string) => void;
  siteTitle?: string | null;
  starterQuestions?: string[] | null;
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

export function ChatWindow({
  siteId,
  sessionId,
  onSessionId,
  siteTitle,
  starterQuestions,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [language, setLanguage] = useState<string>("auto");
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  function cleanMarkdownForSpeech(text: string): string {
    return text
      .replace(/<thinking>[\s\S]*?<\/thinking>/gi, "")
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\[\^?\d+\]/g, "")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
      .replace(/[*_~#]/g, "")
      .replace(/\n+/g, " ")
      .trim();
  }

  function toggleSpeak(msgId: string, content: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      alert("Text-to-speech is not supported by your browser.");
      return;
    }

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const cleanText = cleanMarkdownForSpeech(content);
    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voices = window.speechSynthesis.getVoices();

    if (language === "Tamil") {
      const v = voices.find((v) => v.lang.startsWith("ta"));
      if (v) utterance.voice = v;
    } else if (language === "Hindi") {
      const v = voices.find((v) => v.lang.startsWith("hi"));
      if (v) utterance.voice = v;
    } else if (language === "Spanish") {
      const v = voices.find((v) => v.lang.startsWith("es"));
      if (v) utterance.voice = v;
    } else if (language === "French") {
      const v = voices.find((v) => v.lang.startsWith("fr"));
      if (v) utterance.voice = v;
    } else {
      const v = voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural")));
      if (v) utterance.voice = v;
    }

    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  }

  function toggleListening() {
    if (typeof window === "undefined") return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari.");
      return;
    }

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;

      if (language === "Tamil") recognition.lang = "ta-IN";
      else if (language === "Hindi") recognition.lang = "hi-IN";
      else if (language === "Spanish") recognition.lang = "es-ES";
      else if (language === "French") recognition.lang = "fr-FR";
      else recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((r: any) => r[0].transcript)
          .join("");
        setInput(transcript);
      };

      recognition.onerror = (event: any) => {
        console.warn("[speech recognition error]", event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("[speech recognition start error]", err);
      setIsListening(false);
    }
  }

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
          body: JSON.stringify({ question: question.trim(), siteId, sessionId, language: language === "auto" ? null : language }),
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
                  m.id === assistantId
                    ? {
                        ...m,
                        citations: payload.citations,
                        standaloneQuery: payload.standaloneQuery,
                      }
                    : m
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
            } else if (payload.type === "done") {
              if (payload.sessionId) onSessionId(payload.sessionId);
              if (payload.messageId) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, dbId: payload.messageId } : m
                  )
                );
              }
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

  async function handleRateMessage(msgId: string, rating: "up" | "down") {
    const target = messages.find((m) => m.id === msgId);
    if (!target) return;
    const newRating = target.rating === rating ? null : rating;
    setMessages((prev) =>
      prev.map((m) => (m.id === msgId ? { ...m, rating: newRating } : m))
    );

    if (target.dbId) {
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: target.dbId, rating: newRating }),
        });
      } catch (err) {
        console.error("[feedback error]", err);
      }
    }
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
            starterQuestions={starterQuestions}
          />
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`msg msg-${m.role}`}>
              {m.role === "assistant" && m.standaloneQuery && (
                <div className="msg-search-chip" title="Follow-up query resolved using conversation context">
                  <svg className="search-chip-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75">
                    <circle cx="7" cy="7" r="4.5" />
                    <path d="M10.5 10.5L14 14" strokeLinecap="round" />
                  </svg>
                  <span>Contextual query: <strong>{m.standaloneQuery}</strong></span>
                </div>
              )}
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
              {m.role === "assistant" && m.content && (
                <div className="msg-actions-row">
                  <div className="feedback-group">
                    <button
                      type="button"
                      className={`speak-pill ${speakingMsgId === m.id ? "active-speaking" : ""}`}
                      onClick={() => toggleSpeak(m.id, m.content)}
                      title={speakingMsgId === m.id ? "Stop reading aloud" : "Read aloud (Voice)"}
                    >
                      {speakingMsgId === m.id ? (
                        <>
                          <span className="speaking-waves">
                            <span className="sw-bar" />
                            <span className="sw-bar" />
                            <span className="sw-bar" />
                          </span>
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <span>🔊</span>
                          <span>Listen</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className={`feedback-pill ${m.rating === "up" ? "active-up" : ""}`}
                      onClick={() => handleRateMessage(m.id, "up")}
                      title="Good response"
                    >
                      👍
                    </button>
                    <button
                      type="button"
                      className={`feedback-pill ${m.rating === "down" ? "active-down" : ""}`}
                      onClick={() => handleRateMessage(m.id, "down")}
                      title="Inaccurate or unhelpful"
                    >
                      👎
                    </button>
                    {m.rating && (
                      <span className="feedback-toast">
                        {m.rating === "up" ? "Thanks for feedback!" : "Feedback recorded"}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {m.citations && m.citations.length > 0 && !m.content.includes("I couldn't find that in the source.") && (
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
        <select 
          className="chat-language-select" 
          value={language} 
          onChange={(e) => setLanguage(e.target.value)}
          disabled={!ready || streaming}
          title="Select AI Response Language"
        >
          <option value="auto">🌐 Auto</option>
          <option value="English">🇬🇧 EN</option>
          <option value="Spanish">🇪🇸 ES</option>
          <option value="French">🇫🇷 FR</option>
          <option value="Hindi">🇮🇳 HI</option>
          <option value="Tamil">🇮🇳 TA</option>
        </select>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isListening
              ? "🎙️ Listening... speak your question now"
              : ready
              ? "Ask about this site…"
              : "Index a page first"
          }
          disabled={!ready || streaming}
          className={`chat-input ${isListening ? "is-listening" : ""}`}
        />
        <button
          type="button"
          onClick={toggleListening}
          disabled={!ready || streaming}
          className={`chat-mic-btn ${isListening ? "listening" : ""}`}
          title={isListening ? "Stop voice listening" : "Speak question (Voice input)"}
        >
          {isListening ? (
            <span className="mic-pulse-ring">
              <span className="mic-dot" />
            </span>
          ) : (
            "🎙️"
          )}
        </button>
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

        .msg-search-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: var(--text-muted);
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 2px 7px;
          margin-bottom: 5px;
          font-family: var(--font-mono, monospace);
        }
        .search-chip-icon {
          width: 11px;
          height: 11px;
          color: var(--accent);
          flex-shrink: 0;
        }
        .msg-search-chip strong {
          color: var(--text);
          font-weight: 500;
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

        .msg-actions-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.35rem;
          padding-left: 0.25rem;
        }

        .feedback-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .feedback-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          width: 26px;
          height: 26px;
          border-radius: 6px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          opacity: 0.65;
        }
        .feedback-pill:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.1);
          transform: scale(1.05);
        }

        .feedback-pill.active-up {
          opacity: 1;
          background: rgba(52, 211, 153, 0.15);
          border-color: rgba(52, 211, 153, 0.4);
          color: #34d399;
        }

        .feedback-pill.active-down {
          opacity: 1;
          background: rgba(248, 113, 113, 0.15);
          border-color: rgba(248, 113, 113, 0.4);
          color: #f87171;
        }

        .speak-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text-muted);
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .speak-pill:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
        }
        .speak-pill.active-speaking {
          color: #38bdf8;
          background: rgba(56, 189, 248, 0.15);
          border-color: rgba(56, 189, 248, 0.4);
        }

        .speaking-waves {
          display: flex;
          align-items: center;
          gap: 2px;
          height: 10px;
        }
        .sw-bar {
          width: 2px;
          height: 8px;
          background: #38bdf8;
          border-radius: 1px;
          animation: waveScale 0.6s ease-in-out infinite alternate;
        }
        .sw-bar:nth-child(2) { animation-delay: 0.2s; height: 12px; }
        .sw-bar:nth-child(3) { animation-delay: 0.4s; height: 6px; }

        @keyframes waveScale {
          0% { transform: scaleY(0.4); }
          100% { transform: scaleY(1.2); }
        }

        .chat-mic-btn {
          width: 42px;
          height: 42px;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-input);
          color: var(--text);
          font-size: 1.15rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.18s ease;
          position: relative;
        }
        .chat-mic-btn:hover:not(:disabled) {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(255, 255, 255, 0.05);
        }
        .chat-mic-btn.listening {
          background: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
          color: #ef4444;
          box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
        }

        .mic-pulse-ring {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mic-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          animation: micPulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes micPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            transform: scale(1.25);
            box-shadow: 0 0 0 6px rgba(239, 68, 68, 0);
          }
        }

        .chat-input.is-listening {
          border-color: #ef4444;
          background: rgba(239, 68, 68, 0.04);
          box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2);
        }

        .feedback-toast {
          font-size: 0.72rem;
          color: #94a3b8;
          margin-left: 4px;
          animation: fadeUp 0.15s ease both;
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
        .chat-language-select {
          padding: 0.7rem;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          background: var(--bg-input);
          color: var(--text);
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
        }
        .chat-language-select:focus {
          border-color: var(--accent);
          box-shadow: 0 0 0 2px var(--accent-soft);
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
