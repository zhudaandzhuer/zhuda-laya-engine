// 海邊小場景：沙灘、碼頭、救生艇和海面，照原遊戲的鏡頭與光。豬大（輕量版）戴著五件配件之一漂在海裡，
// 泳圈和水母也放出來看。拖曳轉視角、滾輪拉近。?gear=cap|vest|crown|shades|snorkel 換配件；?quality=0..3。
import { ZhudaEngine, Zhuda3D, ZhudaModelLibrary, ZhudaSceneLook, ZhudaWaterSurface, DirectoryAssetProvider, type ZhudaLookQuality } from 'zhuda-laya-engine';
import { GEAR_BONE, PIER_END, RAFT, SEA, SEASIDE_CAMERA, SEASIDE_FILES, SEASIDE_LOOK, WATER_Y, mountSeaside, seasidePath, seasideWater, type SeasideFile, type SeasideGear } from '../common/3d/seaside-pier/seaside-pier.ts';
import { characterPath } from '../common/3d/zhuda-characters/zhuda-characters.ts';
import { clamp, type V3 } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';

export const seasidePier: ScenePreset = {
  id: 'seaside-pier',
  title: '海邊小場景：沙灘、碼頭、救生艇',
  summary: '俯視玩法用的海邊：沙灘、石頭、椰子樹、木碼頭、救生艇和引擎的水面，全部從數字建模、沒有貼圖、27,302 個三角形。附豬大能戴的五件配件、竹竿、泳圈、水母。',
  modules: ['3d/seaside-pier', '3d/zhuda-characters', '3d/math'],
  views: { 原遊戲的鏡頭: '', 皇冠: 'gear=crown', 潛水面鏡: 'gear=snorkel', 低畫質: 'quality=0' },
  async start(container, params) {
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    const context = await ZhudaEngine.boot({ container, width, height, dprCap: Number(params.get('dpr')) || 1.5, features: ['core', '3d', 'gltf', 'postProcess'], bgColor: '#8fd3f4' });
    const scene = Zhuda3D.createScene3D(context.rootScene);
    const FOV = SEASIDE_CAMERA.fov;
    const camera = Zhuda3D.createCamera(scene, { position: [...SEASIDE_CAMERA.eye], rotationEuler: [-45, 0, 0], fov: FOV, near: 0.3, far: 400 });
    const quality = clamp(Number(params.get('quality') ?? 2), 0, 3) as ZhudaLookQuality;
    const look = new ZhudaSceneLook(scene, camera, SEASIDE_LOOK, { quality, cameraPasses: { depth: true, opaque: true } });
    const water = new ZhudaWaterSurface(scene, { ...seasideWater(false), sun: { toward: look.towardSun, color: [0.05, 0.047, 0.042] } });
    water.camera.clearFlag = camera.clearFlag;
    water.camera.clearColor = camera.clearColor;

    const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 120_000 });
    const models = new ZhudaModelLibrary({ provider, timeoutMs: 120_000 });
    const ids = Object.keys(SEASIDE_FILES) as SeasideFile[];
    const [shore, dock, props, gear] = await Promise.all(ids.map((id) => models.instantiate(seasidePath(id), { retries: 2 })));
    const zhuda = await models.instantiate(characterPath('zhuda-lite'), { retries: 2, independentMaterials: true });
    const parts = mountSeaside(scene, { shore, dock, props, gear });

    // 豬大漂在海中間，戴一件配件：配件照靜止姿勢建模，掛到它跟的那根骨頭上、保持世界位置。
    const swimmer: V3 = [(SEA.minX + SEA.maxX) / 2 - 1.2, WATER_Y - 0.55, (SEA.minZ + SEA.maxZ) / 2 + 0.6];
    scene.addChild(zhuda.node);
    zhuda.node.transform.position = new Laya.Vector3(...swimmer);
    const bones = new Map<string, Laya.Sprite3D>();
    const walk = (n: Laya.Node) => {
      const s = n as Laya.Sprite3D;
      if (s.name) bones.set(s.name, s);
      const r = (s.getComponent?.(Laya.SkinnedMeshRenderer) ?? s.getComponent?.(Laya.MeshRenderer)) as Laya.BaseRender | null;
      if (r) (r.castShadow = true), (r.receiveShadow = true);
      for (let k = 0; k < n.numChildren; k++) walk(n.getChildAt(k));
    };
    walk(zhuda.node);
    const worn = new Map<SeasideGear, Laya.Sprite3D>();
    for (const piece of Object.keys(GEAR_BONE) as SeasideGear[]) {
      const source = parts.gear(piece),
        bone = bones.get(GEAR_BONE[piece]);
      if (!source || !bone) continue;
      const copy = source.clone() as Laya.Sprite3D;
      scene.addChild(copy);
      copy.transform.position = new Laya.Vector3(...swimmer);
      bone.addChild(copy); // LayaAir keeps the world transform when a 3D node changes parent
      copy.transform.position = new Laya.Vector3(...swimmer);
      copy.active = false;
      worn.set(piece, copy);
    }
    let wearing: SeasideGear | null = null;
    const wear = (piece: SeasideGear | null) => {
      wearing = piece && worn.has(piece) ? piece : null;
      for (const [id, node] of worn) node.active = id === wearing;
    };
    wear((params.get('gear') as SeasideGear | null) ?? 'cap');

    // 泳圈和水母各放一個出來。
    const place = (source: Laya.Sprite3D | null | undefined, at: V3) => {
      if (!source) return null;
      const copy = source.clone() as Laya.Sprite3D;
      scene.addChild(copy);
      copy.active = true;
      copy.transform.position = new Laya.Vector3(...at);
      return copy;
    };
    const ring = place(parts.ring, [SEA.maxX - 2.2, WATER_Y + 0.02, SEA.minZ + 2.4]);
    const jelly = place(parts.jelly, [SEA.minX + 1.6, WATER_Y - 0.35, SEA.minZ + 1.4]);
    const pole = place(parts.pole, [PIER_END[0] + 0.5, PIER_END[1] + 0.05, PIER_END[2]]);
    if (pole) (pole.transform.localScale = new Laya.Vector3(1, 3.2, 1)), (pole.transform.localRotationEuler = new Laya.Vector3(0, 0, -62));

    const target: V3 = [...SEASIDE_CAMERA.target];
    const from: V3 = [...SEASIDE_CAMERA.eye];
    const offset: V3 = [from[0] - target[0], from[1] - target[1], from[2] - target[2]];
    const orbit = { yaw: Math.atan2(offset[0], offset[2]), pitch: Math.atan2(offset[1], Math.hypot(offset[0], offset[2])), distance: Math.hypot(...offset) };
    let drag: { x: number; y: number } | null = null;
    container.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
    window.addEventListener('pointerup', () => (drag = null));
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      orbit.yaw -= (e.clientX - drag.x) * 0.006;
      orbit.pitch = clamp(orbit.pitch + (e.clientY - drag.y) * 0.004, 0.12, 1.45);
      drag = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('wheel', (e) => (orbit.distance = clamp(orbit.distance * Math.exp(e.deltaY * 0.001), 4, 40)), { passive: true });
    window.addEventListener('resize', () => context.resize());

    let frames = 0,
      seconds = 0;
    setSceneHook({
      ready: false,
      state: () => ({ quality: look.quality, wearing, gear: [...worn.keys()], raft: !!parts.raft, ring: !!ring, jelly: !!jelly, pole: !!pole, raftAt: RAFT, seconds: +seconds.toFixed(2) }),
      set: (o: { gear?: SeasideGear | null; yaw?: number; pitch?: number; distance?: number; quality?: ZhudaLookQuality }) => {
        if (o.gear !== undefined) wear(o.gear);
        if (o.yaw !== undefined) orbit.yaw = o.yaw;
        if (o.pitch !== undefined) orbit.pitch = o.pitch;
        if (o.distance !== undefined) orbit.distance = o.distance;
        if (o.quality !== undefined) look.setQuality(o.quality);
      },
      errors: () => context.renderer.errors.slice(0, 6),
    });
    const hook = Reflect.get(window, '__SCENE__') as { ready: boolean };
    const raftRest = parts.raft ? parts.raft.transform.position.clone() : null;
    context.runtime.start((dt: number) => {
      seconds += dt;
      const eye: V3 = [
        target[0] + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
        target[1] + Math.sin(orbit.pitch) * orbit.distance,
        target[2] + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
      ];
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0), false);
      // 救生艇和泳圈跟著浪輕輕起伏。
      if (parts.raft && raftRest) parts.raft.transform.position = new Laya.Vector3(raftRest.x, raftRest.y + Math.sin(seconds * 1.3) * 0.03, raftRest.z);
      if (ring) ring.transform.position = new Laya.Vector3(SEA.maxX - 2.2, WATER_Y + 0.02 + Math.sin(seconds * 1.7 + 1) * 0.03, SEA.minZ + 2.4);
      zhuda.node.transform.position = new Laya.Vector3(swimmer[0], swimmer[1] + Math.sin(seconds * 1.5) * 0.05, swimmer[2]);
      look.update(eye, target, FOV, Laya.stage.width / Math.max(1, Laya.stage.height), dt);
      water.render();
      if (++frames === 30) hook.ready = true;
    });
  },
};
