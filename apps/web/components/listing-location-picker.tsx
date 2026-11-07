"use client";

import dynamic from "next/dynamic";
import { useT } from "@/components/i18n-provider";
import type { LatLng } from "@/components/LocationPicker";

const Map = dynamic(
  () => import("@/components/LocationPicker").then(module => module.LocationPicker),
  { ssr: false, loading: () => <p role="status">…</p> },
);

export function ListingLocationPicker({
  value,
  onChange,
  disabled,
}: {
  value: LatLng | null;
  onChange: (value: LatLng | null) => void;
  disabled: boolean;
}) {
  const t = useT();
  return <div className="location-panel">
    <p className="small-copy">{t("rent.new.locationHint")}</p>
    <Map value={value} onChange={point => onChange(point)} disabled={disabled} />
    {value && <>
      <p className="small-copy">{t("rent.new.locationSelected", { lat: value.lat.toFixed(5), lng: value.lng.toFixed(5) })}</p>
      <button type="button" className="secondary" disabled={disabled} onClick={() => onChange(null)}>{t("rent.new.locationClear")}</button>
    </>}
  </div>;
}
