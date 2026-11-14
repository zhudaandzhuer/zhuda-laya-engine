// Real-draw fixture for scripts/verify-specular-aa.mjs: a ball with a dense
// normal map seen from a few metres, under a camera that is moved by less than
// a pixel from frame to frame, with specular anti-aliasing (ZHUDA_SPECULAR_AA)
// off and on, for the three physically based shaders it patches. A smooth
// ball shows what it does to a surface without fine detail.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__SPECULAR_AA__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 320,
  FOV = 40,
  DIST = 6.5,
  RADIUS = 1,
  JITTERS = 16;
/** One pixel at the ball's centre, in metres. */
const PIXEL = (2 * DIST * Math.tan(((FOV / 2) * Math.PI) / 180)) / H;
/** The ball's radius on screen in pixels. */
const DISC =
  ((H / 2) * (RADIUS / Math.sqrt(DIST * DIST - RADIUS * RADIUS))) /
  Math.tan(((FOV / 2) * Math.PI) / 180);
/** Measured inside 0.85 of it: the silhouette steps under any jitter, AA or not. */
const INNER = DISC * 0.85;
const CROP = 150,
  ZOOM = 2;
/** The close look: the ball fills the frame, a texel of the map is about twelve pixels. */
const CLOSE = 1.9;
const WINDOW: number[] = [];
for (let y = 60; y < 260; y++) for (let x = 140; x < 340; x++) WINDOW.push((y * W + x) * 4);
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
/** Pixel offsets (x*4 into the frame) inside the inner disc. */
const MASK: number[] = [];
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if ((x + 0.5 - W / 2) ** 2 + (y + 0.5 - H / 2) ** 2 < INNER * INNER) MASK.push((y * W + x) * 4);
/** Light as it left the surface: the frame's sRGB-like values undone. */
const LINEAR = Array.from({ length: 256 }, (_, v) => (v / 255) ** 2.2);
const linear = (p: Uint8Array, i: number) =>
  0.2126 * LINEAR[p[i]] + 0.7152 * LINEAR[p[i + 1]] + 0.0722 * LINEAR[p[i + 2]];
/** A sparkle: a pixel at a fifth of white or more in linear light (about 122 of 255 shown). */
const SPARKLE = 0.2;
/** A pop: a pixel whose shown brightness jumps by more than this (of 255) between frames. */
const POP = 48;
const clipped = (p: Uint8Array, i: number) => p[i] >= 254 || p[i + 1] >= 254 || p[i + 2] >= 254;
const round = (v: number, digits = 3) => +v.toFixed(digits);

/** Halton (2, 3): sub-pixel offsets in -0.5..0.5, as a temporal AA jitter. */
const halton = (i: number, base: number) => {
  let f = 1,
    r = 0;
  for (; i > 0; i = Math.floor(i / base)) {
    f /= base;
    r += f * (i % base);
  }
  return r;
};
const JITTER = Array.from({ length: JITTERS }, (_, k) => [
  halton(k + 1, 2) - 0.5,
  halton(k + 1, 3) - 0.5,
]);

/** A ball with the normal map tiled `tiles` times round it and half as many from pole to pole. */
function ballMesh(tiles: number) {
  const rings = 64,
    segments = 96;
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let r = 0; r <= rings; r++) {
    const v = r / rings,
      theta = v * Math.PI;
    for (let s = 0; s <= segments; s++) {
      const u = s / segments,
        phi = u * Math.PI * 2;
      const x = Math.sin(theta) * Math.sin(phi),
        y = Math.cos(theta),
        z = Math.sin(theta) * Math.cos(phi);
      positions.push(x * RADIUS, y * RADIUS, z * RADIUS);
      normals.push(x, y, z);
      uvs.push(u * tiles, (v * tiles) / 2);
    }
  }
  for (let r = 0; r < rings; r++)
    for (let s = 0; s < segments; s++) {
      const a = r * (segments + 1) + s,
        b = a + segments + 1;
      indices.push(a, a + 1, b, a + 1, b + 1, b);
    }
  const data: any = {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
  data.tangents = Z.computeMeshTangents(data);
  return data;
}

/**
 * A dense, rough-cast normal map: bumps two to eight texels across, the kind a
 * hammered metal, a stone or a leather has, seen far smaller than it was made.
 */
