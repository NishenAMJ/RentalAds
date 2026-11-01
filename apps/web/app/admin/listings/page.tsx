"use client";
import { useState } from "react";
import { RequireSession } from "@/components/require-session";
import { Pagination } from "@/components/pagination";
import { AdminListingCard } from "@/components/admin-listing-card";
import { AdminListingLookup } from "@/components/admin-listing-lookup";
import { usePaginated } from "@/lib/use-paginated";
import { apiRequest } from "@/lib/api-client";
import { ACTION_MESSAGES, STATUS_TABS, type ListingAction, type ListingStatus } from "@/lib/admin-listings";
import type { OwnerListing } from "@/lib/listings";

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
    <div className="stack">{pager.items.map((listing) =>
      <AdminListingCard key={listing.id} listing={listing} disabled={!!saving || pager.loading}
        savingAction={saving?.id === listing.id ? saving.action : null}
        onAction={(action) => void act(listing.id, action)}
        onDeleted={() => { setMessage("Listing deleted. The owner has been notified."); refresh(); }} />)}
    </div>
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
