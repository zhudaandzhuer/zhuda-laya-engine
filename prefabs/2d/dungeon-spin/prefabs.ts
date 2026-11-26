// Dungeon Spin's three visual prefabs, their asset manifest and the provider factory.
// The prefab checks (zhuda.config.json prefabChecks + prefabPreview) and the scene use these
// same definitions and the same factory, so the scene never loads a picture another way.
//
//   const provider = createAssetProvider();                       // common/2d/dungeon-spin/assets/
//   const library = new ZhudaPrefabLibrary({ provider, definitions });
//
// The definitions are byte-for-byte the original's (same definition hash 9cd7c6a1… for the
// background); only the provider's base URL moved from ./assets/ to where sync puts the files.
// From games/dungeon-spin (src/prefabs.ts, src/assets/manifest.ts).
import { DirectoryAssetProvider } from 'zhuda-laya-engine';
import type { AssetManifest, AssetProvider, PrefabDefinition } from 'zhuda-laya-engine';

/** Where scripts/sync.mjs puts this module's assets/ in a game (served from the page's folder). */
export const DUNGEON_SPIN_ASSETS = './common/2d/dungeon-spin/assets/';

export const definitions: PrefabDefinition[] = [
  {
    id: "visual/template-background",
    asset: "prefabs/template-background.lh",
    textures: ["template-v2.png"],
    states: { idle: { Background: { visible: true } } },
  },
  {
    id: "visual/creatures-atlas",
    asset: "prefabs/creatures-atlas.lh",
    textures: ["creatures-v3.png"],
    states: { idle: { CreaturesAtlas: { visible: true } } },
  },
  {
    id: "visual/hero-actions",
    asset: "prefabs/hero-actions.lh",
    textures: ["hero-actions-v4.png"],
    states: { idle: { HeroActions: { visible: true } } },
  },
];

/** Every file the prefabs load, with its size and SHA-256 (checked by the provider and by tests/dungeon-spin.test.mjs). */
export const assetManifest: AssetManifest = {
  schemaVersion: 1,
  entries: [
    { id: "prefabs/template-background.lh", kind: "scene", bytes: 371, sha256: "cf9dbf64453ab17fe0305f91e3f92e2eec5618212a9ea95c5faaff6139cd34e2" },
    { id: "prefabs/creatures-atlas.lh", kind: "scene", bytes: 390, sha256: "41fb46a820f9e78a8e7dc0356f5364144affec2e1fc5f95ed0c1587459f7c607" },
    { id: "prefabs/hero-actions.lh", kind: "scene", bytes: 353, sha256: "f313cb1ddab9a2f481da9a1d959b998feef9be0596fb5cdd0fda8c72d949f194" },
    { id: "template-v2.png", kind: "image", bytes: 2153402, sha256: "42d32c92ec1b83d3f79b0e87c987c1e64e464ce76a7c0866c272df402f285ba4" },
    { id: "creatures-v3.png", kind: "image", bytes: 2376483, sha256: "c2112761ce0cb62ed3696d402cf11bcfcd0c2a5209842812ccf2d3ff0f128f98" },
    { id: "hero-actions-v4.png", kind: "image", bytes: 2775661, sha256: "8292e7ef1f00350e486e7bdb1107e37da177d2b085f65eb6f466cbf10a2afc45" },
  ],
};

/**
 * The one provider of the game's pictures. The prefab preview calls it with no argument, so
 * the default must be where the build serves the assets; pass another base URL only when
 * the files are elsewhere.
 */
export function createAssetProvider(baseUrl: string = DUNGEON_SPIN_ASSETS): AssetProvider {
  return new DirectoryAssetProvider({
    baseUrl,
    manifest: assetManifest,
    timeoutMs: 15_000,
    maxBytes: 20_000_000,
  });
}
