import { cache } from "react";
import type { PublicListing } from "./listings";
import type { ItemListing } from "./items";

/** Server-side API base. Never use the browser client helpers here. */
const apiBase = () => (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");
const REVALIDATE_SECONDS = 300;

interface Page<T> { data: T[]; hasNextPage: boolean }

/** One public listing, or null when it is missing or the API is unreachable. De-duplicated per request. */
export const fetchPublicListing = cache(async (id: string): Promise<PublicListing | null> => {
  try {
    const response = await fetch(`${apiBase()}/listings/${encodeURIComponent(id)}`, { next: { revalidate: REVALIDATE_SECONDS } });
    return response.ok ? ((await response.json()) as PublicListing) : null;
  } catch {
    return null;
  }
});

/** One public item listing (vehicle, equipment, event gear), or null. Category is not checked here. */
export const fetchPublicItem = cache(async (id: string): Promise<ItemListing | null> => {
  try {
    const response = await fetch(`${apiBase()}/listings/${encodeURIComponent(id)}`, { next: { revalidate: REVALIDATE_SECONDS } });
    return response.ok ? ((await response.json()) as ItemListing) : null;
  } catch {
    return null;
  }
});

/** Ids and update times of active listings, for the sitemap. Stops after `maxPages` pages. */
export async function fetchListingIndex(maxPages = 25, category?: string): Promise<{ id: string; createdAt: string }[]> {
  const index: { id: string; createdAt: string }[] = [];
  try {
    for (let page = 1; page <= maxPages; page++) {
      const response = await fetch(`${apiBase()}/listings?page=${page}&limit=100${category ? `&category=${category}` : ""}`, { next: { revalidate: REVALIDATE_SECONDS } });
      if (!response.ok) break;
      const body = (await response.json()) as Page<PublicListing>;
      index.push(...body.data.map((listing) => ({ id: listing.id, createdAt: listing.createdAt })));
      if (!body.hasNextPage) break;
    }
  } catch {
    // A partial or empty sitemap is better than failing the whole request.
  }
  return index;
}
