// Real-draw fixture for scripts/verify-lighting-depth.mjs: a lamp whose
// light falls off with the square of the distance, a spot's penumbra, the
// width of the sun's soft shadow, cascades that meet without a line, contact
// shadows, and point-light shadows kept up to date by a schedule. What the
// screen shows is compared with the same arithmetic on the CPU.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__LIGHTING__ = out;
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
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
/** What the screen shows for a linear value. */
const shown = (linear: number) => 255 * clamp01(linear) ** (1 / 2.2);
const round1 = (v: number) => +v.toFixed(1);
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
const worstOf = (drawn: V[], expected: V[]) =>
  +Math.max(...drawn.map((d, i) => far(d, expected[i]))).toFixed(2);
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
const flush = (frames = 3) => Z.ZhudaEngine.flushRenderFrames(frames);

/**
 * `?time=1`: how long a frame takes with each part on, on the same scene
 * (balls on a floor under a shadowed sun and four lamps). The picture is as
 * large as the window, since the cost is by the pixel.
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
  camera.msaa = false;
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
  sun.node.transform.rotationEuler = v3([-45, 30, 0]);
  sun.light.shadowMode = Laya.ShadowMode.SoftHigh;
  sun.light.shadowDistance = 30;
  sun.light.shadowResolution = 2048;
  sun.light.shadowCascadesMode = Laya.ShadowCascadesMode.TwoCascades;
  const surface = Z.createSurfaceMaterial({
    type: 'pbr',
    color: [0.9, 0.5, 0.3, 1],
    roughness: 0.6,
  });
  const ground = new Laya.MeshSprite3D(
    Z.Zhuda3D.createPrimitiveMesh('box', { width: 24, height: 0.2, depth: 24 }),
  );
  ground.meshRenderer.receiveShadow = true;
  ground.meshRenderer.sharedMaterial = surface;
  ground.transform.position = v3([0, -0.1, 0]);
  scene.addChild(ground);
  const mesh = Laya.PrimitiveMesh.createSphere(0.45, 48, 48);
  for (let i = 0; i < 36; i++) {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.meshRenderer.sharedMaterial = surface;
    node.transform.position = v3([(i % 6) * 1.5 - 3.75, 0.45, Math.floor(i / 6) * 1.5 - 3.75]);
    scene.addChild(node);
  }
  for (const at of [
    [-3, 2, -3],
    [3, 2, -3],
    [-3, 2, 3],
    [3, 2, 3],
  ]) {
    const holder = new Laya.Sprite3D('lamp');
    scene.addChild(holder);
    holder.transform.position = v3(at);
    const light = holder.addComponent(Laya.PointLightCom);
    light.color = new Laya.Color(1, 0.8, 0.6, 1);
    light.intensity = 1;
    light.range = 6;
  }
  const film = new Z.ZhudaFilmicPipeline(camera, { bloom: false, ao: false });
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
  const plain = { falloff: 'laya', shadowSpread: 1, cascadeBlend: false, contactShadows: 0 };
  const made: Record<string, any> = {
    plain,
    physical: { ...plain, falloff: 'physical' },
    spread2: { ...plain, shadowSpread: 2 },
    blend: { ...plain, cascadeBlend: true },
    contact: { ...plain, contactShadows: 0.3 },
    all: { falloff: 'physical', shadowSpread: 2, cascadeBlend: true, contactShadows: 0.3 },
  };
  const cases: Record<string, number> = {};
  cases.none = measure();
  const lighting = new Z.ZhudaLightingDepth(scene, {}, camera);
  // Twice round, the lower of the two: the first pass also compiles.
  for (let round = 0; round < 2; round++)
    for (const [name, options] of Object.entries(made)) {
      lighting.set(options);
      const ms = measure();
      cases[name] = cases[name] === undefined ? ms : +Math.min(cases[name], ms).toFixed(2);
    }
  lighting.dispose();
  cases.noneAgain = measure();
  film.dispose();
  out.timing = { picture: [context.canvas.width, context.canvas.height], synced: !!gl, cases };
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
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));
  out.installed = Z.zhudaLightingDepthInstalled();

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0, 0, 0] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 10], fov: 40 });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0, 0, 0, 1);
  camera.msaa = false;
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);

  // --- Things to draw ------------------------------------------------------
  const made: { node: any; mesh: any }[] = [];
  const materials: any[] = [];
  const lights: any[] = [];
  const material = (spec: any) => {
    const m = Z.createSurfaceMaterial(spec);
    materials.push(m);
    return m;
  };
  const put = (mesh: any, at: V, surface: any, shadows = true) => {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = surface;
    node.meshRenderer.castShadow = shadows;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = v3(at);
    scene.addChild(node);
    made.push({ node, mesh });
    return node;
  };
  const box = (size: V, at: V, surface: any, shadows = true) =>
    put(
      Z.Zhuda3D.createPrimitiveMesh('box', { width: size[0], height: size[1], depth: size[2] }),
      at,
      surface,
      shadows,
    );
  const lamp = (kind: 'point' | 'spot', at: V, intensity: number, range: number) => {
    const holder = new Laya.Sprite3D('lamp');
    scene.addChild(holder);
    holder.transform.position = v3(at);
    const light = holder.addComponent(kind === 'spot' ? Laya.SpotLightCom : Laya.PointLightCom);
    light.color = new Laya.Color(1, 1, 1, 1);
    light.intensity = intensity;
    light.range = range;
    lights.push(holder);
    return { holder, light };
  };
  const clear = () => {
    for (const { node, mesh } of made.splice(0)) {
      node.removeSelf();
      node.destroy();
      mesh.destroy();
    }
    for (const holder of lights.splice(0)) holder.destroy(true);
    for (const m of materials.splice(0)) m.destroy();
    flush(2);
  };
  const look = (from: V, to: V, fov = 40, up: V = [0, 1, 0]) => {
    camera.orthographic = false;
    camera.fieldOfView = fov;
    camera.transform.position = v3(from);
    camera.transform.lookAt(v3(to), v3(up));
  };
  /** Where a point of the scene is in the picture, in pixels from the top left. */
  const where = (p: V) => {
    const e = camera.projectionViewMatrix.elements;
    const clip = [0, 1, 3].map((i) => e[i] * p[0] + e[4 + i] * p[1] + e[8 + i] * p[2] + e[12 + i]);
    return [(clip[0] / clip[2] / 2 + 0.5) * W, (0.5 - clip[1] / clip[2] / 2) * H];
  };
  const lightOf = (v: number) => (v / 255) ** 2.2;
  const plain = { bloom: false, ao: false, contrast: 1, saturation: 1, toneMapping: 'none' };
  /**
   * The light the screen shows at a point of the scene (green, 0..1): the
   * mean over the pixel the point falls in and `half` pixels round it.
   */
  const lightAt = (pixels: Uint8Array, p: V, half = 1) => {
    const [x, y] = where(p);
    // A pixel holds the points from its number up to the next: the floor, not the nearest.
    const cx = Math.floor(x),
      cy = Math.floor(y);
    let sum = 0,
      n = 0;
    for (let py = cy - half; py <= cy + half; py++)
      for (let px = cx - half; px <= cx + half; px++, n++) sum += pixels[(py * W + px) * 4 + 1];
    return lightOf(sum / n);
  };
  const shoot = (name?: string) => {
    flush(4);
    const pixels = read();
    if (name) saved[name] = pixels;
    return pixels;
  };
  const round3 = (v: number) => +v.toFixed(3);
  const white = () => material({ type: 'pbr', color: [1, 1, 1, 1], roughness: 1, metallic: 0 });

  flush();
  {
    // A chain, a shadowed sun and a lighting owner once made and let go: what
    // stays in LayaAir's pools is there from here on.
    const film = new Z.ZhudaFilmicPipeline(camera, plain);
    const sun = Z.Zhuda3D.createDirectionalLight(scene, { intensity: 1 });
    sun.light.shadowMode = Laya.ShadowMode.SoftHigh;
    const warm = new Z.ZhudaLightingDepth(scene, { contactShadows: 0.2 }, camera);
    box([1, 1, 1], [0, 0, 0], white());
    flush();
    warm.dispose();
    sun.light.shadowMode = Laya.ShadowMode.None;
    sun.node.destroy(true);
    film.dispose();
    clear();
  }
  flush();
  const before = held();

  // --- Falloff ---------------------------------------------------------------
  {
    // A lamp straight above a white floor, seen from above: the light under
    // it at several heights, with LayaAir's falloff and with the square's.
    box([40, 0.2, 40], [0, -0.1, 0], white(), false);
    look([0, 30, 0.001], [0, 0, 0], 20, [0, 0, -1]);
    const RANGE = 10;
    const HEIGHTS = [0.5, 1, 2, 4, 7, 9.5, 10.5];
    const film = new Z.ZhudaFilmicPipeline(camera, plain);
    const light = lamp('point', [0, 1, 0], 1, RANGE);
    const under = (mode: string, exposure: number) => {
      film.setGrade({ exposure });
      return HEIGHTS.map((h) => {
        light.holder.transform.position = v3([0, h, 0]);
        return lightAt(shoot(h === 2 ? 'falloff-' + mode : undefined), [0, 0, 0], 2) / exposure;
      });
    };
    const falloff: any = { heights: HEIGHTS, range: RANGE };
    // Without an owner the scene draws as LayaAir does.
    const bare = under('bare', 0.6);
    const owner = new Z.ZhudaLightingDepth(scene, {});
    const laya = under('laya', 0.6);
    owner.set({ falloff: 'physical' });
    // Under the lamp the square is far brighter up close: read at two exposures.
    const near = under('physical', 0.15),
      farther = under('physical-far', 3);
    owner.set({ falloff: 'laya' });
    const back = under('back', 0.6);
    owner.dispose();
    const gone = under('gone', 0.6);
    // As shares of the light at one unit, beside the arithmetic.
    const shares = (values: number[]) => values.map((v) => round3(v / values[1]));
    falloff.laya = {
      drawn: shares(laya),
      expected: HEIGHTS.map((h) =>
        round3(Z.zhudaLayaFalloff(h, RANGE) / Z.zhudaLayaFalloff(1, RANGE)),
      ),
    };
    // Each height from the exposure it is read best at (neither clipped nor near black).
    const physical = HEIGHTS.map((h, i) => (h <= 2 ? near[i] : farther[i]));
    falloff.physical = {
      drawn: shares(physical),
      expected: HEIGHTS.map((h) =>
        round3(Z.zhudaPhysicalFalloff(h, RANGE) / Z.zhudaPhysicalFalloff(1, RANGE)),
      ),
      // The two exposures agree where both can be read.
      overlap: [round3(near[2]), round3(farther[2])],
    };
    falloff.atOne = { laya: round3(laya[1]), physical: round3(near[1]) };
    falloff.unchanged = {
      bare: bare.map(round3),
      withOwner: laya.map(round3),
      back: back.map(round3),
      gone: gone.map(round3),
    };
    film.dispose();
    out.falloff = falloff;
    clear();
  }

  // --- A spot's penumbra -------------------------------------------------------
  {
    // A spot of 60 degrees four units above the floor, pointing down: the
    // light along a line from under it outward.
    box([40, 0.2, 40], [0, -0.1, 0], white(), false);
    look([0, 30, 0.001], [0, 0, 0], 20, [0, 0, -1]);
    const film = new Z.ZhudaFilmicPipeline(camera, { ...plain, exposure: 1 });
    const spot = lamp('spot', [0, 4, 0], 1, 30);
    spot.light.spotAngle = 60;
    spot.holder.transform.lookAt(v3([0, 0, 0]), v3([0, 0, 1]));
    const ANGLES = [0, 8, 15, 22, 27, 29, 31, 34];
    const along = (name: string) => {
      const pixels = shoot('spot-' + name);
      return ANGLES.map((a) => lightAt(pixels, [4 * Math.tan((a * Math.PI) / 180), 0, 0], 1));
    };
    const result: any = { angles: ANGLES };
    const bare = along('bare');
    const owner = new Z.ZhudaLightingDepth(scene, {});
    const unset = along('unset');
    const rows: Record<string, number[]> = {};
    for (const p of [0.5, 0.02, 0.25, 1]) {
      Z.setZhudaSpotPenumbra(spot.light, p);
      rows[String(p)] = along('penumbra-' + p);
    }
    // Against the hard-rimmed cone everything but the cone's own step cancels.
    const hard = rows['0.02'];
    result.shares = Object.fromEntries(
      Object.entries(rows).map(([p, values]) => [
        p,
        {
          drawn: values.map((v, i) => (hard[i] > 0.002 ? round3(v / hard[i]) : round3(v))),
          expected: ANGLES.map((a) =>
            a < 30 ? round3(Z.zhudaSpotCone(a, 60, +p) / Z.zhudaSpotCone(a, 60, 0.02)) : 0,
          ),
        },
      ]),
    );
    result.outside = Object.fromEntries(
      Object.entries(rows).map(([p, v]) => [p, v.slice(6).map(round3)]),
    );
    // LayaAir's own half is what a light without a penumbra gets, with and without the owner.
    result.unset = {
      bare: bare.map(round3),
      owner: unset.map(round3),
      half: rows['0.5'].map(round3),
    };
    // A second spot keeps its own: the first hard, the second soft.
    const other = lamp('spot', [6, 4, 0], 1, 30);
    other.light.spotAngle = 60;
    other.holder.transform.lookAt(v3([6, 0, 0]), v3([0, 0, 1]));
    Z.setZhudaSpotPenumbra(spot.light, 0.02);
    Z.setZhudaSpotPenumbra(other.light, 1);
    {
      const pixels = shoot('spot-two');
      const edge = 4 * Math.tan((22 * Math.PI) / 180);
      result.two = {
        hard: round3(lightAt(pixels, [-edge, 0, 0]) / lightAt(pixels, [0, 0, 0])),
        soft: round3(lightAt(pixels, [6 + edge, 0, 0]) / lightAt(pixels, [6, 0, 0])),
      };
    }
    Z.setZhudaSpotPenumbra(spot.light, null);
    Z.setZhudaSpotPenumbra(other.light, null);
    result.cleared = along('cleared').map(round3);
    owner.dispose();
    film.dispose();
    out.spot = result;
    clear();
  }

  // --- The sun's shadow: its width, its cascades, what it misses ------------
  {
    const ground = white();
    box([120, 0.2, 120], [0, -0.1, 0], ground, false);
    const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
    // From the left and a little behind, 45 degrees up: shadows fall toward +x.
    sun.node.transform.rotationEuler = v3([-45, -90, 0]);
    sun.light.shadowMode = Laya.ShadowMode.SoftHigh;
    sun.light.shadowDistance = 40;
    sun.light.shadowResolution = 1024;
    sun.light.shadowCascadesMode = Laya.ShadowCascadesMode.NoCascades;
    sun.light.shadowStrength = 1;
    const film = new Z.ZhudaFilmicPipeline(camera, { ...plain, exposure: 0.7 });
    const owner = new Z.ZhudaLightingDepth(scene, {}, camera);
    const shadows: any = {};

    // The edge of a wall's shadow, seen from above: how many pixels it takes from dark to lit.
    const wall = box([0.2, 2, 8], [0, 1, 0], ground);
    look([2, 14, 0.001], [2, 0, 0], 20, [0, 0, -1]);
    const edge = (name: string) => {
      const pixels = shoot('spread-' + name);
      const row = Math.round(H / 2);
      const values: number[] = [];
      for (let x = 0; x < W; x++) values.push(lightOf(pixels[(row * W + x) * 4 + 1]));
      const lit = values[W - 20],
        dark = Math.min(...values.slice(W / 2, W - 20));
      // From a tenth to nine tenths of the way from dark to lit, right of the wall.
      const at = (share: number) => {
        const level = dark + (lit - dark) * share;
        for (let x = W - 20; x > W / 2; x--) if (values[x] < level) return x;
        return W / 2;
      };
      return { pixels: at(0.9) - at(0.1), lit: round3(lit), dark: round3(dark) };
    };
    shadows.spread = { one: edge('1') };
    owner.set({ shadowSpread: 2 });
    shadows.spread.two = edge('2');
    owner.set({ shadowSpread: 3.5 });
    shadows.spread.wide = edge('3.5');
    owner.set({ shadowSpread: 1 });
    shadows.spread.back = edge('back');
    wall.removeSelf();

    // A long wall going away from the camera: its shadow lies beside it all
    // the way. Where the shadow ends, with and without the blend.
    sun.light.shadowCascadesMode = Laya.ShadowCascadesMode.TwoCascades;
    sun.light.shadowDistance = 24;
    const long = box([0.1, 1.5, 70], [-1, 0.75, -33], ground);
    look([0.5, 7, 4], [-0.3, 0, -22], 45);
    const DISTANCES: number[] = [];
    for (let d = 6; d <= 44; d += 1) DISTANCES.push(d);
    const along = (name: string) => {
      const pixels = shoot('cascade-' + name);
      // How dark the ground is beside the wall at each distance: 1 is the full shadow.
      return DISTANCES.map((d) => {
        const lit = lightAt(pixels, [-3, 0, 4 - d], 2),
          shade = lightAt(pixels, [-0.3, 0, 4 - d], 2);
        return round3(1 - shade / Math.max(lit, 1e-4));
      });
    };
    shadows.ends = { distances: DISTANCES, plain: along('plain') };
    owner.set({ cascadeBlend: true });
    shadows.ends.blended = along('blend');
    // How much of the picture the blend changes: the bands, not the whole.
    {
      const a = saved['cascade-plain'],
        b = saved['cascade-blend'];
      let changed = 0;
      for (let i = 0; i < a.length; i += 4) if (a[i + 1] !== b[i + 1]) changed++;
      shadows.ends.changedShare = round3(changed / (W * H));
    }
    owner.set({ cascadeBlend: false });
    shadows.ends.back = difference(saved['cascade-plain'], shoot());
    long.removeSelf();

    // What a coarse shadow map misses: a low kerb, beyond the shadow's distance.
    sun.light.shadowCascadesMode = Laya.ShadowCascadesMode.NoCascades;
    sun.light.shadowDistance = 2.5;
    const kerb = box([0.1, 0.12, 6], [0, 0.06, -12], ground);
    const POINTS = [0.06, 0.1, 0.16, 0.3, 0.6];
    const beside = (name: string) => {
      const pixels = shoot('contact-' + name);
      // The kerb's side toward +x is in its own shade for 0.12 units.
      return {
        shade: POINTS.map((x) => round3(lightAt(pixels, [0.05 + x, 0, -12]))),
        lit: round3(lightAt(pixels, [-0.6, 0, -12])),
      };
    };
    look([0.2, 2.2, -8.5], [0.2, 0, -12], 30);
    shadows.contact = { points: POINTS, off: beside('off') };
    owner.set({ contactShadows: 0.3 });
    shadows.contact.on = beside('on');
    // A flat view: the same.
    camera.orthographic = true;
    camera.orthographicVerticalSize = 2.5;
    shadows.contact.flat = beside('flat');
    camera.orthographic = false;
    owner.set({ contactShadows: 0.1 });
    shadows.contact.short = beside('short');
    // Flat ground and the lit side of a slope do not shade themselves.
    look([0, 3, -6], [0, 0, -12], 40);
    {
      const pixels = shoot('contact-ground');
      shadows.contact.ground = [
        round3(lightAt(pixels, [-2, 0, -10])),
        round3(lightAt(pixels, [2, 0, -14])),
      ];
    }
    owner.set({ contactShadows: 0 });
    {
      const pixels = shoot('contact-ground-off');
      shadows.contact.groundOff = [
        round3(lightAt(pixels, [-2, 0, -10])),
        round3(lightAt(pixels, [2, 0, -14])),
      ];
    }
    // Without an HDR chain the camera draws straight to the canvas: the same shade.
    look([0.2, 2.2, -8.5], [0.2, 0, -12], 30);
    // (The chain puts the camera's depth setting back as it found it: ask after it has gone.)
    film.dispose();
    owner.set({ contactShadows: 0.3 });
    shadows.contact.bare = beside('bare');
    owner.set({ contactShadows: 0 });
    shadows.contact.bareOff = beside('bare-off');
    kerb.removeSelf();
    shadows.depthAsked = (camera.depthTextureMode & Laya.DepthTextureMode.Depth) !== 0;
    owner.dispose();
    film.dispose();
    sun.light.shadowMode = Laya.ShadowMode.None;
    sun.node.destroy(true);
    out.shadows = shadows;
    clear();
  }

  // --- Point-light shadows on a schedule ------------------------------------
  {
    const ground = white();
    box([30, 0.2, 30], [0, -0.1, 0], ground, false);
    look([0, 16, 0.001], [0, 0, 0], 40, [0, 0, -1]);
    const film = new Z.ZhudaFilmicPipeline(camera, { ...plain, exposure: 1.5 });
    const LAMPS: V[] = [
      [-5, 3, 0],
      [5, 3, 0],
    ];
    const lamps = LAMPS.map((at) => lamp('point', at, 2, 12));
    const shadow = new Z.ZhudaPointShadow(scene, { lights: 2 });
    let draws: number[] = [];
    const schedule = new Z.ZhudaPointShadowSchedule(
      (position: V, range: number, light: number) => {
        draws.push(light);
        shadow.render(position, range, light);
      },
      { perFrame: 1 },
      (light: number) => shadow.clear(light),
    );
    const blocks = LAMPS.map((at) => box([0.8, 0.8, 0.8], [at[0], 0.4, 2], ground));
    LAMPS.forEach((at, i) => schedule.set(i, { position: at as any, range: 12 }));
    /**
     * The light on the ground just behind where a block may stand (away from
     * its lamp), against the ground as far to the side: under 0.2 is its shadow.
     */
    const behind = (z: number) => {
      const pixels = shoot();
      return LAMPS.map((at) =>
        round3(
          lightAt(pixels, [at[0], 0, z]) /
            Math.max(lightAt(pixels, [at[0] + Math.abs(z), 0, 0]), 1e-4),
        ),
      );
    };
    const result: any = {};
    result.first = [schedule.update(), schedule.update(), schedule.update()];
    result.shaded = behind(2.8);
    // Both blocks move; the game says so for the first lamp only.
    for (const [i, block] of blocks.entries())
      block.transform.position = v3([LAMPS[i][0], 0.4, -2]);
    schedule.touch(0);
    result.afterTouch = schedule.update();
    saved['schedule-touched'] = shoot();
    // The first lamp's shadow followed its block; the second's is where it was.
    result.moved = { newPlace: behind(-2.8), oldPlace: behind(2.8) };
    schedule.touch();
    result.afterTouchAll = [schedule.update(), schedule.update()];
    result.both = behind(-2.8);
    // A lamp that moves is out of date by itself.
    schedule.set(1, { position: [5, 3, 1] as any, range: 12 });
    result.afterMove = schedule.update();
    schedule.remove(1);
    result.afterRemove = [schedule.pending(), schedule.update()];
    result.draws = draws;
    shadow.dispose();
    film.dispose();
    out.schedule = result;
    clear();
  }

  // --- A look names them ------------------------------------------------------
  {
    const ground = white();
    box([120, 0.2, 120], [0, -0.1, 0], ground, false);
    box([0.1, 0.12, 6], [0, 0.06, -12], ground);
    // A lamp over the ground far from the kerb, to read the falloff by.
    const bulb = lamp('point', [8, 1, -12], 0.5, 10);
    const authored = {
      preset: 'day',
      ambient: [0, 0, 0],
      ambientGround: false,
      sun: { elevationDeg: 45, azimuthDeg: -90, intensity: 1, color: [1, 1, 1] },
      shadows: { distance: 5, cascades: 1 },
      atmosphere: false,
      fog: false,
      grade: { toneMapping: 'none', bloom: 0, ao: 0, antialias: 'none', exposure: 0.7 },
    };
    const sceneLook = new Z.ZhudaSceneLook(scene, camera, authored);
    look([0.2, 3, -6.5], [0.2, 0, -12], 30);
    const result: any = {};
    const reading = (name: string) => {
      const pixels = shoot('look-' + name);
      const under = (h: number) => {
        bulb.holder.transform.position = v3([8, h, -12]);
        look([8, 12, -11.999], [8, 0, -12], 20, [0, 0, -1]);
        const value = lightAt(shoot(), [8, 0, -12], 2);
        look([0.2, 3, -6.5], [0.2, 0, -12], 30);
        return value;
      };
      return {
        kerb: round3(lightAt(pixels, [0.05 + 0.06, 0, -12])),
        open: round3(lightAt(pixels, [-0.6, 0, -12])),
        // The lamp's light under it at two units against one, without the sun's (the lamp out of reach).
        twoToOne: round3((under(2) - under(50)) / (under(1) - under(50))),
      };
    };
    result.plain = reading('plain');
    result.updated = sceneLook.setLook({
      ...authored,
      lightFalloff: 'physical',
      shadows: { ...authored.shadows, contact: 0.3, spread: 2, blend: true },
    });
    result.asked = reading('asked');
    // One level down the contact shadows go; how lamps fall off stays.
    sceneLook.setQuality(1);
    result.lower = reading('lower');
    sceneLook.setQuality(3);
    result.again = reading('again');
    result.back = sceneLook.setLook(authored);
    result.plainAgain = reading('plain-again');
    sceneLook.dispose();
    out.look = result;
    clear();
  }

  flush();
  out.resourcesLeft = held() - before;
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}

main().catch((error) => {
  out.error = String(error?.stack ?? error);
});
