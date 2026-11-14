// Real-draw fixture for scripts/verify-render-scale.mjs: a detailed scene
// drawn at full size and smaller (ZhudaRenderScale through ZhudaSceneLook),
// brought up to the canvas plainly, with a filtered upscale and sharpening,
// and with FSR 1 (EASU then RCAS), under a 2D interface line drawn over it.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__SCALE__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 600,
  H = 360,
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
const lum = (p: Uint8Array, i: number) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
/** The 3D part of the frame: everything but the interface strip along the bottom. */
const SCENE = { x0: 0, x1: W, y0: 0, y1: H - 40 };
const UI = { x0: 20, x1: W - 20, y0: H - 34, y1: H - 6 };
/**
 * How sharp the picture is over a rectangle: the root of the mean squared
 * step in brightness between neighbours, along rows and columns. A blurred
 * edge is many small steps, which count for little.
 */
const sharpness = (p: Uint8Array, r = SCENE) => {
  let s = 0,
    n = 0;
  for (let y = r.y0; y < r.y1 - 1; y++)
    for (let x = r.x0; x < r.x1 - 1; x++) {
      const i = (y * W + x) * 4;
      s += (lum(p, i + 4) - lum(p, i)) ** 2 + (lum(p, i + W * 4) - lum(p, i)) ** 2;
      n += 2;
    }
  return +Math.sqrt(s / n).toFixed(3);
};
/** Mean difference in brightness, 0..255, over a rectangle. */
const meanDiff = (a: Uint8Array, b: Uint8Array, r = SCENE) => {
  let s = 0,
    n = 0;
  for (let y = r.y0; y < r.y1; y++)
    for (let x = r.x0; x < r.x1; x++, n++) {
      const i = (y * W + x) * 4;
      s += Math.abs(lum(a, i) - lum(b, i));
    }
  return +(s / n).toFixed(3);
};
/** Pixels of the stage's own background colour (magenta): what the 3D picture left uncovered. */
const uncovered = (p: Uint8Array) => {
  let n = 0;
  for (let i = 0; i < p.length; i += 4) if (p[i] > 200 && p[i + 1] < 70 && p[i + 2] > 200) n++;
  return n;
};
/** Mean colour of the outermost row or column of the frame. */
const border = (p: Uint8Array) => {
  const sum = [0, 0, 0];
  let n = 0;
  const take = (x: number, y: number) => {
    const i = (y * W + x) * 4;
    sum[0] += p[i];
    sum[1] += p[i + 1];
    sum[2] += p[i + 2];
    n++;
  };
  for (let x = 0; x < W; x++) take(x, 0);
  for (let y = 0; y < SCENE.y1; y++) {
    take(0, y);
    take(W - 1, y);
  }
  return sum.map((v) => +(v / n).toFixed(1));
};

const saved: Record<string, Uint8Array> = {};
/** A picture of the frame (or of a part of it, enlarged without smoothing) as a PNG data URL. */
out.picture = (name: string, crop?: number[], zoom = 1) => {
  const pixels = saved[name];
  const [x0, y0, w, h] = crop ?? [0, 0, W, H];
  const full = document.createElement('canvas');
  full.width = W;
  full.height = H;
  const image = full.getContext('2d')!.createImageData(W, H);
  image.data.set(pixels);
  full.getContext('2d')!.putImageData(image, 0, 0);
  const canvas = document.createElement('canvas');
  canvas.width = w * zoom;
  canvas.height = h * zoom;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(full, x0, y0, w, h, 0, 0, w * zoom, h * zoom);
  return canvas.toDataURL('image/png');
};

