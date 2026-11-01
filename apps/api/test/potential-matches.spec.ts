import type { RentalRequest } from '@prisma/client';
import type { PropertyListing } from '../src/modules/matching/property-listing';
import {
  assessMatch,
  areaTextMatches,
  comparePotentialMatches,
} from '../src/modules/matching/match-assessment';
import { TopResults } from '../src/common/top-results';

const request = {
  areaText: 'Maharagama',
  propertyType: 'APARTMENT',
  budgetMax: 10000,
  budgetMin: null,
  bedrooms: 2,
  size: null,
  parking: null,
  furnishing: null,
  durationMonths: 12,
  searchLatitude: 6.9,
  searchLongitude: 79.9,
  searchRadiusKm: 3,
} as RentalRequest;
const listing = {
  id: 'house',
  status: 'ACTIVE',
  areaText: 'Maharagama',
  propertyType: 'HOUSE',
  monthlyRent: 30000,
  bedrooms: 2,
  size: 'TWO_BR',
  parking: true,
  furnishing: 'UNFURNISHED',
  minDurationMonths: 6,
  latitude: 6.9,
  longitude: 79.9,
} as unknown as PropertyListing;

describe('potential match explanations and ranking', () => {
  it('explains an in-area house despite apartment and budget differences', () => {
    const result = assessMatch(listing, request);
    expect(result).toMatchObject({
      areaMatched: true,
      requiresReview: true,
      distanceKm: 0,
    });
    expect(result.criteria.map((c) => [c.key, c.status])).toEqual([
      ['area', 'matched'],
      ['budget', 'different'],
      ['propertyType', 'different'],
      ['bedrooms', 'matched'],
      ['size', 'unspecified'],
      ['parking', 'unspecified'],
      ['stay', 'matched'],
      ['furnishing', 'unspecified'],
    ]);
    expect(result.differences.join(' ')).toContain(
      'house offered; apartment requested',
    );
  });

  it('ranks area first even when the outside property has a higher score', () => {
    const nearby = {
      id: 'near',
      assessment: assessMatch(
        { ...listing, bedrooms: 0, minDurationMonths: 24 },
        request,
      ),
    };
    const outside = {
      id: 'far',
      assessment: assessMatch(
        {
          ...listing,
          latitude: null,
          longitude: null,
          propertyType: 'APARTMENT',
          monthlyRent: 5000,
        },
        request,
      ),
    };
    expect(nearby.assessment.score).toBeLessThan(outside.assessment.score);
    expect(
      [outside, nearby].sort(comparePotentialMatches).map((row) => row.id),
    ).toEqual(['near', 'far']);
  });

  it('keeps text-only areas compatible without confusing Colombo 1 and 10', () => {
    expect(areaTextMatches('Colombo 1', 'Colombo 10')).toBe(false);
    expect(areaTextMatches('Maharagama', 'Colombo, Maharagama')).toBe(true);
    expect(
      assessMatch(listing, {
        ...request,
        searchLatitude: null,
        searchLongitude: null,
        searchRadiusKm: null,
      }).areaMatched,
    ).toBe(true);
  });

  it('retains the same page as a full sort across many shuffled batches', () => {
    const rows = Array.from({ length: 1500 }, (_, index) => ({
      id: String(index).padStart(4, '0'),
      score: (index * 73) % 97,
    }));
    const compare = (a: (typeof rows)[number], b: (typeof rows)[number]) =>
      b.score - a.score || a.id.localeCompare(b.id);
    const top = new TopResults(41, compare);
    for (const row of rows) top.add(row);
    expect(top.sorted()).toEqual([...rows].sort(compare).slice(0, 41));
  });
});
