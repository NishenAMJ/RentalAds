import { categoryLabel } from "@/lib/categories";
export interface PublicListing {
  id: string;
  reference?: string | null;
  propertyType: "APARTMENT" | "HOUSE";
  size: "STUDIO" | "ONE_BR" | "TWO_BR" | "THREE_BR_PLUS" | "N_A";
  bedrooms: number;
  bathrooms: number;
  parking: boolean;
  furnishing: "FURNISHED" | "SEMI_FURNISHED" | "UNFURNISHED";
  areaText: string;
  mapLink: string | null;
  approximateLocation?: { latitude: number; longitude: number } | null;
  approximateDistanceKm?: number;
  monthlyRent: number;
  ratePeriod?: "DAY" | "WEEK" | "MONTH";
  category?: string;
  minDurationMonths: number;
  keyMoney: boolean;
  keyMoneyAmount: number | null;
  photoUrls: string[];
  lastAvailabilityConfirmedAt: string | null;
  createdAt: string;
}
/** A listing in any category, as its owner or an admin sees it. Property-only fields are null for items. */
export interface OwnerListing extends Omit<PublicListing, "propertyType" | "size" | "bedrooms" | "bathrooms" | "furnishing" | "minDurationMonths"> {
  propertyType: PublicListing["propertyType"] | null;
  size: PublicListing["size"] | null;
  bedrooms: number | null;
  bathrooms: number | null;
  furnishing: PublicListing["furnishing"] | null;
  minDurationMonths: number | null;
  title?: string | null;
  description?: string | null;
  attributes?: Record<string, string | number | boolean> | null;
  depositAmount?: number | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "INACTIVE";
  ownerContact: string;
  /** True when an approved listing is hidden from public browsing until the owner confirms availability. */
  availabilityStale?: boolean;
}
/** The unit a rate is priced per. Listings from before rate periods existed are monthly. */
export const rateUnit = (period?: "DAY" | "WEEK" | "MONTH" | null) => (period ?? "MONTH").toLowerCase();
export const money =(amount: number) => `LKR ${amount.toLocaleString("en-LK")}`;
export const readable = (value: string) => value.toLowerCase().replaceAll("_", " ");
export const statusLabel = { PENDING_APPROVAL: "Pending approval", ACTIVE: "Active", REJECTED: "Rejected", INACTIVE: "Inactive" };

/** Homes keep their own fields and pages; every other category is an item booked by date. */
export const isProperty = (listing: { category?: string }) => !listing.category || listing.category === "PROPERTY";
export const listingKind = (listing: { category?: string; propertyType?: string | null }) =>
  isProperty(listing) ? readable(listing.propertyType ?? "property") : categoryLabel(listing.category);
export const listingHref = (listing: { id: string; category?: string }) => (isProperty(listing) ? `/property/${listing.id}` : `/item/${listing.id}`);
