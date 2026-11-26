// Logical asset keys → paths, through a fallback chain, so views never hard-code a file:
//   1. vendor skin + locale   2. game + locale   3. game default   4. core fallback
// Each tier is a map the game supplies; the first that has the key wins, and the tier is
// reported (useful for "why is this the English logo"). Pure TypeScript.
// Split from <original-cascade-slot>/client/src/plugs/assets/CascadingAssetResolver.ts. The
// source declared the four tiers but only looked up one map with a fixed fallback key; here
// the chain is real.
import { PipelineExecutor, type PlugFn } from './pipeline.ts';

export type AssetTier = 'VENDOR_SKIN' | 'GAME_LOCALE' | 'GAME_DEFAULT' | 'CORE_FALLBACK' | 'MISSING';

export interface AssetResolution {
  logicalKey: string;
  vendorId: string;
  locale: string;
  resolvedPath: string;
  tierResolved: AssetTier;
  metadata: Record<string, unknown>;
}

export interface AssetResolverOptions {
  /** vendorId → locale → key → path (a locale of '*' applies to every locale). */
  vendorSkins?: Record<string, Record<string, Record<string, string>>>;
  /** locale → key → path. */
  gameLocales?: Record<string, Record<string, string>>;
  game: Record<string, string>;
  /** key → path, or one path for every unknown key. */
  core?: Record<string, string> | string;
  /** Extra plugs after the lookup (e.g. add metadata). */
  plugs?: Array<[string, PlugFn<AssetResolution>]>;
}

export class AssetResolver {
  readonly pipeline = new PipelineExecutor<AssetResolution>();
  vendorId: string;
  locale: string;
  private options: AssetResolverOptions;

  constructor(options: AssetResolverOptions, { vendorId = 'default', locale = 'en-US' } = {}) {
    this.options = options;
    this.vendorId = vendorId;
    this.locale = locale;
    const lookup: PlugFn<AssetResolution> = async (ctx, next) => {
      const o = this.options;
      const skin = o.vendorSkins?.[ctx.vendorId];
      const tiers: Array<[AssetTier, string | undefined]> = [
        ['VENDOR_SKIN', skin?.[ctx.locale]?.[ctx.logicalKey] ?? skin?.['*']?.[ctx.logicalKey]],
        ['GAME_LOCALE', o.gameLocales?.[ctx.locale]?.[ctx.logicalKey]],
        ['GAME_DEFAULT', o.game[ctx.logicalKey]],
        ['CORE_FALLBACK', typeof o.core === 'string' ? o.core : o.core?.[ctx.logicalKey]],
      ];
      const hit = tiers.find(([, path]) => path);
      ctx.tierResolved = hit ? hit[0] : 'MISSING';
      ctx.resolvedPath = hit ? hit[1]! : '';
      await next();
    };
    this.pipeline.use('CascadingAssetResolverPlug', lookup);
    for (const [name, plug] of options.plugs ?? []) this.pipeline.use(name, plug);
  }

  resolveDetailed(logicalKey: string): AssetResolution {
    const ctx: AssetResolution = { logicalKey, vendorId: this.vendorId, locale: this.locale, resolvedPath: '', tierResolved: 'MISSING', metadata: {} };
    this.pipeline.executeSync(ctx);
    return ctx;
  }

  /** The path for a key ('' when no tier has it). */
  resolve(logicalKey: string): string {
    return this.resolveDetailed(logicalKey).resolvedPath;
  }

  /** Paths of every key with a prefix (e.g. 'ui:') in the game map, for preloading. */
  preload(prefix = ''): string[] {
    return Object.keys(this.options.game).filter((k) => k.startsWith(prefix)).map((k) => this.resolve(k));
  }
}
