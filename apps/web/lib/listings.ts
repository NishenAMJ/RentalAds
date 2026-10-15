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
  minDurationMonths: number;
  keyMoney: boolean;
  keyMoneyAmount: number | null;
  photoUrls: string[];
  lastAvailabilityConfirmedAt: string | null;
  createdAt: string;
}
export interface OwnerListing extends PublicListing {
  latitude?: number | string | null;
  longitude?: number | string | null;
  status: "PENDING_APPROVAL" | "ACTIVE" | "REJECTED" | "INACTIVE";
  ownerContact: string;
  /** True when an approved listing is hidden from public browsing until the owner confirms availability. */
  availabilityStale?: boolean;
}
export const money = (amount: number) => `LKR ${amount.toLocaleString("en-LK")}`;
export const readable = (value: string) => value.toLowerCase().replaceAll("_", " ");
export const statusLabel = { PENDING_APPROVAL: "Pending approval", ACTIVE: "Active", REJECTED: "Rejected", INACTIVE: "Inactive" };
