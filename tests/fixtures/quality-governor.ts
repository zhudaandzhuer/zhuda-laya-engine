// Real-draw fixture for scripts/verify-quality-governor.mjs: a game's look
// (ZhudaSceneLook) on a ladder with detail rungs, walked by
// ZhudaQualityGovernor on frames forced slow and then fast, each rung applied
// to the look and to the scene's own far row of pillars through `detail`;
// then the same governor fed GPU times (ZhudaRuntimeProfiler.takeGpuMs), and
// ZhudaQualityMemory with its load sentinel in the page's localStorage.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__GOV__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 270;
let context: any;
let gl: WebGL2RenderingContext | null = null;
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

/** Clearly red pixels: the pillars, nothing else in the scene is red. */
const red = (p: Uint8Array, x0 = 0, x1 = W) => {
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (p[i] > 90 && p[i] > 2.2 * Math.max(p[i + 1], p[i + 2])) n++;
    }
  return n;
};
/** Red in the middle 30 columns: only the pillars beyond about 50 m stand there. */
const farRed = (p: Uint8Array) => red(p, W / 2 - 15, W / 2 + 15);

const saved: Record<string, Uint8Array> = {};
out.picture = (name: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const image = canvas.getContext('2d')!.createImageData(W, H);
  image.data.set(saved[name]);
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
};

/** The pillars stand from 8 to 120 m; the scene keeps those within 120 m times `detail`. */
const REACH = 120;

function build() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 1.7, 6], rotationEuler: [0, 0, 0] });
  camera.fieldOfView = 50;
  camera.nearPlane = 0.1;
  camera.farPlane = 400;
  camera.transform.lookAt(new Laya.Vector3(0, 1.5, -40), new Laya.Vector3(0, 1, 0));
  const owned: any[] = [];
  const paint = (rgb: number[]) => {
    const material = Z.Zhuda3D.createMaterial({ type: 'pbr', albedoColor: [...rgb, 1] });
    material.smoothness = 0.2;
    owned.push(material);
    return material;
  };
  const grey = paint([0.5, 0.5, 0.48]),
    ground = paint([0.32, 0.34, 0.3]),
    pillar = paint([0.85, 0.06, 0.04]);
  const box = (size: number[], at: number[], material: any) => {
    const mesh = Z.Zhuda3D.createPrimitiveMesh('box', {
      width: size[0],
      height: size[1],
      depth: size[2],
    });
    owned.push(mesh);
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = new Laya.Vector3(at[0], at[1], at[2]);
    scene.addChild(node);
    return node;
  };
  box([400, 0.2, 400], [0, -0.1, -100], ground);
  for (let i = 0; i < 6; i++) box([1, 1 + (i % 3) * 0.5, 1], [-4 + i * 1.6, 0.5, 0], grey);
  // Two rows of pillars, every 8 m from 8 m out to 120 m from the eye.
  const pillars: { node: any; distance: number }[] = [];
  for (let d = 8; d <= REACH; d += 8)
    for (const x of [-3, 3]) {
      const z = 6 - d;
      pillars.push({ node: box([0.8, 6, 0.8], [x, 3, z], pillar), distance: d });
    }
  return {
    scene,
    camera,
    /** The scene's own use of `detail`: the pillars beyond its share of the reach are not drawn. */
    applyDetail(detail: number) {
      let shown = 0;
      for (const p of pillars) {
        p.node.active = p.distance <= REACH * detail;
        if (p.node.active) shown++;
      }
      return shown;
    },
    dispose() {
      scene.destroy(true);
      for (const item of owned) item.destroy();
    },
  };
}

