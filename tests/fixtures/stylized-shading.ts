// Real-draw fixture for scripts/verify-stylized-shading.mjs: the toon
// material (bands, shadow, point and spot lights, highlight, rim, outline,
// on a skinned limb), the matcap and normal-view recipes, and the selection
// outline. Every expected colour is worked out here from the same numbers
// the scene was built with.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__STYLE__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300;
let context: any;
let gl: WebGL2RenderingContext | null = null;

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
const saved: Record<string, Uint8Array> = {};
out.picture = (name: string) => png(saved[name]);
out.pictures = () => Object.keys(saved);

type V = number[];
const v3 = (a: V) => new Laya.Vector3(a[0], a[1], a[2]);
const sub = (a: V, b: V) => a.map((v, i) => v - b[i]);
const add = (a: V, b: V) => a.map((v, i) => v + b[i]);
const scale = (a: V, s: number) => a.map((v) => v * s);
const dot = (a: V, b: V) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = (a: V) => scale(a, 1 / Math.hypot(...a));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (low: number, high: number, x: number) => {
  const t = clamp01((x - low) / (high - low));
  return t * t * (3 - 2 * t);
};
/** What the screen shows for a linear value, without a grade. */
const shown = (linear: number) => 255 * clamp01(linear) ** (1 / 2.2);
const at = (p: Uint8Array, x: number, y: number) => {
  const i = (Math.round(y) * W + Math.round(x)) * 4;
  return [p[i], p[i + 1], p[i + 2]];
};
/** Mean colour of a square round a point. */
const patch = (p: Uint8Array, cx: number, cy: number, half = 2) => {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.round(cy) - half; y <= Math.round(cy) + half; y++)
    for (let x = Math.round(cx) - half; x <= Math.round(cx) + half; x++, n++)
      for (let c = 0; c < 3; c++) sum[c] += p[(y * W + x) * 4 + c];
  return sum.map((v) => +(v / n).toFixed(1));
};
const far = (a: V, b: V) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const difference = (a: Uint8Array, b: Uint8Array) => {
  let sum = 0,
    worst = 0;
  for (let i = 0; i < a.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c] - b[i + c]);
      sum += d;
      if (d > worst) worst = d;
    }
  return { mean: +(sum / ((a.length / 4) * 3)).toFixed(3), worst };
};

/**
 * `?time=1`: how long a frame takes with the same balls drawn physically
 * based, banded, banded with an outline, and with some of them selected. The
 * picture is as large as the window, since the cost is by the pixel.
 */
async function timing() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  const width = Math.min(innerWidth, 1280),
    height = Math.min(innerHeight, 1280);
  context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width,
    height,
    dprCap: 2,
    features: [...(globalThis as any).ZhudaBundle.features],
    preserveDrawingBuffer: true,
    bgColor: '#000000',
  });
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  context.runtime.start(() => {});
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.25, 0.27, 0.3] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 5.5, 7.5], fov: 50 });
  camera.transform.lookAt(v3([0, 0.3, 0]), v3([0, 1, 0]));
  camera.clearColor = new Laya.Color(0.5, 0.55, 0.6, 1);
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
  sun.node.transform.rotationEuler = v3([-45, 30, 0]);
  sun.light.shadowMode = Laya.ShadowMode.SoftLow;
  sun.light.shadowDistance = 30;
  sun.light.shadowResolution = 1024;
  const ramp = { edges: [0.3, 0.7], levels: [0.25, 0.6, 1] };
  const materials: Record<string, any> = {
    pbr: Z.createSurfaceMaterial({ type: 'pbr', color: [0.9, 0.5, 0.3, 1], roughness: 0.6 }),
    toon: new Z.ZhudaToonMaterial({
      name: 'ZhudaToonTimed',
      ramp,
      material: { color: [0.9, 0.5, 0.3, 1] },
    }).material,
    outlined: new Z.ZhudaToonMaterial({
      name: 'ZhudaToonTimedLine',
      ramp,
      outline: { color: [0.1, 0.1, 0.2], width: 3 },
      material: { color: [0.9, 0.5, 0.3, 1] },
    }).material,
  };
  const ground = new Laya.MeshSprite3D(
    Z.Zhuda3D.createPrimitiveMesh('box', { width: 24, height: 0.2, depth: 24 }),
  );
  ground.meshRenderer.receiveShadow = true;
  ground.transform.position = v3([0, -0.1, 0]);
  scene.addChild(ground);
  const mesh = Laya.PrimitiveMesh.createSphere(0.45, 48, 48);
  const balls: any[] = [];
  for (let i = 0; i < 36; i++) {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = v3([(i % 6) * 1.5 - 3.75, 0.45, Math.floor(i / 6) * 1.5 - 3.75]);
    scene.addChild(node);
    balls.push(node);
  }
  const dress = (name: string) => {
    for (const node of [ground, ...balls]) node.meshRenderer.sharedMaterial = materials[name];
  };
  const pixel = new Uint8Array(4);
  /** Median time of a frame, drawn and finished, over sixty. */
  const measure = () => {
    Z.ZhudaEngine.flushRenderFrames(20);
    const times: number[] = [];
    for (let i = 0; i < 60; i++) {
      const started = performance.now();
      Z.ZhudaEngine.flushRenderFrames(1);
      // Reading a pixel waits for the frame to be drawn.
      if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      times.push(performance.now() - started);
    }
    return +[...times].sort((a, b) => a - b)[30].toFixed(2);
  };
  const cases: Record<string, number> = {};
  for (const name of ['pbr', 'toon', 'outlined', 'pbr', 'toon', 'outlined']) {
    dress(name);
    const ms = measure();
    cases[name] = cases[name] === undefined ? ms : +Math.min(cases[name], ms).toFixed(2);
  }
  saved.timed = new Uint8Array(0);
  dress('pbr');
  const selection = new Z.ZhudaSelectionOutline({ width: 3 });
  const through = new Z.ZhudaSelectionOutline({ width: 3, occlusion: false });
  const chain = (effects: any[]) =>
    new Z.ZhudaFilmicPipeline(camera, { bloom: false, ao: false, finishEffects: effects });
  let pipeline = chain([]);
  cases.graded = measure();
  pipeline.dispose();
  pipeline = chain([selection.effect]);
  cases.selectionIdle = measure();
  selection.select(balls.slice(0, 6));
  cases.selection = measure();
  pipeline.dispose();
  pipeline = chain([through.effect]);
  through.select(balls.slice(0, 6));
  cases.selectionThrough = measure();
  pipeline.dispose();
  out.timing = {
    picture: [context.canvas.width, context.canvas.height],
    synced: !!gl,
    cases,
  };
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}

