"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api-client";
import {
  money,
  readable,
  statusLabel,
  type OwnerListing,
} from "@/lib/listings";

export function AdminListingLookup() {
  const id = useId();
  const [identifier, setIdentifier] = useState("");
  const [listing, setListing] = useState<OwnerListing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  async function search() {
    if (inFlight.current) return;
    setError("");
    setListing(null);
    if (!identifier.trim()) {
      setError("Enter a listing ID such as SL-000001.");
      return;
    }
    inFlight.current = true;
    setBusy(true);
    try {
      setListing(
        await apiRequest<OwnerListing>(
          `/listings/admin/lookup/${encodeURIComponent(identifier.trim())}`,
          { authenticated: true },
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Unable to find this listing.",
      );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <section className="panel" aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Find a listing by ID</h2>
      <p className="small-copy">
        Search approved listing references, including inactive homes. A property
        UUID also works.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <label htmlFor={`${id}-reference`}>Listing ID</label>
        <div className="actions">
          <input
            id={`${id}-reference`}
            name="listingReference"
            placeholder="SL-000001"
            value={identifier}
            disabled={busy}
            onChange={(event) => {
              setIdentifier(event.target.value);
              setListing(null);
              setError("");
            }}
          />
          <button disabled={busy}>
            {busy ? "Searching..." : "Find listing"}
          </button>
        </div>
      </form>
      {busy && <p role="status">Looking up the listing...</p>}
      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {listing && (
        <article className="match-suggestion">
          <h3>
            {listing.reference ?? "Awaiting approval"}: {listing.areaText}
          </h3>
          <p>
            {statusLabel[listing.status]} · {readable(listing.propertyType)} ·{" "}
            {money(listing.monthlyRent)} / month
          </p>
          <p>
            {listing.bedrooms} bedrooms · {listing.bathrooms} bathrooms
          </p>
          <p>Owner contact (admin only): {listing.ownerContact}</p>
          {listing.status === "ACTIVE" && (
            <Link href={`/property/${listing.id}`}>View property</Link>
          )}
        </article>
      )}
    </section>
  );
}
