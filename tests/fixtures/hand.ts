// Real-draw fixture for scripts/verify-hand.mjs: a hand made from numbers
// (createZhudaHandMesh) drawn with the lit surface's skin, from the back,
// the palm, the side and against the light, relaxed and flat.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__HAND__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 640,
  H = 800;
let context: any;
const saved: Record<string, string> = {};
const keep = (name: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.drawImage(context.canvas, 0, 0, W, H);
  saved[name] = canvas.toDataURL('image/png');
};
out.picture = (name: string) => saved[name];
out.pictures = () => Object.keys(saved);
const flush = (frames = 3) => Z.ZhudaEngine.flushRenderFrames(frames);
type V = number[];
const v3 = (a: V) => new Laya.Vector3(a[0], a[1], a[2]);
/** How many pixels are not the background: the hand's size on the screen. */
function covered(): number {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(context.canvas, 0, 0, W, H);
  const p = c.getImageData(0, 0, W, H).data;
  const bg = [p[0], p[1], p[2]];
  let n = 0;
  for (let i = 0; i < p.length; i += 4)
    if (Math.abs(p[i] - bg[0]) + Math.abs(p[i + 1] - bg[1]) + Math.abs(p[i + 2] - bg[2]) > 24) n++;
  return n;
}

const SKIN = `void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  s.baseColor *= s.vertexColor.rgb;
  s.thickness = s.vertexColor.a;
  vec3 q = u_ZhudaHandSpace.xyz + p;
  // Fine grain of the skin: a little roughness and a faint tilt, never a pattern.
  float grain = zhudaFbm(q * 2200.0);
  s.roughness = clamp(0.5 + (grain - 0.5) * 0.25, 0.3, 0.75);
  s.normalTS = normalize(vec3(zhudaNoise(q * 1800.0) - 0.5, zhudaNoise(q.yzx * 1800.0) - 0.5, 3.2));
}`;
const NAIL = `void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  s.baseColor *= s.vertexColor.rgb;
  s.roughness = 0.18;
}`;

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: W,
    height: H,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
    preserveDrawingBuffer: true,
  });
  flush(2);
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.16, 0.16, 0.18] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0.07, 0.62] });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0.11, 0.115, 0.125, 1);
  camera.fieldOfView = 24;
  camera.nearPlane = 0.05;
  camera.farPlane = 5;
  camera.transform.position = v3([0, 0.07, 0.62]);
  camera.transform.lookAt(v3([0, 0.07, 0]), v3([0, 1, 0]));
  const film = new Z.ZhudaFilmicPipeline(camera, { bloom: false });
  const light = (color: V, intensity: number, from: V) => {
    const l = Z.Zhuda3D.createDirectionalLight(scene, { color: [...color, 1], intensity });
    l.node.transform.position = v3(from);
    l.node.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    return l;
  };
  const key = light([1, 0.96, 0.9], 2.2, [-0.6, 0.8, 1]);
  const fill = light([0.75, 0.82, 1], 0.45, [1, 0.1, 0.6]);
  const rim = light([1, 0.95, 0.9], 1.2, [0.5, 0.6, -1]);

  const skin = new Z.ZhudaLitSurfaceMaterial({
    name: 'ZhudaFixtureHandSkin',
    common: true,
    material: { roughness: 0.5, metallic: 0 },
    subsurface: { color: [1, 0.3, 0.2], wrap: 0.45, back: 1.6, power: 3, distortion: 0.25 },
    uniforms: { u_ZhudaHandSpace: { type: 'vec4', value: [0, 0, 0, 0] } },
    surface: SKIN,
  });
  const nail = new Z.ZhudaLitSurfaceMaterial({
    name: 'ZhudaFixtureHandNail',
    material: { roughness: 0.18, metallic: 0 },
    subsurface: { color: [1, 0.45, 0.4], wrap: 0.3 },
    surface: NAIL,
  });
  const made: any[] = [];
  const build = (pose: any) => {
    const t = performance.now();
    const hand = Z.createZhudaHandMesh({ pose, forearm: 0.1 });
    const ms = Math.round(performance.now() - t);
    const root = new Laya.Sprite3D('hand');
    scene.addChild(root);
    for (const [part, material] of [
      ['skin', skin],
      ['nails', nail],
    ] as const) {
      for (const data of part === 'skin' ? hand.skin : [hand.nails]) {
        const mesh = new Z.ZhudaDynamicMesh(data, scene);
        made.push(mesh);
        mesh.node.meshRenderer.sharedMaterial = material.material;
        root.addChild(mesh.node);
      }
    }
    return {
      root,
      ms,
      vertices: {
        skin: hand.skin.reduce((n: number, c: any) => n + c.positions.length / 3, 0),
        chunks: hand.skin.length,
        nails: hand.nails.positions.length / 3,
      },
      tips: hand.tips,
    };
  };
  type View = { pose: any; turn: V; lights?: V; eye?: V; look?: V; fov?: number };
  const views: Record<string, View> = {
    'back-relaxed': { pose: undefined, turn: [0, 0, 0] },
    'palm-relaxed': { pose: undefined, turn: [0, 180, 0] },
    'thumb-side': { pose: undefined, turn: [0, 90, 0] },
    'three-quarter': { pose: undefined, turn: [-15, 35, 0] },
    'back-flat': { pose: Z.ZHUDA_HAND_FLAT, turn: [0, 0, 0] },
    'palm-flat': { pose: Z.ZHUDA_HAND_FLAT, turn: [0, 180, 0] },
    'against-light': { pose: Z.ZHUDA_HAND_FLAT, turn: [0, 180, 0], lights: [0.15, 0.25, 3] },
    'nails-close': {
      pose: Z.ZHUDA_HAND_FLAT,
      turn: [-20, 0, 0],
      eye: [0, 0.2, 0.22],
      look: [0, 0.15, 0],
      fov: 24,
    },
  };
  out.views = {};
  let current: any = null;
  let currentPose: any = 'none';
  for (const [name, view] of Object.entries(views)) {
    if (currentPose !== view.pose) {
      if (current) {
        current.root.destroy(true);
        for (const m of made.splice(0)) m.destroy?.();
      }
      current = build(view.pose);
      currentPose = view.pose;
    }
    current.root.transform.rotationEuler = v3(view.turn);
    const eye = view.eye ?? [0, 0.07, 0.62],
      look = view.look ?? [0, 0.07, 0];
    camera.fieldOfView = view.fov ?? 24;
    camera.transform.position = v3(eye);
    camera.transform.lookAt(v3(look), v3([0, 1, 0]));
    const [k, f, r] = view.lights ?? [2.2, 0.45, 1.2];
    key.light.intensity = k;
    fill.light.intensity = f;
    rim.light.intensity = r;
    flush(4);
    keep(name);
    out.views[name] = { ms: current.ms, vertices: current.vertices, covered: covered() };
  }
  // Every view on one sheet, at half size: the picture to look at first.
  {
    const names = Object.keys(views);
    const cols = 4,
      rows = Math.ceil(names.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = (W / 2) * cols;
    sheet.height = (H / 2) * rows;
    const c = sheet.getContext('2d')!;
    await Promise.all(
      names.map(
        (name, i) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.onload = () => {
              c.drawImage(
                image,
                (i % cols) * (W / 2),
                Math.floor(i / cols) * (H / 2),
                W / 2,
                H / 2,
              );
              resolve();
            };
            image.src = saved[name];
          }),
      ),
    );
    saved.sheet = sheet.toDataURL('image/png');
  }
  out.tips = current?.tips;
  current?.root.destroy(true);
  for (const m of made.splice(0)) m.destroy?.();
  film.dispose();
  skin.dispose();
  nail.dispose();
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
