// Real-draw fixture for scripts/verify-specular-aa.mjs: specular anti-aliasing
// (ZHUDA_SPECULAR_AA) off and on, under a camera that is moved by less than a
// pixel from frame to frame, against the truth: the same ball drawn with many
// samples to a pixel and no patch.
// - a ball with a dense normal map seen from a few metres (four texels to a
//   pixel at its middle, and eight), with mipmaps and without, for the three
//   physically based shaders the patch reaches; and less dense (two texels,
//   where the map's part fades in, and one, where it is to be left alone);
// - smooth balls from polished to dull, large and small, with their rims;
// - the map seen close up, at no strength, and on a mesh without tangents.
// The scene has no ambient light unless a case says so: everything measured
// is the sun's light, so nothing else can hide a change in it.
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
  RADIUS = 1,
  JITTERS = 16;
/** Where the camera stands: the ball is 68 pixels in radius, or 17, or fills the frame. */
const DIST = 6.5,
  FAR = 26,
  CLOSE = 1.9;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
/** One pixel at the ball's centre, in metres, from `distance`. */
const pixelAt = (distance: number) => (2 * distance * TAN) / H;
/** The ball's radius on screen in pixels, from `distance`. */
const discAt = (distance: number) =>
  ((H / 2) * (RADIUS / Math.sqrt(distance * distance - RADIUS * RADIUS))) / TAN;
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
/** Pixel offsets (x*4 into the frame) between two radii round the middle of the frame. */
function ring(inner: number, outer: number) {
  const mask: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x + 0.5 - W / 2, y + 0.5 - H / 2);
      if (d >= inner && d < outer) mask.push((y * W + x) * 4);
    }
  return mask;
}
/** The whole ball and two pixels round it, and its rim alone, from `distance`. */
const ballMask = (distance: number) => ring(0, discAt(distance) + 2);
const rimMask = (distance: number) => ring(discAt(distance) * 0.88, discAt(distance) + 1.5);
const BALL = ballMask(DIST);
/**
 * Inside 0.85 of the disc, where what changes from frame to frame is the
 * shading: nearer the edge the silhouette itself steps under any jitter, on a
 * ball that is lit to its edge. The rest of the ball is measured as its rim.
 */
const INNER = ring(0, discAt(DIST) * 0.85);
const RIM = ring(discAt(DIST) * 0.85, discAt(DIST) + 2);
/** Blocks of four by four pixels wholly on the ball: what the eye takes in at a glance. */
const BLOCKS: number[][] = [];
{
  const on = new Uint8Array(W * H);
  for (const i of BALL) on[i / 4] = 1;
  for (let by = 0; by + 4 <= H; by += 4)
    for (let bx = 0; bx + 4 <= W; bx += 4) {
      const cells: number[] = [];
      for (let y = by; y < by + 4; y++)
        for (let x = bx; x < bx + 4; x++) if (on[y * W + x]) cells.push((y * W + x) * 4);
      if (cells.length === 16) BLOCKS.push(cells);
    }
}
/** The middle of the frame, for the close look. */
const WINDOW: number[] = [];
for (let y = 60; y < 260; y++) for (let x = 140; x < 340; x++) WINDOW.push((y * W + x) * 4);
/** Light as it left the surface: the frame's sRGB-like values undone. */
const LINEAR = Array.from({ length: 256 }, (_, v) => (v / 255) ** 2.2);
const linear = (p: Uint8Array, i: number) =>
  0.2126 * LINEAR[p[i]] + 0.7152 * LINEAR[p[i + 1]] + 0.0722 * LINEAR[p[i + 2]];
/** Light as the frame shows it (0..255), clipped at white. */
const display = (l: number) => 255 * Math.min(1, l) ** (1 / 2.2);
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

/**
 * A ball with the normal map tiled `tiles` times round it and half as many
 * from pole to pole; without tangents when asked, as a mesh that was never
 * meant to carry a normal map.
 */
