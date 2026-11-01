"use client";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { CATEGORIES, categoryBlurbKey, categoryNameKey } from "@/lib/categories";

/** One tile per category. Renters browse from it; owners start a listing from it. */
export function CategoryGrid({ mode }: { mode: "browse" | "list" }) {
  const t = useT();
  return <ul className="category-grid">{CATEGORIES.map((category) =>
    <li key={category.id}>
      <Link className="category-tile" href={mode === "browse" ? category.browseHref : category.listHref}>
        <h3>{t(categoryNameKey(category.id))}</h3>
        <p>{t(categoryBlurbKey(category.id))}</p>
        <span className="category-cta">{t(mode === "browse" ? "rent.tile.browse" : "rent.tile.list")}</span>
      </Link>
    </li>)}
  </ul>;
}
