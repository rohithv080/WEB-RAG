"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  SignOutButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

export function AuthBar() {
  const hasClerkKey = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

  if (!hasClerkKey) {
    return (
      <div className="auth-bar-fallback">
        <div className="status-badge">
          <span className="status-dot" />
          <span>Public Workspace</span>
        </div>
        <span className="auth-hint">Free Tier</span>

        <style jsx>{`
          .auth-bar-fallback {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.5rem 0.7rem;
            margin: 0 0.5rem 0.5rem;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 0.75rem;
          }
          .status-badge {
            display: flex;
            align-items: center;
            gap: 6px;
            color: var(--text-muted);
            font-weight: 500;
          }
          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: #34d399;
            box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
          }
          .auth-hint {
            color: var(--text-dim);
            font-size: 0.68rem;
            font-family: var(--font-mono);
          }
        `}</style>
      </div>
    );
  }

  const { user } = useUser();
  const adminEmail = "rohithjune05@gmail.com";
  const userEmails = user?.emailAddresses?.map((e) => e.emailAddress.toLowerCase()) || [];
  const isAdmin = userEmails.includes(adminEmail);
  const displayName = user?.firstName || user?.username || userEmails[0]?.split("@")[0] || "Workspace";

  return (
    <div className="auth-bar">
      <Show when="signed-in">
        <div className="signed-in-card">
          <div className="user-profile-row">
            <UserButton />
            <div className="user-text-col">
              <span className="user-name">{displayName}</span>
              {isAdmin ? (
                <span className="admin-badge-pill">🛡️ Super Admin</span>
              ) : (
                <span className="user-sub">Personal Account</span>
              )}
            </div>
          </div>
          <SignOutButton>
            <button className="logout-icon-btn" title="Sign out / Log out">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </SignOutButton>
        </div>
      </Show>

      <Show when="signed-out">
        <div className="auth-button-group">
          <SignInButton mode="modal">
            <button className="auth-btn sign-in-btn">
              <span>Sign In</span>
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="auth-btn sign-up-btn">
              <span>Sign Up</span>
            </button>
          </SignUpButton>
        </div>
      </Show>

      <style jsx>{`
        .auth-bar {
          margin: 0 0.5rem 0.5rem;
        }

        .signed-in-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.45rem 0.65rem;
          background: rgba(255, 255, 255, 0.035);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius);
          transition: all 0.15s ease;
        }
        .signed-in-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .user-profile-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .user-text-col {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .user-name {
          font-size: 0.8rem;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-sub {
          font-size: 0.64rem;
          color: var(--text-dim);
        }

        .admin-badge-pill {
          font-size: 0.62rem;
          font-weight: 700;
          color: #c084fc;
          letter-spacing: 0.02em;
        }

        .logout-icon-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
          color: var(--text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.15s ease;
          flex-shrink: 0;
        }
        .logout-icon-btn:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.4);
          background: rgba(248, 113, 113, 0.1);
        }

        .auth-button-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
        }

        .auth-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.5rem 0.6rem;
          border-radius: 8px;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .sign-in-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: var(--text);
        }
        .sign-in-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          color: #ffffff;
        }

        .sign-up-btn {
          background: linear-gradient(135deg, rgba(79, 110, 247, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%);
          border: 1px solid rgba(129, 140, 248, 0.35);
          color: #c7d2fe;
        }
        .sign-up-btn:hover {
          background: linear-gradient(135deg, rgba(79, 110, 247, 0.35) 0%, rgba(139, 92, 246, 0.35) 100%);
          border-color: rgba(129, 140, 248, 0.5);
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
