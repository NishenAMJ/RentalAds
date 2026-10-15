"use client";
import Link from "next/link";
import { usePaginated } from "@/lib/use-paginated";
import { Pagination } from "./pagination";

import { MatchCriteria } from "./match-criteria";
import type { MatchAssessment } from "@/lib/matching";

interface DashboardMatch extends MatchAssessment {
  reference: string | null;
  ownerContact: string;
  id: string;
  requestId: string;
  requestArea: string;
  listingId: string;
  areaText: string;
  monthlyRent: number;
  matchPercentage: number;
  reasons: string[];
}
export function AdminMatches() {
  const pager = usePaginated<DashboardMatch>("/matching/dashboard", true);
  return (
    <section className="panel" aria-labelledby="dashboard-matches-title">
      <div className="record-heading">
        <h2 id="dashboard-matches-title">Potential matches: area first</h2>
        <button
          type="button"
          className="text-button"
          onClick={pager.retry}
          disabled={pager.loading}
        >
          Refresh matches
        </button>
      </div>
      <p className="muted">
        All active homes for open requests. Area matches come first; differences
        are shown so you can discuss changing preferences with the renter.
      </p>
      {pager.loading && <p role="status">Comparing active homes…</p>}
      {pager.error && (
        <p role="alert" className="notice error">
          {pager.error}{" "}
          <button type="button" onClick={pager.retry}>
            Retry
          </button>
        </p>
      )}
      {!pager.loading && !pager.error && !pager.items.length && (
        <p className="notice">
          No active properties or open requests on this page.
        </p>
      )}
      <div className="stack">
        {pager.items.map((match) => (
          <article key={match.id} className="match-suggestion">
            <div className="record-heading">
              <h3>{match.areaText}</h3>
              <strong>{match.matchPercentage}% match</strong>
            </div>
            <p>LKR {match.monthlyRent.toLocaleString("en-LK")} / month</p>
            <p>Request: {match.requestArea}</p>
            <p>Listing ID: {match.reference ?? "Not assigned"}</p>
            <p>Owner contact (admin only): {match.ownerContact}</p>
            <MatchCriteria criteria={match.criteria} />
            {match.requiresReview && (
              <p className="notice">
                Potential option: discuss the differences before recommending.
              </p>
            )}
            <div className="actions">
              <Link href="/admin/requests">Manage rental requests</Link>
              <Link href={`/property/${match.listingId}`}>View property</Link>
            </div>
          </article>
        ))}
      </div>
      <Pagination {...pager} onPageChange={pager.setPage} />
    </section>
  );
}
