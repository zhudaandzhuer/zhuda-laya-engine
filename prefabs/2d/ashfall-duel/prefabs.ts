/**
 * The courtyard prefab of 「灰燼之庭」: one Laya scene (assets/courtyard.lh: backdrop, ground
 * shadows, blade strip, knight, warden, dust layer) with every texture it draws from,
 * including the four motion pages, and two states: `impact` (everything) and `empty`
 * (the courtyard alone). The engine's prefab preview and checks import this file too.
 */
import {
  DirectoryAssetProvider,
  type PrefabDefinition,
} from "zhuda-laya-engine";

import { CELS } from "./motion-cels.ts";

/** Where `assets/` of this module is served after scripts/sync.mjs (public/common/… → common/…). */
export const ASHFALL_ASSETS = "./common/2d/ashfall-duel/assets/";

export const definitions: PrefabDefinition[] = [
  {
    id: "ashfall.courtyard",
    asset: "courtyard.lh",
    textures: [
      "art/courtyard.webp",
      "art/knight.webp",
      "art/warden.webp",
      "art/matter.png",
      ...CELS.knight.pages,
      ...CELS.warden.pages,
    ],
    states: {
      impact: {},
      empty: {
        Knight: { visible: false },
        Blade: { visible: false },
        Warden: { visible: false },
        Ground: { visible: false },
      },
    },
  },
];

/** The provider for the scene, the textures and the four sounds (sound/*.wav). */
export function createAssetProvider(baseUrl = ASHFALL_ASSETS) {
  return new DirectoryAssetProvider({ baseUrl, timeoutMs: 20000 });
}
