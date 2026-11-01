"use client";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { lkr, type BookingView, type CancelQuote } from "@/lib/items";

/**
 * The renter's cancel button. It first asks the API what they would get back under the cancellation policy and shows
 * it, so nobody cancels without knowing the money involved.
 */
export function RenterCancel({ booking, onChanged }: { booking: BookingView; onChanged: () => void }) {
  const t = useT();
  const [quote, setQuote] = useState<CancelQuote | "loading" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function review() {
    setError("");
    setQuote("loading");
    try {
      setQuote(await apiRequest<CancelQuote>(`/bookings/${booking.id}/cancel-quote`, { authenticated: true }));
    } catch (cause) {
      setQuote(null);
      setError(cause instanceof Error ? cause.message : "");
    }
  }
  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/bookings/${booking.id}/cancel`, { method: "PATCH", authenticated: true });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "");
      setBusy(false);
    }
  }

  if (!quote) return <>
    {error && <p role="alert" className="notice error">{error}</p>}
    <button className="ui-button ui-button-ghost" onClick={() => void review()}>{t("bookings.cancel")}</button>
  </>;
  if (quote === "loading") return <p role="status">{t("bookings.cancel.checking")}</p>;
  return <div className="panel cancel-panel" role="group" aria-label={t("bookings.cancel.title")}>
    <h3>{t("bookings.cancel.title")}</h3>
    <p>{t(`bookings.cancel.rule.${quote.rule}`)}</p>
    <p><strong>{quote.refundAmount > 0 ? t("bookings.cancel.refund", { amount: lkr(quote.refundAmount) }) : t("bookings.cancel.noRefund")}</strong></p>
    {error && <p role="alert" className="notice error">{error}</p>}
    <div className="actions">
      <button className="danger-button" disabled={busy} onClick={() => void confirm()}>{busy ? t("rent.book.busy") : t("bookings.cancel.confirm")}</button>
      <button className="ui-button ui-button-ghost" disabled={busy} onClick={() => setQuote(null)}>{t("bookings.cancel.keep")}</button>
    </div>
  </div>;
}

/** An owner who cannot honour a paid booking cancels it with a reason the renter sees; the renter is refunded in full. */
export function OwnerCancel({ booking, onChanged }: { booking: BookingView; onChanged: () => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirm() {
    if (busy || !reason.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/bookings/${booking.id}/owner-cancel`, { method: "PATCH", authenticated: true, body: JSON.stringify({ reason: reason.trim() }) });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "");
      setBusy(false);
    }
  }

  if (!open) return <button className="ui-button ui-button-ghost" onClick={() => setOpen(true)}>{t("bookings.ownerCancel.open")}</button>;
  return <div className="panel cancel-panel">
    <p className="small-copy">{t("bookings.ownerCancel.note")}</p>
    <label>{t("bookings.ownerCancel.reason")}<textarea rows={3} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} required /></label>
    {error && <p role="alert" className="notice error">{error}</p>}
    <div className="actions">
      <button className="danger-button" disabled={busy || !reason.trim()} onClick={() => void confirm()}>{busy ? t("rent.book.busy") : t("bookings.ownerCancel.confirm")}</button>
      <button className="ui-button ui-button-ghost" disabled={busy} onClick={() => setOpen(false)}>{t("bookings.cancel.keep")}</button>
    </div>
  </div>;
}
