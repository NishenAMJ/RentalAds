"use client";

import { Suspense, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";

import { useAuth } from "@/components/auth-provider";
import { loginDestination } from "@/lib/login-destination";
import { PasswordField } from "@/components/ui/password-field";
import { useT } from "@/components/i18n-provider";
import { AuthTopbar } from "@/components/auth-topbar";

type Mode = "login" | "signup" | "forgot";

const ASIDE_POINTS = ["home.pillar2", "home.pillar3"] as const;

/** The centred card used for loading and error states, so none of them appear unstyled. */
function AuthShell({ children }: { children: ReactNode }) {
  return <section className="auth-wrap"><AuthTopbar /><div className="auth-card panel">{children}</div></section>;
}

function authErrorMessage(cause: unknown): string {
  const message = cause instanceof Error ? cause.message.toLowerCase() : "";
  if (message.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (message.includes("user already registered")) return "An account already exists for this email. Try signing in instead.";
  if (message.includes("email not confirmed")) return "Please confirm your email before signing in.";
  return cause instanceof Error ? cause.message : "Sign-in failed. Please try again.";
}

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
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  if (profileError) return <AuthShell><p role="alert">{profileError}</p>
    <button className="ui-button ui-button-primary auth-submit" onClick={() => void signOut().catch(() => setError("Unable to sign out. Refresh the page to try again."))}>Sign in again</button>
    {error && <p role="alert">{error}</p>}
  </AuthShell>;
  if (loading || permissionsLoading || (user && !authError))
    return <AuthShell><p role="status">{loading ? "Checking your session..." : "Redirecting..."}</p></AuthShell>;
  if (authError) return <AuthShell><p role="alert" className="notice error">{authError}</p></AuthShell>;

  const heading = t(`login.title.${mode}`);
  const intro = t(`login.intro.${mode}`);
  const submitLabel = t(`login.submit.${mode}`);

  return (
    <section className="auth-layout">
      <AuthTopbar />
      <aside className="auth-aside">
        <p className="eyebrow">RentalHub Sri Lanka</p>
        <h2>{t("home.title1")} <em>{t("home.title2")}</em></h2>
        <ul className="auth-points">{ASIDE_POINTS.map((key) =>
          <li key={key}><h3>{t(`${key}.title`)}</h3><p>{t(`${key}.body`)}</p></li>)}</ul>
      </aside>
      <div className="auth-card panel">
        {mode !== "forgot" && (
          <div className="segmented auth-tabs" role="tablist" aria-label={t("login.eyebrow")}>
            <button type="button" role="tab" aria-selected={mode === "login"} disabled={busy} onClick={() => switchMode("login")}>{t("nav.signIn")}</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} disabled={busy} onClick={() => switchMode("signup")}>{t("login.create")}</button>
          </div>
        )}
        <p className="eyebrow">{t("login.eyebrow")}</p>
        <h1>{heading}</h1>
        <p className="intro">{intro}</p>
        <form className="auth-form" onSubmit={submit} aria-busy={busy}>
          <div className="ui-field">
            <label htmlFor="login-email">{t("login.email")}</label>
            <input id="login-email" name="email" type="email" autoComplete="email" placeholder="name@example.com" disabled={busy} required />
          </div>
          {mode !== "forgot" && (
            <>
              <PasswordField
                key={mode}
                id="login-password"
                label={t("login.password")}
                name="password"
                minLength={mode === "signup" ? 8 : undefined}
                disabled={busy}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                aria-describedby={mode === "signup" ? "password-help" : undefined}
                required
              />
              {mode === "signup" && <small id="password-help" className="small-copy">Use at least 8 characters. A unique password helps protect your rental account.</small>}
            </>
          )}
          {mode === "login" && (
            <button type="button" className="text-button auth-forgot" disabled={busy} onClick={() => switchMode("forgot")}>
              {t("login.forgot")}
            </button>
          )}
          {error && <p className="notice error" role="alert">{error}</p>}
          {message && <p className="notice" role="status">{message}</p>}
          <button className="ui-button ui-button-primary auth-submit" disabled={busy}>
            {busy ? "Please wait…" : submitLabel}
          </button>
        </form>
        <p className="privacy-line"><svg aria-hidden="true" width="14" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>{t("login.privacy")}</p>
        <div className="auth-links">
          {mode === "forgot" ? <button className="text-button" type="button" disabled={busy} onClick={() => switchMode("login")}>{t("login.back")}</button> : <span />}
          <Link href="/listings">{t("login.browse")}</Link>
        </div>
      </div>
    </section>
  );
}
