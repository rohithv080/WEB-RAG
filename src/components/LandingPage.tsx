"use client";

import { useEffect, useRef } from "react";
import { SignInButton, SignUpButton } from "@clerk/nextjs";

// ─────────────────────────────────────────────────────────────────────────────
// Institutional SVG Icons (Clean 1.5px / 1.75px Geometric Vectors)
// ─────────────────────────────────────────────────────────────────────────────

function IconSearch() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconFileText() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconMessageSquare() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconCode() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconShieldCheck() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Features & Architecture Data
// ─────────────────────────────────────────────────────────────────────────────

const CORE_CAPABILITIES = [
  {
    icon: <IconSearch />,
    title: "Hybrid Search (Vector + BM25)",
    desc: "Blends pgvector cosine similarity with PostgreSQL full-text keyword indexing fused via Reciprocal Rank Fusion.",
  },
  {
    icon: <IconLayers />,
    title: "Cross-Encoder Reranking",
    desc: "Applies Jina AI deep cross-encoder scoring on retrieved candidates for surgical relevance precision.",
  },
  {
    icon: <IconFileText />,
    title: "Document Ingestion",
    desc: "Autonomous parsing and structure-aware chunking for PDF, DOCX, Markdown, CSV, and plain text.",
  },
  {
    icon: <IconGlobe />,
    title: "Autonomous Web Crawling",
    desc: "Extracts clean article content using Mozilla Readability with recursive queue discovery and change detection.",
  },
  {
    icon: <IconMessageSquare />,
    title: "Telegram & Voice Integration",
    desc: "Native bi-directional Telegram bots with Groq Whisper voice memo transcription for audio intelligence.",
  },
  {
    icon: <IconCode />,
    title: "1-Line Embeddable Widget",
    desc: "A single script tag deploys an interactive, customizable conversational widget to any web domain.",
  },
];

const ARCHITECTURE_STEPS = [
  {
    step: "01",
    title: "Ingest & Chunk",
    desc: "Raw URLs and files are scraped, stripped of noise/boilerplate, and split into semantically coherent passages with sliding window expansion.",
  },
  {
    step: "02",
    title: "Index & Rerank",
    desc: "Passages are converted to high-dimensional embeddings and indexed in Neon pgvector. Queries execute hybrid search with cross-encoder reranking.",
  },
  {
    step: "03",
    title: "Grounded Synthesis",
    desc: "Groq Llama 3.3 70B streams verified answers with inline citation indices [1], strict refusal on unknown data, and live web fallback.",
  },
];

const TECH_BADGES = [
  "Next.js 15",
  "Llama 3.3 70B",
  "Groq LPUs",
  "Neon PostgreSQL",
  "pgvector",
  "Jina AI v3",
  "Clerk Auth",
  "Prisma ORM",
  "Vercel Edge",
];

