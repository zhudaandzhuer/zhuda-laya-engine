// Real-draw fixture for scripts/verify-live-look.mjs. Runtime functions come
// from the browser SDK global (Zhuda); nothing else is bundled.
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__LIVE__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300;
let context: any;
let gl: WebGLRenderingContext | null = null;
let copy: CanvasRenderingContext2D | null = null;
let frameIndex = 0;

function draw(stage: any) {
  stage.prepare(W / H, { width: W, height: H, index: frameIndex++ });
  Z.ZhudaEngine.flushRenderFrames(3);
  if (gl) {
    const pixels = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }
  // WebGPU: the frame just drawn, through a 2D canvas. Rows run the other way
  // up than readPixels; every measure here uses x and brightness only.
  copy!.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy!.getImageData(0, 0, W, H).data.buffer);
}
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
/** Mean screen x of pixels that pass `keep`, and how many there are. */
function centroid(p: Uint8Array, keep: (i: number) => boolean) {
  let sx = 0,
    n = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      if (keep(i)) {
        sx += x;
        n++;
      }
    }
  return { x: n ? +(sx / n).toFixed(1) : null, n };
}

/** A hooked plate lifted above a floor: the hook shifts it along +X in every pass. */
function vertexCheck() {
  const stage = Z.mountZhudaFilmScene(context.rootScene, {
    schemaVersion: 1,
    id: 'vertex-hook',
    camera: { eye: [0, 10, 7], target: [0, 0, 0], focalLengthMm: 28 },
    look: {
      sky: [0.2, 0.25, 0.3],
      ambient: [0.35, 0.35, 0.35],
      sun: { elevationDeg: 65, azimuthDeg: 0, intensity: 1.6, color: [1, 1, 1] },
      shadows: { softness: 'hard', distance: 40, resolution: 2048, cascades: 1 },
    },
    materials: { floor: { color: [0.75, 0.75, 0.75], roughness: 0.9 } },
    nodes: [{ id: 'floor', type: 'ground', size: [30, 30], material: 'floor' }],
  });
  const hooked = new Z.ZhudaLitSurfaceMaterial({
    name: 'ZhudaVerifyVertexShift',
    surface: 'void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {}',
    vertex:
      'void zhudaVertex(inout vec3 p, inout vec3 n, vec2 uv, vec3 origin) { p.x += u_ZhudaShift; }',
    uniforms: { u_ZhudaShift: { type: 'float', value: 0 } },
    material: { color: [0.9, 0.04, 0.04, 1], roughness: 0.6 },
  });
  const plate = new Z.ZhudaDynamicMesh(
    Z.createZhudaBoxMesh({ width: 2, height: 0.1, depth: 2 }),
    stage.scene3D,
  );
  plate.node.transform.position = new Laya.Vector3(-1.5, 2, 0);
  plate.node.meshRenderer.sharedMaterial = hooked.material;
  plate.node.meshRenderer.castShadow = true;
  plate.node.meshRenderer.receiveShadow = true;
  const red = (p: Uint8Array) => (i: number) => p[i] > 110 && p[i + 1] < 70 && p[i + 2] < 70;
  const shade = (p: Uint8Array, floor: number) => (i: number) =>
    !red(p)(i) && lum(p, i) < floor * 0.7 && lum(p, i) > 2;
  const result: any = {};
  for (const shift of [0, 3]) {
    hooked.set('u_ZhudaShift', shift);
    const p = draw(stage);
    // Floor brightness: the median of the lower half of the frame.
    const values: number[] = [];
    for (let i = 0; i < p.length; i += 16) values.push(lum(p, i));
    values.sort((a, b) => a - b);
    const floor = values[Math.floor(values.length * 0.6)];
    result['shift' + shift] = {
      plate: centroid(p, red(p)),
      shadow: centroid(p, shade(p, floor)),
      floor: +floor.toFixed(1),
    };
  }
  plate.dispose();
  hooked.dispose();
  stage.dispose();
  return result;
}

/**
 * Two flat squares wound opposite ways, seen from above: a one-sided material
 * shows one of them, a two-sided one shows both.
 */
