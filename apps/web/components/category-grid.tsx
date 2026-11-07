"use client";
import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { CATEGORIES, categoryBlurbKey, categoryNameKey } from "@/lib/categories";
import { useCategoryDefinitions, useCategoryDefinitionsError } from "@/lib/use-categories";

/** One tile per category. Renters browse from it; owners start a listing from it. */
export function CategoryGrid({ mode }: { mode: "browse" | "list" }) {
  const t = useT();
  const definitions = useCategoryDefinitions();
  const failed = useCategoryDefinitionsError();
  if (definitions === null) return <p className="notice" role="status">Loading available rental categories…</p>;
  if (failed) return <p className="notice error" role="alert">Rental categories could not be loaded. Please refresh and try again.</p>;
  const visibleCategories = CATEGORIES.filter((category) => definitions.some((definition) => definition.id === category.id));
  if (!visibleCategories.length) return <p className="notice">No rental categories are currently available.</p>;
  return <ul className="category-grid">{visibleCategories.map((category) =>
    <li key={category.id}>
      <Link className="category-tile" href={mode === "browse" ? category.browseHref : category.listHref}>
        <h3>{t(categoryNameKey(category.id))}</h3>
        <p>{t(categoryBlurbKey(category.id))}</p>
        <span className="category-cta">{t(mode === "browse" ? "rent.tile.browse" : "rent.tile.list")}</span>
      </Link>
    </li>)}
  </ul>;
}
