// Real-draw fixture for scripts/verify-grass.mjs: a field of grass
// (ZhudaGrassField) on bare earth under a game's look, with a road nothing
// grows on and a box that throws a shadow.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__GRASS__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 960,
  H = 540,
  FOV = 50;
let context: any;
let gl: WebGLRenderingContext | null = null;
let copy: CanvasRenderingContext2D | null = null;

/** The frame, top row first on both backends. */
function read() {
  if (gl) {
    const raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return pixels;
  }
  copy!.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy!.getImageData(0, 0, W, H).data.buffer);
}
// Grass, fresh or dry, has more green than red; the earth and the box have not.
const isGreen = (p: Uint8Array, i: number) => p[i + 1] > p[i] * 1.03 && p[i + 1] > p[i + 2] * 1.3;
const lum = (p: Uint8Array, i: number) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
/** The share of green pixels in a rectangle of the frame (x and y as shares of it). */
const green = (p: Uint8Array, x0: number, x1: number, y0: number, y1: number) => {
  let n = 0,
    g = 0;
  for (let y = Math.round(y0 * H); y < Math.round(y1 * H); y++)
    for (let x = Math.round(x0 * W); x < Math.round(x1 * W); x++, n++)
      if (isGreen(p, (y * W + x) * 4)) g++;
  return +(g / n).toFixed(3);
};
const meanAbsDiff = (a: Uint8Array, b: Uint8Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 4) s += Math.abs(lum(a, i) - lum(b, i));
  return +(s / (a.length / 4)).toFixed(3);
};

