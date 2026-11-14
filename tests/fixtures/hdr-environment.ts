// Real-draw fixture for scripts/verify-hdr-environment.mjs: a Radiance HDR
// panorama made by tests/helpers/hdr-fixture.mjs (a sky, a ground, a sun and
// a coloured patch toward each axis) as the light and the sky of a scene
// with a mirror ball, a matte ball and a rough metal ball; and the studio
// room made by the engine.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__HDR__ = out;
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
/** Mean colour of a square of pixels round a point of the frame. */
const patch = (p: Uint8Array, cx: number, cy: number, half = 4) => {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = cy - half; y <= cy + half; y++)
    for (let x = cx - half; x <= cx + half; x++, n++)
      for (let c = 0; c < 3; c++) sum[c] += p[(y * W + x) * 4 + c];
  return sum.map((v) => +(v / n).toFixed(1));
};
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
/** Hard steps along the rows of a frame: pairs of neighbours more than 30 of 255 apart in a channel. */
const steps = (p: Uint8Array) => {
  let n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (
        Math.abs(p[i] - p[i + 4]) > 30 ||
        Math.abs(p[i + 1] - p[i + 5]) > 30 ||
        Math.abs(p[i + 2] - p[i + 6]) > 30
      )
        n++;
    }
  return n;
};
const v3 = (a: number[]) => new Laya.Vector3(a[0], a[1], a[2]);

