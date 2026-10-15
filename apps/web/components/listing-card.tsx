import { PropertyImage } from "@/components/property-image";
import Link from "next/link";
import { money, readable, type PublicListing } from "@/lib/listings";

export function ListingCard({ listing }: { listing: PublicListing }) {
  return <article className="listing-card">
    <Link href={`/property/${listing.id}`} aria-label={`View ${readable(listing.propertyType)} in ${listing.areaText}`}>
      {listing.photoUrls[0] ? <PropertyImage className="property-photo" src={listing.photoUrls[0]} alt={`${readable(listing.propertyType)} in ${listing.areaText}`} width={640} height={420} sizes="(max-width: 760px) 100vw, (max-width: 1100px) 50vw, 400px" /> : <div className="photo-placeholder">Photos coming soon</div>}
      <div className="card-body"><p className="eyebrow">{readable(listing.propertyType)}</p><h2>{listing.areaText}</h2><p className="card-facts">{listing.bedrooms} bed · {listing.bathrooms} bath · {readable(listing.furnishing)}</p><div className="card-footer"><p className="rent">{money(listing.monthlyRent)} <span>/ month</span></p><span className="details-chip" aria-hidden="true">Details</span></div></div>
    </Link>
  </article>;
}
