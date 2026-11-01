import type { RentalRequest } from '@prisma/client';
import type { PropertyListing } from './property-listing';
import { distanceKm } from '../../common/geography';

export type CriterionStatus =
  'matched' | 'different' | 'unspecified' | 'unknown';
export const MATCH_WEIGHTS = {
  area: 30,
  budget: 15,
  propertyType: 10,
  bedrooms: 10,
  size: 5,
  parking: 5,
  stay: 5,
  furnishing: 5,
} as const;
export type CriterionKey = keyof typeof MATCH_WEIGHTS;
export interface MatchCriterion {
  key: CriterionKey;
  label: string;
  status: CriterionStatus;
  detail: string;
}
export const MAX_MATCH_SCORE = Object.values(MATCH_WEIGHTS).reduce(
  (sum, weight) => sum + weight,
  0,
);
export const matchPercentage = (score: number) =>
  Number(((score / MAX_MATCH_SCORE) * 100).toFixed(1));
const readable = (value: string) => value.toLowerCase().replaceAll('_', ' ');
const money = (value: number) => `LKR ${value.toLocaleString('en-LK')}`;

export function areaTextMatches(left: string, right: string): boolean {
  const tokens = (text: string) =>
    text
      .toLowerCase()
      .split(/[,/]/)
      .map((token) => token.trim().replace(/\s+/g, ' '))
      .filter(Boolean);
  return tokens(left).some((a) =>
    tokens(right).some(
      (b) => a === b || a.startsWith(`${b} `) || b.startsWith(`${a} `),
    ),
  );
}

export function assessMatch(listing: PropertyListing, request: RentalRequest) {
  const criteria: MatchCriterion[] = [];
  const add = (
    key: CriterionKey,
    label: string,
    status: CriterionStatus,
    detail: string,
  ) => criteria.push({ key, label, status, detail });
  let distance: number | null = null;
  if (
    request.searchLatitude != null &&
    request.searchLongitude != null &&
    request.searchRadiusKm != null
  ) {
    if (listing.latitude == null || listing.longitude == null)
      add(
        'area',
        'Area',
        'unknown',
        `Location unverified: ${listing.areaText} has no map pin.`,
      );
    else {
      distance = distanceKm(
        request.searchLatitude,
        request.searchLongitude,
        Number(listing.latitude),
        Number(listing.longitude),
      );
      const within = distance <= request.searchRadiusKm;
      add(
        'area',
        'Area',
        within ? 'matched' : 'different',
        `${within ? 'Area matched' : 'Outside selected area'}: ${distance.toFixed(2)} km from the centre; requested radius ${request.searchRadiusKm} km.`,
      );
    }
  } else {
    const matched = areaTextMatches(listing.areaText, request.areaText);
    add(
      'area',
      'Area',
      matched ? 'matched' : 'different',
      `${matched ? 'Area matched' : 'Different area'}: ${listing.areaText}; requested ${request.areaText}.`,
    );
  }
  const budgetMatches =
    listing.monthlyRent <= request.budgetMax &&
    (request.budgetMin == null || listing.monthlyRent >= request.budgetMin);
  add(
    'budget',
    'Budget',
    budgetMatches ? 'matched' : 'different',
    `${money(listing.monthlyRent)}/month; requested ${request.budgetMin ? `${money(request.budgetMin)}–` : 'up to '}${money(request.budgetMax)}.`,
  );
  add(
    'propertyType',
    'Property type',
    listing.propertyType === request.propertyType ? 'matched' : 'different',
    `${readable(listing.propertyType)} offered; ${readable(request.propertyType)} requested.`,
  );
  add(
    'bedrooms',
    'Bedrooms',
    request.bedrooms == null
      ? 'unspecified'
      : listing.bedrooms >= request.bedrooms
        ? 'matched'
        : 'different',
    `${listing.bedrooms} bedrooms; ${request.bedrooms == null ? 'no preference specified' : `${request.bedrooms} or more requested`}.`,
  );
  add(
    'size',
    'Size',
    !request.size
      ? 'unspecified'
      : listing.size === request.size
        ? 'matched'
        : 'different',
    `${readable(listing.size)}; ${request.size ? `${readable(request.size)} requested` : 'no size preference'}.`,
  );
  add(
    'parking',
    'Parking',
    request.parking !== true
      ? 'unspecified'
      : listing.parking
        ? 'matched'
        : 'different',
    `${listing.parking ? 'Parking available' : 'No parking'}; ${request.parking ? 'parking required' : 'no parking preference'}.`,
  );
  add(
    'stay',
    'Stay length',
    listing.minDurationMonths <= request.durationMonths
      ? 'matched'
      : 'different',
    `${listing.minDurationMonths}-month minimum; renter plans ${request.durationMonths} months.`,
  );
  add(
    'furnishing',
    'Furnishing',
    !request.furnishing
      ? 'unspecified'
      : listing.furnishing === request.furnishing
        ? 'matched'
        : 'different',
    `${readable(listing.furnishing)}; ${request.furnishing ? `${readable(request.furnishing)} requested` : 'no furnishing preference'}.`,
  );
  let score = criteria.reduce(
    (sum, criterion) =>
      sum +
      (criterion.status === 'matched' || criterion.status === 'unspecified'
        ? MATCH_WEIGHTS[criterion.key]
        : 0),
    0,
  );
  // Preserve a useful price tie-break within the accepted budget range.
  if (budgetMatches) {
    const floor = request.budgetMin ?? 0;
    const budgetPoints = Math.round(
      8 +
        (7 * (request.budgetMax - listing.monthlyRent)) /
          (request.budgetMax - floor || 1),
    );
    score += budgetPoints - MATCH_WEIGHTS.budget;
  }
  const differences = criteria.filter(
    (criterion) =>
      criterion.status === 'different' || criterion.status === 'unknown',
  );
  return {
    criteria,
    score,
    matchPercentage: matchPercentage(score),
    areaMatched: criteria[0].status === 'matched',
    distanceKm: distance,
    requiresReview: differences.length > 0,
    reasons: criteria
      .filter((criterion) => criterion.status === 'matched')
      .map((criterion) => `${criterion.label} matched: ${criterion.detail}`),
    differences: differences.map((criterion) => criterion.detail),
  };
}
export type MatchAssessment = ReturnType<typeof assessMatch>;
export function comparePotentialMatches(
  a: { id: string; assessment: MatchAssessment },
  b: { id: string; assessment: MatchAssessment },
): number {
  return (
    Number(b.assessment.areaMatched) - Number(a.assessment.areaMatched) ||
    b.assessment.score - a.assessment.score ||
    a.id.localeCompare(b.id)
  );
}
