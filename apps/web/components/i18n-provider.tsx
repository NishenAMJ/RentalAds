"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Locale, MessageKey } from "@/lib/i18n/messages";
import { DEFAULT_LOCALE, isLocale, LOCALE_STORAGE_KEY, translate } from "@/lib/i18n/translate";

interface I18n {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const Context = createContext<I18n | null>(null);

/**
 * Holds the visitor's language. The first render is always English so server and browser markup agree;
 * a saved choice is applied right after load. Falls back to English if storage is unavailable.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
      // Reading the saved choice after mount is the point of this effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (isLocale(saved)) setLocaleState(saved);
    } catch { /* storage unavailable: stay on the default language */ }
  }, []);

  useEffect(() => { document.documentElement.lang = locale; }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try { localStorage.setItem(LOCALE_STORAGE_KEY, next); } catch { /* the choice applies for this visit only */ }
  }, []);

  const value = useMemo<I18n>(() => ({ locale, setLocale, t: (key, vars) => translate(locale, key, vars) }), [locale, setLocale]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(Context);
  if (!context) throw new Error("useI18n must be used inside I18nProvider.");
  return context;
}

/** Shorthand for components that only need to translate. */
export function useT(): I18n["t"] {
  return useI18n().t;
}
