"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { savedSearchArea, type SavedSearchArea } from "@/lib/search-area";
import type { MapProperty } from "./search-area-map";
const Map = dynamic(() => import("./search-area-map").then(module => module.SearchAreaMap), { ssr: false, loading: () => <p role="status">Loading saved area…</p> });
export function SavedSearchAreaView({ request, properties, exact = false }: { request: SavedSearchArea; properties?: MapProperty[]; exact?: boolean }) {
  const [open, setOpen] = useState(false);
  const area = savedSearchArea(request);
  if (!area) return <p className="muted small-copy">Area described in words; no search perimeter selected.</p>;
  return <details className="perimeter-search" onToggle={event => setOpen(event.currentTarget.open)}><summary>Saved search area · {area.radiusKm} km radius</summary><p className="small-copy">Centre: {area.lat.toFixed(5)}, {area.lng.toFixed(5)}{exact ? " · Property pins are exact and private to admins." : " · Visible only to you and the admin team."}</p>{open && <Map value={area} properties={properties} exact={exact} />}</details>;
}