function build() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 1.7, 6], rotationEuler: [0, 0, 0] });
  camera.fieldOfView = FOV;
  camera.nearPlane = 0.1;
  camera.farPlane = 200;
  camera.transform.lookAt(new Laya.Vector3(0, 1.2, 0), new Laya.Vector3(0, 1, 0));
  const owned: any[] = [];
  const paint = (rgb: number[]) => {
    const material = Z.Zhuda3D.createMaterial({ type: 'pbr', albedoColor: [...rgb, 1] });
    material.smoothness = 0.2;
    owned.push(material);
    return material;
  };
  const light = paint([0.85, 0.85, 0.82]),
    dark = paint([0.06, 0.06, 0.08]),
    red = paint([0.8, 0.12, 0.08]),
    ground = paint([0.35, 0.36, 0.33]);
  const box = (size: number[], at: number[], material: any, turn: number[] = [0, 0, 0]) => {
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
    node.transform.rotationEuler = new Laya.Vector3(turn[0], turn[1], turn[2]);
    scene.addChild(node);
  };
  box([60, 0.2, 60], [0, -0.1, -10], ground);
  // A wall of stripes that get finer from left to right: 12, 8, 5 and 3 cm.
  let x = -3.2;
  for (const width of [0.12, 0.08, 0.05, 0.03]) {
    for (let i = 0; i < 12; i++, x += width)
      box([width, 1.2, 0.02], [x, 1.4, 0], i % 2 ? light : dark);
    x += 0.25;
  }
  // Bars at a slant against the sky, where a hard edge shows as steps.
  for (let i = 0; i < 5; i++)
    box([2.2, 0.06, 0.04], [-1.6 + i * 0.8, 2.6 + i * 0.12, -1], dark, [0, 0, 8 + i * 9]);
  // A fence of thin posts into the distance and a checker of tiles on the ground.
  for (let i = 0; i < 24; i++) box([0.05, 1, 0.05], [2.6, 0.5, 1 - i * 1.2], i % 2 ? red : light);
  for (let i = 0; i < 8; i++)
    for (let j = 0; j < 8; j++)
      if ((i + j) % 2) box([0.4, 0.02, 0.4], [-2.8 + i * 0.4, 0.01, 2.2 - j * 0.4], light);
  return {
    scene,
    camera,
    dispose() {
      scene.destroy(true);
      for (const item of owned) item.destroy();
    },
  };
}

