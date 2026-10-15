export interface SearchArea { lat: number; lng: number; radiusKm: number }
export interface SavedSearchArea { searchLatitude?: number | null; searchLongitude?: number | null; searchRadiusKm?: number | null }
export function savedSearchArea(value: SavedSearchArea): SearchArea | null {
  return value.searchLatitude != null && value.searchLongitude != null && value.searchRadiusKm != null
    ? { lat: value.searchLatitude, lng: value.searchLongitude, radiusKm: value.searchRadiusKm } : null;
}
