"use client";

type Props = {
  siteName: string;
  onSuggest: (question: string) => void;
  starterQuestions?: string[] | null;
};

type CardPrompt = {
  icon: React.ReactNode;
  title: string;
  question: string;
  desc?: string;
};

function IconDoc() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function IconZap() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

const DEFAULT_CARDS: CardPrompt[] = [
  {
    icon: <IconDoc />,
    title: "Executive Summary",
    question: "What is this website about?",
    desc: "Overview of core purpose and content",
  },
  {
    icon: <IconSearch />,
    title: "Key Highlights",
    question: "Summarize the main content and key takeaways",
    desc: "Essential topics and primary findings",
  },
  {
    icon: <IconLayers />,
    title: "Deep Analysis",
    question: "What are the primary capabilities and topics covered?",
    desc: "In-depth breakdown of features and details",
  },
  {
    icon: <IconZap />,
    title: "Quick Overview",
    question: "Give me a quick bullet-point summary",
    desc: "Concise snapshot of available knowledge",
  },
];

export function WelcomeScreen({ siteName, onSuggest, starterQuestions }: Props) {
  const cards: CardPrompt[] =
    starterQuestions && starterQuestions.length > 0
      ? starterQuestions.map((q, idx) => {
          const defaultRef = DEFAULT_CARDS[idx % DEFAULT_CARDS.length];
          return {
            icon: defaultRef.icon,
            title: `Suggested Prompt ${idx + 1}`,
            question: q,
            desc: q.length > 50 ? q.slice(0, 50) + "…" : "Click to ask directly",
          };
        })
      : DEFAULT_CARDS;

  return (
    <div className="welcome">
      <div className="welcome-emblem">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <polygon
            points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
            fill="currentColor"
            stroke="none"
          />
        </svg>
      </div>

      <h2 className="welcome-title">{siteName}</h2>

      <p className="welcome-sub">
        Ask questions grounded strictly in indexed sources. If local documents lack answers, the
        assistant consults live web search automatically.
      </p>

      {/* Feature Capability Badges */}
      <div className="welcome-capabilities">
        <span className="cap-pill" title="Answers grounded strictly in retrieved chunks">
          <IconShield />
          <span>Verified Grounding</span>
        </span>
        <span className="cap-pill" title="Real-time web search fallback when confidence is low">
          <IconGlobe />
          <span>Live Web Fallback</span>
        </span>
        <span className="cap-pill" title="Powered by Groq High-Speed Llama 3.3 70B">
          <IconZap />
          <span>Llama 3.3 70B</span>
        </span>
      </div>

      {/* 2x2 Interactive Prompt Card Grid */}
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
              <span className="card-arrow">&nearr;</span>
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
          animation: welcomeFadeIn 0.3s ease both;
          user-select: none;
        }

        @keyframes welcomeFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .welcome-emblem {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          background: #141418;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #3b82f6;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1rem;
        }

        .welcome-title {
          margin: 0 0 0.5rem;
          font-size: 1.35rem;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: #fafafa;
        }

        .welcome-sub {
          margin: 0 0 1.25rem;
          font-size: 0.86rem;
          color: #a1a1aa;
          line-height: 1.55;
          max-width: 520px;
        }

        .welcome-capabilities {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 2rem;
        }

        .cap-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.25rem 0.65rem;
          border-radius: 5px;
          font-size: 0.74rem;
          font-weight: 500;
          color: #d4d4d8;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.07);
        }

        .welcome-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
          width: 100%;
          text-align: left;
        }

        .prompt-card {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding: 1rem 1.1rem;
          background: #0d0d10;
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
          color: inherit;
        }

        .prompt-card:hover {
          background: #111115;
          border-color: rgba(255, 255, 255, 0.18);
          transform: translateY(-1px);
        }

        .card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
        }

        .card-icon-title {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        .card-icon {
          color: #3b82f6;
          display: flex;
          align-items: center;
        }

        .card-title {
          font-size: 0.78rem;
          font-weight: 600;
          color: #fafafa;
          letter-spacing: -0.01em;
        }

        .card-arrow {
          font-size: 0.85rem;
          color: #71717a;
          transition: color 0.12s ease;
        }

        .prompt-card:hover .card-arrow {
          color: #ffffff;
        }

        .card-question {
          margin: 0;
          font-size: 0.82rem;
          font-weight: 500;
          color: #d4d4d8;
          line-height: 1.45;
        }

        .card-desc {
          font-size: 0.73rem;
          color: #71717a;
        }

        @media (max-width: 600px) {
          .welcome-grid {
            grid-template-columns: 1fr;
          }
          .welcome {
            padding: 1.5rem 0.5rem;
          }
        }
      `}</style>
    </div>
  );
}
