"use client";
import { useId, useRef, useState } from "react";
import { apiRequest } from "@/lib/api-client";
import type { OwnerListing } from "@/lib/listings";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "./pagination";
import { SavedSearchAreaView } from "./saved-search-area";
import type { SavedSearchArea } from "@/lib/search-area";

import { MatchCriteria } from "./match-criteria";
import type { MatchAssessment } from "@/lib/matching";

interface Candidate extends MatchAssessment {
  listing: OwnerListing;
  withinArea: boolean;
  distanceKm: number | null;
  meetsNonLocationRequirements: boolean;
  locationWarning: string | null;
}
interface SavedMatch {
  recommendationReason: string | null;
  recommendedByAdminId: string | null;
  recommendationReviewedAt: string | null;
  id: string;
  listing: OwnerListing;
  status: string;
  locationOverrideReason: string | null;
  locationOverrideAdminId: string | null;
  locationOverrideAt: string | null;
}
function SavedMatches({
  requestId,
  revision,
}: {
  requestId: string;
  revision: number;
}) {
  return <SavedMatchesPage key={revision} requestId={requestId} />;
}
function SavedMatchesPage({ requestId }: { requestId: string }) {
  const pager = usePaginated<SavedMatch>(
    `/matching/requests/${requestId}/matches`,
    true,
  );
  return (
    <div>
      {pager.loading && <p role="status">Loading recorded recommendations…</p>}
      {pager.error && (
        <p role="alert">
          {pager.error}{" "}
          <button type="button" onClick={pager.retry}>
            Retry
          </button>
        </p>
      )}
      {!pager.loading && !pager.error && !pager.items.length && (
        <p>No recorded recommendations.</p>
      )}
      {pager.items.map((match) => (
        <article key={match.id} className="match-suggestion">
          <a
            href={`/property/${match.listing.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {match.listing.areaText}
          </a>
          <p>{match.status.replaceAll("_", " ")}</p>
          <p>Listing ID: {match.listing.reference ?? "Not assigned"}</p>
          <p>Owner contact (admin only): {match.listing.ownerContact}</p>
          {(match.recommendationReason || match.locationOverrideReason) && (
            <div className="notice">
              <strong>Reviewed recommendation</strong>
              <p>
                {match.recommendationReason || match.locationOverrideReason}
              </p>
              <small>
                Administrator:{" "}
                {match.recommendedByAdminId || match.locationOverrideAdminId}
                <br />
                {(match.recommendationReviewedAt || match.locationOverrideAt) &&
                  new Date(
                    (match.recommendationReviewedAt ||
                      match.locationOverrideAt)!,
                  ).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}
              </small>
            </div>
          )}
        </article>
      ))}
      <Pagination {...pager} onPageChange={pager.setPage} />
    </div>
  );
}
export function AdminLocationOverride({
  request,
}: {
  request: SavedSearchArea & { id: string; status: string };
}) {
  const id = useId();
  const [input, setInput] = useState("");
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const [revision, setRevision] = useState(0);
  const inFlight = useRef(false);
  async function lookup() {
    if (inFlight.current) return;
    setCandidate(null);
    setError("");
    setMessage("");
    setReason("");
    const listingId =
      input
        .trim()
        .replace(/[?#].*$/, "")
        .replace(/\/$/, "")
        .split("/")
        .pop() ?? "";
    if (
      !/^(?:SL-\d{6,20}|[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12})$/i.test(
        listingId,
      )
    ) {
      setError(
        "Enter a listing reference such as SL-000001, UUID or property detail link.",
      );
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      setCandidate(
        await apiRequest<Candidate>(
          `/matching/requests/${request.id}/candidates/${listingId}`,
          { authenticated: true },
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to look up this listing.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function recommend() {
    if (!candidate || inFlight.current) return;
    if (candidate.requiresReview && !reason.trim()) {
      setError("Record why these differences are acceptable to the renter.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/matching/requests/${request.id}/suggestions`, {
        method: "POST",
        authenticated: true,
        body: JSON.stringify({
          listingId: candidate.listing.id,
          recommendationReason: reason.trim() || undefined,
        }),
      });
      setMessage(
        "Recommendation recorded. This does not send a message to the renter.",
      );
      setCandidate(null);
      setReason("");
      setShowSaved(true);
      setRevision((n) => n + 1);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to record recommendation.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="perimeter-search">
      {request.status !== "CLOSED" && (
        <details>
          <summary>Look up a property to recommend</summary>
          <p className="small-copy">
            Review each preference and record why a property with differences is
            worth recommending.
          </p>
          <label htmlFor={`${id}-listing`}>
            Listing reference, ID or property link
          </label>
          <input
            id={`${id}-listing`}
            value={input}
            disabled={busy}
            onChange={(event) => {
              setInput(event.target.value);
              setCandidate(null);
            }}
          />
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => void lookup()}
          >
            Look up active listing
          </button>
          {candidate && (
            <article className="panel">
              <h3>{candidate.listing.areaText}</h3>
              <p>Listing ID: {candidate.listing.reference ?? "Not assigned"}</p>
              <p>
                Owner contact (admin only): {candidate.listing.ownerContact}
              </p>
              <p>
                LKR {candidate.listing.monthlyRent.toLocaleString("en-LK")} /
                month · {candidate.listing.bedrooms} beds ·{" "}
                {candidate.listing.propertyType.toLowerCase()}
              </p>
              <p>
                {candidate.listing.parking ? "Parking" : "No parking"} ·{" "}
                {candidate.listing.minDurationMonths} month minimum stay ·{" "}
                {candidate.listing.size.replaceAll("_", " ")}
              </p>
              <a
                href={`/property/${candidate.listing.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Review property details
              </a>
              <SavedSearchAreaView
                request={request}
                exact
                properties={
                  candidate.listing.latitude != null &&
                  candidate.listing.longitude != null
                    ? [
                        {
                          id: candidate.listing.id,
                          latitude: Number(candidate.listing.latitude),
                          longitude: Number(candidate.listing.longitude),
                          areaText: candidate.listing.areaText,
                          monthlyRent: candidate.listing.monthlyRent,
                          distanceKm: candidate.distanceKm,
                        },
                      ]
                    : []
                }
              />
              {candidate.locationWarning && (
                <p className="notice" role="status">
                  {candidate.locationWarning}
                  {candidate.distanceKm != null &&
                    ` Exact distance: ${candidate.distanceKm.toFixed(2)} km.`}
                </p>
              )}
              <MatchCriteria criteria={candidate.criteria} />
              <label htmlFor={`${id}-reason`}>
                Recommendation reason{" "}
                {candidate.requiresReview ? "(required)" : "(optional)"}
              </label>
              <textarea
                id={`${id}-reason`}
                maxLength={1000}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
              />
              <button
                type="button"
                disabled={busy || (candidate.requiresReview && !reason.trim())}
                onClick={() => void recommend()}
              >
                {busy ? "Saving..." : "Record recommendation"}
              </button>
            </article>
          )}
        </details>
      )}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        onClick={() => setShowSaved((value) => !value)}
      >
        {showSaved ? "Hide" : "View"} recorded recommendations and overrides
      </button>
      {showSaved && <SavedMatches requestId={request.id} revision={revision} />}
    </div>
  );
}
