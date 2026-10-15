'use client';

import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import { useEffect, useState, type ReactNode } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Leaflet's default marker icon breaks under Next.js's bundler unless
// you re-point it manually — this is a well-known Leaflet+webpack quirk,
// not something specific to your app.
const markerIcon = L.icon({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowSize: [41, 41],
});

export type LatLng = { lat: number; lng: number };

function FollowCentre({ value }: { value: LatLng | null }) {
  const map = useMap();
  const lat = value?.lat, lng = value?.lng;
  useEffect(() => { if (lat != null && lng != null) map.panTo([lat, lng]); }, [lat, lng, map]);
  return null;
}

function ClickHandler({ onPick, disabled }: { onPick: (pos: LatLng) => void; disabled: boolean }) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      const pos = e.latlng.wrap();
      onPick({ lat: pos.lat, lng: pos.lng });
    },
  });
  return null;
}

export function LocationPicker({
  value,
  onChange,
  disabled = false,
  children,
}: {
  value: LatLng | null;
  onChange: (pos: LatLng) => void;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [tileError, setTileError] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);
  const defaultCenter: LatLng = { lat: 6.9271, lng: 79.8612 };

  return (
    <>
    {tileError && <p role="alert">Map tiles could not load. Your answers are saved; you can continue with a typed area. <button type="button" onClick={() => { setTileError(false); setTileAttempt(n => n + 1); }}>Retry map</button></p>}
    <MapContainer
      center={value ?? defaultCenter}
      zoom={13}
      style={{ height: '300px', width: '100%', zIndex: 0 }}
    >
      <TileLayer
        key={tileAttempt}
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        eventHandlers={{ tileerror: () => setTileError(true) }}
      />
      <ClickHandler onPick={onChange} disabled={disabled} />
      <FollowCentre value={value} />
      {children}
      {value && (
        <Marker
          position={value}
          icon={markerIcon}
          draggable={!disabled}
          eventHandlers={{
            dragend: (e) => {
              if (disabled) return;
              const marker = e.target as L.Marker;
              const pos = marker.getLatLng().wrap();
              onChange({ lat: pos.lat, lng: pos.lng });
            },
          }}
        />
      )}
    </MapContainer>
    </>
  );
}
