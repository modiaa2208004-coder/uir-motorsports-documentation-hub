"use client";

import { useState } from "react";
import type { AppUser } from "../roles";

export default function LoginForm({ users }: { users: AppUser[] }) {
  const [userId, setUserId] = useState(users[0]?.id || "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "Unable to sign in");
      window.location.assign("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in");
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <span className="auth-mark">UIR</span>
        <small className="auth-kicker">UIR MOTORSPORTS · DOCUMENTATION HUB</small>
        <h1>Sign in to the engineering workspace.</h1>
        <p>Local development mode is active. Choose a team identity to test permissions and workflow behavior.</p>
        <label className="auth-label" htmlFor="local-user">Sign in as</label>
        <select id="local-user" value={userId} onChange={(event) => setUserId(event.target.value)}>
          {users.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.roles?.join(", ") || user.role}</option>)}
        </select>
        {error && <p className="auth-error">{error}</p>}
        <button className="primary auth-submit" onClick={() => void signIn()} disabled={busy || !userId}>
          {busy ? "Signing in…" : "Continue to workspace →"}
        </button>
        <small className="auth-note">This local impersonation is disabled when <code>AUTH_MODE=entra</code>.</small>
      </section>
    </main>
  );
}
