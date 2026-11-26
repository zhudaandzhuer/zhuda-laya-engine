// Cascading locale for a slot's texts, as a plug pipeline:
//   normalize vendor locale codes (zh_CHS → zh-CN, tw/hk → zh-TW …)
//   → tier 1 core texts → tier 2 game texts → tier 3 compliance and currency overrides
//   → typography (shrink for long words, line height, rtl)
// then t(key, params) fills {name} from the game's parameters. Pure TypeScript.
// Split from <original-cascade-slot>/client/src/plugs/i18n/CascadingI18nPipeline.ts. Changes: the
// dictionaries, overrides and typography table are options (the source fixed its own texts
// and read a global store). For DOM pages with source-language keys use systems/i18n instead.
import type { CurrencyMode } from './protocol.ts';
import { PipelineExecutor, type PlugFn } from './pipeline.ts';
import type { Jurisdiction } from './slot-store.ts';

export interface Typography {
  maxScaleShrink: number;
  lineHeightMultiplier: number;
  direction: 'ltr' | 'rtl';
  fontFamily: string;
}

export interface LocaleContext {
  rawLocale: string;
  normalizedLocale: string;
  jurisdiction: Jurisdiction;
  currencyMode: CurrencyMode;
  gameParams: Record<string, string | number>;
  dictionary: Record<string, string>;
  typography: Typography;
}

export type Dictionaries = Record<string, Record<string, string>>;

export interface LocaleOverride {
  /** When it applies. */
  when: (ctx: LocaleContext) => boolean;
  /** Keys to replace (a function gets the context). */
  texts: Record<string, string | ((ctx: LocaleContext) => string)>;
}

export interface LocalePipelineOptions {
  core: Dictionaries;
  game?: Dictionaries;
  /** The locale missing keys fall back to (default 'en-US'). */
  base?: string;
  overrides?: LocaleOverride[];
  /** Locale → typography; missing locales get DEFAULT_TYPOGRAPHY. */
  typography?: Record<string, Partial<Typography>>;
  /** Raw (lower-case) code → locale; checked before prefixes. */
  aliases?: Record<string, string>;
  /** Supported locales; a raw code that starts with a locale's language maps to it. */
  locales?: string[];
  gameParams?: Record<string, string | number>;
}

export const DEFAULT_TYPOGRAPHY: Typography = { maxScaleShrink: 1, lineHeightMultiplier: 1.15, direction: 'ltr', fontFamily: 'sans-serif' };

/** The source's measured table: German shrinks to 0.62, Thai needs 1.35 line height, Arabic is rtl. */
export const TYPOGRAPHY_PRESETS: Record<string, Partial<Typography>> = {
  'de-DE': { maxScaleShrink: 0.62, lineHeightMultiplier: 1.1 },
  'th-TH': { maxScaleShrink: 0.85, lineHeightMultiplier: 1.35 },
  'ar-SA': { maxScaleShrink: 0.88, lineHeightMultiplier: 1.2, direction: 'rtl' },
};

export const VENDOR_LOCALE_ALIASES: Record<string, string> = {
  zh_chs: 'zh-CN', cn: 'zh-CN', 'zh-hans': 'zh-CN', 'zh-cn': 'zh-CN',
  tw: 'zh-TW', hk: 'zh-TW', zh_cht: 'zh-TW', 'zh-hant': 'zh-TW', 'zh-tw': 'zh-TW',
};

export class LocalePipeline {
  readonly pipeline = new PipelineExecutor<LocaleContext>();
  readonly context: LocaleContext;
  private options: Required<Omit<LocalePipelineOptions, 'gameParams'>>;

  constructor(options: LocalePipelineOptions) {
    this.options = {
      game: {},
      base: 'en-US',
      overrides: [],
      typography: TYPOGRAPHY_PRESETS,
      aliases: VENDOR_LOCALE_ALIASES,
      locales: Object.keys(options.core),
      ...options,
    };
    const o = this.options;
    const normalize: PlugFn<LocaleContext> = async (ctx, next) => {
      const raw = (ctx.rawLocale || o.base).trim().toLowerCase();
      ctx.normalizedLocale = o.aliases[raw] ?? o.locales.find((l) => l.toLowerCase() === raw) ?? o.locales.find((l) => raw.startsWith(l.slice(0, 2).toLowerCase())) ?? o.base;
      await next();
    };
    const core: PlugFn<LocaleContext> = async (ctx, next) => {
      ctx.dictionary = { ...o.core[o.base], ...o.core[ctx.normalizedLocale] };
      await next();
    };
    const game: PlugFn<LocaleContext> = async (ctx, next) => {
      ctx.dictionary = { ...ctx.dictionary, ...o.game[o.base], ...o.game[ctx.normalizedLocale] };
      await next();
    };
    const compliance: PlugFn<LocaleContext> = async (ctx, next) => {
      for (const rule of o.overrides) {
        if (!rule.when(ctx)) continue;
        for (const [k, v] of Object.entries(rule.texts)) ctx.dictionary[k] = typeof v === 'function' ? v(ctx) : v;
      }
      await next();
    };
    const typography: PlugFn<LocaleContext> = async (ctx, next) => {
      ctx.typography = { ...DEFAULT_TYPOGRAPHY, ...o.typography[ctx.normalizedLocale] };
      await next();
    };
    this.pipeline
      .use('VendorLocaleNormalizerPlug', normalize)
      .use('Tier1CoreLocalePlug', core)
      .use('Tier2GameLocalePlug', game)
      .use('Tier3ComplianceLocalePlug', compliance)
      .use('TypographyAutoFitPlug', typography);
    this.context = {
      rawLocale: o.base,
      normalizedLocale: o.base,
      jurisdiction: 'GLOBAL',
      currencyMode: 'DEMO',
      gameParams: { ...options.gameParams },
      dictionary: {},
      typography: { ...DEFAULT_TYPOGRAPHY },
    };
    this.pipeline.executeSync(this.context);
  }

  /** Switches locale (and, when given, jurisdiction and currency) and rebuilds the dictionary. */
  async switchLocale(rawLocale: string, extra: { jurisdiction?: Jurisdiction; currencyMode?: CurrencyMode } = {}): Promise<LocaleContext> {
    this.context.rawLocale = rawLocale;
    if (extra.jurisdiction) this.context.jurisdiction = extra.jurisdiction;
    if (extra.currencyMode) this.context.currencyMode = extra.currencyMode;
    await this.pipeline.execute(this.context);
    return this.context;
  }

  /** The text for key with {name} filled from params, then the game parameters; unknown keys come back as the key. */
  t(key: string, params?: Record<string, string | number>): string {
    const template = this.context.dictionary[key] ?? key;
    const merged = { ...this.context.gameParams, ...params };
    return template.replace(/\{(\w+)\}/g, (match, k) => (merged[k] !== undefined ? String(merged[k]) : match));
  }
}
