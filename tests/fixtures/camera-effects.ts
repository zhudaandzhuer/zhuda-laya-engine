// Real-draw fixture for scripts/verify-camera-effects.mjs: a game's look
// (ZhudaSceneLook) with depth of field, motion blur and automatic exposure.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__CAMERA__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300,
  FOV = 50;
let context: any;
let gl: WebGLRenderingContext | null = null;
let copy: CanvasRenderingContext2D | null = null;

const lum = (p: Uint8Array, i: number) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
const meanLum = (p: Uint8Array) => {
  let s = 0;
  for (let i = 0; i < p.length; i += 4) s += lum(p, i);
  return +(s / (p.length / 4)).toFixed(2);
};
const meanAbsDiff = (a: Uint8Array, b: Uint8Array) => {
  let s = 0;
  for (let i = 0; i < a.length; i += 4) s += Math.abs(lum(a, i) - lum(b, i));
  return +(s / (a.length / 4)).toFixed(3);
};
/**
 * How sharp the picture is over columns x0..x1 of the middle rows: the root
 * of the mean squared step in brightness between neighbours along a row. A
 * blur spreads an edge over many small steps, which this counts for little.
 */
const detail = (p: Uint8Array, x0: number, x1: number) => {
  let s = 0,
    n = 0;
  for (let y = 110; y < 190; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      s += (lum(p, i + 4) - lum(p, i)) ** 2;
      n++;
    }
  return +Math.sqrt(s / n).toFixed(3);
};
const NEAR = [20, 150] as const,
  FAR = [330, 460] as const;

function read() {
  if (gl) {
    const pixels = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }
  copy!.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy!.getImageData(0, 0, W, H).data.buffer);
}

function build() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 1.6, 0], rotationEuler: [0, 0, 0] });
  camera.fieldOfView = FOV;
  camera.nearPlane = 0.1;
  camera.farPlane = 300;
  const owned: any[] = [];
  const paint = (rgb: number[]) => {
    const material = Z.Zhuda3D.createMaterial({ type: 'unlit', albedoColor: [...rgb, 1] });
    owned.push(material);
    return material;
  };
  const light = paint([0.8, 0.8, 0.78]),
    dark = paint([0.08, 0.08, 0.1]),
    ground = paint([0.3, 0.3, 0.3]);
  const box = (size: number[], at: number[], material: any) => {
    const mesh = Z.Zhuda3D.createPrimitiveMesh('box', {
      width: size[0],
      height: size[1],
      depth: size[2],
    });
    owned.push(mesh);
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.transform.position = new Laya.Vector3(at[0], at[1], at[2]);
    scene.addChild(node);
  };
  box([400, 0.2, 400], [0, -0.1, 0], ground);
  // Stripes 10 cm wide 3 m away on the left, 1 m wide 40 m away on the right.
  for (let i = 0; i < 12; i++)
    box([0.1, 1.4, 0.02], [-1.95 + i * 0.1, 1.6, -3], i % 2 ? light : dark);
  for (let i = 0; i < 17; i++) box([1, 12, 0.2], [11.5 + i, 6, -40], i % 2 ? light : dark);
  return {
    scene,
    camera,
    dispose() {
      scene.destroy(true);
      for (const item of owned) item.destroy();
    },
  };
}

const BASE = {
  sky: [0.4, 0.5, 0.6],
  ambient: [0.5, 0.5, 0.5],
  sun: { elevationDeg: 50, azimuthDeg: 20, intensity: 1, color: [1, 1, 1] },
  shadows: false,
  fog: false,
  grade: { exposure: 1, contrast: 1, saturation: 1, bloom: 0, ao: 0, antialias: 'none' },
};

