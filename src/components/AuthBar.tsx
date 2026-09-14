"use client";

import {
  Show,
  SignInButton,
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

  return (
    <div className="auth-bar">
      <Show when="signed-in">
        <div className="signed-in-user">
          <UserButton />
          <div className="user-text-col">
            <span className="user-label">My Workspace</span>
            {isAdmin && <span className="admin-badge-pill">🛡️ Super Admin</span>}
          </div>
        </div>
      </Show>

      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="sign-in-btn">
            <span>👤 Sign In / Register</span>
          </button>
        </SignInButton>
      </Show>

      <style jsx>{`
        .auth-bar {
          margin: 0 0.5rem 0.5rem;
        }
        .signed-in-user {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0.4rem 0.6rem;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
        }
        .user-text-col {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }
        .user-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: #f1f5f9;
        }
        .admin-badge-pill {
          font-size: 0.62rem;
          font-weight: 700;
          color: #c084fc;
          letter-spacing: 0.02em;
        }
        .sign-in-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 0.55rem 0.75rem;
          background: rgba(56, 189, 248, 0.12);
          border: 1px solid rgba(56, 189, 248, 0.25);
          border-radius: 8px;
          color: #38bdf8;
          font-size: 0.78rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .sign-in-btn:hover {
          background: rgba(56, 189, 248, 0.22);
          color: #fff;
          border-color: #38bdf8;
        }
      `}</style>
    </div>
  );
}
