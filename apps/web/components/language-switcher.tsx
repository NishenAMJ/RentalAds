"use client";
import { LOCALES } from "@/lib/i18n/messages";
import { isLocale } from "@/lib/i18n/translate";
import { useI18n } from "./i18n-provider";

export function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <select className="language-switcher" aria-label={t("lang.label")} value={locale}
      onChange={(event) => { if (isLocale(event.target.value)) setLocale(event.target.value); }}>
      {LOCALES.map((item) => <option key={item.code} value={item.code} lang={item.code}>{item.label}</option>)}
    </select>
  );
}
