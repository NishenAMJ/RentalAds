"use client";
import { useId, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api-client";

export interface AdminDeleteButtonProps {
  /** Admin delete endpoint, for example `/listings/:id/admin-delete`. */
  path: string;
  /** What is being removed, used in labels and the confirmation prompt. */
  subject: string;
  disabled?: boolean;
  /** Wording: "Delete" by default; bookings are "Cancel"led. */
  verb?: string;
  verbing?: string;
  /** Who reads the reason. */
  audience?: string;
  onDeleted: () => void;
}

/** Removes a record on behalf of the owner. A written reason is required and is shown to them. */
export function AdminDeleteButton({ path, subject, disabled, verb = "Delete", verbing = "Deleting", audience = "owner", onDeleted }: AdminDeleteButtonProps) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!reason.trim()) { setError(`Enter the reason the ${audience} will see.`); return; }
    setBusy(true);
    setError("");
    try {
      await apiRequest(path, { method: "PATCH", authenticated: true, body: JSON.stringify({ reason: reason.trim() }) });
      onDeleted();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Unable to ${verb.toLowerCase()} ${subject}.`);
      setBusy(false);
    }
  }

  if (!open) {
    return <button type="button" className="danger-button" disabled={disabled} onClick={() => setOpen(true)}>{verb} {subject}…</button>;
  }
  return (
    <form className="admin-delete-form" onSubmit={submit} aria-busy={busy}>
      <label htmlFor={reasonId}>Reason shown to the {audience} (required)</label>
      <textarea id={reasonId} value={reason} maxLength={1000} rows={3} required disabled={busy}
        aria-invalid={Boolean(error)} onChange={(event) => setReason(event.target.value)} />
      {error && <p role="alert" className="field-error">{error}</p>}
      <div className="request-actions">
        <button type="submit" className="danger-button" disabled={busy}>{busy ? `${verbing}…` : `Confirm ${verb.toLowerCase()} ${subject}`}</button>
        <button type="button" className="secondary" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
      </div>
    </form>
  );
}
