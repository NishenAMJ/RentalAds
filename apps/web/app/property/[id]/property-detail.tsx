"use client";

import { useEffect, useState } from "react";
import { PropertyImage } from "@/components/property-image";
import Link from "next/link";
import { ApiError, apiRequest } from "@/lib/api-client";
import { money, rateUnit, readable, type PublicListing } from "@/lib/listings";
import { ReportListingButton } from "@/components/ReportListingButton";
import { ActionLink, PrivacyNote, SkeletonCards } from "@/components/ui/primitives";

export function PropertyDetail({ id }: { id: string }) {
  const [listing, setListing] = useState<PublicListing | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(0);
  useEffect(() => {
    let active = true;
    void apiRequest<PublicListing>(`/listings/${encodeURIComponent(id)}`).then((data) => { if (active) setListing(data); }).catch((cause: Error) => {
      if (active) setError(cause instanceof ApiError && cause.status === 404 ? "This property is not currently available." : cause.message);
    });
    return () => { active = false; };
  }, [id]);
  if (error) return <section><p role="alert" className="notice error">{error}</p><Link href="/listings">Back to homes</Link></section>;
  if (!listing) return <SkeletonCards label="Loading property details" />;
  const photos = listing.photoUrls;
  const shown = photos[Math.min(active, Math.max(photos.length - 1, 0))];
  const facts: [string, string][] = [
    ["Bedrooms", String(listing.bedrooms)], ["Bathrooms", String(listing.bathrooms)], ["Furnishing", readable(listing.furnishing)],
    ["Parking", listing.parking ? "Available" : "Not available"], ["Minimum stay", `${listing.minDurationMonths} months`],
    ["Key money", listing.keyMoney && listing.keyMoneyAmount !== null ? money(listing.keyMoneyAmount) : "Not required"],
  ];
  return <section className="property-page">
    <nav className="breadcrumb" aria-label="Breadcrumb"><Link href="/listings">All homes</Link><span aria-hidden="true">/</span><span>{listing.areaText}</span>{listing.reference && <><span aria-hidden="true">/</span><code>{listing.reference}</code></>}</nav>
    <div className="property-layout">
      <div className="property-media">
        <div className="property-hero">{shown ? <PropertyImage className="property-photo" src={shown} alt={`Property in ${listing.areaText}, photo ${Math.min(active, photos.length - 1) + 1}`} width={1200} height={720} sizes="(max-width: 1050px) 100vw, 760px" priority /> : <div className="photo-placeholder">Property photos have not been added yet.</div>}{photos.length > 1 && <span className="photo-count">{Math.min(active, photos.length - 1) + 1} / {photos.length}</span>}</div>
        {photos.length > 1 && <ul className="thumb-row" aria-label="Property photos">{photos.map((url, index) => <li key={`${url}-${index}`}><button type="button" className="thumb" aria-label={`Show photo ${index + 1}`} aria-current={index === active} onClick={() => setActive(index)}><PropertyImage src={url} alt="" width={240} height={150} sizes="160px" /></button></li>)}</ul>}
      </div>
      <aside className="property-side">
        <div className="panel property-identity"><div className="identity-top"><span className="ui-badge">{readable(listing.propertyType)}</span>{listing.reference && <span className="record-reference">{listing.reference}</span>}</div>
          <h1>{listing.areaText}</h1><p className="rent">{money(listing.monthlyRent)} <span>/ {rateUnit(listing.ratePeriod)}</span></p></div>
        <div className="panel"><h2 className="side-title">At a glance</h2><dl className="glance">{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          {listing.mapLink && <a className="map-link" href={listing.mapLink} target="_blank" rel="noopener noreferrer">View approximate location on map ↗</a>}
          {listing.lastAvailabilityConfirmedAt && <p className="small-copy"><span className="live-dot" />Availability confirmed {new Date(listing.lastAvailabilityConfirmedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}</p>}</div>
        <div className="panel property-cta"><h2 className="side-title">Could this be your kind of home?</h2><PrivacyNote>Start a private request and tell us your preferences. Our team coordinates introductions; owner contact details are never published.</PrivacyNote><ActionLink href="/renter/new">Make a private request</ActionLink><ReportListingButton key={listing.id} listingId={listing.id} /></div>
      </aside>
    </div>
  </section>;
}