function ballMesh(tiles: number, tangents = true) {
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
  if (tangents) data.tangents = Z.computeMeshTangents(data);
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
 * game would set it, where sparkles clip: the frames as a player sees them.
 */
const FINISHES = {
  metal: { metallic: 1, linear: [0.8, 0.8, 0.82], sun: 0.02, game: 0.6 },
  painted: { metallic: 0, linear: [0.08, 0.08, 0.09], sun: 0.4, game: 2.4 },
} as const;
type Finish = keyof typeof FINISHES;
const ROUGHNESS = 0.2;
const toGamma = (v: number) => Math.pow(v, 1 / 2.2);
const colorOf = (finish: Finish) => [...FINISHES[finish].linear.map(toGamma), 1];

/** The three shaders the patch reaches, carrying `normal`, and what releases them. */
function materials(normal: any, finish: Finish) {
  const { metallic, linear } = FINISHES[finish];
  const color = colorOf(finish);
  const owned: (() => void)[] = [];
  const pbr = Z.createSurfaceMaterial({
    type: 'pbr',
    color,
    metallic,
    roughness: ROUGHNESS,
    textures: { normal },
  });
  owned.push(() => Z.disposeSurfaceMaterial(pbr));
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
    set: { pbr, gltf, lit: lit.material } as Record<string, any>,
    dispose: () => owned.forEach((f) => f()),
  };
}

/**
 * Over `mask`, for frames drawn one jitter after another: the mean change of
 * a pixel from one frame to the next in linear light (`flicker`, thousandths
 * of white) and in shown values (`shownFlicker`, 0..255), the pixels a frame
 * that jump by more than `POP` (`pops`), are sparkles or are clipped, and the
 * mean light (thousandths of white) and mean shown value.
 */
