// 囂張小黑人在車庫：一台低模小車停在停車格裡，車旁站幾個小黑人，各自播兩段 idle、自己 crossfade 輪播。
// 拿來看角色放進賽車遊戲車庫畫面裡的樣子（粉紫色格子地板、停車格線、柔和的光）。
// ?models=a.glb,b.glb,c.glb（網址，相對 index.html）放幾個不同版本的模型並排比；預設只放 prefabs 的那一個。
// ?labels=甲,乙,丙 每個的說明；?hold=Idle_HandsOnHips 全部停在同一段；?yaw= ?pitch= ?distance= 鏡頭。小車是用基本形狀拼的（這個觀看台自己的展示用道具，不是共用元件）。
import { ZhudaEngine, Zhuda3D, ZhudaModelLibrary, ZhudaModelInspector, ZhudaSceneLook, DirectoryAssetProvider, createSurfaceMaterial } from 'zhuda-laya-engine';
import { skyAt, OCEAN, type WeatherMix } from '../common/3d/day-look.ts';
import { STICKMAN_CLIPS, StickmanIdles, fadeShare, repairGltfCrossFade, stickmanPath, type StickmanClip } from '../common/3d/stickman/stickman.ts';
import { clamp, type V3 } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';

const hex = (h: string): [number, number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255, 1];
const mat = (h: string, roughness = 0.65, metallic = 0) => createSurfaceMaterial({ type: 'pbr', color: hex(h), roughness, metallic }) as Laya.Material;

/** 一個零件：網格＋材質，放在 parent 底下（公尺、度）。 */
function part(parent: Laya.Sprite3D, mesh: Laya.Mesh, material: Laya.Material, at: V3, rot: V3 = [0, 0, 0]) {
  const s = new Laya.MeshSprite3D(mesh);
  s.meshRenderer.sharedMaterial = material;
  s.meshRenderer.castShadow = true;
  s.meshRenderer.receiveShadow = true;
  s.transform.localPosition = new Laya.Vector3(...at);
  s.transform.localRotationEuler = new Laya.Vector3(...rot);
  parent.addChild(s);
  return s;
}

/**
 * 低模小車，短胖的玩具車比例（照 Pine Circuit 車庫截圖：小黑人站在旁邊，頭頂大約到車頂的燈）：
 * 長 2.3、寬 1.45、車頂 1.16 公尺（頂燈到 1.24）；車廂高、擋風玻璃大、輪子大（半徑 0.3）、四個輪子放在角上。
 * 黃色車身、藍玻璃、車頂架和兩顆燈、圓頭燈、灰保險桿、側面條紋和號碼圓牌、帶短釘的黑輪胎。車頭朝 +Z。
 */
