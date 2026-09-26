"use client";

type Props = {
  siteName: string;
  onSuggest: (question: string) => void;
  starterQuestions?: string[] | null;
};

type CardPrompt = {
  icon: string;
  title: string;
  question: string;
  desc?: string;
};

const DEFAULT_CARDS: CardPrompt[] = [
  {
    icon: "💡",
    title: "Executive Summary",
    question: "What is this website about?",
    desc: "Overview of core purpose and content",
  },
  {
    icon: "🔍",
    title: "Key Highlights",
    question: "Summarize the main content and takeaways",
    desc: "Key topics, structure, and essential points",
  },
  {
    icon: "📊",
    title: "Deep Analysis",
    question: "What are the primary capabilities and topics covered?",
    desc: "In-depth breakdown of features and details",
  },
  {
    icon: "⚡",
    title: "Quick Overview",
    question: "Give me a quick bullet-point summary",
    desc: "Concise snapshot of available knowledge",
  },
];

export function WelcomeScreen({ siteName, onSuggest, starterQuestions }: Props) {
  // If custom starter questions are configured on the bot, format them into rich cards
  const cards: CardPrompt[] =
    starterQuestions && starterQuestions.length > 0
      ? starterQuestions.map((q, idx) => {
          const defaultRef = DEFAULT_CARDS[idx % DEFAULT_CARDS.length];
          return {
            icon: defaultRef.icon,
            title: `Suggested Prompt ${idx + 1}`,
            question: q,
            desc: q.length > 50 ? q.slice(0, 50) + "…" : "Click to ask this prompt directly",
          };
        })
      : DEFAULT_CARDS;

  return (
    <div className="welcome">
      {/* Ambient background glow & Avatar */}
      <div className="welcome-hero-badge">
        <div className="welcome-glow" />
        <div className="welcome-icon-box">
          <span className="welcome-sparkle">✦</span>
        </div>
      </div>

      <h2 className="welcome-title">
        Chat with <span className="welcome-site-gradient">{siteName}</span>
      </h2>

      <p className="welcome-sub">
        Ask any question grounded in indexed documents. If local documents lack answers, the
        assistant automatically consults live web search.
      </p>

      {/* Feature Capability Badges */}
      <div className="welcome-capabilities">
        <span
          className="cap-pill verified-cap"
          title="Answers grounded strictly in retrieved chunks"
        >
          <span className="cap-dot dot-emerald" />
          🛡️ Verified Grounding
        </span>
        <span
          className="cap-pill web-cap"
          title="Real-time web search fallback when confidence is low"
        >
          <span className="cap-dot dot-cyan" />
          🌐 Live Web Fallback
        </span>
        <span className="cap-pill model-cap" title="Powered by Groq High-Speed Llama 3.3 70B">
          <span className="cap-dot dot-indigo" />⚡ Llama 3.3 70B
        </span>
      </div>

      {/* Perplexity-style 2x2 Interactive Prompt Card Grid */}
      <div className="welcome-grid">
        {cards.map((card, idx) => (
          <button
            key={idx}
            type="button"
            className="prompt-card"
            onClick={() => onSuggest(card.question)}
            title={`Ask: "${card.question}"`}
          >
            <div className="card-top">
              <div className="card-icon-title">
                <span className="card-icon">{card.icon}</span>
                <span className="card-title">{card.title}</span>
              </div>
              <span className="card-arrow">↗</span>
            </div>
            <p className="card-question">&ldquo;{card.question}&rdquo;</p>
            {card.desc && <span className="card-desc">{card.desc}</span>}
          </button>
        ))}
      </div>

      <style jsx>{`
        .welcome {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 2.5rem 1.25rem 2rem;
          max-width: 680px;
          margin: 0 auto;
          width: 100%;
          animation: welcomeFadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
          user-select: none;
        }

        @keyframes welcomeFadeIn {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        /* ── Hero Avatar & Glowing Aura ────────────────────────────── */
        .welcome-hero-badge {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.25rem;
        }

        .welcome-glow {
          position: absolute;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(99, 102, 241, 0.4) 0%,
            rgba(139, 92, 246, 0.15) 50%,
            transparent 70%
          );
          filter: blur(14px);
          pointer-events: none;
          animation: glowPulse 3s ease-in-out infinite alternate;
        }

        @keyframes glowPulse {
          0% {
            transform: scale(0.9);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.15);
            opacity: 1;
          }
        }

        .welcome-icon-box {
          position: relative;
          width: 52px;
          height: 52px;
          border-radius: 16px;
          background: linear-gradient(
            135deg,
            rgba(99, 102, 241, 0.25) 0%,
            rgba(168, 85, 247, 0.15) 100%
          );
          border: 1px solid rgba(139, 92, 246, 0.4);
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.4),
            inset 0 1px 1px rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
        }

        .welcome-sparkle {
          font-size: 1.5rem;
          color: #c4b5fd;
          filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.8));
        }

        /* ── Typography ────────────────────────────────────────────── */
        .welcome-title {
          margin: 0 0 0.5rem;
          font-size: 1.5rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: #f8fafc;
          line-height: 1.25;
        }

        .welcome-site-gradient {
          background: linear-gradient(135deg, #a5b4fc 0%, #c084fc 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .welcome-sub {
          margin: 0 0 1.25rem;
          font-size: 0.86rem;
          color: #94a3b8;
          max-width: 480px;
          line-height: 1.55;
        }

        /* ── Capability Badges ─────────────────────────────────────── */
        .welcome-capabilities {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
          margin-bottom: 2rem;
        }

        .cap-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          transition: all 0.15s ease;
        }

        .cap-pill:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
        }

        .cap-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
        }

        .dot-emerald {
          background: #34d399;
          box-shadow: 0 0 6px #34d399;
        }
        .dot-cyan {
          background: #22d3ee;
          box-shadow: 0 0 6px #22d3ee;
        }
        .dot-indigo {
          background: #818cf8;
          box-shadow: 0 0 6px #818cf8;
        }

        /* ── 2x2 Interactive Card Grid ─────────────────────────────── */
        .welcome-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          width: 100%;
        }

        @media (max-width: 600px) {
          .welcome-grid {
            grid-template-columns: 1fr;
          }
        }

        .prompt-card {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          padding: 0.95rem 1.05rem;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
          position: relative;
          overflow: hidden;
        }

        .prompt-card::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
            circle at top left,
            rgba(99, 102, 241, 0.12) 0%,
            transparent 70%
          );
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }

        .prompt-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(99, 102, 241, 0.4);
          transform: translateY(-2px);
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.4),
            0 0 16px rgba(99, 102, 241, 0.12);
        }

        .prompt-card:hover::before {
          opacity: 1;
        }

        .prompt-card:active {
          transform: translateY(0) scale(0.99);
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          margin-bottom: 0.4rem;
        }

        .card-icon-title {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .card-icon {
          font-size: 0.9rem;
        }

        .card-title {
          font-size: 0.74rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: #a5b4fc;
          text-transform: uppercase;
        }

        .card-arrow {
          font-size: 0.75rem;
          color: #64748b;
          transition:
            transform 0.15s ease,
            color 0.15s ease;
        }

        .prompt-card:hover .card-arrow {
          color: #818cf8;
          transform: translate(2px, -2px);
        }

        .card-question {
          margin: 0 0 0.3rem;
          font-size: 0.85rem;
          font-weight: 500;
          color: #f1f5f9;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .prompt-card:hover .card-question {
          color: #ffffff;
        }

        .card-desc {
          font-size: 0.73rem;
          color: #64748b;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
}