function normalMap(size: number) {
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const grid = (cell: number) => {
    const n = size / cell,
      values = Array.from({ length: n * n }, random);
    return (x: number, y: number) => {
      const gx = x / cell,
        gy = y / cell,
        x0 = Math.floor(gx),
        y0 = Math.floor(gy),
        fx = gx - x0,
        fy = gy - y0;
      const at = (i: number, j: number) => values[((j + n) % n) * n + ((i + n) % n)];
      const sx = fx * fx * (3 - 2 * fx),
        sy = fy * fy * (3 - 2 * fy);
      return (
        (at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx) * (1 - sy) +
        (at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx) * sy
      );
    };
  };
  const octaves: [ReturnType<typeof grid>, number][] = [
    [grid(8), 0.5],
    [grid(4), 0.3],
    [grid(2), 0.2],
  ];
  const height = (x: number, y: number) => octaves.reduce((h, [g, w]) => h + g(x, y) * w, 0);
  const pixels = new Uint8Array(size * size * 4);
  const strength = 6;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * strength,
        dy = (height(x, y + 1) - height(x, y - 1)) * strength;
      const length = Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      pixels[i] = Math.round((-dx / length) * 127.5 + 127.5);
      pixels[i + 1] = Math.round((-dy / length) * 127.5 + 127.5);
      pixels[i + 2] = Math.round((1 / length) * 127.5 + 127.5);
      pixels[i + 3] = 255;
    }
  return pixels;
}

/**
 * Two finishes. Metal: no diffuse light, so what is seen is the highlight
 * alone, the case that sparkles. Painted: a grey dielectric whose diffuse
 * shading carries the bumps too, which specular anti-aliasing does not touch.
 * Colours are linear (the glTF factor is; Laya's PBR colour is converted).
 *
 * `sun` is set for each finish so that the brightest sparkle without the
 * patch stays below white: nothing clips, and light can be compared in linear
 * terms (a clipped sparkle hides most of its light). `game` is a sun as a
 * game would set it, for the pictures and for the flicker as it is shown with
 * clipping; `gain` brightens the measured frames in the pictures only.
 */
const FINISHES = {
  metal: { metallic: 1, linear: [0.8, 0.8, 0.82], sun: 0.02, game: 0.6, gain: 8 },
  painted: { metallic: 0, linear: [0.08, 0.08, 0.09], sun: 0.4, game: 2.4, gain: 2 },
} as const;
type Finish = keyof typeof FINISHES;
const ROUGHNESS = 0.2;
const toGamma = (v: number) => Math.pow(v, 1 / 2.2);

