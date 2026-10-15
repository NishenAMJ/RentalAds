"use client";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";
import { useT } from "@/components/i18n-provider";

/** Query-string keys the listings API understands. Anything else in the URL is ignored. */
export const FILTER_KEYS = ["area", "propertyType", "furnishing", "minRent", "maxRent", "minBedrooms", "parking", "sort"] as const;

/** Keeps only known, non-empty filters so the URL and API call stay tidy and predictable. */
export function cleanFilters(source: URLSearchParams | Record<string, string | undefined>): URLSearchParams {
  const get = (key: string) => (source instanceof URLSearchParams ? source.get(key) : source[key]) ?? "";
  const clean = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = get(key).trim();
    if (value) clean.set(key, value);
  }
  return clean;
}

export function ListingFilters({ applied }: { applied: URLSearchParams }) {
  const router = useRouter();
  const t = useT();
  const value = (key: string) => applied.get(key) ?? "";

  function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = cleanFilters(Object.fromEntries([...form.entries()].map(([key, field]) => [key, String(field)])));
    router.replace(next.size ? `/listings?${next}` : "/listings", { scroll: false });
  }

  return (
    // The key remounts the form so the fields always reflect the applied URL (for example after "Clear").
    <form key={applied.toString()} className="filter-bar" onSubmit={apply} aria-label={t("filter.label")}>
      <div className="ui-field"><label htmlFor="f-area">{t("filter.area")}</label><input id="f-area" name="area" defaultValue={value("area")} placeholder="e.g. Nugegoda" maxLength={100} /></div>
      <div className="ui-field"><label htmlFor="f-type">{t("filter.type")}</label>
        <select id="f-type" name="propertyType" defaultValue={value("propertyType")}><option value="">{t("filter.any")}</option><option value="APARTMENT">{t("filter.apartment")}</option><option value="HOUSE">{t("filter.house")}</option></select></div>
      <div className="ui-field"><label htmlFor="f-beds">{t("filter.bedrooms")}</label>
        <select id="f-beds" name="minBedrooms" defaultValue={value("minBedrooms")}><option value="">{t("filter.any")}</option>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}+</option>)}</select></div>
      <div className="ui-field"><label htmlFor="f-min">{t("filter.minRent")}</label><input id="f-min" name="minRent" type="number" min={0} step={1000} defaultValue={value("minRent")} inputMode="numeric" /></div>
      <div className="ui-field"><label htmlFor="f-max">{t("filter.maxRent")}</label><input id="f-max" name="maxRent" type="number" min={0} step={1000} defaultValue={value("maxRent")} inputMode="numeric" /></div>
      <div className="ui-field"><label htmlFor="f-furnishing">{t("filter.furnishing")}</label>
        <select id="f-furnishing" name="furnishing" defaultValue={value("furnishing")}><option value="">{t("filter.any")}</option><option value="FURNISHED">{t("filter.furnished")}</option><option value="SEMI_FURNISHED">{t("filter.semi")}</option><option value="UNFURNISHED">{t("filter.unfurnished")}</option></select></div>
      <div className="ui-field"><label htmlFor="f-sort">{t("filter.sort")}</label>
        <select id="f-sort" name="sort" defaultValue={value("sort")}><option value="">{t("filter.newest")}</option><option value="price_asc">{t("filter.priceAsc")}</option><option value="price_desc">{t("filter.priceDesc")}</option></select></div>
      <label className="checkbox option-row filter-parking"><input type="checkbox" name="parking" value="true" defaultChecked={value("parking") === "true"} />{t("filter.parking")}</label>
      <div className="filter-actions">
        <button type="submit" className="ui-button ui-button-primary">{t("filter.apply")}</button>
        {applied.size > 0 && <button type="button" className="ui-button ui-button-ghost" onClick={() => router.replace("/listings", { scroll: false })}>{t("filter.clear")}</button>}
      </div>
    </form>
  );
}
