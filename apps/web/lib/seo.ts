/** Pure helpers for search-engine and social-sharing metadata. Kept free of framework imports so they are easy to test. */

export interface SeoListing {
  id: string;
  reference?: string | null;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  furnishing: string;
  areaText: string;
  monthlyRent: number;
  photoUrls: string[];
}

const readable = (value: string) => value.toLowerCase().replaceAll("_", " ");
const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

/** Public origin of the site, without a trailing slash. */
export function siteUrl(env: string | undefined = process.env.NEXT_PUBLIC_SITE_URL): string {
  try {
    return env ? new URL(env).origin : "http://localhost:3000";
  } catch {
    return "http://localhost:3000";
  }
}

export function listingTitle(listing: SeoListing): string {
  return `${capitalise(readable(listing.propertyType))} for rent in ${listing.areaText}`;
}

export function listingDescription(listing: SeoListing): string {
  const rent = `LKR ${listing.monthlyRent.toLocaleString("en-LK")} per month`;
  return `${listing.bedrooms} bed, ${listing.bathrooms} bath, ${readable(listing.furnishing)} ${readable(listing.propertyType)} in ${listing.areaText}. ${rent}. Reviewed by Sewana Lanka; owner contact details stay private.`;
}

/** schema.org structured data so search engines can show rent and location. */
export function listingJsonLd(listing: SeoListing, origin: string): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    name: listingTitle(listing),
    description: listingDescription(listing),
    url: `${origin}/property/${listing.id}`,
    ...(listing.photoUrls[0] ? { image: listing.photoUrls[0] } : {}),
    about: {
      "@type": listing.propertyType === "HOUSE" ? "House" : "Apartment",
      numberOfBedrooms: listing.bedrooms,
      numberOfBathroomsTotal: listing.bathrooms,
      address: { "@type": "PostalAddress", addressLocality: listing.areaText, addressCountry: "LK" },
    },
    offers: {
      "@type": "Offer",
      price: listing.monthlyRent,
      priceCurrency: "LKR",
      priceSpecification: { "@type": "UnitPriceSpecification", price: listing.monthlyRent, priceCurrency: "LKR", unitText: "MONTH" },
    },
  };
}

/** Serialises JSON-LD for a script tag; "<" is escaped so user text can never close the tag. */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
