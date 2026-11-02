"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { RequireSession } from "@/components/require-session";
import { apiRequest } from "@/lib/api-client";
import { lkr } from "@/lib/items";

type Payout = { id: string; bookingId: string; amount: number; status: "DUE" | "PAID" | "CANCELLED"; note: string | null; transferReference: string | null; paidAt: string | null; createdAt: string; owner: { id: string; email: string; phone: null }; booking: { id: string; status: string; paidAt: string | null; startDate: string; endDate: string; paymentReference: string | null; listing: { reference: string | null; title: string | null; category: string; areaText: string } } };
type Booking = { id: string; status: string; paidAt: string | null; startDate: string; endDate: string; totalAmount: number; listing: { title: string | null; category: string; areaText: string; reference: string | null }; ownerContact?: string };

function PayoutRow({ payout, onChange }: { payout: Payout; onChange: () => void }) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function markPaid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest(`/admin/payouts/${payout.id}/paid`, { method: "PATCH", authenticated: true, body: JSON.stringify({ transferReference: reference }) });
      onChange();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update payout."); setBusy(false); }
  }
  return <article className="panel">
    <div className="record-heading"><h2>{payout.booking.listing.title ?? payout.booking.listing.areaText}</h2><span className={`ui-badge ${payout.status === "DUE" ? "badge-warning" : "badge-success"}`}>{payout.status.toLowerCase()}</span></div>
    <dl className="spec-grid"><div><dt>Owner account</dt><dd>{payout.owner.email}</dd></div><div><dt>Amount due</dt><dd>{lkr(payout.amount)}</dd></div><div><dt>Rental dates</dt><dd>{payout.booking.startDate} to {payout.booking.endDate}</dd></div><div><dt>Booking</dt><dd>{payout.bookingId}</dd></div><div><dt>Payment reference</dt><dd>{payout.booking.paymentReference ?? "Not available"}</dd></div><div><dt>Note</dt><dd>{payout.note || "—"}</dd></div>{payout.paidAt && <div><dt>Transfer recorded</dt><dd>{new Date(payout.paidAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })} · {payout.transferReference}</dd></div>}</dl>
    {payout.status === "DUE" && <form onSubmit={markPaid} className="stack"><label>Transfer reference (required)<input required maxLength={200} value={reference} onChange={e => setReference(e.target.value)} disabled={busy} /></label>{error && <p role="alert" className="notice error">{error}</p>}<button className="ui-button ui-button-primary" disabled={busy}>{busy ? "Saving…" : "Record transfer as paid"}</button></form>}
  </article>;
}

function CreatePayout({ onCreated }: { onCreated: () => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { const c = new AbortController(); apiRequest<{ items: Booking[] }>("/bookings/admin?status=COMPLETED&page=1&limit=100", { authenticated: true, signal: c.signal }).then(result => setBookings(result.items.filter(b => b.paidAt))).catch(cause => { if (!c.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load completed bookings."); }); return () => c.abort(); }, []);
  const selected = bookings.find(b => b.id === bookingId);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try { await apiRequest("/admin/payouts", { method: "POST", authenticated: true, body: JSON.stringify({ bookingId, amount: Number(amount), note }) }); onCreated(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to create payout record."); setBusy(false); }
  }
  return <details className="panel"><summary><strong>Create payout obligation</strong></summary><p>Only add an amount after your team has confirmed it is owed. This does not send money.</p>
    {error && !bookings.length && <p role="alert" className="notice error">{error}</p>}
    {!bookings.length && !error && <p>No completed, paid bookings are available for payout review.</p>}
    {bookings.length > 0 && <form className="stack" onSubmit={submit}><label>Completed booking<select required value={bookingId} onChange={e => setBookingId(e.target.value)}><option value="">Choose a booking</option>{bookings.map(b => <option key={b.id} value={b.id}>{b.listing.title ?? b.listing.areaText} · {b.startDate} · {b.id.slice(0, 8)}</option>)}</select></label>{selected && <p>Booking total was {lkr(selected.totalAmount)}. Confirm the owner amount from your agreed payout terms before entering it.</p>}<label>Owner amount due (LKR)<input type="number" min={1} max={2147483647} step={1} required value={amount} onChange={e => setAmount(e.target.value)} /></label><label>Internal note (optional)<textarea maxLength={1000} value={note} onChange={e => setNote(e.target.value)} /></label>{error && <p role="alert" className="notice error">{error}</p>}<button className="ui-button ui-button-primary" disabled={busy}>{busy ? "Saving…" : "Create due payout"}</button></form>}
  </details>;
}

function Workspace() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [status, setStatus] = useState("DUE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(() => { void apiRequest<Payout[]>(`/admin/payouts?status=${status}`, { authenticated: true }).then(setPayouts).catch(cause => setError(cause instanceof Error ? cause.message : "Unable to load payouts.")); }, [status]);
  useEffect(() => { const controller = new AbortController(); apiRequest<Payout[]>(`/admin/payouts?status=${status}`, { authenticated: true, signal: controller.signal }).then(setPayouts).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load payouts."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [status]);
  return <section className="admin-workspace"><div className="page-heading"><div><p className="eyebrow">Payments · Manual ledger</p><h1>Owner payouts</h1><p className="intro">Track amounts your team has confirmed are owed and record transfers completed outside RentalHub. This page does not initiate payments.</p></div></div>
    <CreatePayout onCreated={refresh} />
    <div className="segmented" role="group" aria-label="Payout status">{[["DUE", "Due"], ["PAID", "Paid"], ["CANCELLED", "Cancelled"]].map(([value, label]) => <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)}>{label}</button>)}</div>
    {error && <p role="alert" className="notice error">{error} <button type="button" onClick={refresh}>Retry</button></p>}{loading && <p role="status">Loading payouts…</p>}{!loading && !error && !payouts.length && <p>No {status.toLowerCase()} payout records.</p>}<div className="stack">{payouts.map(p => <PayoutRow key={p.id} payout={p} onChange={refresh} />)}</div>
  </section>;
}

export default function AdminPayoutsPage() { return <RequireSession><Workspace /></RequireSession>; }
