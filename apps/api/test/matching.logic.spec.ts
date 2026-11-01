/// <reference types="jest" />
import type { RentalRequest } from '@prisma/client';
import type { PropertyListing } from '../src/modules/matching/property-listing';
import {
  passesHardFilters,
  scoreMatch,
} from '../src/modules/matching/matching.logic';

const baseListing: PropertyListing = {
  reference: 'SL-000001',
  id: 'listing-1',
  ownerId: 'owner-1',
  size: 'TWO_BR',
  mapLink: null,
  latitude: null,
  longitude: null,
  keyMoney: false,
  keyMoneyAmount: null,
  ownerContact: '+94712345678',
  photoUrls: [],
  lastAvailabilityConfirmedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  status: 'ACTIVE',
  propertyType: 'APARTMENT',
  monthlyRent: 90000,
  ratePeriod: 'MONTH' as const,
  category: 'PROPERTY' as const,
  attributes: null,
  title: null,
  description: null,
  depositAmount: null,
  bedrooms: 2,
  bathrooms: 1,
  furnishing: 'UNFURNISHED',
  parking: false,
  areaText: 'Colombo 5',
  minDurationMonths: 12,
  deletedAt: null,
  deletedByAdminId: null,
  deletionReason: null,
  reminderSentAt: null,
};

const baseRequest: RentalRequest = {
  searchLatitude: null,
  searchLongitude: null,
  searchRadiusKm: null,
  id: 'request-1',
  renterId: 'renter-1',
  size: null,
  renterContact: '+94712345678',
  status: 'OPEN',
  createdAt: new Date('2026-01-01'),
  propertyType: 'APARTMENT',
  budgetMax: 100000,
  budgetMin: 70000,
  bedrooms: 2,
  furnishing: null,
  parking: null,
  areaText: 'Colombo 5, Colombo 7',
  durationMonths: 12,
  deletedAt: null,
  deletedByAdminId: null,
  deletionReason: null,
  assignedAdminId: null,
  assignedAt: null,
  adminNotes: null,
  followUpAt: null,
};

describe('passesHardFilters', () => {
  it('enforces required parking but allows either listing when parking is optional', () => {
    expect(
      passesHardFilters(baseListing, { ...baseRequest, parking: true }),
    ).toBe(false);
    expect(
      passesHardFilters(
        { ...baseListing, parking: true },
        { ...baseRequest, parking: true },
      ),
    ).toBe(true);
    for (const parking of [null, false]) {
      expect(passesHardFilters(baseListing, { ...baseRequest, parking })).toBe(
        true,
      );
      expect(
        passesHardFilters(
          { ...baseListing, parking: true },
          { ...baseRequest, parking },
        ),
      ).toBe(true);
    }
  });
  it('rejects stays shorter than the listing minimum and accepts the boundary', () => {
    expect(
      passesHardFilters(baseListing, { ...baseRequest, durationMonths: 11 }),
    ).toBe(false);
    expect(
      passesHardFilters(baseListing, { ...baseRequest, durationMonths: 12 }),
    ).toBe(true);
  });
  it('requires the selected size and permits any size when omitted', () => {
    expect(
      passesHardFilters(baseListing, { ...baseRequest, size: 'STUDIO' }),
    ).toBe(false);
    expect(
      passesHardFilters(baseListing, { ...baseRequest, size: 'TWO_BR' }),
    ).toBe(true);
    expect(passesHardFilters(baseListing, baseRequest)).toBe(true);
  });
  it('excludes a listing over budget', () => {
    const request = { ...baseRequest, budgetMax: 50000 };
    expect(passesHardFilters(baseListing, request)).toBe(false);
  });

  it('excludes a listing with fewer bedrooms than required', () => {
    const listing: PropertyListing = { ...baseListing, bedrooms: 1 };
    expect(passesHardFilters(listing, baseRequest)).toBe(false);
  });

  it('excludes an inactive listing', () => {
    const listing: PropertyListing = { ...baseListing, status: 'INACTIVE' };
    expect(passesHardFilters(listing, baseRequest)).toBe(false);
  });

  it('passes a listing that satisfies all hard requirements', () => {
    expect(passesHardFilters(baseListing, baseRequest)).toBe(true);
  });
});

describe('scoreMatch', () => {
  it('does not add preference points for parking or duration', () => {
    expect(scoreMatch(baseListing, baseRequest)).toBe(
      scoreMatch(
        { ...baseListing, parking: true, minDurationMonths: 1 },
        baseRequest,
      ),
    );
  });
  it('scores an exact match higher than a partial one', () => {
    const exactScore = scoreMatch(baseListing, baseRequest);
    const partialListing: PropertyListing = {
      ...baseListing,
      bedrooms: 3,
      furnishing: 'FURNISHED',
    };
    const partialScore = scoreMatch(partialListing, {
      ...baseRequest,
      furnishing: 'UNFURNISHED',
    });
    expect(exactScore).toBeGreaterThan(partialScore);
  });

  it('gives no location credit when areas do not overlap', () => {
    const request = { ...baseRequest, areaText: 'Kandy' };
    const score = scoreMatch(baseListing, request);
    const sameAreaScore = scoreMatch(baseListing, baseRequest);
    expect(score).toBeLessThan(sameAreaScore);
  });
});