async function main() {
  if (new URLSearchParams(location.search).has('time')) return timing();
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
    bgColor: '#000000',
  });
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  context.runtime.start(() => {});
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const BACK = [0.5, 0.5, 0.5];
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0, 0, 0] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 10], fov: 40 });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(BACK[0], BACK[1], BACK[2], 1);
  camera.enableHDR = false;
  camera.msaa = false;
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
  /** Live resources by class, to name what a disposal leaves. */
  const census = () => {
    const map = Laya.Resource._idResourcesMap;
    const items: any[] = map instanceof Map ? [...map.values()] : Object.values(map || {});
    const count: Record<string, number> = {};
    const pooled = new Set<any>(Laya.RenderTexture._pool ?? []);
    for (const item of items)
      if (!item.destroyed && !pooled.has(item)) {
        const name = `${item.constructor?.name}:${item.width ?? ''}x${item.height ?? ''}:${item.format ?? ''}:${item.name ?? ''}`;
        count[name] = (count[name] ?? 0) + 1;
      }
    return count;
  };

  // --- Views -------------------------------------------------------------
  /** Pixels a scene unit, when the view is flat (orthographic). */
  let perUnit = 100;
  let eye: V = [0, 0, 10];
  let right: V = [1, 0, 0];
  let up: V = [0, 1, 0];
  const axes = () => {
    const r = new Laya.Vector3(),
      u = new Laya.Vector3();
    camera.transform.getRight(r);
    camera.transform.getUp(u);
    right = [r.x, r.y, r.z];
    up = [u.x, u.y, u.z];
  };
  /** A flat view from `from` toward `target`, `tall` scene units from top to bottom. */
  const flat = (from: V, target: V, tall: number) => {
    camera.orthographic = true;
    camera.orthographicVerticalSize = tall;
    camera.transform.position = v3(from);
    camera.transform.lookAt(v3(target), v3([0, 1, 0]));
    eye = from;
    perUnit = H / tall;
    axes();
  };
  /** The pixel of a world point in a flat view. */
  const pixel = (p: V) => {
    const d = sub(p, eye);
    return [W / 2 + dot(d, right) * perUnit, H / 2 - dot(d, up) * perUnit];
  };
  const front = () => flat([0, 0, 10], [0, 0, 0], 3);
  const frame = (name?: string) => {
    Z.ZhudaEngine.flushRenderFrames(3);
    const p = read();
    if (name) saved[name] = p;
    return p;
  };

  // --- Lights ------------------------------------------------------------
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 0.5 });
  sun.node.transform.rotationEuler = v3([-35, 30, 0]);
  const holder = (Component: any, where: V) => {
    const node = new Laya.Sprite3D();
    scene.addChild(node);
    node.transform.position = v3(where);
    return { node, light: node.addComponent(Component) };
  };
  const LAMP = { at: [-1.6, 1.2, 1.2], range: 5, intensity: 0.8, color: [1, 0, 0] };
  const lamp = holder(Laya.PointLightCom, LAMP.at);
  lamp.light.color = new Laya.Color(LAMP.color[0], LAMP.color[1], LAMP.color[2], 1);
  lamp.light.intensity = LAMP.intensity;
  lamp.light.range = LAMP.range;
  const SPOT = { at: [1.8, 2.5, 1.2], range: 8, intensity: 0.9, color: [0, 0, 1], angle: 50 };
  const spot = holder(Laya.SpotLightCom, SPOT.at);
  spot.light.color = new Laya.Color(SPOT.color[0], SPOT.color[1], SPOT.color[2], 1);
  spot.light.intensity = SPOT.intensity;
  spot.light.range = SPOT.range;
  spot.light.spotAngle = SPOT.angle;
  spot.node.transform.rotationEuler = v3([-90, 0, 0]);
  const lights = (on: { sun?: boolean; lamp?: boolean; spot?: boolean }) => {
    sun.node.active = !!on.sun;
    lamp.node.active = !!on.lamp;
    spot.node.active = !!on.spot;
  };
  lights({ sun: true });
  // LayaAir keeps a light's shadow map once it has made one: made here, before anything is counted.
  sun.light.shadowMode = Laya.ShadowMode.SoftLow;
  sun.light.shadowResolution = 2048;
  Z.ZhudaEngine.flushRenderFrames(2);
  sun.light.shadowMode = Laya.ShadowMode.None;
  Z.ZhudaEngine.flushRenderFrames(2);
  const resourcesBefore = held();
  const censusBefore = census();
  const travel = sun.light.direction;
  /** Toward the sun. */
  const toSun = unit([-travel.x, -travel.y, -travel.z]);
  out.toSun = toSun.map((v) => +v.toFixed(4));

  // --- Things ------------------------------------------------------------
  const owned: any[] = [];
  const keep = <T>(item: T) => (owned.push(item), item);
  const place = (mesh: any, material: any, where: V, shadows = true) => {
    const node = new Laya.MeshSprite3D(keep(mesh));
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.castShadow = shadows;
    node.meshRenderer.receiveShadow = shadows;
    node.transform.position = v3(where);
    scene.addChild(node);
    return node;
  };
  const sphere = (radius: number) => Laya.PrimitiveMesh.createSphere(radius, 96, 96);
  const box = (size: V) =>
    Z.Zhuda3D.createPrimitiveMesh('box', { width: size[0], height: size[1], depth: size[2] });

  const RAMP = { edges: [0.3, 0.7], levels: [0.15, 0.5, 1], softness: 0 };
  const SOFT = { ...RAMP, softness: 0.2 };
  const SUN = 0.5;
  const toon = keep(new Z.ZhudaToonMaterial({ name: 'ZhudaToonCheck', ramp: RAMP }));
  const ball = place(sphere(1), toon.material, [0, 0, 0], false);
  const all: any[] = [ball];
  const only = (...nodes: any[]) => {
    for (const each of all) each.active = nodes.includes(each);
  };

  // 1. The bands: every sampled pixel of a ball against the ramp worked out here.
  const HIGHLIGHT = { color: [1, 1, 1], sizeDeg: 12, strength: 0.6, softness: 0 };
  const RIM = { color: [0, 0.5, 1], width: 0.35, strength: 0.5, softness: 0 };
  /** The colour the ball should show at a pixel, or null where an edge of a band, the highlight or the rim passes. */
  const expectedBall = (
    px: number,
    py: number,
    ramp: typeof RAMP,
    extra: { highlight?: boolean; rim?: boolean } = {},
  ) => {
    const x = (px - W / 2) / perUnit,
      y = -(py - H / 2) / perUnit;
    const rr = x * x + y * y;
    if (rr > 0.94 * 0.94) return null;
    const n = [x, y, Math.sqrt(1 - rr)];
    const lit = clamp01(dot(n, toSun));
    const half = Math.max(ramp.softness * 0.5, 1e-5);
    // A pixel is not asked to land on one side of a step.
    const guard = 0.035;
    if (ramp.softness === 0 && ramp.edges.some((e) => Math.abs(lit - e) < guard)) return null;
    const band = Z.zhudaToonBand(ramp, lit);
    const colour = [band * SUN, band * SUN, band * SUN];
    const view = unit(sub(eye, n));
    if (extra.highlight) {
      const nh = clamp01(dot(n, unit(add(view, toSun))));
      const edge = Math.cos((HIGHLIGHT.sizeDeg * Math.PI) / 180);
      if (Math.abs(nh - edge) < 0.004) return null;
      const passed = smooth(ramp.edges[0] - half, ramp.edges[0] + half, lit);
      if (nh > edge)
        for (let c = 0; c < 3; c++)
          colour[c] += Z.zhudaSrgbToLinear(HIGHLIGHT.color[c]) * HIGHLIGHT.strength * SUN * passed;
    }
    if (extra.rim) {
      const fresnel = 1 - clamp01(dot(n, view));
      if (Math.abs(fresnel - (1 - RIM.width)) < 0.03) return null;
      if (fresnel > 1 - RIM.width)
        for (let c = 0; c < 3; c++) colour[c] += Z.zhudaSrgbToLinear(RIM.color[c]) * RIM.strength;
    }
    return colour.map(shown);
  };
  const compareBall = (
    p: Uint8Array,
    ramp: typeof RAMP,
    extra?: { highlight?: boolean; rim?: boolean },
  ) => {
    let worst = 0,
      count = 0,
      sum = 0;
    const values: number[] = [];
    for (let py = 52; py < H - 50; py += 3)
      for (let px = 142; px < W - 140; px += 3) {
        const want = expectedBall(px, py, ramp, extra);
        if (!want) continue;
        const got = at(p, px, py);
        const d = far(got, want);
        worst = Math.max(worst, d);
        sum += d;
        count++;
        values.push(got[0]);
      }
    // Flat levels: runs of values no more than 3 apart.
    values.sort((a, b) => a - b);
    const levels = values.filter((v, i) => i === 0 || v - values[i - 1] > 3).length;
    return {
      worst,
      mean: +(sum / count).toFixed(2),
      count,
      levels,
      distinct: new Set(values).size,
    };
  };
  front();
  only(ball);
  out.bands = {
    hard: compareBall(frame('bands'), RAMP),
    soft: (toon.setRamp(SOFT), compareBall(frame('bands-soft'), SOFT)),
    five: (() => {
      const five = Z.zhudaToonRamp(5, { softness: 0 });
      toon.setRamp(five);
      const result = compareBall(frame('bands-five'), five);
      return { ...result, ramp: five };
    })(),
  };
  toon.setRamp(RAMP);
  toon.setHighlight(HIGHLIGHT);
  out.highlight = compareBall(frame('highlight'), RAMP, { highlight: true });
  toon.setRim(RIM);
  out.rim = compareBall(frame('rim'), RAMP, { highlight: true, rim: true });
  toon.setHighlight(null);
  toon.setRim(null);
  out.plainAgain = compareBall(frame(), RAMP);

  // The scene's ambient light, flat: the same on every side.
  lights({});
  scene.ambientColor = new Laya.Color(0.2, 0.2, 0.2, 1);
  {
    const p = frame('ambient');
    out.ambient = {
      top: patch(p, W / 2, H / 2 - 70),
      bottom: patch(p, W / 2, H / 2 + 70),
      middle: patch(p, W / 2, H / 2),
    };
    toon.setAmbient({ strength: 2 });
    out.ambient.doubled = patch(frame(), W / 2, H / 2);
    toon.setAmbient({});
  }
  scene.ambientColor = new Laya.Color(0, 0, 0, 1);
  lights({ sun: true });

  // 2. The outline: a line of its own colour and width outside the ball, in pixels and in scene units.
  const LINE = [0.1, 0.2, 0.9];
  const lineShown = LINE.map((c) => shown(Z.zhudaSrgbToLinear(c)));
  const backShown = BACK.map((c) => shown(Z.zhudaSrgbToLinear(c)));
  const outlined = keep(
    new Z.ZhudaToonMaterial({
      name: 'ZhudaToonOutlined',
      ramp: RAMP,
      outline: { color: LINE, width: 4 },
    }),
  );
  const lineBall = place(sphere(1), outlined.material, [0, 0, 0], false);
  all.push(lineBall);
  only(lineBall);
  /** Round the ball: how far each ring of pixels is from the line's colour and from the background. */
  const ring = (p: Uint8Array, radius: number, centre = [W / 2, H / 2]) => {
    let line = 0,
      back = 0;
    for (let i = 0; i < 16; i++) {
      const turn = (i / 16) * Math.PI * 2 + 0.2;
      const got = at(p, centre[0] + Math.cos(turn) * radius, centre[1] + Math.sin(turn) * radius);
      line = Math.max(line, far(got, lineShown));
      back = Math.max(back, far(got, backShown));
    }
    return { line: +line.toFixed(1), back: +back.toFixed(1) };
  };
  {
    const p = frame('outline');
    out.outline = {
      lineShown,
      backShown,
      screen: { inside: ring(p, 102), outside: ring(p, 107), body: ring(p, 94) },
      bodyBands: compareBall(p, RAMP),
    };
    outlined.setOutline({ color: LINE, width: 0.08, space: 'world' });
    const world = frame('outline-world');
    out.outline.world = { inside: ring(world, 104), outside: ring(world, 111) };
    outlined.setOutline({ color: LINE, width: 0 });
    out.outline.none = ring(frame(), 102);
    outlined.setOutline({ color: LINE, width: 4 });
    // With a lens: the ball's rim is where the eye's cone touches it.
    camera.orthographic = false;
    camera.fieldOfView = 40;
    camera.transform.position = v3([0, 0, 5]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    const rim = (Math.tan(Math.asin(1 / 5)) * (H / 2)) / Math.tan((20 * Math.PI) / 180);
    const lens = frame('outline-lens');
    out.outline.lens = {
      rim: +rim.toFixed(1),
      inside: ring(lens, rim + 2),
      outside: ring(lens, rim + 7),
    };
    // Three balls of one mesh and one material: LayaAir draws them as one instanced batch.
    front();
    const shared = keep(sphere(0.4));
    const trio = [-1.2, 0, 1.2].map((x) => {
      const node = new Laya.MeshSprite3D(shared);
      node.meshRenderer.sharedMaterial = outlined.material;
      node.transform.position = v3([x, 0, 0]);
      scene.addChild(node);
      all.push(node);
      return node;
    });
    only(...trio);
    const batch = frame('outline-batch');
    out.outline.batch = {
      rings: [-1.2, 0, 1.2].map((x) => ({
        inside: ring(batch, 42, [W / 2 + x * 100, H / 2]),
        outside: ring(batch, 47, [W / 2 + x * 100, H / 2]),
      })),
      instanced: Laya.Stat.instanceDrawCall ?? null,
    };
    only(lineBall);
    try {
      toon.setOutline({ color: LINE, width: 2 });
      out.outline.withoutPass = 'accepted';
    } catch (error) {
      out.outline.withoutPass = String((error as Error).message);
    }
  }

  // 3. A stage: a floor, a block that casts a shadow, lamps; seen from the front and above.
  const FLOOR = { edges: [0.25, 0.6], levels: [0.2, 0.55, 1], softness: 0 };
  const floorToon = keep(new Z.ZhudaToonMaterial({ name: 'ZhudaToonCheck', ramp: FLOOR }));
  const floor = place(box([12, 0.2, 12]), floorToon.material, [0, -0.1, 0]);
  const blockToon = keep(new Z.ZhudaToonMaterial({ name: 'ZhudaToonCheck', ramp: FLOOR }));
  const block = place(box([0.6, 1.2, 0.6]), blockToon.material, [0, 0.6, 0]);
  const floorPbr = keep(
    Z.createSurfaceMaterial({ type: 'pbr', color: [1, 1, 1, 1], metallic: 0, roughness: 1 }),
  );
  all.push(floor, block);
  sun.light.shadowMode = Laya.ShadowMode.SoftLow;
  sun.light.shadowDistance = 30;
  sun.light.shadowResolution = 2048;
  sun.light.shadowStrength = 1;
  const stage = () => flat([0, 7, 7], [0, 0, 0], 6);
  stage();
  only(floor, block);
  {
    // The tip of the block's shadow: its top carried along the light to the floor.
    const tip = add([0, 1.2, 0], scale(toSun, -1.2 / toSun[1]));
    const inShadow = scale([tip[0], 0, tip[2]], 0.72);
    const inLight = scale([tip[0], 0, tip[2]], -0.9);
    const floorLit = Z.zhudaToonBand(FLOOR, clamp01(toSun[1]));
    const p = frame('shadow');
    /** Pixels along the floor from inside the shadow out past its tip that are neither level. */
    const between = (picture: Uint8Array, low: number, high: number) => {
      let n = 0;
      for (let t = 0.72; t <= 1.5; t += 0.004) {
        const [x, y] = pixel(scale([tip[0], 0, tip[2]], t));
        const v = at(picture, x, y)[0];
        if (v > low + 8 && v < high - 8) n++;
      }
      return n;
    };
    out.shadow = {
      shade: patch(p, ...(pixel(inShadow) as [number, number])),
      lit: patch(p, ...(pixel(inLight) as [number, number])),
      wantShade: +shown(FLOOR.levels[0] * SUN).toFixed(1),
      wantLit: +shown(floorLit * SUN).toFixed(1),
      toonBetween: between(p, shown(FLOOR.levels[0] * SUN), shown(floorLit * SUN)),
    };
    floor.meshRenderer.sharedMaterial = floorPbr;
    const physical = frame('shadow-pbr');
    const pbrShade = patch(physical, ...(pixel(inShadow) as [number, number]))[0];
    const pbrLit = patch(physical, ...(pixel(inLight) as [number, number]))[0];
    out.shadow.pbr = { shade: pbrShade, lit: pbrLit, between: between(physical, pbrShade, pbrLit) };
    floor.meshRenderer.sharedMaterial = floorToon.material;
  }

  // 4. A lamp and a spot, each alone, then with the sun.
  {
    const falloff = (distance: number, range: number) => {
      const ratio = clamp01(distance / range) ** 2;
      return (1 / (1 + 25 * ratio)) * clamp01(4 * (1 - ratio));
    };
    const under: V = [LAMP.at[0], 0, LAMP.at[2]];
    const lampWant = shown(FLOOR.levels[2] * LAMP.intensity * falloff(LAMP.at[1], LAMP.range));
    // Far along the floor the lamp's light grazes it: under the first edge.
    const grazing: V = [LAMP.at[0] + 4.2, 0, LAMP.at[2]];
    const reach = Math.hypot(4.2, LAMP.at[1]);
    const grazeLit = LAMP.at[1] / reach;
    const grazeWant = shown(
      Z.zhudaToonBand(FLOOR, grazeLit) * LAMP.intensity * falloff(reach, LAMP.range),
    );
    lights({ lamp: true });
    const lampOnly = frame('lamp');
    const spotUnder: V = [SPOT.at[0], 0, SPOT.at[2]];
    const spotWant = shown(FLOOR.levels[2] * SPOT.intensity * falloff(SPOT.at[1], SPOT.range));
    lights({ spot: true });
    const spotOnly = frame('spot');
    lights({ sun: true, lamp: true, spot: true });
    const together = frame('lights');
    const px = (p: V) => pixel(p) as [number, number];
    out.lights = {
      lamp: {
        under: patch(lampOnly, ...px(under)),
        want: +lampWant.toFixed(1),
        grazing: patch(lampOnly, ...px(grazing)),
        grazeLit: +grazeLit.toFixed(3),
        grazeWant: +grazeWant.toFixed(1),
        away: patch(lampOnly, ...px([4.5, 0, -3])),
      },
      spot: {
        under: patch(spotOnly, ...px(spotUnder)),
        want: +spotWant.toFixed(1),
        outside: patch(spotOnly, ...px([-2.5, 0, 1.2])),
      },
      together: {
        underLamp: patch(together, ...px(under)),
        underSpot: patch(together, ...px(spotUnder)),
      },
    };
  }

  // 5. A skinned limb, bent: the bands, the outline and the shadow follow the bones.
  {
    const provider = new Z.DirectoryAssetProvider({ baseUrl: './fixtures/' });
    const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
    const limb = await library.instantiate('limb.glb');
    scene.addChild(limb.node);
    limb.node.transform.position = v3([1.2, 0, 0.4]);
    const skinToon = keep(
      new Z.ZhudaToonMaterial({
        name: 'ZhudaToonOutlined',
        ramp: FLOOR,
        outline: { color: LINE, width: 3 },
        material: { color: [1, 0.55, 0.3, 1] },
      }),
    );
    const renderers: any[] = [];
    const walk = (node: any) => {
      const found = node.getComponent(Laya.BaseRender);
      if (found) renderers.push(found);
      for (let i = 0; i < node.numChildren; i++) walk(node.getChildAt(i));
    };
    walk(limb.node);
    for (const each of renderers) {
      each.sharedMaterial = skinToon.material;
      each.castShadow = true;
      each.receiveShadow = true;
    }
    const sampler = new Z.ZhudaModelAnimationSampler(limb, '$', 'Bend');
    all.push(limb.node);
    only(floor, block, limb.node);
    stage();
    const px = (p: V) => pixel(p) as [number, number];
    const origin: V = [1.2, 0, 0.4];
    // Straight: the upper half stands over the joint. Bent: it lies toward -X.
    const upright = add(origin, [0, 1.6, 0]);
    const lying = add(origin, [-0.6, 1, 0]);
    /** Line-coloured pixels down a column of the picture through a point, above and below it. */
    const lineAcross = (p: Uint8Array, where: V) => {
      const [x, y] = px(where);
      let above = 0,
        below = 0;
      for (let d = 1; d < 60; d++) {
        if (far(at(p, x, y - d), lineShown) < 30) above++;
        if (far(at(p, x, y + d), lineShown) < 30) below++;
      }
      return { above, below };
    };
    sampler.sample(0);
    const straight = frame('limb-straight');
    sampler.sample(1);
    const bent = frame('character');
    const isBack = (c: V) => far(c, backShown) < 12;
    out.limb = {
      renderers: renderers.map((r) => r.constructor?.name),
      straight: {
        upright: at(straight, ...px(upright)),
        lying: at(straight, ...px(lying)),
      },
      bent: {
        upright: at(bent, ...px(upright)),
        lying: at(bent, ...px(lying)),
        line: lineAcross(bent, lying),
      },
      lineStraight: lineAcross(straight, lying),
      moved: difference(straight, bent),
      uprightIsBackWhenBent: isBack(at(bent, ...px(upright))),
    };
    sampler.dispose();

    // 6. The selection outline over the same stage, in the finished picture.
    const SEEN = [1, 0.72, 0.1],
      BEHIND = [0.2, 0.6, 1];
    lights({ sun: true });
    only(floor, block, limb.node);
    limb.node.active = false;
    // A prop half behind a wall, seen from the front.
    const prop = place(box([1, 1, 1]), floorPbr, [0, 0, 0], false);
    const wallPaint = keep(Z.createSurfaceMaterial({ type: 'unlit', color: [0.25, 0.3, 0.25, 1] }));
    const wall = place(box([1.2, 2.4, 0.2]), wallPaint, [0.6, 0, 2], false);
    all.push(prop, wall);
    only(prop, wall);
    front();
    const withoutEffect = new Z.ZhudaFilmicPipeline(camera, { bloom: false, ao: false });
    const plain = frame('selection-none');
    withoutEffect.dispose();
    const selection = new Z.ZhudaSelectionOutline({
      visibleColor: SEEN,
      hiddenColor: BEHIND,
      hiddenStrength: 1,
      width: 3,
    });
    const pipeline = new Z.ZhudaFilmicPipeline(camera, {
      bloom: false,
      ao: false,
      finishEffects: [selection.effect],
    });
    const empty = frame();
    const chain = pipeline.post.effects;
    out.selectionAfterGrade = chain.indexOf(selection.effect) > chain.indexOf(pipeline.grade);
    selection.select([prop]);
    const drawn = frame('selection');
    const seenShown = SEEN.map((c) => shown(Z.zhudaSrgbToLinear(c))),
      behindShown = BEHIND.map((c) => shown(Z.zhudaSrgbToLinear(c)));
    const leftEdge = W / 2 - 50,
      rightEdge = W / 2 + 50,
      topEdge = H / 2 - 50;
    /** Pixels of a colour leftward from the prop's left side along the middle row. */
    const thickness = (p: Uint8Array, colour: V) => {
      let n = 0;
      for (let x = leftEdge - 1; x > leftEdge - 12; x--) if (far(at(p, x, H / 2), colour) < 40) n++;
      return n;
    };
    out.selection = {
      seenShown,
      behindShown,
      empty: difference(plain, empty),
      left: at(drawn, leftEdge - 2, H / 2),
      topSeen: at(drawn, W / 2 - 25, topEdge - 2),
      topBehind: at(drawn, W / 2 + 25, topEdge - 2),
      right: at(drawn, rightEdge + 2, H / 2),
      thickness: thickness(drawn, seenShown),
      // Away from the line nothing changes.
      awayChanged: far(at(drawn, 60, 60), at(plain, 60, 60)),
      insideChanged: far(at(drawn, W / 2 + 25, H / 2), at(plain, W / 2 + 25, H / 2)),
      wall: at(plain, W / 2 + 25, H / 2),
    };
    {
      // Through a lens: the prop's front face is what the eye sees of it.
      camera.orthographic = false;
      camera.fieldOfView = 40;
      camera.transform.position = v3([0, 0, 5]);
      camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
      const half = (0.5 * (H / 2)) / Math.tan((20 * Math.PI) / 180) / 4.5;
      const lens = frame('selection-lens');
      out.selection.lens = {
        half: +half.toFixed(1),
        left: at(lens, W / 2 - half - 2, H / 2),
        topSeen: at(lens, W / 2 - half / 2, H / 2 - half - 2),
        topBehind: at(lens, W / 2 + half / 2, H / 2 - half - 2),
        right: at(lens, W / 2 + half + 2, H / 2),
      };
      front();
    }
    selection.set({ hiddenFill: 0.5 });
    out.selection.filled = at(frame('selection-fill'), W / 2 + 25, H / 2);
    selection.set({ hiddenFill: 0 });
    selection.setStrength(0.5);
    out.selection.half = {
      left: at(frame(), leftEdge - 2, H / 2),
      base: at(plain, leftEdge - 2, H / 2),
    };
    selection.setStrength(1);
    selection.set({ width: 5 });
    out.selection.wide = thickness(frame(), seenShown);
    selection.set({ width: 3, hiddenColor: null });
    out.selection.noHidden = far(
      at(frame(), rightEdge + 2, H / 2),
      at(plain, rightEdge + 2, H / 2),
    );
    selection.set({ hiddenColor: BEHIND });
    // The prop moves: the line goes with it.
    prop.transform.position = v3([-0.6, 0, 0]);
    out.selection.moved = at(frame(), leftEdge - 60 - 2, H / 2);
    // Moved back and deselected in one go, between two frames: the scene must not keep it where it was.
    prop.transform.position = v3([0, 0, 0]);
    selection.clear();
    out.selection.cleared = difference(plain, frame());
    out.selection.pulse = [0, 0.3, 0.6].map((t) => +Z.zhudaOutlinePulse(t, 1.2, 0.35).toFixed(4));

    // The limb, bent, selected: the mask is skinned as the limb is drawn.
    only(floor, block, limb.node);
    stage();
    const again = new Z.ZhudaModelAnimationSampler(limb, '$', 'Bend');
    again.sample(1);
    selection.select([limb.node]);
    const tip = add(origin, [-1.0, 1, 0]);
    const limbFrame = frame('selection-limb');
    {
      const [x, y] = px(lying);
      let above = 0;
      for (let d = 1; d < 70; d++) if (far(at(limbFrame, x, y - d), seenShown) < 40) above++;
      out.selection.limb = { above, tip: px(tip) };
    }
    selection.clear();
    again.dispose();
    pipeline.dispose();
    selection.dispose();

    // Without telling hidden from seen: one colour all round, and no depth texture asked for.
    only(prop, wall);
    front();
    const through = new Z.ZhudaSelectionOutline({ visibleColor: SEEN, width: 3, occlusion: false });
    const second = new Z.ZhudaFilmicPipeline(camera, {
      bloom: false,
      ao: false,
      finishEffects: [through.effect],
    });
    through.select([prop]);
    out.selection.through = {
      right: at(frame('selection-through'), rightEdge + 2, H / 2),
      depthMode: camera.depthTextureMode,
    };
    second.dispose();
    through.dispose();
    limb.dispose();
  }

  // 7. The recipes: a matcap picture and the normal view.
  {
    lights({});
    front();
    const size = 64;
    const picture = new Uint8Array(size * size * 4);
    const QUADRANT = {
      topLeft: [255, 0, 0],
      topRight: [0, 255, 0],
      bottomLeft: [0, 0, 255],
      bottomRight: [255, 255, 0],
    };
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const c =
          y < size / 2
            ? x < size / 2
              ? QUADRANT.topLeft
              : QUADRANT.topRight
            : x < size / 2
              ? QUADRANT.bottomLeft
              : QUADRANT.bottomRight;
        picture.set([c[0], c[1], c[2], 255], (y * size + x) * 4);
      }
    const texture = keep(Z.createSurfaceTexture(size, size, picture, 'color'));
    const matcap = keep(
      new Z.ZhudaShaderMaterial(Z.shaderRecipes.matcap3D, { u_ZhudaMatcap: texture }),
    );
    const matBall = place(sphere(1), matcap.material, [0, 0, 0], false);
    all.push(matBall);
    only(matBall);
    const p = frame('matcap');
    const q = 45;
    out.matcap = {
      want: QUADRANT,
      topLeft: at(p, W / 2 - q, H / 2 - q),
      topRight: at(p, W / 2 + q, H / 2 - q),
      bottomLeft: at(p, W / 2 - q, H / 2 + q),
      bottomRight: at(p, W / 2 + q, H / 2 + q),
    };
    // Off to one side with a lens: the picture stays upright on the ball.
    camera.orthographic = false;
    camera.fieldOfView = 40;
    camera.transform.position = v3([0, 0, 5]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    matBall.transform.position = v3([1.2, 0.6, 0]);
    const lens = frame('matcap-lens');
    const scalePx = H / 2 / Math.tan((20 * Math.PI) / 180) / 5;
    const cx = W / 2 + 1.2 * scalePx,
      cy = H / 2 - 0.6 * scalePx;
    const o = 0.45 * scalePx;
    out.matcap.lens = {
      topLeft: at(lens, cx - o, cy - o),
      topRight: at(lens, cx + o, cy - o),
      bottomLeft: at(lens, cx - o, cy + o),
      bottomRight: at(lens, cx + o, cy + o),
    };
    matBall.transform.position = v3([0, 0, 0]);
    front();
    const normalView = keep(new Z.ZhudaShaderMaterial(Z.shaderRecipes.normalView3D));
    matBall.meshRenderer.sharedMaterial = normalView.material;
    const n = frame('normal-view');
    const tone = (v: V) => v.map((c) => (c * 0.5 + 0.5) * 255);
    out.normalView = {
      middle: { got: at(n, W / 2, H / 2), want: tone([0, 0, 1]) },
      right: { got: at(n, W / 2 + 60, H / 2), want: tone([0.6, 0, 0.8]) },
      up: { got: at(n, W / 2, H / 2 - 60), want: tone([0, 0.6, 0.8]) },
      leftDown: {
        got: at(n, W / 2 - 48, H / 2 + 48),
        want: tone([-0.48, -0.48, Math.sqrt(1 - 2 * 0.48 * 0.48)]),
      },
    };
  }

  // 8. What is refused, and what is left behind.
  const refused = (make: () => unknown) => {
    try {
      make();
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  };
  out.invalid = {
    ramp: refused(
      () =>
        new Z.ZhudaToonMaterial({
          name: 'ZhudaToonBad',
          ramp: { edges: [0.5, 0.4], levels: [0, 0.5, 1] },
        }),
    ),
    contract: refused(
      () => new Z.ZhudaToonMaterial({ name: 'ZhudaToonCheck', outline: { color: LINE, width: 2 } }),
    ),
    width: refused(() => new Z.ZhudaSelectionOutline({ width: 20 })),
    own: refused(
      () =>
        new Z.ZhudaToonMaterial({
          name: 'ZhudaToonBad',
          uniforms: { u_ZhudaToonEdges: { type: 'vec4' } },
        }),
    ),
  };
  sun.light.shadowMode = Laya.ShadowMode.None;
  for (const node of all) if (!node.destroyed) node.destroy();
  for (const item of owned) (item.dispose ?? item.destroy).call(item);
  Z.ZhudaEngine.flushRenderFrames(2);
  out.resourcesLeft = held() - resourcesBefore;
  out.left = (() => {
    const now = census();
    return Object.keys(now)
      .filter((name) => now[name] !== (censusBefore[name] ?? 0))
      .map((name) => `${name} ${censusBefore[name] ?? 0}->${now[name]}`);
  })();
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