const LOOK = {
  preset: 'day',
  shadows: { distance: 30, cascades: 2, resolution: 2048 },
  fog: false,
  grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'msaa' },
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
    bgColor: '#ff00ff',
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
  // Anything the 3D picture leaves uncovered shows the stage's magenta.
  Laya.stage.bgColor = '#ff00ff';
  const world = build();
  // The interface: a dark strip with one-pixel lines, drawn by the 2D stage over the 3D view.
  const ui = new Laya.Sprite();
  ui.graphics.drawRect(0, H - 40, W, 40, '#202428');
  for (let i = 0; i < 14; i++)
    ui.graphics.drawLine(24 + i * 40, H - 32, 44 + i * 40, H - 8, '#f0f0f0', 1);
  Laya.stage.addChild(ui);
  const look = new Z.ZhudaSceneLook(world.scene, world.camera, LOOK);
  const frame = (frames = 2) => {
    Z.ZhudaEngine.flushRenderFrames(frames);
    return read();
  };
  const r: any = {};
  const reference = (saved.reference = frame(3));
  r.reference = { sharpness: sharpness(reference), ui: sharpness(reference, UI) };
  r.ratioAtFull = Laya.Config3D.pixelRatio;
  // Each way of bringing a 0.67 picture up to the canvas, against full size.
  r.at067 = {};
  for (const upscale of ['plain', 'bilinear', 'fsr'] as const) {
    look.setRenderScale(0.67, { upscale, sharpness: 0.8 });
    const p = (saved[upscale] = frame());
    r.at067[upscale] = {
      sharpness: sharpness(p),
      meanDiff: meanDiff(p, reference),
      uiDiff: meanDiff(p, reference, UI),
      uncovered: uncovered(p),
      viewport: [world.camera.viewport.width, world.camera.viewport.height],
    };
  }
  // The same upscale without its sharpening: what the sharpening adds.
  look.setRenderScale(0.67, { upscale: 'fsr', sharpness: 0 });
  const unsharpened = (saved.easu = frame());
  r.at067.easu = {
    sharpness: sharpness(unsharpened),
    meanDiff: meanDiff(unsharpened, reference),
  };
  // Every scale and upscale covers the whole canvas, edge to edge.
  r.cover = [];
  for (const scale of [1, 0.9, 0.85, 0.75, 0.67, 0.6, 0.5])
    for (const upscale of ['plain', 'bilinear', 'fsr'] as const) {
      look.setRenderScale(scale, { upscale, sharpness: 0.8 });
      const p = frame();
      r.cover.push({
        scale,
        upscale,
        uncovered: uncovered(p),
        border: border(p),
        meanDiff: meanDiff(p, reference),
        size: [world.camera.viewport.width, world.camera.viewport.height],
      });
    }
  look.setRenderScale(0.5, { upscale: 'fsr', sharpness: 0.8 });
  saved.half = frame();
  // Desktop time a frame, the GPU made to finish by the read: not phone evidence.
  const time = (frames: number) => {
    frame(2);
    const start = performance.now();
    for (let i = 0; i < frames; i++) frame(1);
    return +((performance.now() - start) / frames).toFixed(2);
  };
  r.desktopMs = {};
  for (const [name, scale, upscale] of [
    ['full', 1, 'fsr'],
    ['plain067', 0.67, 'plain'],
    ['bilinear067', 0.67, 'bilinear'],
    ['fsr067', 0.67, 'fsr'],
  ] as const) {
    look.setRenderScale(scale, { upscale, sharpness: 0.8 });
    r.desktopMs[name] = time(20);
  }
  // A quality ladder: each rung's look level and size, applied in place.
  const steps = Z.zhudaQualitySteps();
  r.steps = [];
  for (let level = steps.length - 1; level >= 0; level--) {
    look.setStep(steps[level]);
    const p = frame();
    r.steps.push({
      level,
      look: look.quality,
      scale: look.scale,
      ratio: Laya.Config3D.pixelRatio,
      uncovered: uncovered(p),
      size: [world.camera.viewport.width, world.camera.viewport.height],
    });
  }
  // The whole chain at 0.67: fog lit by the sun's beams, screen reflections
  // and clouds, each drawn at the smaller size, then FSR.
  look.setStep(steps[steps.length - 1]);
  r.richMode = look.setLook({
    ...LOOK,
    lightFog: { density: 0.02, shafts: { strength: 2 } },
    screenReflections: { strength: 0.5 },
    clouds: true,
  });
  look.setRenderScale(0.67, { upscale: 'fsr', sharpness: 0.8 });
  for (let i = 0; i < 4; i++) {
    look.update([0, 1.7, 6], [0, 1.2, 0], FOV, W / H, 1 / 30);
    Z.ZhudaEngine.flushRenderFrames(1);
  }
  const rich = (saved.rich = read());
  r.rich = {
    uncovered: uncovered(rich),
    sharpness: sharpness(rich),
    meanDiff: meanDiff(rich, reference),
  };
  look.setLook(LOOK);
  look.setRenderScale(1);
  r.backAtFull = { ratio: Laya.Config3D.pixelRatio, meanDiff: meanDiff(frame(), reference) };
  // One render scale for the stage: a second look may not take it.
  look.setRenderScale(0.75);
  const other = Z.Zhuda3D.createScene3D(context.rootScene);
  const otherCamera = Z.Zhuda3D.createCamera(other, { position: [0, 1, 5] });
  r.second = (() => {
    try {
      new Z.ZhudaSceneLook(other, otherCamera, { fog: false }, { scale: 0.8 }).dispose();
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  })();
  other.destroy(true);
  r.invalid = ['scale 0.4', 'upscale', 'sharpness'].map((what) => {
    try {
      if (what === 'scale 0.4') look.setRenderScale(0.4);
      else if (what === 'upscale') look.setRenderScale(0.8, { upscale: 'lanczos' as any });
      else look.setRenderScale(0.8, { sharpness: 2 });
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  });
  // LayaAir keeps the camera's targets of every size it drew at in its pool
  // until the pool passes its memory cap: those are not held by anyone.
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
  r.resourcesBefore = held();
  for (let i = 0; i < 10; i++) {
    look.setRenderScale(i % 2 ? 1 : 0.6 + i * 0.03, { upscale: 'fsr' });
    frame(1);
  }
  look.setRenderScale(1);
  frame(1);
  r.resourcesAfter = held();
  look.setRenderScale(0.67);
  frame(1);
  look.dispose();
  r.afterDispose = {
    ratio: Laya.Config3D.pixelRatio,
    ownBlit: Object.hasOwn(world.scene, 'blitMainCanvas'),
  };
  world.dispose();
  ui.destroy();
  out.r = r;
  out.screenInvertY = !!Laya.LayaGL.renderEngine._screenInvertY;
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
