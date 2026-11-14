// Real-draw fixture for scripts/verify-shadow-updates.mjs: a red post that
// moves across a pale floor in the sun, its shadow drawn every frame, every
// third frame and on request (`look.shadows.update`), and a floor tile under
// that shadow whose shader is first compiled on a frame that skips the maps.
// `?native` uses LayaAir's own `Scene3D.shadowMapFrequency` instead, without
// the engine's rule or its repair, to show what the repair is for.
// `?water` adds a pond whose mirror the game draws from its tick, with each
// setting of `mirrorShadows`, and a probe captured while the maps are kept:
// other cameras that draw the scene with shadows on.
// `?film` renders stills of a film stage under each `shadows.update`.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__SHADOWS__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300;
const native = location.search.includes('native');
const page = native
  ? 'native'
  : location.search.includes('water')
    ? 'water'
    : location.search.includes('film')
      ? 'film'
      : 'main';
/**
 * What the game does each frame: called from a LayaAir frame timer, as
 * `ZhudaRuntime` calls a game's tick, which runs after the frame is drawn
 * and within the same LayaAir frame. (The runtime itself skips ticks that
 * no time has passed for, and this page draws its frames without waiting.)
 */
let tick = () => {};
let context: any;
let gl: WebGLRenderingContext | null = null;
let copy: CanvasRenderingContext2D | null = null;

/** The frame, top row first on both backends. */
function read() {
  if (gl) {
    const raw = new Uint8Array(W * H * 4);
    // A view drawn by hand after the frame (the pond's mirror) leaves its own target bound.
    const bound = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    gl.bindFramebuffer(gl.FRAMEBUFFER, bound);
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return pixels;
  }
  copy!.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy!.getImageData(0, 0, W, H).data.buffer);
}
const lum = (p: Uint8Array, i: number) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
const isRed = (p: Uint8Array, i: number) => p[i] > p[i + 1] * 1.6 && p[i] > 30;
/** Brightness of the sunlit floor, from a patch nothing shades. */
let litFloor = 0;
/** The shadow on the floor: dark pixels that are not the post. */
const shadowMask = (p: Uint8Array) => {
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++)
    if (!isRed(p, i * 4) && lum(p, i * 4) < litFloor * 0.6) mask[i] = 1;
  return mask;
};
const centroid = (p: Uint8Array, test: (i: number) => boolean) => {
  let n = 0,
    sx = 0,
    sy = 0;
  for (let i = 0; i < W * H; i++)
    if (test(i)) {
      n++;
      sx += i % W;
      sy += (i / W) | 0;
    }
  return n ? { n, x: +(sx / n).toFixed(1), y: +(sy / n).toFixed(1) } : { n: 0, x: -1, y: -1 };
};
/**
 * How alike two shadows are: shared over joined pixels, leaving out where
 * the post stands in either frame (it hides the shadow behind it).
 */
const overlap = (a: Uint8Array, b: Uint8Array, pa: Uint8Array, pb: Uint8Array) => {
  let both = 0,
    either = 0;
  for (let i = 0; i < W * H; i++) {
    if (isRed(pa, i * 4) || isRed(pb, i * 4)) continue;
    if (a[i] && b[i]) both++;
    if (a[i] || b[i]) either++;
  }
  return either ? +(both / either).toFixed(3) : 1;
};

/** The tile's pixels (it is tinted blue), and which of them are in shadow. */
const isTile = (p: Uint8Array, i: number) => p[i + 2] > p[i] * 1.12 && p[i + 2] > 40;
const tileShade = (p: Uint8Array) => {
  const mask = new Uint8Array(W * H);
  let pixels = 0,
    shadowed = 0;
  for (let i = 0; i < W * H; i++)
    if (isTile(p, i * 4)) {
      pixels++;
      if (lum(p, i * 4) < litFloor * 0.6) {
        shadowed++;
        mask[i] = 1;
      }
    }
  return { pixels, shadowed, lit: pixels ? +(1 - shadowed / pixels).toFixed(3) : 0, mask };
};
/** Shared over joined pixels of two masks. */
const alike = (a: Uint8Array, b: Uint8Array) => {
  let both = 0,
    either = 0;
  for (let i = 0; i < W * H; i++) {
    if (a[i] && b[i]) both++;
    if (a[i] || b[i]) either++;
  }
  return either ? +(both / either).toFixed(3) : 1;
};