function twoSidedCheck() {
  const stage = Z.mountZhudaFilmScene(context.rootScene, {
    schemaVersion: 1,
    id: 'two-sided',
    camera: { eye: [0, 10, 0.01], target: [0, 0, 0], focalLengthMm: 28 },
    look: { sky: [0, 0, 0], ambient: [0.2, 0.2, 0.2], sun: { intensity: 0 }, shadows: false },
    nodes: [],
  });
  const green = (p: Uint8Array) => (i: number) => p[i + 1] > 90 && p[i] < 60 && p[i + 2] < 60;
  const result: any = {};
  for (const doubleSided of [false, true]) {
    const material = new Z.ZhudaLitSurfaceMaterial({
      name: doubleSided ? 'ZhudaVerifyTwoSided' : 'ZhudaVerifyOneSided',
      surface: 'void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {}',
      material: { color: [0, 0, 0, 1], roughness: 1, emission: [0, 0.8, 0], doubleSided },
    });
    const squares = [-1.6, 1.6].map((x, k) => {
      const mesh = new Z.ZhudaDynamicMesh(
        {
          positions: new Float32Array([x - 1, 0, -1, x + 1, 0, -1, x - 1, 0, 1, x + 1, 0, 1]),
          normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
          uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
          indices: new Uint16Array(k ? [0, 1, 2, 2, 1, 3] : [0, 2, 1, 2, 3, 1]),
        },
        stage.scene3D,
      );
      mesh.node.meshRenderer.sharedMaterial = material.material;
      return mesh;
    });
    const p = draw(stage);
    result[doubleSided ? 'twoSided' : 'oneSided'] = centroid(p, green(p)).n;
    for (const mesh of squares) mesh.dispose();
    material.dispose();
  }
  stage.dispose();
  return result;
}

/**
 * Weather, quality and a lamp on one running stage with a pond: grade and fog
 * strengths change in place, quality goes 3 to 0 and back, a lamp is put out.
 */
