import {
  approximateLocation,
  boundingBox,
  distanceKm,
} from '../src/common/geography';
import { toPublicListing } from '../src/modules/listings/public-listing';
import type { Listing } from '@prisma/client';

describe('location privacy boundary', () => {
  it('uses stable grid coordinates and suppresses precise fields and URLs', () => {
    const listing = {
      latitude: 6.927123,
      longitude: 79.861234,
      mapLink: 'https://maps.google.com/?q=6.927123,79.861234',
      ownerContact: 'private',
    } as unknown as Listing;
    const result = toPublicListing(listing);
    expect(result).toEqual(toPublicListing(listing));
    expect(result).not.toHaveProperty('latitude');
    expect(result).not.toHaveProperty('longitude');
    expect(result).not.toHaveProperty('ownerContact');
    expect(JSON.stringify(result)).not.toContain('6.927123');
    expect(result.mapLink).toContain(
      String(result.approximateLocation!.latitude),
    );
    expect(toPublicListing({ ...listing, latitude: null }).mapLink).toBeNull();
  });
  it('handles distances, missing coordinates and conservative grid bounds', () => {
    expect(distanceKm(0, 0, 0, 0)).toBe(0);
    expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.195, 2);
    expect(distanceKm(0, 179.99, 0, -179.99)).toBeLessThan(3);
    expect(approximateLocation(null, 80)).toBeNull();
    expect(approximateLocation(NaN, 80)).toBeNull();
    const bounds = boundingBox(6.9271, 79.8612, 3, true);
    const lat = bounds.latitude as { gte: number; lte: number };
    for (let offset = -0.04; offset <= 0.04; offset += 0.0001) {
      const raw = 6.9271 + offset;
      const snapped = approximateLocation(raw, 79.8612)!;
      if (
        distanceKm(6.9271, 79.8612, snapped.latitude, snapped.longitude) <= 3
      ) {
        expect(raw).toBeGreaterThanOrEqual(lat.gte);
        expect(raw).toBeLessThanOrEqual(lat.lte);
      }
    }
  });
});