const saved: Record<string, Uint8Array> = {};
/** Saved frames side by side as a PNG data URL (a crop of each). */
out.strip = (names: string[], crop?: number[]) => {
  const [x0, y0, w, h] = crop ?? [100, 20, 220, 150];
  const canvas = document.createElement('canvas');
  canvas.width = w * names.length + 4 * (names.length - 1);
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  names.forEach((name, k) => {
    // A frame that failed to draw stays black.
    if (!saved[name]) return;
    const image = g.createImageData(w, h);
    for (let y = 0; y < h; y++)
      image.data.set(
        saved[name].subarray(((y0 + y) * W + x0) * 4, ((y0 + y) * W + x0 + w) * 4),
        y * w * 4,
      );
    g.putImageData(image, k * (w + 4), 0);
  });
  return canvas.toDataURL('image/png');
};

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  out.native = native;
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
  Laya.systemTimer.frameLoop(1, out, () => tick());
  if (page === 'film') return film();
  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 6, 6.5], rotationEuler: [0, 0, 0] });
  camera.fieldOfView = 50;
  camera.transform.lookAt(new Laya.Vector3(0, 0, 0.5), new Laya.Vector3(0, 1, 0));
  const shadows = (update: string, extra: object = {}) => ({
    distance: 20,
    softness: 'hard',
    resolution: 2048,
    cascades: 1,
    strength: 1,
    update,
    ...extra,
  });
  const LOOK = {
    sky: [0.5, 0.6, 0.7],
    ambient: [0.3, 0.3, 0.3],
    sun: { elevationDeg: 48, azimuthDeg: 35, intensity: 1.4, color: [1, 1, 1] },
    shadows: shadows('every'),
    fog: false,
    grade: { exposure: 1, bloom: 0, ao: 0, antialias: 'none' },
  };
  const look = new Z.ZhudaSceneLook(scene, camera, LOOK);
  const owned: any[] = [];
  const paint = (rgb: number[]) => {
    const material = Z.Zhuda3D.createMaterial({ type: 'pbr', albedoColor: [...rgb, 1] });
    owned.push(material);
    return material;
  };
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
  box([24, 0.2, 24], [0, -0.1, 0], paint([0.85, 0.85, 0.85]));
  const post = box([0.6, 2.4, 0.6], [-2, 1.2, 0], paint([0.85, 0.06, 0.04]));
  const place = (k: number) => (post.transform.position = new Laya.Vector3(-2 + k * 0.3, 1.2, 0));
  const frame = () => {
    Z.ZhudaEngine.flushRenderFrames(1);
    return read();
  };
  const r: any = {};
  place(0);
  frame();
  const first = frame();
  // A patch of floor in front of the camera, away from the post and its shadow.
  {
    let s = 0,
      n = 0;
    for (let y = 250; y < 290; y++)
      for (let x = 380; x < 460; x++, n++) s += lum(first, (y * W + x) * 4);
    litFloor = s / n;
  }
  r.litFloor = +litFloor.toFixed(1);
  // Drawn every frame: the reference for each place of the post.
  const reference: Uint8Array[] = [],
    referenceMask: Uint8Array[] = [];
  r.every = [];
  for (let k = 0; k < 9; k++) {
    place(k);
    const p = (saved['every-' + k] = frame());
    reference.push(p);
    referenceMask.push(shadowMask(p));
    r.every.push({
      post: centroid(p, (i) => isRed(p, i * 4)),
      shadow: centroid(p, (i) => referenceMask[k][i] === 1),
    });
  }

  /** Nine frames with the post moving; for each, which reference it matches. */
  const walk = (label: string, drawnAt: (k: number) => number) => {
    const rows: any[] = [];
    for (let k = 0; k < 9; k++) {
      place(k);
      let p: Uint8Array;
      try {
        p = saved[label + '-' + k] = frame();
      } catch (error) {
        rows.push({ k, error: String((error as Error).message).slice(0, 160) });
        continue;
      }
      const mask = shadowMask(p);
      const kept = drawnAt(k);
      rows.push({
        k,
        post: centroid(p, (i) => isRed(p, i * 4)),
        shadow: centroid(p, (i) => mask[i] === 1),
        // The shadow against the post's shadow where it stands now and where the maps were drawn.
        likeNow: overlap(mask, referenceMask[k], p, reference[k]),
        likeDrawn: overlap(mask, referenceMask[kept], p, reference[kept]),
        drawnAt: kept,
      });
    }
    return rows;
  };

  // A tile on the floor where the post's shadow falls when the post has walked.
  const TILE_TINT = [0.6, 0.75, 0.9],
    TILE_SIZE = [3, 0.04, 3],
    TILE_AT = [-0.7, 0.02, -1];
  if (page === 'water') {
    await water({ scene, camera, look, LOOK, shadows, box, paint, place, frame, r });
    look.dispose();
    scene.destroy(true);
    for (const item of owned) item.destroy();
    out.r = r;
    return finish();
  }
  if (native) {
    // LayaAir's own skipping, with nothing of the engine's in the way.
    scene.shadowMapFrequency = 3;
    // LayaAir draws the maps where the scene's draw count divides by three.
    const mark = Laya.Scene3D._updateMark;
    const draws = (k: number) => (mark + k + 1) % 3 === 0;
    r.interval = walk('native', (k) => {
      let at = k;
      while (at > 0 && !draws(at)) at--;
      return at;
    });
    // A floor tile whose material is first drawn on a frame that skips the maps.
    const cut = paint(TILE_TINT);
    cut.alphaTest = true;
    cut.alphaTestValue = 0.1;
    while ((Laya.Scene3D._updateMark + 1) % 3 === 0) frame();
    box(TILE_SIZE, TILE_AT, cut);
    r.tile = [];
    for (let i = 0; i < 5; i++) {
      try {
        const p = (saved['native-tile-' + i] = frame());
        const { pixels, shadowed, lit } = tileShade(p);
        r.tile.push({ pixels, shadowed, lit });
      } catch (error) {
        r.tile.push(String((error as Error).message).slice(0, 160));
      }
    }
    out.r = r;
    out.rendererErrors = context.renderer.errors.slice(0, 6);
    out.ready = true;
    return;
  }

  // Every third frame: the frame that draws, then two that keep its maps.
  r.intervalMode = look.setLook({ ...LOOK, shadows: shadows('interval', { interval: 3 }) });
  r.interval = walk('interval', (k) => k - (k % 3));
  r.intervalStats = look.shadowStats;
  // A floor tile, under the post's shadow, whose material is first drawn on a
  // frame that keeps the maps.
  const cut = paint(TILE_TINT);
  cut.alphaTest = true;
  cut.alphaTestValue = 0.1;
  // Draw until a frame has drawn the maps: the next one keeps them.
  let drawnBefore: number;
  do {
    drawnBefore = look.shadowStats.drawn;
    frame();
  } while (look.shadowStats.drawn === drawnBefore);
  r.beforeTile = look.shadowStats;
  const tile = box(TILE_SIZE, TILE_AT, cut);
  const tileShades: ReturnType<typeof tileShade>[] = [];
  for (let i = 0; i < 5; i++) {
    const p = (saved['tile-' + i] = frame());
    if (i === 0) r.tileFirst = look.shadowStats;
    tileShades.push(tileShade(p));
  }
  r.tileStats = look.shadowStats;
  // The rest is compared with the frames drawn before the tile.
  tile.destroy();

  // On request only: the shadow stays where it was drawn until it is asked for.
  r.manualMode = look.setLook({ ...LOOK, shadows: shadows('manual') });
  place(0);
  frame();
  r.manual = walk('manual', () => 0);
  look.redrawShadows();
  const asked = (saved['manual-asked'] = frame());
  r.manualAsked = overlap(shadowMask(asked), referenceMask[8], asked, reference[8]);
  // The sun moves (a look updated in place): the maps follow by themselves.
  r.sunMode = look.setLook({
    ...LOOK,
    sun: { ...LOOK.sun, azimuthDeg: 75 },
    shadows: shadows('manual'),
  });
  const turned = (saved['manual-sun'] = frame());
  const turnedMask = shadowMask(turned);
  r.sunMoved = {
    shadow: centroid(turned, (i) => turnedMask[i] === 1),
    likeBefore: overlap(turnedMask, referenceMask[8], turned, reference[8]),
  };
  r.manualStats = look.shadowStats;
  // Back to every frame: LayaAir's own path, the same picture as the reference.
  r.everyMode = look.setLook(LOOK);
  r.ruleGone = look.shadowStats === undefined;
  r.frequencyBack = scene.shadowMapFrequency;
  place(4);
  const back = frame();
  r.backLike = overlap(shadowMask(back), referenceMask[4], back, reference[4]);
  // The tile again, with its shadow drawn every frame: what the frames above are held to.
  place(8);
  const tileAgain = box(TILE_SIZE, TILE_AT, cut);
  frame();
  const tileReference = tileShade((saved['tile-every'] = frame()));
  r.tileReference = {
    pixels: tileReference.pixels,
    shadowed: tileReference.shadowed,
    lit: tileReference.lit,
  };
  r.tile = tileShades.map((shade) => ({
    pixels: shade.pixels,
    shadowed: shade.shadowed,
    lit: shade.lit,
    like: alike(shade.mask, tileReference.mask),
  }));
  tileAgain.destroy();
  // Desktop time a frame, the GPU made to finish by the read: not phone evidence.
  const time = (update: string) => {
    look.setLook({ ...LOOK, shadows: shadows(update, { interval: 3 }) });
    for (let i = 0; i < 3; i++) frame();
    const start = performance.now();
    for (let i = 0; i < 30; i++) {
      place(i % 9);
      frame();
    }
    return +((performance.now() - start) / 30).toFixed(2);
  };
  r.desktopMs = { every: time('every'), interval3: time('interval'), manual: time('manual') };
  // A heavier shadow: four splits of 4096 over 400 casters.
  for (let i = 0; i < 20; i++)
    for (let j = 0; j < 20; j++) box([0.2, 0.6, 0.2], [-6 + i * 0.6, 0.3, -8 + j * 0.6], cut);
  const heavy = { ...LOOK.shadows, resolution: 4096, cascades: 4 };
  const timeHeavy = (update: string) => {
    look.setLook({ ...LOOK, shadows: { ...heavy, update, interval: 3 } });
    for (let i = 0; i < 3; i++) frame();
    const start = performance.now();
    for (let i = 0; i < 30; i++) {
      place(i % 9);
      frame();
    }
    return +((performance.now() - start) / 30).toFixed(2);
  };
  r.desktopHeavyMs = { every: timeHeavy('every'), interval3: timeHeavy('interval') };
  r.invalid = (() => {
    try {
      look.setLook({ ...LOOK, shadows: shadows('interval', { interval: 1 }) });
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  })();
  look.dispose();
  r.afterDispose = {
    accessor: !!Object.getOwnPropertyDescriptor(scene, '_ShadowMapupdateFrequency')?.get,
    frequency: scene.shadowMapFrequency,
  };
  scene.destroy(true);
  for (const item of owned) item.destroy();
  out.r = r;
  finish();
}

