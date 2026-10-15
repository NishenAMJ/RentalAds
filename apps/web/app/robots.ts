import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// Private, signed-in areas should never appear in search results.
const PRIVATE_PATHS = ["/admin", "/owner", "/renter", "/account", "/notifications", "/login", "/reset-password"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE_PATHS }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
