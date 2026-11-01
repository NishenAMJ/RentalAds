import type { Metadata } from "next";
import { ItemListingForm } from "@/components/item-listing-form";

export const metadata: Metadata = { title: "List an item", robots: { index: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function NewItemListingPage({ params }: Props) {
  const { slug } = await params;
  return <ItemListingForm key={slug} slug={slug} />;
}
