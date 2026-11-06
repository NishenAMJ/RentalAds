"use client";

import { useState, type FormEvent } from "react";
import { RequireSession } from "@/components/require-session";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api-client";
import { getSupabase } from "@/lib/supabase";
import { PasswordField } from "@/components/ui/password-field";

const CONFIRM_WORD = "DELETE";

function download(filename: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function Account() {
  const { user, signOut } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState(String(user?.user_metadata?.username ?? ""));
  const [saving, setSaving] = useState("");

  async function updateEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const email = String(form.get("new-email") ?? "").trim();
    setSaving("email"); setError(""); setMessage("");
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ email });
      if (updateError) throw updateError;
      setMessage("Check your inbox to confirm the email change. Your sign-in email updates after confirmation.");
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your email.");
    } finally { setSaving(""); }
  }

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const formElement = event.currentTarget;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("new-password") ?? "");
    const confirmation = String(form.get("confirm-password") ?? "");
    if (password.length < 8) { setError("Use at least 8 characters for your password."); return; }
    if (password !== confirmation) { setError("The passwords do not match."); return; }
    setSaving("password"); setError(""); setMessage("");
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Your password has been changed.");
      formElement.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to change your password.");
    } finally { setSaving(""); }
  }

  async function updateUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const normalized = username.trim();
    if (!/^[A-Za-z0-9_]{3,24}$/.test(normalized)) { setError("Use 3–24 letters, numbers, or underscores for your username."); return; }
    setSaving("username"); setError(""); setMessage("");
    try {
      const { error: updateError } = await getSupabase().auth.updateUser({ data: { ...user?.user_metadata, username: normalized } });
      if (updateError) throw updateError;
      setMessage("Your username has been updated.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your username.");
    } finally { setSaving(""); }
  }

  async function exportData() {
    if (exporting) return;
    setExporting(true); setError(""); setMessage("");
    try {
      const data = await apiRequest("/users/me/export", { authenticated: true });
      download("rentalhub-sri-lanka-my-data.json", data);
      setMessage("Your data has been downloaded.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to export your data.");
    } finally { setExporting(false); }
  }

  async function deleteAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleting || confirm !== CONFIRM_WORD) return;
    setDeleting(true); setError(""); setMessage("");
    try {
      await apiRequest("/users/me/delete", { method: "POST", authenticated: true, body: JSON.stringify({ confirm }) });
      await signOut().catch(() => undefined);
      // A full page load clears all in-memory account state and avoids racing the sign-in redirect.
      window.location.href = window.location.origin;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to delete your account.");
      setDeleting(false);
    }
  }

  return (
    <section className="account-page">
      <header className="account-heading"><div><p className="eyebrow">Your account</p><h1>Account and privacy</h1>
        <p className="intro">Manage your personal data and account access.</p></div></header>
      {error && <p role="alert" className="notice error">{error}</p>}
      {message && <p role="status" className="notice">{message}</p>}
      <section className="account-profile panel" aria-label="Signed-in account">
        <span className="account-profile-avatar" aria-hidden="true">{user?.email?.charAt(0).toUpperCase() ?? "U"}</span>
        <div><span className="account-card-kicker">SIGNED IN AS</span><h2>{username || user?.email}</h2><p>{user?.email}</p></div>
      </section>
      <section className="account-settings-grid" aria-label="Sign-in and profile settings">
        <form className="panel account-card account-setting-card" onSubmit={updateUsername}>
          <span className="account-card-kicker">PROFILE</span><h2>Username</h2><p>Choose a profile name for your RentalHub account.</p>
          <label htmlFor="account-username">Username<input id="account-username" name="username" autoComplete="username" maxLength={24} value={username} onChange={event => setUsername(event.target.value)} placeholder="e.g. islandhome24" pattern="[A-Za-z0-9_]{3,24}" required /></label>
          <small>3–24 characters: letters, numbers, and underscores.</small>
          <button type="submit" disabled={!!saving}>{saving === "username" ? "Saving…" : "Save username"}</button>
        </form>
        <form className="panel account-card account-setting-card" onSubmit={updateEmail}>
          <span className="account-card-kicker">SIGN-IN DETAILS</span><h2>Email address</h2><p>We’ll send a confirmation link to the new address before it becomes your sign-in email.</p>
          <label htmlFor="new-email">New email<input id="new-email" name="new-email" type="email" autoComplete="email" required placeholder="name@example.com" /></label>
          <button type="submit" disabled={!!saving}>{saving === "email" ? "Sending confirmation…" : "Change email"}</button>
        </form>
        <form className="panel account-card account-setting-card" onSubmit={updatePassword}>
          <span className="account-card-kicker">SECURITY</span><h2>Password</h2><p>Set a new password for your account. Use at least 8 characters.</p>
          <PasswordField id="account-new-password" name="new-password" label="New password" minLength={8} autoComplete="new-password" disabled={!!saving} required />
          <PasswordField id="account-confirm-password" name="confirm-password" label="Confirm new password" minLength={8} autoComplete="new-password" disabled={!!saving} required />
          <button type="submit" disabled={!!saving}>{saving === "password" ? "Updating…" : "Change password"}</button>
        </form>
      </section>
      <div className="account-actions-grid">
        <article className="panel account-card account-export-card">
          <span className="account-action-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3"/></svg></span>
          <span className="account-card-kicker">PORTABLE COPY</span><h2>Download your data</h2>
          <p>Save a JSON copy of your account details, requests, properties, reports, and notifications.</p>
          <button type="button" className="secondary" disabled={exporting} onClick={() => void exportData()}>{exporting ? "Preparing…" : "Download my data"}</button>
        </article>
        <form className="panel account-card danger-zone" onSubmit={deleteAccount} aria-busy={deleting}>
          <span className="account-action-icon danger-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 14h10l1-14M9 7V4h6v3"/></svg></span>
          <span className="account-card-kicker">PERMANENT ACTION</span><h2>Delete your account</h2>
          <p>This hides your properties and requests, removes your contact details, and deletes your notifications. This action cannot be undone.</p>
          <div className="ui-field">
            <label htmlFor="delete-confirm">Type <strong>{CONFIRM_WORD}</strong> to confirm</label>
            <input id="delete-confirm" value={confirm} autoComplete="off" disabled={deleting} onChange={(event) => setConfirm(event.target.value)} />
          </div>
          <button type="submit" className="danger-button" disabled={deleting || confirm !== CONFIRM_WORD}>{deleting ? "Deleting…" : "Delete my account"}</button>
        </form>
      </div>
    </section>
  );
}

export default function AccountPage() { return <RequireSession><Account /></RequireSession>; }
