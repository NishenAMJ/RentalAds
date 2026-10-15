"use client";
import { useState } from "react";
import { RequireSession } from "@/components/require-session";
import { Pagination } from "@/components/pagination";
import { usePaginated } from "@/lib/use-paginated";
import { apiRequest } from "@/lib/api-client";
import { money, readable, type OwnerListing } from "@/lib/listings";
import { AdminListingLookup } from "@/components/admin-listing-lookup";
import { AdminDeleteButton } from "@/components/admin-delete-button";

function PendingListings() {
  const pager = usePaginated<OwnerListing>("/listings/pending", true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function moderate(id: string, action: "approve" | "reject") {
    if (busy) return;
    setBusy(id);
    setError("");
    setMessage("");
    try {
      const listing = await apiRequest<OwnerListing>(
        `/listings/${encodeURIComponent(id)}/${action}`,
        {
          method: "PATCH",
          authenticated: true,
        },
      );
      setMessage(
        action === "approve"
          ? `Listing approved${listing.reference ? `: ${listing.reference}` : ""}.`
          : "Listing rejected.",
      );
      if (pager.items.length === 1 && pager.page > 1)
        pager.setPage(pager.page - 1);
      else pager.retry();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to review listing.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="admin-workspace">
      <div className="page-heading"><div><p className="eyebrow">Property curation</p>
        <h1>Pending listings{!pager.loading && !pager.error && <span className="count-chip inline" role="status">{pager.items.length}{pager.hasNextPage ? "+" : ""} on this page</span>}</h1>
        <p className="intro">Review each submission before it becomes public. Owner contact details are for your team only.</p></div></div>
      <AdminListingLookup />
      {(pager.error || error) && (
        <p role="alert" className="notice error">
          {pager.error || error}{" "}
          <button onClick={pager.retry}>Refresh queue</button>
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      {pager.loading && <p role="status">Loading listings...</p>}
      {!pager.loading && !pager.error && !pager.items.length && (
        <p>No pending listings on this page.</p>
      )}
      <div className="stack">
        {pager.items.map((listing) => (
          <article key={listing.id} className="panel pending-card">
            <div className="pending-photo">{listing.photoUrls[0]
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={listing.photoUrls[0]} alt={`${readable(listing.propertyType)} in ${listing.areaText}`} loading="lazy" />
              : <div className="photo-placeholder">No photo</div>}
              <span className="photo-tag">{listing.photoUrls.length} {listing.photoUrls.length === 1 ? "photo" : "photos"}</span></div>
            <div className="pending-main">
              <div className="pending-title"><h2>{listing.areaText}</h2><span className="ui-badge">{readable(listing.propertyType)}</span>
                <span className="pending-rent">{money(listing.monthlyRent)} <small>/ month</small></span></div>
              <dl className="spec-grid">
                <div><dt>Configuration</dt><dd>{listing.bedrooms} bed · {listing.bathrooms} bath · {readable(listing.furnishing)}</dd></div>
                <div><dt>Parking &amp; lease</dt><dd>{listing.parking ? "Parking" : "No parking"} · {listing.minDurationMonths} mo min</dd></div>
                <div><dt>Key money</dt><dd>{listing.keyMoney ? money(listing.keyMoneyAmount ?? 0) : "Not required"}</dd></div>
                <div><dt>Owner contact (admin only)</dt><dd>{listing.ownerContact}</dd></div>
              </dl>
              {(listing.latitude == null || listing.longitude == null)
                ? <p className="pin-warning">Missing map pin: excluded from automatic perimeter results.</p>
                : <p className="pin-ok">Map pin set</p>}
              <div className="pending-links">
                {listing.mapLink && <a href={listing.mapLink} target="_blank" rel="noopener noreferrer">View map ↗</a>}
                {listing.photoUrls.map((url, index) => (
                  <a key={url} href={url} target="_blank" rel="noopener noreferrer">View photo {index + 1}</a>
                ))}
              </div>
            </div>
            <div className="pending-actions">
              <button disabled={!!busy || pager.loading} onClick={() => void moderate(listing.id, "approve")}>
                {busy === listing.id ? "Saving..." : "Approve listing"}
              </button>
              <button className="danger-button" disabled={!!busy || pager.loading} onClick={() => void moderate(listing.id, "reject")}>
                Reject submission
              </button>
              <AdminDeleteButton path={`/listings/${listing.id}/admin-delete`} subject="listing" disabled={!!busy || pager.loading} onDeleted={pager.retry} />
            </div>
          </article>
        ))}
      </div>
      <Pagination
        {...pager}
        loading={pager.loading || !!busy}
        onPageChange={pager.setPage}
      />
    </section>
  );
}
export default function AdminListingsPage() {
  return (
    <RequireSession>
      <PendingListings />
    </RequireSession>
  );
}
