"use client";

import { useEffect, useState, type ReactNode } from "react";
import { RequireSession } from "@/components/require-session";
import { apiRequest } from "@/lib/api-client";

import { usePaginated, type Page } from "@/lib/use-paginated";
import { Pagination } from "@/components/pagination";

import { SavedSearchAreaView } from "@/components/saved-search-area";
import { AdminLocationOverride } from "@/components/admin-location-override";
import { AdminDeleteButton } from "@/components/admin-delete-button";
import { AdminRequestWork } from "@/components/admin-request-work";
import type { SavedSearchArea } from "@/lib/search-area";

type RentalRequest = SavedSearchArea & {
  id: string;
  areaText: string;
  budgetMax: number;
  budgetMin: number | null;
  durationMonths: number;
  propertyType: string;
  status: string;
  renterContact: string;
  createdAt: string;
  assignedAdmin?: { id: string; email: string } | null;
  adminNotes?: string | null;
  followUpAt?: string | null;
};

type MatchStatus =
  "SUGGESTED" | "SENT" | "INTERESTED" | "NOT_INTERESTED" | "RENTED";
import { MatchCriteria } from "@/components/match-criteria";
import type { MatchAssessment } from "@/lib/matching";

type Suggestion = MatchAssessment & {
  reference: string | null;
  ownerContact: string;
  latitude: number | null;
  longitude: number | null;
  distanceKm: number | null;
  areaText: string;
  monthlyRent: number;
  locationOverrideReason?: string | null;
  recommendationReason?: string | null;
  matchId: string | null;
  status: MatchStatus | null;
  listingId: string;
  score: number;
  matchPercentage: number;
  reasons: string[];
  whatsappMessage: string;
};

