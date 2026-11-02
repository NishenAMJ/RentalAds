import type { Listing } from '@prisma/client';
import { approximateLocation } from '../../common/geography';

// Adding a database field never publishes it automatically.
export function toPublicListing(
  listing: Listing & {
    owner?: { ownerVerificationStatus: string };
  },
) {
  const location = approximateLocation(listing.latitude, listing.longitude);
  return {
    id: listing.id,
    reference: listing.reference,
    category: listing.category,
    ownerVerified: listing.owner?.ownerVerificationStatus === 'VERIFIED',
    title: listing.title,
    description: listing.description,
    attributes: listing.attributes,
    depositAmount: listing.depositAmount,
    propertyType: listing.propertyType,
    size: listing.size,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    parking: listing.parking,
    furnishing: listing.furnishing,
    areaText: listing.areaText,
    approximateLocation: location,
    mapLink: location
      ? `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=15/${location.latitude}/${location.longitude}`
      : null,
    monthlyRent: listing.monthlyRent,
    ratePeriod: listing.ratePeriod,
    minDurationMonths: listing.minDurationMonths,
    keyMoney: listing.keyMoney,
    keyMoneyAmount: listing.keyMoneyAmount,
    photoUrls: listing.photoUrls,
    lastAvailabilityConfirmedAt: listing.lastAvailabilityConfirmedAt,
    createdAt: listing.createdAt,
  };
}