function finish() {
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}

/** The pond's part of the frame, and the corner where the mirror's own picture is shown. */
const POND = { x0: 260, y0: 150, x1: W, y1: H };
const MIRROR = { x0: 0, y0: H - 144, x1: 256, y1: H };
const inside = (i: number, r: typeof POND) => {
  const x = i % W,
    y = (i / W) | 0;
  return x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1;
};
/** The shadows on land: outside the pond and the mirror's picture. */
const landMask = (p: Uint8Array) => {
  const mask = shadowMask(p);
  for (let i = 0; i < W * H; i++) if (inside(i, POND) || inside(i, MIRROR)) mask[i] = 0;
  return mask;
};
/** Between the wall in the sun and the wall in shadow, as the mirror's picture shows them. */
const MIRROR_DARK = 110;
/** The shadow the mirror's picture shows on the wall: its dark pixels that are not a post. */
const mirrorMask = (p: Uint8Array) => {
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++)
    if (inside(i, MIRROR) && !isRed(p, i * 4) && lum(p, i * 4) < MIRROR_DARK) mask[i] = 1;
  return mask;
};
const count = (mask: Uint8Array) => {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i];
  return n;
};
/** Mean difference in brightness, 0..255, over the frame or a part of it, posts left out. */
const meanDiff = (a: Uint8Array, b: Uint8Array, part?: typeof POND) => {
  let s = 0,
    n = 0;
  for (let i = 0; i < W * H; i++) {
    if (part && (!inside(i, part) || isRed(a, i * 4) || isRed(b, i * 4))) continue;
    s += Math.abs(lum(a, i * 4) - lum(b, i * 4));
    n++;
  }
  return +(s / Math.max(n, 1)).toFixed(3);
};

