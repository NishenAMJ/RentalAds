"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { apiRequest, ApiError } from "@/lib/api-client";
import type { PublicListing } from "@/lib/listings";
import type { Page } from "@/lib/use-paginated";
import type { SearchArea } from "@/lib/search-area";
const Map = dynamic(() => import("./search-area-map").then(module => module.SearchAreaMap), { ssr: false, loading: () => <p role="status">Loading map…</p> });

export function SearchAreaPicker({ value, onChange }: { value: SearchArea | null; onChange: (area: SearchArea | null) => void }) {
  const id = useId();
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; page: Page<PublicListing> } | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const lat = value?.lat, lng = value?.lng, radius = value?.radiusKm;
  const key = `${lat}:${lng}:${radius}:${page}:${attempt}`;
  useEffect(() => {
    if (lat == null || lng == null || radius == null) return;
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ searchLatitude: String(lat), searchLongitude: String(lng), searchRadiusKm: String(radius), page: String(page), limit: "6" });
      apiRequest<Page<PublicListing>>(`/listings?${params}`, { signal: controller.signal }).then(data => { if (active) setResult({ key, page: data }); }).catch(cause => {
        if (active) setError({ key, message: cause instanceof ApiError && cause.status === 429 ? "You’ve adjusted the search several times. Please wait a minute, then retry." : cause instanceof Error ? cause.message : "Unable to load nearby homes." });
      });
    }, 650);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [lat, lng, radius, page, attempt, key]);
  function change(area: SearchArea | null) { setPage(1); onChange(area); }
  const current = result?.key === key ? result.page : null;
  const message = error?.key === key ? error.message : null;
  const properties = (current?.data ?? []).flatMap(row => row.approximateLocation ? [{ id: row.id, ...row.approximateLocation, areaText: row.areaText, monthlyRent: row.monthlyRent, distanceKm: row.approximateDistanceKm }] : []);
  return <section className="perimeter-search" aria-label="Optional search perimeter">
    <h3>Add a search perimeter (optional)</h3><p className="muted small-copy">Select a centre on the map or choose a major hub. Our introduction service operates islandwide across Sri Lanka. Your written areas are still required. Property pins and distances are approximate.</p>
    <div className="row"><button type="button" className="secondary" onClick={() => change({ lat: 6.9271, lng: 79.8612, radiusKm: 3 })}>Start from Colombo</button><button type="button" className="secondary" onClick={() => change({ lat: 7.2906, lng: 80.6337, radiusKm: 4 })}>Kandy</button><button type="button" className="secondary" onClick={() => change({ lat: 6.0535, lng: 80.2210, radiusKm: 4 })}>Galle</button><button type="button" className="secondary" onClick={() => change({ lat: 7.0840, lng: 80.0098, radiusKm: 4 })}>Gampaha</button>{value && <button type="button" className="text-button" onClick={() => change(null)}>Clear search area</button>}</div>
    {value && <><label htmlFor={`${id}-radius`}>Search radius: <strong>{value.radiusKm} km</strong></label><input id={`${id}-radius`} type="range" min={1} max={10} step={0.5} value={value.radiusKm} onChange={event => change({ ...value, radiusKm: Number(event.target.value) })} aria-valuetext={`${value.radiusKm} kilometres`} /><details><summary>Adjust centre using coordinates</summary><div className="field-grid">{(["lat", "lng"] as const).map(axis => <label key={axis}>{axis === "lat" ? "Latitude" : "Longitude"}<input type="number" step="0.0001" min={axis === "lat" ? -90 : -180} max={axis === "lat" ? 90 : 180} value={value[axis]} onChange={event => { const n = event.target.valueAsNumber; if (Number.isFinite(n) && Math.abs(n) <= (axis === "lat" ? 90 : 180)) change({ ...value, [axis]: n }); }} /></label>)}</div></details></>}
    <Map value={value} onChange={change} properties={properties} />
    {value && <><h3>Homes near your selected area</h3><p className="muted small-copy">A preview of nearby homes, not confirmed matches. Budget and home preferences from later steps are not applied here.</p>
      {!current && !message && <p role="status">Looking for nearby homes…</p>}
      {message && <p role="alert">{message} <button type="button" onClick={() => setAttempt(n => n + 1)}>Retry results</button></p>}
      {current && !current.data.length && <p role="status">No homes with a mapped location on this page. Try a wider area, or submit your private request for our team to review.</p>}
      <div className="perimeter-results">{current?.data.map(row => <article key={row.id} className="panel"><Link href={`/property/${row.id}`} target="_blank" rel="noopener noreferrer">{row.areaText}</Link><p>LKR {row.monthlyRent.toLocaleString("en-LK")} / month</p><small>Approx. {row.approximateDistanceKm?.toFixed(2)} km from your centre</small></article>)}</div>
      {current && <div className="row"><button type="button" className="secondary" disabled={page === 1} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page}</span><button type="button" className="secondary" disabled={!current.hasNextPage} onClick={() => setPage(n => n + 1)}>Next</button></div>}
    </>}
  </section>;
}
