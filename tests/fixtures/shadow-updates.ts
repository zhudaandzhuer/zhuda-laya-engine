// Real-draw fixture for scripts/verify-shadow-updates.mjs: a red post that
// moves across a pale floor in the sun, its shadow drawn every frame, every
// third frame and on request (`look.shadows.update`), and a floor tile whose
// shader is first compiled on a frame that skips the shadow maps.
// `?native` uses LayaAir's own `Scene3D.shadowMapFrequency` instead, without
// the engine's rule or its repair, to show what the repair is for.
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
    const cut = paint([0.85, 0.85, 0.85]);
    cut.alphaTest = true;
    cut.alphaTestValue = 0.1;
    while ((Laya.Scene3D._updateMark + 1) % 3 === 0) frame();
    box([3, 0.04, 3], [2, 0.02, 2.2], cut);
    r.tile = [];
    for (let i = 0; i < 5; i++) {
      try {
        const p = (saved['native-tile-' + i] = frame());
        r.tile.push(tileLight(p));
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
  const rule = () => (look as any).parts.shadowUpdates;
  r.interval = walk('interval', (k) => k - (k % 3));
  r.intervalStats = rule().stats;
  // A floor tile whose material is first drawn on a frame that keeps the maps.
  const cut = paint([0.85, 0.85, 0.85]);
  cut.alphaTest = true;
  cut.alphaTestValue = 0.1;
  // Draw until a frame has drawn the maps: the next one keeps them.
  let drawnBefore: number;
  do {
    drawnBefore = rule().stats.drawn;
    frame();
  } while (rule().stats.drawn === drawnBefore);
  r.beforeTile = rule().stats;
  const tile = box([3, 0.04, 3], [2, 0.02, 2.2], cut);
  r.tile = [];
  for (let i = 0; i < 5; i++) {
    const p = (saved['tile-' + i] = frame());
    if (i === 0) r.tileFirst = rule().stats;
    r.tile.push(tileLight(p));
  }
  r.tileStats = rule().stats;
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
  r.manualStats = rule().stats;
  // Back to every frame: LayaAir's own path, the same picture as the reference.
  r.everyMode = look.setLook(LOOK);
  r.ruleGone = (look as any).parts.shadowUpdates === undefined;
  r.frequencyBack = scene.shadowMapFrequency;
  place(4);
  const back = frame();
  r.backLike = overlap(shadowMask(back), referenceMask[4], back, reference[4]);
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
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}

/** The share of the tile (its far half, which no shadow reaches) that is sunlit. */
function tileLight(p: Uint8Array) {
  let lit = 0,
    n = 0;
  for (let y = 222; y < 246; y++)
    for (let x = 330; x < 400; x++, n++) if (lum(p, (y * W + x) * 4) > litFloor * 0.8) lit++;
  return +(lit / n).toFixed(3);
}

main().catch((error) => {
  out.error = String(error?.stack || error);
});
