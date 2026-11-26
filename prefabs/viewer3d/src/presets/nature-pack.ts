// The nature pack laid out on a lawn, two rows of five, at their own size (only
// pieces wider than 2.2 m are shrunk to fit their spot), each named underneath.
// Drag to turn round them, wheel or pinch to come closer. ?hour= sets the time.
import { ZhudaEngine, Zhuda3D, ZhudaModelLibrary, ZhudaSceneLook, DirectoryAssetProvider, createSurfaceMaterial } from 'zhuda-laya-engine';
import { skyAt, OCEAN, type WeatherMix } from '../common/3d/day-look.ts';
import { NATURE_PACK, naturePath, type NatureId } from '../common/3d/nature-pack/nature-pack.ts';
import { clamp, type V3 } from '../common/3d/math.ts';
import { setSceneHook, type ScenePreset } from '../preset.ts';

const FOV = 40;

export const naturePack: ScenePreset = {
  id: 'nature-pack',
  title: '自然小物：十個掃描植物與石頭',
  summary: 'Poly Haven（CC0）掃描素材的遊戲版：蕨、灌木、蕁麻、苔、大中小石、長苔石組、樹樁。原本點綴浮島，任何戶外場景都能撒。',
  modules: ['3d/nature-pack', '3d/day-look', '3d/math'],
  views: { 白天: '', 黃昏: 'hour=18.2', 夜晚: 'hour=22' },
  async start(container, params) {
    const width = Number(params.get('width')) || window.innerWidth || 1280,
      height = Number(params.get('height')) || window.innerHeight || 720;
    container.style.position = 'relative';
    const context = await ZhudaEngine.boot({ container, width, height, dprCap: Number(params.get('dpr')) || 1.25, features: ['core', '3d', 'gltf', 'postProcess'], bgColor: '#9fb6d2' });
    const scene = Zhuda3D.createScene3D(context.rootScene);
    const camera = Zhuda3D.createCamera(scene, { position: [0, 4, 11], rotationEuler: [-16, 0, 0], fov: FOV, near: 0.1, far: 1500 });
    let hour = Number(params.get('hour') ?? 10);
    const calm: WeatherMix = { rain: 0, storm: 0, mist: 0 };
    const off = (params.get('off') || '').split(',');
    const look = new ZhudaSceneLook(scene, camera, skyAt(hour, calm, 9, 0, 8, off, OCEAN).look, { quality: 2, cameraPasses: { depth: true, opaque: true } });

    const lawn = new Laya.MeshSprite3D(Laya.PrimitiveMesh.createPlane(1200, 1200, 1, 1));
    lawn.meshRenderer.sharedMaterial = createSurfaceMaterial({ type: 'pbr', color: [0.34, 0.4, 0.24, 1], roughness: 0.95, metallic: 0 }) as Laya.Material;
    lawn.meshRenderer.receiveShadow = true;
    scene.addChild(lawn);

    const provider = new DirectoryAssetProvider({ baseUrl: './', timeoutMs: 120_000 });
    const models = new ZhudaModelLibrary({ provider, timeoutMs: 120_000 });
    const ids = Object.keys(NATURE_PACK) as NatureId[];
    const pieces = await Promise.all(ids.map((id) => models.instantiate(naturePath(id), { retries: 2 })));
    const spots: { id: NatureId; at: V3 }[] = [];
    ids.forEach((id, i) => {
      const { size } = NATURE_PACK[id];
      const s = Math.min(1, 2.2 / Math.max(size[0], size[2]));
      const at: V3 = [(i % 5) * 3.4 - 6.8, 0, i < 5 ? 0 : -4.4];
      const node = pieces[i].node;
      scene.addChild(node);
      node.transform.position = new Laya.Vector3(...at);
      if (s !== 1) node.transform.localScale = new Laya.Vector3(s, s, s);
      const shade = (n: Laya.Node) => {
        const r = (n as Laya.Sprite3D).getComponent?.(Laya.MeshRenderer) as Laya.MeshRenderer | null;
        if (r) (r.castShadow = true), (r.receiveShadow = true);
        for (let k = 0; k < n.numChildren; k++) shade(n.getChildAt(k));
      };
      shade(node);
      spots.push({ id, at });
    });

    // Names under each piece, kept in place on screen as the camera turns.
    const labels = spots.map(({ id }) => {
      const tag = document.createElement('div');
      tag.innerHTML = `${NATURE_PACK[id].what}<br><span style="opacity:.7">${id}</span>`;
      tag.style.cssText = 'position:absolute;transform:translate(-50%,0);padding:2px 8px;border-radius:8px;background:rgba(20,26,34,.55);color:#fff;font:11px/1.35 -apple-system,"PingFang TC",sans-serif;text-align:center;white-space:nowrap;pointer-events:none;z-index:4';
      container.appendChild(tag);
      return tag;
    });

    const orbit = { yaw: 0, pitch: 0.42, distance: 13 };
    const target: V3 = [0, 0.3, -2.2];
    let drag: { x: number; y: number } | null = null;
    container.addEventListener('pointerdown', (e) => (drag = { x: e.clientX, y: e.clientY }));
    window.addEventListener('pointerup', () => (drag = null));
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      orbit.yaw -= (e.clientX - drag.x) * 0.006;
      orbit.pitch = clamp(orbit.pitch + (e.clientY - drag.y) * 0.004, 0.05, 1.3);
      drag = { x: e.clientX, y: e.clientY };
    });
    container.addEventListener('wheel', (e) => (orbit.distance = clamp(orbit.distance * Math.exp(e.deltaY * 0.001), 3, 40)), { passive: true });
    window.addEventListener('resize', () => context.resize());

    let frames = 0,
      skyTimer = 0;
    setSceneHook({
      ready: false,
      state: () => ({ hour, pieces: ids.length, quality: look.quality }),
      set: (o: { hour?: number; yaw?: number; pitch?: number; distance?: number }) => {
        if (o.hour !== undefined) hour = o.hour;
        if (o.yaw !== undefined) orbit.yaw = o.yaw;
        if (o.pitch !== undefined) orbit.pitch = o.pitch;
        if (o.distance !== undefined) orbit.distance = o.distance;
        skyTimer = 0;
      },
      errors: () => context.renderer.errors.slice(0, 6),
    });
    const hook = Reflect.get(window, '__SCENE__') as { ready: boolean };
    const point = new Laya.Vector4();
    context.runtime.start((dt: number) => {
      skyTimer -= dt;
      if (skyTimer <= 0) (skyTimer = 0.5), look.setLook(skyAt(hour, calm, orbit.distance, 0, 8, off, OCEAN).look);
      const eye: V3 = [
        target[0] + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
        target[1] + Math.sin(orbit.pitch) * orbit.distance,
        target[2] + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * orbit.distance,
      ];
      camera.transform.position = new Laya.Vector3(...eye);
      camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0), false);
      look.update(eye, target, FOV, Laya.stage.width / Math.max(1, Laya.stage.height), dt);
      const rect = container.getBoundingClientRect();
      spots.forEach(({ at }, i) => {
        camera.worldToViewportPoint(new Laya.Vector3(at[0], at[1], at[2] + 1.3), point);
        labels[i].style.left = `${(point.x / Laya.stage.width) * rect.width}px`;
        labels[i].style.top = `${(point.y / Laya.stage.height) * rect.height}px`;
        labels[i].style.display = point.z > 0 && point.z < 1 ? '' : 'none';
      });
      if (++frames === 30) hook.ready = true;
    });
  },
};
