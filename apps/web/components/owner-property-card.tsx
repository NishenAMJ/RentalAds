"use client";
import Link from "next/link";
import { isProperty, listingHref, listingKind, money, rateUnit, readable, statusLabel, type OwnerListing } from "@/lib/listings";
import { Badge, Button, type BadgeProps } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";

export interface OwnerPropertyCardProps { listing: OwnerListing; busy: boolean; disabled: boolean; onReconfirm: (id: string) => void; onDelete: (id: string) => void }
const tones: Record<OwnerListing["status"], BadgeProps["tone"]> = { ACTIVE: "success", PENDING_APPROVAL: "warning", REJECTED: "danger", INACTIVE: "neutral" };
const descriptions: Record<OwnerListing["status"], string> = {
  ACTIVE: "Visible to renters. Our team coordinates introductions.",
  PENDING_APPROVAL: "Our team will review your submission before it goes live.",
  REJECTED: "This submission was not approved. Review its details before submitting a new property.",
  INACTIVE: "This property is not currently shown to renters.",
};
export function OwnerPropertyCard({ listing, busy, disabled, onReconfirm, onDelete }: OwnerPropertyCardProps) {
  const t = useT();
  const missingPin = listing.latitude == null || listing.longitude == null;
  return <article className="owner-property-card"><div className="owner-photo">
    {listing.photoUrls[0] ? /* eslint-disable-next-line @next/next/no-img-element */
      <img src={listing.photoUrls[0]} alt={`${listingKind(listing)} in ${listing.areaText}`} width={640} height={400} loading="lazy" /> : <div className="owner-photo-placeholder"><span aria-hidden="true">⌂</span><span>No photo</span></div>}
    </div>
    <div className="owner-card-content"><div className="owner-card-title"><h2>{listing.title ?? listing.areaText}</h2>{listing.reference && <span className="record-reference">{listing.reference}</span>}</div>
      <Badge tone={tones[listing.status]}>{statusLabel[listing.status]}</Badge>
      <p className="status-description">{descriptions[listing.status]}</p>
      <p className="property-facts">{isProperty(listing) ? <>{listing.bedrooms} beds <span>·</span> {listing.bathrooms} baths <span>·</span> {readable(listing.furnishing ?? "")}</> : <>{listingKind(listing)} <span>·</span> {listing.areaText}</>} <span>·</span> <b className="owner-rent-inline">{money(listing.monthlyRent)}</b> / {rateUnit(listing.ratePeriod)}</p>
      {listing.availabilityStale && <p className="pin-warning" role="status">Hidden from public browsing: availability has not been confirmed recently. Confirm availability to show it again.</p>}
      {missingPin && <p className="pin-warning">No map pin: available in ordinary browsing but excluded from perimeter searches. Submit a new listing with a pin or ask the team to update it.</p>}
      <div className="availability-note"><span className="live-dot" /><span>{listing.lastAvailabilityConfirmedAt ? `Availability confirmed ${new Date(listing.lastAvailabilityConfirmedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}` : "Availability not yet confirmed"}</span></div></div>
    <div className="owner-card-actions"><Link className="ui-button ui-button-ghost" href={`/owner/listings/${listing.id}/edit`}>{t("owner.edit.link")}</Link><Button variant="secondary" busy={busy} disabled={disabled} onClick={() => onReconfirm(listing.id)}>{busy ? "Confirming…" : "Confirm availability"}</Button>{listing.status === "ACTIVE" && <Link className="ui-button ui-button-primary" href={listingHref(listing)}>View listing →</Link>}<button type="button" className="danger-button" disabled={disabled} onClick={() => onDelete(listing.id)}>Delete property</button></div>
  </article>;
}
