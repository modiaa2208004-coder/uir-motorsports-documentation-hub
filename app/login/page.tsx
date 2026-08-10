import { redirect } from "next/navigation";
import { authMode, getCurrentUser, localLoginUsers } from "../auth";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const mode = authMode();
  const error = (await searchParams).error;

  if (mode !== "local") {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <span className="auth-mark">UIR</span>
          <small className="auth-kicker">UIR MOTORSPORTS · DOCUMENTATION HUB</small>
          <h1>Sign in to the engineering workspace.</h1>
          <p>Use your organization account to access controlled engineering records and evidence.</p>
          {error && <p className="auth-error">{decodeURIComponent(error)}</p>}
          {mode === "entra" ? <a className="primary auth-submit auth-link" href="/api/auth/entra/login">Continue with Microsoft Entra ID →</a> : <p>Set <code>AUTH_MODE=local</code> for local testing.</p>}
        </section>
      </main>
    );
  }

  return <LoginForm users={await localLoginUsers()} />;
}
