// 豬大花園島 as the game played it (games/zhuda-garden-island, 2026-11-18), from the
// library modules: the same boot, look, camera, walking and governor. Walk with WASD or
// the arrow keys, or a finger on the left of the screen; drag to turn, wheel or pinch to zoom.
//
// Address: ?view=path|pond|stream|beach|above|bamboo|terrace|dusk|night (a place, its
// hour, the clock stopped), ?hour=, ?weather=clear|rain|storm|mist, ?fx=low|mid|high|max,
// ?quality=0..3, ?grass=0, ?detail=0, ?mirror=0, ?governor=0, ?off=fog,dof,ao,clouds,…,
// ?fstop=, ?distance=, ?dpr=. window.__SCENE__ is the game's old window.__ISLAND__ hook.
import { ZhudaEngine, Zhuda3D, ZhudaModelLibrary, DirectoryAssetProvider, type ZhudaLookQuality } from 'zhuda-laya-engine';
import { createGardenIsland, GARDEN_TIERS } from '../common/3d/garden-island/garden-island.ts';
import { GARDEN_VIEWS, type GardenView } from '../common/3d/garden-island/views.ts';
import { Walker } from '../common/3d/island-walker/walker.ts';
import { FollowCamera } from '../common/3d/island-walker/follow-camera.ts';
import { WalkInput } from '../common/3d/island-walker/walk-input.ts';
import { startTier } from '../common/3d/quality-tiers.ts';
import { characterPath } from '../common/3d/zhuda-characters/zhuda-characters.ts';
import type { Weather } from '../common/3d/day-look.ts';
import type { V3 } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset, type SceneHook } from '../preset.ts';

const FOV = 42;

