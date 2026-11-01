"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ActionLink } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { apiRequest } from "@/lib/api-client";
import type { BookingView } from "@/lib/items";

const POLL_MS = 3000;
const GIVE_UP_AFTER = 20;

/**
 * Where PayHere sends the renter back to. The payment itself is confirmed by PayHere calling the API,
 * which can land a few seconds after the redirect, so this page asks until the booking shows as paid.
 */
export function ReturnStatus() {
  const t = useT();
  const id = useSearchParams().get("booking");
  const [booking, setBooking] = useState<BookingView | null>(null);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    let attempts = 0;
    let timer: number | undefined;
    const check = async () => {
      attempts += 1;
      try {
        const latest = await apiRequest<BookingView>(`/bookings/${encodeURIComponent(id)}`, { authenticated: true });
        if (!active) return;
        setBooking(latest);
        if (latest.status !== "PENDING_PAYMENT") return;
      } catch { /* try again shortly */ }
      if (!active) return;
      if (attempts >= GIVE_UP_AFTER) setGaveUp(true);
      else timer = window.setTimeout(() => void check(), POLL_MS);
    };
    void check();
    return () => { active = false; window.clearTimeout(timer); };
  }, [id]);

  const confirmed = booking?.status === "CONFIRMED" || booking?.status === "COMPLETED";
  return <section className="panel request-success" role="status" aria-live="polite">
    <h1>{confirmed ? t("bookings.return.confirmed") : gaveUp ? t("bookings.return.slow") : t("bookings.return.checking")}</h1>
    {confirmed && booking?.ownerContact && <p><strong>{t("bookings.ownerContact")}:</strong> {booking.ownerContact}</p>}
    {(confirmed || gaveUp) && <ActionLink href="/bookings">{t("bookings.return.view")}</ActionLink>}
    {!confirmed && !gaveUp && <Link href="/bookings">{t("bookings.return.view")}</Link>}
  </section>;
}
