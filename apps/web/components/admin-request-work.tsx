"use client";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { apiRequest } from "@/lib/api-client";
import { MESSAGE_TEMPLATES, renderTemplate } from "@/lib/message-templates";

export interface WorkState {
  id: string;
  areaText: string;
  assignedAdmin?: { id: string; email: string } | null;
  adminNotes?: string | null;
  followUpAt?: string | null;
}
export interface AdminRequestWorkProps { request: WorkState; onUpdated: (next: WorkState) => void }

const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : "");

/** Assignment, private notes, follow-up date and message templates for one request. Visible to admins only. */
export function AdminRequestWork({ request, onUpdated }: AdminRequestWorkProps) {
  const { user } = useAuth();
  const [notes, setNotes] = useState(request.adminNotes ?? "");
  const [followUp, setFollowUp] = useState(toDateInput(request.followUpAt));
  const [template, setTemplate] = useState(MESSAGE_TEMPLATES[0].id);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const assignedToMe = !!request.assignedAdmin && request.assignedAdmin.email === user?.email;

  async function save(body: object, success: string) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await apiRequest<WorkState>(`/requests/${encodeURIComponent(request.id)}/work`, { method: "PATCH", authenticated: true, body: JSON.stringify(body) });
      onUpdated(updated);
      setMessage(success);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save.");
    } finally { setBusy(false); }
  }

  async function copyTemplate() {
    setError(""); setMessage("");
    try {
      await navigator.clipboard.writeText(renderTemplate(template, { area: request.areaText }));
      setMessage("Message copied. Review it before sending.");
    } catch {
      setError("Unable to copy. Allow clipboard access and try again.");
    }
  }

  return (
    <section className="work-panel" aria-label="Team work on this request">
      <div className="work-row">
        <p className="work-owner">
          {request.assignedAdmin ? <>Handled by <strong>{assignedToMe ? "you" : request.assignedAdmin.email}</strong></> : "Nobody is handling this request yet"}
        </p>
        {assignedToMe
          ? <button type="button" className="secondary" disabled={busy} onClick={() => void save({ unassign: true }, "Request released.")}>Release</button>
          : <button type="button" className="secondary" disabled={busy} onClick={() => void save({ assignToMe: true }, request.assignedAdmin ? "Request taken over." : "Request assigned to you.")}>{request.assignedAdmin ? "Take over" : "Assign to me"}</button>}
      </div>
      <div className="work-fields">
        <div className="ui-field"><label htmlFor={`follow-${request.id}`}>Follow up on</label>
          <input id={`follow-${request.id}`} type="date" value={followUp} disabled={busy} onChange={(event) => setFollowUp(event.target.value)} /></div>
        <div className="ui-field work-notes"><label htmlFor={`notes-${request.id}`}>Private notes (never shown to the renter)</label>
          <textarea id={`notes-${request.id}`} rows={3} maxLength={2000} value={notes} disabled={busy} onChange={(event) => setNotes(event.target.value)} /></div>
      </div>
      <div className="work-row">
        <button type="button" disabled={busy} onClick={() => void save({ adminNotes: notes, followUpAt: followUp ? new Date(`${followUp}T00:00:00.000Z`).toISOString() : null }, "Notes saved.")}>{busy ? "Saving…" : "Save notes and date"}</button>
        <div className="work-template">
          <label htmlFor={`template-${request.id}`} className="sr-only">Message template</label>
          <select id={`template-${request.id}`} value={template} onChange={(event) => setTemplate(event.target.value)}>
            {MESSAGE_TEMPLATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <button type="button" className="secondary" onClick={() => void copyTemplate()}>Copy message</button>
        </div>
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
      {message && <p role="status" className="small-copy">{message}</p>}
    </section>
  );
}
