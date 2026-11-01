"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { useT } from "@/components/i18n-provider";
import { ApiError, apiRequest } from "@/lib/api-client";
import { lkr, type BookingQuote, type BookingView, type CheckoutRequest, type ItemListing } from "@/lib/items";
import { normalizeContactPhone } from "@/lib/listing-form";
import { postToPayhere } from "@/lib/payhere-form";

interface TakenRange { startDate: string; endDate: string }

/** Today in Sri Lanka as YYYY-MM-DD, the earliest date a booking can start. */
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Colombo" });

/** Date picker, live price and the "Book and pay" button for one item. */
export function BookingPanel({ listing }: { listing: ItemListing }) {
  const t = useT();
  const router = useRouter();
  const { user } = useAuth();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [phone, setPhone] = useState("");
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [taken, setTaken] = useState<TakenRange[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    apiRequest<TakenRange[]>(`/bookings/availability/${listing.id}`).then((ranges) => { if (active) setTaken(ranges); }).catch(() => undefined);
    return () => { active = false; };
  }, [listing.id]);

  // Price for the chosen dates, from the API so the page can never show a different amount than the booking charges.
  useEffect(() => {
    if (!start || !end || end <= start) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ listingId: listing.id, startDate: start, endDate: end });
    apiRequest<BookingQuote>(`/bookings/quote?${query}`, { signal: controller.signal })
      .then((result) => { setQuote(result); setQuoteError(""); })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        setQuote(null);
        setQuoteError(cause instanceof Error ? cause.message : "");
      });
    return () => controller.abort();
  }, [listing.id, start, end]);

  const ready = Boolean(start && end && end > start);
  const shownQuote = ready ? quote : null;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (!user) { router.push(`/login?next=${encodeURIComponent(`/item/${listing.id}`)}`); return; }
    const contact = normalizeContactPhone(phone);
    if (!contact) { setError(t("rent.book.phoneHelp")); return; }
    setBusy(true);
    setError("");
    try {
      const booking = await apiRequest<BookingView>("/bookings", {
        method: "POST", authenticated: true,
        body: JSON.stringify({ listingId: listing.id, startDate: start, endDate: end, renterContact: contact }),
      });
      const checkout = await apiRequest<CheckoutRequest>(`/bookings/${booking.id}/checkout`, { method: "POST", authenticated: true });
      postToPayhere(checkout);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 403 ? t("rent.book.ownItem") : cause instanceof Error ? cause.message : "");
      setBusy(false);
    }
  }

  return <form className="panel booking-panel" onSubmit={submit} aria-busy={busy}>
    <h2 className="side-title">{t("rent.book.title")}</h2>
    <label>{t("rent.book.start")}<input type="date" min={today()} value={start} onChange={(event) => setStart(event.target.value)} required disabled={busy} /></label>
    <label>{t("rent.book.end")}<input type="date" min={start || today()} value={end} onChange={(event) => setEnd(event.target.value)} required disabled={busy} /></label>
    {taken.length > 0 && <p className="small-copy">{t("rent.book.unavailable")}: {taken.map((range) => `${range.startDate} → ${range.endDate}`).join(", ")}</p>}
    <label>{t("rent.book.phone")}
      <span className="phone-input"><span aria-hidden="true">+94</span>
        <input type="tel" inputMode="tel" autoComplete="tel-national" placeholder="71 234 5678" value={phone} onChange={(event) => setPhone(event.target.value)} required disabled={busy} aria-describedby="booking-phone-help" /></span>
      <small id="booking-phone-help">{t("rent.book.phoneHelp")}</small>
    </label>
    {shownQuote
      ? <dl className="glance booking-quote">
          <div><dt>{t("rent.book.rental", { units: shownQuote.units, rate: lkr(shownQuote.rateAmount) })}</dt><dd>{lkr(shownQuote.rentalTotal)}</dd></div>
          <div><dt>{t("rent.book.fee")}</dt><dd>{lkr(shownQuote.serviceFee)}</dd></div>
          {shownQuote.depositAmount > 0 && <div><dt>{t("rent.deposit")}</dt><dd>{lkr(shownQuote.depositAmount)}</dd></div>}
          <div className="booking-total"><dt>{t("rent.book.total")}</dt><dd>{lkr(shownQuote.totalAmount)}</dd></div>
        </dl>
      : <p className="small-copy">{ready && quoteError ? quoteError : t("rent.book.pickDates")}</p>}
    {error && <p role="alert" className="notice error">{error}</p>}
    <button className="ui-button ui-button-primary auth-submit" disabled={busy || (Boolean(user) && !shownQuote)}>
      {busy ? t("rent.book.busy") : user ? t("rent.book.cta") : t("rent.book.signIn")}
    </button>
    <p className="small-copy">{t("rent.book.note")}</p>
  </form>;
}