function measure(frames: Uint8Array[], mask: number[]) {
  let flicker = 0,
    shownChange = 0,
    pops = 0,
    sparkles = 0,
    white = 0,
    mean = 0,
    meanShown = 0;
  for (let k = 0; k < frames.length; k++) {
    const p = frames[k];
    for (const i of mask) {
      const l = linear(p, i);
      mean += l;
      meanShown += lum(p, i);
      if (l >= SPARKLE) sparkles++;
      if (clipped(p, i)) white++;
      if (k) {
        flicker += Math.abs(l - linear(frames[k - 1], i));
        const step = Math.abs(lum(p, i) - lum(frames[k - 1], i));
        shownChange += step;
        if (step > POP) pops++;
      }
    }
  }
  const pairs = (frames.length - 1) * mask.length,
    all = frames.length * mask.length;
  return {
    flicker: round((flicker / pairs) * 1000),
    shownFlicker: round(shownChange / pairs),
    pops: round(pops / (frames.length - 1), 1),
    sparkles: round(sparkles / frames.length, 1),
    clipped: round(white / frames.length, 1),
    mean: round((mean / all) * 1000),
    meanShown: round(meanShown / all, 1),
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
  out.geometry = {
    pixel: round(pixelAt(DIST), 5),
    disc: round(discAt(DIST), 1),
    discFar: round(discAt(FAR), 1),
    measured: { inner: INNER.length, rim: RIM.length, ball: BALL.length },
    blocks: BLOCKS.length,
  };

  // No ambient light: every number below is the sun's light alone.
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0, 0, 0, 1] });
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

  const pixels = normalMap(256);
  const textures: Record<string, any> = {
    mipmapped: Z.createSurfaceTexture(256, 256, pixels, 'normal', { mipmap: true }),
    // As createSurfaceTexture makes it unless asked: no mipmaps, LayaAir's own filtering.
    unfiltered: Z.createSurfaceTexture(256, 256, pixels, 'normal', { mipmap: false }),
    // For the truth: each sample reads the map itself, between four texels and no more.
    truth: Z.createSurfaceTexture(256, 256, pixels, 'normal', { mipmap: false }),
  };
  textures.truth.anisoLevel = 1;
  out.textures = Object.fromEntries(
    Object.entries(textures).map(([name, t]) => [
      name,
      { mipmap: t.mipmap, anisoLevel: t.anisoLevel },
    ]),
  );

  /**
   * One ball is shown at a time. A pixel at the middle of the ball is
   * 0.0125 m of it, the map 256 texels to a tile: a ball with the map `tiles`
   * times round it has about `tiles / 2` texels to a pixel there, and about
   * twice as many across the way it is squeezed at 0.85 of the disc.
   */
  const balls: Record<string, any> = {
    '4tx': new Z.ZhudaDynamicMesh(ballMesh(8), scene),
    '8tx': new Z.ZhudaDynamicMesh(ballMesh(16), scene),
    '2tx': new Z.ZhudaDynamicMesh(ballMesh(4), scene),
    '1tx': new Z.ZhudaDynamicMesh(ballMesh(2), scene),
    // The map once round: a texel is about twelve pixels from CLOSE.
    once: new Z.ZhudaDynamicMesh(ballMesh(1), scene),
    bare: new Z.ZhudaDynamicMesh(ballMesh(8, false), scene),
  };
  let shownBall: any;
  const show = (name: string) => {
    for (const ball of Object.values(balls)) ball.node.active = false;
    shownBall = balls[name].node;
    shownBall.active = true;
  };
  const shot = (jx: number, jy: number, distance = DIST) => {
    const pixel = pixelAt(distance);
    camera.transform.position = new Laya.Vector3(jx * pixel, jy * pixel, distance);
    Z.ZhudaEngine.flushRenderFrames(1);
    return read();
  };
  const use = (material: any, aa: boolean, intensity: number, distance = DIST) => {
    sun.light.intensity = intensity;
    shownBall.meshRenderer.sharedMaterial = material;
    const now = Z.setZhudaSpecularAA(scene, aa);
    // A new set of defines compiles the shaders again: draw it once first.
    shot(0, 0, distance);
    shot(0, 0, distance);
    return now;
  };
  /** The sixteen jittered frames. */
  const run = (material: any, aa: boolean, intensity: number, distance = DIST) => {
    const applied = use(material, aa, intensity, distance);
    const frames: Uint8Array[] = [];
    for (let k = 0; k < JITTERS; k++) frames.push(shot(JITTER[k][0], JITTER[k][1], distance));
    return { applied, frames };
  };
  // Let the page answer between runs: each one compiles shaders.
  const breathe = () => new Promise((resolve) => setTimeout(resolve, 0));
  /**
   * The truth for `material` at each of `offsets` camera positions: `samples`
   * frames without the patch spread over the pixel, averaged in linear light.
   * The sun is lowered until no sample clips and the result scaled back, so a
   * highlight smaller than a pixel keeps all its light.
   */
  const truth = async (
    material: any,
    intensity: number,
    samples: number,
    offsets: number[][],
    mask: number[],
    distance = DIST,
  ) => {
    let dimmed = intensity;
    for (;;) {
      use(material, false, dimmed, distance);
      const refs: Float32Array[] = [];
      let white = 0;
      for (const [ox, oy] of offsets) {
        const ref = new Float32Array(W * H);
        for (let k = 0; k < samples; k++) {
          if (k % 128 === 0) await breathe();
          const p = shot(ox + halton(k + 1, 2) - 0.5, oy + halton(k + 1, 3) - 0.5, distance);
          for (const i of mask) {
            ref[i / 4] += (linear(p, i) / samples) * (intensity / dimmed);
            if (clipped(p, i)) white++;
          }
        }
        refs.push(ref);
      }
      if (!white || dimmed < intensity / 4096) return { refs, dimmed, clipped: white };
      dimmed /= 4;
    }
  };

  const result: any = { dense: {}, truth: {}, smooth: {} };
  const pictures: Record<string, string> = {};

  // ---- A normal map at four texels to a pixel, eight, two and one ----------
  const sets: Record<string, ReturnType<typeof materials>> = {};
  const truthMaterials: Record<string, any> = {};
  for (const finish of Object.keys(FINISHES) as Finish[]) {
    for (const filter of ['mipmapped', 'unfiltered'])
      sets[`${finish}-${filter}`] = materials(textures[filter], finish);
    truthMaterials[finish] = Z.createSurfaceMaterial({
      type: 'pbr',
      color: colorOf(finish),
      metallic: FINISHES[finish].metallic,
      roughness: ROUGHNESS,
      textures: { normal: textures.truth },
    });
  }
  const nomip = Laya.Shader3D.getDefineByName(Z.ZHUDA_NORMAL_NOMIPMAP_DEFINE);
  // A material is told as it is given its normal map: by the engine's own
  // factories, and by LayaAir's setTexture as its glTF loader calls it.
  out.nomipmapDefine = Object.fromEntries(
    ['metal-mipmapped', 'metal-unfiltered'].flatMap((kind) =>
      ['pbr', 'gltf', 'lit'].map((name) => [
        `${name}-${kind}`,
        sets[kind].set[name].shaderData.hasDefine(nomip),
      ]),
    ),
  );
  const OFFSETS = JITTER.slice(0, 8);
  // Every shader and both kinds of map at four texels to a pixel; the PBR
  // shader alone at eight; and with mipmaps at two, where the map's part
  // fades in, and at one, where the bumps can be seen one by one.
  const DENSITIES: [string, string[], string[]][] = [
    ['4tx', ['pbr', 'gltf', 'lit'], ['mipmapped', 'unfiltered']],
    ['8tx', ['pbr'], ['mipmapped', 'unfiltered']],
    ['2tx', ['pbr'], ['mipmapped']],
    ['1tx', ['pbr'], ['mipmapped']],
  ];
  for (const [density, shaders, filters] of DENSITIES) {
    show(density);
    for (const finish of Object.keys(FINISHES) as Finish[]) {
      const { sun: dim, game } = FINISHES[finish];
      const gain = game / dim;
      // The truth, and how much the truth itself changes from one offset to the next.
      const { refs, clipped: refClipped } = await truth(
        truthMaterials[finish],
        dim,
        256,
        OFFSETS,
        BALL,
      );
      /** The truth's own numbers over `mask`, as `measure` gives them for frames. */
      const truthOver = (mask: number[]) => {
        let mean = 0,
          flicker = 0,
          shownChange = 0,
          pops = 0,
          meanShown = 0;
        for (const i of mask)
          for (let j = 0; j < refs.length; j++) {
            const now = refs[j][i / 4];
            mean += now;
            meanShown += display(now * gain);
            if (!j) continue;
            const before = refs[j - 1][i / 4];
            flicker += Math.abs(now - before);
            const step = Math.abs(display(now * gain) - display(before * gain));
            shownChange += step;
            if (step > POP) pops++;
          }
        const all = refs.length * mask.length,
          pairs = (refs.length - 1) * mask.length;
        return {
          mean: round((mean / all) * 1000),
          flicker: round((flicker / pairs) * 1000),
          game: {
            meanShown: round(meanShown / all, 1),
            shownFlicker: round(shownChange / pairs),
            pops: round(pops / (refs.length - 1), 1),
          },
        };
      };
      result.truth[`${density}-${finish}`] = {
        samples: 256,
        offsets: refs.length,
        clipped: refClipped,
        inner: truthOver(INNER),
        rim: truthOver(RIM),
        ball: truthOver(BALL),
      };
      /** Under the game's sun, against the truth at the same offset: a pixel, and a block of sixteen. */
      const against = (frames: Uint8Array[]) => {
        let pixel = 0,
          block = 0;
        for (let k = 0; k < refs.length; k++) {
          for (const i of BALL)
            pixel += Math.abs(display(linear(frames[k], i)) - display(refs[k][i / 4] * gain));
          for (const cells of BLOCKS) {
            let a = 0,
              b = 0;
            for (const i of cells) {
              a += linear(frames[k], i);
              b += Math.min(1, refs[k][i / 4] * gain);
            }
            block += Math.abs(display(a / 16) - display(b / 16));
          }
        }
        return {
          pixel: round(pixel / (refs.length * BALL.length)),
          block: round(block / (refs.length * BLOCKS.length)),
        };
      };
      for (const filter of filters)
        for (const name of shaders) {
          await breathe();
          const material = sets[`${finish}-${filter}`].set[name];
          const off = run(material, false, dim),
            on = run(material, true, dim);
          const gameOff = run(material, false, game),
            gameOn = run(material, true, game);
          const key = `${density}-${name}-${finish}-${filter}`;
          const over = (r: typeof off, g: typeof off, mask: number[]) => ({
            ...measure(r.frames, mask),
            game: measure(g.frames, mask),
          });
          const part = (r: typeof off, g: typeof off) => ({
            applied: r.applied,
            inner: over(r, g, INNER),
            rim: over(r, g, RIM),
            ball: over(r, g, BALL),
            ...(name === 'pbr' ? { againstTruth: against(g.frames) } : {}),
          });
          result.dense[key] = {
            off: part(off, gameOff),
            on: part(on, gameOn),
            // Same jitter, off against on, as shown under the game's sun.
            changed: round(meanDiff(gameOff.frames[0], gameOn.frames[0], BALL)),
          };
          if (name !== 'pbr') continue;
          const paintRef =
            (j: number): Paint =>
            (x, y) => {
              const v = display(refs[j][y * W + x] * gain);
              return [v, v, v];
            };
          pictures[key] = sheet([
            [
              [`${key}, game light: the truth`, paintRef(0)],
              ['AA off', shown(gameOff.frames[0])],
              ['AA on', shown(gameOn.frames[0])],
            ],
            [
              [
                'change to the next frame: the truth',
                (x, y) => {
                  const v = Math.abs(paintRef(0)(x, y)[0] - paintRef(1)(x, y)[0]);
                  return [v, v, v];
                },
              ],
              ['AA off', change(gameOff.frames[0], gameOff.frames[1], 1)],
              ['AA on', change(gameOn.frames[0], gameOn.frames[1], 1)],
            ],
          ]);
        }
    }
  }

  // ---- What the surroundings' light does: ambient only, no sun -------------
  show('4tx');
  {
    scene.ambientColor = new Laya.Color(0.06, 0.06, 0.07, 1);
    const material = sets['metal-mipmapped'].set.pbr;
    result.ambient = {
      off: measure(run(material, false, 0).frames, BALL).mean,
      on: measure(run(material, true, 0).frames, BALL).mean,
    };
    scene.ambientColor = new Laya.Color(0, 0, 0, 1);
  }

  // ---- Smooth balls, polished to dull, large and small ---------------------
  // A highlight narrower than a pixel is what the curvature term widens; one
  // several pixels wide is to stay as it was. The truth is drawn for each.
  show('once');
  const highlight = (value: (i: number) => number, mask: number[]) => {
    let peak = 0,
      sum = 0,
      size = 0;
    for (const i of mask) {
      const l = value(i);
      peak = Math.max(peak, l);
      sum += l;
    }
    for (const i of mask) if (value(i) > peak * 0.5) size++;
    return { peak, sum, size };
  };
  const smoothCases: [string, number, number, number][] = [
    // name, roughness, distance, samples for the truth
    ['r0.05-68px', 0.05, DIST, 1024],
    ['r0.1-68px', 0.1, DIST, 512],
    ['r0.2-68px', 0.2, DIST, 256],
    ['r0.4-68px', 0.4, DIST, 256],
    ['r0.1-17px', 0.1, FAR, 1024],
    ['r0.2-17px', 0.2, FAR, 512],
    ['r0.4-17px', 0.4, FAR, 256],
  ];
  const smoothRows: Record<string, [string, Paint, View?][][]> = { large: [], small: [] };
  // Released at the end: the page draws frames of its own between the runs.
  const spent: any[] = [];
  for (const [name, roughness, distance, samples] of smoothCases) {
    await breathe();
    const material = Z.createSurfaceMaterial({
      type: 'pbr',
      color: colorOf('metal'),
      metallic: 1,
      roughness,
    });
    const mask = ballMask(distance),
      rim = rimMask(distance);
    // A sun under which nothing clips, off or on, at any of the offsets.
    let dim = 0.64,
      off: Uint8Array[],
      on: Uint8Array[];
    for (;;) {
      off = run(material, false, dim, distance).frames;
      on = run(material, true, dim, distance).frames;
      if (![...off, ...on].some((p) => mask.some((i) => clipped(p, i))) || dim < 1e-6) break;
      dim /= 2;
    }
    const { refs, dimmed } = await truth(material, dim, samples, [[0, 0]], mask, distance);
    const ref = refs[0];
    const game = 0.6,
      gain = game / dim;
    const gameOff = run(material, false, game, distance).frames,
      gameOn = run(material, true, game, distance).frames;
    /** Averaged over the offsets: the peak, the light summed, the pixels over half the peak. */
    const average = (frames: Uint8Array[]) => {
      const each = frames.map((p) => highlight((i) => linear(p, i), mask));
      const mean = (pick: (h: (typeof each)[0]) => number) =>
        each.reduce((s, h) => s + pick(h), 0) / each.length;
      const sums = each.map((h) => h.sum);
      return {
        peak: round(
          mean((h) => h.peak),
          4,
        ),
        sum: round(
          mean((h) => h.sum),
          4,
        ),
        size: round(
          mean((h) => h.size),
          1,
        ),
        // How far the light summed strays from frame to frame: a highlight that comes and goes.
        sumLow: round(Math.min(...sums), 4),
        sumHigh: round(Math.max(...sums), 4),
      };
    };
    const band = (p: Uint8Array) => {
      let max = 0,
        over = 0;
      for (const i of rim) {
        const v = lum(p, i);
        max = Math.max(max, v);
        if (v > 16) over++;
      }
      return { max: round(max, 1), over16: over };
    };
    let truthRim = 0;
    for (const i of rim) truthRim = Math.max(truthRim, display(ref[i / 4] * gain));
    const refHighlight = highlight((i) => ref[i / 4], mask);
    const refGame = highlight((i) => Math.min(1, ref[i / 4] * gain), mask);
    result.smooth[name] = {
      roughness,
      radius: round(discAt(distance), 1),
      sun: dim,
      truthSun: dimmed,
      truth: {
        peak: round(refHighlight.peak, 4),
        sum: round(refHighlight.sum, 4),
        size: refHighlight.size,
        gameSize: refGame.size,
        gameSum: round(refGame.sum, 2),
        gameRimMax: round(truthRim, 1),
      },
      off: average(off),
      on: average(on),
      game: {
        off: { ...average(gameOff), rim: band(gameOff[0]) },
        on: { ...average(gameOn), rim: band(gameOn[0]) },
        diff: round(meanDiff(gameOff[0], gameOn[0], mask)),
        maxDiff: maxDiff(gameOff[0], gameOn[0], mask),
      },
    };
    spent.push(material);
    if (roughness > 0.2) continue;
    const far = distance === FAR;
    const view = far ? { crop: 50, zoom: 6 } : { crop: 150, zoom: 2 };
    smoothRows[far ? 'small' : 'large'].push([
      [
        `smooth metal ${name}, game light: the truth`,
        (x, y) => {
          const v = display(ref[y * W + x] * gain);
          return [v, v, v];
        },
        view,
      ],
      ['AA off', shown(gameOff[0]), view],
      ['AA on', shown(gameOn[0]), view],
      ['off to on, change x4', change(gameOff[0], gameOn[0], 4), view],
    ]);
  }
  pictures['smooth-large'] = sheet(smoothRows.large);
  pictures['smooth-small'] = sheet(smoothRows.small);

  // ---- The map close up ----------------------------------------------------
  // Each texel is about twelve pixels: nothing to anti-alias, and the bumps'
  // highlights are to stay as they were.
  show('once');
  for (const finish of Object.keys(FINISHES) as Finish[]) {
    await breathe();
    const material = sets[`${finish}-mipmapped`].set.pbr;
    const off = run(material, false, FINISHES[finish].game, CLOSE),
      on = run(material, true, FINISHES[finish].game, CLOSE);
    result[`close-${finish}`] = {
      diff: round(meanDiff(off.frames[0], on.frames[0], WINDOW)),
      maxDiff: maxDiff(off.frames[0], on.frames[0], WINDOW),
      changedPixels: WINDOW.filter(
        (i) => Math.abs(lum(off.frames[0], i) - lum(on.frames[0], i)) > 8,
      ).length,
      measured: WINDOW.length,
    };
    pictures[`close-${finish}`] = sheet([
      [
        [`close ${finish}, game light: AA off`, shown(off.frames[0])],
        ['AA on', shown(on.frames[0])],
        ['off to on, change x8', change(off.frames[0], on.frames[0], 8)],
      ],
    ]);
  }

  // ---- A map that is not applied widens nothing ----------------------------
  // At no strength, and on a mesh without tangents (LayaAir then shades with
  // the mesh's own normal): the ball is to look like one without the map.
  {
    const smooth = Z.createSurfaceMaterial({
      type: 'pbr',
      color: colorOf('metal'),
      metallic: 1,
      roughness: ROUGHNESS,
    });
    const mapped = sets['metal-mipmapped'].set.pbr;
    const game = FINISHES.metal.game;
    show('4tx');
    const plain = run(smooth, true, game).frames[0];
    mapped.normalTextureScale = 0;
    const flat = run(mapped, true, game).frames[0];
    mapped.normalTextureScale = 1;
    result.noStrength = {
      diff: round(meanDiff(plain, flat, BALL)),
      maxDiff: maxDiff(plain, flat, BALL),
    };
    show('bare');
    const barePlain = run(smooth, true, game).frames[0],
      bareMapped = run(mapped, true, game).frames[0];
    result.noTangents = {
      diff: round(meanDiff(barePlain, bareMapped, BALL)),
      maxDiff: maxDiff(barePlain, bareMapped, BALL),
      // That the mesh is drawn and lit at all.
      lit: round(BALL.reduce((s, i) => s + lum(bareMapped, i), 0) / BALL.length, 2),
    };
    spent.push(smooth);
  }

  // ---- Alpha-tested, the switch, a refusal ---------------------------------
  show('4tx');
  {
    // A discard comes before the derivatives (WebGPU's uniformity rule).
    const cutout = Z.createSurfaceMaterial({
      type: 'pbr',
      color: colorOf('painted'),
      metallic: 0,
      roughness: ROUGHNESS,
      textures: { normal: textures.mipmapped },
      blend: 'cutout',
      alphaCutoff: 0.5,
    });
    use(cutout, true, FINISHES.painted.sun);
    const cut = shot(JITTER[0][0], JITTER[0][1]);
    result.cutout = { mean: round(BALL.reduce((s, i) => s + lum(cut, i), 0) / BALL.length, 2) };
    spent.push(cutout);
  }
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
  for (const ball of Object.values(balls)) ball.node.destroy();
  for (const set of Object.values(sets)) set.dispose();
  for (const material of [...Object.values(truthMaterials), ...spent])
    Z.disposeSurfaceMaterial(material);
  for (const texture of Object.values(textures)) texture.destroy();
  out.statusEnd = Z.zhudaSpecularAAStatus();
  out.ready = true;
}

