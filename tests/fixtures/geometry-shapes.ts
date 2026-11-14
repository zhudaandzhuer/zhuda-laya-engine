// Real-draw fixture for scripts/verify-geometry.mjs: the new geometry (a wall
// piece with two windows and a rounded bevel, a torus, a tube along a closed
// Catmull-Rom curve, a washer and a flat ring) under one sun with physically
// based materials, and a triangle BVH per shape that picks against the same
// data. Each shape has its own colour, so a pixel's colour says which shape
// the GPU drew there; the pick says which shape the BVH finds there.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__GEOMETRY__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 960,
  H = 540,
  FOV = 50;
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

// Shape colours, far apart in hue; the floor and backdrop are grey.
const SHAPES: Record<string, { color: number[]; hue: number }> = {
  panel: { color: [0.78, 0.16, 0.1], hue: 6 },
  torus: { color: [0.16, 0.62, 0.2], hue: 125 },
  tube: { color: [0.12, 0.3, 0.85], hue: 222 },
  washer: { color: [0.85, 0.66, 0.08], hue: 46 },
  ring: { color: [0.62, 0.18, 0.72], hue: 290 },
};
/** Which shape a pixel's colour belongs to, or 'grey' for floor, backdrop and sky. */
function colourClass(p: Uint8Array, i: number) {
  const r = p[i],
    g = p[i + 1],
    b = p[i + 2],
    max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  if (max < 18 || (max - min) / max < 0.3) return 'grey';
  let hue: number;
  if (max === r) hue = (60 * (g - b)) / (max - min);
  else if (max === g) hue = 120 + (60 * (b - r)) / (max - min);
  else hue = 240 + (60 * (r - g)) / (max - min);
  hue = (hue + 360) % 360;
  let best = 'grey',
    distance = 40;
  for (const [name, shape] of Object.entries(SHAPES)) {
    const d = Math.min(Math.abs(hue - shape.hue), 360 - Math.abs(hue - shape.hue));
    if (d < distance) {
      distance = d;
      best = name;
    }
  }
  return best;
}

