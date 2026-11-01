import type {
  FurnishingStatus,
  Listing,
  PropertySize,
  PropertyType,
} from '@prisma/client';

/** A listing whose property-only fields are all present. Matching only ever considers these. */
export type PropertyListing = Listing & {
  propertyType: PropertyType;
  size: PropertySize;
  bedrooms: number;
  bathrooms: number;
  furnishing: FurnishingStatus;
  minDurationMonths: number;
};

export function isPropertyListing(
  listing: Listing,
): listing is PropertyListing {
  return (
    listing.propertyType != null &&
    listing.size != null &&
    listing.bedrooms != null &&
    listing.bathrooms != null &&
    listing.furnishing != null &&
    listing.minDurationMonths != null
  );
}
