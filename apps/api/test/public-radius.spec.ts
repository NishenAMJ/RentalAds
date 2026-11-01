import 'reflect-metadata';
import { ListingsService } from '../src/modules/listings/listings.service';
import * as geo from '../src/common/geography';
import { PrismaService } from '../src/common/prisma.service';
import { UsersService } from '../src/modules/users/users.service';
import type { ConfigService } from '@nestjs/config';

describe('public radius lookup', () => {
  it('continues bounded batches and selects later, closer candidates before pagination', async () => {
    const first = Array.from({ length: 250 }, (_, index) => ({
      id: `a-${index}`,
      latitude: 6.94,
      longitude: 79.87,
    }));
    const last = { id: 'z', latitude: 6.9271, longitude: 79.8612 };
    const findMany = jest
      .fn()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce([last]);
    const service = new ListingsService(
      { listing: { findMany } } as unknown as PrismaService,
      {} as UsersService,
      { get: () => undefined } as unknown as ConfigService,
      { send: jest.fn() } as never,
    );
    const result = await service.browse({
      page: 1,
      limit: 1,
      searchLatitude: 6.9271,
      searchLongitude: 79.8612,
      searchRadiusKm: 3,
    });
    expect(result.data[0].id).toBe('z');
    expect(result.hasNextPage).toBe(true);
    expect(findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 250, cursor: { id: 'a-249' }, skip: 1 }),
    );
  });
  it('uses shared distance with approximate points and filters before pagination', async () => {
    const rows = [
      { id: 'outside', latitude: 7.9, longitude: 79.9 },
      { id: 'missing', latitude: null, longitude: null },
      { id: 'b', latitude: 6.927123, longitude: 79.861234 },
      { id: 'a', latitude: 6.927123, longitude: 79.861234 },
    ];
    const findMany = jest.fn().mockResolvedValue(rows);
    const spy = jest.spyOn(geo, 'distanceKm');
    const service = new ListingsService(
      { listing: { findMany } } as unknown as PrismaService,
      {} as UsersService,
      { get: () => undefined } as unknown as ConfigService,
      { send: jest.fn() } as never,
    );
    const query = {
      page: 1,
      limit: 1,
      searchLatitude: 6.9271,
      searchLongitude: 79.8612,
      searchRadiusKm: 3,
    };
    const result = await service.browse(query);
    expect(result.data.map((row) => row.id)).toEqual(['a']);
    expect(result.hasNextPage).toBe(true);
    expect(
      (await service.browse({ ...query, page: 2 })).data.map((row) => row.id),
    ).toEqual(['b']);
    const point = geo.approximateLocation(rows[2].latitude, rows[2].longitude)!;
    expect(spy).toHaveBeenCalledWith(
      query.searchLatitude,
      query.searchLongitude,
      point.latitude,
      point.longitude,
    );
    expect(findMany.mock.calls[0][0]).toMatchObject({
      take: 250,
      where: {
        status: 'ACTIVE',
        AND: [expect.any(Object)],
        latitude: { gte: expect.any(Number), lte: expect.any(Number) },
      },
    });
    spy.mockRestore();
  });
});