const VIEWS: Record<string, [number[], number[]]> = {
  front: [
    [0, 1.9, 6.5],
    [0, 0.9, 0],
  ],
  // Close and from the side: the depth of the windows and the rounded bevel.
  panel: [
    [-1.0, 1.25, 2.1],
    [-2.3, 0.85, -0.5],
  ],
  // From above: the washer, the flat ring and the knot of tube.
  above: [
    [0.4, 4.6, 3.6],
    [0.4, 0.3, 0.4],
  ],
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

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.32, 0.33, 0.36, 1] });
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: VIEWS.front[0],
    clearColor: [0.16, 0.16, 0.17, 1],
    fov: FOV,
    near: 0.05,
    far: 200,
  });
  Z.Zhuda3D.createDirectionalLight(scene, {
    rotationEuler: [-42, -35, 0],
    intensity: 1.35,
    color: [1, 0.98, 0.94, 1],
  });
  const queries = new Z.ZhudaSceneQueries();
  const owned: any[] = [];
  const shapes: Record<string, { data: any; mesh: any; bvh: any }> = {};
  /** One shape: its mesh drawn, and a BVH of the same data under the node's world matrix. */
  const place = (name: string, data: any, color: number[], position: number[], yawDeg = 0) => {
    const mesh = new Z.ZhudaDynamicMesh(data, scene);
    const material = Z.createSurfaceMaterial({
      type: 'pbr',
      color: [...color, 1],
      roughness: 0.55,
      metallic: 0,
    });
    owned.push(material);
    mesh.node.meshRenderer.sharedMaterial = material;
    mesh.node.transform.localPosition = new Laya.Vector3(position[0], position[1], position[2]);
    mesh.node.transform.localRotationEuler = new Laya.Vector3(0, yawDeg, 0);
    const bvh = new Z.ZhudaTriangleBvh({
      positions: data.positions,
      indices: data.indices,
      matrix: mesh.node.transform.worldMatrix.elements,
    });
    queries.register(Z.createZhudaMeshQueryProvider(bvh, { entityId: name }));
    shapes[name] = { data, mesh, bvh };
    return mesh;
  };
  const grey = (v: number) => [v, v, v];
  place(
    'floor',
    Z.createZhudaBoxMesh({ width: 30, height: 0.1, depth: 30, origin: 'bottom' }),
    grey(0.42),
    [0, -0.1, 0],
  );
  place(
    'backdrop',
    Z.createZhudaBoxMesh({ width: 14, height: 6, depth: 0.2, origin: 'bottom' }),
    grey(0.62),
    [0, 0, -3.2],
  );

  // A wall piece 2.2 m wide and 1.7 m high, 0.2 m thick, with a square and a
  // round window and a rounded bevel, stood up to face +Z.
  const round = Array.from({ length: 40 }, (_, i) => {
    const a = (i / 40) * Math.PI * 2;
    return [0.5 + 0.36 * Math.cos(a), -1.0 + 0.36 * Math.sin(a)];
  });
  const panelData = Z.transformZhudaMesh(
    Z.createZhudaExtrudeMesh({
      outline: [
        [-1.1, -1.7],
        [1.1, -1.7],
        [1.1, 0],
        [-1.1, 0],
      ],
      holes: [
        [
          [-0.8, -1.35],
          [-0.15, -1.35],
          [-0.15, -0.45],
          [-0.8, -0.45],
        ],
        round,
      ],
      height: 0.2,
      bevel: 0.06,
      bevelSegments: 4,
      bevelBottom: true,
    }),
    { pitchDeg: 90 },
  );
  place('panel', panelData, SHAPES.panel.color, [-2.3, 0, -0.6], 15);
  const torusData = Z.transformZhudaMesh(
    Z.createZhudaTorusMesh({ radius: 0.55, tube: 0.18, radialSegments: 32, tubularSegments: 96 }),
    { pitchDeg: 90 },
  );
  place('torus', torusData, SHAPES.torus.color, [0.1, 0.78, -0.3], 25);
  // A trefoil knot through twelve points, as a closed Catmull-Rom tube.
  const knot = Array.from({ length: 12 }, (_, i) => {
    const t = (i / 12) * Math.PI * 2;
    return [
      0.26 * (Math.sin(t) + 2 * Math.sin(2 * t)),
      0.26 * (Math.cos(t) - 2 * Math.cos(2 * t)),
      0.26 * -Math.sin(3 * t),
    ];
  });
  const tubeData = Z.createZhudaCurveTubeMesh({
    points: knot,
    closed: true,
    radius: 0.075,
    tubularSegments: 300,
    radialSegments: 14,
  });
  place('tube', tubeData, SHAPES.tube.color, [2.3, 1.05, -0.4], -20);
  place(
    'washer',
    Z.createZhudaRingMesh({ outerRadius: 0.45, innerRadius: 0.22, segments: 64, thickness: 0.09 }),
    SHAPES.washer.color,
    [1.0, 0, 1.5],
  );
  place(
    'ring',
    Z.createZhudaRingMesh({ outerRadius: 0.55, innerRadius: 0.38, segments: 64 }),
    SHAPES.ring.color,
    [-0.9, 0.004, 1.6],
  );

  const coordinates = new Z.ZhudaCameraCoordinates(camera, () => ({
    left: 0,
    top: 0,
    width: W,
    height: H,
    backingWidth: W,
    backingHeight: H,
  }));
  const look = (name: string) => {
    const [eye, target] = VIEWS[name];
    camera.transform.position = new Laya.Vector3(eye[0], eye[1], eye[2]);
    camera.transform.lookAt(
      new Laya.Vector3(target[0], target[1], target[2]),
      new Laya.Vector3(0, 1, 0),
    );
    Z.ZhudaEngine.flushRenderFrames(3);
    return read();
  };
  const pick = (x: number, y: number) => queries.raycast(coordinates.screenToRay(x + 0.5, y + 0.5));

  /**
   * Picks on a grid of pixels against the colour drawn there. A grid pixel
   * counts when the picks three pixels away on each side are the same
   * entity (not an edge). For each shape: how many of its picked pixels have
   * its colour (found) and how many of its coloured pixels were picked as it
   * (right).
   */
  const measure = (pixels: Uint8Array) => {
    const STEP = 3,
      cols = Math.floor(W / STEP),
      rows = Math.floor(H / STEP),
      grid: (any | null)[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) grid.push(pick(i * STEP + 1, j * STEP + 1));
    const entity = (i: number, j: number) => grid[j * cols + i]?.entityId ?? 'sky';
    const tally: Record<string, any> = {};
    for (const name of [...Object.keys(SHAPES), 'grey'])
      tally[name] = { picked: 0, found: 0, coloured: 0, right: 0 };
    let counted = 0;
    const bevel = { flat: [] as number[], bevel: [] as number[] };
    for (let j = 1; j < rows - 1; j++)
      for (let i = 1; i < cols - 1; i++) {
        const e = entity(i, j);
        if (
          [entity(i - 1, j), entity(i + 1, j), entity(i, j - 1), entity(i, j + 1)].some(
            (n) => n !== e,
          )
        )
          continue;
        counted++;
        const at = ((j * STEP + 1) * W + i * STEP + 1) * 4,
          colour = colourClass(pixels, at),
          expected = e in SHAPES ? e : 'grey';
        tally[expected].picked++;
        if (colour === expected) tally[expected].found++;
        tally[colour].coloured++;
        if (colour === expected) tally[colour].right++;
        // On the wall piece: the flat front against the rounded bevel.
        const hit = grid[j * cols + i];
        if (e === 'panel') {
          const view = coordinates.screenToRay(i * STEP + 1.5, j * STEP + 1.5).direction;
          const facing = -(hit.normal.x * view.x + hit.normal.y * view.y + hit.normal.z * view.z);
          // Rounded steps that look up (the sun is above); the face looks level.
          if (hit.normal.y > 0.2 && hit.normal.y < 0.95 && facing > 0)
            bevel.bevel.push(lum(pixels, at));
          else if (hit.normal.y < 0.05 && facing > 0.3 && Math.abs(hit.normal.z) > 0.9)
            bevel.flat.push(lum(pixels, at));
        }
      }
    const share = (a: number, b: number) => (b ? +(a / b).toFixed(4) : null);
    const mean = (v: number[]) =>
      v.length ? +(v.reduce((s, x) => s + x, 0) / v.length).toFixed(1) : null;
    return {
      counted,
      shapes: Object.fromEntries(
        Object.entries(tally).map(([name, t]) => [
          name,
          { ...t, foundShare: share(t.found, t.picked), rightShare: share(t.right, t.coloured) },
        ]),
      ),
      bevel: {
        flatPixels: bevel.flat.length,
        bevelPixels: bevel.bevel.length,
        flat: mean(bevel.flat),
        rounded: mean(bevel.bevel),
      },
    };
  };
  const at = (pixels: Uint8Array, point: number[]) => {
    const s = coordinates.worldToScreen({ x: point[0], y: point[1], z: point[2] }),
      x = Math.round(s.x - 0.5),
      y = Math.round(s.y - 0.5),
      i = (y * W + x) * 4;
    return {
      x,
      y,
      colour: colourClass(pixels, i),
      lum: +lum(pixels, i).toFixed(1),
      pick: pick(x, y)?.entityId ?? 'sky',
    };
  };
  const world = (name: string, local: number[]) => {
    const m = shapes[name].mesh.node.transform.worldMatrix.elements;
    return [0, 1, 2].map(
      (k) => m[k] * local[0] + m[4 + k] * local[1] + m[8 + k] * local[2] + m[12 + k],
    );
  };
  // Measured and photographed once LayaAir's splash has gone.
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  const r: any = { views: {} };
  const front = look('front');
  r.views.front = measure(front);
  // Through the windows and the torus's hole the grey backdrop shows; the
  // panel and the tube of the torus are drawn round them.
  r.holes = {
    squareWindow: at(front, world('panel', [-0.475, 0.9, 0.1])),
    roundWindow: at(front, world('panel', [0.5, 1.0, 0.1])),
    panelSolid: at(front, world('panel', [0.15, 0.25, 0.2])),
    torusHole: at(front, world('torus', [0, 0, 0])),
    torusTube: at(front, world('torus', [0.55, 0, 0.18])),
  };
  // The torus is round: its brightness changes across the tube.
  const torusLums: number[] = [];
  for (let k = 0; k < front.length; k += 4)
    if (colourClass(front, k) === 'torus') torusLums.push(lum(front, k));
  torusLums.sort((a, b) => a - b);
  r.torusShading = {
    pixels: torusLums.length,
    p5: +torusLums[Math.floor(torusLums.length * 0.05)].toFixed(1),
    p95: +torusLums[Math.floor(torusLums.length * 0.95)].toFixed(1),
  };
  r.views.panel = measure(look('panel'));
  const above = look('above');
  r.views.above = measure(above);
  // From above, the floor shows through the washer and the flat ring.
  r.holes.washerHole = at(above, world('washer', [0, 0.09, 0]));
  r.holes.ringHole = at(above, world('ring', [0, 0, 0]));
  r.holes.washerTop = at(above, world('washer', [0.33, 0.09, 0]));
  r.holes.ringBand = at(above, world('ring', [0, 0, 0.46]));
  // A LayaAir mesh read back (what a loaded model would give) picks the same
  // triangles as the data it was made from.
  try {
    const read = Z.readZhudaLayaMeshTriangles(shapes.torus.mesh.mesh);
    const fromLaya = new Z.ZhudaTriangleBvh({
      ...read,
      matrix: shapes.torus.mesh.node.transform.worldMatrix.elements,
    });
    let same = 0,
      hits = 0;
    look('front');
    for (let y = 100; y < 440; y += 4)
      for (let x = 300; x < 660; x += 4) {
        const ray = coordinates.screenToRay(x + 0.5, y + 0.5),
          a = shapes.torus.bvh.raycast(ray),
          b = fromLaya.raycast(ray);
        if (!a && !b) continue;
        hits++;
        if (a && b && a.triangle === b.triangle && Math.abs(a.distance - b.distance) < 1e-4) same++;
      }
    r.layaReadBack = { hits, same, vertices: read.positions.length / 3 };
  } catch (error: any) {
    r.layaReadBack = { error: String(error?.message || error) };
  }
  r.counts = Object.fromEntries(
    Object.entries(shapes).map(([name, s]) => [
      name,
      { vertices: s.data.positions.length / 3, triangles: s.data.indices.length / 3 },
    ]),
  );
  // For pictures: the script asks for a view and takes a screenshot.
  out.show = (name: string) => {
    look(name);
    return name;
  };
  out.geometry = r;
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  // What LayaAir runs on, and the adapter it was given (the backend is checked at boot).
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    status: context.renderer.status,
    adapter: context.renderer.adapter ?? null,
  };
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
