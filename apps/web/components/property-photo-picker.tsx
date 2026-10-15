"use client";

import { PropertyImage } from "@/components/property-image";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { apiRequest } from "@/lib/api-client";
import type { PhotoUploadState } from "@/lib/listing-form";

interface Photo { id: string; name: string; status: "uploading" | "uploaded" | "failed"; url?: string }

export function PropertyPhotoPicker({ onChange, disabled }: { onChange: (state: PhotoUploadState) => void; disabled: boolean }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [error, setError] = useState("");
  const entries = useRef<Photo[]>([]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  function publish(next: Photo[]) {
    entries.current = next;
    setPhotos(next);
    onChange({ urls: next.flatMap((photo) => photo.url ? [photo.url] : []), uploading: next.some((photo) => photo.status === "uploading"), failed: next.some((photo) => photo.status === "failed") });
  }

  async function select(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (!files.length || controller.current) return;
    if (entries.current.length + files.length > 10) { setError("Select no more than 10 photos in total."); return; }
    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(`${file.name}: choose a JPG, PNG or WebP image.`); return; }
      if (file.size > 8 * 1024 * 1024 || file.size === 0) { setError(`${file.name}: choose a non-empty photo of 8 MB or less.`); return; }
    }
    setError("");
    const batch = files.map((file) => ({ id: crypto.randomUUID(), name: file.name, status: "uploading" as const }));
    const pending = new AbortController();
    controller.current = pending;
    publish([...entries.current, ...batch]);
    try {
      const body = new FormData();
      files.forEach((file) => body.append("photos", file));
      const result = await apiRequest<{ images: { url: string }[] }>("/uploads/property-images", { method: "POST", authenticated: true, body, signal: pending.signal });
      if (result.images.length !== batch.length || result.images.some((image) => !image.url.startsWith("https://"))) throw new Error("The upload did not return all photos. Remove the failed photos and try again.");
      if (pending.signal.aborted) return;
      publish(entries.current.map((photo) => {
        const index = batch.findIndex((item) => item.id === photo.id);
        return index === -1 ? photo : { ...photo, status: "uploaded", url: result.images[index].url };
      }));
    } catch (cause) {
      if (pending.signal.aborted) return;
      setError(cause instanceof Error ? cause.message : "Photo upload failed. Please try again.");
      publish(entries.current.map((photo) => batch.some((item) => item.id === photo.id) ? { ...photo, status: "failed" } : photo));
    } finally { if (controller.current === pending) controller.current = null; }
  }

  const uploading = photos.some((photo) => photo.status === "uploading");
  return <div className="full-width">
    <label htmlFor="photos">Property photos (optional)</label>
    <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled || uploading} onChange={(event) => void select(event)} aria-describedby="photo-help" />
    <small id="photo-help">Photos upload as soon as you select them. Up to 10 JPG, PNG or WebP photos, 8 MB each. Keep contact details out of photos.</small>
    {error && <p className="notice error" role="alert">{error}</p>}
    <p role="status">{uploading ? "Uploading photos…" : `${photos.filter((photo) => photo.status === "uploaded").length} of 10 photos uploaded`}</p>
    <ul className="photo-previews">{photos.map((photo) => <li key={photo.id}>
      {photo.status === "uploaded" && photo.url ? <PropertyImage src={photo.url} alt={photo.name} width={240} height={160} sizes="160px" /> : <div className="photo-placeholder">{photo.status === "failed" ? "Upload failed" : "Uploading…"}</div>}
      <p>{photo.name}</p><button type="button" className="text-button" disabled={disabled || photo.status === "uploading"} aria-label={`Remove ${photo.name}`} onClick={() => { publish(entries.current.filter((item) => item.id !== photo.id)); setError(""); }}>Remove</button>
    </li>)}</ul>
  </div>;
}
