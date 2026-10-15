import type { MetadataRoute } from "next";
import { fetchListingIndex } from "@/lib/server-api";
import { siteUrl } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = siteUrl();
  const pages = ["", "/listings", "/privacy", "/terms", "/cookies"].map((path) => ({
    url: `${origin}${path}`,
    changeFrequency: path === "/listings" ? ("daily" as const) : ("monthly" as const),
    priority: path === "" ? 1 : path === "/listings" ? 0.9 : 0.3,
  }));
  const listings = (await fetchListingIndex()).map((listing) => ({
    url: `${origin}/property/${listing.id}`,
    lastModified: new Date(listing.createdAt),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  return [...pages, ...listings];
}
