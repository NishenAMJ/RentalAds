import type { Listing, RentalRequest } from '@prisma/client';
import type { PropertyListing } from './property-listing';
import { distanceKm } from '../../common/geography';

import { assessMatch } from './match-assessment';
export { MAX_MATCH_SCORE, matchPercentage } from './match-assessment';

export function locationFit(listing: Listing, request: RentalRequest) {
  if (
    request.searchLatitude == null ||
    request.searchLongitude == null ||
    request.searchRadiusKm == null
  )
    return { withinArea: true, distanceKm: null };
  if (listing.latitude == null || listing.longitude == null)
    return { withinArea: false, distanceKm: null };
  const distance = distanceKm(
    request.searchLatitude,
    request.searchLongitude,
    Number(listing.latitude),
    Number(listing.longitude),
  );
  return {
    withinArea: distance <= request.searchRadiusKm,
    distanceKm: distance,
  };
}

export function passesHardFilters(
  listing: PropertyListing,
  request: RentalRequest,
): boolean {
  if (listing.status !== 'ACTIVE') return false;
  if (listing.propertyType !== request.propertyType) return false;
  if (listing.monthlyRent > request.budgetMax) return false;
  if (request.bedrooms != null && listing.bedrooms < request.bedrooms)
    return false;
  if (request.parking === true && !listing.parking) return false;
  if (listing.minDurationMonths > request.durationMonths) return false;
  if (request.size && listing.size !== request.size) return false;
  return true;
}

// Compatibility exports for existing callers; assessment is the single scoring source.
export function scoreMatch(
  listing: PropertyListing,
  request: RentalRequest,
): number {
  return assessMatch(listing, request).score;
}
export function getMatchReasons(
  listing: PropertyListing,
  request: RentalRequest,
): string[] {
  return assessMatch(listing, request).reasons;
}
