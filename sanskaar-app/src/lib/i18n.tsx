/* Language: the website's translations (synced into src/data/i18n.json), remembered on the phone */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import data from "../data/i18n.json";

export type Lang = "en" | "hi" | "gu" | "mr" | "kn";
export const languages = data.languages as { code: Lang; name: string }[];
const strings = data.strings as Record<string, Record<string, string>>;
const KEY = "sanskaar:lang";
const LOCALES: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", gu: "gu-IN", mr: "mr-IN", kn: "kn-IN" };

export type Vars = Record<string, string | number>;
export function translate(lang: Lang, key: string, vars?: Vars) {
  let s = strings[lang]?.[key] ?? strings.en[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

interface I18n {
  lang: Lang;
  ready: boolean;
  setLang(l: Lang): void;
  t(key: string, vars?: Vars): string;
  /** Indian scripts join letters, so letter-spacing is only used for English. */
  ls(n: number): number;
  fmtDate(d: string | Date | null | undefined): string;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then(v => { if (v && languages.some(l => l.code === v)) setLangState(v as Lang); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(KEY, l).catch(() => {});
  }, []);

  const value = useMemo<I18n>(() => ({
    lang, ready, setLang,
    t: (key, vars) => translate(lang, key, vars),
    ls: n => (lang === "en" ? n : 0),
    fmtDate: d => {
      if (!d) return "";
      const date = typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + "T00:00:00") : new Date(d);
      return date.toLocaleDateString(LOCALES[lang], { day: "numeric", month: "short", year: "numeric" });
    }
  }), [lang, ready, setLang]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n must be used inside <I18nProvider>");
  return v;
}

export const inDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
