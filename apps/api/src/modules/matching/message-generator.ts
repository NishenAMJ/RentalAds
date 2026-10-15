import { Listing } from '@prisma/client';

function formatSize(listing: Listing): string {
  if (listing.propertyType === 'HOUSE') return 'House';
  const labels: Record<string, string> = {
    STUDIO: 'Studio',
    ONE_BR: '1 Bedroom Apartment',
    TWO_BR: '2 Bedroom Apartment',
    THREE_BR_PLUS: '3+ Bedroom Apartment',
    N_A: 'Apartment',
  };
  return labels[listing.size] ?? 'Apartment';
}

function formatFurnishing(furnishing: string): string {
  return furnishing
    .toLowerCase()
    .split('_')
    .join('-')
    .replace(/^\w/, (c) => c.toUpperCase());
}

export function buildWhatsAppMessage(
  listing: Listing,
  publicUrl: string,
): string {
  const lines = [
    ...(listing.reference ? [`Listing ID: ${listing.reference}`] : []),
    formatSize(listing),
    `${listing.bedrooms} bed, ${listing.bathrooms} bath`,
    formatFurnishing(listing.furnishing),
    listing.parking ? 'Parking available' : 'No parking',
    `Location: ${listing.areaText}`,
    `Rent: LKR ${listing.monthlyRent.toLocaleString()}/month`,
  ];

  if (listing.keyMoney && listing.keyMoneyAmount) {
    lines.push(`Key money: LKR ${listing.keyMoneyAmount.toLocaleString()}`);
  }

  lines.push(`Minimum stay: ${listing.minDurationMonths} months`);
  lines.push(`Photos: ${publicUrl}`);

  return lines.join('\n');
}