/** The queue for one filter combination. Remounted (via `key`) when filters change so paging restarts. */
function RequestQueue({ filters, toolbar }: { filters: string; toolbar: ReactNode }) {
  const pager = usePaginated<RentalRequest>("/requests", true, filters);
  const { items: requests, loading, error } = pager;
  const [suggestionsByRequest, setSuggestionsByRequest] = useState<
    Record<string, Page<Suggestion>>
  >({});
  const [loadingMatchesFor, setLoadingMatchesFor] = useState<string | null>(
    null,
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedKey) return;
    const timeout = setTimeout(() => setCopiedKey(null), 2000);
    return () => clearTimeout(timeout);
  }, [copiedKey]);

  async function findMatches(requestId: string, page = 1) {
    if (loadingMatchesFor) return;
    setLoadingMatchesFor(requestId);
    setActionError(null);
    try {
      const data = await apiRequest<Page<Suggestion>>(
        `/matching/requests/${encodeURIComponent(requestId)}/suggestions?page=${page}&limit=5`,
        { authenticated: true },
      );
      setSuggestionsByRequest((previous) => ({
        ...previous,
        [requestId]: data,
      }));
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Failed to fetch matches.",
      );
    } finally {
      setLoadingMatchesFor(null);
    }
  }

  const [reviewReasons, setReviewReasons] = useState<Record<string, string>>(
    {},
  );
  const [savingMatch, setSavingMatch] = useState<string | null>(null);
  async function saveMatch(
    requestId: string,
    suggestion: Suggestion,
    status?: MatchStatus,
  ) {
    if (savingMatch) return;
    const recommendationReason =
      reviewReasons[`${requestId}:${suggestion.listingId}`]?.trim();
    if (
      !suggestion.matchId &&
      suggestion.requiresReview &&
      !recommendationReason
    ) {
      setActionError(
        "Record why this property is worth recommending despite its differences.",
      );
      return;
    }
    setSavingMatch(`${requestId}:${suggestion.listingId}`);
    setActionError(null);
    try {
      const match =
        suggestion.matchId && status
          ? await apiRequest<{
              id: string;
              status: MatchStatus;
              recommendationReason?: string | null;
            }>(`/matching/matches/${suggestion.matchId}/status`, {
              method: "PATCH",
              authenticated: true,
              body: JSON.stringify({ status }),
            })
          : await apiRequest<{
              id: string;
              status: MatchStatus;
              recommendationReason?: string | null;
            }>(`/matching/requests/${requestId}/suggestions`, {
              method: "POST",
              authenticated: true,
              body: JSON.stringify({
                listingId: suggestion.listingId,
                recommendationReason: suggestion.requiresReview
                  ? recommendationReason
                  : undefined,
              }),
            });
      setSuggestionsByRequest((current) => {
        const page = current[requestId];
        return page
          ? {
              ...current,
              [requestId]: {
                ...page,
                data: page.data.map((item) =>
                  item.listingId === suggestion.listingId
                    ? {
                        ...item,
                        matchId: match.id,
                        status: match.status,
                        recommendationReason:
                          match.recommendationReason ??
                          item.recommendationReason,
                      }
                    : item,
                ),
              },
            }
          : current;
      });
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "Unable to save match.",
      );
    } finally {
      setSavingMatch(null);
    }
  }
  async function copyMessage(
    requestId: string,
    listingId: string,
    message: string,
  ) {
    setActionError(null);
    setCopiedKey(null);
    try {
      await navigator.clipboard.writeText(message);
      setCopiedKey(`${requestId}:${listingId}`);
    } catch {
      setActionError(
        "Unable to copy the message. Allow clipboard access and try again.",
      );
    }
  }

  return (
    <div className="admin-workspace">
      <p className="eyebrow">Personal introductions</p>
      <h1>Rental requests</h1>
      <p className="intro">
        Review private briefs, assess suggestions and coordinate introductions
        manually.
      </p>
      {toolbar}
      {copiedKey && (
        <p className="notice" role="status">
          Message copied. Review it before sharing with the renter.
        </p>
      )}
      {loading && <p role="status">Loading...</p>}
      {error && (
        <p role="alert">
          {error} <button onClick={pager.retry}>Retry</button>
        </p>
      )}

      {actionError && (
        <p role="alert" className="notice error">
          {actionError}
        </p>
      )}
      {!loading && !error && requests.length === 0 && (
        <p className="notice">{filters ? "No requests match these filters." : "No rental requests yet."}</p>
      )}
      <div className="space-y-6">
        {requests.map((r) => (
          <div key={r.id} className="panel request-split">
            <div className="request-left">
            <div className="record-heading">
              <div>
                <span className="font-semibold">{r.areaText}</span>
                <p className="text-sm text-gray-600 mt-1">
                  {r.propertyType === "APARTMENT" ? "Apartment" : "House"} · up
                  to LKR {r.budgetMax.toLocaleString()} · {r.durationMonths}+
                  months
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Contact: {r.renterContact}
                </p>
              </div>
              <span className="ui-badge badge-success">
                {r.status}
              </span>
            </div>

            <SavedSearchAreaView
              request={r}
              exact
              properties={(suggestionsByRequest[r.id]?.data ?? []).flatMap(
                (s) =>
                  s.latitude != null && s.longitude != null
                    ? [
                        {
                          id: s.listingId,
                          latitude: s.latitude,
                          longitude: s.longitude,
                          areaText: s.areaText,
                          monthlyRent: s.monthlyRent,
                          distanceKm: s.distanceKm,
                        },
                      ]
                    : [],
              )}
            />
            <AdminLocationOverride request={r} />
            </div>
            <div className="request-right">
            <AdminRequestWork request={r} onUpdated={(next) => pager.setItems((rows) => rows.map((row) => (row.id === r.id ? { ...row, ...next } : row)))} />
            <AdminDeleteButton path={`/requests/${r.id}/admin-delete`} subject="request" disabled={loadingMatchesFor !== null || !!savingMatch} onDeleted={pager.retry} />
            <button
              onClick={() => void findMatches(r.id)}
              disabled={
                loadingMatchesFor !== null ||
                !!savingMatch ||
                r.status === "CLOSED"
              }
              className="match-action"
            >
              {loadingMatchesFor === r.id
                ? "Finding matches..."
                : "Find potential matches"}
            </button>

            {suggestionsByRequest[r.id] && (
              <div className="mt-4 space-y-3">
                <Pagination
                  {...suggestionsByRequest[r.id]}
                  loading={loadingMatchesFor !== null || !!savingMatch}
                  onPageChange={(page) => void findMatches(r.id, page)}
                />
                {suggestionsByRequest[r.id].data.length === 0 && (
                  <p className="text-sm text-gray-500">
                    No active properties on this page.
                  </p>
                )}
                {suggestionsByRequest[r.id].data.map((s) => (
                  <div key={s.listingId} className="match-suggestion">
                    <strong>{s.areaText}</strong>
                    <p>Listing ID: {s.reference ?? "Not assigned"}</p>
                    <p>Owner contact (admin only): {s.ownerContact}</p>
                    {s.distanceKm != null && (
                      <p>
                        Exact distance: {s.distanceKm.toFixed(2)} km (admin
                        only)
                      </p>
                    )}
                    {(s.recommendationReason || s.locationOverrideReason) && (
                      <p className="notice">
                        Reviewed recommendation:{" "}
                        {s.recommendationReason || s.locationOverrideReason}
                      </p>
                    )}
                    <MatchCriteria criteria={s.criteria} />
                    {!s.matchId && s.requiresReview && (
                      <label htmlFor={`review-${r.id}-${s.listingId}`}>
                        Recommendation reason (required to save a potential
                        match)
                        <textarea
                          id={`review-${r.id}-${s.listingId}`}
                          maxLength={1000}
                          disabled={!!savingMatch}
                          value={reviewReasons[`${r.id}:${s.listingId}`] ?? ""}
                          onChange={(event) =>
                            setReviewReasons((current) => ({
                              ...current,
                              [`${r.id}:${s.listingId}`]: event.target.value,
                            }))
                          }
                          placeholder="Explain which differences the renter is willing to consider."
                        />
                      </label>
                    )}
                    {s.matchId ? (
                      <label>
                        Match status
                        <select
                          value={s.status ?? "SUGGESTED"}
                          disabled={!!savingMatch || loadingMatchesFor !== null}
                          onChange={(event) =>
                            void saveMatch(
                              r.id,
                              s,
                              event.target.value as MatchStatus,
                            )
                          }
                        >
                          {(
                            [
                              "SUGGESTED",
                              "SENT",
                              "INTERESTED",
                              "NOT_INTERESTED",
                              "RENTED",
                            ] as const
                          ).map((status) => (
                            <option key={status} value={status}>
                              {status.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <button
                        disabled={
                          !!savingMatch ||
                          loadingMatchesFor !== null ||
                          r.status === "CLOSED"
                        }
                        onClick={() => void saveMatch(r.id, s)}
                      >
                        {savingMatch === `${r.id}:${s.listingId}`
                          ? "Saving..."
                          : "Save match"}
                      </button>
                    )}

                    <div className="record-heading match-tools">
                      <span className="font-medium text-sm">
                        Match: {s.matchPercentage}%
                      </span>
                      <button
                        onClick={() =>
                          void copyMessage(r.id, s.listingId, s.whatsappMessage)
                        }
                        className="text-button"
                      >
                        {copiedKey === `${r.id}:${s.listingId}`
                          ? "Copied!"
                          : "Copy message"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>
          </div>
        ))}
      </div>
      <Pagination
        {...pager}
        loading={loading || loadingMatchesFor !== null || !!savingMatch}
        onPageChange={pager.setPage}
      />
    </div>
  );
}

const ASSIGNMENT_FILTERS = [["", "All"], ["me", "Mine"], ["unassigned", "Unassigned"]] as const;
const STATUS_FILTERS = [["", "Any status"], ["OPEN", "Open"], ["MATCHED", "Matched"], ["CLOSED", "Closed"]] as const;

function AdminRequests() {
  const [assigned, setAssigned] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const filters = new URLSearchParams({ ...(assigned ? { assigned } : {}), ...(status ? { status } : {}) }).toString();
  const toolbar = (
      <div className="queue-filters">
        <div className="segmented" role="group" aria-label="Filter by assignment">
          {ASSIGNMENT_FILTERS.map(([value, label]) => <button key={label} type="button" aria-pressed={assigned === value} onClick={() => setAssigned(value)}>{label}</button>)}
        </div>
        <div className="ui-field queue-status"><label htmlFor="queue-status" className="sr-only">Status</label>
          <select id="queue-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {STATUS_FILTERS.map(([value, label]) => <option key={label} value={value}>{label}</option>)}
          </select></div>
      </div>
  );
  return <RequestQueue key={filters} filters={filters} toolbar={toolbar} />;
}

export default function AdminRequestsPage() {
  return (
    <RequireSession>
      <AdminRequests />
    </RequireSession>
  );
}