function weatherCheck() {
  const look = {
    preset: 'day',
    sun: { elevationDeg: 40, azimuthDeg: -40, intensity: 1.2 },
    ambient: [0.2, 0.22, 0.28],
    shadows: { distance: 40 },
    grade: { exposure: 1.1, bloom: 0.1, ao: 0.6, vignette: 0.2 },
    lightFog: { density: 0.01, falloffMeters: 6, shafts: { strength: 0.8, steps: 16 } },
  };
  const stage = Z.mountZhudaFilmScene(context.rootScene, {
    schemaVersion: 1,
    id: 'weather',
    camera: { eye: [9, 4, 12], target: [0, 1, 0], focalLengthMm: 28 },
    look,
    materials: { floor: { color: [0.55, 0.5, 0.42], roughness: 0.9 } },
    nodes: [
      { id: 'floor', type: 'ground', size: [80, 80], material: 'floor' },
      { id: 'pond', type: 'water', position: [4, 0.02, -4], size: [6, 6] },
      {
        id: 'lamp',
        type: 'light',
        kind: 'point',
        position: [-2, 1.5, 2],
        color: [1, 0.7, 0.4],
        intensity: 12,
        range: 9,
      },
    ],
  });
  const r: any = {};
  const chain = () => stage.camera.postProcess;
  const f0 = draw(stage);
  const first = chain();
  r.resourcesAtStart = Z.inspectSceneResources().resources;
  // Overcast: less colour, more contrast and bloom, thicker and greyer fog.
  const overcast = {
    ...look,
    grade: { ...look.grade, saturation: 0.2, contrast: 1.3, bloom: 0.6, vignette: 0.6 },
    lightFog: {
      ...look.lightFog,
      density: 0.06,
      color: [0.5, 0.5, 0.55],
      shafts: { strength: 0.1, steps: 16 },
    },
  };
  r.overcastMode = stage.setLook(overcast);
  r.overcastSameChain = chain() === first;
  r.overcastDiff = meanAbsDiff(f0, draw(stage));
  r.clearMode = stage.setLook(look);
  r.clearDiff = meanAbsDiff(f0, draw(stage));
  // Quality: down to 0 (the pond keeps a bare HDR chain) and back.
  r.q0Mode = stage.setQuality(0);
  r.q0Quality = stage.quality;
  r.q0HasChain = !!chain();
  r.q0Grade = stage.look.grade ? [stage.look.grade.bloom, stage.look.grade.ao] : null;
  r.q0LightFog = stage.look.lightFog;
  r.q0Diff = meanAbsDiff(f0, draw(stage));
  r.q0Again = stage.setQuality(0);
  // A new look at a lower level is that look at that level.
  stage.setQuality(1);
  stage.setLook(overcast);
  r.q1Look = JSON.stringify(stage.look);
  r.q1Expected = JSON.stringify(
    Z.zhudaLookForQuality(Z.resolveZhudaFilmLook(overcast), 1, { keepGrade: true }),
  );
  stage.setLook(look);
  r.q3Mode = stage.setQuality(3);
  r.q3Diff = meanAbsDiff(f0, draw(stage));
  // Every level has been drawn once: from here on nothing may be added.
  r.resourcesBefore = Z.inspectSceneResources();
  for (let i = 0; i < 10; i++) {
    stage.setQuality(0);
    stage.setQuality(3);
  }
  r.cyclesDiff = meanAbsDiff(f0, draw(stage));
  r.resourcesAfter = Z.inspectSceneResources();
  // The lamp: out, then back, then twice as strong.
  stage.setLight('lamp', { enabled: false });
  const dark = draw(stage);
  r.lampOffDiff = meanAbsDiff(f0, dark);
  r.lampOffDarker = meanLum(dark) < meanLum(f0);
  stage.setLight('lamp', { enabled: true });
  r.lampOnDiff = meanAbsDiff(f0, draw(stage));
  stage.setLight('lamp', { intensity: 30, color: [0.4, 0.6, 1] });
  r.lampStrongDiff = meanAbsDiff(f0, draw(stage));
  try {
    stage.setLight('missing', { enabled: false });
    r.missing = 'accepted';
  } catch (error) {
    r.missing = String((error as Error).message);
  }
  try {
    stage.setLight('lamp', { intensity: -1 });
    r.negative = 'accepted';
  } catch (error) {
    r.negative = String((error as Error).message);
  }
  stage.dispose();
  return r;
}

