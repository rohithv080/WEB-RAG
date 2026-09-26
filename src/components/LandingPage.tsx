"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const TYPEWRITER_WORDS = [
  "Supercharged by AI",
  "Instantly Searchable",
  "Always Available",
  "Contextually Aware",
  "Production-Ready",
];

const FEATURES = [
  {
    icon: "🔍",
    title: "Hybrid Search",
    desc: "Vector similarity + BM25 keyword search fused by Reciprocal Rank Fusion for maximum recall.",
  },
  {
    icon: "🎯",
    title: "Cross-Encoder Reranking",
    desc: "Jina AI cross-encoder reranks results for surgical precision on every query.",
  },
  {
    icon: "📄",
    title: "Multi-Format Ingestion",
    desc: "Drop PDFs, DOCX, PPTX, CSV, TXT — all parsed, chunked, and vectorized automatically.",
  },
  {
    icon: "🌐",
    title: "Web Crawling",
    desc: "Paste a URL and auto-crawl up to N pages. Re-index with one click as content changes.",
  },
  {
    icon: "🤖",
    title: "Telegram Bot",
    desc: "Full Telegram integration with voice memo transcription via Groq Whisper.",
  },
  {
    icon: "🔌",
    title: "Embeddable Widget",
    desc: "1-line script tag to embed an AI chatbot on any website. Fully customizable.",
  },
];

const STEPS = [
  {
    num: "01",
    icon: "📤",
    title: "Upload or Crawl",
    desc: "Drop a PDF, paste a URL, or upload documents. We handle the rest.",
  },
  {
    num: "02",
    icon: "⚡",
    title: "Index & Vectorize",
    desc: "Content is chunked, embedded with all-MiniLM-L6-v2, and stored in pgvector.",
  },
  {
    num: "03",
    icon: "💬",
    title: "Chat & Deploy",
    desc: "Ask questions, get cited answers. Embed on your site or connect Telegram.",
  },
];

