import { en, type MessageKey } from "./i18n/messages.ts";

/**
 * The categories people can rent, in the order they are shown. The API's category registry decides
 * what each item category's listing contains; this list only decides where each one lives on the site.
 */
export interface CategoryInfo {
  /** Matches the API's ListingCategory value. */
  id: "PROPERTY" | "VEHICLE" | "EQUIPMENT" | "EVENT_GEAR";
  /** Used in the item pages' addresses, for example /c/vehicles. */
  slug: string;
  /** Where renters browse this category. */
  browseHref: string;
  /** Where owners start a listing in this category. */
  listHref: string;
  /** Item categories are booked and paid online; homes use a personal introduction. */
  item: boolean;
}

export const CATEGORIES: readonly CategoryInfo[] = [
  { id: "PROPERTY", slug: "homes", browseHref: "/listings", listHref: "/owner/new", item: false },
  { id: "VEHICLE", slug: "vehicles", browseHref: "/c/vehicles", listHref: "/owner/new/vehicles", item: true },
  { id: "EQUIPMENT", slug: "equipment", browseHref: "/c/equipment", listHref: "/owner/new/equipment", item: true },
  { id: "EVENT_GEAR", slug: "event-gear", browseHref: "/c/event-gear", listHref: "/owner/new/event-gear", item: true },
];

export const categoryBySlug = (slug: string) => CATEGORIES.find((category) => category.slug === slug);
export const categoryById = (id: string | undefined) => CATEGORIES.find((category) => category.id === (id ?? "PROPERTY"));

export const categoryNameKey = (id: CategoryInfo["id"]) => `cat.${id}.name` as MessageKey;
export const categoryBlurbKey = (id: CategoryInfo["id"]) => `cat.${id}.blurb` as MessageKey;

/** English name, for the admin screens, which are not translated. */
export const categoryLabel = (id: string | undefined) => {
  const category = categoryById(id);
  return category ? en[categoryNameKey(category.id)] : (id ?? "");
};
