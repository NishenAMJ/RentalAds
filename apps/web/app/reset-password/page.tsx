"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { PasswordField } from "@/components/ui/password-field";

const MIN_LENGTH = 8;

/** Landing page for the emailed recovery link. The link signs the user in briefly so they can choose a new password. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) { setError("The two passwords do not match."); return; }
    if (password.length < MIN_LENGTH) { setError(`Use at least ${MIN_LENGTH} characters.`); return; }
    setBusy(true);
    setError("");
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      window.setTimeout(() => router.replace("/"), 1500);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not update your password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth-wrap">
      <div className="auth-card panel">
        <p className="eyebrow">Your rental account</p>
        <h1>Choose a new password.</h1>
        {loading ? <p role="status">Checking your link…</p>
          : !user ? <>
            <p role="alert" className="notice error">This reset link is invalid or has expired.</p>
            <p><Link href="/login">Request a new link</Link></p>
          </>
          : done ? <p role="status" className="notice">Your password has been updated. Redirecting…</p>
          : <form className="auth-form" onSubmit={submit} aria-busy={busy}>
            <p className="small-copy">Use at least {MIN_LENGTH} characters and avoid reusing an important password.</p>
            <PasswordField id="new-password" name="password" label="New password" minLength={MIN_LENGTH} autoComplete="new-password" disabled={busy} required />
            <PasswordField id="confirm-password" name="confirm" label="Confirm new password" minLength={MIN_LENGTH} autoComplete="new-password" disabled={busy} required />
            {error && <p className="notice error" role="alert">{error}</p>}
            <button className="ui-button ui-button-primary auth-submit" disabled={busy}>{busy ? "Please wait…" : "Update password →"}</button>
          </form>}
      </div>
    </section>
  );
}
