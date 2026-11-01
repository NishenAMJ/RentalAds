import type { MetadataRoute } from "next";
import { fetchListingIndex } from "@/lib/server-api";
import { siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const pages = ["", "/listings", "/categories", "/c/vehicles", "/c/equipment", "/c/event-gear", "/privacy", "/terms", "/cookies"].map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path === "/listings" ? ("daily" as const) : ("monthly" as const),
    priority: path === "" ? 1 : path === "/listings" ? 0.9 : 0.3,
  }));
  const items = (await Promise.all(["VEHICLE", "EQUIPMENT", "EVENT_GEAR"].map((category) => fetchListingIndex(10, category)))).flat().map((listing) => ({
    url: `${origin}/item/${listing.id}`,
    lastModified: new Date(listing.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const listings = (await fetchListingIndex()).map((listing) => ({
    url: `${origin}/property/${listing.id}`,
    lastModified: new Date(listing.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [...pages, ...listings, ...items];
}
