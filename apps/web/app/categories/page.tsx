import type { Metadata } from "next";
import { CategoryPage } from "@/components/category-page";

export const metadata: Metadata = {
  title: "Browse by category | RentalHub Sri Lanka",
  description: "Rent homes, vehicles, tools and equipment, and event gear across Sri Lanka.",
  alternates: { canonical: "/categories" },
};

export default function CategoriesPage() {
  return <CategoryPage mode="browse" />;
}
