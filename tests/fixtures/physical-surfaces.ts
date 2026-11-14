// Real-draw fixture for scripts/verify-physical-surfaces.mjs: physical
// surfaces (createSurfaceMaterial type 'physical', LayaAir's glTF shader)
// made in code: cloth with and without sheen, a brushed disc whose highlight
// turns, glass over a checkerboard, and a thin film on a sphere.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__PHYSICAL__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 960,
  H = 540;
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
const round = (v: number, digits = 2) => +v.toFixed(digits);

/**
 * The disc an object makes on the black background: its centre and radius
 * from the box round the pixels that are not black, within columns x0..x1.
 */
function findDisc(p: Uint8Array, x0 = 0, x1 = W) {
  let minX = W,
    maxX = -1,
    minY = H,
    maxY = -1;
  for (let y = 0; y < H; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      if (p[i] + p[i + 1] + p[i + 2] > 3) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  if (maxX < 0) return null;
  return {
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    r: (maxX - minX + maxY - minY + 2) / 4,
  };
}
/** Mean colour (0..255) of the pixels between r0 and r1 of a disc's radius. */
function ring(p: Uint8Array, disc: { cx: number; cy: number; r: number }, r0: number, r1: number) {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.floor(disc.cy - disc.r); y <= Math.ceil(disc.cy + disc.r); y++)
    for (let x = Math.floor(disc.cx - disc.r); x <= Math.ceil(disc.cx + disc.r); x++) {
      const d = Math.hypot(x - disc.cx, y - disc.cy) / disc.r;
      if (d < r0 || d >= r1 || x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      sum[0] += p[i];
      sum[1] += p[i + 1];
      sum[2] += p[i + 2];
      n++;
    }
  const rgb = sum.map((s) => s / Math.max(n, 1));
  return {
    rgb: rgb.map((v) => round(v, 1)),
    lum: round(0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2], 1),
  };
}
/** Hue in degrees and saturation 0..1 of a colour. */
function hueOf([r, g, b]: number[]) {
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  let h = 0;
  if (d > 0)
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : /* blue */ (r - g) / d + 4;
  return { hue: round((h * 60 + 360) % 360, 1), saturation: round(max ? d / max : 0, 3) };
}
const hueGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return round(Math.min(d, 360 - d), 1);
};

/**
 * The bright highlight of a frame: the pixels at least half as bright as
 * the brightest, their area, how long against how wide (from their second
 * moments) and the angle of the long axis in degrees, 0 along the rows,
 * counted towards the rows below (screen y grows downwards).
 */
