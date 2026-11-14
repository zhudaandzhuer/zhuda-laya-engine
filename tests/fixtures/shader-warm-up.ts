// Real-draw fixture for scripts/verify-shader-warm-up.mjs: one scene with a
// look, mounted in three ways chosen by the page's query:
// - ?mode=record: every shader variant compiled while the scene is drawn at
//   each level of its look is listed (ZhudaShaderVariantRecorder);
// - ?mode=cold: the scene is drawn as a game draws it, and what the first
//   frame and each change of level compile and cost is measured;
// - ?mode=warm: the same, after zhudaWarmUpShaders has compiled the list the
//   record run made (handed over in window.__WARM_LIST__).
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__WARM__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300;
const mode = new URLSearchParams(location.search).get('mode') || 'cold';
let context: any;
let gl: WebGL2RenderingContext | null = null;
let device: any = null;

/** Shader instances LayaAir has made so far: one for each variant it really compiled. */
let instances = 0;
function countInstances() {
  const create = Laya.ShaderPass.createShaderInstance;
  Laya.ShaderPass.createShaderInstance = function (this: unknown, ...args: unknown[]) {
    instances++;
    return create.apply(this, args);
  };
}

/** Waits until the graphics card has done what was asked of it. */
async function settle() {
  if (gl) {
    gl.finish();
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  } else if (device?.queue?.onSubmittedWorkDone) await device.queue.onSubmittedWorkDone();
}

/** The frame as shown, top row first on both backends. */
function read() {
  if (gl) {
    const raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return pixels;
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const copy = canvas.getContext('2d', { willReadFrequently: true })!;
  copy.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy.getImageData(0, 0, W, H).data.buffer);
}
function png(pixels: Uint8Array) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const image = canvas.getContext('2d')!.createImageData(W, H);
  image.data.set(pixels);
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
/** Mean colour of each cell of a 24 by 15 grid over the frame. */
function grid(pixels: Uint8Array) {
  const cells: number[] = [];
  const cw = W / 24,
    ch = H / 15;
  for (let gy = 0; gy < 15; gy++)
    for (let gx = 0; gx < 24; gx++) {
      const sum = [0, 0, 0];
      for (let y = gy * ch; y < (gy + 1) * ch; y++)
        for (let x = gx * cw; x < (gx + 1) * cw; x++) {
          const i = (y * W + x) * 4;
          sum[0] += pixels[i];
          sum[1] += pixels[i + 1];
          sum[2] += pixels[i + 2];
        }
      cells.push(...sum.map((v) => +(v / (cw * ch)).toFixed(1)));
    }
  return cells;
}

/** One frame, timed to the end of the graphics card's work, with what it compiled. */
async function frame() {
  const before = instances,
    from = performance.now();
  Z.ZhudaEngine.flushRenderFrames(1);
  await settle();
  return { ms: +(performance.now() - from).toFixed(2), compiled: instances - before };
}
const median = (values: number[]) => [...values].sort((a, b) => a - b)[values.length >> 1];

function checker(size: number, a: number[], b: number[]) {
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const c = ((x >> 3) + (y >> 3)) % 2 ? a : b;
      pixels.set([c[0], c[1], c[2], 255], (y * size + x) * 4);
    }
  return pixels;
}

function build() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.3, 0.32, 0.36] });
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 2.2, 7],
    target: [0, 0.8, 0],
    fov: 50,
  });
  const owned: any[] = [];
  const keep = <T>(item: T) => (owned.push(item), item);
  const albedo = keep(
    Z.createSurfaceTexture(64, 64, checker(64, [200, 190, 170], [90, 80, 70]), 'color', {
      mipmap: true,
    }),
  );
  const normal = keep(
    Z.createSurfaceTexture(64, 64, checker(64, [140, 128, 255], [116, 128, 255]), 'normal', {
      mipmap: true,
    }),
  );
  // Materials that differ in what their shader is compiled with.
  const materials = {
    plain: keep(
      Z.createSurfaceMaterial({ type: 'pbr', color: [0.7, 0.7, 0.68, 1], roughness: 0.8 }),
    ),
    textured: keep(
      Z.createSurfaceMaterial({
        type: 'pbr',
        color: [1, 1, 1, 1],
        roughness: 0.6,
        textures: { albedo, normal },
      }),
    ),
    glowing: keep(
      Z.createSurfaceMaterial({
        type: 'pbr',
        color: [0.2, 0.2, 0.2, 1],
        emission: [1.2, 0.6, 0.2],
        roughness: 0.4,
      }),
    ),
    glass: keep(
      Z.createSurfaceMaterial({
        type: 'pbr',
        color: [0.4, 0.6, 0.9, 0.5],
        roughness: 0.2,
        blend: 'alpha',
      }),
    ),
    flat: keep(Z.createSurfaceMaterial({ type: 'unlit', color: [0.9, 0.3, 0.2, 1] })),
    coated: keep(
      Z.createSurfaceMaterial({
        type: 'physical',
        color: [0.5, 0.05, 0.05, 1],
        roughness: 0.5,
        clearCoat: 1,
        clearCoatRoughness: 0.1,
      }),
    ),
  };
  const place = (mesh: any, at: number[], material: any) => {
    const node = new Laya.MeshSprite3D(keep(mesh));
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = new Laya.Vector3(at[0], at[1], at[2]);
    scene.addChild(node);
    return node;
  };
  const box = (size: number[]) =>
    Z.Zhuda3D.createPrimitiveMesh('box', { width: size[0], height: size[1], depth: size[2] });
  const ball = () => Z.Zhuda3D.createPrimitiveMesh('sphere', { radius: 0.5 });
  place(box([30, 0.2, 30]), [0, -0.1, 0], materials.plain);
  const names = Object.keys(materials) as (keyof typeof materials)[];
  names.forEach((name, i) => place(ball(), [-3.75 + i * 1.5, 0.5, 0], materials[name]));
  names.forEach((name, i) =>
    place(box([0.7, 1.4, 0.7]), [-3.75 + i * 1.5, 0.7, -2.5], materials[name]),
  );
  // A lamp: a point light is one more thing a lit shader is compiled for.
  const lamp = new Laya.Sprite3D('lamp');
  scene.addChild(lamp);
  const light = lamp.addComponent(Laya.PointLightCom);
  light.color = new Laya.Color(1, 0.8, 0.5, 1);
  light.intensity = 2;
  light.range = 6;
  lamp.transform.position = new Laya.Vector3(0, 1.6, 1.5);
  return { scene, camera, owned };
}