/**
 * A pond whose mirror the game draws from its tick, as a game does: after
 * the frame, in the same LayaAir frame. Beyond it a wall in the sun with a
 * bar's shadow across it, which the mirror sees; the mirror's own picture is
 * shown in a corner of the frame. For each `mirrorShadows` (left out, true,
 * false): the shadows on land and in the mirror, every third frame and on
 * request, against the same scene drawn every frame. Then a probe captured
 * while the maps are kept. Two cascades, as a look has by default: maps
 * fitted to another camera then miss this camera's ground altogether.
 */
async function water(w: any) {
  const { scene, camera, look, LOOK: flat, shadows: one, box, paint, place, frame, r } = w;
  const shadows = (update: string, extra: object = {}) => ({ ...one(update, extra), cascades: 2 });
  const LOOK = { ...flat, shadows: shadows('every') };
  const EYE = [0, 6, 6.5],
    TARGET = [0, 0, 0.5];
  box([5, 4, 0.2], [4, 2, 1.3], paint([0.85, 0.85, 0.85]));
  box([5, 0.5, 0.5], [4, 3, 2.4], paint([0.85, 0.06, 0.04]));
  const setLook = (next: object) => {
    const mode = look.setLook(next);
    // The water reads the scene behind it and how far away that is; a rebuilt look resets both.
    camera.depthTextureMode |= Laya.DepthTextureMode.Depth;
    camera.opaquePass = true;
    return mode;
  };
  /** Nine frames with the post moving, against the every-frame pictures. */
  const walk = (
    label: string,
    reference: Uint8Array[],
    referenceMask: Uint8Array[],
    drawnAt: (k: number) => number,
  ) => {
    const rows: any[] = [];
    let before = look.shadowStats;
    for (let k = 0; k < 9; k++) {
      place(k);
      const p = (saved[label + '-' + k] = frame());
      const mask = landMask(p);
      const now = look.shadowStats;
      const kept = drawnAt(k);
      rows.push({
        k,
        drew: now.drawn !== before.drawn,
        shadow: count(mask),
        everyFrame: count(referenceMask[k]),
        likeNow: overlap(mask, referenceMask[k], p, reference[k]),
        likeDrawn: overlap(mask, referenceMask[kept], p, reference[kept]),
        // What the mirror's own picture shows of the bar's shadow on the wall.
        mirrorShadow: count(mirrorMask(p)),
        pondDiff: meanDiff(p, reference[k], POND),
      });
      before = now;
    }
    return rows;
  };
  r.water = {};
  for (const [name, mirrorShadows] of [
    ['default', undefined],
    ['own', true],
    ['main', false],
  ] as const) {
    const row: any = (r.water[name] = {});
    const pond = new Z.ZhudaWaterSurface(scene, {
      position: [3.2, 0.03, 3],
      size: [3, 3],
      foamDepth: 0,
      resolution: 512,
      ...(mirrorShadows === undefined ? {} : { mirrorShadows }),
    });
    // What the mirror drew, as it is, in the lower left corner of the frame.
    const shown = new Laya.Sprite();
    shown.graphics.drawTexture(
      new Laya.Texture((pond as any).reflection.texture),
      MIRROR.x0,
      MIRROR.y0,
      MIRROR.x1 - MIRROR.x0,
      MIRROR.y1 - MIRROR.y0,
    );
    Laya.stage.addChild(shown);
    tick = () => {
      pond.update(EYE, TARGET, 50, W / H);
      pond.render();
    };
    setLook(LOOK);
    frame();
    frame();
    const reference: Uint8Array[] = [],
      referenceMask: Uint8Array[] = [];
    for (let k = 0; k < 9; k++) {
      place(k);
      const p = (saved[`water-${name}-every-${k}`] = frame());
      reference.push(p);
      referenceMask.push(landMask(p));
    }
    row.everyFrame = {
      shadow: count(referenceMask[0]),
      mirrorShadow: count(mirrorMask(reference[8])),
    };
    setLook({ ...LOOK, shadows: shadows('interval', { interval: 3 }) });
    row.interval = walk(`water-${name}-interval`, reference, referenceMask, (k) => k - (k % 3));
    row.intervalStats = look.shadowStats;
    setLook({ ...LOOK, shadows: shadows('manual') });
    place(0);
    frame();
    const before = look.shadowStats;
    row.manual = walk(`water-${name}-manual`, reference, referenceMask, () => 0);
    const after = look.shadowStats;
    row.manualStats = {
      frames: after.frames - before.frames,
      drawn: after.drawn - before.drawn,
      taken: after.taken - before.taken,
    };
    if (name === 'default') {
      // A probe: six views of the scene, each with shadows on, drawn by another camera.
      const probe = new Z.ZhudaEnvironmentProbe(scene);
      const capture = { position: [0, 2, 2], captureSize: 64, reflectionOnly: true } as const;
      setLook(LOOK);
      place(2);
      await probe.capture(capture);
      frame();
      const lit = (saved['water-probe-every'] = frame());
      const litMask = landMask(lit);
      setLook({ ...LOOK, shadows: shadows('interval', { interval: 3 }) });
      for (let i = 0; i < 4; i++) frame();
      const start = look.shadowStats;
      await probe.capture(capture);
      row.probe = { everyFrame: count(litMask), frames: [] as any[] };
      for (let i = 0; i < 4; i++) {
        const p = (saved['water-probe-' + i] = frame());
        const mask = landMask(p);
        row.probe.frames.push({ shadow: count(mask), like: overlap(mask, litMask, p, lit) });
      }
      const end = look.shadowStats;
      row.probe.stats = {
        frames: end.frames - start.frames,
        drawn: end.drawn - start.drawn,
        taken: end.taken - start.taken,
      };
      probe.dispose();
    }
    tick = () => {};
    setLook(LOOK);
    shown.destroy();
    pond.dispose();
  }
}