function buildCar(): Laya.Sprite3D {
  const car = new Laya.Sprite3D('car');
  const P = Laya.PrimitiveMesh;
  const yellow = mat('#e9c35c', 0.55), yellowDark = mat('#d9ae45', 0.6), glass = mat('#4f78b8', 0.18), grey = mat('#9aa3ad', 0.5, 0.2);
  const dark = mat('#2c2c33', 0.7), tyre = mat('#26262b', 0.85), hub = mat('#8e97a2', 0.45, 0.3), lamp = mat('#f4dc84', 0.35);
  const red = mat('#d5513f', 0.5), orange = mat('#ec8c3a', 0.5), white = mat('#f2f0ea', 0.5);
  // 車身下半（0.26～0.74）、引擎蓋、車廂（0.74～1.16）
  part(car, P.createBox(1.45, 0.48, 2.3), yellow, [0, 0.5, 0]);
  part(car, P.createBox(1.3, 0.08, 0.78), yellowDark, [0, 0.78, 0.7]);
  part(car, P.createBox(0.5, 0.07, 0.4), yellowDark, [0, 0.84, 0.66]);
  part(car, P.createBox(1.34, 0.42, 1.25), yellow, [0, 0.95, -0.22]);
  // 玻璃：大擋風玻璃（往後斜）、後窗、兩邊各兩片側窗
  part(car, P.createBox(1.2, 0.36, 0.04), glass, [0, 0.96, 0.42], [-14, 0, 0]);
  part(car, P.createBox(1.16, 0.32, 0.04), glass, [0, 0.97, -0.86]);
  for (const sx of [-1, 1]) {
    part(car, P.createBox(0.04, 0.3, 0.5), glass, [sx * 0.68, 0.97, 0.08]);
    part(car, P.createBox(0.04, 0.3, 0.5), glass, [sx * 0.68, 0.97, -0.5]);
    part(car, P.createBox(0.02, 0.05, 0.7), red, [sx * 0.731, 0.56, -0.42]);
    part(car, P.createBox(0.02, 0.04, 0.7), orange, [sx * 0.731, 0.5, -0.42]);
    part(car, P.createCylinder(0.12, 0.03, 16), white, [sx * 0.735, 0.53, -0.02], [0, 0, 90]);
    part(car, P.createCylinder(0.14, 0.05, 12), grey, [sx * 0.48, 0.6, 1.15], [90, 0, 0]);
    part(car, P.createCylinder(0.11, 0.07, 12), lamp, [sx * 0.48, 0.6, 1.16], [90, 0, 0]);
    part(car, P.createCylinder(0.07, 0.1, 10), lamp, [sx * 0.3, 1.24, 0.0]);
    // 後照鏡
    part(car, P.createBox(0.12, 0.08, 0.06), grey, [sx * 0.74, 0.86, 0.32]);
  }
  part(car, P.createBox(1.55, 0.14, 0.17), grey, [0, 0.33, 1.2]);
  part(car, P.createBox(1.55, 0.14, 0.17), grey, [0, 0.33, -1.2]);
  part(car, P.createBox(0.5, 0.12, 0.03), dark, [0, 0.5, 1.16]);
  part(car, P.createBox(1.15, 0.04, 0.1), grey, [0, 1.18, 0.0]);
  part(car, P.createBox(1.15, 0.04, 0.1), grey, [0, 1.18, -0.5]);
  // 輪子：黑輪胎、灰輪轂、胎面一圈短釘；放在四個角，比例上大一點（玩具車）
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const wheel = new Laya.Sprite3D('wheel');
      wheel.transform.localPosition = new Laya.Vector3(sx * 0.66, 0.3, sz * 0.78);
      car.addChild(wheel);
      part(wheel, P.createCylinder(0.3, 0.26, 16), tyre, [0, 0, 0], [0, 0, 90]);
      part(wheel, P.createCylinder(0.17, 0.28, 12), hub, [0, 0, 0], [0, 0, 90]);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        part(wheel, P.createCone(0.028, 0.06, 6), grey, [sx * 0.06, Math.sin(a) * 0.315, Math.cos(a) * 0.315], [(a * 180) / Math.PI - 90 + 180, 0, 0]);
      }
    }
  return car;
}

/** 粉紫色格子地板的貼圖（size×size，cells×cells 格）。 */
function checkerTexture(size: number, cells: number, a: string, b: string) {
  const ca = hex(a), cb = hex(b), data = new Uint8Array(size * size * 4), cell = size / cells;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const c = (Math.floor(x / cell) + Math.floor(y / cell)) % 2 ? ca : cb;
      data.set([Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255), 255], (y * size + x) * 4);
    }
  const tex = new Laya.Texture2D(size, size, Laya.TextureFormat.R8G8B8A8, true, false, true);
  tex.setPixelsData(data, false, false);
  return tex;
}

