"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

import { useAuth } from "@/components/auth-provider";
import { loginDestination } from "@/lib/login-destination";
import { PasswordField } from "@/components/ui/password-field";
import { useT } from "@/components/i18n-provider";

type Mode = "login" | "signup" | "forgot";

export default function LoginPage() {
  return <Suspense fallback={<p role="status">Loading sign-in...</p>}><LoginForm /></Suspense>;
}

function LoginForm() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const { user, loading, permissionsLoading, role, permissions, profileError, signOut, error: authError } = useAuth();
  useEffect(() => {
    if (!loading && !permissionsLoading && user && !profileError && !authError) {
      router.replace(loginDestination(next, role, permissions));
    }
  }, [loading, permissionsLoading, role, permissions, user, router, next, profileError, authError]);
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function switchMode(target: Mode) {
    setMode(target);
    setError("");
    setMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const email = String(form.get("email")).trim();
      const client = getSupabase();
      if (mode === "forgot") {
        const { error: resetError } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        // The same message is shown whether or not the address has an account.
        setMessage("If an account exists for that email, we have sent a link to reset your password.");
        return;
      }
      const credentials = { email, password: String(form.get("password")) };
      const result =
        mode === "login"
          ? await client.auth.signInWithPassword(credentials)
          : await client.auth.signUp(credentials);
      if (result.error) throw result.error;
      if (!result.data.session)
        setMessage(
          "Check your email to confirm your account, then come back here to sign in.",
        );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (profileError) return <section className="panel"><p role="alert">{profileError}</p>
    <button onClick={() => void signOut().catch(() => setError("Unable to sign out. Refresh the page to try again."))}>Sign in again</button>
    {error && <p role="alert">{error}</p>}
  </section>;
  if (loading || permissionsLoading || (user && !authError))
    return (
      <p role="status">
        {loading ? "Checking your session..." : "Redirecting..."}
      </p>
    );
  if (authError)
    return (
      <p role="alert" className="notice error">
        {authError}
      </p>
    );

  const heading = t(`login.title.${mode}`);
  const intro = t(`login.intro.${mode}`);
  const submitLabel = t(`login.submit.${mode}`);

  return (
    <section className="auth-wrap">
      <div className="auth-card panel">
        <div className="auth-heading"><p className="eyebrow">{t("login.eyebrow")}</p></div>
        <h1>{heading}</h1>
        <p className="intro">{intro}</p>
        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
          <div className="ui-field">
            <label htmlFor="login-email">{t("login.email")}</label>
            <input id="login-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" disabled={busy} required />
          </div>
          {mode !== "forgot" && (
            <PasswordField
              key={mode}
              id="login-password"
              label={t("login.password")}
              name="password"
              minLength={mode === "signup" ? 8 : undefined}
              disabled={busy}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          )}
          {mode === "login" && (
            <button type="button" className="text-button auth-forgot" disabled={busy} onClick={() => switchMode("forgot")}>
              {t("login.forgot")}
            </button>
          )}
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <button className="ui-button ui-button-primary auth-submit" disabled={busy}>
            {busy ? "Please wait…" : submitLabel}
          </button>
        </form>
        <p className="privacy-line"><svg aria-hidden="true" width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>{t("login.privacy")}</p>
        <div className="auth-links">
          {mode === "login" ? (
            <button className="text-button" type="button" disabled={busy} onClick={() => switchMode("signup")}>{t("login.create")}</button>
          ) : (
            <button className="text-button" type="button" disabled={busy} onClick={() => switchMode("login")}>{mode === "signup" ? t("login.have") : t("login.back")}</button>
          )}
          <Link href="/listings">{t("login.browse")}</Link>
        </div>
      </div>
    </section>
  );
}
