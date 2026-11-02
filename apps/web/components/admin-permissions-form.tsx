"use client";
import { useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api-client";

const flags = [
  ["canApproveListings", "Listings and rental matching"],
  ["canManageComplaints", "Complaint review"],
  ["canManagePayouts", "Owner payouts"],
  ["canManageAdmins", "Manage admin access"],
] as const;
type Flag = (typeof flags)[number][0];

/** Grants or changes admin permissions for an existing user, found by email. */
export function AdminPermissionsForm() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const body: { email: string } & Record<Flag, boolean> = {
      email: String(form.get("email") ?? "").trim(),
      canApproveListings: form.has("canApproveListings"),
      canManageComplaints: form.has("canManageComplaints"),
      canManagePayouts: form.has("canManagePayouts"),
      canManageAdmins: form.has("canManageAdmins"),
    };
    setBusy(true); setError(""); setMessage("");
    try {
      await apiRequest("/admin/permissions", { method: "POST", authenticated: true, body: JSON.stringify(body) });
      setMessage(`Permissions saved for ${body.email}. Changes take effect when their session refreshes.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save permissions.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel admin-permissions" aria-labelledby="admin-permissions-title">
      <h2 id="admin-permissions-title">Admin access</h2>
      <p className="admin-description">Set exactly which tools an existing user can use. Unchecked tools are removed. Give payout access only to staff responsible for recording owner transfers.</p>
      <form onSubmit={submit} aria-busy={busy} className="permissions-form">
        <div className="ui-field">
          <label htmlFor="permission-email">User email</label>
          <input id="permission-email" name="email" type="email" autoComplete="off" required disabled={busy} />
        </div>
        <fieldset disabled={busy}>
          <legend className="sr-only">Permissions</legend>
          {flags.map(([name, label]) => <label key={name} className="checkbox option-row"><input type="checkbox" name={name} />{label}</label>)}
        </fieldset>
        {error && <p role="alert" className="notice error">{error}</p>}
        {message && <p role="status" className="notice">{message}</p>}
        <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save permissions"}</button>
      </form>
    </section>
  );
}
