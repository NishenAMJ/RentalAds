import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";

export const metadata: Metadata = { title: "List with RentalHub | RentalHub Sri Lanka" };

export default function StartListingPage() {
  return <CategoryPage mode="list" />;
}
