"use client";

import { useState, type FormEvent } from "react";
import { RequireSession } from "@/components/require-session";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api-client";

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
      <div className="page-heading"><div><p className="eyebrow">Your account</p><h1>Account and privacy</h1>
        <p className="intro">Signed in as <strong>{user?.email}</strong>.</p></div></div>
      {error && <p role="alert" className="notice error">{error}</p>}
      {message && <p role="status" className="notice">{message}</p>}
      <div className="panel account-card">
        <h2>Download your data</h2>
        <p>Get a copy of your account details, requests, properties, reports and notifications as a JSON file.</p>
        <button type="button" className="secondary" disabled={exporting} onClick={() => void exportData()}>{exporting ? "Preparing…" : "Download my data"}</button>
      </div>
      <form className="panel account-card danger-zone" onSubmit={deleteAccount} aria-busy={deleting}>
        <h2>Delete your account</h2>
        <p>This hides your properties and requests, removes your contact details and deletes your notifications. It cannot be undone.</p>
        <div className="ui-field">
          <label htmlFor="delete-confirm">Type {CONFIRM_WORD} to confirm</label>
          <input id="delete-confirm" value={confirm} autoComplete="off" disabled={deleting} onChange={(event) => setConfirm(event.target.value)} />
        </div>
        <button type="submit" className="danger-button" disabled={deleting || confirm !== CONFIRM_WORD}>{deleting ? "Deleting…" : "Delete my account"}</button>
      </form>
    </section>
  );
}

export default function AccountPage() { return <RequireSession><Account /></RequireSession>; }
