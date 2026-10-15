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
  status: string;
  adminNotes: string | null;
  createdAt: string;
};

function AdminComplaints() {
  const pager = usePaginated<Complaint>("/complaints", true);
  const { items: complaints, setItems: setComplaints, loading, error } = pager;
  const [actionError, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"ALL" | "OPEN" | "REVIEWING" | "RESOLVED">("ALL");
  const count = (status: string) => complaints.filter((c) => c.status === status).length;
  const shown = filter === "ALL" ? complaints : complaints.filter((c) => c.status === filter);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    setError(null);
    try {
      const updated = await apiRequest<Complaint>(
        `/complaints/${encodeURIComponent(id)}`,
        {
          method: "PATCH",
          authenticated: true,
          body: JSON.stringify({ status }),
        },
      );
      setComplaints((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update complaint.",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="admin-workspace">
      <div className="page-heading"><div><p className="eyebrow">Trust and quality</p><h1>Complaint review</h1><p className="intro">Review reports and keep their progress clear for the team.</p></div>
        <div className="segmented" role="group" aria-label="Filter complaints on this page">
          {(["ALL", "OPEN", "REVIEWING", "RESOLVED"] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>
            {value === "ALL" ? "All" : value.charAt(0) + value.slice(1).toLowerCase()} <span className="seg-count">{value === "ALL" ? complaints.length : count(value)}</span></button>)}
        </div></div>
      {loading && <p role="status">Loading...</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={pager.retry}>Retry</button>
        </p>
      )}
      {actionError && <p className="notice error" role="alert">{actionError}</p>}
      {!loading && !error && shown.length === 0 && (
        <p className="notice">No complaints{filter === "ALL" ? "" : ` marked ${filter.toLowerCase()}`} on this page.</p>
      )}
      <div className="stack">
        {shown.map((c) => (
          <div key={c.id} className="panel complaint-row">
            <div className="complaint-main">
              <div className="complaint-meta"><span className="ui-badge">{c.targetType.toLowerCase()}</span><code className="record-reference">{c.targetId}</code>
                <Badge tone={c.status === "RESOLVED" ? "success" : c.status === "REVIEWING" ? "warning" : "danger"}>{c.status.toLowerCase()}</Badge>
                <span className="record-reference">Logged {new Date(c.createdAt).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}</span></div>
              <p className="complaint-reason">{c.reason}</p>
              {c.adminNotes && <p className="team-note">Team notes: {c.adminNotes}</p>}
            </div>
            <div className="segmented status-set" role="group" aria-label="Set complaint status">
              {(["OPEN", "REVIEWING", "RESOLVED"] as const).map((s) => (
                <button key={s} type="button" aria-pressed={c.status === s} onClick={() => updateStatus(c.id, s)} disabled={updatingId !== null || c.status === s}>
                  {s === "OPEN" ? "Mark open" : s === "REVIEWING" ? "Mark reviewing" : "Mark resolved"}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Pagination
        {...pager}
        loading={loading || updatingId !== null}
        onPageChange={pager.setPage}
      />
    </div>
  );
}
export default function AdminComplaintsPage() {
  return (
    <RequireSession>
      <AdminComplaints />
    </RequireSession>
  );
}
