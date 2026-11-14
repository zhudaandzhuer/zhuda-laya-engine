// Real-draw fixture for scripts/verify-post-quality.mjs: the tone curves,
// a colour table from a .cube file, white balance and lift/gamma/gain,
// bloom's knee, shape and lens dirt, edge smoothing by SMAA, ambient
// occlusion from the depth picture and the lens flare. Pictures of known
// light are put through the chain and what the screen shows is compared
// with the same arithmetic on the CPU.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__POST__ = out;
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

/** A picture of scene light: `at(x, y)` gives the colour of a pixel, top row first. */
const pictureOf = (at: (x: number, y: number) => V) => {
  const data = new Float32Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const c = at(x, y);
      data.set([c[0], c[1], c[2], 1], (y * W + x) * 4);
    }
  return data;
};
/** Puts a picture of scene light through the display part of a chain and reads the screen. */
const through = (film: any, data: Float32Array) => {
  const chain = film.linearChain();
  chain.beginSamples();
  chain.beginResolve(data, W, H);
  flush();
  const pixels = read();
  chain.end();
  return pixels;
};
/** The same for patches side by side: what the screen shows for each. */
const chart = (film: any, patches: V[], keep?: string) => {
  const wide = W / patches.length;
  const pixels = through(
    film,
    pictureOf((x) => patches[Math.min(patches.length - 1, Math.floor(x / wide))]),
  );
  if (keep) saved[keep] = pixels;
  return patches.map((_, i) => patch(pixels, (i + 0.5) * wide, H / 2, 3));
};

