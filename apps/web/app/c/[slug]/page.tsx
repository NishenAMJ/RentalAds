import type { Metadata } from "next";
import { ItemBrowse } from "@/components/item-browse";
import { categoryBySlug, categoryLabel } from "@/lib/categories";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = categoryBySlug(slug);
  if (!category?.item) return { title: "Category not found", robots: { index: false } };
  const name = categoryLabel(category.id);
  return {
    title: `${name} for rent`,
    description: `Book ${name.toLowerCase()} by the day or week across Sri Lanka and pay securely online.`,
    alternates: { canonical: `/c/${slug}` },
  };
}

export default async function CategoryBrowsePage({ params }: Props) {
  const { slug } = await params;
  return <ItemBrowse key={slug} slug={slug} />;
}
