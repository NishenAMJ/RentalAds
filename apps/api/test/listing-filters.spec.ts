/// <reference types="jest" />
import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchListingsQuery } from '../src/common/search-area.dto';
import {
  listingFilterWhere,
  listingOrderBy,
} from '../src/modules/listings/listing-filters';

describe('listingFilterWhere', () => {
  it('adds nothing when no filters are given', () => {
    expect(listingFilterWhere({})).toEqual({});
  });

  it('maps each filter to the matching column', () => {
    expect(
      listingFilterWhere({
        area: 'nugegoda',
        propertyType: 'APARTMENT',
        furnishing: 'FURNISHED',
        minRent: 50000,
        maxRent: 120000,
        minBedrooms: 2,
        parking: true,
      }),
    ).toEqual({
      areaText: { contains: 'nugegoda', mode: 'insensitive' },
      propertyType: 'APARTMENT',
      furnishing: 'FURNISHED',
      monthlyRent: { gte: 50000, lte: 120000 },
      bedrooms: { gte: 2 },
      parking: true,
    });
  });

  it('supports open-ended rent ranges and a zero minimum', () => {
    expect(listingFilterWhere({ maxRent: 90000 })).toEqual({
      monthlyRent: { lte: 90000 },
    });
    expect(listingFilterWhere({ minBedrooms: 0 })).toEqual({
      bedrooms: { gte: 0 },
    });
  });

  it('treats parking=false as no preference rather than excluding parking', () => {
    expect(listingFilterWhere({ parking: false })).toEqual({});
  });

  it('rejects an inverted rent range', () => {
    expect(() => listingFilterWhere({ minRent: 100, maxRent: 50 })).toThrow(
      BadRequestException,
    );
  });
});

describe('listingOrderBy', () => {
  it('defaults to newest first and always ends with the id tiebreaker', () => {
    expect(listingOrderBy()).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
    for (const sort of ['newest', 'price_asc', 'price_desc'] as const)
      expect(listingOrderBy(sort).at(-1)).toEqual({ id: 'desc' });
  });

  it('sorts by rent in the requested direction', () => {
    expect(listingOrderBy('price_asc')[0]).toEqual({ monthlyRent: 'asc' });
    expect(listingOrderBy('price_desc')[0]).toEqual({ monthlyRent: 'desc' });
  });
});

describe('ListingFilterQuery validation', () => {
  const check = async (query: Record<string, string | undefined>) =>
    validate(plainToInstance(SearchListingsQuery, query));

  it('accepts query-string values and converts their types', async () => {
    const query = plainToInstance(SearchListingsQuery, {
      area: '  Nugegoda ',
      minRent: '50000',
      parking: 'true',
      sort: 'price_asc',
    });
    expect(await validate(query)).toHaveLength(0);
    expect(query).toMatchObject({
      area: 'Nugegoda',
      minRent: 50000,
      parking: true,
      sort: 'price_asc',
    });
  });

  it.each([
    { sort: 'random' },
    { propertyType: 'CASTLE' },
    { minRent: '-1' },
    { maxRent: 'cheap' },
    { minBedrooms: '1.5' },
    { parking: 'maybe' },
    { area: 'x'.repeat(101) },
  ])('rejects %j', async (query) => {
    expect((await check(query)).length).toBeGreaterThan(0);
  });
});
