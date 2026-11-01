import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { fetchPublicListing } from "@/lib/server-api";
import { listingDescription, listingJsonLd, listingTitle, serializeJsonLd, siteUrl } from "@/lib/seo";
import { PropertyDetail } from "./property-detail";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await fetchPublicListing(id);
  if (!listing) return { title: "Property not available", robots: { index: false } };
  const title = listingTitle(listing);
  const description = listingDescription(listing);
  return {
    title,
    description,
    alternates: { canonical: `/property/${listing.id}` },
    openGraph: { title, description, type: "website", url: `/property/${listing.id}`, images: listing.photoUrls[0] ? [{ url: listing.photoUrls[0] }] : undefined },
    twitter: { card: listing.photoUrls[0] ? "summary_large_image" : "summary", title, description },
  };
}

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  const listing = await fetchPublicListing(id);
  if (listing?.category && listing.category !== "PROPERTY") redirect(`/item/${id}`);
  return <>
    {listing && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(listingJsonLd(listing, siteUrl())) }} />}
    <PropertyDetail key={id} id={id} />
  </>;
}
