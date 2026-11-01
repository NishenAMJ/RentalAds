"use client";
import { ActionLink, SkeletonCards } from "@/components/ui/primitives";
import { BookingCard } from "@/components/booking-card";
import { Pagination } from "@/components/pagination";
import { useT } from "@/components/i18n-provider";
import type { BookingView } from "@/lib/items";
import { usePaginated } from "@/lib/use-paginated";

/** The signed-in person's bookings: the ones they made (`renter`) or the paid ones on their own items (`owner`). */
export function BookingList({ viewer }: { viewer: "renter" | "owner" }) {
  const t = useT();
  const pager = usePaginated<BookingView>(viewer === "renter" ? "/bookings/mine" : "/bookings/received", true);
  const prefix = viewer === "renter" ? "bookings" : "bookings.received";
  return <section className="admin-workspace">
    <div className="page-heading"><div>
      <h1>{t(viewer === "renter" ? "bookings.title" : "bookings.received.title")}</h1>
      <p className="intro">{t(viewer === "renter" ? "bookings.intro" : "bookings.received.intro")}</p>
    </div></div>
    {pager.error && <p role="alert" className="notice error">{pager.error} <button onClick={pager.retry}>↻</button></p>}
    {pager.loading && <SkeletonCards label="…" />}
    {!pager.loading && !pager.error && !pager.items.length && <div className="empty-state">
      <p>{t(`${prefix}.empty` as "bookings.empty")}</p>
      {viewer === "renter" && <ActionLink href="/categories">{t("bookings.empty.cta")}</ActionLink>}
    </div>}
    <div className="stack">{pager.items.map((booking) => <BookingCard key={booking.id} booking={booking} viewer={viewer} onChanged={pager.retry} />)}</div>
    <Pagination {...pager} onPageChange={pager.setPage} />
  </section>;
}