async function bytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
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
    bgColor: '#000000',
  });
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  context.runtime.start(() => {});
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  out.formats = Z.zhudaEnvironmentFormats();

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0, 0, 0] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 3], target: [0, 0, 0], fov: 40 });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0, 0, 0, 1);
  camera.enableHDR = false;
  // Looks along a direction: from the far side of the middle when `orbit`, else from the middle itself.
  const look = (toward: number[], orbit: boolean) => {
    const up = Math.abs(toward[1]) > 0.9 ? [0, 0, -1] : [0, 1, 0];
    const eye = orbit ? toward.map((c) => -c * 3) : [0, 0, 0];
    camera.transform.position = v3(eye);
    camera.transform.lookAt(v3(eye.map((c, i) => c + toward[i])), v3(up));
  };
  const owned: any[] = [];
  const ball = (material: any, at: number[], radius = 0.5) => {
    const mesh = Laya.PrimitiveMesh.createSphere(radius, 48, 48);
    owned.push(mesh, material);
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.transform.position = v3(at);
    scene.addChild(node);
    return node;
  };
  const mirror = ball(
    Z.createSurfaceMaterial({ type: 'pbr', color: [1, 1, 1, 1], metallic: 1, roughness: 0 }),
    [0, 0, 0],
  );
  const matte = ball(
    Z.createSurfaceMaterial({ type: 'pbr', color: [0.8, 0.8, 0.8, 1], metallic: 0, roughness: 1 }),
    [-1.2, 0, 0],
  );
  const rough = ball(
    Z.createSurfaceMaterial({
      type: 'pbr',
      color: [0.9, 0.7, 0.4, 1],
      metallic: 1,
      roughness: 0.5,
    }),
    [1.2, 0, 0],
  );
  /** Looks straight at a ball from three units before it: the ball fills the middle of the frame. */
  const aim = (node: any) => {
    const p = node.transform.position;
    camera.transform.position = v3([p.x, p.y, p.z + 3]);
    camera.transform.lookAt(v3([p.x, p.y, p.z]), v3([0, 1, 0]));
  };
  /** The three balls from a little above and further back, for a person to look at. */
  const wide = () => {
    camera.transform.position = v3([0, 0.7, 4.6]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  };
  const only = (node: any | null) => {
    for (const each of [mirror, matte, rough]) each.active = node === null || each === node;
  };
  const frame = () => {
    Z.ZhudaEngine.flushRenderFrames(3);
    return read();
  };
  const centre = () => patch(frame(), W / 2, H / 2);

  const manifest = JSON.parse(new TextDecoder().decode(await bytes('fixtures/manifest.json')));
  const marked = Z.decodeRadianceHdr(await bytes('fixtures/marked.hdr'));
  const plain = Z.decodeRadianceHdr(await bytes('fixtures/plain.hdr'));
  out.panorama = { width: marked.width, height: marked.height };
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
  /** Live resources by class, to name what a disposal leaves. */
  const census = () => {
    const map = Laya.Resource._idResourcesMap;
    const items: any[] = map instanceof Map ? [...map.values()] : Object.values(map || {});
    const count: Record<string, number> = {};
    for (const item of items)
      if (!item.destroyed) {
        const name = `${item.constructor?.name}:${item.width ?? ''}x${item.height ?? ''}:${item.format ?? ''}`;
        count[name] = (count[name] ?? 0) + 1;
      }
    return count;
  };
  Z.ZhudaEngine.flushRenderFrames(2);
  const resourcesBefore = held();
  const censusBefore = census();
  const before = {
    mode: scene.ambientMode,
    hasIbl: !!scene.iblTex,
    rotate: scene.GIRotate,
    clearFlag: camera.clearFlag,
    hasSky: !!scene.skyRenderer.material,
  };

  // The sky, and what a mirror shows of it, toward each axis; then turned a quarter to the right.
  const started = performance.now();
  let environment = new Z.ZhudaHdrEnvironment(scene, { panorama: marked }, { camera, size: 64 });
  out.buildMs = +(performance.now() - started).toFixed(1);
  out.format = environment.format;
  const directions: Record<string, number[]> = manifest.directions;
  const survey = () => {
    const result: any = { sky: {}, mirror: {} };
    for (const [name, toward] of Object.entries(directions)) {
      // The sky itself, with nothing in the way.
      only(null);
      for (const each of [mirror, matte, rough]) each.active = false;
      look(toward, false);
      result.sky[name] = centre();
      // The middle of the mirror ball, seen from the other side: it shows what is behind the eye.
      only(mirror);
      look(toward, true);
      result.mirror[name] = centre();
    }
    return result;
  };
  out.unturned = survey();
  environment.setRotation(90);
  out.turned = survey();
  out.rotation = environment.rotation;
  environment.setRotation(0);

  // The three balls under the marked panorama, in each format this device filters.
  only(null);
  aim(matte);
  const matteFrame = frame();
  wide();
  saved.float = frame();
  out.balls = {
    // The matte ball: its top faces the sky, its underside the ground.
    matteTop: patch(matteFrame, W / 2, H / 2 - 45, 3),
    matteBottom: patch(matteFrame, W / 2, H / 2 + 45, 3),
  };
  environment.dispose();
  out.byFormat = {};
  for (const format of out.formats as string[]) {
    const stored = new Z.ZhudaHdrEnvironment(
      scene,
      { panorama: marked },
      { camera, size: 64, format },
    );
    const picture = (saved[format] = frame());
    out.byFormat[format] = { used: stored.format, difference: difference(picture, saved.float) };
    stored.dispose();
  }
  // A format this device does not have is refused, not replaced.
  out.refusedFormat = (() => {
    const missing = ['float', 'half'].find((name) => !out.formats.includes(name));
    if (!missing) return null;
    try {
      new Z.ZhudaHdrEnvironment(scene, { panorama: marked }, { camera, format: missing }).dispose();
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  })();

  // Light alone (no patches, no sun): twice the exposure is twice the light; intensities scale.
  only(matte);
  aim(matte);
  const lit = (options: any) => {
    const e = new Z.ZhudaHdrEnvironment(
      scene,
      { panorama: plain },
      { camera, size: 32, ...options },
    );
    const value = patch(frame(), W / 2, H / 2 - 40, 3);
    e.dispose();
    return value;
  };
  out.exposure = { half: lit({ exposure: 0.2 }), one: lit({ exposure: 0.4 }) };
  out.ambient = { full: lit({ exposure: 0.4 }), half: lit({ exposure: 0.4, ambient: 0.5 }) };

  // A soft sky: the patch toward -Z is spread out.
  for (const each of [mirror, matte, rough]) each.active = false;
  look([0, 0, -1], false);
  environment = new Z.ZhudaHdrEnvironment(scene, { panorama: marked }, { camera, size: 64 });
  const sharpSky = (saved.sky = frame());
  environment.dispose();
  environment = new Z.ZhudaHdrEnvironment(
    scene,
    { panorama: marked },
    { camera, size: 64, skyBlur: 0.8 },
  );
  const softSky = (saved['sky-soft'] = frame());
  out.softSky = {
    sharpCentre: patch(sharpSky, W / 2, H / 2),
    softCentre: patch(softSky, W / 2, H / 2),
    difference: difference(softSky, sharpSky),
    sharpSteps: steps(sharpSky),
    softSteps: steps(softSky),
  };
  environment.dispose();

  // The studio room: no sky of its own, lamps in the mirror.
  only(null);
  // (the room is made first; the camera is aimed for each reading below)
  const room = new Z.ZhudaHdrEnvironment(scene, { cube: Z.zhudaStudioEnvironment() }, { camera });
  aim(mirror);
  const mirrorFrame = frame();
  aim(matte);
  const matteStudio = frame();
  wide();
  saved.studio = frame();
  out.studio = {
    clearFlag: camera.clearFlag === before.clearFlag,
    background: patch(saved.studio, 20, 20),
    // The top of the mirror ball shows the lamp overhead.
    // Where the mirror ball leans 45 degrees upward it shows what is straight overhead: the lamp.
    mirrorTop: patch(mirrorFrame, W / 2, H / 2 - 48, 2),
    // And where it leans downward, the floor.
    mirrorBottom: patch(mirrorFrame, W / 2, H / 2 + 48, 2),
    matte: patch(matteStudio, W / 2, H / 2 - 20, 3),
  };
  out.studioSky = (() => {
    try {
      new Z.ZhudaHdrEnvironment(scene, { cube: Z.zhudaStudioEnvironment() }, { camera, sky: true });
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  })();
  room.dispose();

  // Given back: the scene as it was, and nothing left behind.
  out.after = {
    mode: scene.ambientMode === before.mode,
    hasIbl: !!scene.iblTex,
    rotate: scene.GIRotate,
    clearFlag: camera.clearFlag === before.clearFlag,
    hasSky: !!scene.skyRenderer.material,
    resources: held() - resourcesBefore,
    left: (() => {
      const now = census();
      return Object.keys(now)
        .filter((name) => now[name] !== (censusBefore[name] ?? 0))
        .map((name) => `${name} ${censusBefore[name] ?? 0}->${now[name]}`);
    })(),
  };
  out.before = before;
  out.invalid = (() => {
    const tries: Record<string, () => unknown> = {
      both: () =>
        new Z.ZhudaHdrEnvironment(scene, { panorama: marked, cube: Z.zhudaStudioEnvironment() }),
      blur: () => new Z.ZhudaHdrEnvironment(scene, { panorama: marked }, { skyBlur: 2 }),
      reflection: () => new Z.ZhudaHdrEnvironment(scene, { panorama: marked }, { reflection: 9 }),
      scene: () => new Z.ZhudaHdrEnvironment({}, { panorama: marked }),
    };
    const result: Record<string, string> = {};
    for (const [name, make] of Object.entries(tries))
      try {
        make();
        result[name] = 'accepted';
      } catch (error) {
        result[name] = String((error as Error).message);
      }
    return result;
  })();
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
