import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ItemDetail } from "@/components/item-detail";
import { categoryLabel, itemBookingsEnabled } from "@/lib/categories";
import { fetchPublicItem } from "@/lib/server-api";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (!itemBookingsEnabled()) return { title: "Item not available", robots: { index: false } };
  const { id } = await params;
  const item = await fetchPublicItem(id);
  if (!item || item.category === "PROPERTY") return { title: "Item not available", robots: { index: false } };
  const name = item.title ?? item.areaText;
  const description = `${name} for rent in ${item.areaText}. ${categoryLabel(item.category)} on RentalHub Sri Lanka: book your dates and pay securely online.`;
  return {
    title: name,
    description,
    alternates: { canonical: `/item/${item.id}` },
    openGraph: { title: name, description, type: "website", url: `/item/${item.id}`, images: item.photoUrls[0] ? [{ url: item.photoUrls[0] }] : undefined },
    twitter: { card: item.photoUrls[0] ? "summary_large_image" : "summary", title: name, description },
  };
}

export default async function ItemPage({ params }: Props) {
  if (!itemBookingsEnabled()) notFound();
  const { id } = await params;
  const item = await fetchPublicItem(id);
  if (item?.category === "PROPERTY") redirect(`/property/${id}`);
  return <ItemDetail key={id} id={id} />;
}
