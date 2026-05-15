import {
  createContext,
  createElement,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import en from "./en.json";
import ro from "./ro.json";
import { tenantStore } from "../mock/tenants";

export type Locale = "en" | "ro";

const dictionaries: Record<Locale, Record<string, string>> = { en, ro };

interface I18nContextValue {
  locale: Locale;
  setLocale: (l: Locale) => void;
  /** Translate a key, interpolate {vars}, then apply the active tenant's terminology overrides. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => (vars[k] === undefined ? `{${k}}` : String(vars[k])));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function preserveCase(original: string, replacement: string): string {
  if (original === original.toUpperCase()) return replacement.toUpperCase();
  if (original[0] === original[0]?.toUpperCase()) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function applyTerminology(text: string): string {
  const term = tenantStore.active().terminology;
  if (!term || Object.keys(term).length === 0) return text;
  let out = text;
  for (const [from, to] of Object.entries(term)) {
    const re = new RegExp(`\\b${escapeRegex(from)}\\b`, "gi");
    out = out.replace(re, (m) => preserveCase(m, to));
  }
  return out;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(() => {
    const saved = window.localStorage.getItem("will.demo.locale");
    return saved === "ro" ? "ro" : "en";
  });

  const value = useMemo<I18nContextValue>(() => {
    const dict = dictionaries[locale];
    return {
      locale,
      setLocale: (l) => {
        window.localStorage.setItem("will.demo.locale", l);
        setLocale(l);
      },
      t: (key, vars) => applyTerminology(interpolate(dict[key] ?? key, vars)),
    };
  }, [locale]);

  return createElement(I18nContext.Provider, { value }, children);
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