const TECH_STACK = [
  { name: "Next.js 15", color: "#fff" },
  { name: "Groq", color: "#f55036" },
  { name: "Llama 3.3 70B", color: "#a78bfa" },
  { name: "pgvector", color: "#38bdf8" },
  { name: "Neon DB", color: "#00e5a0" },
  { name: "Prisma", color: "#5a67d8" },
  { name: "Clerk Auth", color: "#6c47ff" },
  { name: "Vercel", color: "#fff" },
  { name: "Jina AI", color: "#ff6b35" },
  { name: "Whisper", color: "#34d399" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Landing Page Component
// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
  // Typewriter effect
  const [wordIdx, setWordIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const word = TYPEWRITER_WORDS[wordIdx];
    const speed = isDeleting ? 40 : 80;

    if (!isDeleting && charIdx === word.length) {
      const t = setTimeout(() => setIsDeleting(true), 2200);
      return () => clearTimeout(t);
    }
    if (isDeleting && charIdx === 0) {
      setIsDeleting(false);
      setWordIdx((prev) => (prev + 1) % TYPEWRITER_WORDS.length);
      return;
    }

    const t = setTimeout(() => {
      setCharIdx((prev) => prev + (isDeleting ? -1 : 1));
    }, speed);
    return () => clearTimeout(t);
  }, [charIdx, isDeleting, wordIdx]);

  // Scroll-reveal observer
  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("lp-revealed");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    revealRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const addRevealRef = useCallback(
    (idx: number) => (el: HTMLDivElement | null) => {
      revealRefs.current[idx] = el;
    },
    []
  );

  const currentWord = TYPEWRITER_WORDS[wordIdx];
  const displayText = currentWord.slice(0, charIdx);

  return (
    <div className="lp-root">
      {/* Floating Orbs */}
      <div className="lp-orb lp-orb-1" />
      <div className="lp-orb lp-orb-2" />
      <div className="lp-orb lp-orb-3" />

      {/* NAV BAR */}
      <nav className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-logo">
            <span className="lp-logo-icon">&#9670;</span>
            <span className="lp-logo-text">WebRAG</span>
          </div>
          <div className="lp-nav-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it Works</a>
          </div>
          <div className="lp-nav-auth">
            <SignInButton mode="modal">
              <button className="lp-nav-signin">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="lp-nav-signup">Get Started</button>
            </SignUpButton>
          </div>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="lp-hero">
        <div className="lp-hero-badge">
          <span className="lp-badge-dot" />
          Powered by Llama 3.3 70B on Groq &mdash; 100% Free Tier
        </div>

        <h1 className="lp-hero-title">
          Your Knowledge,
          <br />
          <span className="lp-hero-typed">
            {displayText}
            <span className="lp-cursor">|</span>
          </span>
        </h1>

        <p className="lp-hero-sub">
          Production-grade conversational AI trained on your websites and documents. Hybrid RAG
          search, cross-encoder reranking, multi-turn memory, and 1-line embeddable widgets &mdash;
          all running on free-tier infrastructure.
        </p>

        <div className="lp-hero-actions">
          <SignUpButton mode="modal">
            <button className="lp-btn-primary">
              <span>Get Started Free</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </SignUpButton>
          <SignInButton mode="modal">
            <button className="lp-btn-secondary">
              <span>Sign In</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M13 12H3" />
              </svg>
            </button>
          </SignInButton>
        </div>

        {/* Hero visual mockup */}
        <div className="lp-hero-visual">
          <div className="lp-hero-glow" />
          <div className="lp-hero-mockup">
            <div className="lp-mockup-bar">
              <span className="lp-dot lp-dot-r" />
              <span className="lp-dot lp-dot-y" />
              <span className="lp-dot lp-dot-g" />
              <span className="lp-mockup-url">webrag.app/dashboard</span>
            </div>
            <div className="lp-mockup-body">
              <div className="lp-mock-sidebar">
                <div className="lp-mock-nav-item lp-mock-active" />
                <div className="lp-mock-nav-item" />
                <div className="lp-mock-nav-item" />
              </div>
              <div className="lp-mock-content">
                <div className="lp-mock-card" />
                <div className="lp-mock-card lp-mock-card-sm" />
                <div className="lp-mock-chat-row">
                  <div className="lp-mock-bubble lp-mock-user" />
                  <div className="lp-mock-bubble lp-mock-ai" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section className="lp-section" id="features">
        <div className="lp-section-header lp-reveal" ref={addRevealRef(0)}>
          <span className="lp-section-tag">Features</span>
          <h2 className="lp-section-title">
            Everything you need for
            <span className="lp-gradient-text"> production RAG</span>
          </h2>
          <p className="lp-section-sub">
            Enterprise-grade retrieval pipeline with zero infrastructure cost.
          </p>
        </div>

        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="lp-feature-card lp-reveal glass"
              ref={addRevealRef(i + 1)}
              style={{ transitionDelay: `${i * 80}ms` }}
            >
              <span className="lp-feature-icon">{f.icon}</span>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="lp-section" id="how-it-works">
        <div className="lp-section-header lp-reveal" ref={addRevealRef(10)}>
          <span className="lp-section-tag">How It Works</span>
          <h2 className="lp-section-title">
            Three steps to
            <span className="lp-gradient-text"> intelligent search</span>
          </h2>
        </div>

        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div
              key={s.num}
              className="lp-step lp-reveal"
              ref={addRevealRef(11 + i)}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              <div className="lp-step-num">{s.num}</div>
              <div className="lp-step-icon">{s.icon}</div>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TECH STACK MARQUEE */}
      <section className="lp-marquee-section">
        <span className="lp-marquee-label">Powered By</span>
        <div className="lp-marquee-track">
          <div className="lp-marquee-inner">
            {[...TECH_STACK, ...TECH_STACK].map((t, i) => (
              <span key={`${t.name}-${i}`} className="lp-tech-badge" style={{ color: t.color }}>
                {t.name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="lp-cta-section">
        <div className="lp-cta-glow" />
        <h2 className="lp-cta-title">
          Ready to build your own
          <span className="lp-gradient-text"> AI knowledge bot</span>?
        </h2>
        <p className="lp-cta-sub">
          Free forever. No credit card required. Deploy in under 60 seconds.
        </p>
        <SignUpButton mode="modal">
          <button className="lp-btn-primary lp-btn-lg">
            <span>Start Building &mdash; It&apos;s Free</span>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </SignUpButton>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <span className="lp-logo-icon">&#9670;</span>
            <span className="lp-logo-text">WebRAG</span>
            <span className="lp-footer-tagline">Production AI Knowledge Engine</span>
          </div>
          <div className="lp-footer-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div className="lp-footer-credit">
            Built with &#10084;&#65039; by Rohith &middot; Powered by Groq
          </div>
        </div>
      </footer>

      {/* ALL STYLES */}
      <style>{`
        .lp-root {
          position: relative;
          overflow-x: hidden;
          min-height: 100vh;
        }

        /* Floating Orbs */
        .lp-orb {
          position: fixed;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          z-index: 0;
          animation: lpFloat 20s ease-in-out infinite;
        }
        .lp-orb-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(56,189,248,0.12), transparent 70%);
          top: -200px; left: -100px;
        }
        .lp-orb-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(129,140,248,0.10), transparent 70%);
          top: 40%; right: -150px;
          animation-delay: -7s;
        }
        .lp-orb-3 {
          width: 450px; height: 450px;
          background: radial-gradient(circle, rgba(52,211,153,0.08), transparent 70%);
          bottom: -100px; left: 30%;
          animation-delay: -14s;
        }
        @keyframes lpFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(30px, -40px) scale(1.05); }
          50% { transform: translate(-20px, 20px) scale(0.95); }
          75% { transform: translate(40px, 30px) scale(1.02); }
        }

        /* Nav */
        .lp-nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 100;
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          background: rgba(8, 11, 17, 0.7);
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .lp-nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0.8rem 2rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-logo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .lp-logo-icon {
          font-size: 1.3rem;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-logo-text {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text);
          letter-spacing: -0.02em;
        }
        .lp-nav-links {
          display: flex;
          gap: 2rem;
        }
        .lp-nav-links a {
          font-size: 0.85rem;
          color: var(--text-muted);
          font-weight: 500;
          transition: color 0.2s;
        }
        .lp-nav-links a:hover { color: var(--text); }
        .lp-nav-auth {
          display: flex;
          gap: 0.6rem;
          align-items: center;
        }
        .lp-nav-signin {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 0.85rem;
          font-weight: 500;
          padding: 0.4rem 0.8rem;
          border-radius: var(--radius-sm);
          transition: all 0.2s;
        }
        .lp-nav-signin:hover { color: var(--text); background: rgba(255,255,255,0.05); }
        .lp-nav-signup {
          background: var(--accent-gradient);
          border: none;
          color: #fff;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.45rem 1rem;
          border-radius: var(--radius);
          transition: all 0.2s;
          box-shadow: 0 2px 12px rgba(56,189,248,0.25);
        }
        .lp-nav-signup:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(56,189,248,0.35); }

        /* Hero */
        .lp-hero {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 8rem 2rem 4rem;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .lp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 1rem;
          border-radius: 999px;
          border: 1px solid rgba(56,189,248,0.2);
          background: rgba(56,189,248,0.06);
          color: var(--accent);
          font-size: 0.78rem;
          font-weight: 500;
          margin-bottom: 2rem;
          animation: fadeUp 0.6s ease;
        }
        .lp-badge-dot {
          width: 6px; height: 6px;
          background: var(--accent);
          border-radius: 50%;
          animation: pulseGlow 2s ease-in-out infinite;
        }
        .lp-hero-title {
          font-size: clamp(2.5rem, 6vw, 4.5rem);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: var(--text);
          margin: 0 0 1.5rem;
          animation: fadeUp 0.7s ease 0.1s both;
        }
        .lp-hero-typed {
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-cursor {
          -webkit-text-fill-color: var(--accent);
          animation: lpBlink 1s step-end infinite;
          font-weight: 300;
        }
        @keyframes lpBlink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        .lp-hero-sub {
          max-width: 640px;
          font-size: 1.05rem;
          line-height: 1.7;
          color: var(--text-muted);
          margin: 0 0 2.5rem;
          animation: fadeUp 0.7s ease 0.2s both;
        }
        .lp-hero-actions {
          display: flex;
          gap: 0.8rem;
          flex-wrap: wrap;
          justify-content: center;
          animation: fadeUp 0.7s ease 0.3s both;
        }

        /* Buttons */
        .lp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.6rem;
          border: none;
          border-radius: var(--radius);
          background: var(--accent-gradient);
          color: #fff;
          font-size: 0.92rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s;
          box-shadow: 0 4px 20px rgba(56,189,248,0.3);
        }
        .lp-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(56,189,248,0.4);
        }
        .lp-btn-lg {
          padding: 0.85rem 2rem;
          font-size: 1rem;
        }
        .lp-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.6rem;
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: var(--radius);
          background: rgba(255,255,255,0.04);
          color: var(--text);
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.25s;
        }
        .lp-btn-secondary:hover {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.2);
          transform: translateY(-1px);
        }

        /* Hero Visual Mockup */
        .lp-hero-visual {
          position: relative;
          margin-top: 3.5rem;
          width: 100%;
          max-width: 800px;
          animation: fadeUp 0.8s ease 0.4s both;
        }
        .lp-hero-glow {
          position: absolute;
          inset: -40px;
          background: radial-gradient(ellipse at center, rgba(56,189,248,0.12), transparent 70%);
          z-index: -1;
          border-radius: 50%;
          filter: blur(40px);
        }
        .lp-hero-mockup {
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(15, 22, 36, 0.8);
          backdrop-filter: blur(12px);
          overflow: hidden;
          box-shadow: 0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .lp-mockup-bar {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.6rem 0.9rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          background: rgba(255,255,255,0.02);
        }
        .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
        .lp-dot-r { background: #ff5f57; }
        .lp-dot-y { background: #febc2e; }
        .lp-dot-g { background: #28c840; }
        .lp-mockup-url {
          margin-left: 0.8rem;
          font-size: 0.72rem;
          color: var(--text-dim);
          font-family: var(--font-mono);
        }
        .lp-mockup-body {
          display: flex;
          min-height: 260px;
        }
        .lp-mock-sidebar {
          width: 60px;
          border-right: 1px solid rgba(255,255,255,0.05);
          padding: 1rem 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .lp-mock-nav-item {
          height: 8px;
          border-radius: 4px;
          background: rgba(255,255,255,0.06);
        }
        .lp-mock-active { background: rgba(56,189,248,0.3) !important; }
        .lp-mock-content {
          flex: 1;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .lp-mock-card {
          height: 50px;
          border-radius: var(--radius-sm);
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.05);
        }
        .lp-mock-card-sm { height: 30px; width: 60%; }
        .lp-mock-chat-row {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: auto;
        }
        .lp-mock-bubble { height: 24px; border-radius: 12px; }
        .lp-mock-user {
          width: 45%;
          margin-left: auto;
          background: rgba(56,189,248,0.15);
        }
        .lp-mock-ai {
          width: 70%;
          background: rgba(255,255,255,0.06);
        }

        /* Section shared */
        .lp-section {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          padding: 5rem 2rem;
        }
        .lp-section-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        .lp-section-tag {
          display: inline-block;
          padding: 0.25rem 0.8rem;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--accent);
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.15);
          margin-bottom: 1rem;
        }
        .lp-section-title {
          font-size: clamp(1.8rem, 3.5vw, 2.8rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text);
          margin: 0;
          line-height: 1.2;
        }
        .lp-gradient-text {
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-section-sub {
          font-size: 1rem;
          color: var(--text-muted);
          margin: 0.8rem auto 0;
          max-width: 520px;
        }

        /* Scroll reveal */
        .lp-reveal {
          opacity: 0;
          transform: translateY(30px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .lp-revealed {
          opacity: 1;
          transform: translateY(0);
        }

        /* Features grid */
        .lp-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.2rem;
        }
        .lp-feature-card {
          padding: 1.6rem;
          border-radius: var(--radius-lg);
          transition: all 0.3s ease, opacity 0.6s ease, transform 0.6s ease;
          cursor: default;
        }
        .lp-feature-card:hover {
          border-color: rgba(56,189,248,0.2);
          transform: translateY(-4px) !important;
          box-shadow: 0 16px 40px rgba(0,0,0,0.4), 0 0 30px rgba(56,189,248,0.08);
        }
        .lp-feature-icon { font-size: 1.8rem; display: block; margin-bottom: 0.8rem; }
        .lp-feature-title {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.4rem;
        }
        .lp-feature-desc {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.55;
          margin: 0;
        }

        /* Steps */
        .lp-steps {
          display: flex;
          gap: 2rem;
          justify-content: center;
        }
        .lp-step {
          flex: 1;
          max-width: 320px;
          text-align: center;
          position: relative;
          padding: 2rem 1.5rem;
          border-radius: var(--radius-lg);
          background: var(--glass-bg);
          border: 1px solid var(--glass-border);
          backdrop-filter: blur(12px);
        }
        .lp-step-num {
          font-size: 3rem;
          font-weight: 800;
          background: var(--accent-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          opacity: 0.15;
          position: absolute;
          top: 0.5rem;
          right: 1rem;
          line-height: 1;
        }
        .lp-step-icon { font-size: 2.2rem; margin-bottom: 0.8rem; }
        .lp-step-title {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text);
          margin: 0 0 0.5rem;
        }
        .lp-step-desc {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.55;
          margin: 0;
        }

        /* Marquee */
        .lp-marquee-section {
          position: relative;
          z-index: 1;
          padding: 2rem 0;
          border-top: 1px solid rgba(255,255,255,0.04);
          border-bottom: 1px solid rgba(255,255,255,0.04);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        .lp-marquee-label {
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: var(--text-dim);
          font-weight: 600;
        }
        .lp-marquee-track {
          width: 100%;
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
        }
        .lp-marquee-inner {
          display: flex;
          gap: 3rem;
          width: max-content;
          animation: lpMarquee 30s linear infinite;
        }
        .lp-tech-badge {
          font-size: 0.9rem;
          font-weight: 600;
          white-space: nowrap;
          opacity: 0.6;
          transition: opacity 0.3s;
        }
        .lp-tech-badge:hover { opacity: 1; }
        @keyframes lpMarquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }


        /* CTA */
        .lp-cta-section {
          position: relative;
          z-index: 1;
          text-align: center;
          padding: 5rem 2rem;
          overflow: hidden;
        }
        .lp-cta-glow {
          position: absolute;
          width: 600px; height: 300px;
          background: radial-gradient(ellipse, rgba(56,189,248,0.1), transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          filter: blur(60px);
        }
        .lp-cta-title {
          position: relative;
          font-size: clamp(1.6rem, 3vw, 2.4rem);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--text);
          margin: 0 0 0.8rem;
        }
        .lp-cta-sub {
          position: relative;
          font-size: 1rem;
          color: var(--text-muted);
          margin: 0 0 2rem;
        }

        /* Footer */
        .lp-footer {
          position: relative;
          z-index: 1;
          border-top: 1px solid rgba(255,255,255,0.05);
          padding: 2.5rem 2rem;
        }
        .lp-footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
        }
        .lp-footer-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .lp-footer-tagline {
          font-size: 0.75rem;
          color: var(--text-dim);
          margin-left: 0.3rem;
        }
        .lp-footer-links { display: flex; gap: 1.5rem; }
        .lp-footer-links a {
          font-size: 0.82rem;
          color: var(--text-muted);
          transition: color 0.2s;
        }
        .lp-footer-links a:hover { color: var(--text); }
        .lp-footer-credit {
          font-size: 0.78rem;
          color: var(--text-dim);
        }

        /* Responsive */
        @media (max-width: 768px) {
          .lp-nav-links { display: none; }
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-steps { flex-direction: column; align-items: center; }
          .lp-hero { padding: 6rem 1.2rem 3rem; }
          .lp-section { padding: 3rem 1.2rem; }
          .lp-footer-inner { flex-direction: column; text-align: center; }
          .lp-footer-links { justify-content: center; }
          .lp-frame-body { height: 420px; }
        }
        @media (max-width: 480px) {
          .lp-hero-title { font-size: 2rem; }
          .lp-features-grid { gap: 0.8rem; }
          .lp-frame-body { height: 380px; }
        }
      `}</style>
    </div>
  );
}
