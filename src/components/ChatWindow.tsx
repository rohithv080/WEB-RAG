"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { CitationCard, type Citation } from "./CitationCard";
import { WelcomeScreen } from "./WelcomeScreen";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { SourceInspectModal } from "./SourceInspectModal";
import { useAppStore } from "@/lib/store/useAppStore";

export type ChatMessage = {
  id: string;
  dbId?: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  rating?: "up" | "down" | null;
  standaloneQuery?: string;
  latencyMs?: number;
  isWebFallback?: boolean;
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
      {copied ? "✓ Copied" : "⎘ Copy"}

      <style jsx>{`
        .copy-btn {
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.04);
          color: #94a3b8;
          padding: 2px 7px;
          border-radius: 5px;
          font-size: 0.7rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-left: auto;
        }
        .copy-btn:hover {
          color: #ffffff;
          border-color: rgba(255, 255, 255, 0.18);
          background: rgba(255, 255, 255, 0.08);
        }
      `}</style>
    </button>
  );
}

function TypingIndicator() {
  return (
    <div className="typing-state-wrapper">
      <div className="typing-dots-pill">
        <span className="typing-dot" />
        <span className="typing-dot" />
        <span className="typing-dot" />
      </div>
      <span className="typing-label">Searching indexed vectors & reasoning…</span>

      <style jsx>{`
        .typing-state-wrapper {
          display: flex;
          align-items: center;
          gap: 9px;
          padding: 0.35rem 0.1rem;
        }
        .typing-dots-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--accent);
          animation: bounce 1.4s ease-in-out infinite both;
        }
        .typing-dot:nth-child(1) {
          animation-delay: -0.32s;
        }
        .typing-dot:nth-child(2) {
          animation-delay: -0.16s;
        }
        .typing-dot:nth-child(3) {
          animation-delay: 0s;
        }
        @keyframes bounce {
          0%,
          80%,
          100% {
            transform: scale(0.6);
            opacity: 0.4;
          }
          40% {
            transform: scale(1.15);
            opacity: 1;
          }
        }
        .typing-label {
          color: #94a3b8;
          font-size: 0.78rem;
          font-style: italic;
          animation: pulse-typing-text 2s ease-in-out infinite;
        }
        @keyframes pulse-typing-text {
          0%,
          100% {
            opacity: 0.55;
          }
          50% {
            opacity: 0.95;
          }
        }
      `}</style>
    </div>
  );
}

