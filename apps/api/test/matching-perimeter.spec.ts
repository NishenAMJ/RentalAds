import 'reflect-metadata';
import { Prisma, Listing, RentalRequest } from '@prisma/client';
import { MatchingService } from '../src/modules/matching/matching.service';
import { PrismaService } from '../src/common/prisma.service';
import * as geography from '../src/common/geography';
import {
  locationFit,
  scoreMatch,
} from '../src/modules/matching/matching.logic';

describe('exact admin matching and attributable location overrides', () => {
  let listing: Listing;
  let rental: RentalRequest;
  let service: MatchingService;
  let saved: Record<string, unknown>;
  const upsert = jest.fn(({ create, update }) => {
    saved = saved ? { ...saved, ...update } : { id: 'match', ...create };
    return Promise.resolve(saved);
  });
  const update = jest.fn(({ data }) => {
    saved = { ...saved, ...data };
    return Promise.resolve(saved);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    saved = undefined!;
    listing = {
      id: 'home',
      status: 'ACTIVE',
      latitude: new Prisma.Decimal(6.927123),
      longitude: new Prisma.Decimal(79.861234),
      propertyType: 'HOUSE',
      size: 'N_A',
      monthlyRent: 80000,
      minDurationMonths: 6,
      bedrooms: 2,
      parking: true,
      areaText: 'Different text',
      furnishing: 'UNFURNISHED',
      photoUrls: [],
    } as unknown as Listing;
    rental = {
      id: 'brief',
      status: 'OPEN',
      searchLatitude: 6.9271,
      searchLongitude: 79.8612,
      searchRadiusKm: 3,
      areaText: 'Colombo',
      propertyType: 'HOUSE',
      size: null,
      bedrooms: 2,
      parking: true,
      budgetMax: 100000,
      budgetMin: null,
      durationMonths: 12,
      furnishing: null,
    } as unknown as RentalRequest;
    service = new MatchingService({
      rentalRequest: { findUnique: jest.fn(async () => rental) },
      listing: {
        findUnique: jest.fn(async () => listing),
        findMany: jest.fn(async () => [listing]),
      },
      match: {
        findMany: jest.fn(async () => []),
        findUnique: jest.fn(async () => saved),
        upsert,
        update,
      },
      user: {
        findUnique: jest.fn(async () => ({
          id: 'verified-admin',
          adminPermission: { canApproveListings: true },
        })),
      },
    } as unknown as PrismaService);
  });
  it('calls the same shared distance function using exact coordinates and awards 30 location points', async () => {
    const spy = jest.spyOn(geography, 'distanceKm');
    const result = await service.findSuggestionsForRequest('brief', {
      page: 1,
      limit: 20,
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].latitude).toBe(6.927123);
    expect(spy).toHaveBeenCalledWith(6.9271, 79.8612, 6.927123, 79.861234);
    const exactScore = scoreMatch(listing, rental);
    expect(
      exactScore -
        scoreMatch(listing, {
          ...rental,
          searchLatitude: null,
          searchLongitude: null,
          searchRadiusKm: null,
        }),
    ).toBe(30);
    spy.mockRestore();
  });
  it('shows outside and missing-pin homes as reviewable potential options', async () => {
    for (const latitude of [new Prisma.Decimal(7.5), null]) {
      listing.latitude = latitude;
      expect(
        (
          await service.findSuggestionsForRequest('brief', {
            page: 1,
            limit: 20,
          })
        ).data[0],
      ).toMatchObject({ areaMatched: false, requiresReview: true });
      await expect(service.saveSuggestion('brief', 'home')).rejects.toThrow(
        'reason',
      );
      await expect(
        service.saveSuggestion('brief', 'home', '   ', 'admin'),
      ).rejects.toThrow('reason');
    }
  });
  it('records verified actor, trimmed reason and time; ordinary updates preserve audit metadata', async () => {
    listing.latitude = null;
    const result = await service.saveSuggestion(
      'brief',
      'home',
      ' Renter agreed to this neighbourhood ',
      'auth-admin',
    );
    expect(result).toMatchObject({
      locationOverrideReason: 'Renter agreed to this neighbourhood',
      locationOverrideAdminId: 'verified-admin',
      locationOverrideAt: expect.any(Date),
    });
    await service.updateStatus('match', 'SENT');
    expect(saved.locationOverrideAdminId).toBe('verified-admin');
    listing.latitude = new Prisma.Decimal(6.927123);
    await service.saveSuggestion('brief', 'home');
    expect(saved.locationOverrideReason).toBe(
      'Renter agreed to this neighbourhood',
    );
    expect(upsert.mock.calls.at(-1)![0].update).toEqual({
      score: expect.any(Number),
    });
  });
  it('rejects overrides without verified actors or for in-area properties', async () => {
    await expect(
      service.saveSuggestion('brief', 'home', 'reason', 'admin'),
    ).rejects.toThrow('only');
    listing.latitude = null;
    await expect(
      service.saveSuggestion('brief', 'home', 'reason'),
    ).rejects.toThrow('administrator');
  });
  it.each([
    { monthlyRent: 100001 },
    { propertyType: 'APARTMENT' },
    { bedrooms: 1 },
    { parking: false },
    { minDurationMonths: 13 },
  ])(
    'requires a general review reason for preference difference %s',
    async (violation) => {
      Object.assign(listing, violation, { latitude: null });
      await expect(
        service.saveSuggestion('brief', 'home', 'reason', 'admin'),
      ).rejects.toThrow('recommendation reason');
      expect(upsert).not.toHaveBeenCalled();
      const result = await service.saveSuggestion(
        'brief',
        'home',
        undefined,
        'admin',
        'Renter is willing to consider these differences',
      );
      expect(result).toMatchObject({
        recommendationReason: 'Renter is willing to consider these differences',
        recommendedByAdminId: 'verified-admin',
        recommendationReviewedAt: expect.any(Date),
      });
    },
  );
  it('requires review for size differences and blocks closed requests', async () => {
    rental.size = 'TWO_BR';
    listing.latitude = null;
    await expect(
      service.saveSuggestion('brief', 'home', 'reason', 'admin'),
    ).rejects.toThrow('recommendation reason');
    rental.size = null;
    rental.status = 'CLOSED';
    saved = { id: 'match', requestId: 'brief' };
    await expect(
      service.saveSuggestion('brief', 'home', 'reason', 'admin'),
    ).rejects.toThrow('closed');
    await expect(service.updateStatus('match', 'SENT')).rejects.toThrow(
      'closed',
    );
  });
  it('never recommends inactive properties', async () => {
    listing.status = 'INACTIVE';
    await expect(
      service.saveSuggestion('brief', 'home', undefined, 'admin', 'reason'),
    ).rejects.toThrow('active');
  });
  it('includes the exact radius boundary and preserves text-only compatibility', () => {
    rental.searchRadiusKm = geography.distanceKm(
      rental.searchLatitude!,
      rental.searchLongitude!,
      Number(listing.latitude),
      Number(listing.longitude),
    );
    expect(locationFit(listing, rental).withinArea).toBe(true);
    rental.searchRadiusKm -= 0.000001;
    expect(locationFit(listing, rental).withinArea).toBe(false);
    rental.searchLatitude =
      rental.searchLongitude =
      rental.searchRadiusKm =
        null;
    listing.latitude = null;
    expect(locationFit(listing, rental).withinArea).toBe(true);
  });
});
