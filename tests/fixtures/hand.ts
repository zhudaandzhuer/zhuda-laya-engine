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
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.2, 0.2, 0.21] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0.07, 0.62] });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  // A light grey ground, as hands are photographed.
  camera.clearColor = new Laya.Color(0.62, 0.62, 0.64, 1);
  camera.nearPlane = 0.05;
  camera.farPlane = 5;
  const film = new Z.ZhudaFilmicPipeline(camera, { bloom: false });
  const light = (color: V, intensity: number, from: V) => {
    const l = Z.Zhuda3D.createDirectionalLight(scene, { color: [...color, 1], intensity });
    l.node.transform.position = v3(from);
    l.node.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    return l;
  };
  // A soft key with its shadow (the fingers shade each other), a cool fill, a warm rim.
  const key = light([1, 0.96, 0.9], 1.7, [-0.6, 0.9, 1]);
  key.light.shadowMode = Laya.ShadowMode.SoftHigh;
  key.light.shadowDistance = 1.2;
  key.light.shadowResolution = 4096;
  key.light.shadowStrength = 0.75;
  const fill = light([0.78, 0.84, 1], 0.55, [1, 0.1, 0.6]);
  const rim = light([1, 0.95, 0.9], 1.1, [0.5, 0.6, -1]);

  // The engine's own skin and nail surfaces for a made hand.
  const surfaces = Z.createZhudaHandSurfaces({ name: 'ZhudaFixtureHand' });
  const skin = new Z.ZhudaLitSurfaceMaterial(surfaces.skin);
  const nail = new Z.ZhudaLitSurfaceMaterial(surfaces.nail);
  const made: any[] = [];
  const build = (options: any) => {
    const t = performance.now();
    const hand = Z.createZhudaHandMesh({ ...options, forearm: 0.1 });
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
        mesh.node.meshRenderer.castShadow = true;
        mesh.node.meshRenderer.receiveShadow = true;
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
  type View = { turn: V; lights?: V; eye?: V; look?: V; fov?: number };
  const relaxed: Record<string, View> = {
    'three-quarter': { turn: [-15, 35, 0] },
    'thumb-side': { turn: [0, 90, 0] },
    'back-relaxed': { turn: [0, 0, 0] },
  };
  const flat: Record<string, View> = {
    'back-flat': { turn: [0, 0, 0] },
    'palm-flat': { turn: [0, 180, 0] },
    'nails-close': { turn: [-20, 0, 0], eye: [0, 0.19, 0.22], look: [0, 0.14, 0], fov: 26 },
  };
  const hands: Record<string, any> = { male: Z.ZHUDA_HAND_MALE, female: Z.ZHUDA_HAND_FEMALE };
  out.views = {};
  out.tips = {};
  const order: string[] = [];
  for (const [who, preset] of Object.entries(hands))
    for (const [pose, views] of [
      [who === 'female' ? Z.ZHUDA_HAND_GRACEFUL : Z.ZHUDA_HAND_RELAXED, relaxed],
      [Z.ZHUDA_HAND_FLAT, flat],
    ] as const) {
      // Let the page answer between hands: making one holds the thread for several seconds.
      await new Promise((resolve) => setTimeout(resolve, 50));
      const current = build({ ...preset, pose });
      await new Promise((resolve) => setTimeout(resolve, 50));
      out.tips[`${who}-${pose === Z.ZHUDA_HAND_FLAT ? 'flat' : 'relaxed'}`] = current.tips;
      for (const [name, view] of Object.entries(views)) {
        current.root.transform.rotationEuler = v3(view.turn);
        // The skin's fine pattern in the hand's own space, wherever the hand is turned.
        Z.setZhudaHandSkinSpace(skin, current.root.transform.worldMatrix.elements);
        const eye = view.eye ?? [0, 0.07, 0.62],
          look = view.look ?? [0, 0.07, 0];
        camera.fieldOfView = view.fov ?? 24;
        camera.transform.position = v3(eye);
        camera.transform.lookAt(v3(look), v3([0, 1, 0]));
        const [k, f, r] = view.lights ?? [1.7, 0.5, 1.0];
        key.light.intensity = k;
        fill.light.intensity = f;
        rim.light.intensity = r;
        flush(4);
        const id = `${who}-${name}`;
        keep(id);
        order.push(id);
        out.views[id] = { ms: current.ms, vertices: current.vertices, covered: covered() };
      }
      current.root.destroy(true);
      for (const m of made.splice(0)) m.destroy?.();
    }
  // Every view on one sheet, at half size, a row a hand: the picture to look at first.
  {
    const cols = 6,
      rows = Math.ceil(order.length / cols);
    const sheet = document.createElement('canvas');
    sheet.width = (W / 2) * cols;
    sheet.height = (H / 2) * rows;
    const c = sheet.getContext('2d')!;
    await Promise.all(
      order.map(
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
  film.dispose();
  skin.dispose();
  nail.dispose();
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
