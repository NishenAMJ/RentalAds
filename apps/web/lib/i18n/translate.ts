import { dictionaries, en, LOCALES, type Locale, type MessageKey } from "./messages.ts";

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_STORAGE_KEY = "sewana-lang";

export function isLocale(value: unknown): value is Locale {
  return LOCALES.some((locale) => locale.code === value);
}

/**
 * Looks up `key` in `locale`, falling back to English when a translation is missing.
 * `{name}` placeholders are replaced from `vars`; an unknown placeholder is left visible so it is noticed.
 */
export function translate(locale: Locale, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = dictionaries[locale][key] ?? en[key];
  return vars ? template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match)) : template;
}
