// The whole game layer of Dungeon Spin made from the library: boot, one provider, one prefab
// library, the scene. `node ../../../../scripts/sync.mjs . 2d/dungeon-spin` puts the modules in src/common/.
// (The engine build targets ES2020: no top-level await, so it is an async main().)
import { ZhudaEngine, ZhudaPrefabLibrary } from 'zhuda-laya-engine';
import { DungeonSpin, DESIGN } from './common/2d/dungeon-spin/dungeon-spin.ts';
import { createAssetProvider, definitions } from './common/2d/dungeon-spin/prefabs.ts';

async function main() {
  // No container: Laya's own show-all fits the portrait design into any window. (With a
  // container and no designSize the stage follows the container's size instead.)
  const { stage, canvas } = await ZhudaEngine.boot({
    width: DESIGN.width,
    height: DESIGN.height,
    bgColor: '#080f19',
    scaleMode: 'showall',
    features: ['core', '2d', 'ui'],
  });
  document.querySelector('#game')?.appendChild(canvas);
  const provider = createAssetProvider();
  const library = new ZhudaPrefabLibrary({ provider, definitions });
  const game = new DungeonSpin(stage, library);
  await game.init();
  window.addEventListener('pagehide', () => {
    game.dispose();
    library.dispose();
    provider.dispose?.();
  }, { once: true });
  ZhudaEngine.flushRenderFrames(4);
}

main().catch((error) => console.error('迷宮一閃啟動失敗', error));
