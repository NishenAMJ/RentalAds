import type { Metadata } from "next";
import { ListingEdit } from "@/components/listing-edit";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

type Props = { params: Promise<{ id: string }> };

export default async function EditListingPage({ params }: Props) {
  const { id } = await params;
  return <ListingEdit key={id} id={id} />;
}