export const stickmanGarage: ScenePreset = {
  id: 'stickman-garage',
  title: '囂張小黑人在車庫：站在車旁',
  summary: '一台低模小車停在停車格裡，車旁站著囂張小黑人，播兩段 idle、自己 crossfade 輪播；?models= 可以並排放幾個不同版本比較。',
  modules: ['3d/stickman', '3d/day-look', '3d/math'],
  views: { 車庫: '' },
  async start(container, params) {
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    const context = await ZhudaEngine.boot({ container, width, height, dprCap: Number(params.get('dpr')) || 1.5, features: ['core', '3d', 'gltf', 'postProcess'], bgColor: '#8e86c4' });
    const scene = Zhuda3D.createScene3D(context.rootScene);
    const camera = Zhuda3D.createCamera(scene, { position: [0, 2, 8], rotationEuler: [0, 0, 0], fov: Number(params.get('fov')) || 30, near: 0.05, far: 200 });
    // 光：上方偏紫藍的天、地面反粉紅、太陽從左前方，柔和的影子；遠處的地板淡進粉紫色的霧（畫面上方紫藍、下方粉紅）。
    const sky = skyAt(10.5, { rain: 0, storm: 0, mist: 0 } as WeatherMix, 4, 0, 8, ['clouds', 'fog'], OCEAN).look;
    const look = new ZhudaSceneLook(
      scene,
      camera,
      {
        ...sky,
        sky: [0.56, 0.53, 0.77],
        atmosphere: false as const,
        ambient: [1.0, 0.96, 1.05],
        ambientGround: [0.95, 0.7, 0.8],
        sun: { azimuthDeg: -40, elevationDeg: 50, intensity: 0.85, color: [1, 0.97, 0.94] },
        shadows: { ...sky.shadows, strength: 0.45 },
        fog: { color: [0.7, 0.55, 0.72], start: 12, end: 45 },
        grade: { ...sky.grade, contrast: 1, saturation: 1.05, vignette: 0, grain: 0, bloom: 0.05 },
        lightFog: false as const,
      },
      { quality: 2, cameraPasses: { depth: true, opaque: true } },
    );

    const floor = new Laya.MeshSprite3D(Laya.PrimitiveMesh.createPlane(60, 60, 1, 1));
    floor.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: [1, 1, 1, 1], roughness: 0.92, metallic: 0, textures: { albedo: checkerTexture(1024, 40, '#c98aa3', '#bd7e98') } }) as Laya.Material;
    floor.meshRenderer.receiveShadow = true;
    scene.addChild(floor);
    // 停車格：四個白色的 L 形角
    const line = mat('#f4eef4', 0.8);
    const lot = new Laya.Sprite3D('lot');
    scene.addChild(lot);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        part(lot, Laya.PrimitiveMesh.createBox(0.7, 0.012, 0.08), line, [sx * 1.05 - sx * 0.35, 0.006, sz * 1.65]);
        part(lot, Laya.PrimitiveMesh.createBox(0.08, 0.012, 0.7), line, [sx * 1.05, 0.006, sz * 1.65 - sz * 0.35]);
      }
    const car = buildCar();
    car.transform.localRotationEuler = new Laya.Vector3(0, -5, 0);
    const carScale = Number(params.get('carScale')) || 1;
    car.transform.localScale = new Laya.Vector3(carScale, carScale, carScale);
    lot.addChild(car);
    lot.transform.localRotationEuler = new Laya.Vector3(0, 0, 0);

    // 小黑人：一個或幾個版本，站在車的右後方，排成一排，面向鏡頭。
    const urls = (params.get('models') ?? stickmanPath()).split(',').filter(Boolean);
    const labels = (params.get('labels') ?? '').split(',');
    const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 60_000 });
    const models = new ZhudaModelLibrary({ provider, timeoutMs: 60_000 });
    const orbit = { yaw: Number(params.get('yaw') ?? 0.55), pitch: Number(params.get('pitch') ?? 0.3), distance: Number(params.get('distance') ?? 7) };
    const target: V3 = [0.85, 0.6, 0.0];
    const eyeOf = (): V3 => [
      target[0] + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
      target[1] + Math.sin(orbit.pitch) * orbit.distance,
      target[2] + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
    ];
    // 站的位置：靠在車的右後方（像截圖上的草圖），往右一排。
    const spot = (i: number): V3 => [1.25 + i * 0.8, 0, -0.1 - i * 0.3];
    const people: { url: string; label: string; idles: StickmanIdles; triangles: number; repaired: number; clip: () => string | null }[] = [];
    for (const [i, url] of urls.entries()) {
      const model = await models.instantiate(url, { retries: 2 });
      scene.addChild(model.node);
      const at: V3 = spot(i);
      model.node.transform.localPosition = new Laya.Vector3(...at);
      const eye = eyeOf();
      // 每個人轉向鏡頭；?face=front 全部朝正前方（並排比較時兩個人朝同一個方向）。
      const turn = params.get('face') === 'front' ? 0 : (Math.atan2(eye[0] - at[0], eye[2] - at[2]) * 180) / Math.PI;
      model.node.transform.localRotationEuler = new Laya.Vector3(0, turn, 0);
      const report = new ZhudaModelInspector(model).inspect();
      let triangles = 0;
      for (const node of report.nodes) if (node.mesh) triangles += node.mesh.indices / 3;
      let animator: Laya.Animator | null = null;
      const walk = (n: Laya.Node) => {
        const s = n as Laya.Sprite3D;
        animator ??= s.getComponent?.(Laya.Animator) as Laya.Animator | null;
        const r = s.getComponent?.(Laya.BaseRender) as Laya.BaseRender | null;
        if (r) (r.castShadow = true), (r.receiveShadow = true);
        for (let k = 0; k < n.numChildren; k++) walk(n.getChildAt(k));
      };
      walk(model.node);
      if (!animator) throw Error(`${url} has no animator`);
      const anim = animator as Laya.Animator;
      const repaired = repairGltfCrossFade(anim);
      for (const name of STICKMAN_CLIPS) anim.getControllerLayer(0).getAnimatorState(name)!.clip!.islooping = true;
      const play = (clip: StickmanClip, fade: number) => {
        const playing = anim.getCurrentAnimatorPlayState(0)?.animatorState?.clip?.duration() ?? 0;
        const share = fadeShare(fade, playing);
        if (share > 0) anim.crossFade(clip, share, 0, 0);
        else anim.play(clip, 0, 0);
      };
      // 每個人從不同的段落開始、換段的輪數也不一樣，不會整齊劃一。
      let seed = 17 + i * 31;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      // ?hold=Idle_HandsOnHips：全部停在同一段、同時開始（並排比較同一個姿勢用）。
      const hold = (STICKMAN_CLIPS as readonly string[]).includes(params.get('hold') ?? '') ? (params.get('hold') as StickmanClip) : null;
      const idles = new StickmanIdles(play, { first: hold ?? (i % 2 ? 'Idle_ArmsCrossed' : 'Idle_HandsOnHips'), loops: [1, 3], random });
      if (hold) idles.hold(hold);
      // ?bind=1：不播動作，停在綁定姿勢（A 字手），比網格本身用。
      if (params.get('bind') === '1') anim.enabled = false;
      people.push({ url, label: labels[i] ?? '', idles, triangles, repaired, clip: () => anim.getCurrentAnimatorPlayState(0)?.animatorState?.name ?? null });
    }

    // 每個人頭上一行小字（有給 labels 才顯示），用鏡頭投影跟著頭。
    const tags = people.map((p) => {
      const d = document.createElement('div');
      d.textContent = p.label;
      d.style.cssText = 'position:absolute;transform:translate(-50%,-100%);padding:3px 8px;border-radius:7px;background:rgba(30,20,45,.6);color:#fff;font:12px/1.4 -apple-system,"PingFang TC",sans-serif;white-space:nowrap;pointer-events:none;z-index:4';
      if (p.label) container.appendChild(d);
      return d;
    });
    const placeTags = () => {
      people.forEach((p, i) => {
        if (!p.label) return;
        const at = [spot(i)[0], 1.42, spot(i)[2]];
        const v = new Laya.Vector4();
        camera.viewport.project(new Laya.Vector3(at[0], at[1], at[2]), camera.projectionViewMatrix, v);
        tags[i].style.left = `${(v.x / Laya.stage.width) * container.clientWidth}px`;
        tags[i].style.top = `${(v.y / Laya.stage.height) * container.clientHeight}px`;
      });
    };

    let drag: { x: number; y: number } | null = null;
    container.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
    window.addEventListener('pointerup', () => (drag = null));
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      orbit.yaw -= (e.clientX - drag.x) * 0.006;
      orbit.pitch = clamp(orbit.pitch + (e.clientY - drag.y) * 0.004, -0.05, 1.2);
      drag = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('wheel', (e) => (orbit.distance = clamp(orbit.distance * Math.exp(e.deltaY * 0.001), 2, 20)), { passive: true });
    window.addEventListener('resize', () => context.resize());

    let clock = 0, frames = 0;
    setSceneHook({
      ready: false,
      state: () => ({ clock: +clock.toFixed(3), people: people.map((p) => ({ url: p.url, label: p.label, triangles: p.triangles, repaired: p.repaired, clip: p.clip() })) }),
      set: (o: { yaw?: number; pitch?: number; distance?: number; target?: V3 }) => {
        if (o.target) target.splice(0, 3, ...o.target);
        if (o.yaw !== undefined) orbit.yaw = o.yaw;
        if (o.pitch !== undefined) orbit.pitch = o.pitch;
        if (o.distance !== undefined) orbit.distance = o.distance;
      },
      errors: () => context.renderer.errors.slice(0, 6),
    });
    const hook = Reflect.get(window, '__SCENE__') as { ready: boolean };
    context.runtime.start((dt: number) => {
      clock += dt;
      for (const p of people) p.idles.update(dt);
      const eye = eyeOf();
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0), false);
      look.update(eye, target, Number(params.get('fov')) || 30, Laya.stage.width / Math.max(1, Laya.stage.height), dt);
      placeTags();
      if (++frames === 30) hook.ready = true;
    });
  },
};