export const gardenIsland: ScenePreset = {
  id: 'garden-island',
  title: '豬大花園島',
  summary:
    '第三人稱走動的花園島：睡蓮池、溪流、石板路與燈籠、竹林、海邊圓石台、會動的海與遠島；花瓣、螢火蟲、星空，一天從清晨走到夜晚。全部程式生成（只有豬大是模型），畫質分四級並依幀預算自動降級。',
  modules: ['3d/garden-island', '3d/island-walker', '3d/zhuda-characters', '3d/day-look', '3d/quality-tiers', '3d/math'],
  // GARDEN_VIEWS' places (the tour the game was checked with, and two shots of its film), then two settings.
  views: {
    走動: '',
    石板路: 'view=path',
    睡蓮池: 'view=pond',
    溪流: 'view=stream',
    海灘: 'view=beach',
    俯瞰: 'view=above',
    竹林: 'view=bamboo',
    黃昏石台: 'view=terrace',
    黃昏海邊: 'view=dusk',
    夜晚: 'view=night',
    手機畫質: 'view=path&fx=low',
    最高畫質: 'view=path&fx=max&governor=0',
  },
  async start(container, params) {
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    const ceiling = startTier(params).tier;
    const context = await ZhudaEngine.boot({
      container,
      width,
      height,
      dprCap: Number(params.get('dpr')) || GARDEN_TIERS[ceiling].dpr,
      features: ['core', '3d', 'gltf', 'postProcess'],
      bgColor: '#9fb6d2',
      maxLights: 16,
    });
    const scene = Zhuda3D.createScene3D(context.rootScene);
    const camera = Zhuda3D.createCamera(scene, { position: [9, 9, 30], rotationEuler: [-20, 10, 0], fov: FOV, near: 0.15, far: 1500 });

    // ---- the hour: a view's own, or ?hour= (both stop the clock) ----
    const view = (GARDEN_VIEWS as Record<string, GardenView | undefined>)[params.get('view') ?? ''] ?? null;
    let hour = Number(params.get('hour') ?? view?.hour ?? 10);
    let clockRuns = !params.has('hour') && !view;
    const off = (params.get('off') || '').split(',');
    const island = createGardenIsland(scene, camera, {
      ceiling,
      quality: params.has('quality') ? (Number(params.get('quality')) as ZhudaLookQuality) : undefined,
      hour,
      weather: (params.get('weather') as Weather) || 'clear',
      off,
      fStop: off.includes('dof') ? 22 : Number(params.get('fstop')) || 4,
      grass: params.get('grass') !== '0',
      detail: params.get('detail') !== '0',
      mirror: params.get('mirror') !== '0',
      governor: params.get('governor') !== '0',
    });

    // ---- the character ----
    const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 240_000, maxBytes: 256 * 1024 * 1024 });
    const models = new ZhudaModelLibrary({ provider, timeoutMs: 240_000 });
    const pigModel = await models.instantiate(characterPath('zhuda'), { retries: 2, independentMaterials: true });
    const walker = new Walker(pigModel, island, island.start);
    scene.addChild(walker.root);
    const shade = (node: Laya.Node) => {
      const sr = (node as Laya.Sprite3D).getComponent?.(Laya.SkinnedMeshRenderer) as Laya.SkinnedMeshRenderer | null;
      if (sr) (sr.castShadow = true), (sr.receiveShadow = true);
      for (let i = 0; i < node.numChildren; i++) shade(node.getChildAt(i));
    };
    shade(walker.root);

    // ---- camera and input ----
    const follow = new FollowCamera(camera, walker.feet, { ground: island.groundAt, obstacles: island.crowns, orbit: { distance: Number(params.get('distance')) || 8 } });
    const input = new WalkInput(container.querySelector('canvas') as HTMLCanvasElement, follow.goal);
    window.addEventListener('resize', () => context.resize());

    let frames = 0,
      since = 0,
      lastFps = 0;
    const set = (o: { hour?: number; run?: boolean; yaw?: number; pitch?: number; distance?: number; at?: [number, number]; walkTo?: [number, number]; lookAt?: V3 | null; face?: number }) => {
      if (o.hour !== undefined) hour = o.hour;
      if (o.run !== undefined) clockRuns = o.run;
      follow.set(o);
      if (o.at) walker.place(o.at[0], o.at[1]), follow.snap(walker.feet);
      if (o.walkTo) walker.goal = o.walkTo;
      if (o.lookAt !== undefined) follow.lookAt = o.lookAt;
      if (o.face !== undefined) walker.yaw = o.face;
    };
    if (view) set({ at: [view.at[0], view.at[1]], face: view.face, yaw: view.yaw, pitch: view.pitch, distance: Number(params.get('distance')) || view.distance });
    const hook: SceneHook = {
      ready: false,
      walker,
      island,
      follow,
      input,
      fx: island.fx,
      state: () => ({
        backend: context.renderer.selected,
        view: [Laya.stage.width, Laya.stage.height, window.innerWidth, window.innerHeight],
        feet: walker.feet,
        hour,
        fps: lastFps,
        grass: island.grass?.stats,
        particles: island.fx.alive,
        quality: island.look.quality,
        setting: GARDEN_TIERS[island.step.tier].id,
        renderScale: island.step.renderScale,
      }),
      set: set as (o: Record<string, unknown>) => void,
      errors: () => context.renderer.errors.slice(0, 6),
    };
    setSceneHook(hook);

    // ---- the frame ----
    context.runtime.start((dt: number) => {
      if (clockRuns) hour = (hour + dt * 0.06) % 24;
      // Walking: keys and the touch stick are read against the way the camera faces.
      walker.update(dt, input.stick(follow.orbit.yaw));
      const eye = follow.update(dt, walker.feet);
      island.update({ dt, hour, eye, target: follow.target, bodies: [walker] });
      frames++;
      since += dt;
      if (since >= 0.5) {
        lastFps = Math.round(frames / since);
        frames = since = 0;
      }
      hook.ready = true;
    });
    window.addEventListener(
      'pagehide',
      () => {
        input.dispose();
        walker.dispose();
        island.dispose();
        pigModel.dispose();
        models.dispose();
        provider.dispose();
        context.dispose();
      },
      { once: true },
    );
  },
};