function lookCheck() {
  const look = {
    preset: 'day',
    sun: { elevationDeg: 45, azimuthDeg: -40, intensity: 2 },
    ambient: [0.35, 0.4, 0.5],
    ambientGround: [0.16, 0.14, 0.08],
    shadows: { distance: 40 },
    fog: { color: [0.6, 0.68, 0.78], start: 30, end: 140 },
    grade: { exposure: 1.1, bloom: 0.1, ao: 0.6 },
    lightFog: { density: 0.01, falloffMeters: 6, shafts: { strength: 0.8, steps: 16 } },
  };
  const mount = (withLook: any) =>
    Z.mountZhudaFilmScene(context.rootScene, {
      schemaVersion: 1,
      id: 'live-look',
      camera: { eye: [9, 4, 12], target: [0, 1, 0], focalLengthMm: 28 },
      look: withLook,
      materials: {
        floor: { color: [0.55, 0.5, 0.42], roughness: 0.9 },
        wall: { color: [0.7, 0.66, 0.6], roughness: 0.8 },
      },
      nodes: [
        { id: 'floor', type: 'ground', size: [80, 80], material: 'floor' },
        { id: 'block', type: 'box', size: [3, 4, 3], position: [-2, 0, -1], material: 'wall' },
        { id: 'pillar', type: 'box', size: [0.6, 3, 0.6], position: [3, 0, 2], material: 'wall' },
        { id: 'pond', type: 'water', position: [4, 0.02, -4], size: [6, 6] },
      ],
    });
  const stage = mount(look);
  const r: any = {};
  const identity = () => ({
    post: stage.camera.postProcess,
    sky: stage.scene3D.skyRenderer.material,
  });
  const f0 = draw(stage);
  r.base = meanLum(f0);
  const before = identity();

  // Dusk: continuous values only.
  const dusk = {
    ...look,
    sun: { elevationDeg: 8, azimuthDeg: 70, intensity: 0.7, color: [1, 0.55, 0.3] },
    ambient: [0.12, 0.1, 0.14],
    fog: { color: [0.35, 0.25, 0.25], start: 15, end: 90 },
    grade: { ...look.grade, exposure: 0.8 },
  };
  r.duskMode = stage.setLook(dusk);
  const f1 = draw(stage);
  const after = identity();
  r.dusk = meanLum(f1);
  r.duskDiff = meanAbsDiff(f0, f1);
  r.duskSamePipeline = before.post === after.post && !!after.post;
  r.duskSameSky = before.sky === after.sky && !!after.sky;
  r.duskSunEuler = stage.look.sun.elevationDeg;

  // Structural: the light fog off (a full look rebuild), then back.
  r.plainMode = stage.setLook({ ...look, lightFog: false });
  const f2 = draw(stage);
  r.plainNewPipeline = !!stage.camera.postProcess && stage.camera.postProcess !== before.post;
  r.plainDiff = meanAbsDiff(f0, f2);
  r.backMode = stage.setLook(look);
  const f3 = draw(stage);
  r.backDiff = meanAbsDiff(f0, f3);
  r.backHasPipeline = !!stage.camera.postProcess && stage.camera.postProcess !== before.post;

  // Thirty rebuilds: resources settle.
  const counts = () => Z.inspectSceneResources();
  stage.setLook({ ...look, lightFog: false });
  stage.setLook(look);
  draw(stage);
  r.resourcesBefore = counts();
  for (let i = 0; i < 30; i++) {
    stage.setLook({ ...look, lightFog: false });
    draw(stage);
    stage.setLook(look);
    draw(stage);
  }
  r.resourcesAfter = counts();
  const f4 = draw(stage);
  r.cyclesDiff = meanAbsDiff(f0, f4);

  // Refusals leave the stage as it was.
  const refuse = (next: any) => {
    try {
      stage.setLook(next);
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  };
  r.panoramaRefusal = refuse({ ...look, panorama: { asset: 'sky.jpg' } });
  r.invalidRefusal = refuse({ ...look, sun: { elevationDeg: 200 } });
  r.lookAfterRefusals = stage.look.sun.elevationDeg;
  const f5 = draw(stage);
  r.refusalDiff = meanAbsDiff(f4, f5);

  // Per-frame cost of an in-place change (a day passing).
  const t0 = performance.now();
  for (let i = 0; i < 60; i++)
    stage.setLook({
      ...look,
      sun: { elevationDeg: 10 + i * 0.5, azimuthDeg: -40 + i, intensity: 1 + i * 0.01 },
    });
  r.inPlaceMs = +((performance.now() - t0) / 60).toFixed(3);
  // The same with the sky light changing colour: the hemisphere is recoloured in place.
  const counted = counts().resources;
  const t1 = performance.now();
  for (let i = 0; i < 60; i++)
    stage.setLook({ ...look, ambient: [0.1 + i * 0.004, 0.12 + i * 0.004, 0.2 + i * 0.004] });
  r.inPlaceAmbientMs = +((performance.now() - t1) / 60).toFixed(3);
  r.ambientResourcesStable = counts().resources === counted;

  // A recoloured sky light draws what a stage mounted with those colours draws.
  const tinted = { ...look, ambient: [0.9, 0.6, 0.3], ambientGround: [0.05, 0.3, 0.08] };
  stage.setLook(look);
  draw(stage);
  r.tintedMode = stage.setLook(tinted);
  const fTinted = draw(stage);
  r.tintedDiff = meanAbsDiff(f0, fTinted);
  stage.dispose();
  const fresh = mount(tinted);
  const fFresh = draw(fresh);
  r.tintedVsFresh = meanAbsDiff(fTinted, fFresh);
  fresh.dispose();
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
  out.vertex = vertexCheck();
  out.look = lookCheck();
  out.sides = twoSidedCheck();
  out.weather = weatherCheck();
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
