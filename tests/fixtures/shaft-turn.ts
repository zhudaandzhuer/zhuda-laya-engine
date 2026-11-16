// Real-draw fixture for scripts/verify-shaft-turn.mjs: a game's look
// (ZhudaSceneLook, which keeps the depth picture of the light between frames)
// with light shafts in black fog, a long dark wall in the low eastern sun, and
// the sun turning a little every frame as a game's clock turns it. The page
// counts the depth pictures drawn and reads frames back. Runtime functions
// come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__SHAFT_TURN__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300,
  FOV = 50;
const EYE: [number, number, number] = [0, 2, 6],
  TARGET: [number, number, number] = [0, 2, -8];
let context: any;
let gl: WebGL2RenderingContext | null = null;
let copy: CanvasRenderingContext2D | null = null;

/** The frame, top row first on both backends. */
function read(): Uint8Array {
  if (gl) {
    const raw = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return pixels;
  }
  copy!.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy!.getImageData(0, 0, W, H).data.buffer);
}

/** Where a point lands on the frame (pinhole camera looking down -z, as set up below). */
function project(p: number[]): [number, number] {
  const t = Math.tan((FOV * Math.PI) / 360);
  const depth = EYE[2] - p[2];
  const x = (p[0] - EYE[0]) / depth / (t * (W / H)),
    y = (p[1] - EYE[1]) / depth / t;
  return [Math.round((W / 2) * (1 + x)), Math.round((H / 2) * (1 - y))];
}
/** Mean colour of a 9 by 9 patch. */
function patch(pixels: Uint8Array, [cx, cy]: [number, number]) {
  const sum = [0, 0, 0];
  for (let y = cy - 4; y <= cy + 4; y++)
    for (let x = cx - 4; x <= cx + 4; x++)
      for (let c = 0; c < 3; c++) sum[c] += pixels[(y * W + x) * 4 + c];
  return sum.map((v) => +(v / 81).toFixed(1));
}
const lum = (p: Uint8Array, i: number) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
function compare(a: Uint8Array, b: Uint8Array) {
  let sum = 0,
    changed = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.abs(lum(a, i) - lum(b, i));
    sum += d;
    if (d > 6) changed++;
  }
  return { meanAbsDiff: +(sum / (a.length / 4)).toFixed(3), changed };
}

async function main() {
  context = await Z.ZhudaEngine.boot({
    container: document.getElementById('view'),
    width: W,
    height: H,
    dprCap: 1,
    features: ['core', '3d', 'postProcess'],
    bgColor: '#000000',
  });
  const canvas = context.canvas as HTMLCanvasElement;
  gl = canvas.getContext('webgl2');
  if (!gl) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    copy = c.getContext('2d', { willReadFrequently: true });
  }
  out.canvas = gl ? 'webgl2' : 'webgpu';
  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, { position: EYE, rotationEuler: [0, 0, 0] });
  camera.fieldOfView = FOV;
  camera.nearPlane = 0.1;
  camera.farPlane = 300;
  camera.transform.lookAt(new Laya.Vector3(...TARGET), new Laya.Vector3(0, 1, 0));
  // A long dark wall at x = 5, 6 m tall: with the sun in the east at 30
  // degrees it shades the fog below y = 6 - (5 - x) tan 30.
  const dark = Z.Zhuda3D.createMaterial({ type: 'unlit', albedoColor: [0.02, 0.02, 0.02, 1] });
  const mesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 0.3, height: 6, depth: 80 });
  const wall = new Laya.MeshSprite3D(mesh);
  wall.meshRenderer.sharedMaterial = dark;
  wall.transform.position = new Laya.Vector3(5, 3, -20);
  scene.addChild(wall);

  // Count the depth pictures of the light.
  let pictures = 0;
  const draw = Laya.Camera.drawRenderTextureByScene;
  Laya.Camera.drawRenderTextureByScene = function (cam: any, ...rest: any[]) {
    if (cam?.name === 'zhuda-light-shafts') pictures++;
    return draw.call(this, cam, ...rest);
  };
  const lookAt = (elevationDeg: number) => ({
    sky: [0, 0, 0],
    ambient: [0, 0, 0],
    sun: { azimuthDeg: 90, elevationDeg, intensity: 3, color: [1, 0.9, 0.7] },
    shadows: false,
    fog: false,
    grade: { exposure: 1, contrast: 1, saturation: 1, bloom: 0, ao: 0, antialias: 'none' },
    lightFog: {
      density: 0.03,
      falloffMeters: 200,
      color: [0, 0, 0],
      scatter: 0,
      shafts: { strength: 4, distance: 30, steps: 64 },
    },
  });
  const look = new Z.ZhudaSceneLook(scene, camera, lookAt(30));
  const results: string[] = [];
  /** A frame with the sun at this elevation, read back; how many pictures it drew. */
  const frame = (elevationDeg: number) => {
    results.push(look.setLook(lookAt(elevationDeg)));
    const before = pictures;
    look.update(EYE, TARGET, FOV, W / H, 1 / 60);
    Z.ZhudaEngine.flushRenderFrames(1);
    return { pixels: read(), drew: pictures - before };
  };
  const UNDER = project([0, 1, -8]),
    ABOVE = project([0, 5, -8]),
    BEYOND = project([-6, 1, -8]),
    // Below the shade line at 30 to 33 degrees (y 3.1 to 2.7 at x = 0), above it at 40 (1.8).
    MID = project([0, 2.5, -8]);
  const shape = (pixels: Uint8Array) => ({
    under: patch(pixels, UNDER),
    mid: patch(pixels, MID),
    above: patch(pixels, ABOVE),
    beyond: patch(pixels, BEYOND),
  });
  out.check = () => {
    const r: any = {};
    // Warm up, then the first picture from 30 degrees.
    for (let i = 0; i < 3; i++) frame(30);
    // 0.3 degrees on: the picture is kept.
    const kept = frame(30.3);
    r.keptDrew = kept.drew;
    r.kept = shape(kept.pixels);
    // The same sun with a fresh picture.
    look['lightFog'].invalidateShafts();
    const fresh = frame(30.3);
    r.freshDrew = fresh.drew;
    r.fresh = shape(fresh.pixels);
    r.keptAgainstFresh = compare(kept.pixels, fresh.pixels);
    // Two fresh frames differ by their step noise alone: the scale for the above.
    look['lightFog'].invalidateShafts();
    r.freshAgainstFresh = compare(fresh.pixels, frame(30.3).pixels);
    // The sun climbing 0.05 degrees a frame for 60 frames (3 degrees).
    const start = pictures;
    let last = fresh.pixels;
    for (let i = 1; i <= 60; i++) last = frame(30.3 + i * 0.05).pixels;
    r.sweepPictures = pictures - start;
    r.afterSweep = shape(last);
    // 10 degrees higher the shade of the wall is lower: fresh, as it must be.
    const high = frame(40);
    r.highDrew = high.drew;
    r.high = shape(high.pixels);
    r.setLook = [...new Set(results)];
    return r;
  };
  out.ready = true;
}
void main().catch((error) => out.errors.push(String(error?.stack || error)));
