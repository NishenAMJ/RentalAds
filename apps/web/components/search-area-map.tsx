"use client";
import { Circle, CircleMarker, Popup, useMap } from "react-leaflet";
import { useEffect } from "react";
import L from "leaflet";
import { LocationPicker } from "./LocationPicker";
import type { SearchArea } from "@/lib/search-area";
export interface MapProperty { id: string; latitude: number; longitude: number; areaText: string; monthlyRent: number; distanceKm?: number | null }
function FitArea({ value, properties, exact }: { value: SearchArea | null; properties: MapProperty[]; exact: boolean }) {
  const map = useMap();
  const lat = value?.lat, lng = value?.lng, radius = value?.radiusKm;
  const points = exact ? JSON.stringify(properties.map(p => [p.latitude, p.longitude])) : '[]';
  useEffect(() => {
    if (lat == null || lng == null || radius == null) return;
    const bounds = L.latLng(lat, lng).toBounds(radius * 2000);
    for (const point of JSON.parse(points) as [number, number][]) bounds.extend(point);
    map.invalidateSize();
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 14 });
  }, [lat, lng, radius, points, map]);
  return null;
}
export function SearchAreaMap({ value, onChange, properties = [], exact = false }: { value: SearchArea | null; onChange?: (area: SearchArea) => void; properties?: MapProperty[]; exact?: boolean }) {
  return <LocationPicker value={value} disabled={!onChange} onChange={point => onChange?.({ ...point, radiusKm: value?.radiusKm ?? 3 })}>
    <FitArea value={value} properties={properties} exact={exact} />
    {value && <Circle center={value} radius={value.radiusKm * 1000} pathOptions={{ color: "#136f63", fillOpacity: 0.08 }} />}
    {properties.map(property => <CircleMarker key={property.id} center={[property.latitude, property.longitude]} radius={9} pathOptions={{ color: "#805e25", fillColor: "#c49a52", fillOpacity: 0.9 }}><Popup><strong>{property.areaText}</strong><br />LKR {property.monthlyRent.toLocaleString("en-LK")} / month<br />{exact ? "Exact location (admin only)" : "Approximate location"}{property.distanceKm != null && <><br />{exact ? "Distance" : "Approx. distance"}: {property.distanceKm.toFixed(2)} km</>}<br /><a href={`/property/${property.id}`} target="_blank" rel="noopener noreferrer">Property details</a></Popup></CircleMarker>)}
  </LocationPicker>;
}
