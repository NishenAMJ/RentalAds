"use client";
import { useState } from "react";
import Link from "next/link";
import { PropertyImage } from "@/components/property-image";
import { useT } from "@/components/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import { categoryById } from "@/lib/categories";
import { OwnerCancel, RenterCancel } from "@/components/booking-cancel";
import { lkr, todayInSriLanka, whatsappLink, type BookingView, type CheckoutRequest } from "@/lib/items";
import { postToPayhere } from "@/lib/payhere-form";
import { BookingDispute } from "@/components/booking-dispute";

const TONE = { PENDING_PAYMENT: "badge-warning", CONFIRMED: "badge-success", COMPLETED: "badge-neutral", CANCELLED: "badge-neutral", EXPIRED: "badge-neutral" } as const;

/** A booking as the renter or the owner sees it. The other person's number appears only once it has been paid. */
export function BookingCard({ booking, viewer, onChanged }: { booking: BookingView; viewer: "renter" | "owner"; onChanged: () => void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState("");
  const name = booking.listing.title ?? booking.listing.areaText;
  const category = categoryById(booking.listing.category);
  const stillHeld = booking.status === "PENDING_PAYMENT" && booking.expiresAt && new Date(booking.expiresAt) > new Date();

  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try { await work(); } catch (cause) { setError(cause instanceof Error ? cause.message : ""); setBusy(false); }
  }
  const pay = () => run(async () => {
    postToPayhere(await apiRequest<CheckoutRequest>(`/bookings/${booking.id}/checkout`, { method: "POST", authenticated: true }));
  });
  async function submitRating() {
    if (!rating || busy) return;
    setBusy(true); setError("");
    try {
      await apiRequest(`/bookings/${booking.id}/review`, {
        method: "POST", authenticated: true,
        body: JSON.stringify({ rating: Number(rating) }),
      });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to submit your rating.");
    } finally { setBusy(false); }
  }

  return <article className="panel booking-card">
    <div className="booking-photo">{booking.listing.photoUrl
      ? <PropertyImage className="property-photo" src={booking.listing.photoUrl} alt="" width={240} height={160} sizes="160px" />
      : <div className="photo-placeholder">{t("rent.photoSoon")}</div>}</div>
    <div className="booking-main">
      <div className="record-heading">
        <h2>{category?.item ? <Link href={`/item/${booking.listing.id}`}>{name}</Link> : name}</h2>
        <span className={`ui-badge ${TONE[booking.status]}`}>{t(`bookings.status.${booking.status}`)}</span>
      </div>
      <p>{t("bookings.dates", { start: booking.startDate, end: booking.endDate })}</p>
      <p className="muted">{t("bookings.total", { amount: lkr(booking.totalAmount) })}</p>
      {viewer === "renter" && booking.ownerContact && <p><strong>{t("bookings.ownerContact")}:</strong> <a href={`tel:${booking.ownerContact}`}>{booking.ownerContact}</a> · <a href={whatsappLink(booking.ownerContact)} target="_blank" rel="noopener noreferrer">{t("bookings.whatsapp")}</a></p>}
      {viewer === "owner" && booking.renterContact && <p><strong>{t("bookings.renterContact")}:</strong> <a href={`tel:${booking.renterContact}`}>{booking.renterContact}</a> · <a href={whatsappLink(booking.renterContact)} target="_blank" rel="noopener noreferrer">{t("bookings.whatsapp")}</a></p>}
      {booking.status === "CANCELLED" && booking.cancelledBy && <p className="muted">{t(`bookings.cancelledBy.${booking.cancelledBy}`)}{booking.cancelReason && booking.cancelledBy !== "RENTER" ? ` · ${t("bookings.reason", { reason: booking.cancelReason })}` : ""}</p>}
      {viewer === "renter" && booking.refundStatus === "DUE" && <p className="notice" role="status">{t("bookings.refund.DUE", { amount: lkr(booking.refundAmount ?? 0) })}</p>}
      {viewer === "renter" && booking.refundStatus === "DONE" && <p className="notice" role="status">{t("bookings.refund.DONE", { amount: lkr(booking.refundAmount ?? 0) })}</p>}
      {viewer === "renter" && booking.status === "COMPLETED" && (booking.reviewRating != null
        ? <p role="status">{t("bookings.review.saved", { rating: booking.reviewRating })}</p>
        : <div className="rating-form"><label htmlFor={`rating-${booking.id}`}>{t("bookings.review.rating")}</label>
          <select id={`rating-${booking.id}`} value={rating} onChange={event => setRating(event.target.value)} disabled={busy}>
            <option value="">{t("bookings.review.choose")}</option>
            {[5, 4, 3, 2, 1].map(value => <option key={value} value={value}>{value} / 5</option>)}
          </select>
          <button className="ui-button ui-button-primary" type="button" disabled={busy || !rating} onClick={() => void submitRating()}>{busy ? t("rent.book.busy") : t("bookings.review.submit")}</button>
        </div>)}
      <BookingDispute bookingId={booking.id} paidAt={booking.paidAt} />
      {viewer === "renter" && stillHeld && booking.expiresAt && <p className="small-copy">{t("bookings.holdUntil", { time: new Date(booking.expiresAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" }) })}</p>}
      {error && <p role="alert" className="notice error">{error}</p>}
      {viewer === "renter" && stillHeld && <button className="ui-button ui-button-primary" disabled={busy} onClick={() => void pay()}>{t("bookings.payNow")}</button>}
      {viewer === "renter" && (stillHeld || (booking.status === "CONFIRMED" && booking.startDate >= todayInSriLanka())) && <RenterCancel booking={booking} onChanged={onChanged} />}
      {viewer === "owner" && booking.status === "CONFIRMED" && booking.endDate > todayInSriLanka() && <OwnerCancel booking={booking} onChanged={onChanged} />}
    </div>
  </article>;
}
