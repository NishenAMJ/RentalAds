"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ItemCard } from "@/components/item-card";
import { Pagination } from "@/components/pagination";
import { SkeletonCards } from "@/components/ui/primitives";
import { useT } from "@/components/i18n-provider";
import { categoryBySlug, categoryBlurbKey, categoryNameKey } from "@/lib/categories";
import { labelFor, type ItemListing } from "@/lib/items";
import { usePaginated } from "@/lib/use-paginated";
import { useCategoryDefinitions } from "@/lib/use-categories";

function ItemList({ query }: { query: string }) {
  const t = useT();
  const pager = usePaginated<ItemListing>("/listings", false, query);
  return <>
    {pager.error && <p role="alert" className="notice error">{pager.error} <button onClick={pager.retry}>↻</button></p>}
    {pager.loading && <SkeletonCards label="…" />}
    {!pager.loading && !pager.error && !pager.items.length && <p className="notice">{t("rent.empty")}</p>}
    <div className="listing-grid">{pager.items.map((listing) => <ItemCard key={listing.id} listing={listing} />)}</div>
    <Pagination {...pager} onPageChange={pager.setPage} />
  </>;
}

/** Browse and filter one item category. Filters apply together when the form is submitted. */
export function ItemBrowse({ slug }: { slug: string }) {
  const t = useT();
  const category = categoryBySlug(slug);
  const definitions = useCategoryDefinitions();
  const [applied, setApplied] = useState("");
  if (!category?.item) return <section><p role="alert" className="notice error">{t("rent.notFound")}</p><Link href="/categories">{t("nav.categories")}</Link></section>;

  const definition = definitions?.find((candidate) => candidate.id === category.id);
  const typeField = definition?.fields.find((field) => field.key === definition.typeField);

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const params = new URLSearchParams();
    for (const [name, key] of [["subtype", "subtype"], ["q", "q"], ["maxRent", "maxRent"], ["area", "area"]] as const) {
      const value = String(form.get(name) ?? "").trim();
      if (value) params.set(key, value);
    }
    setApplied(params.toString());
  }

  return <section className="listings-page">
    <div className="page-heading"><div>
      <p className="eyebrow">{t("rent.browse.eyebrow")}</p>
      <h1>{t(categoryNameKey(category.id))}</h1>
      <p className="intro">{t(categoryBlurbKey(category.id))} {t("rent.browse.intro")}</p>
    </div></div>
    <form className="filter-bar" onSubmit={apply}>
      {typeField && <div className="ui-field"><label htmlFor="i-type">{t("rent.filter.type")}</label>
        <select id="i-type" name="subtype" defaultValue=""><option value="">{t("rent.filter.anyType")}</option>
          {typeField.options?.map((option) => <option key={option.value} value={option.value}>{labelFor(t, option.labelKey)}</option>)}</select></div>}
      <div className="ui-field"><label htmlFor="i-q">{t("rent.filter.search")}</label><input id="i-q" name="q" type="search" maxLength={100} /></div>
      <div className="ui-field"><label htmlFor="i-area">{t("filter.area")}</label><input id="i-area" name="area" type="search" maxLength={100} /></div>
      <div className="ui-field"><label htmlFor="i-max">{t("rent.filter.maxRate")}</label><input id="i-max" name="maxRent" type="number" min={0} step={100} inputMode="numeric" /></div>
      <div className="filter-actions"><button className="ui-button ui-button-primary">{t("rent.filter.apply")}</button></div>
    </form>
    {/* Remounting restarts paging at page 1 whenever the filters change. */}
    <ItemList key={applied} query={`category=${category.id}${applied ? `&${applied}` : ""}`} />
  </section>;
}