/**
 * Stills of a film stage under each `shadows.update`, a plate moved between
 * them: each still must be the still drawn every frame.
 */
async function film() {
  const r: any = { film: {} };
  const every: Record<string, Uint8Array> = {};
  const isPlate = (p: Uint8Array, i: number) => p[i] > 110 && p[i + 1] < 70 && p[i + 2] < 70;
  for (const update of ['every', 'manual', 'interval']) {
    const stage = Z.mountZhudaFilmScene(context.rootScene, {
      schemaVersion: 1,
      id: 'stills-' + update,
      camera: { eye: [0, 10, 7], target: [0, 0, 0], focalLengthMm: 28 },
      look: {
        sky: [0.2, 0.25, 0.3],
        ambient: [0.35, 0.35, 0.35],
        sun: { elevationDeg: 65, azimuthDeg: 0, intensity: 1.6, color: [1, 1, 1] },
        shadows: {
          softness: 'hard',
          distance: 40,
          resolution: 2048,
          cascades: 1,
          update,
          interval: 30,
        },
        fog: false,
        grade: { exposure: 1, bloom: 0, ao: 0 },
      },
      materials: { floor: { color: [0.75, 0.75, 0.75], roughness: 0.9 } },
      nodes: [
        { id: 'floor', type: 'ground', size: [30, 30], material: 'floor' },
        { id: 'pond', type: 'water', position: [0, 0.05, 4.4], size: [12, 2.6] },
      ],
    });
    const red = Z.Zhuda3D.createMaterial({ type: 'pbr', albedoColor: [0.9, 0.04, 0.04, 1] });
    const plate = new Z.ZhudaDynamicMesh(
      Z.createZhudaBoxMesh({ width: 2, height: 0.1, depth: 2 }),
      stage.scene3D,
    );
    plate.node.meshRenderer.sharedMaterial = red;
    plate.node.meshRenderer.castShadow = true;
    plate.node.meshRenderer.receiveShadow = true;
    const renderer = new Z.ZhudaFilmRenderer(stage, context.runtime);
    const row: any = (r.film[update] = {});
    for (const [label, x, samples] of [
      ['a', -3, 1],
      ['b', 3, 1],
      ['c', -3, 4],
      ['d', 3, 4],
    ] as const) {
      plate.node.transform.position = new Laya.Vector3(x, 2, 0);
      const still = await renderer.render({ width: W, height: H, samples, aperture: false });
      const p = (saved[`film-${update}-${label}`] = still.rgba as Uint8Array);
      if (update === 'every') every[label] = p;
      // The ground's brightness: most of the still is sunlit ground.
      const values: number[] = [];
      for (let i = 0; i < p.length; i += 16) values.push(lum(p, i));
      values.sort((a, b) => a - b);
      const ground = values[Math.floor(values.length * 0.6)];
      row[label] = {
        plate: centroid(p, (i) => isPlate(p, i * 4)),
        // The plate's shadow on the ground, above the pond in the still.
        shadow: centroid(
          p,
          (i) => i < W * 200 && !isPlate(p, i * 4) && lum(p, i * 4) < ground * 0.7,
        ),
        likeEvery: meanDiff(p, every[label]),
      };
    }
    renderer.dispose();
    plate.dispose();
    red.destroy();
    stage.dispose();
  }
  out.r = r;
  finish();
}

main().catch((error) => {
  out.error = String(error?.stack || error);
});
