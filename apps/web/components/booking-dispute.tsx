"use client";
import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "@/lib/api-client";

type IssueType = "DEPOSIT" | "DAMAGE" | "NO_SHOW" | "PAYMENT" | "ITEM_CONDITION" | "OTHER";
type Dispute = { id: string; bookingId: string; disputeType: IssueType; reason: string; status: "OPEN" | "REVIEWING" | "RESOLVED"; resolution: string | null; resolvedAt: string | null; createdAt: string };
const ISSUE_TYPES: { value: IssueType; label: string }[] = [
  { value: "DEPOSIT", label: "Deposit return" },
  { value: "DAMAGE", label: "Damage or missing item" },
  { value: "NO_SHOW", label: "Owner or renter did not show" },
  { value: "PAYMENT", label: "Payment or refund" },
  { value: "ITEM_CONDITION", label: "Item condition or description" },
  { value: "OTHER", label: "Other booking issue" },
];

export function BookingDispute({ bookingId, paidAt }: { bookingId: string; paidAt: string | null }) {
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [issueType, setIssueType] = useState<IssueType>("DEPOSIT");
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!paidAt) return;
    const controller = new AbortController();
    apiRequest<Dispute | null>(`/complaints/disputes/mine?bookingId=${encodeURIComponent(bookingId)}`, { authenticated: true, signal: controller.signal })
      .then(setDispute)
      .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load booking case."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bookingId, paidAt]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || reason.trim().length < 20) return;
    setBusy(true); setError("");
    try {
      const created = await apiRequest<Dispute>("/complaints/disputes", {
        method: "POST", authenticated: true,
        body: JSON.stringify({ bookingId, issueType, reason: reason.trim() }),
      });
      setDispute(created); setReason(""); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to open a booking case."); }
    finally { setBusy(false); }
  }

  if (!paidAt) return null;
  if (loading) return <p className="small-copy" role="status">Checking for a booking case…</p>;
  return <section className="booking-dispute" aria-label="Booking issue support">
    {dispute ? <div className="notice">
      <p><strong>Case {dispute.status.toLowerCase()}</strong> · {ISSUE_TYPES.find(type => type.value === dispute.disputeType)?.label ?? "Booking issue"}</p>
      <p>{dispute.reason}</p>
      {dispute.status === "RESOLVED" && dispute.resolution && <p><strong>Outcome:</strong> {dispute.resolution}</p>}
      {dispute.status !== "RESOLVED" && <p className="small-copy">The RentalHub team is reviewing this case. Case updates appear in your notifications.</p>}
    </div> : <>
      {error && <p role="alert" className="notice error">{error}</p>}
      {!open ? <button type="button" className="ui-button ui-button-ghost" onClick={() => setOpen(true)}>Report a booking issue</button> :
        <form className="panel cancel-panel" onSubmit={submit}>
          <h3>Report a booking issue</h3>
          <p className="small-copy">Share the relevant facts. The other person on the booking and the RentalHub support team will be notified. This form does not issue refunds or return deposits.</p>
          <label>Issue type<select value={issueType} onChange={event => setIssueType(event.target.value as IssueType)} disabled={busy}>{ISSUE_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
          <label>What happened?<textarea required minLength={20} maxLength={5000} rows={4} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /></label>
          <p className="small-copy">{reason.trim().length}/5000 characters (at least 20).</p>
          {error && <p role="alert" className="notice error">{error}</p>}
          <div className="actions"><button type="submit" className="ui-button ui-button-primary" disabled={busy || reason.trim().length < 20}>{busy ? "Submitting…" : "Submit case"}</button><button type="button" className="ui-button ui-button-ghost" disabled={busy} onClick={() => { setOpen(false); setError(""); }}>Cancel</button></div>
        </form>}
    </>}
  </section>;
}
