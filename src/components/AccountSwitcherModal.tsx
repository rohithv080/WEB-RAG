"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useClerk, useSessionList, useUser } from "@clerk/nextjs";

export type StoredAccount = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  isAdmin: boolean;
  lastActive: number;
};

const STORAGE_KEY = "rag_account_history";
const ADMIN_EMAIL = "rohithjune05@gmail.com";

function getStoredAccounts(): StoredAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveStoredAccounts(accounts: StoredAccount[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {}
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

export function AccountSwitcherModal({ isOpen, onClose }: Props) {
  const clerk = useClerk();
  const { user, isLoaded: userLoaded } = useUser();
  const { sessions, isLoaded: sessionsLoaded, setActive } = useSessionList();

  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [fastSwitching, setFastSwitching] = useState(false);
  const [recentAccounts, setRecentAccounts] = useState<StoredAccount[]>([]);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // Sync current user to local storage memory
  useEffect(() => {
    if (!userLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email) return;

    const isAdmin =
      email === ADMIN_EMAIL ||
      user.emailAddresses.some((e) => e.emailAddress.toLowerCase() === ADMIN_EMAIL);

    const displayName =
      user.fullName || user.firstName || user.username || email.split("@")[0] || "User";

    const currentEntry: StoredAccount = {
      id: user.id,
      email,
      name: displayName,
      avatarUrl: user.imageUrl,
      isAdmin,
      lastActive: Date.now(),
    };

    const existing = getStoredAccounts().filter((a) => a.email.toLowerCase() !== email);
    const updated = [currentEntry, ...existing].slice(0, 8);
    saveStoredAccounts(updated);
    setRecentAccounts(updated);
  }, [user, userLoaded]);

  // Load stored accounts on open
  useEffect(() => {
    if (isOpen) {
      setRecentAccounts(getStoredAccounts());
      setSwitchingId(null);
      setFastSwitching(false);
    }
  }, [isOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Active user details
  const activeEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
  const activeIsAdmin =
    activeEmail === ADMIN_EMAIL ||
    user?.emailAddresses?.some((e) => e.emailAddress.toLowerCase() === ADMIN_EMAIL);
  const activeName =
    user?.fullName ||
    user?.firstName ||
    user?.username ||
    activeEmail.split("@")[0] ||
    "Active Account";

  // List of other active sessions on device
  const currentSessionId = clerk.session?.id;
  const otherSessions = useMemo(() => {
    if (!sessions || !sessionsLoaded) return [];
    return sessions.filter((s) => s.id !== currentSessionId);
  }, [sessions, sessionsLoaded, currentSessionId]);

  // Stored accounts that are not in current sessions
  const nonSessionStoredAccounts = useMemo(() => {
    const sessionEmails = new Set(
      (sessions || [])
        .map((s) => s.user?.primaryEmailAddress?.emailAddress?.toLowerCase())
        .filter(Boolean)
    );
    if (activeEmail) sessionEmails.add(activeEmail);
    return recentAccounts.filter((a) => !sessionEmails.has(a.email.toLowerCase()));
  }, [recentAccounts, sessions, activeEmail]);

  // Switch to an existing session
  async function handleSwitchSession(sessionId: string) {
    if (!setActive) return;
    setSwitchingId(sessionId);
    try {
      await setActive({ session: sessionId });
      onClose();
    } catch (err) {
      console.error("[AccountSwitcher] Failed to switch session:", err);
      setSwitchingId(null);
    }
  }

  // Add another account without signing out current
  function handleAddAccount() {
    onClose();
    try {
      clerk.openSignIn({});
    } catch (e) {
      console.error("[AccountSwitcher] openSignIn failed:", e);
    }
  }

  // Fast switch: Sign out current and immediately open sign in modal
  async function handleFastSwitchRelogin(presetEmail?: string) {
    setFastSwitching(true);
    try {
      await clerk.signOut();
      onClose();
      setTimeout(() => {
        if (presetEmail) {
          clerk.openSignIn({ initialValues: { emailAddress: presetEmail } });
        } else {
          clerk.openSignIn({});
        }
      }, 150);
    } catch (e) {
      console.error("[AccountSwitcher] Fast switch failed:", e);
      setFastSwitching(false);
    }
  }

  // Copy email to clipboard
  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    setTimeout(() => setCopiedEmail(null), 1800);
  }

  // Remove a recent account from stored history
  function handleRemoveStored(emailToRemove: string) {
    const updated = recentAccounts.filter(
      (a) => a.email.toLowerCase() !== emailToRemove.toLowerCase()
    );
    saveStoredAccounts(updated);
    setRecentAccounts(updated);
  }

  if (!isOpen) return null;

  return (
    <div className="account-modal-backdrop" onClick={onClose}>
      <div
        className="account-modal-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-switcher-title"
      >
        {/* Header */}
        <div className="modal-header">
          <div className="header-icon-box">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div className="header-text">
            <h2 id="account-switcher-title" className="modal-title">
              Switch Account Profile
            </h2>
            <p className="modal-sub">
              Instantly toggle between administrative and personal accounts on this device.
            </p>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            title="Close (Esc)"
            aria-label="Close"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* ── SECTION 1: ACTIVE CURRENT ACCOUNT ────────────────────── */}
          <div className="section-label">Currently Active</div>
          <div className={`active-account-card ${activeIsAdmin ? "admin-card" : ""}`}>
            <div className="account-main-row">
              <div className="avatar-wrap">
                {user?.imageUrl ? (
                  <img src={user.imageUrl} alt={activeName} className="user-avatar-img" />
                ) : (
                  <div className="user-avatar-fallback">{activeName.slice(0, 2).toUpperCase()}</div>
                )}
                <span className="online-beacon" title="Active on this device" />
              </div>

              <div className="account-meta">
                <div className="name-row">
                  <span className="account-name">{activeName}</span>
                  {activeIsAdmin ? (
                    <span className="badge-admin">Super Admin</span>
                  ) : (
                    <span className="badge-user">Personal</span>
                  )}
                </div>
                <div className="email-row">
                  <span className="account-email">{activeEmail || "Signed In"}</span>
                  {activeEmail && (
                    <button
                      type="button"
                      className="copy-btn"
                      onClick={() => handleCopy(activeEmail)}
                      title="Copy email address"
                    >
                      {copiedEmail === activeEmail ? "Copied" : "Copy"}
                    </button>
                  )}
                </div>
              </div>

              <div className="active-tag-wrap">
                <span className="active-tag">Active</span>
              </div>
            </div>

            <div className="active-card-actions">
              <button
                type="button"
                className="card-sub-btn"
                onClick={() => {
                  onClose();
                  clerk.openUserProfile();
                }}
              >
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
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                <span>Manage Profile</span>
              </button>

              <button
                type="button"
                className="card-sub-btn danger"
                onClick={() => {
                  onClose();
                  clerk.signOut();
                }}
              >
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
                <span>Log Out</span>
              </button>
            </div>
          </div>

          {/* ── SECTION 2: OTHER LOGGED-IN SESSIONS (1-CLICK SWITCH) ──── */}
          {otherSessions.length > 0 && (
            <div className="section-block">
              <div className="section-label">Other Active Accounts (Ready to Switch)</div>
              <div className="sessions-list">
                {otherSessions.map((session) => {
                  const sEmail =
                    session.user?.primaryEmailAddress?.emailAddress?.toLowerCase() || "";
                  const sIsAdmin = sEmail === ADMIN_EMAIL;
                  const sName =
                    session.user?.fullName ||
                    session.user?.firstName ||
                    session.user?.username ||
                    sEmail.split("@")[0] ||
                    "User";
                  const isSwitching = switchingId === session.id;

                  return (
                    <div key={session.id} className="session-item-row">
                      <div className="avatar-wrap">
                        {session.user?.imageUrl ? (
                          <img
                            src={session.user.imageUrl}
                            alt={sName}
                            className="user-avatar-img sm"
                          />
                        ) : (
                          <div className="user-avatar-fallback sm">
                            {sName.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div className="account-meta">
                        <div className="name-row">
                          <span className="account-name">{sName}</span>
                          {sIsAdmin ? (
                            <span className="badge-admin sm">Admin</span>
                          ) : (
                            <span className="badge-user sm">Personal</span>
                          )}
                        </div>
                        <span className="account-email sm">{sEmail}</span>
                      </div>

                      <button
                        type="button"
                        className="switch-now-btn"
                        onClick={() => handleSwitchSession(session.id)}
                        disabled={isSwitching}
                      >
                        {isSwitching ? (
                          <span>Switching…</span>
                        ) : (
                          <>
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="9 18 15 12 9 6" />
                            </svg>
                            <span>Switch</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── SECTION 3: FAST SWITCH & LOGIN ACTIONS ────────────────── */}
          <div className="section-block">
            <div className="section-label">Account Switch Actions</div>
            <div className="action-buttons-grid">
              <button
                type="button"
                className="action-tile-btn primary-tile"
                onClick={handleAddAccount}
                title="Add and login to another account simultaneously"
              >
                <div className="tile-icon-box accent">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                </div>
                <div className="tile-text">
                  <span className="tile-title">Add Another Account</span>
                  <span className="tile-desc">
                    Keep current session and log in to a second profile
                  </span>
                </div>
              </button>

              <button
                type="button"
                className="action-tile-btn"
                onClick={() => handleFastSwitchRelogin()}
                disabled={fastSwitching}
                title="Sign out current profile and instantly open sign-in dialog"
              >
                <div className="tile-icon-box">
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
                    <path d="M16 3h5v5" />
                    <path d="M4 20L21 3" />
                    <path d="M21 16v5h-5" />
                    <path d="M15 15l6 6" />
                    <path d="M4 4l5 5" />
                  </svg>
                </div>
                <div className="tile-text">
                  <span className="tile-title">Fast Switch / Re-Login</span>
                  <span className="tile-desc">
                    {fastSwitching
                      ? "Redirecting to login…"
                      : "Sign out & instantly open login window in 1 click"}
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* ── SECTION 4: RECENT SAVED PROFILES ──────────────────────── */}
          {nonSessionStoredAccounts.length > 0 && (
            <div className="section-block">
              <div className="section-label">Previously Used On This Machine</div>
              <div className="stored-accounts-list">
                {nonSessionStoredAccounts.map((item) => (
                  <div key={item.email} className="stored-account-row">
                    <div className="stored-meta">
                      <div className="name-row">
                        <span className="account-name sm">{item.name}</span>
                        {item.isAdmin ? (
                          <span className="badge-admin sm">Admin</span>
                        ) : (
                          <span className="badge-user sm">Personal</span>
                        )}
                      </div>
                      <span className="account-email sm">{item.email}</span>
                    </div>

                    <div className="stored-actions">
                      <button
                        type="button"
                        className="stored-login-btn"
                        onClick={() => handleFastSwitchRelogin(item.email)}
                        title={`Sign in as ${item.email}`}
                      >
                        <span>Sign In</span>
                      </button>
                      <button
                        type="button"
                        className="stored-remove-btn"
                        onClick={() => handleRemoveStored(item.email)}
                        title="Remove from history"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="footer-hint">
            <span className="kbd-pill">Esc</span> to dismiss • Seamless multi-profile management
          </div>
          <button type="button" className="footer-close-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <style jsx>{`
        .account-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.72);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
          animation: fadeIn 0.16s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .account-modal-container {
          width: 100%;
          max-width: 520px;
          background: #0d0f12;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 14px;
          box-shadow:
            0 24px 60px rgba(0, 0, 0, 0.8),
            0 0 0 1px rgba(255, 255, 255, 0.05);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: popScale 0.18s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes popScale {
          from {
            transform: scale(0.96) translateY(4px);
            opacity: 0;
          }
          to {
            transform: scale(1) translateY(0);
            opacity: 1;
          }
        }

        /* Header */
        .modal-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 1.15rem 1.35rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.02);
        }

        .header-icon-box {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--accent, #6366f1);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .header-text {
          flex: 1;
          min-width: 0;
        }

        .modal-title {
          font-size: 0.95rem;
          font-weight: 600;
          color: #f8fafc;
          letter-spacing: -0.015em;
          margin: 0;
        }

        .modal-sub {
          font-size: 0.75rem;
          color: #94a3b8;
          margin: 2px 0 0;
          line-height: 1.35;
        }

        .close-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          border: 1px solid transparent;
          background: transparent;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.12s ease;
          flex-shrink: 0;
        }
        .close-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.12);
        }

        /* Body */
        .modal-body {
          padding: 1.25rem 1.35rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          max-height: 75vh;
          overflow-y: auto;
        }

        .section-label {
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #64748b;
          margin-bottom: 0.45rem;
        }

        .section-block {
          display: flex;
          flex-direction: column;
        }

        /* Active Account Card */
        .active-account-card {
          padding: 0.85rem 1rem;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 10px;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: border-color 0.15s ease;
        }

        .active-account-card.admin-card {
          background: linear-gradient(
            135deg,
            rgba(245, 158, 11, 0.05) 0%,
            rgba(255, 255, 255, 0.02) 100%
          );
          border-color: rgba(245, 158, 11, 0.25);
        }

        .account-main-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .avatar-wrap {
          position: relative;
          flex-shrink: 0;
        }

        .user-avatar-img {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          object-fit: cover;
          border: 1.5px solid rgba(255, 255, 255, 0.15);
        }

        .user-avatar-img.sm {
          width: 32px;
          height: 32px;
        }

        .user-avatar-fallback {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #4f46e5, #06b6d4);
          color: #ffffff;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1.5px solid rgba(255, 255, 255, 0.15);
        }

        .user-avatar-fallback.sm {
          width: 32px;
          height: 32px;
          font-size: 0.75rem;
        }

        .online-beacon {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #10b981;
          border: 2px solid #0d0f12;
          box-shadow: 0 0 8px rgba(16, 185, 129, 0.7);
        }

        .account-meta {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .name-row {
          display: flex;
          align-items: center;
          gap: 7px;
          flex-wrap: wrap;
        }

        .account-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: #f1f5f9;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .account-name.sm {
          font-size: 0.78rem;
        }

        .badge-admin {
          font-size: 0.62rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 12px;
          background: rgba(245, 158, 11, 0.15);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.35);
          letter-spacing: 0.02em;
        }
        .badge-admin.sm {
          font-size: 0.58rem;
          padding: 1px 5px;
        }

        .badge-user {
          font-size: 0.62rem;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: 12px;
          background: rgba(148, 163, 184, 0.12);
          color: #94a3b8;
          border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .badge-user.sm {
          font-size: 0.58rem;
          padding: 1px 5px;
        }

        .email-row {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .account-email {
          font-size: 0.72rem;
          color: #64748b;
          font-family: var(--font-mono, monospace);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .account-email.sm {
          font-size: 0.68rem;
        }

        .copy-btn {
          background: transparent;
          border: none;
          color: #64748b;
          font-size: 0.62rem;
          cursor: pointer;
          padding: 1px 4px;
          border-radius: 3px;
          transition: all 0.1s ease;
        }
        .copy-btn:hover {
          color: #94a3b8;
          background: rgba(255, 255, 255, 0.06);
        }

        .active-tag-wrap {
          flex-shrink: 0;
        }

        .active-tag {
          font-size: 0.68rem;
          font-weight: 600;
          color: #34d399;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.25);
          padding: 3px 8px;
          border-radius: 6px;
          letter-spacing: 0.02em;
        }

        .active-card-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-top: 0.6rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .card-sub-btn {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .card-sub-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.16);
          color: #ffffff;
        }

        .card-sub-btn.danger {
          color: #f87171;
          background: rgba(248, 113, 113, 0.04);
          border-color: rgba(248, 113, 113, 0.15);
        }
        .card-sub-btn.danger:hover {
          background: rgba(248, 113, 113, 0.12);
          border-color: rgba(248, 113, 113, 0.3);
          color: #fca5a5;
        }

        /* Sessions List */
        .sessions-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .session-item-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0.6rem 0.85rem;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 8px;
          transition: all 0.12s ease;
        }
        .session-item-row:hover {
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(255, 255, 255, 0.12);
        }

        .switch-now-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 600;
          background: var(--accent, #6366f1);
          border: 1px solid transparent;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.12s ease;
          flex-shrink: 0;
        }
        .switch-now-btn:hover:not(:disabled) {
          filter: brightness(1.1);
          transform: translateX(1px);
        }
        .switch-now-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* Action Buttons Grid */
        .action-buttons-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }

        @media (max-width: 480px) {
          .action-buttons-grid {
            grid-template-columns: 1fr;
          }
        }

        .action-tile-btn {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 0.75rem 0.85rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
          cursor: pointer;
          text-align: left;
          transition: all 0.14s ease;
        }
        .action-tile-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
        }
        .action-tile-btn.primary-tile {
          border-color: rgba(99, 102, 241, 0.25);
          background: rgba(99, 102, 241, 0.04);
        }
        .action-tile-btn.primary-tile:hover {
          background: rgba(99, 102, 241, 0.08);
          border-color: rgba(99, 102, 241, 0.4);
        }

        .tile-icon-box {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #94a3b8;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .tile-icon-box.accent {
          background: rgba(99, 102, 241, 0.15);
          border-color: rgba(99, 102, 241, 0.3);
          color: #818cf8;
        }

        .tile-text {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .tile-title {
          font-size: 0.76rem;
          font-weight: 600;
          color: #f1f5f9;
        }

        .tile-desc {
          font-size: 0.65rem;
          color: #64748b;
          line-height: 1.3;
        }

        /* Stored Accounts List */
        .stored-accounts-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .stored-account-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.5rem 0.75rem;
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 6px;
        }

        .stored-meta {
          display: flex;
          flex-direction: column;
          gap: 1px;
          min-width: 0;
        }

        .stored-actions {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .stored-login-btn {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.68rem;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.1s ease;
        }
        .stored-login-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .stored-remove-btn {
          width: 18px;
          height: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: transparent;
          color: #475569;
          font-size: 0.8rem;
          cursor: pointer;
          border-radius: 3px;
        }
        .stored-remove-btn:hover {
          color: #f87171;
          background: rgba(248, 113, 113, 0.1);
        }

        /* Footer */
        .modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1.35rem;
          border-top: 1px solid rgba(255, 255, 255, 0.06);
          background: rgba(255, 255, 255, 0.015);
        }

        .footer-hint {
          font-size: 0.68rem;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .kbd-pill {
          padding: 1px 5px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #94a3b8;
          font-family: var(--font-mono, monospace);
          font-size: 0.64rem;
        }

        .footer-close-btn {
          padding: 5px 14px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 500;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #cbd5e1;
          cursor: pointer;
          transition: all 0.12s ease;
        }
        .footer-close-btn:hover {
          background: rgba(255, 255, 255, 0.09);
          border-color: rgba(255, 255, 255, 0.18);
          color: #ffffff;
        }
      `}</style>
    </div>
  );
}
