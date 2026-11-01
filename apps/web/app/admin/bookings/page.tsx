"use client";
import { useState } from "react";
import { RequireSession } from "@/components/require-session";
import { Pagination } from "@/components/pagination";
import { AdminDeleteButton } from "@/components/admin-delete-button";
import { categoryLabel } from "@/lib/categories";
import { apiRequest } from "@/lib/api-client";
import { lkr, type BookingView } from "@/lib/items";
import { usePaginated } from "@/lib/use-paginated";

const FILTERS: readonly { filter: string; label: string }[] = [
  { filter: "", label: "All" },
  { filter: "refund=DUE", label: "Refunds due" },
  { filter: "status=CONFIRMED", label: "Paid" },
  { filter: "status=PENDING_PAYMENT", label: "Unpaid" },
  { filter: "status=CANCELLED", label: "Cancelled" },
];
const TONE = { PENDING_PAYMENT: "badge-warning", CONFIRMED: "badge-success", COMPLETED: "badge-neutral", CANCELLED: "badge-neutral" } as const;

/** A refund the team still has to send: shows the amount, and records it once it has been sent in PayHere. */
function RefundDue({ booking, onDone }: { booking: BookingView; onDone: () => void }) {
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function done() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/bookings/${booking.id}/refund-done`, { method: "PATCH", authenticated: true, body: JSON.stringify({ reference }) });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to record the refund.");
      setBusy(false);
    }
  }
  return <div className="notice error" role="status">
    <p>Refund {lkr(booking.refundAmount ?? 0)} to the renter in the PayHere dashboard{booking.paymentReference ? ` (payment ${booking.paymentReference})` : ""}, then record it here.</p>
    <label>PayHere refund reference (optional)<input value={reference} maxLength={200} onChange={(event) => setReference(event.target.value)} disabled={busy} /></label>
    {error && <p role="alert" className="field-error">{error}</p>}
    <button className="ui-button ui-button-primary" disabled={busy} onClick={() => void done()}>{busy ? "Saving…" : "I have sent this refund"}</button>
  </div>;
}

function BookingRows({ filter }: { filter: string }) {
  const pager = usePaginated<BookingView>("/bookings/admin", true, filter);
  const [message, setMessage] = useState("");
  return <>
    {pager.error && <p role="alert" className="notice error">{pager.error} <button onClick={pager.retry}>Refresh list</button></p>}
    {message && <p role="status" className="notice">{message}</p>}
    {pager.loading && <p role="status">Loading bookings...</p>}
    {!pager.loading && !pager.error && !pager.items.length && <p>No bookings here yet.</p>}
    <div className="stack">{pager.items.map((booking) => <article key={booking.id} className="panel">
      <div className="record-heading">
        <h2>{booking.listing.title ?? booking.listing.areaText}</h2>
        <span className={`ui-badge ${TONE[booking.status]}`}>{booking.status.replaceAll("_", " ").toLowerCase()}</span>
      </div>
      {booking.refundDue && <RefundDue booking={booking} onDone={() => { setMessage("Refund recorded. The renter has been told."); pager.retry(); }} />}
      {booking.refundStatus === "DONE" && <p className="notice">Refunded {lkr(booking.refundAmount ?? 0)}{booking.refundReference ? ` (ref ${booking.refundReference})` : ""}.</p>}
      {booking.cancelledBy && <p className="muted">Cancelled by {booking.cancelledBy.toLowerCase()}{booking.cancelReason ? `: ${booking.cancelReason}` : ""}</p>}
      <dl className="spec-grid">
        <div><dt>Category</dt><dd>{categoryLabel(booking.listing.category)}</dd></div>
        <div><dt>Dates</dt><dd>{booking.startDate} to {booking.endDate} ({booking.units} × {booking.ratePeriod.toLowerCase()})</dd></div>
        <div><dt>Charged</dt><dd>{lkr(booking.totalAmount)} (rental {lkr(booking.rentalTotal)}, fee {lkr(booking.serviceFee)}, deposit {lkr(booking.depositAmount)})</dd></div>
        <div><dt>Owner</dt><dd>{booking.ownerContact}</dd></div>
        <div><dt>Renter</dt><dd>{booking.renterContact}</dd></div>
        <div><dt>Paid</dt><dd>{booking.paidAt ? new Date(booking.paidAt).toLocaleString("en-GB", { timeZone: "Asia/Colombo" }) : "Not paid"}</dd></div>
      </dl>
      {booking.status !== "CANCELLED" && <AdminDeleteButton path={`/bookings/${booking.id}/admin-cancel`} subject="booking" verb="Cancel" verbing="Cancelling" audience="renter and owner"
        onDeleted={() => { setMessage(booking.paidAt ? "Booking cancelled. Remember to refund the renter in PayHere." : "Booking cancelled."); pager.retry(); }} />}
    </article>)}</div>
    <Pagination {...pager} onPageChange={pager.setPage} />
  </>;
}

function Workspace() {
  const [filter, setFilter] = useState("");
  return <section className="admin-workspace">
    <div className="page-heading"><div><p className="eyebrow">Payments</p><h1>Bookings</h1>
      <p className="intro">Item bookings paid through PayHere. Contact numbers are shown here for your team only.</p></div></div>
    <div className="segmented" role="group" aria-label="Booking status">{FILTERS.map(({ filter: value, label }) =>
      <button key={label} type="button" aria-pressed={value === filter} onClick={() => setFilter(value)}>{label}</button>)}</div>
    <BookingRows key={filter} filter={filter} />
  </section>;
}

export default function AdminBookingsPage() {
  return <RequireSession><Workspace /></RequireSession>;
}
