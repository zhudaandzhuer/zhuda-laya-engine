import { DirectoryAssetProvider } from 'zhuda-laya-engine';
import type { AssetProvider, PrefabDefinition } from 'zhuda-laya-engine';
import { manifest } from './asset-manifest';

export { manifest };

export const symbolId = 'symbols/rocket.png';

export const definitions: PrefabDefinition[] = [{
  id: 'slot/symbol',
  asset: 'prefabs/slot-symbol.lh',
  textures: [symbolId],
  states: {
    idle: { Art: { scaleX: 1, scaleY: 1 } },
    selected: { Art: { scaleX: 1.04, scaleY: 1.04 } },
    win: { Art: { scaleX: 1.08, scaleY: 1.08 } },
    jackpot: { Art: { scaleX: 1.12, scaleY: 1.12 } },
  },
}];

export function createAssetProvider(): AssetProvider {
  return new DirectoryAssetProvider({ baseUrl: './assets/', manifest, timeoutMs: 20_000, maxBytes: 128 * 1024 * 1024 });
}
