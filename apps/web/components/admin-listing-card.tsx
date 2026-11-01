import { AdminDeleteButton } from "@/components/admin-delete-button";
import { ACTIONS_BY_STATUS, type ListingAction } from "@/lib/admin-listings";
import { categoryLabel } from "@/lib/categories";
import { isProperty, listingHref, listingKind, money, rateUnit, readable, statusLabel, type OwnerListing } from "@/lib/listings";

export interface AdminListingCardProps {
  listing: OwnerListing;
  /** True while any listing action is running, so only one can run at a time. */
  disabled: boolean;
  savingAction: ListingAction | null;
  onAction: (action: ListingAction) => void;
  onDeleted: () => void;
}

/** One owner listing with the moderation actions that apply to its current status. */
export function AdminListingCard({ listing, disabled, savingAction, onAction, onDeleted }: AdminListingCardProps) {
  const hasPin = listing.latitude != null && listing.longitude != null;
  return <article className="panel pending-card">
    <div className="pending-photo">{listing.photoUrls[0]
      /* eslint-disable-next-line @next/next/no-img-element */
      ? <img src={listing.photoUrls[0]} alt={`${listingKind(listing)} in ${listing.areaText}`} loading="lazy" />
      : <div className="photo-placeholder">No photo</div>}
      <span className="photo-tag">{listing.photoUrls.length} {listing.photoUrls.length === 1 ? "photo" : "photos"}</span></div>
    <div className="pending-main">
      <div className="pending-title"><h2>{listing.title ?? listing.areaText}</h2>
        <span className="ui-badge">{categoryLabel(listing.category)}</span>
        {isProperty(listing) && <span className="ui-badge">{listingKind(listing)}</span>}
        <span className="ui-badge">{statusLabel[listing.status]}</span>
        <span className="pending-rent">{money(listing.monthlyRent)} <small>/ {rateUnit(listing.ratePeriod)}</small></span></div>
      {listing.reference && <p className="record-reference">{listing.reference}</p>}
      <dl className="spec-grid">
        {isProperty(listing) ? <>
          <div><dt>Configuration</dt><dd>{listing.bedrooms} bed · {listing.bathrooms} bath · {readable(listing.furnishing ?? "")}</dd></div>
          <div><dt>Parking &amp; lease</dt><dd>{listing.parking ? "Parking" : "No parking"} · {listing.minDurationMonths} mo min</dd></div>
          <div><dt>Key money</dt><dd>{listing.keyMoney ? money(listing.keyMoneyAmount ?? 0) : "Not required"}</dd></div>
        </> : <>
          <div><dt>Pickup area</dt><dd>{listing.areaText}</dd></div>
          <div><dt>Details</dt><dd>{Object.entries(listing.attributes ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "None"}</dd></div>
          <div><dt>Deposit</dt><dd>{listing.depositAmount ? money(listing.depositAmount) : "None"}</dd></div>
        </>}
        <div><dt>Owner contact (admin only)</dt><dd>{listing.ownerContact}</dd></div>
      </dl>
      {!isProperty(listing) ? null : hasPin ? <p className="pin-ok">Map pin set</p> : <p className="pin-warning">Missing map pin: excluded from automatic perimeter results.</p>}
      <div className="pending-links">
        <a href={listingHref(listing)} target="_blank" rel="noopener noreferrer">Public page ↗</a>
        {listing.mapLink && <a href={listing.mapLink} target="_blank" rel="noopener noreferrer">View map ↗</a>}
        {listing.photoUrls.map((url, index) => <a key={url} href={url} target="_blank" rel="noopener noreferrer">View photo {index + 1}</a>)}
      </div>
    </div>
    <div className="pending-actions">
      {ACTIONS_BY_STATUS[listing.status].map(({ action, label, danger }) =>
        <button key={action} className={danger ? "danger-button" : undefined} disabled={disabled} onClick={() => onAction(action)}>
          {savingAction === action ? "Saving..." : label}
        </button>)}
      <AdminDeleteButton path={`/listings/${listing.id}/admin-delete`} subject="listing" disabled={disabled} onDeleted={onDeleted} />
    </div>
  </article>;
}
