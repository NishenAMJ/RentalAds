"use client";
import { CategoryGrid } from "@/components/category-grid";
import { useT } from "@/components/i18n-provider";

/** The "what do you want to rent / rent out" page; the two entry points differ only in wording and where the tiles lead. */
export function CategoryPage({ mode }: { mode: "browse" | "list" }) {
  const t = useT();
  return <section className="categories-page">
    <div className="page-heading"><div>
      <p className="eyebrow">{t("nav.categories")}</p>
      <h1>{t(mode === "browse" ? "rent.categories.title" : "rent.start.title")}</h1>
      <p className="intro">{t(mode === "browse" ? "rent.categories.intro" : "rent.start.intro")}</p>
    </div></div>
    <CategoryGrid mode={mode} />
  </section>;
}