function check() {
  const world = build();
  const r: any = {};
  let eye: [number, number, number] = [0, 1.6, 0],
    target: [number, number, number] = [0, 1.6, -10];
  const look = new Z.ZhudaSceneLook(world.scene, world.camera, BASE);
  const frame = (frames = 2, seconds = 1 / 60) => {
    world.camera.transform.position = new Laya.Vector3(...eye);
    world.camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0));
    for (let i = 0; i < frames; i++) {
      look.update(eye, target, FOV, W / H, seconds);
      Z.ZhudaEngine.flushRenderFrames(1);
    }
    return read();
  };
  const sharp = frame();
  r.sharp = { near: detail(sharp, ...NEAR), far: detail(sharp, ...FAR), mean: meanLum(sharp) };

  // Depth of field: focus on the near stripes, then pulled to the far ones in place.
  r.dofMode = look.setLook({
    ...BASE,
    depthOfField: { focusDistanceM: 3, fStop: 1.4, focalLengthMm: 85 },
  });
  const focusNear = frame();
  r.focusNear = { near: detail(focusNear, ...NEAR), far: detail(focusNear, ...FAR) };
  r.pullMode = look.setLook({
    ...BASE,
    depthOfField: { focusDistanceM: 40, fStop: 1.4, focalLengthMm: 85 },
  });
  const focusFar = frame();
  r.focusFar = { near: detail(focusFar, ...NEAR), far: detail(focusFar, ...FAR) };
  r.dofOffMode = look.setLook(BASE);
  r.dofOffDiff = meanAbsDiff(sharp, frame());

  // Motion blur: nothing while the camera stands, a smear in the frame after it turns.
  r.motionMode = look.setLook({ ...BASE, motionBlur: { shutter: 1, maxLength: 0.1 } });
  const still = frame(3);
  r.stillDiff = meanAbsDiff(sharp, still);
  target = [1.2, 1.6, -10];
  const turning = frame(1);
  const settled = frame(2);
  r.turning = { near: detail(turning, ...NEAR), far: detail(turning, ...FAR) };
  r.settled = { near: detail(settled, ...NEAR), far: detail(settled, ...FAR) };
  target = [0, 1.6, -10];
  r.backDiff = meanAbsDiff(sharp, frame(2));
  look.setLook(BASE);

  // Automatic exposure: a dim scene is lifted, a bright one dimmed, and the
  // eye takes time to follow.
  const dim = { ...BASE, sky: [0.01, 0.012, 0.016], grade: { ...BASE.grade, exposure: 0.2 } };
  const bright = { ...BASE, sky: [1, 1, 1] };
  look.setLook(dim);
  r.dim = meanLum(frame());
  look.setLook(bright);
  r.bright = meanLum(frame());
  r.exposureMode = look.setLook({ ...dim, autoExposure: { speed: 0 } });
  r.dimLifted = meanLum(frame(3));
  // This scene's middle is near the default key: a lower key dims it.
  look.setLook({ ...bright, autoExposure: { speed: 0, key: 0.04 } });
  r.brightDimmed = meanLum(frame(3));
  // From bright to dim at one adaptation a second, a tenth of a second a frame.
  look.setLook({ ...bright, autoExposure: { speed: 1 } });
  frame(60, 0.1);
  look.setLook({ ...dim, autoExposure: { speed: 1 } });
  r.adapting = [1, 5, 15, 60].map((frames) => meanLum(frame(frames, 0.1)));
  r.resourcesBefore = Z.inspectSceneResources().resources;
  for (let i = 0; i < 10; i++) {
    look.setLook({
      ...BASE,
      autoExposure: true,
      motionBlur: true,
      depthOfField: { focusDistanceM: 5 },
    });
    frame(1);
    look.setLook(BASE);
    frame(1);
  }
  r.resourcesAfter = Z.inspectSceneResources().resources;
  r.invalid = (() => {
    try {
      look.setLook({ ...BASE, depthOfField: { fStop: 2 } as any });
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  })();
  look.dispose();
  world.dispose();
  return r;
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
  out.camera = check();
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
