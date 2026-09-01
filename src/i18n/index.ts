/**
 * Tiny self-contained i18n. No external dependency: a locale value, a set of
 * flat key->string tables, `t(key, vars)` with `{var}` interpolation, and a
 * `useT()` hook that re-renders components when the locale changes.
 *
 * The JSON files are the source of truth for copy; migrating to i18next later
 * is a drop-in because the key/format convention matches.
 */

import { useSyncExternalStore } from 'react';
import en from './locales/en.json';
import es from './locales/es.json';

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

type Table = Record<string, string>;
const TABLES: Record<Locale, Table> = { en, es };
const FALLBACK: Locale = 'en';

let currentLocale: Locale = 'es';
const listeners = new Set<() => void>();

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  if (locale === currentLocale || !LOCALES.includes(locale)) return;
  currentLocale = locale;
  if (typeof document !== 'undefined') document.documentElement.lang = locale;
  listeners.forEach((l) => l());
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/** Translate `key`. Falls back to English, then to the key itself. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = TABLES[currentLocale][key] ?? TABLES[FALLBACK][key] ?? key;
  return interpolate(raw, vars);
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Hook returning a `t` bound to the current locale. Components using it
 * re-render on `setLocale`.
 */
export function useT(): { t: typeof t; locale: Locale } {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return { t, locale };
}