function materials(normal: any, finish: Finish) {
  const { metallic, linear } = FINISHES[finish];
  const color = [...linear.map(toGamma), 1];
  const owned: (() => void)[] = [];
  const pbr = (textures: any, extra: any = {}) => {
    const m = Z.createSurfaceMaterial({
      type: 'pbr',
      color,
      metallic,
      roughness: ROUGHNESS,
      textures,
      ...extra,
    });
    owned.push(() => Z.disposeSurfaceMaterial(m));
    return m;
  };
  // The glTF shader, set up as LayaAir's glTF loader sets up a material.
  const gltf = new Laya.Material();
  gltf.setShaderName('glTFPBR');
  gltf.setVector4('u_BaseColorFactor', new Laya.Vector4(...linear, 1));
  gltf.setFloat('u_MetallicFactor', metallic);
  gltf.setFloat('u_RoughnessFactor', ROUGHNESS);
  gltf.setTexture('u_NormalTexture', normal);
  gltf.setDefine(Laya.Shader3D.getDefineByName('NORMALMAP'), true);
  owned.push(() => {
    gltf.setTexture('u_NormalTexture', null);
    gltf.destroy();
  });
  const lit = new Z.ZhudaLitSurfaceMaterial({
    name: 'ZhudaVerifySpecularAALit',
    surface: 'void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {}',
    material: { color, metallic, roughness: ROUGHNESS, textures: { normal } },
  });
  owned.push(() => lit.dispose());
  return {
    set: {
      pbr: pbr({ normal }),
      gltf,
      lit: lit.material,
      smooth: pbr({}),
      cutout: pbr({ normal }, { blend: 'cutout', alphaCutoff: 0.5 }),
    } as Record<string, any>,
    dispose: () => owned.forEach((f) => f()),
  };
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
  if (renderer === 'webgl')
    gl = context.canvas.getContext('webgl2') || context.canvas.getContext('webgl');
  else {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    copy = canvas.getContext('2d', { willReadFrequently: true });
  }
  context.runtime.start(() => {});
  const { selected, nativeEngine, status, adapter } = context.renderer;
  out.backend = { selected, nativeEngine, status, adapter };
  out.status = Z.zhudaSpecularAAStatus();
  out.geometry = { pixel: round(PIXEL, 5), disc: round(DISC, 1), measured: MASK.length };

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.06, 0.06, 0.07, 1] });
  const define = Laya.Shader3D.getDefineByName(Z.ZHUDA_SPECULAR_AA_DEFINE);
  out.newSceneHasDefine = scene._shaderValues.hasDefine(define);
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 0, DIST],
    fov: FOV,
    near: 0.1,
    far: 50,
    clearColor: [0, 0, 0, 1],
  });
  // From above, right and behind the camera: the highlight sits inside the disc.
  const sun = Z.Zhuda3D.createDirectionalLight(scene, {
    color: [1, 1, 1, 1],
    intensity: 1,
    rotationEuler: [-20, 20, 0],
  });

  const textures: Record<string, any> = {};
  const pixels = normalMap(256);
  textures.mipmapped = Z.createSurfaceTexture(256, 256, pixels, 'normal', { mipmap: true });
  // Without mipmaps (the default of createSurfaceTexture): still filtered bilinearly.
  textures.unfiltered = Z.createSurfaceTexture(256, 256, pixels, 'normal', { mipmap: false });
  const ballData = ballMesh(8);
  const ball = new Z.ZhudaDynamicMesh(ballData, scene);
  const sets: Record<string, ReturnType<typeof materials>> = {};
  for (const finish of Object.keys(FINISHES) as Finish[])
    for (const filter of ['mipmapped', 'unfiltered'])
      sets[`${finish}-${filter}`] = materials(textures[filter], finish);

  const at = (k: number, distance = DIST) => {
    const [jx, jy] = k < 0 ? [0, 0] : JITTER[k];
    camera.transform.position = new Laya.Vector3(jx * PIXEL, jy * PIXEL, distance);
    Z.ZhudaEngine.flushRenderFrames(1);
    return read();
  };
  const use = (material: any, aa: boolean, finish: Finish, intensity?: number) => {
    sun.light.intensity = intensity ?? FINISHES[finish].sun;
    ball.node.meshRenderer.sharedMaterial = material;
    const now = Z.setZhudaSpecularAA(scene, aa);
    // A new set of defines compiles the shaders again: draw it once first.
    at(-1);
    at(-1);
    return now;
  };
  /**
   * Over the inner disc under the jitter: flicker (the mean change from one
   * frame to the next, in linear light, thousandths of white), sparkles and
   * clipped pixels a frame, mean light (thousandths of white), and in the
   * shown values (0..255) the mean change and the pops a frame.
   */
  const run = (material: any, aa: boolean, finish: Finish, intensity?: number) => {
    const applied = use(material, aa, finish, intensity);
    const frames: Uint8Array[] = [];
    for (let k = 0; k < JITTERS; k++) frames.push(at(k));
    let flicker = 0,
      shown = 0,
      pops = 0,
      sparkles = 0,
      white = 0,
      mean = 0;
    for (let k = 0; k < frames.length; k++) {
      const p = frames[k];
      for (const i of MASK) {
        const l = linear(p, i);
        mean += l;
        if (l >= SPARKLE) sparkles++;
        if (clipped(p, i)) white++;
        if (k) {
          flicker += Math.abs(l - linear(frames[k - 1], i));
          const step = Math.abs(lum(p, i) - lum(frames[k - 1], i));
          shown += step;
          if (step > POP) pops++;
        }
      }
    }
    const pairs = (frames.length - 1) * MASK.length,
      all = frames.length * MASK.length;
    return {
      applied,
      frames,
      flicker: round((flicker / pairs) * 1000),
      sparkles: round(sparkles / frames.length, 1),
      mean: round((mean / all) * 1000),
      shownFlicker: round(shown / pairs),
      pops: round(pops / (frames.length - 1), 1),
      clipped: round(white / frames.length, 1),
    };
  };
  const summary = (r: ReturnType<typeof run>) => {
    const { frames, ...rest } = r;
    void frames;
    return rest;
  };

  const result: any = {};
  const pictures: Record<string, string> = {};
  // Let the page answer between runs: each one compiles shaders.
  const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));
  for (const [kind, set] of Object.entries(sets))
    for (const name of ['pbr', 'gltf', 'lit']) {
      await breathe();
      const finish = kind.split('-')[0] as Finish;
      const off = run(set.set[name], false, finish),
        on = run(set.set[name], true, finish);
      const key = `${name}-${kind}`;
      result[key] = {
        off: summary(off),
        on: summary(on),
        // Same jitter, off against on: the patch changes the picture.
        changed: round(meanDiff(off.frames[0], on.frames[0])),
      };
      if (name !== 'pbr' && kind !== 'metal-mipmapped') continue;
      // As a game would light it: sparkles clip to white.
      const gameOff = run(set.set[name], false, finish, FINISHES[finish].game),
        gameOn = run(set.set[name], true, finish, FINISHES[finish].game);
      if (name === 'pbr' && kind.endsWith('mipmapped'))
        result[`game-${key}`] = { off: summary(gameOff), on: summary(gameOn) };
      const gain = FINISHES[finish].gain;
      pictures[key] = sheet([
        [
          [`${key}, game light, AA off`, shown(gameOff.frames[0])],
          ['on', shown(gameOn.frames[0])],
        ],
        [
          [`measured light x${gain}, off`, shown(off.frames[0], gain)],
          ['on', shown(on.frames[0], gain)],
        ],
        [
          ['next frame, change x2, off', change(off.frames[0], off.frames[1], gain, 2)],
          ['on', change(on.frames[0], on.frames[1], gain, 2)],
        ],
      ]);
    }

  // A smooth ball: the patch is to leave it as it was.
  const highlight = (p: Uint8Array) => {
    let peak = 0,
      bright = 0,
      sx = 0,
      sy = 0;
    for (const i of MASK) peak = Math.max(peak, lum(p, i));
    for (const i of MASK)
      if (lum(p, i) > peak * 0.5) {
        bright++;
        sx += (i / 4) % W;
        sy += Math.floor(i / 4 / W);
      }
    return {
      peak: round(peak, 1),
      size: bright,
      at: [round(sx / bright, 1), round(sy / bright, 1)],
    };
  };
  for (const finish of Object.keys(FINISHES) as Finish[]) {
    await breathe();
    const smooth = sets[`${finish}-mipmapped`].set.smooth;
    const off = run(smooth, false, finish),
      on = run(smooth, true, finish);
    result[`smooth-${finish}`] = {
      off: { ...summary(off), ...highlight(off.frames[0]) },
      on: { ...summary(on), ...highlight(on.frames[0]) },
      diff: round(meanDiff(off.frames[0], on.frames[0])),
      maxDiff: maxDiff(off.frames[0], on.frames[0]),
    };
    const gameOff = run(smooth, false, finish, FINISHES[finish].game),
      gameOn = run(smooth, true, finish, FINISHES[finish].game);
    result[`smooth-${finish}`].game = {
      diff: round(meanDiff(gameOff.frames[0], gameOn.frames[0])),
      maxDiff: maxDiff(gameOff.frames[0], gameOn.frames[0]),
      off: highlight(gameOff.frames[0]),
      on: highlight(gameOn.frames[0]),
    };
    pictures[`smooth-${finish}`] = sheet([
      [
        [`smooth ${finish}, game light: off`, shown(gameOff.frames[0])],
        ['on', shown(gameOn.frames[0])],
        ['off to on, change x8', change(gameOff.frames[0], gameOn.frames[0], 1, 8)],
      ],
    ]);
  }

  // Close up, each texel of the map several pixels wide: nothing to
  // anti-alias, and the bumps' highlights are to stay as they were.
  const close = new Z.ZhudaDynamicMesh(ballMesh(1), scene);
  ball.node.active = false;
  for (const finish of Object.keys(FINISHES) as Finish[]) {
    await breathe();
    const material = sets[`${finish}-mipmapped`].set.pbr;
    close.node.meshRenderer.sharedMaterial = material;
    sun.light.intensity = FINISHES[finish].game;
    const frames = [false, true].map((aa) => {
      Z.setZhudaSpecularAA(scene, aa);
      at(-1, CLOSE);
      return at(-1, CLOSE);
    });
    result[`close-${finish}`] = {
      diff: round(meanDiff(frames[0], frames[1], WINDOW)),
      maxDiff: maxDiff(frames[0], frames[1], WINDOW),
      changedPixels: WINDOW.filter((i) => Math.abs(lum(frames[0], i) - lum(frames[1], i)) > 8)
        .length,
      measured: WINDOW.length,
    };
    pictures[`close-${finish}`] = sheet([
      [
        [`close ${finish}, game light: off`, shown(frames[0])],
        ['on', shown(frames[1])],
        ['off to on, change x8', change(frames[0], frames[1], 1, 8)],
      ],
    ]);
  }
  close.node.destroy();
  ball.node.active = true;

  // Alpha-tested: a discard comes before the derivatives (WebGPU's uniformity rule).
  use(sets['painted-mipmapped'].set.cutout, true, 'painted');
  const cut = at(0);
  result.cutout = { mean: round(MASK.reduce((s, i) => s + lum(cut, i), 0) / MASK.length, 2) };

  // A scene can be turned off and on again; a material can ask for it alone.
  result.toggle = {
    off: Z.setZhudaSpecularAA(scene, false),
    offHasDefine: scene._shaderValues.hasDefine(define),
    on: Z.setZhudaSpecularAA(scene, true),
    onHasDefine: scene._shaderValues.hasDefine(define),
  };
  result.invalid = (() => {
    try {
      Z.setZhudaSpecularAA({}, true);
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  })();

  out.result = result;
  out.pictures = pictures;
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  ball.node.destroy();
  for (const set of Object.values(sets)) set.dispose();
  for (const texture of Object.values(textures)) texture.destroy();
  out.statusEnd = Z.zhudaSpecularAAStatus();
  out.ready = true;
}

