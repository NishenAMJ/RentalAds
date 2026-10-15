import type { Prisma } from '@prisma/client';

export const GRID_DEGREES = 0.0036;
const EARTH_KM = 6371.0088;
const radians = (degrees: number) => (degrees * Math.PI) / 180;
export interface SearchArea {
  searchLatitude?: number | null;
  searchLongitude?: number | null;
  searchRadiusKm?: number | null;
}
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const a =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(radians(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
export function approximateLocation(latitude: unknown, longitude: unknown) {
  if (latitude == null || longitude == null) return null;
  const lat = Number(latitude),
    lng = Number(longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  const snap = (value: number, max: number) =>
    Number(
      Math.max(
        -max,
        Math.min(max, Math.round(value / GRID_DEGREES) * GRID_DEGREES),
      ).toFixed(6),
    );
  return { latitude: snap(lat, 90), longitude: snap(lng, 180) };
}
export function boundingBox(
  latitude: number,
  longitude: number,
  radiusKm: number,
  publicGrid = false,
): Prisma.ListingWhereInput {
  const delta = radiusKm / EARTH_KM;
  const latDelta = (delta * 180) / Math.PI;
  const crossesPole = Math.abs(latitude) + latDelta >= 90;
  const lngDelta = crossesPole
    ? 180
    : (Math.asin(Math.min(1, Math.sin(delta) / Math.cos(radians(latitude)))) *
        180) /
      Math.PI;
  // A snapped point can be half a cell away from its stored coordinate.
  // Expand to full intersecting cells, including their outer boundaries.
  const low = (n: number) =>
    publicGrid ? (Math.floor(n / GRID_DEGREES) - 0.5) * GRID_DEGREES : n;
  const high = (n: number) =>
    publicGrid ? (Math.ceil(n / GRID_DEGREES) + 0.5) * GRID_DEGREES : n;
  const minLng = low(longitude - lngDelta),
    maxLng = high(longitude + lngDelta);
  const latitudeFilter = {
    gte: Math.max(-90, low(latitude - latDelta)),
    lte: Math.min(90, high(latitude + latDelta)),
  };
  if (crossesPole || maxLng - minLng >= 360)
    return { latitude: latitudeFilter, longitude: { not: null } };
  if (minLng < -180)
    return {
      latitude: latitudeFilter,
      OR: [
        { longitude: { gte: minLng + 360 } },
        { longitude: { lte: maxLng } },
      ],
    };
  if (maxLng > 180)
    return {
      latitude: latitudeFilter,
      OR: [
        { longitude: { gte: minLng } },
        { longitude: { lte: maxLng - 360 } },
      ],
    };
  return { latitude: latitudeFilter, longitude: { gte: minLng, lte: maxLng } };
}