const LOOK = {
  preset: 'day',
  shadows: { distance: 30, cascades: 2, resolution: 1024, softness: 'soft' },
  fog: { color: [0.7, 0.76, 0.8], start: 10, end: 60 },
  grade: { exposure: 1, bloom: 0.3, ao: 0.5, antialias: 'msaa' },
};
/** The levels the look is taken through after the first frame, in this order. */
const LEVELS = [2, 1, 0, 3];

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  out.mode = mode;
  context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: W,
    height: H,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
    preserveDrawingBuffer: true,
    bgColor: '#202428',
  });
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  else device = Laya.LayaGL.renderEngine.getDevice?.();
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
    shader: Z.zhudaShaderBackend(),
  };
  countInstances();
  const recorder = mode === 'record' ? new Z.ZhudaShaderVariantRecorder() : null;
  context.runtime.start(() => {});
  out.atBoot = instances;

  // The scene and its look are made, but nothing is drawn yet.
  const world = build();
  const look = new Z.ZhudaSceneLook(world.scene, world.camera, LOOK);
  out.beforeDraw = instances;

  if (mode === 'warm') {
    const list = (globalThis as any).__WARM_LIST__;
    // Behind a loading screen the scene is not drawn: a scene that is drawn
    // compiles what it shows as it goes, a frame at a time.
    world.scene.active = false;
    let frames = 0;
    const tick = () => frames++;
    Laya.systemTimer.frameLoop(1, out, tick);
    const from = performance.now();
    out.warmUp = await Z.zhudaWarmUpShaders(list, { budgetMs: 8 });
    out.warmUp.wallMs = +(performance.now() - from).toFixed(1);
    // The loading screen went on being drawn: frames passed while it compiled.
    out.warmUp.framesMeanwhile = frames;
    Laya.systemTimer.clear(out, tick);
    await settle();
    out.duringWarmUp = instances - out.beforeDraw;
    world.scene.active = true;
    // Asked again, everything is there already.
    out.again = await Z.zhudaWarmUpShaders(list, { budgetMs: 8 });
    // What a warm-up refuses or cannot find, without failing.
    out.otherBackend = await Z.zhudaWarmUpShaders({
      ...list,
      backend: list.backend === 'webgl' ? 'webgpu' : 'webgl',
    });
    out.notAList = await Z.zhudaWarmUpShaders({ version: 2 } as any);
    out.unknownShader = await Z.zhudaWarmUpShaders({
      version: 1,
      backend: list.backend,
      variants: [{ ...list.variants[0], shader: 'NoSuchShader' }],
    });
    const controller = new AbortController();
    controller.abort();
    out.aborted = await Z.zhudaWarmUpShaders(list, { signal: controller.signal }).then(
      () => 'resolved',
      (error: any) => String(error?.name),
    );
  }

  // The first frame, then steady frames.
  out.first = await frame();
  const steady = [];
  for (let i = 0; i < 6; i++) steady.push(await frame());
  out.steadyMs = median(steady.map((f) => f.ms));
  out.steadyCompiled = steady.reduce((n, f) => n + f.compiled, 0);
  // Each change of level: the frame that follows it, and the ones after.
  out.levels = [];
  for (const level of LEVELS) {
    look.setQuality(level);
    const switched = await frame();
    const next = await frame();
    const after = [];
    for (let i = 0; i < 4; i++) after.push(await frame());
    out.levels.push({
      level,
      ms: switched.ms,
      compiled: switched.compiled + next.compiled + after.reduce((n, f) => n + f.compiled, 0),
      steadyMs: median(after.map((f) => f.ms)),
    });
  }
  out.total = instances;
  // What the scene looks like at the end (level 3 again), and at the level without the HDR chain.
  Z.ZhudaEngine.flushRenderFrames(2);
  const last = read();
  out.grid = grid(last);
  out.picture = png(last);
  look.setQuality(0);
  Z.ZhudaEngine.flushRenderFrames(2);
  const low = read();
  out.gridLow = grid(low);
  out.pictureLow = png(low);
  look.setQuality(3);
  if (recorder) {
    out.recorded = recorder.count;
    out.list = recorder.list();
    // The same variants in another order give the same list.
    out.sortedAgain =
      JSON.stringify(Z.zhudaSortShaderVariants([...out.list.variants].reverse())) ===
      JSON.stringify(out.list.variants);
    out.listProblems = Z.validateZhudaShaderVariantList(out.list);
    // One recorder at a time; stopping gives LayaAir its own back.
    try {
      new Z.ZhudaShaderVariantRecorder();
      out.second = 'accepted';
    } catch (error) {
      out.second = String((error as Error).message);
    }
    recorder.stop();
    out.afterStop = {
      debugMode: Laya.Shader3D.debugMode,
      ownCollection: Laya.ShaderVariantCollection.active !== (recorder as any).collection,
    };
  }
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