const LOOK = {
  preset: 'day',
  shadows: { distance: 40, cascades: 2, resolution: 2048 },
  fog: false,
  grade: { exposure: 1, bloom: 0.2, ao: 0.5, antialias: 'msaa' },
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
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  else {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    copy = canvas.getContext('2d', { willReadFrequently: true });
  }
  context.runtime.start(() => {});
  const r: any = {};
  const steps = Z.zhudaQualitySteps({ details: [0.7, 0.4] });
  r.ladder = steps.map((s: any) => `${s.look}@${s.renderScale}/${s.detail}`);

  // Memory and the load sentinel, in this page's own localStorage.
  let storage: any = null;
  try {
    storage = localStorage;
  } catch {
    // No storage: the memory keeps nothing and every start is the default.
  }
  const memory = new Z.ZhudaQualityMemory({ key: 'governor-check', storage, levels: steps.length });
  memory.clear();
  const start = memory.startLevel(steps.length - 1);
  memory.beginLoad();
  r.memory = { start, sentinelDuringLoad: memory.loadUnfinished };

  const world = build();
  const look = new Z.ZhudaSceneLook(world.scene, world.camera, LOOK);
  const flush = (frames: number) => Z.ZhudaEngine.flushRenderFrames(frames);
  /** Applies a rung to the look and to the scene, draws it and measures it. */
  const apply = (level: number, name?: string) => {
    const step = steps[level];
    look.setStep(step);
    const shown = world.applyDetail(step.detail);
    flush(2);
    const pixels = read();
    if (name) saved[name] = pixels;
    return {
      level,
      step: `${step.look}@${step.renderScale}/${step.detail}`,
      lookQuality: look.quality,
      pixelRatio: +Laya.Config3D.pixelRatio.toFixed(3),
      pillarsShown: shown,
      redPixels: red(pixels),
      farRedPixels: farRed(pixels),
    };
  };
  r.top = apply(start, 'top');
  memory.endLoad();
  r.memory.sentinelAfterFirstFrame = memory.loadUnfinished;

  const profiler = new Z.ZhudaRuntimeProfiler();
  const device = renderer === 'webgpu' ? Laya.LayaGL.renderEngine.getDevice() : null;
  if (device) profiler.attachWebGPU(device);
  else profiler.attach(gl);
  r.gpuTiming = profiler.enableGpuTiming(device ?? gl);
  r.gpuSource = profiler.report().sources.gpu;

  /** One frame: drawn, then the CPU held until `holdMs` have passed (a forced slow frame). */
  const frame = async (holdMs: number) => {
    const t0 = performance.now();
    profiler.beginFrame();
    flush(1);
    while (performance.now() - t0 < holdMs) {
      // Busy: the frame is slow because this script is.
    }
    const ms = performance.now() - t0;
    profiler.endFrame(ms, ms);
    await new Promise(requestAnimationFrame);
    return { ms, gpu: profiler.takeGpuMs() };
  };

  // 1. The CPU rule: frames held to 40 ms against a 16.7 ms budget walk the
  // ladder down one rung a window; frames of a few milliseconds walk it back.
  const cpu = new Z.ZhudaQualityGovernor({
    levels: steps.length,
    start,
    budgetMs: 16.7,
    window: 6,
    calmSeconds: 0.05,
    maxCalmSeconds: 1,
  });
  const walk = async (governor: any, holdMs: number, until: number, withGpu: boolean) => {
    const rungs: any[] = [];
    const bases = new Set<string>();
    for (let i = 0; i < 1200 && governor.level !== until; i++) {
      const f = await frame(holdMs);
      const level = governor.sample(f.ms, withGpu ? f.gpu : undefined);
      if (governor.basis) bases.add(governor.basis);
      if (level !== undefined) {
        const rung = apply(level, `level-${level}`);
        memory.write({ level, renderScale: steps[level].renderScale, detail: steps[level].detail });
        rungs.push(rung);
      }
    }
    return { rungs, bases: [...bases], reached: governor.level === until };
  };
  r.down = await walk(cpu, 40, 0, false);
  r.memory.keptAtBottom = memory.read();
  r.up = await walk(cpu, 0, steps.length - 1, false);
  saved.back = read();
  r.backRed = red(saved.back);
  r.backFarRed = farRed(saved.back);

  // 2. GPU times: what this GPU takes for the top rung, then a governor whose
  // budget is half of it (so the top rung is far above the band) walks down
  // on GPU times until a rung fits; frames held slow by the CPU do not move
  // a governor whose GPU times sit inside its band.
  const gpuTimes: number[] = [];
  for (let i = 0; i < 40; i++) {
    const f = await frame(0);
    if (f.gpu !== undefined) gpuTimes.push(f.gpu);
  }
  gpuTimes.sort((a, b) => a - b);
  r.gpu = {
    timed: gpuTimes.length,
    topMs: gpuTimes.length ? gpuTimes[gpuTimes.length >> 1] : null,
  };
  if (r.gpu.topMs) {
    const tight = new Z.ZhudaQualityGovernor({
      levels: steps.length,
      budgetMs: Math.max(0.05, r.gpu.topMs / 2),
      window: 6,
      calmSeconds: 30,
    });
    r.gpu.tightBudgetMs = tight.budgetMs;
    r.gpu.down = await walk(tight, 0, 0, true);
    apply(steps.length - 1);
    // The same frames held slow by the CPU, fed to two governors: one on
    // GPU times, its budget half again the GPU time measured under that hold
    // (GPU times spike now and then, to 17 ms against a median of 6 on this
    // desktop's WebGPU), and one on frame times alone, which reads 40 ms
    // frames as over any such budget.
    const heldTimes: number[] = [];
    for (let i = 0; i < 24; i++) {
      const f = await frame(40);
      if (f.gpu !== undefined) heldTimes.push(f.gpu);
    }
    heldTimes.sort((a, b) => a - b);
    const heldMs = heldTimes.length ? heldTimes[heldTimes.length >> 1] : r.gpu.topMs;
    const options = { levels: steps.length, budgetMs: heldMs * 1.5, window: 12, calmSeconds: 30 };
    const onGpu = new Z.ZhudaQualityGovernor(options),
      onCpu = new Z.ZhudaQualityGovernor(options);
    const changes: number[] = [],
      cpuChanges: number[] = [];
    const bases = new Set<string>();
    const held: number[] = [];
    for (let i = 0; i < 48; i++) {
      const f = await frame(40);
      if (f.gpu !== undefined) held.push(f.gpu);
      const level = onGpu.sample(f.ms, f.gpu);
      if (onGpu.basis) bases.add(onGpu.basis);
      if (level !== undefined) changes.push(level);
      const cpuLevel = onCpu.sample(f.ms);
      if (cpuLevel !== undefined) cpuChanges.push(cpuLevel);
    }
    held.sort((a, b) => a - b);
    r.gpu.cpuHeld = {
      budgetMs: +onGpu.budgetMs.toFixed(3),
      changes,
      bases: [...bases],
      level: onGpu.level,
      cpuRuleChanges: cpuChanges,
      gpuMedianMs: held.length ? held[held.length >> 1] : null,
      gpuMaxMs: held.length ? held[held.length - 1] : null,
    };
  }
  r.memory.keptAtEnd = memory.read();
  r.memory.reopened = new Z.ZhudaQualityMemory({
    key: 'governor-check',
    storage,
    levels: steps.length,
  }).startLevel(steps.length - 1);
  memory.clear();
  profiler.dispose();
  look.dispose();
  world.dispose();
  out.r = r;
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
