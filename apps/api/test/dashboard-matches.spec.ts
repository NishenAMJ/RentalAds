import 'reflect-metadata';
import type { Listing, RentalRequest } from '@prisma/client';
import { MatchingService } from '../src/modules/matching/matching.service';
import { matchPercentage } from '../src/modules/matching/matching.logic';
import type { PrismaService } from '../src/common/prisma.service';

describe('area-first potential matches', () => {
  const rental = {
    id: 'request',
    status: 'OPEN',
    areaText: 'Colombo',
    propertyType: 'HOUSE',
    size: null,
    bedrooms: 2,
    parking: null,
    budgetMin: null,
    budgetMax: 100000,
    durationMonths: 12,
    furnishing: null,
    searchLatitude: null,
    searchLongitude: null,
    searchRadiusKm: null,
  } as RentalRequest;
  const base = {
    status: 'ACTIVE',
    areaText: 'Kandy',
    propertyType: 'HOUSE',
    size: 'N_A',
    bedrooms: 2,
    furnishing: 'UNFURNISHED',
    minDurationMonths: 6,
    parking: true,
    latitude: null,
    longitude: null,
  } as Listing;
  it('normalizes the 85-point scale and applies a strict threshold', () => {
    expect(matchPercentage(85)).toBe(100);
    expect(matchPercentage(42.5)).toBe(50);
    expect(matchPercentage(42)).toBeLessThan(50);
    expect(matchPercentage(43)).toBeGreaterThan(50);
  });
  it('filters before pagination, ranks all eligible pairs and keeps eligibility requirements', async () => {
    const findMany = jest.fn().mockResolvedValue([rental]);
    const listings = [
      { ...base, id: 'low', monthlyRent: 90000 },
      { ...base, id: 'above', monthlyRent: 80000 },
      { ...base, id: 'best', areaText: 'Colombo', monthlyRent: 80000 },
      { ...base, id: 'expensive', areaText: 'Colombo', monthlyRent: 100001 },
      {
        ...base,
        id: 'inactive',
        areaText: 'Colombo',
        monthlyRent: 80000,
        status: 'INACTIVE',
      },
    ];
    const service = new MatchingService({
      rentalRequest: { findMany },
      listing: { findMany: jest.fn().mockResolvedValue(listings) },
    } as unknown as PrismaService);
    const first = await service.dashboardMatches({ page: 1, limit: 1 });
    expect(first.data.map((item) => item.listingId)).toEqual(['best']);
    expect(first.hasNextPage).toBe(true);
    const second = await service.dashboardMatches({ page: 2, limit: 1 });
    expect(second.data.map((item) => item.listingId)).toEqual(['expensive']);
    expect(
      second.data[0].criteria.find((c) => c.key === 'budget')?.status,
    ).toBe('different');
    expect(second.hasNextPage).toBe(true);
    const all = await service.dashboardMatches({ page: 1, limit: 20 });
    expect(all.data.map((row) => row.listingId)).toEqual([
      'best',
      'expensive',
      'above',
      'low',
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { not: 'CLOSED' }, deletedAt: null },
        take: 50,
      }),
    );
  });
  it('labels missing-pin homes as unverified potential options', async () => {
    const service = new MatchingService({
      rentalRequest: {
        findMany: jest.fn().mockResolvedValue([
          {
            ...rental,
            searchLatitude: 6.9,
            searchLongitude: 79.8,
            searchRadiusKm: 3,
          },
        ]),
      },
      listing: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { ...base, id: 'missing', areaText: 'Colombo', monthlyRent: 80000 },
          ]),
      },
    } as unknown as PrismaService);
    expect(
      (await service.dashboardMatches({ page: 1, limit: 20 })).data[0],
    ).toMatchObject({
      areaMatched: false,
      requiresReview: true,
      criteria: expect.arrayContaining([
        expect.objectContaining({ key: 'area', status: 'unknown' }),
      ]),
    });
  });
});
