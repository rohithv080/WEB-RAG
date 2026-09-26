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
  const displayName =
    user?.firstName || user?.username || userEmails[0]?.split("@")[0] || "Workspace";

  return (
    <div className="auth-bar">
      <Show when="signed-in">
        <div className="signed-in-card">
          <div className="user-profile-row">
            <UserButton />
            <div className="user-text-col">
              <span className="user-name">{displayName}</span>
              {isAdmin ? (
                <span className="admin-badge-pill">Admin</span>
              ) : (
                <span className="user-sub">Personal</span>
              )}
            </div>
          </div>
          <SignOutButton>
            <button className="logout-icon-btn" title="Sign out / Log out">
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
          padding: 0.4rem 0.55rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border);
          border-radius: 6px;
          transition: all 0.12s ease;
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
          min-width: 0;
        }

        .user-name {
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .user-sub {
          font-size: 0.62rem;
          color: var(--text-dim);
        }

        .admin-badge-pill {
          font-size: 0.62rem;
          font-weight: 600;
          color: var(--accent);
          letter-spacing: 0.02em;
        }

        .logout-icon-btn {
          width: 24px;
          height: 24px;
          border-radius: 4px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-dim);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
          flex-shrink: 0;
        }
        .logout-icon-btn:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.3);
          background: rgba(248, 113, 113, 0.08);
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
          padding: 0.42rem 0.55rem;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.12s ease;
        }

        .sign-in-btn {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--text-muted);
        }
        .sign-in-btn:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.16);
          color: #ffffff;
        }

        .sign-up-btn {
          background: var(--accent);
          border: 1px solid transparent;
          color: #ffffff;
        }
        .sign-up-btn:hover {
          background: #6e6eff;
        }
      `}</style>
    </div>
  );
}
