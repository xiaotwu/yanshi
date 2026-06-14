import { useRuntimeStore } from "../stores/runtimeStore";
import { en, type TKey } from "./en";
import { zh } from "./zh";

export type LanguagePref = "system" | "en-US" | "zh-CN";
export type Locale = "en-US" | "zh-CN";

const DICTS: Record<Locale, Record<TKey, string>> = { "en-US": en, "zh-CN": zh };

export function detectSystemLocale(): Locale {
  const lang = (typeof navigator !== "undefined" && navigator.language) || "en-US";
  return lang.toLowerCase().startsWith("zh") ? "zh-CN" : "en-US";
}

export function resolveLocale(pref: LanguagePref | undefined): Locale {
  if (pref === "en-US" || pref === "zh-CN") return pref;
  return detectSystemLocale();
}

function format(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, key) => (key in vars ? String(vars[key]) : `{${key}}`));
}

export function translate(locale: Locale, key: TKey, vars?: Record<string, string | number>): string {
  const dict = DICTS[locale] ?? en;
  return format(dict[key] ?? en[key] ?? key, vars);
}

/** Translation hook. Re-renders when the language preference changes. */
export function useT() {
  const pref = useRuntimeStore((state) => state.appSettings?.language) as LanguagePref | undefined;
  const locale = resolveLocale(pref);
  const t = (key: TKey, vars?: Record<string, string | number>) => translate(locale, key, vars);
  return { t, locale };
}
