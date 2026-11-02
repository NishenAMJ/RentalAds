"use client";
import { useRef, useState } from "react";
import { RequireSession } from "@/components/require-session";
import { apiRequest } from "@/lib/api-client";
import type { OwnerListing } from "@/lib/listings";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/pagination";
import { OwnerPropertyCard } from "@/components/owner-property-card";
import { ActionLink, Button, EmptyState, PrivacyNote, SkeletonCards } from "@/components/ui/primitives";

function MyListings() {
  const pager = usePaginated<OwnerListing>("/listings/mine", true);
  const { items: listings, setItems: setListings, loading } = pager;
  const [actionError, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function reconfirm(id: string) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(id); setError(""); setMessage("");
    try {
      const updated = await apiRequest<OwnerListing>(`/listings/${encodeURIComponent(id)}/reconfirm`, { method: "PATCH", authenticated: true });
      setListings(current => current.map(listing => listing.id === id ? updated : listing));
      setMessage(`Availability updated for ${updated.areaText}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to confirm availability."); }
    finally { inFlight.current = false; setBusy(null); }
  }
  async function remove(id: string) {
    if (inFlight.current || !window.confirm("Delete this property? It will no longer be shown to renters.")) return;
    inFlight.current = true; setBusy(id); setError(""); setMessage("");
    try {
      await apiRequest(`/listings/${encodeURIComponent(id)}/delete`, { method: "PATCH", authenticated: true });
      setListings(current => current.filter(listing => listing.id !== id));
      setMessage("Property deleted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to delete the property."); }
    finally { inFlight.current = false; setBusy(null); }
  }
  return <>
    <div className="dashboard-heading"><div><p className="eyebrow">Your owner workspace</p><h1>Good homes. <em>In good hands.</em></h1><p className="intro">Follow your submissions and keep our team up to date.</p><ActionLink href="/owner/verification">Owner verification</ActionLink></div><ActionLink href="/owner/start">+ Add a property</ActionLink></div>
        {!loading && !pager.error && listings.length > 0 && <section className="dashboard-summary" aria-label="Properties on this page"><div><strong>{listings.length}</strong><span>Properties on this page</span></div><div><strong>{listings.filter(item => item.status === "PENDING_APPROVAL").length}</strong><span>Awaiting review on this page</span></div><div><strong>{listings.filter(item => item.status === "ACTIVE").length}</strong><span>Active on this page</span></div></section>}
    <div className="section-heading compact"><h2>Your properties</h2><span className="muted small-copy">Page {pager.page} · Latest submissions first</span></div>
    {message && <div className="feedback-toast" role="status"><span>✓ {message}</span><Button variant="ghost" aria-label="Dismiss confirmation" onClick={() => setMessage("")}>×</Button></div>}
    {(actionError || pager.error) && <div className="notice error" role="alert">{actionError || pager.error}{pager.error && <Button variant="secondary" onClick={pager.retry}>Try again</Button>}</div>}
    {loading ? <SkeletonCards /> : pager.error ? null : listings.length === 0 ? <EmptyState title={pager.page === 1 ? "Your first introduction starts here." : "No properties on this page."} description={pager.page === 1 ? "Tell us about your property. We will review it before sharing it with renters, keeping your contact details private." : "Return to the previous page to see your properties."} action={pager.page === 1 ? <ActionLink href="/owner/new">Introduce your property ↗</ActionLink> : <Button onClick={() => pager.setPage(pager.page - 1)}>Previous page</Button>} /> :
      <div className="owner-list">{listings.map(listing => <OwnerPropertyCard key={listing.id} listing={listing} busy={busy === listing.id} disabled={busy !== null} onReconfirm={id => void reconfirm(id)} onDelete={id => void remove(id)} />)}</div>}
    <Pagination {...pager} loading={loading || busy !== null} onPageChange={page => { setMessage(""); setError(""); pager.setPage(page); }} />
    <div className="info-bar"><PrivacyNote>Your contact details are never public. Our team manages renter introductions personally.</PrivacyNote></div>
  </>;
}
export default function OwnerListingsPage() { return <RequireSession><MyListings /></RequireSession>; }