function meanDiff(a: Uint8Array, b: Uint8Array, mask = MASK) {
  let s = 0;
  for (const i of mask) s += Math.abs(lum(a, i) - lum(b, i));
  return s / mask.length;
}
function maxDiff(a: Uint8Array, b: Uint8Array, mask = MASK) {
  let m = 0;
  for (const i of mask) m = Math.max(m, Math.abs(lum(a, i) - lum(b, i)));
  return round(m, 1);
}

type Paint = (x: number, y: number) => number[];
/** The frame as shown, or brightened by `gain` in linear light. */
const shown =
  (p: Uint8Array, gain = 1): Paint =>
  (x, y) => {
    const i = (y * W + x) * 4;
    if (gain === 1) return [p[i], p[i + 1], p[i + 2]];
    return [0, 1, 2].map((c) => 255 * Math.min(1, LINEAR[p[i + c]] * gain) ** (1 / 2.2));
  };
/** The change in shown brightness between two frames, `boost` times as bright. */
const change =
  (a: Uint8Array, b: Uint8Array, gain: number, boost: number): Paint =>
  (x, y) => {
    const i = (y * W + x) * 4;
    const level = (p: Uint8Array) =>
      gain === 1 ? lum(p, i) : 255 * Math.min(1, linear(p, i) * gain) ** (1 / 2.2);
    const v = Math.min(255, Math.abs(level(a) - level(b)) * boost);
    return [v, v, v];
  };

/** A picture for a person: the middle of the frame, twice the size, in labelled cells. */
function sheet(rows: [string, Paint][][]) {
  const tile = CROP * ZOOM,
    band = 20;
  const canvas = document.createElement('canvas');
  canvas.width = tile * Math.max(...rows.map((r) => r.length));
  canvas.height = rows.length * (band + tile);
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  const image = g.createImageData(tile, tile);
  g.font = '13px sans-serif';
  rows.forEach((row, r) =>
    row.forEach(([label, paint], c) => {
      for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++) {
          const v = paint(
            Math.floor(x / ZOOM) + Math.round(W / 2 - CROP / 2),
            Math.floor(y / ZOOM) + Math.round(H / 2 - CROP / 2),
          );
          image.data.set([v[0], v[1], v[2], 255], (y * tile + x) * 4);
        }
      g.putImageData(image, c * tile, r * (band + tile) + band);
      g.fillStyle = '#ddd';
      g.fillText(label, c * tile + 6, r * (band + tile) + 14);
    }),
  );
  return canvas.toDataURL('image/png');
}

main().catch((error) => {
  out.error = String(error?.stack || error);
});