function meanDiff(a: Uint8Array, b: Uint8Array, mask: number[]) {
  let s = 0;
  for (const i of mask) s += Math.abs(lum(a, i) - lum(b, i));
  return s / mask.length;
}
function maxDiff(a: Uint8Array, b: Uint8Array, mask: number[]) {
  let m = 0;
  for (const i of mask) m = Math.max(m, Math.abs(lum(a, i) - lum(b, i)));
  return round(m, 1);
}

type Paint = (x: number, y: number) => number[];
/** How a cell of a sheet looks at the frame: `crop` pixels round the middle, `zoom` times the size. */
interface View {
  crop: number;
  zoom: number;
}
/** The frame as shown. */
const shown =
  (p: Uint8Array): Paint =>
  (x, y) => {
    const i = (y * W + x) * 4;
    return [p[i], p[i + 1], p[i + 2]];
  };
/** The change in shown brightness between two frames, `boost` times as bright. */
const change =
  (a: Uint8Array, b: Uint8Array, boost: number): Paint =>
  (x, y) => {
    const i = (y * W + x) * 4;
    const v = Math.min(255, Math.abs(lum(a, i) - lum(b, i)) * boost);
    return [v, v, v];
  };

/** A picture for a person: the middle of the frame, enlarged, in labelled cells. */
function sheet(rows: [string, Paint, View?][][]) {
  const tile = 300,
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
    row.forEach(([label, paint, view], c) => {
      const { crop, zoom } = view ?? { crop: 150, zoom: 2 };
      for (let y = 0; y < tile; y++)
        for (let x = 0; x < tile; x++) {
          const v = paint(
            Math.floor(x / zoom) + Math.round(W / 2 - crop / 2),
            Math.floor(y / zoom) + Math.round(H / 2 - crop / 2),
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
