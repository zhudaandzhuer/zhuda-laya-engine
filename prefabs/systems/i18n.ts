/**
 * Display language for games written in one source language.
 *
 * The source strings stay the single source of truth (recorded voices, saves and
 * tests can be keyed on them); other languages are looked up from them at the
 * moment they are shown. Text assembled at run time from a fixed lead and a list
 * (COMPOUND) is translated part by part and joined with that language's separator.
 */
import { readText, writeText } from './storage.ts';

export interface I18nOptions<L extends string> {
  /** localStorage key for the player's choice. */
  storageKey: string;
  /** In the order a settings panel lists them; each label written in its own language. */
  langs: ReadonlyArray<{ id: L; label: string }>;
  /** Lookup table per language; null for the source language. */
  tables: Record<L, Readonly<Record<string, string>> | null>;
  /** Language when nothing is stored, from navigator.language (lower-cased; '' when unknown). */
  detect: (browserLanguage: string) => L;
  compound?: ReadonlyArray<{ lead: string; sep: string }>;
  /** Per language, how each compound separator is written. */
  separators?: Partial<Record<L, Record<string, string>>>;
}

export interface I18n<L extends string> {
  readonly langs: ReadonlyArray<{ id: L; label: string }>;
  get(): L;
  /** Switches, remembers the choice and tells every listener. */
  set(next: L): void;
  /** Returns an unsubscribe function. */
  on(fn: (lang: L) => void): () => void;
  /** Shown form of a source string. */
  t(source: string): string;
  /** `t` for strings with {named} slots, e.g. tf('Clue {n}/{total}', { n: 3, total: 9 }). */
  tf(source: string, values: Record<string, string | number>): string;
  /**
   * Re-shows the page's fixed text: every element marked data-i18n (its source text is kept
   * in data-src the first time), the <html lang> and, if given, the document title.
   */
  translatePage(title?: string): void;
}

export function createI18n<L extends string>(options: I18nOptions<L>): I18n<L> {
  const ids = options.langs.map((l) => l.id),
    compound = options.compound ?? [],
    listeners = new Set<(lang: L) => void>();
  const initial = (): L => {
    const saved = readText(options.storageKey);
    if (saved && (ids as string[]).includes(saved)) return saved as L;
    return options.detect(String(globalThis.navigator?.language ?? '').toLowerCase());
  };
  let lang = initial();
  const t = (source: string): string => {
    const table = options.tables[lang];
    if (!table || !source) return source;
    const direct = table[source];
    if (direct !== undefined) return direct;
    for (const { lead, sep } of compound)
      if (source.startsWith(lead)) {
        const joiner = options.separators?.[lang]?.[sep] ?? sep;
        return (table[lead] ?? lead) + source.slice(lead.length).split(sep).map((part) => table[part] ?? part).join(joiner);
      }
    return source;
  };
  return {
    langs: options.langs,
    get: () => lang,
    set(next) {
      if (next === lang) return;
      lang = next;
      writeText(options.storageKey, next); // remembering the choice is a convenience only
      for (const fn of listeners) fn(next);
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    t,
    tf: (source, values) => t(source).replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? '')),
    translatePage(title) {
      document.documentElement.lang = lang;
      if (title !== undefined) document.title = t(title);
      for (const el of Array.from(document.querySelectorAll?.('[data-i18n]') ?? []) as HTMLElement[]) {
        el.dataset.src ??= el.textContent ?? '';
        el.textContent = t(el.dataset.src);
      }
    },
  };
}
