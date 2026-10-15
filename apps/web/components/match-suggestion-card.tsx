"use client";
import { useId, useRef, useState } from "react";
import { MatchCriteria } from "@/components/match-criteria";
import { summariseCriteria, type MatchCriterion } from "@/lib/matching";

export type MatchStatus = "SUGGESTED" | "SENT" | "INTERESTED" | "NOT_INTERESTED" | "RENTED";
export const MATCH_STATUSES: readonly MatchStatus[] = ["SUGGESTED", "SENT", "INTERESTED", "NOT_INTERESTED", "RENTED"];

export interface MatchSuggestionData {
  listingId: string;
  reference: string | null;
  areaText: string;
  ownerContact: string;
  distanceKm: number | null;
  criteria: MatchCriterion[];
  requiresReview: boolean;
  matchPercentage: number;
  matchId: string | null;
  status: MatchStatus | null;
  recommendationReason?: string | null;
  locationOverrideReason?: string | null;
}

export interface MatchSuggestionCardProps {
  suggestion: MatchSuggestionData;
  /** Written justification, kept by the parent so it survives collapsing and re-renders. */
  reason: string;
  onReasonChange: (value: string) => void;
  defaultOpen: boolean;
  /** Something else (a save or a search) is in progress, so actions are paused. */
  busy: boolean;
  saving: boolean;
  requestClosed: boolean;
  copied: boolean;
  onSave: () => void;
  onStatusChange: (status: MatchStatus) => void;
  onCopy: () => void;
}

/**
 * One suggested home for a request. Collapsed it shows only what is needed to triage and act;
 * the full criteria, contact details and written reason are one click away.
 */
export function MatchSuggestionCard(props: MatchSuggestionCardProps) {
  const { suggestion: s, reason, busy, saving, requestClosed, copied } = props;
  const [open, setOpen] = useState(props.defaultOpen);
  const panelId = useId();
  const reasonField = useRef<HTMLTextAreaElement>(null);
  const needsReason = !s.matchId && s.requiresReview;
  const differences = s.criteria.filter((criterion) => criterion.key !== "area" && criterion.status === "different").length;

  function save() {
    // The reason field lives in the expanded part, so open it and send focus there instead of failing silently.
    if (needsReason && !reason.trim()) {
      setOpen(true);
      requestAnimationFrame(() => reasonField.current?.focus());
    }
    props.onSave();
  }

  return (
    <div className="match-suggestion match-card">
      <div className="match-card-head">
        <button type="button" className="match-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
          <span className="match-chevron" aria-hidden="true">{open ? "▾" : "▸"}</span>
          <span className="match-title"><strong>{s.areaText}</strong><span className="record-reference">{s.reference ?? "No ID yet"}</span></span>
          <span className="match-percent" aria-label={`${s.matchPercentage} percent match`}>{s.matchPercentage}%</span>
        </button>
        <p className="match-summary">
          {summariseCriteria(s.criteria)}
          {s.distanceKm != null && <> · {s.distanceKm.toFixed(2)} km</>}
          {s.matchId && <span className="ui-badge badge-success">Saved: {(s.status ?? "SUGGESTED").replaceAll("_", " ").toLowerCase()}</span>}
          {needsReason && <span className="ui-badge badge-warning">Needs a reason{differences ? ` (${differences} difference${differences > 1 ? "s" : ""})` : ""}</span>}
        </p>
        <div className="match-actions">
          {s.matchId ? (
            <label className="match-status">
              <span className="sr-only">Match status</span>
              <select aria-label="Match status" value={s.status ?? "SUGGESTED"} disabled={busy || saving}
                onChange={(event) => props.onStatusChange(event.target.value as MatchStatus)}>
                {MATCH_STATUSES.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
              </select>
            </label>
          ) : (
            <button type="button" disabled={busy || saving || requestClosed} onClick={save}>{saving ? "Saving..." : "Save match"}</button>
          )}
          <button type="button" className="text-button" onClick={props.onCopy}>{copied ? "Copied!" : "Copy message"}</button>
        </div>
      </div>
      {open && (
        <div id={panelId} className="match-details">
          <p>Listing ID: {s.reference ?? "Not assigned"}</p>
          <p>Owner contact (admin only): {s.ownerContact}</p>
          {s.distanceKm != null && <p>Exact distance: {s.distanceKm.toFixed(2)} km (admin only)</p>}
          {(s.recommendationReason || s.locationOverrideReason) && (
            <p className="notice">Reviewed recommendation: {s.recommendationReason || s.locationOverrideReason}</p>
          )}
          <MatchCriteria criteria={s.criteria} />
          {needsReason && (
            <label>
              Recommendation reason (required to save a potential match)
              <textarea ref={reasonField} maxLength={1000} disabled={busy} value={reason} onChange={(event) => props.onReasonChange(event.target.value)}
                placeholder="Explain which differences the renter is willing to consider." />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
