"use client";

import { useState } from "react";
import { ActionLink, Badge, EmptyState, PrivacyNote, SkeletonCards } from "@/components/ui/primitives";
import { RequireSession } from "@/components/require-session";
import { apiRequest } from "@/lib/api-client";

import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/pagination";

import { SavedSearchAreaView } from "@/components/saved-search-area";
import type { SavedSearchArea } from "@/lib/search-area";

type RentalRequest = SavedSearchArea & {
  id: string;
  areaText: string;
  budgetMax: number;
  durationMonths: number;
  propertyType: string;
  status: string;
  createdAt: string;
};

function RenterDashboard() {
  const pager = usePaginated<RentalRequest>("/requests/mine", true);
  const { items: requests, setItems: setRequests, loading, error } = pager;
  const [closingId, setClosingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");

  async function closeRequest(id: string) {
    if (closingId) return;
    setClosingId(id);
    setActionError("");
    setMessage("");
    try {
      const updated = await apiRequest<RentalRequest>(
        `/requests/${encodeURIComponent(id)}/close`,
        { method: "PATCH", authenticated: true },
      );
      setRequests((current) =>
        current.map((item) => (item.id === id ? updated : item)),
      );
      setMessage("Request closed.");
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "Unable to close request. Please try again.",
      );
    } finally {
      setClosingId(null);
    }
  }
  async function removeRequest(id:string) { if(!confirm("Delete this request?")) return; setClosingId(id); try {await apiRequest(`/requests/${id}/delete`,{method:"PATCH",authenticated:true});setRequests(rows=>rows.filter(x=>x.id!==id));setMessage("Request deleted.");} catch(cause){setActionError(cause instanceof Error?cause.message:"Unable to delete request.");} finally{setClosingId(null);} }

  return (
    <section className="renter-workspace">
      <div className="dashboard-heading"><div><p className="eyebrow">Your private search</p><h1>A little closer to home.</h1><p className="intro">Follow your requests. Our team will reach out when there’s a potential fit.</p></div><ActionLink href="/renter/new">+ New request</ActionLink></div>
      {loading && <SkeletonCards label="Loading your requests" />}
      {error && (
        <p role="alert" className="notice error">
          {error} <button onClick={pager.retry}>Retry</button>
        </p>
      )}
      {!loading && !error && requests.length === 0 && (
        <EmptyState title={pager.page === 1 ? "Let’s start with what matters to you." : "No requests on this page."} description="Share your preferred areas, budget and home preferences. We’ll handle the search personally." action={<ActionLink href="/renter/new">Find a property for me</ActionLink>} />
      )}
      <div className="stack request-list">
        {actionError && (
          <p role="alert" className="notice error">
            {actionError}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        {requests.map((r) => (
          <article key={r.id} className="panel request-card">
            <div className="record-heading">
              <div><h2>{r.areaText}</h2>
                <p className="request-meta">{r.propertyType === "APARTMENT" ? "Apartment" : "House"} · up to LKR {r.budgetMax.toLocaleString()} · {r.durationMonths}+ months</p>
                <p className="request-meta mono">Submitted {new Date(r.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}</p></div>
              <Badge tone={r.status === "MATCHED" ? "success" : r.status === "CLOSED" ? "neutral" : "warning"}>{r.status === "OPEN" ? "Looking for a fit" : r.status === "MATCHED" ? "Match recorded" : "Closed"}</Badge>
            </div>
            <div className="request-perimeter"><SavedSearchAreaView request={r} /></div>
            <div className="request-footer">
              <p className="small-copy"><span className="live-dot" />{r.status === "CLOSED" ? "This request is closed. Create a new request whenever you’re ready to search again." : "Our team coordinates potential introductions via WhatsApp."}</p>
              {r.status !== "CLOSED" && (
                <div className="request-actions">
                  <button type="button" className="secondary" disabled={closingId !== null} onClick={() => void closeRequest(r.id)}>{closingId === r.id ? "Closing..." : "Close request"}</button>
                  <button type="button" className="danger-button" disabled={closingId !== null} onClick={() => void removeRequest(r.id)}>Delete request</button>
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
      <Pagination
        {...pager}
        loading={loading || closingId !== null}
        onPageChange={pager.setPage}
      />
      <PrivacyNote>These requests are visible only to you and our admin team.</PrivacyNote>
    </section>
  );
}

export default function RenterDashboardPage() {
  return (
    <RequireSession>
      <RenterDashboard />
    </RequireSession>
  );
}
