"use client";

import { useState } from "react";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "@/components/pagination";
import { apiRequest } from "@/lib/api-client";
import { RequireSession } from "@/components/require-session";
import { Badge } from "@/components/ui/primitives";

type Complaint = {
  id: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: "OPEN" | "REVIEWING" | "RESOLVED";
  adminNotes: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  disputeType: string | null;
  bookingId: string | null;
  reporter: { email: string } | null;
  resolvedBy: { email: string } | null;
  booking: { id: string; startDate: string; endDate: string; status: string; renterId: string; listing: { ownerId: string; title: string | null; areaText: string } } | null;
};

function ComplaintRow({ complaint, updating, onUpdate }: { complaint: Complaint; updating: boolean; onUpdate: (id: string, status: Complaint["status"], adminNotes: string, resolution: string) => Promise<void> }) {
  const [adminNotes, setAdminNotes] = useState(complaint.adminNotes ?? "");
  const [resolution, setResolution] = useState(complaint.resolution ?? "");
  const isDispute = Boolean(complaint.bookingId);
  const statusLabel = complaint.status.charAt(0) + complaint.status.slice(1).toLowerCase();
  return <tr>
    <td><span className="ui-badge">{isDispute ? `booking · ${complaint.disputeType?.toLowerCase().replaceAll("_", " ")}` : complaint.targetType.toLowerCase()}</span>
      {complaint.booking && <p>{complaint.booking.listing.title ?? complaint.booking.listing.areaText} · {complaint.booking.startDate} – {complaint.booking.endDate}</p>}
      {!isDispute && <code>{complaint.targetId}</code>}<p>{complaint.reason}</p></td>
    <td>{complaint.reporter?.email ?? "Unknown reporter"}<br />{new Date(complaint.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}</td>
    <td><Badge tone={complaint.status === "RESOLVED" ? "success" : complaint.status === "REVIEWING" ? "warning" : "danger"}>{statusLabel}</Badge>
      {complaint.resolvedBy && complaint.resolvedAt && <p className="small-copy">By {complaint.resolvedBy.email} on {new Date(complaint.resolvedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}</p>}</td>
    <td><label>Private team notes<textarea rows={2} maxLength={5000} value={adminNotes} onChange={event => setAdminNotes(event.target.value)} disabled={updating || complaint.status === "RESOLVED"} /></label>
      <label>Resolution summary<textarea rows={2} minLength={10} maxLength={5000} value={resolution} onChange={event => setResolution(event.target.value)} disabled={updating || complaint.status === "RESOLVED"} aria-describedby={`resolution-help-${complaint.id}`} /></label>
      <p id={`resolution-help-${complaint.id}`} className="small-copy">Required to resolve. Money transfers remain separate.</p>
      <button type="button" className="ui-button ui-button-ghost" onClick={() => void onUpdate(complaint.id, complaint.status, adminNotes, resolution)} disabled={updating || complaint.status === "RESOLVED"}>
      {updating ? "Saving…" : "Save notes"}
    </button><div className="segmented status-set" role="group" aria-label={`Set ${isDispute ? "case" : "complaint"} status`}>
      {(["OPEN", "REVIEWING", "RESOLVED"] as const).map(status => <button key={status} type="button" aria-pressed={complaint.status === status} onClick={() => void onUpdate(complaint.id, status, adminNotes, resolution)} disabled={updating || complaint.status === "RESOLVED" || complaint.status === status || (status === "RESOLVED" && resolution.trim().length < 10)}>
        {status === "OPEN" ? "Mark open" : status === "REVIEWING" ? "Mark reviewing" : "Resolve case"}
      </button>)}
    </div></td>
  </tr>;
}

function AdminComplaints() {
  const pager = usePaginated<Complaint>("/complaints", true);
  const { items: complaints, setItems: setComplaints, loading, error } = pager;
  const [actionError, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "REVIEWING" | "RESOLVED">("OPEN");
  const count = (status: string) => complaints.filter(complaint => complaint.status === status).length;
  const shown = filter === "ALL" ? complaints : complaints.filter(complaint => complaint.status === filter);

  async function updateStatus(id: string, status: Complaint["status"], adminNotes: string, resolution: string) {
    setUpdatingId(id); setError(null);
    try {
      const updated = await apiRequest<Complaint>(`/complaints/${encodeURIComponent(id)}`, {
        method: "PATCH", authenticated: true,
        body: JSON.stringify({ status, adminNotes, ...(resolution.trim() ? { resolution: resolution.trim() } : {}) }),
      });
      setComplaints(previous => previous.map(complaint => complaint.id === id ? updated : complaint));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Failed to update case."); }
    finally { setUpdatingId(null); }
  }

  return <div className="admin-workspace">
    <div className="page-heading"><div><p className="eyebrow">Trust and resolution</p><h1>Cases and complaints</h1><p className="intro">Review reports, record a private team note, and document the resolution. Updates are sent to both people when a booking is linked; money transfers remain manual.</p></div>
      <div className="segmented" role="group" aria-label="Filter cases on this page">
        {(["OPEN", "REVIEWING", "RESOLVED", "ALL"] as const).map(status => <button key={status} type="button" aria-pressed={filter === status} onClick={() => setFilter(status)}>
          {status === "ALL" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()} <span className="seg-count">{status === "ALL" ? complaints.length : count(status)}</span></button>)}
      </div>
    </div>
    {loading && <p role="status">Loading cases…</p>}
    {error && <p role="alert">{error} <button onClick={pager.retry}>Retry</button></p>}
    {actionError && <p className="notice error" role="alert">{actionError}</p>}
    {!loading && !error && shown.length === 0 && <p className="notice">No {filter === "ALL" ? "cases" : filter.toLowerCase() + " cases"} on this page.</p>}
    {shown.length > 0 && <div className="table-wrap"><table><thead><tr><th scope="col">Report</th><th scope="col">Reporter / date</th><th scope="col">Status</th><th scope="col">Review / update</th></tr></thead>
      <tbody>{shown.map(complaint => <ComplaintRow key={complaint.id} complaint={complaint} updating={updatingId !== null} onUpdate={updateStatus} />)}</tbody></table></div>}
    <Pagination {...pager} loading={loading || updatingId !== null} onPageChange={pager.setPage} />
  </div>;
}

export default function AdminComplaintsPage() {
  return <RequireSession><AdminComplaints /></RequireSession>;
}
