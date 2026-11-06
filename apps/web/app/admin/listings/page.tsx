"use client";
import { useState } from "react";
import { RequireSession } from "@/components/require-session";
import { Pagination } from "@/components/pagination";
import { AdminDeleteButton } from "@/components/admin-delete-button";
import { AdminListingLookup } from "@/components/admin-listing-lookup";
import { usePaginated } from "@/lib/use-paginated";
import { apiRequest } from "@/lib/api-client";
import { ACTION_MESSAGES, ACTIONS_BY_STATUS, STATUS_TABS, type ListingAction, type ListingStatus } from "@/lib/admin-listings";
import type { OwnerListing } from "@/lib/listings";
import { categoryLabel } from "@/lib/categories";
import { money, rateUnit, statusLabel } from "@/lib/listings";


function ListingList({ status, empty }: { status: ListingStatus; empty: string }) {
  const pager = usePaginated<OwnerListing>("/listings/admin", true, `status=${status}`);
  const [saving, setSaving] = useState<{ id: string; action: ListingAction } | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  /** Reloads the list, stepping back a page when the current one has just been emptied. */
  function refresh() {
    if (pager.items.length === 1 && pager.page > 1) pager.setPage(pager.page - 1);
    else pager.retry();
  }
  async function act(id: string, action: ListingAction) {
    if (saving) return;
    setSaving({ id, action });
    setError("");
    setMessage("");
    try {
      const listing = await apiRequest<OwnerListing>(`/listings/${encodeURIComponent(id)}/${action}`, { method: "PATCH", authenticated: true });
      setMessage(`${ACTION_MESSAGES[action]}${listing.reference ? `: ${listing.reference}` : ""}.`);
      refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the listing.");
    } finally {
      setSaving(null);
    }
  }
  const failure = pager.error || error;
  return <>
    {failure && <p role="alert" className="notice error">{failure} <button onClick={pager.retry}>Refresh list</button></p>}
    {message && <p role="status" className="notice">{message}</p>}
    {pager.loading && <p role="status">Loading listings...</p>}
    {!pager.loading && !pager.error && !pager.items.length && <p>{empty}</p>}
    {pager.items.length > 0 && <div className="table-wrap"><table><thead><tr><th scope="col">Listing</th><th scope="col">Category / status</th><th scope="col">Price</th><th scope="col">Owner</th><th scope="col">Details</th><th scope="col">Actions</th></tr></thead>
      <tbody>{pager.items.map(listing => <tr key={listing.id}>
        <td><strong>{listing.title ?? listing.areaText}</strong>{listing.reference && <><br /><small>{listing.reference}</small></>}</td>
        <td>{categoryLabel(listing.category)}<br />{statusLabel[listing.status]}</td>
        <td>{money(listing.monthlyRent)} / {rateUnit(listing.ratePeriod)}</td>
        <td>{listing.ownerContact}</td>
        <td><details><summary>Review details</summary><div className="listing-review-details">
          {listing.photoUrls[0] && <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={listing.photoUrls[0]} alt="Listing preview" loading="lazy" />
          </>}
          <p>{listing.areaText}</p>
          <p>{Object.entries(listing.attributes ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(" · ") || "No additional details"}</p>
          <p>{listing.mapLink && <a href={listing.mapLink} target="_blank" rel="noreferrer">Open map</a>}</p>
        </div></details></td>
        <td><div className="table-actions">{ACTIONS_BY_STATUS[listing.status].map(({ action, label, danger }) => <button key={action} className={danger ? "danger-button" : undefined} disabled={!!saving || pager.loading} onClick={() => void act(listing.id, action)}>{saving?.id === listing.id && saving.action === action ? "Saving…" : label}</button>)}
          <AdminDeleteButton path={`/listings/${listing.id}/admin-delete`} subject="listing" disabled={!!saving || pager.loading} onDeleted={() => { setMessage("Listing deleted. The owner has been notified."); refresh(); }} /></div></td>
      </tr>)}</tbody></table></div>}
    <Pagination {...pager} loading={pager.loading || !!saving} onPageChange={pager.setPage} />
  </>;
}

function ListingsWorkspace() {
  const [status, setStatus] = useState<ListingStatus>("PENDING_APPROVAL");
  const tab = STATUS_TABS.find((candidate) => candidate.status === status)!;
  return <section className="admin-workspace">
    <div className="page-heading"><div><p className="eyebrow">Property curation</p><h1>Listings</h1>
      <p className="intro">Review submissions, switch live listings off, or remove them. Owner contact details are for your team only.</p></div></div>
    <AdminListingLookup />
    <div className="segmented" role="group" aria-label="Listing status">{STATUS_TABS.map(({ status: value, label }) =>
      <button key={value} type="button" aria-pressed={value === status} onClick={() => setStatus(value)}>{label}</button>)}
    </div>
    {/* Remounting restarts paging at page 1 whenever the status changes. */}
    <ListingList key={status} status={status} empty={tab.empty} />
  </section>;
}

export default function AdminListingsPage() {
  return <RequireSession><ListingsWorkspace /></RequireSession>;
}