/**
 * `?time=1`: how long a frame takes with each of the parts on, on the same
 * scene (balls on a floor under a shadowed sun). The picture is as large as
 * the window, since the cost is by the pixel.
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
  sun.node.transform.rotationEuler = v3([-35, 150, 0]);
  sun.light.shadowMode = Laya.ShadowMode.SoftLow;
  sun.light.shadowDistance = 30;
  sun.light.shadowResolution = 1024;
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
  const table = new Z.ZhudaColorLut(Z.zhudaIdentityCubeLut(33));
  const flare = new Z.ZhudaLensFlare();
  const forward = new Laya.Vector3();
  sun.node.transform.getForward(forward);
  flare.setLight({ toward: [-forward.x, -forward.y, -forward.z] });
  const smaa = { low: new Z.ZhudaSmaa({ quality: 'low' }), high: new Z.ZhudaSmaa() };
  const fxaa = new Z.ZhudaEdgeSmoothing();
  const base = { bloom: false, ao: false };
  const made: Record<string, () => any> = {
    graded: () => base,
    agx: () => ({ ...base, toneMapping: 'agx' }),
    neutral: () => ({ ...base, toneMapping: 'neutral' }),
    fxaa: () => ({ ...base, finishEffects: [fxaa.effect] }),
    smaaLow: () => ({ ...base, finishEffects: [smaa.low.effect] }),
    smaaHigh: () => ({ ...base, finishEffects: [smaa.high.effect] }),
    table: () => ({ ...base, finishEffects: [table.effect] }),
    sao: () => ({ ...base, ao: true }),
    gtao: () => ({ ...base, ao: true, aoMethod: 'gtao' }),
    gtaoHalf: () => ({ ...base, ao: true, aoMethod: 'gtao', aoHalfSize: true }),
    flare: () => ({ ...base, sceneEffects: [flare.effect] }),
  };
  const cases: Record<string, number> = {};
  // Twice round, the lower of the two: the first pass also compiles.
  for (let round = 0; round < 2; round++)
    for (const [name, options] of Object.entries(made)) {
      const film = new Z.ZhudaFilmicPipeline(camera, options());
      const ms = measure();
      film.dispose();
      cases[name] = cases[name] === undefined ? ms : +Math.min(cases[name], ms).toFixed(2);
    }
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
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0, 0, 0] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 10], fov: 40 });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0, 0, 0, 1);
  camera.msaa = false;
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
  flush();
  // A chain and a shadowed look once made and let go: what stays in LayaAir's
  // pools (a shadow map among it) is there from here on.
  new Z.ZhudaFilmicPipeline(camera, { bloom: false, ao: false }).dispose();
  {
    // Drawn before it is let go: the shadow map is made by the first frame.
    const warm = new Z.ZhudaSceneLook(scene, camera, { preset: 'day', grade: {} });
    flush();
    warm.dispose();
  }
  flush();
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
  const before = held();
  const censusBefore = census();

  // --- The curves ---------------------------------------------------------
  // Greys from deep shadow to far above white, colours dim and bright, and
  // one colour beyond the end of the grade's table.
  const PATCHES: V[] = [
    ...[0, 0.002, 0.01, 0.05, 0.18, 0.5, 1, 2, 4, 8, 16, 32].map((v) => [v, v, v]),
    [0.5, 0.05, 0.05],
    [4, 0.4, 0.4],
    [16, 1.6, 1.6],
    [0.05, 0.05, 0.5],
    [0.4, 0.4, 4],
    [0.05, 0.4, 0.05],
    [0.6, 0.45, 0.1],
    [3, 2, 0.5],
    [112, 28, 14],
  ];
  /** What reaches the table: exposed, and scaled back to the table's end. */
  const tabled = (c: V, exposure: number) => {
    const peak = Math.max(...c) * exposure;
    return c.map((v) => v * exposure * Math.min(1, Z.ZHUDA_GRADE_TABLE_MAX / peak));
  };
  const expectedFor = (kind: string, exposure: number) =>
    PATCHES.map((c) =>
      Z.zhudaToneMap(kind, tabled(c, exposure)).map((v: number) => round1(shown(v))),
    );
  const plain = { bloom: false, ao: false, contrast: 1, saturation: 1 };
  out.tone = {};
  for (const kind of ['aces', 'agx', 'neutral', 'none']) {
    const film = new Z.ZhudaFilmicPipeline(camera, { ...plain, toneMapping: kind });
    const drawn = chart(film, PATCHES, 'tone-' + kind);
    const entry: any = { drawn, is: film.toneMapping };
    if (kind !== 'aces') {
      entry.expected = expectedFor(kind, 1);
      entry.worst = worstOf(drawn, entry.expected);
      film.setGrade({ exposure: 2.5 });
      const exposed = chart(film, PATCHES);
      entry.exposedWorst = worstOf(exposed, expectedFor(kind, 2.5));
    }
    film.dispose();
    out.tone[kind] = entry;
  }
  {
    // One chain, the curve changed while it runs, and back.
    const film = new Z.ZhudaFilmicPipeline(camera, plain);
    const steps: Record<string, number> = {};
    const first = chart(film, PATCHES);
    for (const kind of ['agx', 'neutral', 'none', 'aces']) {
      film.setGrade({ toneMapping: kind });
      steps[kind] = worstOf(chart(film, PATCHES), out.tone[kind].drawn);
    }
    steps.acesAgain = worstOf(chart(film, PATCHES), first);
    // A capture's chain is put together again: the curve must still be the one asked for.
    film.setGrade({ toneMapping: 'agx' });
    steps.afterRebuild = worstOf(chart(film, PATCHES), out.tone.agx.drawn);
    film.dispose();
    out.tone.inPlace = steps;
  }

  // --- White balance, lift, gamma, gain ----------------------------------
  {
    const GREYS: V[] = [0.05, 0.18, 0.4].map((v) => [v, v, v]);
    const film = new Z.ZhudaFilmicPipeline(camera, { ...plain, toneMapping: 'none' });
    const balance: any = { plain: chart(film, GREYS) };
    for (const [name, values] of Object.entries({
      warm: { temperature: 60, tint: 0 },
      cool: { temperature: -60, tint: 0 },
      magenta: { temperature: 0, tint: 60 },
      green: { temperature: 0, tint: -60 },
      back: { temperature: 0, tint: 0 },
    })) {
      film.setGrade(values);
      balance[name] = chart(film, GREYS);
    }
    const lgg: any = {};
    const cases: Record<string, { set: any; expect: (v: number) => V }> = {
      gain: { set: { gain: [2, 1, 0.5] }, expect: (v) => [v * 2, v, v * 0.5] },
      lift: {
        set: { gain: [1, 1, 1], lift: [0.1, 0, 0.05] },
        expect: (v) => [v + 0.1, v, v + 0.05],
      },
      gamma: {
        set: { lift: [0, 0, 0], gamma: [2, 1, 0.5] },
        expect: (v) => [v * v, v, Math.sqrt(v)],
      },
      all: {
        set: { lift: [0.02, 0.02, 0.02], gamma: [1.5, 1.5, 1.5], gain: [1.5, 1.5, 1.5] },
        expect: (v) => [1, 1, 1].map(() => (v * 1.5 + 0.02) ** 1.5),
      },
      back: {
        set: { lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1] },
        expect: (v) => [v, v, v],
      },
    };
    for (const [name, { set, expect }] of Object.entries(cases)) {
      film.setGrade(set);
      const drawn = chart(film, GREYS);
      const expected = GREYS.map((g) => expect(g[0]).map((v) => round1(shown(v))));
      lgg[name] = { drawn, expected, worst: worstOf(drawn, expected) };
    }
    film.dispose();
    out.balance = balance;
    out.liftGammaGain = lgg;
  }

  // --- A colour table ------------------------------------------------------
  {
    const text = await (await fetch('fixtures/look.cube')).text();
    const look = Z.parseZhudaCubeLut(text);
    const SWATCHES: V[] = [
      [0.02, 0.02, 0.02],
      [0.18, 0.18, 0.18],
      [0.6, 0.6, 0.6],
      [1, 1, 1],
      [0.7, 0.1, 0.05],
      [0.05, 0.5, 0.1],
      [0.05, 0.1, 0.7],
      [0.8, 0.6, 0.1],
      [0.1, 0.6, 0.7],
      [0.33, 0.07, 0.41],
    ];
    const display = (c: V) => c.map((v) => clamp01(v) ** (1 / 2.2));
    const expectedWith = (lut: any, strength: number) =>
      SWATCHES.map((c) => {
        const d = display(c),
          g = Z.zhudaSampleCubeLut(lut, d);
        return d.map((v, k) => round1(255 * clamp01(v + (g[k] - v) * strength)));
      });
    const none = new Z.ZhudaFilmicPipeline(camera, { ...plain, toneMapping: 'none' });
    const untouched = chart(none, SWATCHES);
    none.dispose();
    const cases: any = { title: look.title, size: look.size };
    const run = (name: string, lut: any, strength: number, keep?: string) => {
      const table = new Z.ZhudaColorLut(lut, { intensity: strength });
      const film = new Z.ZhudaFilmicPipeline(camera, {
        ...plain,
        toneMapping: 'none',
        finishEffects: [table.effect],
      });
      const drawn = chart(film, SWATCHES, keep);
      const expected = expectedWith(lut, strength);
      cases[name] = { drawn, expected, worst: worstOf(drawn, expected) };
      // Another table and another strength in place.
      if (name === 'look') {
        table.setIntensity(0.5);
        const half = chart(film, SWATCHES);
        cases.half = { worst: worstOf(half, expectedWith(lut, 0.5)) };
        table.setLut(Z.zhudaIdentityCubeLut(4));
        table.setIntensity(1);
        cases.replaced = { worst: worstOf(chart(film, SWATCHES), untouched) };
      }
      film.dispose();
      table.dispose();
    };
    run('look', look, 1, 'lut-look');
    run('identity2', Z.zhudaIdentityCubeLut(2), 1);
    run('identity33', Z.zhudaIdentityCubeLut(33), 1);
    run('identity65', Z.zhudaIdentityCubeLut(65), 1);
    // Red, green and blue changed round: exact at every entry, and nothing bleeds between slices.
    const turned = Z.zhudaIdentityCubeLut(17);
    for (let i = 0; i < turned.data.length; i += 3) {
      const [r, g, b] = [turned.data[i], turned.data[i + 1], turned.data[i + 2]];
      turned.data.set([g, b, r], i);
    }
    run('turned', turned, 1, 'lut-turned');
    // A table whose entries stand for 0.25..0.75: what is outside takes the edge.
    const narrow = Z.zhudaIdentityCubeLut(9);
    narrow.domainMin = [0.25, 0.25, 0.25];
    narrow.domainMax = [0.75, 0.75, 0.75];
    run('narrow', narrow, 1);
    cases.untouchedWorst = worstOf(
      untouched,
      SWATCHES.map((c) => display(c).map((v) => round1(255 * v))),
    );
    out.lut = cases;
  }

  // --- Edge smoothing ------------------------------------------------------
  {
    const light = (v: number) => (v / 255) ** 2.2;
    /** A hard-edged half-plane (bright where nx*x + ny*y < d), and how much of each pixel it truly covers. */
    const halfPlane = (nx: number, ny: number, d: number, hi: V, lo: V) => {
      const inside = (x: number, y: number) => nx * x + ny * y < d;
      const hard = pictureOf((x, y) => (inside(x + 0.5, y + 0.5) ? hi : lo));
      const cover = new Float32Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          let n = 0;
          for (let sy = 0; sy < 8; sy++)
            for (let sx = 0; sx < 8; sx++) if (inside(x + (sx + 0.5) / 8, y + (sy + 0.5) / 8)) n++;
          cover[y * W + x] = n / 64;
        }
      return { hard, cover, hi, lo };
    };
    /** Mean and worst distance, in light, from the true coverage over the pixels the edge crosses and those beside them. */
    const errorOf = (pixels: Uint8Array, shape: ReturnType<typeof halfPlane>) => {
      let sum = 0,
        worst = 0,
        n = 0;
      const crossed = (x: number, y: number) => {
        const c = shape.cover[y * W + x];
        return c > 0 && c < 1;
      };
      for (let y = 8; y < H - 8; y++)
        for (let x = 8; x < W - 8; x++) {
          if (
            !(
              crossed(x, y) ||
              crossed(x - 1, y) ||
              crossed(x + 1, y) ||
              crossed(x, y - 1) ||
              crossed(x, y + 1)
            )
          )
            continue;
          const c = shape.cover[y * W + x];
          for (let k = 0; k < 3; k++) {
            const want = shape.lo[k] + (shape.hi[k] - shape.lo[k]) * c;
            const e = Math.abs(light(pixels[(y * W + x) * 4 + k]) - want);
            sum += e;
            if (e > worst) worst = e;
            n++;
          }
        }
      return { mean: +(sum / n).toFixed(4), worst: +worst.toFixed(3), pixels: n / 3 };
    };
    const WHITE = [1, 1, 1],
      BLACK = [0, 0, 0];
    const deg = (a: number) => [Math.sin((a * Math.PI) / 180), Math.cos((a * Math.PI) / 180)];
    const shapes: Record<string, ReturnType<typeof halfPlane>> = {};
    // The edge at 4, 12, 27, 45, 63 and 83 degrees from level, through the middle of the frame.
    for (const angle of [4, 12, 27, 45, 63, 83]) {
      const [nx, ny] = deg(angle);
      shapes['deg' + angle] = halfPlane(
        nx,
        ny,
        nx * (W / 2 + 0.3) + ny * (H / 2 + 0.2),
        WHITE,
        BLACK,
      );
    }
    {
      const [nx, ny] = deg(12);
      const d = nx * (W / 2 + 0.3) + ny * (H / 2 + 0.2);
      shapes.dim = halfPlane(nx, ny, d, [0.5, 0.5, 0.5], [0.2, 0.2, 0.2]);
      shapes.coloured = halfPlane(nx, ny, d, [0.9, 0.3, 0.1], [0.1, 0.3, 0.8]);
    }
    const makers: Record<string, () => { effect: any; dispose(): void } | null> = {
      none: () => null,
      fxaa: () => new Z.ZhudaEdgeSmoothing(),
      smaaLow: () => new Z.ZhudaSmaa({ quality: 'low' }),
      smaaMedium: () => new Z.ZhudaSmaa({ quality: 'medium' }),
      smaaHigh: () => new Z.ZhudaSmaa(),
      smaaUltra: () => new Z.ZhudaSmaa({ quality: 'ultra' }),
      // Corners rounded as the reference does, and as any step.
      smaaRounded: () => new Z.ZhudaSmaa({ cornerRounding: 0.25 }),
      smaaRound: () => new Z.ZhudaSmaa({ cornerRounding: 1 }),
    };
    // Things that are not edges: one colour, a slow ramp, and grain too faint to be an edge.
    const flat = pictureOf(() => [0.3, 0.5, 0.2]);
    const ramp = pictureOf((x, y) => [x / W, y / H, 0.25]);
    let seed = 7;
    const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
    const grainValues = new Float32Array(W * H).map(() => 0.3 + 0.02 * noise());
    const grain = pictureOf((x, y) => {
      const v = grainValues[y * W + x];
      return [v, v, v];
    });
    // A box with level and upright sides: nothing to smooth but its four corners.
    const box = pictureOf((x, y) => (x >= 150 && x < 330 && y >= 90 && y < 210 ? WHITE : BLACK));
    const smoothing: any = { errors: {}, untouched: {} };
    const plainPictures: Record<string, Uint8Array> = {};
    for (const [name, make] of Object.entries(makers)) {
      const made = make();
      const film = new Z.ZhudaFilmicPipeline(camera, {
        ...plain,
        toneMapping: 'none',
        finishEffects: made ? [made.effect] : [],
      });
      const errors: any = {};
      for (const [shape, data] of Object.entries(shapes)) {
        const pixels = through(film, data.hard);
        errors[shape] = errorOf(pixels, data);
        if (shape === 'deg12') saved['edge-' + name] = pixels;
      }
      smoothing.errors[name] = errors;
      const untouched: any = {};
      for (const [what, data] of Object.entries({ flat, ramp, grain, box })) {
        const pixels = through(film, data);
        if (name === 'none') plainPictures[what] = pixels;
        else {
          const d = difference(pixels, plainPictures[what]);
          let changed = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              pixels[i] !== plainPictures[what][i] ||
              pixels[i + 1] !== plainPictures[what][i + 1] ||
              pixels[i + 2] !== plainPictures[what][i + 2]
            )
              changed++;
          untouched[what] = { ...d, changed };
        }
      }
      if (name !== 'none') smoothing.untouched[name] = untouched;
      film.dispose();
      made?.dispose();
    }
    // The quality changed in place is the quality built with.
    {
      const smaa = new Z.ZhudaSmaa({ quality: 'low' });
      const film = new Z.ZhudaFilmicPipeline(camera, {
        ...plain,
        toneMapping: 'none',
        finishEffects: [smaa.effect],
      });
      through(film, shapes.deg4.hard);
      smaa.set({ quality: 'ultra' });
      smoothing.inPlace = errorOf(through(film, shapes.deg4.hard), shapes.deg4);
      film.dispose();
      smaa.dispose();
    }
    out.smoothing = smoothing;
  }

  // --- Things to draw ------------------------------------------------------
  const made: { node: any; mesh: any }[] = [];
  const materials: any[] = [];
  const material = (spec: any) => {
    const m = Z.createSurfaceMaterial(spec);
    materials.push(m);
    return m;
  };
  const put = (mesh: any, at: V, surface: any, shadows = false) => {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = surface;
    node.meshRenderer.castShadow = shadows;
    node.meshRenderer.receiveShadow = shadows;
    node.transform.position = v3(at);
    scene.addChild(node);
    made.push({ node, mesh });
    return node;
  };
  const box = (size: V, at: V, surface: any, shadows = false) =>
    put(
      Z.Zhuda3D.createPrimitiveMesh('box', { width: size[0], height: size[1], depth: size[2] }),
      at,
      surface,
      shadows,
    );
  const clear = () => {
    for (const { node, mesh } of made.splice(0)) {
      node.removeSelf();
      node.destroy();
      mesh.destroy();
    }
    for (const m of materials.splice(0)) m.destroy();
    flush(2);
  };
  const look = (from: V, to: V, fov = 40) => {
    camera.orthographic = false;
    camera.fieldOfView = fov;
    camera.transform.position = v3(from);
    camera.transform.lookAt(v3(to), v3([0, 1, 0]));
  };
  /** Where a point of the scene is in the picture, in pixels from the top left. */
  const where = (p: V) => {
    const e = camera.projectionViewMatrix.elements;
    const clip = [0, 1, 3].map((i) => e[i] * p[0] + e[4 + i] * p[1] + e[8 + i] * p[2] + e[12 + i]);
    return [(clip[0] / clip[2] / 2 + 0.5) * W, (0.5 - clip[1] / clip[2] / 2) * H];
  };
  const lightOf = (v: number) => +((v / 255) ** 2.2).toFixed(3);

  // --- Ambient occlusion ---------------------------------------------------
  {
    // A floor and a wall that meet, a ball and a post on the floor, all plain
    // white and unlit under a white sky: the picture is the occlusion itself.
    const white = material({ type: 'unlit', color: [1, 1, 1, 1] });
    box([14, 0.2, 14], [0, -0.1, 0], white);
    box([14, 2.4, 0.2], [0, 1.2, -2], white);
    put(Laya.PrimitiveMesh.createSphere(0.5, 48, 48), [2.5, 0.5, 0.2], white);
    box([0.3, 2, 0.3], [-2.5, 1, 0.2], white);
    camera.clearColor = new Laya.Color(1, 1, 1, 1);
    look([0, 3.2, 4.5], [0, 0.2, -1.2]);
    const DISTANCES = [0.04, 0.1, 0.2, 0.3, 0.45, 0.7, 1, 1.6];
    const options = { ...plain, toneMapping: 'none', ao: true, aoRadius: 0.5 };
    const measure = (name: string, film: any) => {
      flush(4);
      const pixels = read();
      saved['ao-' + name] = pixels;
      const at = (p: V) => {
        const [x, y] = where(p);
        return lightOf(patch(pixels, x, y, 1)[1]);
      };
      // Along a row of the floor a fifth of a unit from the wall: what is left of the dither.
      const [, row] = where([0, 0, -1.9 + 0.2]);
      const run: number[] = [];
      for (let x = W / 2 - 40; x < W / 2 + 40; x++)
        run.push(pixels[(Math.round(row) * W + x) * 4 + 1]);
      const mean = run.reduce((s, v) => s + v, 0) / run.length;
      return {
        floor: DISTANCES.map((d) => at([0, 0, -1.9 + d])),
        wall: DISTANCES.map((d) => at([0, d, -1.9])),
        open: at([0, 0, 1.5]),
        openWall: at([0, 1.6, -1.9]),
        sky: lightOf(patch(pixels, 20, 6, 1)[1]),
        underBall: at([2.5, 0, 0.2 + 0.62]),
        besidePost: at([-2.5 + 0.22, 0, 0.2 + 0.22]),
        grain: +Math.sqrt(run.reduce((s, v) => s + (v - mean) ** 2, 0) / run.length).toFixed(2),
        // A chain that is not there any more darkens nothing.
        errors: film ? undefined : 'off',
      };
    };
    const ao: any = {};
    {
      const film = new Z.ZhudaFilmicPipeline(camera, { ...options, ao: false });
      ao.off = measure('off', null);
      film.dispose();
    }
    {
      const film = new Z.ZhudaFilmicPipeline(camera, { ...options, aoMethod: 'gtao' });
      ao.gtao = measure('gtao', film);
      film.setGrade({ aoIntensity: 2 });
      ao.gtaoTwice = measure('gtao-twice', film);
      film.setGrade({ aoIntensity: 1, aoRadius: 1 });
      ao.gtaoWide = measure('gtao-wide', film);
      film.setGrade({ aoRadius: 0.5 });
      film.groundAO.set({ slices: 4, steps: 8 });
      ao.gtaoFine = measure('gtao-fine', film);
      film.groundAO.set({ slices: 2, steps: 4 });
      // A flat view: the same crease.
      camera.orthographic = true;
      camera.orthographicVerticalSize = 5;
      ao.gtaoFlat = measure('gtao-flat', film);
      camera.orthographic = false;
      film.dispose();
    }
    {
      const film = new Z.ZhudaFilmicPipeline(camera, {
        ...options,
        aoMethod: 'gtao',
        aoHalfSize: true,
      });
      ao.gtaoHalf = measure('gtao-half', film);
      film.dispose();
    }
    {
      // LayaAir's own, at the strength the engine has used so far and at full strength.
      const film = new Z.ZhudaFilmicPipeline(camera, { ...options, aoIntensity: 0.65 });
      ao.sao = measure('sao', film);
      film.setGrade({ aoIntensity: 1.5 });
      ao.saoStrong = measure('sao-strong', film);
      film.dispose();
    }
    ao.distances = DISTANCES;
    ao.depthFormat = [
      camera.depthTextureFormat,
      Laya.RenderTargetFormat.DEPTH_16,
      Laya.RenderTargetFormat.DEPTHSTENCIL_24_8,
      Laya.RenderTargetFormat.DEPTH_32,
    ];
    out.ao = ao;
    clear();
    camera.clearColor = new Laya.Color(0, 0, 0, 1);
  }

  // --- Lens flare ------------------------------------------------------------
  {
    look([0, 0, 0], [0, 0, -1]);
    const tanY = Math.tan((20 * Math.PI) / 180),
      tanX = (tanY * W) / H;
    /** The direction that lands at this place in the picture (0..1 from the bottom left). */
    const toward = (u: number, v: number): V => [(u * 2 - 1) * tanX, (v * 2 - 1) * tanY, -1];
    const pixelOf = (u: number, v: number) => [u * W, (1 - v) * H];
    const ELEMENTS = [
      { shape: 'disc', at: 0, size: 0.2, color: [1, 1, 1], strength: 0.5, softness: 0.05 },
      {
        shape: 'polygon',
        at: 0.6,
        size: 0.14,
        color: [0.3, 1, 0.3],
        strength: 0.3,
        sides: 6,
        softness: 0.05,
      },
      { shape: 'disc', at: 1.5, size: 0.16, color: [1, 0.5, 0.25], strength: 0.4 },
      { shape: 'ring', at: 2, size: 0.3, color: [0.2, 0.6, 1], strength: 0.3, width: 0.2 },
      // A streak: eight times wider than high, turned a quarter.
      {
        shape: 'disc',
        at: 1,
        size: 0.4,
        stretch: 8,
        color: [1, 1, 1],
        strength: 0.2,
        softness: 0.05,
        rotationDeg: 90,
      },
    ];
    const LIGHT: [number, number] = [0.22, 0.72];
    const flare = new Z.ZhudaLensFlare({ elements: ELEMENTS });
    const film = new Z.ZhudaFilmicPipeline(camera, {
      ...plain,
      toneMapping: 'none',
      sceneEffects: [flare.effect],
    });
    const expected = (i: number, scale = 1) =>
      ELEMENTS[i].color.map((c) =>
        round1(shown(Z.zhudaSrgbToLinear(c) * ELEMENTS[i].strength * scale)),
      );
    /** The middle of an element, and a point a share of its radius away at an angle. */
    const spot = (pixels: Uint8Array, i: number, radius = 0, angleDeg = 0) => {
      const { middle } = Z.zhudaLensFlarePlace(ELEMENTS[i], LIGHT, W / H);
      const [x, y] = pixelOf(middle[0], middle[1]);
      const r = (radius * ELEMENTS[i].size * H) / 2,
        a = (angleDeg * Math.PI) / 180;
      return patch(pixels, x + r * Math.cos(a), y - r * Math.sin(a), 1);
    };
    const shot = (name: string) => {
      flush(4);
      const pixels = read();
      saved['flare-' + name] = pixels;
      return pixels;
    };
    /** The brightest colour value anywhere in a picture. */
    const peak = (pixels: Uint8Array) => {
      let most = 0;
      for (let i = 0; i < pixels.length; i += 4)
        most = Math.max(most, pixels[i], pixels[i + 1], pixels[i + 2]);
      return most;
    };
    const result: any = {};
    flush(3);
    const dark = shot('off');
    result.offWorst = peak(dark);
    flare.setLight({ toward: toward(LIGHT[0], LIGHT[1]) });
    {
      const p = shot('open');
      result.open = {
        disc: { drawn: spot(p, 0), expected: expected(0) },
        discOutside: spot(p, 0, 1.25),
        polygon: { drawn: spot(p, 1), expected: expected(1) },
        // A hexagon reaches its corners and stops short between them.
        polygonCorner: spot(p, 1, 0.9, 0),
        polygonSide: spot(p, 1, 0.97, 30),
        ghost: { drawn: spot(p, 2), expected: expected(2) },
        ringMiddle: spot(p, 3),
        ring: { drawn: spot(p, 3, 0.85, 45), expected: expected(3) },
        // Turned a quarter, the streak is long up and down and narrow across.
        streak: {
          middle: spot(p, 4),
          up: spot(p, 4, 0.8, 90),
          across: spot(p, 4, 0.3, 0),
          expected: expected(4),
        },
      };
    }
    // The light's own colour, and the whole flare stronger.
    flare.setLight({ toward: toward(LIGHT[0], LIGHT[1]), color: [0.5, 1, 2] });
    flare.set({ strength: 0.5 });
    {
      const p = shot('tinted');
      result.tinted = {
        drawn: spot(p, 2),
        expected: ELEMENTS[2].color.map((c, k) =>
          round1(shown(Z.zhudaSrgbToLinear(c) * ELEMENTS[2].strength * 0.5 * [0.5, 1, 2][k])),
        ),
      };
    }
    flare.setLight({ toward: toward(LIGHT[0], LIGHT[1]) });
    flare.set({ strength: 1 });
    // A wall in front of the sun, then one whose edge runs through it.
    const black = material({ type: 'unlit', color: [0, 0, 0, 1] });
    const dir = toward(LIGHT[0], LIGHT[1]);
    const wall = box([3, 3, 0.2], [dir[0] * 5, dir[1] * 5, dir[2] * 5], black);
    {
      const p = shot('hidden');
      result.hidden = { disc: spot(p, 0), ghost: spot(p, 2), worst: peak(p) };
    }
    // The edge of the face toward the camera, 4.9 away, runs through the sun.
    wall.transform.position = v3([dir[0] * 4.9 + 1.5, dir[1] * 5, dir[2] * 5]);
    {
      const p = shot('half');
      result.half = { ghost: spot(p, 2), expected: expected(2, 0.5), full: expected(2) };
    }
    // A lamp: seen in front of the wall, gone behind it.
    wall.transform.position = v3([dir[0] * 5, dir[1] * 5, dir[2] * 5]);
    flare.setLight({ position: [dir[0] * 4, dir[1] * 4, dir[2] * 4] });
    result.lampInFront = spot(shot('lamp-front'), 2);
    flare.setLight({ position: [dir[0] * 7, dir[1] * 7, dir[2] * 7] });
    result.lampBehind = spot(shot('lamp-behind'), 2);
    result.expectedGhost = expected(2);
    clear();
    // A sun just outside the frame: its ghosts fade; one behind the camera gives none.
    flare.setLight({ toward: toward(1.075, 0.72) });
    {
      const p = shot('edge');
      const { middle } = Z.zhudaLensFlarePlace(ELEMENTS[2], [1.075, 0.72], W / H);
      const [x, y] = pixelOf(middle[0], middle[1]);
      result.edge = {
        ghost: patch(p, x, y, 1),
        fade: Z.zhudaLensFlareEdgeFade(1.15, 0.44),
        expected: expected(2, Z.zhudaLensFlareEdgeFade(1.15, 0.44)),
      };
    }
    flare.setLight({ toward: [0.2, 0.1, 1] });
    result.behindWorst = peak(shot('behind'));
    // The flare made for a low sun, for looking at.
    flare.set({ elements: Z.ZHUDA_LENS_FLARE_SUN });
    flare.setLight({ toward: toward(0.24, 0.74), color: [1, 0.95, 0.85] });
    camera.clearColor = new Laya.Color(0.02, 0.03, 0.06, 1);
    shot('sun');
    camera.clearColor = new Laya.Color(0, 0, 0, 1);
    flare.setLight(null);
    result.outWorst = peak(shot('out'));
    film.dispose();
    flare.dispose();
    out.flare = result;
  }

  // --- Bloom's threshold, knee, shape and lens dirt -----------------------
  {
    look([0, 0, 6], [0, 0, 0]);
    // A small square that gives off light on a black ground.
    const lamp = material({ type: 'pbr', color: [0, 0, 0, 1], emission: [3, 3, 3] });
    box([0.5, 0.5, 0.05], [0, 0, 0], lamp);
    const [cx, cy] = where([0, 0, 0]);
    const half = where([0.25, 0, 0.025])[0] - cx;
    const bloom: any = {};
    const options = {
      ...plain,
      toneMapping: 'none',
      ao: false,
      bloom: true,
      bloomIntensity: 10,
      bloomDiffusion: 7,
    };
    {
      // How bright the square is: read dim enough not to clip.
      const film = new Z.ZhudaFilmicPipeline(camera, { ...options, bloom: false, exposure: 0.05 });
      flush(4);
      bloom.light = +(lightOf(patch(read(), cx, cy, 2)[1]) / 0.05).toFixed(2);
      film.dispose();
    }
    const halo = (film: any, name?: string) => {
      flush(4);
      const p = read();
      if (name) saved['bloom-' + name] = p;
      const reach = half + 14;
      return {
        side: patch(p, cx + reach, cy, 1)[1],
        above: patch(p, cx, cy - reach, 1)[1],
        far: patch(p, cx + half + 90, cy, 1)[1],
      };
    };
    // The threshold is a display value LayaAir raises to the power 2.4.
    const displayOf = (light: number) => light ** (1 / 2.4);
    {
      const film = new Z.ZhudaFilmicPipeline(camera, { ...options, exposure: 0.2 });
      film.setGrade({ bloomThreshold: displayOf(bloom.light * 0.5), bloomSoftKnee: 0 });
      bloom.below = halo(film, 'on');
      film.setGrade({ bloomThreshold: displayOf(bloom.light * 1.3) });
      bloom.above = halo(film);
      // Under the threshold, the knee lets some of it through.
      film.setGrade({ bloomSoftKnee: 1 });
      bloom.knee = halo(film);
      film.setGrade({
        bloomThreshold: displayOf(bloom.light * 0.5),
        bloomSoftKnee: 0.5,
        bloomAnamorphic: 1,
      });
      bloom.wide = halo(film, 'wide');
      film.setGrade({ bloomAnamorphic: -1 });
      bloom.tall = halo(film, 'tall');
      film.setGrade({ bloomAnamorphic: 0 });
      bloom.round = halo(film);
      film.setGrade({ bloomDiffusion: 4 });
      bloom.narrow = halo(film);
      film.setGrade({ bloomDiffusion: 7 });
      // Marks on the lens: a picture shaped like the frame, black but for one spot beside the square.
      const dirtAt = [Math.round(cx + half + 14), Math.round(cy)];
      const marks = (width: number, height: number, sx: number, sy: number) => {
        const data = new Uint8Array(width * height * 4);
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const on = Math.hypot(x - sx, y - sy) < 5 ? 255 : 0;
            data.set([on, on, on, 255], (y * width + x) * 4);
          }
        const texture = new Laya.Texture2D(
          width,
          height,
          Laya.TextureFormat.R8G8B8A8,
          false,
          false,
          false,
        );
        texture.wrapModeU = texture.wrapModeV = Laya.WrapMode.Clamp;
        texture.setPixelsData(data, false, false);
        return texture;
      };
      const plainHalo = halo(film);
      // The picture is stored top row first; LayaAir reads it bottom row first.
      const same = marks(W, H, dirtAt[0], H - 1 - dirtAt[1]);
      film.setBloomDirt(same, 4);
      const dirty = halo(film, 'dirt');
      film.setGrade({ bloomDirt: 0 });
      const cleanAgain = halo(film);
      // The spot is round: as wide as it is high.
      {
        const p = saved['bloom-dirt'];
        let wide = 0,
          high = 0;
        for (let x = dirtAt[0] - 12; x <= dirtAt[0] + 12; x++)
          if (p[(dirtAt[1] * W + x) * 4 + 1] === 255) wide++;
        for (let y = dirtAt[1] - 12; y <= dirtAt[1] + 12; y++)
          if (p[(y * W + dirtAt[0]) * 4 + 1] === 255) high++;
        bloom.dirtSpot = { wide, high };
      }
      film.setBloomDirt(null);
      bloom.dirt = { plain: plainHalo, dirty, cleanAgain, off: halo(film) };
      film.dispose();
      same.destroy();
    }
    out.bloom = bloom;
    clear();
  }

  // --- A look names them ---------------------------------------------------
  {
    // A lit floor, a wall and a ball under a game's look: the curve, the
    // edge smoothing, the occlusion, the table and the flare by name.
    const grey = material({ type: 'pbr', color: [0.6, 0.6, 0.6, 1], roughness: 0.9 });
    box([14, 0.2, 14], [0, -0.1, 0], grey, true);
    box([14, 2.4, 0.2], [0, 1.2, -2], grey, true);
    put(Laya.PrimitiveMesh.createSphere(0.5, 48, 48), [1.5, 0.5, 0.2], grey, true);
    look([0, 3.2, 4.5], [0, 0.2, -1.2]);
    const table = Z.parseZhudaCubeLut(await (await fetch('fixtures/look.cube')).text());
    const authored = {
      preset: 'day',
      sun: { elevationDeg: 50, azimuthDeg: 30 },
      grade: {
        toneMapping: 'agx',
        antialias: 'smaa',
        aoMethod: 'gtao',
        bloom: 0,
        lut: { asset: 'look.cube' },
      },
    };
    const sceneLook = new Z.ZhudaSceneLook(scene, camera, authored);
    const result: any = {};
    const floorAt = where([-1.5, 0, 1]);
    const shot = (name: string) => {
      flush(5);
      const pixels = read();
      saved['look-' + name] = pixels;
      return patch(pixels, floorAt[0], floorAt[1], 2);
    };
    // Until the game hands a table over the picture is as without one.
    result.plain = shot('plain');
    sceneLook.setColorTable(table);
    result.tabled = shot('table');
    result.expected = Z.zhudaSampleCubeLut(
      table,
      result.plain.map((v: number) => v / 255),
    ).map((v: number) => round1(v * 255));
    // The curve in place; another way of smoothing builds the chain again, and the table stays.
    result.curve = sceneLook.setLook({
      ...authored,
      grade: { ...authored.grade, toneMapping: 'neutral' },
    });
    result.neutral = shot('neutral');
    sceneLook.setColorTable(null);
    result.neutralPlain = shot('neutral-plain');
    sceneLook.setColorTable(table);
    result.smoothing = sceneLook.setLook({
      ...authored,
      grade: { ...authored.grade, toneMapping: 'neutral', antialias: 'fxaa' },
    });
    result.rebuilt = shot('rebuilt');
    result.neutralExpected = Z.zhudaSampleCubeLut(
      table,
      result.neutralPlain.map((v: number) => v / 255),
    ).map((v: number) => round1(v * 255));
    // The occlusion by horizons darkens the foot of the wall and leaves the open floor.
    sceneLook.setColorTable(null);
    const creaseAt = where([-1.5, 0, -1.9 + 0.05]);
    const crease = (name: string) => {
      flush(5);
      const pixels = read();
      saved['look-' + name] = pixels;
      return {
        crease: patch(pixels, creaseAt[0], creaseAt[1], 1),
        open: patch(pixels, floorAt[0], floorAt[1], 2),
      };
    };
    sceneLook.setLook({ ...authored, grade: { ...authored.grade, lut: false } });
    result.withOcclusion = crease('gtao');
    sceneLook.setLook({ ...authored, grade: { ...authored.grade, lut: false, ao: 0 } });
    result.withoutOcclusion = crease('no-ao');
    // The flare follows the look's sun: toward the sun the picture gains light, away from it none.
    const total = () => {
      flush(5);
      const p = read();
      let sum = 0;
      for (let i = 0; i < p.length; i += 4) sum += p[i] + p[i + 1] + p[i + 2];
      return sum / (W * H * 3);
    };
    const flareLook = (on: boolean) => ({
      ...authored,
      grade: { ...authored.grade, lut: false, ao: 0 },
      ...(on ? { lensFlare: { strength: 2 } } : {}),
    });
    const headings: Record<string, number[]> = {};
    for (const [name, heading] of Object.entries({ north: 0, east: 90, south: 180, west: 270 })) {
      const a = (heading * Math.PI) / 180;
      look(
        [0, 1.5, 0],
        [Math.sin(a) * 4, 1.5 + 4 * Math.tan((50 * Math.PI) / 180) * 0.8, -Math.cos(a) * 4],
        70,
      );
      sceneLook.setLook(flareLook(false));
      const without = total();
      sceneLook.setLook(flareLook(true));
      const withFlare = total();
      if (name === 'north' || withFlare - without > 1) saved['look-flare-' + name] = read();
      headings[name] = [round1(without), round1(withFlare)];
    }
    result.flare = headings;
    sceneLook.dispose();
    // Looks made and let go again and again leave nothing more behind.
    {
      flush(2);
      const start = held();
      for (let i = 0; i < 6; i++) {
        const again = new Z.ZhudaSceneLook(scene, camera, { ...authored, lensFlare: true });
        again.setColorTable(table);
        flush(2);
        again.dispose();
      }
      flush(2);
      result.cycles = held() - start;
    }
    out.look = result;
    clear();
  }

  flush();
  out.resourcesLeft = held() - before;
  if (out.resourcesLeft !== 0) {
    const after = census();
    out.resourcesLeftNamed = Object.keys({ ...censusBefore, ...after })
      .filter((name) => (after[name] ?? 0) !== (censusBefore[name] ?? 0))
      .map((name) => `${name}: ${censusBefore[name] ?? 0} -> ${after[name] ?? 0}`);
  }
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}

main().catch((error) => {
  out.error = String(error?.stack ?? error);
});
