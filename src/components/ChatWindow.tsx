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
  suggestWebSearch?: boolean;
  webSearchQuery?: string;
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
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
        </>
      )}

      <style jsx>{`
        .copy-btn {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--text-muted);
          padding: 3px 8px;
          border-radius: var(--radius-xs);
          font-size: 0.7rem;
          font-weight: 500;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all var(--transition-fast);
          margin-left: auto;
        }
        .copy-btn:hover {
          color: var(--text-primary);
          border-color: var(--border-hover);
          background: var(--bg-surface);
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
            suggestWebSearch:
              !m.isWebFallback &&
              /would you like me to search the web/i.test(m.content),
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

  function submitQuestion(
    question: string,
    options?: { forceWebSearch?: boolean; webSearchQuery?: string; userDisplayQuestion?: string }
  ) {
    if (!question.trim() || !siteId || streaming) return;

    setError(null);
    setInput("");
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStreaming(true);

    const userDisplay = options?.userDisplayQuestion || question.trim();
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: userDisplay,
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
            question: options?.webSearchQuery || question.trim(),
            siteId,
            sessionId,
            language: language === "auto" ? null : language,
            forceWebSearch: Boolean(options?.forceWebSearch),
            webSearchQuery: options?.webSearchQuery,
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
                        suggestWebSearch: Boolean(payload.suggestWebSearch),
                        webSearchQuery: payload.webSearchQuery,
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
                        suggestWebSearch:
                          payload.suggestWebSearch !== undefined
                            ? Boolean(payload.suggestWebSearch)
                            : m.suggestWebSearch,
                        webSearchQuery: payload.webSearchQuery || m.webSearchQuery,
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
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                        </svg>
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
                            <span>Live Web Grounded</span>
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
                        <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "0.82rem" }}>
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
                                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                </svg>
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
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={`feedback-pill ${m.rating === "down" ? "active-down" : ""}`}
                            onClick={() => handleRateMessage(m.id, "down")}
                            title="Inaccurate or unhelpful"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.75"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
                            </svg>
                          </button>
                          {m.rating && (
                            <span className="feedback-toast">
                              {m.rating === "up" ? "Feedback received" : "Feedback recorded"}
                            </span>
                          )}
                        </div>

                        <div className="perf-pills-group">
                          {m.latencyMs && (
                            <span
                              className="perf-chip"
                              title="Serverless RAG retrieval + generation latency"
                            >
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
                                {m.citations.length} web{" "}
                                {m.citations.length === 1 ? "source" : "sources"}
                              </span>
                            ) : (
                              <span
                                className="perf-chip verified-chip"
                                title="Verified against indexed document chunks"
                              >
                                {m.citations.length}{" "}
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
                            {m.isWebFallback ? "Live Web Sources" : "Verified Sources"}
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

                    {m.suggestWebSearch && !m.isWebFallback && (
                      <div className="web-search-suggest-box">
                        <button
                          type="button"
                          className="web-search-action-btn"
                          disabled={streaming}
                          onClick={() => {
                            const targetQ =
                              m.webSearchQuery ||
                              m.standaloneQuery ||
                              messages
                                .slice(0, messages.indexOf(m))
                                .reverse()
                                .find((x) => x.role === "user")?.content ||
                              "";
                            if (targetQ) {
                              submitQuestion(targetQ, {
                                forceWebSearch: true,
                                webSearchQuery: targetQ,
                                userDisplayQuestion: `Search the web for: "${targetQ}"`,
                              });
                            }
                          }}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.75"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ marginRight: 6 }}
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="2" y1="12" x2="22" y2="12" />
                            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                          </svg>
                          <span className="btn-text">
                            Search the web for &ldquo;<strong>{m.webSearchQuery || "this"}</strong>&rdquo;
                          </span>
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            style={{ marginLeft: 6 }}
                          >
                            <line x1="5" y1="12" x2="19" y2="12" />
                            <polyline points="12 5 19 12 12 19" />
                          </svg>
                        </button>
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
            <polyline points="6 9 12 15 18 9" />
          </svg>
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
                ? "Listening... speak your question now"
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
                <option value="auto">Auto-detect</option>
                <option value="English">English (EN)</option>
                <option value="Spanish">Spanish (ES)</option>
                <option value="French">French (FR)</option>
                <option value="Hindi">Hindi (HI)</option>
                <option value="Tamil">Tamil (TA)</option>
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
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                )}
              </button>

              {messages.length > 0 && !streaming && (
                <button
                  type="button"
                  className="dock-transcript-pill"
                  onClick={handleExportTranscript}
                  title="Export conversation as Markdown transcript"
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <span>Export</span>
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
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="4" y="4" width="16" height="16" rx="2" />
                  </svg>
                  <span>Stop</span>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!ready || !input.trim()}
                  className="dock-send-btn"
                  title="Send question (Enter)"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="19" x2="12" y2="5" />
                    <polyline points="5 12 12 5 19 12" />
                  </svg>
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
          background: var(--bg);
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 1.5rem 1.25rem 2rem 1.25rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          scroll-behavior: smooth;
        }

        .chat-thread-container {
          width: 100%;
          max-width: 760px;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        /* Message layout */
        .msg {
          display: flex;
          flex-direction: column;
          width: 100%;
          animation: fadeUp 0.2s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .msg-user {
          align-items: flex-end;
        }
        .msg-user-wrapper {
          max-width: 75%;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
        }
        .msg-user-bubble {
          position: relative;
          padding: 0.65rem 1rem;
          border-radius: var(--radius);
          font-size: 0.875rem;
          line-height: 1.55;
          word-break: break-word;
          white-space: pre-wrap;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          color: var(--text-primary);
        }

        .msg-assistant {
          align-items: flex-start;
        }
        .msg-assistant-card {
          position: relative;
          width: 100%;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 1.15rem 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: border-color var(--transition-fast);
        }
        .msg-assistant-card:hover {
          border-color: var(--border-hover);
        }

        .assistant-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid var(--border-subtle);
        }
        .assistant-avatar-badge {
          width: 22px;
          height: 22px;
          border-radius: var(--radius-xs);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }
        .assistant-title-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 1;
        }
        .assistant-name {
          font-size: 0.8125rem;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.01em;
        }
        .assistant-model-pill {
          font-size: 0.68rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          padding: 1px 6px;
          border-radius: var(--radius-xs);
          font-weight: 500;
          font-family: var(--font-mono);
        }

        .assistant-web-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 1px 7px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          color: var(--text-muted);
          font-size: 0.68rem;
          font-weight: 500;
          letter-spacing: 0.01em;
        }

        .web-pulse-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--status-live);
        }

        .perf-chip.web-chip {
          background: var(--bg-surface);
          border-color: var(--border);
          color: var(--text-muted);
        }

        .msg-search-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 0.72rem;
          color: var(--text-muted);
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          padding: 2px 7px;
          font-family: var(--font-mono);
          width: fit-content;
        }
        .search-chip-icon {
          width: 11px;
          height: 11px;
          color: var(--accent);
          flex-shrink: 0;
        }
        .msg-search-chip strong {
          color: var(--text-primary);
          font-weight: 500;
        }

        .msg-bubble-content {
          font-size: 0.875rem;
          line-height: 1.65;
          color: var(--text-primary);
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
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          width: 26px;
          height: 26px;
          border-radius: var(--radius-xs);
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .feedback-pill:hover {
          background: var(--bg-surface);
          border-color: var(--border-hover);
          color: var(--text-primary);
        }
        .feedback-pill.active-up,
        .feedback-pill.active-down {
          background: var(--bg-surface);
          border-color: var(--border-focus);
          color: var(--text-primary);
        }

        .speak-pill {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
          padding: 3px 8px;
          border-radius: var(--radius-xs);
          font-size: 0.72rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .speak-pill:hover {
          color: var(--text-primary);
          background: var(--bg-surface);
          border-color: var(--border-hover);
        }
        .speak-pill.active-speaking {
          color: var(--accent);
          background: var(--accent-subtle);
          border-color: var(--accent-border);
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
          background: var(--accent);
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
          color: var(--text-dim);
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
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          font-size: 0.68rem;
          color: var(--text-dim);
          font-family: var(--font-mono);
          letter-spacing: 0.02em;
        }
        .perf-chip.verified-chip {
          color: var(--text-muted);
          border-color: var(--border);
          background: var(--bg-surface);
        }

        .msg-citations-block {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-top: 0.35rem;
          padding-top: 0.65rem;
          border-top: 1px solid var(--border-subtle);
        }
        .citations-header-label {
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .msg-citations-tray {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .web-search-suggest-box {
          margin-top: 0.75rem;
          padding-top: 0.6rem;
          border-top: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
        }
        .web-search-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          background: var(--accent-subtle);
          border: 1px solid var(--accent-border);
          color: var(--text-primary);
          padding: 0.45rem 0.85rem;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .web-search-action-btn:hover:not(:disabled) {
          background: var(--accent);
          border-color: var(--accent);
          color: #ffffff;
        }
        .web-search-action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-text {
          max-width: 380px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .scroll-to-bottom-btn {
          position: absolute;
          bottom: 85px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          color: var(--text-primary);
          font-size: 0.75rem;
          font-weight: 500;
          box-shadow: var(--shadow-md);
          cursor: pointer;
          z-index: 10;
          transition: all var(--transition-fast);
          animation: bounceIn 0.25s ease both;
        }
        .scroll-to-bottom-btn:hover {
          background: var(--bg-card);
          border-color: var(--border-hover);
          transform: translateX(-50%) translateY(-1px);
        }

        /* Grounded Command Dock */
        .chat-dock-wrapper {
          position: sticky;
          bottom: 0;
          width: 100%;
          display: flex;
          justify-content: center;
          padding: 0.75rem 1.25rem 1rem 1.25rem;
          background: var(--bg);
          border-top: 1px solid var(--border);
          z-index: 15;
        }
        .chat-dock-form {
          width: 100%;
          max-width: 760px;
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 0.65rem 0.85rem 0.55rem 0.85rem;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
        }
        .chat-dock-form:focus-within {
          border-color: var(--accent);
          box-shadow: 0 0 0 1px var(--accent);
        }

        .dock-textarea {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          resize: none;
          font-family: var(--font-sans);
          font-size: 0.875rem;
          line-height: 1.5;
          color: var(--text-primary);
          min-height: 24px;
          max-height: 160px;
          overflow-y: auto;
          padding: 0;
        }
        .dock-textarea::placeholder {
          color: var(--text-dim);
        }

        .dock-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          padding-top: 0.35rem;
          border-top: 1px solid var(--border-subtle);
        }
        .dock-tools-left {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dock-language-select {
          padding: 2px 6px;
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          background: var(--bg-input);
          color: var(--text-muted);
          font-size: 0.72rem;
          font-weight: 500;
          outline: none;
          cursor: pointer;
          transition: border-color var(--transition-fast);
        }
        .dock-language-select:hover {
          border-color: var(--border-hover);
          color: var(--text-primary);
        }

        .dock-tool-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          background: var(--bg-input);
          color: var(--text-muted);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dock-tool-btn:hover {
          background: var(--bg-card);
          border-color: var(--border-hover);
          color: var(--text-primary);
        }
        .dock-tool-btn.listening {
          background: var(--danger-subtle);
          border-color: var(--danger-border);
          color: var(--danger);
        }

        .mic-pulse-ring {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .mic-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--danger);
          animation: micPulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes micPulse {
          0%,
          100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
          }
          50% {
            transform: scale(1.2);
            box-shadow: 0 0 0 4px rgba(239, 68, 68, 0);
          }
        }

        .dock-textarea.is-listening {
          color: var(--danger);
        }

        .dock-transcript-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 7px;
          border: 1px solid var(--border);
          border-radius: var(--radius-xs);
          background: var(--bg-input);
          color: var(--text-muted);
          font-size: 0.7rem;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dock-transcript-pill:hover {
          background: var(--bg-card);
          color: var(--text-primary);
          border-color: var(--border-hover);
        }

        .dock-tools-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .dock-send-btn {
          width: 28px;
          height: 28px;
          border: none;
          border-radius: var(--radius-xs);
          background: var(--accent);
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: background-color var(--transition-fast);
        }
        .dock-send-btn:hover:not(:disabled) {
          background: var(--accent-hover);
        }
        .dock-send-btn:disabled {
          opacity: 0.35;
          cursor: not-allowed;
          background: var(--bg-elevated);
          color: var(--text-dim);
        }
        .send-arrow {
          line-height: 1;
        }

        .dock-stop-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border: 1px solid var(--danger-border);
          border-radius: 9999px;
          background: var(--danger-subtle);
          color: var(--danger);
          font-size: 0.72rem;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .dock-stop-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: var(--danger);
        }
        .stop-sq {
          font-size: 0.7rem;
          color: var(--danger);
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
          width: 24px;
          height: 24px;
          border: 2px solid var(--border);
          border-top-color: var(--primary);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }
        .restoring-text {
          font-size: 0.8125rem;
          color: var(--text-muted);
          font-weight: 500;
        }

        .session-loading-banner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 4px 12px;
          margin: 0.75rem auto;
          background: var(--primary-subtle);
          border: 1px solid var(--primary-border);
          border-radius: 9999px;
          color: var(--primary-hover);
          font-size: 0.72rem;
          font-weight: 500;
          width: fit-content;
        }
        .session-spinner {
          width: 11px;
          height: 11px;
          border: 1.5px solid var(--primary-border);
          border-top-color: var(--primary);
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
          font-size: 0.8rem;
          color: var(--danger);
          text-align: center;
        }

        @keyframes bounceIn {
          0% {
            opacity: 0;
            transform: translateX(-50%) translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(5px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
        }
      `}</style>
    </section>
  );
}