function streak(p: Uint8Array) {
  let peak = 0;
  for (let i = 0; i < p.length; i += 4) peak = Math.max(peak, lum(p, i));
  let n = 0,
    sx = 0,
    sy = 0;
  const xs: number[] = [],
    ys: number[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (lum(p, (y * W + x) * 4) >= peak * 0.5) {
        xs.push(x);
        ys.push(y);
        sx += x;
        sy += y;
        n++;
      }
  const mx = sx / n,
    my = sy / n;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (let k = 0; k < n; k++) {
    const dx = xs[k] - mx,
      dy = ys[k] - my;
    xx += dx * dx;
    yy += dy * dy;
    xy += dx * dy;
  }
  xx /= n;
  yy /= n;
  xy /= n;
  const spread = Math.sqrt(((xx - yy) / 2) ** 2 + xy * xy),
    major = (xx + yy) / 2 + spread,
    minor = Math.max((xx + yy) / 2 - spread, 1e-6);
  const angle = (((Math.atan2(2 * xy, xx - yy) / 2) * 180) / Math.PI + 180) % 180;
  return {
    peak: round(peak, 1),
    area: n,
    elongation: round(Math.sqrt(major / minor), 2),
    angleDeg: round(angle, 1),
    centre: [round(mx, 1), round(my, 1)],
  };
}
/** Smallest difference between two axis angles (a line at 10 and at 190 degrees is the same). */
const axisGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 180;
  return round(Math.min(d, 180 - d), 1);
};

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
  // The browser SDK's boot splash lies over the canvas for about two seconds.
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 600));

  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 6], clearColor: [0, 0, 0, 1] });
  camera.nearPlane = 0.05;
  camera.farPlane = 100;
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 2 });
  const owned: any[] = [];
  let hemisphere: any = null;
  /** Sky and ground light (and the soft reflections of them). */
  const surroundings = (sky: number[], ground: number[]) => {
    if (hemisphere) hemisphere.update(sky, ground);
    else hemisphere = Z.applyZhudaHemisphereAmbient(scene, sky, ground);
  };
  /** Where the camera stands and looks, its field of view and the sun's direction. */
  const stage = (eye: number[], target: number[], fov: number, sunEuler: number[], power = 2) => {
    camera.fieldOfView = fov;
    camera.transform.position = new Laya.Vector3(eye[0], eye[1], eye[2]);
    camera.transform.lookAt(
      new Laya.Vector3(target[0], target[1], target[2]),
      new Laya.Vector3(0, 1, 0),
    );
    sun.node.transform.rotationEuler = new Laya.Vector3(sunEuler[0], sunEuler[1], 0);
    sun.light.intensity = power;
  };
  const frame = () => {
    Z.ZhudaEngine.flushRenderFrames(2);
    return read();
  };
  const group = () => {
    const node = new Laya.Sprite3D();
    scene.addChild(node);
    node.active = false;
    return node;
  };
  const place = (parent: any, mesh: any, material: any, at: number[]) => {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.transform.position = new Laya.Vector3(at[0], at[1], at[2]);
    parent.addChild(node);
    return node;
  };
  const make = (spec: any) => {
    const material = Z.createSurfaceMaterial(spec);
    owned.push(material);
    return material;
  };
  const sphere = Laya.PrimitiveMesh.createSphere(1, 64, 64);
  owned.push(sphere);
  const r: any = {};

  // A checkerboard picture: under the glass, and on a ball.
  const squares = 8,
    texels = 256,
    checker = new Uint8Array(texels * texels * 4);
  for (let y = 0; y < texels; y++)
    for (let x = 0; x < texels; x++) {
      const light =
        (Math.floor((x * squares) / texels) + Math.floor((y * squares) / texels)) % 2 === 0;
      checker.set(light ? [230, 230, 230, 255] : [25, 25, 25, 255], (y * texels + x) * 4);
    }
  const checkerTexture = Z.createSurfaceTexture(texels, texels, checker, 'color', { mipmap: true });
  owned.push(checkerTexture);

  // --- Plain physical against LayaAir's standard material, same settings. ---
  // Physical without its extra features is the glTF metal/roughness shader:
  // it should draw what the standard material draws, a colour texture included.
  const pairs: Record<string, any> = {
    clay: { color: [0.6, 0.25, 0.15, 1], roughness: 0.6 },
    metal: { color: [0.9, 0.75, 0.45, 1], metallic: 1, roughness: 0.35 },
    textured: { color: [1, 0.8, 0.6, 1], roughness: 0.5, textures: { albedo: checkerTexture } },
  };
  const base = group();
  const baseBall = place(base, sphere, make({ type: 'pbr', ...pairs.clay }), [0, 0, 0]);
  r.base = {};
  base.active = true;
  surroundings([0.55, 0.6, 0.7], [0.25, 0.22, 0.2]);
  stage([0, 0, 6], [0, 0, 0], 30, [-35, -30]);
  for (const [name, settings] of Object.entries(pairs)) {
    baseBall.meshRenderer.sharedMaterial = make({ type: 'pbr', ...settings });
    const standard = frame();
    baseBall.meshRenderer.sharedMaterial = make({ type: 'physical', ...settings });
    const physical = frame();
    const disc = findDisc(standard)!;
    let diff = 0,
      n = 0;
    for (let y = Math.floor(disc.cy - disc.r); y <= disc.cy + disc.r; y++)
      for (let x = Math.floor(disc.cx - disc.r); x <= disc.cx + disc.r; x++) {
        if (Math.hypot(x - disc.cx, y - disc.cy) > disc.r * 0.95) continue;
        const i = (y * W + x) * 4;
        diff += Math.abs(lum(standard, i) - lum(physical, i));
        n++;
      }
    r.base[name] = {
      standard: ring(standard, disc, 0, 0.95),
      physical: ring(physical, disc, 0, 0.95),
      meanAbsLumDiff: round(diff / n),
    };
  }
  base.active = false;

  // --- Cloth: the same ball with and without sheen. ---
  const cloth = {
    color: [0.06, 0.09, 0.32, 1] as number[],
    roughness: 0.85,
  };
  const plainCloth = make({ type: 'physical', ...cloth });
  const sheenCloth = make({
    type: 'physical',
    ...cloth,
    sheen: { color: [0.75, 0.78, 1], roughness: 0.4 },
  });
  const clothGroup = group();
  const clothBall = place(clothGroup, sphere, plainCloth, [0, 0, 0]);
  const clothStage = () => {
    surroundings([0.55, 0.6, 0.7], [0.25, 0.22, 0.2]);
    stage([0, 0, 6], [0, 0, 0], 30, [-30, -40], 2.2);
  };
  clothGroup.active = true;
  clothStage();
  const measureCloth = (pixels: Uint8Array) => {
    const disc = findDisc(pixels)!;
    return {
      disc: { cx: disc.cx, cy: disc.cy, r: disc.r },
      centre: ring(pixels, disc, 0, 0.35),
      middle: ring(pixels, disc, 0.5, 0.7),
      rim: ring(pixels, disc, 0.82, 0.96),
    };
  };
  r.cloth = { plain: measureCloth(frame()) };
  clothBall.meshRenderer.sharedMaterial = sheenCloth;
  r.cloth.sheen = measureCloth(frame());
  clothGroup.active = false;

  // --- A brushed disc facing the camera, lit from the camera. ---
  // The highlight is drawn out along the turned tangent: it turns with
  // anisotropyRotationDeg. The disc's tangent runs along its U, the world X.
  const rings = 24,
    segments = 128;
  const positions: number[] = [0, 0, 0],
    normals: number[] = [0, 0, 1],
    uvs: number[] = [0.5, 0.5],
    indices: number[] = [];
  for (let i = 1; i <= rings; i++)
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2,
        rr = i / rings,
        x = Math.cos(a) * rr,
        y = Math.sin(a) * rr;
      positions.push(x, y, 0);
      normals.push(0, 0, 1);
      uvs.push(0.5 + x / 2, 0.5 - y / 2);
    }
  const at = (i: number, j: number) => (i === 0 ? 0 : 1 + (i - 1) * segments + (j % segments));
  // LayaAir's front faces turn clockwise as seen from in front.
  for (let i = 0; i < rings; i++)
    for (let j = 0; j < segments; j++)
      if (i === 0) indices.push(0, at(1, j + 1), at(1, j));
      else
        indices.push(
          at(i, j),
          at(i + 1, j + 1),
          at(i + 1, j),
          at(i, j),
          at(i, j + 1),
          at(i + 1, j + 1),
        );
  const discData: any = {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
  discData.tangents = Z.computeMeshTangents(discData);
  const discGroup = group();
  const brushedDisc = new Z.ZhudaDynamicMesh(discData, discGroup);
  owned.push(brushedDisc);
  const metal = { color: [0.95, 0.93, 0.9, 1], metallic: 1, roughness: 0.25 };
  const brushed: Record<string, any> = {
    round: make({ type: 'physical', ...metal }),
    'rot-0': make({ type: 'physical', ...metal, anisotropy: 0.8, anisotropyRotationDeg: 0 }),
    'rot-45': make({ type: 'physical', ...metal, anisotropy: 0.8, anisotropyRotationDeg: 45 }),
    'rot-90': make({ type: 'physical', ...metal, anisotropy: 0.8, anisotropyRotationDeg: 90 }),
    // A full turn more is the same as 45 degrees.
    'rot-405': make({ type: 'physical', ...metal, anisotropy: 0.8, anisotropyRotationDeg: 405 }),
    // LayaAir's standard material: its setter would stop at 1 radian (57 degrees).
    'standard-90': make({ type: 'pbr', ...metal, anisotropy: 0.8, anisotropyRotationDeg: 90 }),
  };
  // Nearly no light from the surroundings, and a dim light: the highlight's
  // peak stays under white, so its shape can be measured. Pictures are lit more.
  const discStage = (power = 0.04) => {
    surroundings([0.0005, 0.0005, 0.0005], [0.0005, 0.0005, 0.0005]);
    stage([0, 0, 3.2], [0, 0, 0], 45, [0, 0], power);
  };
  discGroup.active = true;
  discStage();
  r.brushed = {};
  for (const [name, material] of Object.entries(brushed)) {
    brushedDisc.node.meshRenderer.sharedMaterial = material;
    r.brushed[name] = streak(frame());
  }

  // --- A normal texture on the disc. Every texel leans the surface the same
  // way, so the whole disc turns towards or away from a light from above.
  // Drawn by a physical and by a standard surface, then leaning the other way.
  const lean = (green: number) =>
    Z.createSurfaceTexture(
      4,
      4,
      new Uint8Array(64).map((_, i) => [128, green, 222, 255][i % 4]),
      'normal',
    );
  const leanOne = lean(191),
    leanOther = lean(64);
  owned.push(leanOne, leanOther);
  const grey = { color: [0.7, 0.7, 0.7, 1], roughness: 0.6 };
  surroundings([0.05, 0.05, 0.05], [0.02, 0.02, 0.02]);
  stage([0, 0, 3.2], [0, 0, 0], 45, [-50, 0], 1);
  const normalFrame = (spec: any) => {
    brushedDisc.node.meshRenderer.sharedMaterial = make(spec);
    return frame();
  };
  const flat = normalFrame({ type: 'physical', ...grey });
  const onDisc: number[] = [];
  for (let i = 0; i < flat.length; i += 4)
    if (flat[i] + flat[i + 1] + flat[i + 2] > 3) onDisc.push(i);
  /** Mean brightness difference over the disc. */
  const discDiff = (a: Uint8Array, b: Uint8Array) =>
    round(onDisc.reduce((sum, i) => sum + Math.abs(lum(a, i) - lum(b, i)), 0) / onDisc.length);
  const physicalOne = normalFrame({ type: 'physical', ...grey, textures: { normal: leanOne } });
  const standardOne = normalFrame({ type: 'pbr', ...grey, textures: { normal: leanOne } });
  const physicalOther = normalFrame({ type: 'physical', ...grey, textures: { normal: leanOther } });
  r.normal = {
    flatLum: ring(flat, findDisc(flat)!, 0, 0.95).lum,
    oneLum: ring(physicalOne, findDisc(physicalOne)!, 0, 0.95).lum,
    otherLum: ring(physicalOther, findDisc(physicalOther)!, 0, 0.95).lum,
    // The texture changes the light on the surface.
    againstFlat: discDiff(physicalOne, flat),
    // Both materials read the same texture the same way.
    againstStandard: discDiff(physicalOne, standardOne),
  };
  discGroup.active = false;

  // --- Glass over a checkerboard. ---
  const glassGroup = group();
  const floorMesh = Laya.PrimitiveMesh.createPlane(4, 4, 1, 1);
  const slabMesh = Laya.PrimitiveMesh.createBox(1.8, 0.3, 1.3);
  owned.push(floorMesh, slabMesh);
  place(
    glassGroup,
    floorMesh,
    make({ type: 'unlit', textures: { albedo: checkerTexture } }),
    [0, 0, 0],
  );
  const glassSpec = (attenuationColor: number[]) => ({
    type: 'physical',
    color: [1, 1, 1, 1],
    roughness: 0.05,
    ior: 1.5,
    transmission: {
      factor: 1,
      volume: { thickness: 0.3, attenuationColor, attenuationDistance: 0.3 },
    },
  });
  const glass: Record<string, any> = {
    tinted: make(glassSpec([0.3, 0.85, 0.5])),
    clear: make(glassSpec([1, 1, 1])),
    // The same white, smooth surface without transmission.
    opaque: make({ type: 'physical', color: [1, 1, 1, 1], roughness: 0.05, ior: 1.5 }),
    // A flat colour that marks where the slab is on the screen.
    mark: make({ type: 'unlit', color: [1, 0, 1, 1] }),
  };
  const slab = place(glassGroup, slabMesh, glass.mark, [0, 0.55, 0.2]);
  r.glassRenderQueue = glass.tinted.renderQueue;
  r.glassPasses = Z.surfaceMaterialPasses(glassSpec([1, 1, 1]));
  const passes = (on: boolean) =>
    Z.configureSurfacePasses(camera, on ? [r.glassPasses] : [], on ? 1 : 0);
  const glassStage = (pass = true) => {
    surroundings([0.6, 0.65, 0.75], [0.3, 0.28, 0.25]);
    stage([0, 2.4, 3.3], [0, 0.15, 0], 45, [-55, -30], 1.5);
    r.glassPassReport = passes(pass);
  };
  glassGroup.active = true;
  glassStage();
  const marked = frame();
  slab.active = false;
  const bare = frame();
  slab.active = true;
  // The slab's pixels, without its outline: magenta with magenta all round.
  const isMark = (i: number) => marked[i] > 200 && marked[i + 1] < 60 && marked[i + 2] > 200;
  const inside: number[] = [];
  for (let y = 6; y < H - 6; y++)
    for (let x = 6; x < W - 6; x++) {
      let all = true;
      for (const [dx, dy] of [
        [0, 0],
        [-6, 0],
        [6, 0],
        [0, -6],
        [0, 6],
      ])
        all &&= isMark(((y + dy) * W + x + dx) * 4);
      if (all) inside.push((y * W + x) * 4);
    }
  /** Brightness spread (the 90th less the 10th percentile) and mean colour of the slab's pixels. */
  const region = (p: Uint8Array) => {
    const values = inside.map((i) => lum(p, i)).sort((a, b) => a - b);
    const sum = [0, 0, 0];
    for (const i of inside) for (let c = 0; c < 3; c++) sum[c] += p[i + c];
    const rgb = sum.map((s) => round(s / inside.length, 1));
    return {
      spread: round(
        values[Math.floor(values.length * 0.9)] - values[Math.floor(values.length * 0.1)],
      ),
      mean: round(values.reduce((a, b) => a + b, 0) / values.length),
      rgb,
      // How much greener than grey: green against the mean of red and blue.
      green: round(rgb[1] / Math.max((rgb[0] + rgb[2]) / 2, 1), 3),
    };
  };
  r.glass = { pixels: inside.length, bare: region(bare) };
  for (const name of ['tinted', 'clear', 'opaque']) {
    slab.meshRenderer.sharedMaterial = glass[name];
    r.glass[name] = region(frame());
  }
  // Without the camera's opaque pass there is nothing to see through.
  glassStage(false);
  slab.meshRenderer.sharedMaterial = glass.tinted;
  r.glass.noPass = region(frame());
  glassStage(true);
  glassGroup.active = false;
  passes(false);

  // --- A thin film on a smooth dark ball: the colour turns with the angle. ---
  const film = { color: [0.02, 0.02, 0.025, 1], roughness: 0.12 };
  const iridescent = make({
    type: 'physical',
    ...film,
    // A film denser than the ball (a titanium oxide coat rather than soap): brighter colours.
    iridescence: { factor: 1, ior: 1.8, thicknessRange: [100, 500] },
  });
  const plainFilm = make({ type: 'physical', ...film });
  const filmGroup = group();
  const filmBall = place(filmGroup, sphere, plainFilm, [0, 0, 0]);
  const filmStage = () => {
    surroundings([0.95, 0.95, 0.95], [0.4, 0.4, 0.4]);
    stage([0, 0, 6], [0, 0, 0], 30, [-35, -35], 1.5);
  };
  filmGroup.active = true;
  filmStage();
  const measureFilm = (pixels: Uint8Array) => {
    const disc = findDisc(pixels)!;
    const zones = [
      ['centre', 0, 0.3],
      ['middle', 0.55, 0.7],
      ['edge', 0.8, 0.92],
    ] as const;
    const result: any = {};
    for (const [name, r0, r1] of zones) {
      const colour = ring(pixels, disc, r0, r1);
      result[name] = { ...colour, ...hueOf(colour.rgb) };
    }
    result.centreToEdgeHue = hueGap(result.centre.hue, result.edge.hue);
    result.mostSaturation = Math.max(
      result.centre.saturation,
      result.middle.saturation,
      result.edge.saturation,
    );
    return result;
  };
  r.film = { plain: measureFilm(frame()) };
  filmBall.meshRenderer.sharedMaterial = iridescent;
  r.film.iridescent = measureFilm(frame());
  filmGroup.active = false;

  // --- Refusals. ---
  const refusal = (spec: any) => {
    try {
      Z.disposeSurfaceMaterial(Z.createSurfaceMaterial(spec));
      return 'accepted';
    } catch (error: any) {
      return String(error.message);
    }
  };
  r.refused = {
    sheenOnStandard: refusal({ type: 'pbr', sheen: { color: [1, 1, 1] } }),
    sheenColour: refusal({ type: 'physical', sheen: { color: [2, 0, 0] } }),
    volumeWithoutTransmission: refusal({
      type: 'physical',
      textures: { thickness: checkerTexture },
    }),
    attenuationBlack: refusal({
      type: 'physical',
      transmission: { factor: 1, volume: { thickness: 1, attenuationColor: [0, 1, 1] } },
    }),
    additiveGlass: refusal({ type: 'physical', blend: 'additive', transmission: { factor: 1 } }),
  };

  // --- Made and disposed thirty times, textures borrowed: nothing left behind. ---
  frame();
  const before = Z.inspectSceneResources().resources;
  for (let i = 0; i < 30; i++) {
    const material = Z.createSurfaceMaterial({
      type: 'physical',
      sheen: { color: [1, 1, 1] },
      transmission: { factor: 0.5, volume: { thickness: 0.2 } },
      textures: { albedo: checkerTexture, sheenColor: checkerTexture, thickness: checkerTexture },
    });
    Z.disposeSurfaceMaterial(material);
  }
  frame();
  r.resources = { before, after: Z.inspectSceneResources().resources };
  r.checkerAlive = !checkerTexture.destroyed;

  // For pictures: the script asks for a view and takes a screenshot.
  const groups = [base, clothGroup, discGroup, glassGroup, filmGroup];
  const only = (shown: any) => {
    for (const g of groups) g.active = g === shown;
  };
  // Side by side for a person: the left without, the right with.
  const pairOf = (parent: any, left: any, right: any) => {
    const a = place(parent, sphere, left, [-1.15, 0, 0]),
      b = place(parent, sphere, right, [1.15, 0, 0]);
    a.active = b.active = false;
    return [a, b];
  };
  const clothPair = pairOf(clothGroup, plainCloth, sheenCloth);
  const filmPair = pairOf(filmGroup, plainFilm, iridescent);
  const basePair = pairOf(
    base,
    make({ type: 'pbr', ...pairs.metal }),
    make({ type: 'physical', ...pairs.metal }),
  );
  const views: Record<string, () => void> = {
    base: () => {
      only(base);
      baseBall.active = false;
      for (const n of basePair) n.active = true;
      surroundings([0.55, 0.6, 0.7], [0.25, 0.22, 0.2]);
      stage([0, 0, 7.5], [0, 0, 0], 30, [-35, -30]);
    },
    cloth: () => {
      only(clothGroup);
      clothBall.active = false;
      for (const n of clothPair) n.active = true;
      clothStage();
      camera.transform.position = new Laya.Vector3(0, 0, 7.5);
    },
    iridescent: () => {
      only(filmGroup);
      filmBall.active = false;
      for (const n of filmPair) n.active = true;
      filmStage();
      camera.transform.position = new Laya.Vector3(0, 0, 7.5);
    },
    glass: () => {
      only(glassGroup);
      slab.meshRenderer.sharedMaterial = glass.tinted;
      glassStage();
    },
    'glass-clear': () => {
      only(glassGroup);
      slab.meshRenderer.sharedMaterial = glass.clear;
      glassStage();
    },
    'glass-no-pass': () => {
      only(glassGroup);
      slab.meshRenderer.sharedMaterial = glass.tinted;
      glassStage(false);
    },
  };
  for (const name of Object.keys(brushed))
    views[`brushed-${name}`] = () => {
      only(discGroup);
      brushedDisc.node.meshRenderer.sharedMaterial = brushed[name];
      discStage(name === 'round' ? 0.04 : 0.3);
    };
  out.views = Object.keys(views);
  out.show = (name: string) => {
    passes(false);
    views[name]();
    Z.ZhudaEngine.flushRenderFrames(3);
    return name;
  };
  out.physical = r;
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