const AREA = { minX: -70, maxX: 70, minZ: -110, maxZ: 40 };
// A road 3 m wide along z at x = -6: nothing grows on it.
const grows = (x: number) => Math.abs(x + 6) > 1.5;
const VIEWS: Record<string, [number[], number[]]> = {
  // Walking height, looking a little down the field past the box.
  walk: [
    [0, 1.5, 10],
    [1.5, 0.6, -6],
  ],
  // Level with the horizon: the far grass and where it ends.
  far: [
    [0, 1.5, 10],
    [0, 1.5, -20],
  ],
  // A small animal's height, into the blades.
  low: [
    [0.4, 0.45, 10],
    [0.6, 0.3, 6],
  ],
  // At the feet.
  down: [
    [0, 1.5, 10],
    [0.3, 0, 8.6],
  ],
  // Along the road.
  road: [
    [-6, 1.5, 10],
    [-6, 0.4, -4],
  ],
};

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
  if (renderer === 'webgl')
    gl = context.canvas.getContext('webgl2') || context.canvas.getContext('webgl');
  else {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    copy = canvas.getContext('2d', { willReadFrequently: true });
  }
  context.runtime.start(() => {});

  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 1.5, 10],
    rotationEuler: [0, 0, 0],
  });
  camera.fieldOfView = FOV;
  camera.nearPlane = 0.05;
  camera.farPlane = 600;
  const owned: any[] = [];
  const box = (size: number[], at: number[], color: number[]) => {
    const material = Z.createSurfaceMaterial({
      type: 'pbr',
      color: [...color, 1],
      roughness: 0.95,
    });
    const mesh = Z.Zhuda3D.createPrimitiveMesh('box', {
      width: size[0],
      height: size[1],
      depth: size[2],
    });
    owned.push(material, mesh);
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.receiveShadow = true;
    node.meshRenderer.castShadow = true;
    node.transform.position = new Laya.Vector3(at[0], at[1], at[2]);
    scene.addChild(node);
    return node;
  };
  box([600, 0.2, 600], [0, -0.1, 0], [0.3, 0.22, 0.15]);
  const caster = box([1.6, 1.6, 1.6], [2.5, 0.8, 1], [0.6, 0.58, 0.55]);
  const look = new Z.ZhudaSceneLook(scene, camera, {
    sky: [0.5, 0.66, 0.9],
    ambient: [0.62, 0.68, 0.78],
    ambientGround: [0.3, 0.27, 0.2],
    sun: { elevationDeg: 38, azimuthDeg: 135, intensity: 1.25, color: [1, 0.95, 0.86] },
    shadows: true,
    fog: false,
    grade: { exposure: 1, contrast: 1, saturation: 1, bloom: 0, ao: 0.5 },
  });
  let view = VIEWS.walk,
    seconds = 0;
  let field: any = null;
  const eye = () => view[0];
  const frame = (frames = 2) => {
    camera.transform.position = new Laya.Vector3(...view[0]);
    camera.transform.lookAt(new Laya.Vector3(...view[1]), new Laya.Vector3(0, 1, 0));
    for (let i = 0; i < frames; i++) {
      look.update(view[0], view[1], FOV, W / H, 1 / 60);
      Z.ZhudaEngine.flushRenderFrames(1);
    }
    return read();
  };
  const plant = (more: any = {}) =>
    new Z.ZhudaGrassField(scene, {
      area: AREA,
      ground: () => 0,
      grows,
      ...more,
    });
  const r: any = {};

  const bare = frame();
  // Counted after a frame: the look makes its render targets on the first.
  r.resourcesBefore = Z.inspectSceneResources().resources;
  r.bare = green(bare, 0, 1, 0.55, 1);

  field = plant();
  field.fill(eye(), 0);
  r.stats = field.stats;
  const first = frame();
  r.near = green(first, 0, 1, 0.6, 1);
  // The same time draws the same picture; another time moves the blades.
  r.sameTime = meanAbsDiff(first, frame());
  field.update(eye(), 0.9);
  const later = frame();
  r.wind = meanAbsDiff(first, later);
  field.setWind({ strength: 0 });
  field.update(eye(), 0);
  const still = frame();
  field.update(eye(), 0.9);
  r.noWind = meanAbsDiff(still, frame());
  field.setWind({ strength: 0.35 });
  field.update(eye(), 0);

  // The box's shadow lies on the grass.
  caster.meshRenderer.castShadow = false;
  const unshaded = frame();
  caster.meshRenderer.castShadow = true;
  const shaded = frame();
  let darker = 0;
  for (let i = 0; i < shaded.length; i += 4)
    if (isGreen(unshaded, i) && lum(shaded, i) < lum(unshaded, i) * 0.75) darker++;
  r.shadowedGrass = +(darker / (W * H)).toFixed(4);

  // Level with the horizon: grass up to where it ends, earth beyond.
  view = VIEWS.far;
  field.fill(eye(), 0);
  const far = frame();
  // 60 m off is about 15 rows under the horizon in this frame.
  // Measured to the right of the box, clear of it and of the road.
  r.farCover = green(far, 0.78, 0.99, 0.5 + 30 / H, 0.5 + 90 / H);
  r.beyond = green(far, 0.78, 0.99, 0.5 + 2 / H, 0.5 + 9 / H);

  // Nothing on the road.
  view = VIEWS.road;
  field.fill(eye(), 0);
  const road = frame();
  r.road = green(road, 0.47, 0.53, 0.7, 1);
  r.besideRoad = green(road, 0.05, 0.25, 0.55, 0.75);

  // Running 80 m at 6 m a second, sixty frames a second: patches are made a
  // few a frame and dropped behind.
  view = VIEWS.walk;
  field.fill(eye(), 0);
  const start = field.stats;
  let mostPending = 0,
    mostPatches = 0,
    mostMissing = 0;
  for (let step = 1; step <= 800; step++) {
    const at = [0, 1.5, 10 - step * 0.1];
    const pending = field.update(at, step / 60);
    mostPending = Math.max(mostPending, pending);
    mostPatches = Math.max(mostPatches, field.stats.patches);
    if (step % 100 === 0) {
      // What the run has made against what a field made here at once has.
      const walked = field.stats.blades;
      const fresh = plant();
      fresh.fill(at, 0);
      mostMissing = Math.max(mostMissing, 1 - walked / fresh.stats.blades);
      fresh.dispose();
    }
  }
  field.fill([0, 1.5, -70], 0);
  const walkedEnd = field.stats;
  const fresh = plant();
  fresh.fill([0, 1.5, -70], 0);
  r.walk = {
    start,
    mostPending,
    mostPatches,
    mostMissing: +mostMissing.toFixed(3),
    end: walkedEnd,
    fresh: fresh.stats,
  };
  fresh.dispose();

  // A second field of other colours shares the shader.
  const autumn = plant({
    area: { minX: -70, maxX: -8, minZ: -110, maxZ: 40 },
    tip: [0.75, 0.55, 0.2],
    root: [0.3, 0.18, 0.08],
    seed: 9,
  });
  autumn.dispose();

  r.invalid = (() => {
    try {
      plant({ density: 5 });
      return 'accepted';
    } catch (error: any) {
      return String(error.message);
    }
  })();
  field.dispose();
  r.afterUse = (() => {
    try {
      field.update([0, 0, 0], 0);
      return 'accepted';
    } catch (error: any) {
      return String(error.message);
    }
  })();
  view = VIEWS.walk;
  r.afterDispose = green(frame(), 0, 1, 0.6, 1);
  r.resourcesAfter = Z.inspectSceneResources().resources;

  // For pictures: the script asks for a view and takes a screenshot.
  field = plant();
  out.show = (name: string, time = 0.4, options?: any) => {
    if (options) {
      field.dispose();
      field = plant(options);
    }
    view = VIEWS[name];
    field.fill(eye(), time);
    frame(3);
    return field.stats;
  };
  out.grass = r;
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
