"use client";

type Props = {
  siteName: string;
  onSuggest: (question: string) => void;
};

const SUGGESTIONS = [
  "What is this website about?",
  "Summarize the main content",
  "What are the key topics covered?",
  "Give me a quick overview",
];

export function WelcomeScreen({ siteName, onSuggest }: Props) {
  return (
    <div className="welcome">
      <div className="welcome-icon">💬</div>
      <h2 className="welcome-title">Chat with {siteName}</h2>
      <p className="welcome-sub">
        Ask anything about the indexed pages. Answers are grounded in the scraped content.
      </p>
      <div className="welcome-chips">
        {SUGGESTIONS.map((s) => (
          <button key={s} className="chip" onClick={() => onSuggest(s)}>
            {s}
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
          padding: 3rem 1.5rem;
          flex: 1;
          animation: fadeUp 0.5s ease both;
        }
        .welcome-icon {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          opacity: 0.8;
        }
        .welcome-title {
          margin: 0 0 0.5rem;
          font-size: 1.25rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .welcome-sub {
          margin: 0 0 1.5rem;
          font-size: 0.88rem;
          color: var(--text-muted);
          max-width: 340px;
          line-height: 1.5;
        }
        .welcome-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: center;
          max-width: 420px;
        }
        .chip {
          padding: 0.5rem 0.9rem;
          border: 1px solid var(--border-active);
          border-radius: 99px;
          background: transparent;
          color: var(--text-muted);
          font-size: 0.82rem;
          transition: all 0.15s ease;
          cursor: pointer;
        }
        .chip:hover {
          border-color: var(--accent);
          color: var(--accent);
          background: var(--accent-soft);
        }
      `}</style>
    </div>
  );
}