export function ChatWindow({ siteId, sessionId, onSessionId, siteTitle, starterQuestions }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [inspectingCitation, setInspectingCitation] = useState<Citation | null>(null);

  const language = useAppStore((s) => s.selectedLanguage);
  const setLanguage = useAppStore((s) => s.setSelectedLanguage);
  const [isListening, setIsListening] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const currentSessionIdRef = useRef<string | null>(sessionId);
  const prevSiteIdRef = useRef<string | null>(siteId);

  function handleScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setIsUserScrolledUp(distanceFromBottom > 80);
  }

  function scrollToBottom() {
    setIsUserScrolledUp(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
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
      const v = voices.find(
        (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural"))
      );
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
      alert(
        "Speech recognition is not supported in this browser. Please use Google Chrome, Edge, or Safari."
      );
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
        if (inputRef.current) {
          inputRef.current.style.height = "auto";
          inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 160)}px`;
        }
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
      console.warn("[speech recognition failed]", err);
      setIsListening(false);
    }
  }

  // Load existing session messages if sessionId is passed
  useEffect(() => {
    // If sessionId matches what we already have loaded / active in this window, skip refetching
    if (sessionId && sessionId === currentSessionIdRef.current && messages.length > 0) {
      return;
    }

    currentSessionIdRef.current = sessionId;

    if (!sessionId) {
      setMessages([]);
      setLoadingSession(false);
      return;
    }

    let isMounted = true;
    setLoadingSession(true);

    fetch(`/api/sessions/${sessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Failed to load session (HTTP ${res.status})`);
        }
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        const msgList = Array.isArray(data.messages)
          ? data.messages
          : Array.isArray(data.session?.messages)
            ? data.session.messages
            : [];

        if (msgList.length > 0) {
          const loaded: ChatMessage[] = msgList.map((m: any) => ({
            id: m.id,
            dbId: m.id,
            role: m.role as "user" | "assistant",
            content: m.content,
            citations: (m.citations as Citation[]) || undefined,
            rating: m.rating || null,
            latencyMs: m.latencyMs || undefined,
            isWebFallback: Boolean(m.isWebFallback),
          }));
          setMessages(loaded);
        } else {
          setMessages([]);
        }
      })
      .catch((err) => {
        console.warn("[session load error]", err);
      })
      .finally(() => {
        if (isMounted) setLoadingSession(false);
      });

    return () => {
      isMounted = false;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!isUserScrolledUp) {
      scrollToBottom();
    }
  }, [messages, streaming]);

  useEffect(() => {
    // Only reset state if siteId actually changed
    if (prevSiteIdRef.current !== siteId) {
      prevSiteIdRef.current = siteId;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setStreaming(false);
      }
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        setSpeakingMsgId(null);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        setIsListening(false);
      }
      setInput("");
      setError(null);
      setMessages([]);
      currentSessionIdRef.current = null;
    }
    inputRef.current?.focus();
  }, [siteId]);

  function handleStopGenerating() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setStreaming(false);
    }
  }

  function handleExportTranscript() {
    if (messages.length === 0) return;
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const title = siteTitle || "Knowledge Base";

    let md = `# Conversation Transcript — ${title}\n`;
    md += `**Date:** ${now.toLocaleString()}\n`;
    if (sessionId) md += `**Session ID:** \`${sessionId}\`\n`;
    md += `\n---\n\n`;

    for (const m of messages) {
      const speaker = m.role === "user" ? "### 👤 User" : "### 🤖 Assistant";
      md += `${speaker}\n\n${m.content.trim()}\n\n`;

      if (m.role === "assistant" && m.citations && m.citations.length > 0) {
        md += `**Sources:**\n`;
        for (const c of m.citations) {
          md += `- [${c.index}] [${c.heading || c.pageUrl}](${c.pageUrl})\n`;
        }
        md += `\n`;
      }
      md += `---\n\n`;
    }

    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript-${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}-${timestamp}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function submitQuestion(question: string) {
    if (!question.trim() || !siteId || streaming) return;

    setError(null);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStreaming(true);

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question.trim(),
    };
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "" }]);

    // 0ms instant scroll to anchored response
    setIsUserScrolledUp(false);
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    });

    (async () => {
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.trim(),
            siteId,
            sessionId,
            language: language === "auto" ? null : language,
          }),
          signal: controller.signal,
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
              if (payload.sessionId) {
                currentSessionIdRef.current = payload.sessionId;
                onSessionId(payload.sessionId);
              }
              citations = payload.citations;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        citations: payload.citations,
                        standaloneQuery: payload.standaloneQuery,
                        latencyMs: payload.latencyMs,
                        dbId: payload.messageId || payload.assistantMessageId,
                        isWebFallback: Boolean(payload.isWebFallback),
                      }
                    : m
                )
              );
            } else if (payload.type === "token" || payload.type === "chunk") {
              const tokenText = payload.content ?? payload.text ?? "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + tokenText } : m
                )
              );
            } else if (payload.type === "done") {
              const msgId = payload.messageId || payload.assistantMessageId;
              const latency = payload.latencyMs;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        dbId: msgId || m.dbId,
                        latencyMs: latency || m.latencyMs,
                        isWebFallback:
                          payload.isWebFallback !== undefined
                            ? Boolean(payload.isWebFallback)
                            : m.isWebFallback,
                      }
                    : m
                )
              );
            } else if (payload.type === "error") {
              throw new Error(payload.error || "Streaming error");
            }
          }
        }

        if (citations) {
          setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, citations } : m)));
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          console.log("[chat] user aborted response stream");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: m.content
                      ? m.content + "\n\n*(Response stopped by user)*"
                      : "*(Response stopped by user)*",
                  }
                : m
            )
          );
        } else {
          console.error("[chat error]", err);
          setError(err.message || "Something went wrong.");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content:
                      m.content || `⚠️ ${err.message || "Something went wrong. Please try again."}`,
                  }
                : m
            )
          );
        }
      } finally {
        setStreaming(false);
        abortControllerRef.current = null;
        inputRef.current?.focus();
      }
    })();
  }

  async function handleRateMessage(msgId: string, rating: "up" | "down") {
    const target = messages.find((m) => m.id === msgId);
    if (!target) return;
    const newRating = target.rating === rating ? null : rating;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating: newRating } : m)));

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (ready && !streaming && input.trim()) {
        submitQuestion(input);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  const ready = Boolean(siteId);

  return (
    <section className="chat">
      <div
        className="chat-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        <div className="chat-thread-container">
          {loadingSession && messages.length === 0 ? (
            <div className="session-restoring-state">
              <div className="restoring-spinner" />
              <p className="restoring-text">Restoring conversation history…</p>
            </div>
          ) : messages.length === 0 ? (
            <WelcomeScreen
              siteName={siteTitle || "this site"}
              onSuggest={(q) => submitQuestion(q)}
              starterQuestions={starterQuestions}
            />
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`msg msg-${m.role}`}>
                {m.role === "user" ? (
                  <div className="msg-user-wrapper">
                    <div className="msg-user-bubble">{m.content}</div>
                  </div>
                ) : (
                  <div className="msg-assistant-card">
                    <div className="assistant-header">
                      <div className="assistant-avatar-badge">
                        <span className="avatar-icon">✦</span>
                      </div>
                      <div className="assistant-title-meta">
                        <span className="assistant-name">{siteTitle || "Knowledge Assistant"}</span>
                        <span className="assistant-model-pill">Llama 3.3 70B</span>
                        {m.isWebFallback && (
                          <span
                            className="assistant-web-badge"
                            title="Specific details were not found in local site documents; answer is grounded in live web search"
                          >
                            <span className="web-pulse-dot" />
                            🌐 Live Web Grounded
                          </span>
                        )}
                      </div>
                      {m.content && <CopyButton text={m.content} />}
                    </div>

                    {m.standaloneQuery && (
                      <div
                        className="msg-search-chip"
                        title="Follow-up query resolved using conversation context"
                      >
                        <svg
                          className="search-chip-icon"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.75"
                        >
                          <circle cx="7" cy="7" r="4.5" />
                          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
                        </svg>
                        <span>
                          Contextual query: <strong>{m.standaloneQuery}</strong>
                        </span>
                      </div>
                    )}

                    <div className="msg-bubble-content">
                      {m.content ? (
                        <div className="md-content">
                          <MarkdownRenderer
                            content={m.content}
                            isStreaming={streaming && m.id === messages[messages.length - 1]?.id}
                            citations={m.citations}
                            onInspectCitation={(c) => setInspectingCitation(c)}
                          />
                        </div>
                      ) : streaming && m.id === messages[messages.length - 1]?.id ? (
                        <TypingIndicator />
                      ) : (
                        <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "0.82rem" }}>
                          *(No response generated)*
                        </div>
                      )}
                    </div>

                    {m.content && (
                      <div className="msg-actions-row">
                        <div className="feedback-group">
                          <button
                            type="button"
                            className={`speak-pill ${speakingMsgId === m.id ? "active-speaking" : ""}`}
                            onClick={() => toggleSpeak(m.id, m.content)}
                            title={
                              speakingMsgId === m.id ? "Stop reading aloud" : "Read aloud (Voice)"
                            }
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

                        <div className="perf-pills-group">
                          {m.latencyMs && (
                            <span
                              className="perf-chip"
                              title="Serverless RAG retrieval + generation latency"
                            >
                              ⚡{" "}
                              {m.latencyMs < 1000
                                ? `${m.latencyMs}ms`
                                : `${(m.latencyMs / 1000).toFixed(1)}s`}
                            </span>
                          )}
                          {m.citations &&
                            m.citations.length > 0 &&
                            !m.content.includes("I couldn't find that in the source.") &&
                            (m.isWebFallback ? (
                              <span
                                className="perf-chip web-chip"
                                title="Grounded in real-time live web search results"
                              >
                                🌐 {m.citations.length} web{" "}
                                {m.citations.length === 1 ? "source" : "sources"}
                              </span>
                            ) : (
                              <span
                                className="perf-chip verified-chip"
                                title="Verified against indexed document chunks"
                              >
                                🛡️ {m.citations.length}{" "}
                                {m.citations.length === 1 ? "source" : "sources"}
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {m.citations &&
                      m.citations.length > 0 &&
                      !m.content.includes("I couldn't find that in the source.") && (
                        <div className="msg-citations-block">
                          <span className="citations-header-label">
                            {m.isWebFallback ? "🌐 Live Web Sources" : "Verified Sources"}
                          </span>
                          <div className="msg-citations-tray">
                            {m.citations.map((c) => (
                              <CitationCard
                                key={c.chunkId}
                                citation={c}
                                query={
                                  m.standaloneQuery ||
                                  messages
                                    .slice(0, messages.indexOf(m))
                                    .reverse()
                                    .find((x) => x.role === "user")?.content ||
                                  ""
                                }
                              />
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            ))
          )}

          {loadingSession && messages.length > 0 && (
            <div className="session-loading-banner">
              <span className="session-spinner" />
              <span>Restoring conversation history…</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {isUserScrolledUp && (
        <button
          type="button"
          className="scroll-to-bottom-btn"
          onClick={scrollToBottom}
          title="Scroll to latest response"
        >
          <span>Scroll to bottom</span>
          <span className="scroll-arrow">↓</span>
        </button>
      )}

      {/* Floating Command Dock */}
      <div className="chat-dock-wrapper">
        <form onSubmit={handleSubmit} className="chat-dock-form">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? "🎙️ Listening... speak your question now"
                : ready
                  ? `Ask ${siteTitle ? `about ${siteTitle}` : "a question"}…`
                  : "Index a page first"
            }
            disabled={!ready || streaming}
            className={`dock-textarea ${isListening ? "is-listening" : ""}`}
          />

          <div className="dock-toolbar">
            <div className="dock-tools-left">
              <select
                className="dock-language-select"
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

              <button
                type="button"
                onClick={toggleListening}
                disabled={!ready || streaming}
                className={`dock-tool-btn ${isListening ? "listening" : ""}`}
                title={isListening ? "Stop voice listening" : "Speak question (Voice input)"}
              >
                {isListening ? (
                  <span className="mic-pulse-ring">
                    <span className="mic-dot" />
                  </span>
                ) : (
                  <span>🎙️</span>
                )}
              </button>

              {messages.length > 0 && !streaming && (
                <button
                  type="button"
                  className="dock-transcript-pill"
                  onClick={handleExportTranscript}
                  title="Export conversation as Markdown transcript"
                >
                  <span>📥 Export (.md)</span>
                </button>
              )}
            </div>

            <div className="dock-tools-right">
              {streaming ? (
                <button
                  type="button"
                  className="dock-stop-btn"
                  onClick={handleStopGenerating}
                  title="Stop generating response"
                >
                  <span className="stop-sq">■</span>
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!ready || !input.trim()}
                  className="dock-send-btn"
                  title="Send question (Enter)"
                >
                  <span className="send-arrow">↑</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      {error && <p className="chat-error">{error}</p>}

      {inspectingCitation && (
        <SourceInspectModal
          citation={inspectingCitation}
          onClose={() => setInspectingCitation(null)}
        />
      )}

      <style jsx>{`
        .chat {
          position: relative;
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background:
            radial-gradient(circle at 50% 0%, rgba(30, 34, 48, 0.3) 0%, transparent 65%), #090a0f;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1.5rem 1rem 7.5rem 1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          scroll-behavior: smooth;
        }

        .chat-thread-container {
          width: 100%;
          max-width: 820px;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Message layout */
        .msg {
          display: flex;
          flex-direction: column;
          width: 100%;
          animation: fadeUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .msg-user {
          align-items: flex-end;
        }
        .msg-user-wrapper {
          max-width: 78%;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .msg-user-bubble {
          position: relative;
          padding: 0.75rem 1.15rem;
          border-radius: var(--radius-lg) var(--radius-lg) var(--radius-sm) var(--radius-lg);
          font-size: 0.92rem;
          line-height: 1.55;
          word-break: break-word;
          white-space: pre-wrap;
          background: var(--accent);
          border: 1px solid transparent;
          color: #ffffff;
          box-shadow: 0 2px 10px rgba(0, 102, 204, 0.25);
        }

        .msg-assistant {
          align-items: flex-start;
        }
        .msg-assistant-card {
          position: relative;
          width: 100%;
          background: var(--bg-card);
          backdrop-filter: blur(16px);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-lg) var(--radius-lg) var(--radius-lg) var(--radius-sm);
          padding: 1.15rem 1.35rem;
          box-shadow: var(--shadow-sm);
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .msg-assistant-card:hover {
          border-color: var(--border-focus);
          box-shadow: var(--shadow-md);
        }

        .assistant-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-subtle);
        }
        .assistant-avatar-badge {
          width: 24px;
          height: 24px;
          border-radius: var(--radius-sm);
          background: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          font-size: 0.72rem;
          box-shadow: 0 1px 4px rgba(0, 102, 204, 0.3);
        }
        .avatar-icon {
          line-height: 1;
        }
        .assistant-title-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }
        .assistant-name {
          font-size: 0.84rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .assistant-model-pill {
          font-size: 0.68rem;
          color: var(--accent);
          background: var(--accent-subtle);
          border: 1px solid var(--accent-dim);
          padding: 1px 6px;
          border-radius: var(--radius-sm);
          font-weight: 600;
          font-family: var(--font-mono, monospace);
        }

        .assistant-web-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 1px 8px;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 9999px;
          color: #10b981;
          font-size: 0.68rem;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .web-pulse-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 5px rgba(16, 185, 129, 0.5);
          animation: web-pulse 1.8s ease-in-out infinite;
        }

        @keyframes web-pulse {
          0%,
          100% {
            opacity: 0.4;
            transform: scale(0.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        .perf-chip.web-chip {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.2);
          color: #10b981;
        }

        .msg-search-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: var(--text-secondary);
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-sm);
          padding: 2px 7px;
          font-family: var(--font-mono, monospace);
          width: fit-content;
        }
        .search-chip-icon {
          width: 11px;
          height: 11px;
          color: var(--accent);
          flex-shrink: 0;
        }
        .msg-search-chip strong {
          color: #f1f5f9;
          font-weight: 500;
        }

        .msg-bubble-content {
          font-size: 0.91rem;
          line-height: 1.6;
          color: #e2e8f0;
          word-break: break-word;
        }

        .msg-actions-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          margin-top: 0.2rem;
        }

        .feedback-group {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .feedback-pill {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
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
          color: #94a3b8;
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
        .sw-bar:nth-child(2) {
          animation-delay: 0.2s;
          height: 12px;
        }
        .sw-bar:nth-child(3) {
          animation-delay: 0.4s;
          height: 6px;
        }

        @keyframes waveScale {
          0% {
            transform: scaleY(0.4);
          }
          100% {
            transform: scaleY(1.2);
          }
        }

        .feedback-toast {
          font-size: 0.72rem;
          color: #94a3b8;
          margin-left: 4px;
          animation: fadeUp 0.15s ease both;
        }

        .perf-pills-group {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }
        .perf-chip {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 7px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 4px;
          font-size: 0.68rem;
          color: #94a3b8;
          font-family: var(--font-mono, monospace);
          letter-spacing: 0.02em;
        }
        .perf-chip.verified-chip {
          color: #34d399;
          border-color: rgba(52, 211, 153, 0.2);
          background: rgba(52, 211, 153, 0.06);
        }

        .msg-citations-block {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 0.35rem;
          padding-top: 0.65rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
        }
        .citations-header-label {
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #64748b;
        }
        .msg-citations-tray {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .scroll-to-bottom-btn {
          position: absolute;
          bottom: 100px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          border-radius: 20px;
          color: var(--text-primary);
          font-size: 0.78rem;
          font-weight: 500;
          box-shadow: var(--shadow-md);
          cursor: pointer;
          z-index: 10;
          transition: all 0.2s ease;
          animation: bounceIn 0.25s ease both;
        }
        .scroll-to-bottom-btn:hover {
          background: var(--bg-hover);
          border-color: var(--accent);
          transform: translateX(-50%) translateY(-2px);
        }
        .scroll-arrow {
          font-size: 0.85rem;
          color: var(--accent);
        }

        /* Floating Command Dock */
        .chat-dock-wrapper {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          padding: 0 1rem 1.25rem 1rem;
          background: linear-gradient(to top, var(--bg-surface) 60%, transparent 100%);
          pointer-events: none;
          z-index: 15;
        }
        .chat-dock-form {
          width: 100%;
          max-width: 820px;
          pointer-events: auto;
          background: var(--bg-card);
          border: 1px solid var(--border-default);
          backdrop-filter: blur(24px);
          border-radius: var(--radius-lg);
          box-shadow:
            var(--shadow-lg),
            0 0 0 1px var(--border-subtle);
          padding: 0.75rem 0.95rem 0.65rem 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          transition:
            border-color 0.2s ease,
            box-shadow 0.2s ease;
        }
        .chat-dock-form:focus-within {
          border-color: var(--accent);
          box-shadow:
            var(--shadow-lg),
            0 0 0 1px var(--accent-dim);
        }

        .dock-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          font-family: inherit;
          font-size: 0.92rem;
          line-height: 1.5;
          color: #f8fafc;
          max-height: 160px;
          overflow-y: auto;
        }
        .dock-textarea::placeholder {
          color: #64748b;
        }

        .dock-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 0.3rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }
        .dock-tools-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dock-language-select {
          padding: 3px 7px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.04);
          color: #94a3b8;
          font-size: 0.72rem;
          font-weight: 500;
          outline: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dock-language-select:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
          border-color: rgba(255, 255, 255, 0.16);
        }

        .dock-tool-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 7px;
          background: rgba(255, 255, 255, 0.04);
          color: #94a3b8;
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dock-tool-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: #f1f5f9;
          border-color: rgba(255, 255, 255, 0.16);
        }
        .dock-tool-btn.listening {
          background: rgba(239, 68, 68, 0.15);
          border-color: #ef4444;
          color: #ef4444;
          box-shadow: 0 0 10px rgba(239, 68, 68, 0.35);
        }

        .mic-pulse-ring {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mic-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #ef4444;
          animation: micPulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes micPulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            transform: scale(1.25);
            box-shadow: 0 0 0 5px rgba(239, 68, 68, 0);
          }
        }

        .dock-textarea.is-listening {
          color: #f87171;
        }

        .dock-transcript-pill {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 7px;
          background: transparent;
          color: #64748b;
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dock-transcript-pill:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #94a3b8;
          border-color: rgba(255, 255, 255, 0.12);
        }

        .dock-tools-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dock-send-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 50%;
          background: var(--accent);
          color: #ffffff;
          font-size: 1.1rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 2px 8px rgba(0, 102, 204, 0.35);
        }
        .dock-send-btn:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-1px) scale(1.04);
          box-shadow: 0 4px 12px rgba(0, 102, 204, 0.5);
        }
        .dock-send-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          background: var(--bg-hover);
          box-shadow: none;
          color: var(--text-muted);
        }
        .send-arrow {
          line-height: 1;
        }

        .dock-stop-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          border: 1px solid rgba(239, 68, 68, 0.4);
          border-radius: 999px;
          background: rgba(239, 68, 68, 0.12);
          color: #fca5a5;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .dock-stop-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #fecaca;
          transform: translateY(-1px);
        }
        .stop-sq {
          font-size: 0.72rem;
          color: #ef4444;
        }

        .session-restoring-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 6rem 1rem;
          gap: 14px;
        }
        .restoring-spinner {
          width: 28px;
          height: 28px;
          border: 2.5px solid var(--accent-subtle);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .restoring-text {
          font-size: 0.88rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .session-loading-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 6px 14px;
          margin: 0.75rem auto;
          background: var(--accent-subtle);
          border: 1px solid var(--accent-dim);
          border-radius: 20px;
          color: var(--accent);
          font-size: 0.76rem;
          font-weight: 600;
          width: fit-content;
        }
        .session-spinner {
          width: 12px;
          height: 12px;
          border: 2px solid var(--accent-subtle);
          border-top-color: var(--accent);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        .chat-error {
          margin: 0;
          padding: 0.5rem 1.15rem;
          font-size: 0.82rem;
          color: var(--danger);
          text-align: center;
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </section>
  );
}