// ─────────────────────────────────────────────────────────────────────────────
// Landing Page Component
// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
  const revealRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).classList.add("lp-visible");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    revealRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const addRef = (el: HTMLDivElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  return (
    <div className="lp-container">
      {/* ── Header Navigation ────────────────────────────────────────── */}
      <header className="lp-header">
        <div className="lp-header-inner">
          <div className="lp-brand">
            <div className="lp-logo-mark">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
              >
                <polygon
                  points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
            </div>
            <span className="lp-brand-name">Web RAG</span>
            <span className="lp-brand-tag">Enterprise</span>
          </div>

          <nav className="lp-nav-links">
            <a href="#capabilities" className="lp-nav-link">
              Capabilities
            </a>
            <a href="#architecture" className="lp-nav-link">
              Architecture
            </a>
            <a href="#stack" className="lp-nav-link">
              Infrastructure
            </a>
          </nav>

          <div className="lp-nav-actions">
            <SignInButton mode="modal">
              <button className="lp-btn-ghost">Sign In</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="lp-btn-solid">Get Started</button>
            </SignUpButton>
          </div>
        </div>
      </header>

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="lp-hero-section">
        <div className="lp-hero-content">
          <div className="lp-status-pill">
            <span className="lp-status-dot" />
            <span className="lp-status-text">
              Production Operational &middot; Groq Llama 3.3 70B &middot; Hybrid pgvector
            </span>
          </div>

          <h1 className="lp-hero-headline">
            Autonomous Knowledge Retrieval &amp; Verifiable AI Grounding
          </h1>

          <p className="lp-hero-description">
            Transform documentation repositories, websites, and enterprise documents into
            sub-second, citation-verified conversational intelligence. Built with hybrid vector
            search, cross-encoder reranking, and live web fallback.
          </p>

          <div className="lp-hero-cta-group">
            <SignUpButton mode="modal">
              <button className="lp-cta-primary">
                <span>Start Free Deployment</span>
                <IconArrowRight />
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="lp-cta-secondary">
                <span>Existing Workspace</span>
              </button>
            </SignInButton>
          </div>
        </div>

        {/* ── High-Fidelity Realistic Product Interface Preview ──────── */}
        <div className="lp-preview-wrapper" ref={addRef}>
          <div className="lp-preview-window">
            <div className="lp-window-titlebar">
              <div className="lp-window-traffic-lights">
                <span className="lp-traffic-dot" />
                <span className="lp-traffic-dot" />
                <span className="lp-traffic-dot" />
              </div>
              <div className="lp-window-address">
                <IconGlobe />
                <span>docs.rag-engine.internal/knowledge-assistant</span>
              </div>
              <div className="lp-window-badge">
                <span className="lp-indicator-green" />
                <span>750 tok/s</span>
              </div>
            </div>

            <div className="lp-window-viewport">
              {/* Query box */}
              <div className="lp-demo-query-row">
                <div className="lp-demo-user-badge">Query</div>
                <div className="lp-demo-query-text">
                  How does the hybrid search fuse dense vector embeddings with BM25 keyword search?
                </div>
              </div>

              {/* Retrieval inspection ribbon */}
              <div className="lp-demo-retrieval-strip">
                <div className="lp-retrieval-item">
                  <IconShieldCheck />
                  <span>3 Verified Chunks</span>
                </div>
                <div className="lp-retrieval-item">
                  <IconLayers />
                  <span>RRF Fusion (k=60)</span>
                </div>
                <div className="lp-retrieval-item">
                  <span>
                    Jina Score: <strong>0.942</strong>
                  </span>
                </div>
                <div className="lp-retrieval-item lp-retrieval-status">
                  <span className="lp-status-dot-sm" />
                  <span>Local Context Grounded</span>
                </div>
              </div>

              {/* Streaming AI answer */}
              <div className="lp-demo-answer-box">
                <div className="lp-demo-ai-header">
                  <div className="lp-demo-ai-avatar">AI</div>
                  <span className="lp-demo-ai-name">Web RAG Assistant</span>
                  <span className="lp-demo-timestamp">Just now</span>
                </div>
                <p className="lp-demo-answer-text">
                  Web RAG implements a decoupled two-stage retrieval pipeline. Queries are
                  vectorized via Jina v3 and simultaneously matched using PostgreSQL BM25 text
                  search. Candidates from both dense and sparse channels are merged using{" "}
                  <strong>Reciprocal Rank Fusion (RRF)</strong>{" "}
                  <span
                    className="lp-citation-chip"
                    title="Source: docs/retrieval.md &middot; Chunk 4"
                  >
                    [1]
                  </span>
                  . The top 20 candidates are then scored through a multilingual cross-encoder
                  reranker{" "}
                  <span
                    className="lp-citation-chip"
                    title="Source: docs/reranking.md &middot; Chunk 2"
                  >
                    [2]
                  </span>{" "}
                  before being injected into the Llama 3.3 70B prompt window.
                </p>
                <div className="lp-demo-citation-card">
                  <div className="lp-citation-source">
                    <span className="lp-citation-index">[1]</span>
                    <span className="lp-citation-url">
                      docs.internal/retrieval/hybrid-search.md
                    </span>
                    <span className="lp-citation-score">Cosine: 0.89 &middot; Rank: #1</span>
                  </div>
                  <p className="lp-citation-quote">
                    &ldquo;RRF score = &Sigma; 1 / (k + rank_dense) + 1 / (k + rank_sparse). This
                    ensures keyword precision is preserved without sacrificing semantic
                    abstraction.&rdquo;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities Section ─────────────────────────────────────── */}
      <section className="lp-section" id="capabilities">
        <div className="lp-section-header" ref={addRef}>
          <span className="lp-kicker">Core System Architecture</span>
          <h2 className="lp-section-title">Built for Precision, Resilience &amp; Speed</h2>
          <p className="lp-section-desc">
            Engineered from the ground up for zero-hallucination accuracy and predictable production
            performance.
          </p>
        </div>

        <div className="lp-capabilities-grid">
          {CORE_CAPABILITIES.map((cap, i) => (
            <div key={i} className="lp-capability-card" ref={addRef}>
              <div className="lp-capability-icon-wrap">{cap.icon}</div>
              <h3 className="lp-capability-title">{cap.title}</h3>
              <p className="lp-capability-desc">{cap.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Architecture Pipeline ────────────────────────────────────── */}
      <section className="lp-section lp-section-alt" id="architecture">
        <div className="lp-section-header" ref={addRef}>
          <span className="lp-kicker">End-to-End Execution Flow</span>
          <h2 className="lp-section-title">From Raw Content to Verified Intelligence</h2>
          <p className="lp-section-desc">
            A deterministic, auditable multi-stage pipeline running entirely within
            high-availability cloud infrastructure.
          </p>
        </div>

        <div className="lp-pipeline-grid">
          {ARCHITECTURE_STEPS.map((s, i) => (
            <div key={i} className="lp-pipeline-card" ref={addRef}>
              <div className="lp-pipeline-step-badge">{s.step}</div>
              <h3 className="lp-pipeline-title">{s.title}</h3>
              <p className="lp-pipeline-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Infrastructure Stack ─────────────────────────────────────── */}
      <section className="lp-section" id="stack">
        <div className="lp-section-header" ref={addRef}>
          <span className="lp-kicker">Production Stack</span>
          <h2 className="lp-section-title">State-of-the-Art Infrastructure</h2>
        </div>

        <div className="lp-stack-strip" ref={addRef}>
          {TECH_BADGES.map((b, i) => (
            <div key={i} className="lp-stack-badge">
              <span className="lp-stack-dot" />
              <span>{b}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Institutional CTA Ribbon ─────────────────────────────────── */}
      <section className="lp-cta-ribbon" ref={addRef}>
        <div className="lp-cta-ribbon-content">
          <h2 className="lp-cta-heading">Deploy Your Knowledge Assistant in Minutes</h2>
          <p className="lp-cta-text">
            No credit card required. Paste any documentation URL or upload your files to get an
            autonomous grounded assistant.
          </p>
          <div className="lp-cta-actions">
            <SignUpButton mode="modal">
              <button className="lp-btn-solid lp-btn-solid-lg">Create First Knowledge Bot</button>
            </SignUpButton>
          </div>
        </div>
      </section>

      {/* ── Institutional Footer ─────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer-content">
          <div className="lp-footer-left">
            <div className="lp-brand-footer">
              <div className="lp-logo-mark-sm">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <polygon
                    points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </div>
              <span className="lp-footer-name">Web RAG</span>
            </div>
            <p className="lp-footer-motto">
              High-Precision Retrieval-Augmented Generation Platform
            </p>
          </div>
          <div className="lp-footer-right">
            <span className="lp-footer-status">
              <span className="lp-status-dot-sm" /> All Systems Operational
            </span>
            <span className="lp-footer-copy">
              &copy; {new Date().getFullYear()} Web RAG. All rights reserved.
            </span>
          </div>
        </div>
      </footer>

      {/* ── Minimalist Institutional Stylesheet ──────────────────────── */}
      <style jsx>{`
        .lp-container {
          min-height: 100vh;
          background: #09090b;
          color: #f4f4f5;
          font-family:
            var(--font-sans),
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Roboto,
            sans-serif;
          overflow-x: hidden;
        }

        /* ── Header ─────────────────────────────────────────────────── */
        .lp-header {
          position: sticky;
          top: 0;
          z-index: 50;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          background: rgba(9, 9, 11, 0.85);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .lp-header-inner {
          max-width: 1160px;
          margin: 0 auto;
          padding: 0.85rem 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .lp-brand {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .lp-logo-mark {
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: #2563eb;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lp-logo-mark-sm {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: #27272a;
          color: #f4f4f5;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lp-brand-name {
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: -0.015em;
          color: #ffffff;
        }
        .lp-brand-tag {
          font-size: 0.68rem;
          font-weight: 500;
          color: #a1a1aa;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.15rem 0.45rem;
          border-radius: 4px;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }
        .lp-nav-links {
          display: flex;
          align-items: center;
          gap: 1.75rem;
        }
        .lp-nav-link {
          font-size: 0.84rem;
          color: #a1a1aa;
          transition: color 0.15s ease;
        }
        .lp-nav-link:hover {
          color: #ffffff;
        }
        .lp-nav-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .lp-btn-ghost {
          padding: 0.45rem 0.9rem;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          color: #d4d4d8;
          font-size: 0.82rem;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .lp-btn-ghost:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.05);
        }
        .lp-btn-solid {
          padding: 0.45rem 1rem;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: #f4f4f5;
          color: #09090b;
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: all 0.15s ease;
        }
        .lp-btn-solid:hover {
          background: #ffffff;
          box-shadow: 0 4px 14px rgba(255, 255, 255, 0.12);
        }
        .lp-btn-solid-lg {
          padding: 0.75rem 1.6rem;
          font-size: 0.9rem;
        }

        /* ── Hero ────────────────────────────────────────────────────── */
        .lp-hero-section {
          max-width: 1160px;
          margin: 0 auto;
          padding: 4.5rem 1.5rem 3.5rem;
        }
        .lp-hero-content {
          max-width: 760px;
          margin: 0 auto 3rem;
          text-align: center;
        }
        .lp-status-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.8rem;
          border-radius: 9999px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          font-size: 0.74rem;
          color: #a1a1aa;
          margin-bottom: 1.5rem;
        }
        .lp-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #10b981;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);
        }
        .lp-status-dot-sm {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
        }
        .lp-hero-headline {
          margin: 0 0 1.25rem;
          font-size: clamp(2.1rem, 4.2vw, 3.25rem);
          font-weight: 700;
          letter-spacing: -0.035em;
          line-height: 1.15;
          color: #fafafa;
        }
        .lp-hero-description {
          margin: 0 auto 2rem;
          font-size: 1.05rem;
          line-height: 1.6;
          color: #a1a1aa;
          max-width: 620px;
        }
        .lp-hero-cta-group {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .lp-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.7rem 1.4rem;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          background: #f4f4f5;
          color: #09090b;
          font-size: 0.88rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          transition: all 0.15s ease;
        }
        .lp-cta-primary:hover {
          background: #ffffff;
          box-shadow: 0 6px 20px rgba(255, 255, 255, 0.14);
        }
        .lp-cta-secondary {
          padding: 0.7rem 1.25rem;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(255, 255, 255, 0.03);
          color: #e4e4e7;
          font-size: 0.88rem;
          font-weight: 500;
          transition: all 0.15s ease;
        }
        .lp-cta-secondary:hover {
          background: rgba(255, 255, 255, 0.07);
          border-color: rgba(255, 255, 255, 0.18);
        }

        /* ── Realistic Product Preview Window ───────────────────────── */
        .lp-preview-wrapper {
          margin-top: 1rem;
        }
        .lp-preview-window {
          background: #0e0e12;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
        }
        .lp-window-titlebar {
          background: #131317;
          padding: 0.65rem 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .lp-window-traffic-lights {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .lp-traffic-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.12);
        }
        .lp-window-address {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.76rem;
          color: #71717a;
          background: rgba(0, 0, 0, 0.35);
          padding: 0.25rem 0.85rem;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          max-width: 440px;
          width: 100%;
          justify-content: center;
        }
        .lp-window-badge {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.72rem;
          font-weight: 500;
          color: #34d399;
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 0.2rem 0.55rem;
          border-radius: 4px;
        }
        .lp-indicator-green {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #34d399;
        }
        .lp-window-viewport {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .lp-demo-query-row {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 6px;
          padding: 0.85rem 1.1rem;
        }
        .lp-demo-user-badge {
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: #27272a;
          color: #a1a1aa;
          padding: 0.15rem 0.45rem;
          border-radius: 3px;
        }
        .lp-demo-query-text {
          font-size: 0.9rem;
          color: #f4f4f5;
          font-weight: 500;
        }
        .lp-demo-retrieval-strip {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          flex-wrap: wrap;
          padding: 0.45rem 0.2rem;
        }
        .lp-retrieval-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.72rem;
          color: #a1a1aa;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          padding: 0.25rem 0.6rem;
          border-radius: 4px;
        }
        .lp-retrieval-status {
          color: #34d399;
          border-color: rgba(16, 185, 129, 0.2);
          background: rgba(16, 185, 129, 0.05);
        }
        .lp-demo-answer-box {
          background: #111116;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 1.25rem;
        }
        .lp-demo-ai-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }
        .lp-demo-ai-avatar {
          width: 20px;
          height: 20px;
          border-radius: 4px;
          background: #2563eb;
          color: #ffffff;
          font-size: 0.65rem;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lp-demo-ai-name {
          font-size: 0.82rem;
          font-weight: 600;
          color: #f4f4f5;
        }
        .lp-demo-timestamp {
          font-size: 0.7rem;
          color: #71717a;
          margin-left: auto;
        }
        .lp-demo-answer-text {
          margin: 0 0 1rem;
          font-size: 0.88rem;
          line-height: 1.65;
          color: #d4d4d8;
        }
        .lp-demo-answer-text strong {
          color: #ffffff;
        }
        .lp-citation-chip {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 600;
          color: #60a5fa;
          background: rgba(37, 99, 235, 0.12);
          border: 1px solid rgba(37, 99, 235, 0.25);
          padding: 0.05rem 0.35rem;
          border-radius: 3px;
          cursor: pointer;
          margin: 0 2px;
          vertical-align: middle;
        }
        .lp-demo-citation-card {
          background: rgba(0, 0, 0, 0.35);
          border-left: 2px solid #2563eb;
          padding: 0.75rem 1rem;
          border-radius: 0 6px 6px 0;
        }
        .lp-citation-source {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.72rem;
          margin-bottom: 0.35rem;
        }
        .lp-citation-index {
          color: #60a5fa;
          font-weight: 700;
        }
        .lp-citation-url {
          color: #a1a1aa;
          font-family: monospace;
        }
        .lp-citation-score {
          color: #71717a;
          margin-left: auto;
        }
        .lp-citation-quote {
          margin: 0;
          font-size: 0.78rem;
          color: #a1a1aa;
          font-style: italic;
          line-height: 1.5;
        }

        /* ── Sections ────────────────────────────────────────────────── */
        .lp-section {
          max-width: 1160px;
          margin: 0 auto;
          padding: 5rem 1.5rem;
        }
        .lp-section-alt {
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.01);
        }
        .lp-section-header {
          text-align: center;
          max-width: 640px;
          margin: 0 auto 3.5rem;
        }
        .lp-kicker {
          font-size: 0.74rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #3b82f6;
          display: block;
          margin-bottom: 0.5rem;
        }
        .lp-section-title {
          margin: 0 0 0.75rem;
          font-size: 1.85rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: #fafafa;
        }
        .lp-section-desc {
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.6;
          color: #a1a1aa;
        }

        /* ── Capabilities Grid ───────────────────────────────────────── */
        .lp-capabilities-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }
        .lp-capability-card {
          background: #0d0d10;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          padding: 1.5rem;
          transition: all 0.15s ease;
        }
        .lp-capability-card:hover {
          border-color: rgba(255, 255, 255, 0.16);
          background: #111115;
          transform: translateY(-2px);
        }
        .lp-capability-icon-wrap {
          width: 36px;
          height: 36px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }
        .lp-capability-title {
          margin: 0 0 0.5rem;
          font-size: 0.98rem;
          font-weight: 600;
          color: #fafafa;
          letter-spacing: -0.01em;
        }
        .lp-capability-desc {
          margin: 0;
          font-size: 0.84rem;
          line-height: 1.55;
          color: #a1a1aa;
        }

        /* ── Architecture Pipeline ───────────────────────────────────── */
        .lp-pipeline-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1.25rem;
        }
        .lp-pipeline-card {
          background: #0d0d10;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          padding: 1.75rem 1.5rem;
          position: relative;
        }
        .lp-pipeline-step-badge {
          font-size: 0.74rem;
          font-weight: 700;
          font-family: monospace;
          color: #3b82f6;
          background: rgba(37, 99, 235, 0.08);
          border: 1px solid rgba(37, 99, 235, 0.2);
          display: inline-block;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          margin-bottom: 1rem;
        }
        .lp-pipeline-title {
          margin: 0 0 0.5rem;
          font-size: 1.05rem;
          font-weight: 600;
          color: #fafafa;
        }
        .lp-pipeline-desc {
          margin: 0;
          font-size: 0.84rem;
          line-height: 1.55;
          color: #a1a1aa;
        }

        /* ── Tech Stack Strip ────────────────────────────────────────── */
        .lp-stack-strip {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .lp-stack-badge {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.8rem;
          font-weight: 500;
          color: #d4d4d8;
          background: #111114;
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 0.45rem 0.9rem;
          border-radius: 6px;
        }
        .lp-stack-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #3b82f6;
        }

        /* ── CTA Ribbon ──────────────────────────────────────────────── */
        .lp-cta-ribbon {
          max-width: 1160px;
          margin: 2rem auto 5rem;
          padding: 0 1.5rem;
        }
        .lp-cta-ribbon-content {
          background: #0f0f14;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 10px;
          padding: 3.5rem 2rem;
          text-align: center;
        }
        .lp-cta-heading {
          margin: 0 0 0.75rem;
          font-size: 1.85rem;
          font-weight: 700;
          color: #fafafa;
          letter-spacing: -0.025em;
        }
        .lp-cta-text {
          margin: 0 auto 2rem;
          max-width: 540px;
          font-size: 0.95rem;
          color: #a1a1aa;
          line-height: 1.55;
        }
        .lp-cta-actions {
          display: flex;
          justify-content: center;
        }

        /* ── Footer ──────────────────────────────────────────────────── */
        .lp-footer {
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          background: #09090b;
          padding: 2.5rem 1.5rem;
        }
        .lp-footer-content {
          max-width: 1160px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .lp-brand-footer {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
        }
        .lp-footer-name {
          font-size: 0.9rem;
          font-weight: 600;
          color: #ffffff;
        }
        .lp-footer-motto {
          margin: 0;
          font-size: 0.78rem;
          color: #71717a;
        }
        .lp-footer-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.35rem;
        }
        .lp-footer-status {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
          color: #34d399;
        }
        .lp-footer-copy {
          font-size: 0.74rem;
          color: #52525b;
        }

        /* ── Responsive Media Queries ────────────────────────────────── */
        @media (max-width: 1024px) {
          .lp-capabilities-grid,
          .lp-pipeline-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 768px) {
          .lp-nav-links {
            display: none;
          }
          .lp-hero-section {
            padding: 2.5rem 1rem 2rem;
          }
          .lp-hero-headline {
            font-size: 1.85rem;
          }
          .lp-hero-description {
            font-size: 0.92rem;
          }
          .lp-window-titlebar {
            flex-direction: column;
            align-items: flex-start;
          }
          .lp-window-address {
            max-width: 100%;
          }
          .lp-window-viewport {
            padding: 1rem;
          }
          .lp-capabilities-grid,
          .lp-pipeline-grid {
            grid-template-columns: 1fr;
          }
          .lp-cta-ribbon-content {
            padding: 2.5rem 1.25rem;
          }
          .lp-cta-heading {
            font-size: 1.45rem;
          }
          .lp-footer-content {
            flex-direction: column;
            align-items: flex-start;
          }
          .lp-footer-right {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
