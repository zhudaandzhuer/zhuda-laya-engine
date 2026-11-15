// Real-draw fixture for scripts/verify-cloth.mjs: a cloth dropped over a
// ball, a rod and a body given as a table of radii; a cloth hung by two
// corners in front of a body, taken by a hand, pulled, pressed against the
// body, carried round it and let go; a skirt pinned to a body that sways;
// cloths made and destroyed. Every delta comes from a `ZhudaLayeredClock`:
// nothing here reads the time of day, so a run is the same run every time.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__CLOTH__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 480,
  H = 360;
let context: any;
function read() {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const copy = canvas.getContext('2d', { willReadFrequently: true })!;
  copy.drawImage(context.canvas, 0, 0, W, H);
  return copy.getImageData(0, 0, W, H).data;
}
const saved: Record<string, string> = {};
const keep = (name: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.getContext('2d')!.drawImage(context.canvas, 0, 0, W, H);
  saved[name] = canvas.toDataURL('image/png');
};
out.picture = (name: string) => saved[name];
out.pictures = () => Object.keys(saved);

type V = number[];
const v3 = (a: V) => new Laya.Vector3(a[0], a[1], a[2]);
const sub = (a: V, b: V) => a.map((v, i) => v - b[i]);
const add = (a: V, b: V) => a.map((v, i) => v + b[i]);
const scale = (a: V, k: number) => a.map((v) => v * k);
const dot = (a: V, b: V) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a: V, b: V) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V) => a.map((v) => v / Math.hypot(...a));
const flush = (frames = 2) => Z.ZhudaEngine.flushRenderFrames(frames);
const round = (v: number, places = 4) => +v.toFixed(places);
const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
/** A number for a run of bytes: two runs with the same one are the same run. */
const hash = (array: Float32Array) => {
  const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};
const isBody = (p: Uint8ClampedArray, i: number) => p[i] > 150 && p[i + 1] < 90 && p[i + 2] < 90;
const isCloth = (p: Uint8ClampedArray, i: number) => p[i + 2] > 120 && p[i] < 110;
const count = (p: Uint8ClampedArray, is: (p: Uint8ClampedArray, i: number) => boolean) => {
  let n = 0;
  for (let i = 0; i < p.length; i += 4) if (is(p, i)) n++;
  return n;
};
const differ = (a: Uint8ClampedArray, b: Uint8ClampedArray, by = 0) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4)
    if (
      Math.abs(a[i] - b[i]) > by ||
      Math.abs(a[i + 1] - b[i + 1]) > by ||
      Math.abs(a[i + 2] - b[i + 2]) > by
    )
      n++;
  return n;
};

/**
 * A body's own surface as a mesh, from the same numbers the cloth is kept
 * out of: rings round its axis, stitched. A fixture's drawing only.
 */
function bodyMesh(body: any) {
  const around = 40;
  const rings: { centre: V; radius: (angle: number) => number; normal: (angle: number) => V }[] =
    [];
  let axis: V = [0, 1, 0],
    forward: V = [0, 0, 1];
  const frame = () => {
    const side = cross(axis, forward);
    return (angle: number) => add(scale(forward, Math.cos(angle)), scale(side, Math.sin(angle)));
  };
  if (body.type === 'table') {
    axis = body.axis;
    forward = body.forward;
    const out = frame(),
      levels = 28;
    rings.push({ centre: body.origin, radius: () => 0, normal: () => scale(axis, -1) });
    for (let i = 0; i <= levels; i++) {
      const h = (body.height * i) / levels;
      rings.push({
        centre: add(body.origin, scale(axis, h)),
        radius: (angle) => Z.zhudaTableRadius(body, h, angle),
        normal: out,
      });
    }
    rings.push({
      centre: add(body.origin, scale(axis, body.height)),
      radius: () => 0,
      normal: () => axis,
    });
  } else {
    const a: V = body.type === 'sphere' ? body.center : body.a,
      b: V = body.type === 'sphere' ? body.center : body.b;
    if (body.type === 'capsule') {
      axis = unit(sub(b, a));
      forward = unit(cross(axis, Math.abs(axis[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
    }
    const out = frame(),
      half = 10;
    // The half round `a`, then the half round `b`.
    for (let i = 0; i <= half * 2 + 1; i++) {
      const lower = i <= half,
        polar = lower
          ? Math.PI - (Math.PI / 2) * (i / half)
          : Math.PI / 2 - (Math.PI / 2) * ((i - half - 1) / half);
      const along = Math.cos(polar),
        wide = Math.sin(polar);
      rings.push({
        centre: add(lower ? a : b, scale(axis, body.radius * along)),
        radius: () => body.radius * wide,
        normal: (angle) => add(scale(out(angle), wide), scale(axis, along)),
      });
    }
  }
  const positions: number[] = [],
    normals: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  const out = frame();
  rings.forEach((ring, r) => {
    for (let j = 0; j <= around; j++) {
      const angle = (j / around) * 2 * Math.PI;
      positions.push(...add(ring.centre, scale(out(angle), ring.radius(angle))));
      normals.push(...unit(ring.normal(angle)));
      uvs.push(j / around, r / (rings.length - 1));
    }
  });
  for (let r = 0; r < rings.length - 1; r++)
    for (let j = 0; j < around; j++) {
      const v00 = r * (around + 1) + j,
        v01 = v00 + 1,
        v10 = v00 + around + 1,
        v11 = v10 + 1;
      indices.push(v00, v01, v11, v00, v11, v10);
    }
  // Wound so that the front is outward, as LayaAir draws a front: checked on the mesh itself.
  const at = (i: number) => positions.slice(i * 3, i * 3 + 3);
  for (let t = 0; t < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const face = cross(sub(at(b), at(a)), sub(at(c), at(a)));
    if (Math.hypot(...face) < 1e-9) continue;
    if (dot(face, normals.slice(a * 3, a * 3 + 3)) > 0)
      for (let k = 0; k < indices.length; k += 3)
        [indices[k + 1], indices[k + 2]] = [indices[k + 2], indices[k + 1]];
    break;
  }
  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint16Array(indices),
  };
}

/** A body like a vase or a torso: a table of radii by height and angle. */
function table(
  origin: V,
  height: number,
  profile: (t: number) => number,
  oval: [number, number] = [1, 1],
  rows = 12,
) {
  const columns = 24,
    radii: number[] = [];
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < columns; j++) {
      const angle = (j / columns) * 2 * Math.PI;
      // Wider along x than along z, or the other way: a body is not a pipe.
      const stretch = 1 / Math.hypot(Math.cos(angle) / oval[1], Math.sin(angle) / oval[0]);
      radii.push(profile(i / (rows - 1)) * stretch);
    }
  return {
    type: 'table',
    origin,
    axis: [0, 1, 0],
    forward: [0, 0, 1],
    height,
    rows,
    columns,
    radii,
  };
}

/** A scene with a camera, a floor and a sun, and what it made, destroyed together. */
function stage() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.35, 0.37, 0.4] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 2, 5] });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0.05, 0.06, 0.08, 1);
  camera.msaa = false;
  const made: any[] = [];
  const own = <T>(thing: T): T => {
    made.push(thing);
    return thing;
  };
  const sun = Z.Zhuda3D.createDirectionalLight(scene, {
    color: [1, 0.97, 0.92, 1],
    intensity: 1.1,
  });
  sun.node.transform.rotationEuler = v3([-52, 28, 0]);
  const floorMesh = own(
    Z.Zhuda3D.createPrimitiveMesh('box', { width: 12, height: 0.1, depth: 12 }),
  );
  const floor = new Laya.MeshSprite3D(floorMesh);
  floor.meshRenderer.sharedMaterial = own(
    Z.createSurfaceMaterial({ type: 'pbr', color: [0.42, 0.42, 0.42, 1], roughness: 0.95 }),
  );
  floor.transform.position = v3([0, -0.05, 0]);
  scene.addChild(floor);
  const red = own(Z.createSurfaceMaterial({ type: 'unlit', color: [1, 0.05, 0.05, 1] }));
  const blue = own(
    Z.createSurfaceMaterial({ type: 'unlit', color: [0.08, 0.2, 0.95, 1], doubleSided: true }),
  );
  // A woven look for the pictures that are looked at: a check from the
  // texture coordinates, the glow cloth has at its edges, and a warmer
  // colour where the weave is stretched (the mesh's alpha).
  const woven = (name: string, checks: number) => {
    const material = new Z.ZhudaLitSurfaceMaterial({
      name,
      sheen: { color: [0.7, 0.75, 0.9], roughness: 0.5 },
      material: { doubleSided: true, roughness: 0.85 },
      surface: `void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 p,vec3 n){
vec2 cell=floor(uv*${checks.toFixed(1)});float check=mod(cell.x+cell.y,2.0);
vec3 cloth=mix(vec3(0.10,0.22,0.55),vec3(0.16,0.32,0.70),check);
s.baseColor=mix(cloth,vec3(0.95,0.45,0.15),clamp(s.vertexColor.a,0.0,1.0));s.roughness=0.85;}`,
    });
    made.push({ destroy: () => material.dispose() });
    return material;
  };
  /** Draws a body where it is, in plain red; returns the mesh so it can be moved or destroyed. */
  const body = (collider: any) => {
    if (collider.type === 'plane') return null;
    const mesh = own(new Z.ZhudaDynamicMesh(bodyMesh(collider), scene));
    mesh.node.meshRenderer.sharedMaterial = red;
    mesh.node.meshRenderer.castShadow = false;
    return mesh;
  };
  /** Puts the camera somewhere; returns where a point of the world is on the screen from there. */
  const view = (eye: V, look: V, fov: number, upward: V = [0, 1, 0]) => {
    camera.fieldOfView = fov;
    camera.transform.position = v3(eye);
    camera.transform.lookAt(v3(look), v3(upward));
  };
  return {
    scene,
    camera,
    own,
    red,
    blue,
    woven,
    body,
    view,
    end() {
      scene.destroy(true);
      for (const thing of made.splice(0).reverse()) (thing.destroy ?? thing.dispose)?.call(thing);
      flush(2);
    },
  };
}

const FRAME = 1 / 60;
/** One frame of the engine's clock, and the cloth moved by what its layer was given. */
function clocked(cloth: any) {
  const layers = new Z.ZhudaLayeredClock();
  return {
    layers,
    frame(delta = FRAME) {
      layers.advance(delta);
      return cloth.updateFrom(layers);
    },
  };
}
const lowest = (solver: any) => {
  let y = Infinity;
  for (let i = 0; i < solver.count; i++) y = Math.min(y, solver.positions[i * 3 + 1]);
  return y;
};

// --- 1. Dropped over a ball, a rod and a table, onto a floor ---------------------------
function drape() {
  const bodies: any[] = [
    { type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] },
    { type: 'sphere', center: [-0.35, 0.4, -0.15], radius: 0.4 },
    { type: 'capsule', a: [0, 0.13, 0.55], b: [0.5, 0.13, 0.3], radius: 0.13 },
    // A vase with a round shoulder: a table's ends are flat, and a cloth laid
    // over a sharp rim shows the rim through its triangles.
    table(
      [0.45, 0, -0.4],
      0.7,
      (t) =>
        (0.15 + 0.07 * Math.sin(Math.min(t, 0.75) * Math.PI)) *
        (t > 0.75 ? Math.sqrt(Math.max(0, 1 - ((t - 0.75) / 0.25) ** 2)) : 1),
      [1.15, 0.9],
      32,
    ),
  ];
  const shape = () =>
    Z.createZhudaClothGrid({
      columns: 41,
      rows: 41,
      width: 2,
      height: 2,
      origin: [-1, 1.15, -1],
      right: [1, 0, 0],
      down: [0, 0, 1],
    });
  const top = (s: any) => s.view([0, 7, 0], [0, 0, 0], 24, [0, 0, -1]);
  const run = (last: boolean) => {
    const s = stage();
    for (const collider of bodies) s.body(collider);
    top(s);
    flush();
    const bare = read();
    if (last) keep('drape-bodies');
    const cloth = new Z.ZhudaCloth(shape(), s.scene, { strain: { scale: 10 } });
    cloth.node.meshRenderer.sharedMaterial = s.blue;
    for (const collider of bodies) cloth.solver.addCollider(collider);
    const clock = clocked(cloth);
    let inside = 0,
      insideBare = 0,
      stretch = 0,
      steps = 0,
      spent = 0;
    for (let f = 0; f < 480; f++) {
      const before = performance.now();
      steps += clock.frame().steps;
      spent += performance.now() - before;
      inside = Math.max(inside, cloth.solver.countInside());
      insideBare = Math.max(insideBare, cloth.solver.countInside(1e-4, 0));
      if (f % 6 === 5) stretch = Math.max(stretch, cloth.solver.measureStrain());
    }
    flush();
    const covered = read();
    if (last) keep('drape-top');
    // From the side too: the cloth reaches the floor all round.
    s.view([3.6, 2.4, 3.6], [0, 0.3, 0], 30);
    flush();
    const side = read();
    const woven = s.woven('ZhudaFixtureClothDrape', 40);
    cloth.node.meshRenderer.sharedMaterial = woven.material;
    flush();
    if (last) keep('drape-side');
    const report = cloth.solver.inspect();
    const result = {
      particles: report.particles,
      constraints: report.constraints,
      steps,
      inside,
      insideBare,
      mostStretch: round(stretch),
      endStretch: round(report.maxStretch),
      energy: round(report.kineticEnergy, 6),
      lowest: round(lowest(cloth.solver)),
      bodyPixelsBare: count(bare, isBody),
      bodyPixelsFromAbove: count(covered, isBody),
      bodyPixelsFromTheSide: count(side, isBody),
      clothPixelsFromAbove: count(covered, isCloth),
      // The time of day is read here and nowhere else: reported, never judged.
      msPerFrame: round(spent / 480, 3),
      positions: hash(cloth.solver.positions),
      picture: covered,
    };
    cloth.dispose();
    s.end();
    return result;
  };
  const first = run(false),
    second = run(true);
  const { picture: a, ...one } = first,
    { picture: b, ...other } = second;
  return {
    ...other,
    again: {
      positions: one.positions,
      samePositions: one.positions === other.positions,
      pixelsThatDiffer: differ(a, b),
    },
  };
}

// --- 2. Hung by two corners, taken by a hand, pulled, pressed, carried round, let go ----
function hang() {
  const column = table([0, 0, -0.38], 1.5, (t) => 0.2 + 0.05 * Math.sin(t * Math.PI), [1.1, 0.95]);
  const bodies: any[] = [
    { type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] },
    column,
    { type: 'sphere', center: [0, 1.66, -0.38], radius: 0.21 },
  ];
  const run = (last: boolean) => {
    const s = stage();
    for (const collider of bodies) s.body(collider);
    s.view([2.4, 1.9, 3.1], [0, 1.0, -0.15], 34);
    const cloth = new Z.ZhudaCloth(
      Z.createZhudaClothGrid({
        columns: 25,
        rows: 25,
        width: 1.2,
        height: 1.2,
        origin: [-0.6, 1.9, 0],
      }),
      s.scene,
      { strain: { scale: 10 } },
    );
    const woven = s.woven('ZhudaFixtureClothHang', 24);
    cloth.node.meshRenderer.sharedMaterial = woven.material;
    const solver = cloth.solver;
    for (const collider of bodies) solver.addCollider(collider);
    solver.pin(0);
    solver.pin(24);
    const clock = clocked(cloth);
    const hem = 25 * 24 + 12;
    const where = (i: number): V => Array.from(solver.positions.subarray(i * 3, i * 3 + 3));
    let inside = 0,
      stretch = 0;
    const frames = (n: number, each?: (f: number) => void) => {
      for (let f = 0; f < n; f++) {
        each?.(f);
        clock.frame();
        inside = Math.max(inside, solver.countInside());
        stretch = Math.max(stretch, solver.measureStrain());
      }
    };
    const shot = (name: string) => {
      flush();
      if (last) keep(name);
      return read();
    };
    const result: any = {};
    // It hangs first.
    frames(360);
    const rest = Float32Array.from(solver.positions),
      restAt = where(hem);
    result.rest = {
      hem: restAt.map((v) => round(v)),
      energy: round(solver.inspect().kineticEnergy, 7),
      // The most while it fell into place, and as it hangs.
      mostStretch: round(stretch),
      stretch: round(solver.measureStrain()),
    };
    stretch = 0;
    const restPicture = shot('hang-rest');
    // A hand takes the middle of its hem and brings it forward and up: within reach.
    solver.grab(hem);
    const front: V = [0.15, 0.9, 0.3];
    solver.dragTo(hem, ...front);
    frames(120);
    {
      const hand = solver.handOf(hem),
        particle = where(hem);
      result.front = {
        handFromTarget: round(Math.hypot(...sub(hand, front)), 5),
        particleFromHand: round(Math.hypot(...sub(particle, hand)), 5),
        slack: round(0.1 * (1.2 / 24), 5),
      };
    }
    shot('hang-front');
    // Then into the body: the hand asks for the column's own axis.
    solver.dragTo(hem, 0, 0.9, -0.38);
    frames(60);
    // The layer is paused while the cloth is pressed against the body: nothing moves.
    clock.layers.setPaused('world', true);
    const pausedAt = hash(solver.positions),
      pausedPicture = shot('hang-pressed');
    let pausedSteps = 0;
    for (let f = 0; f < 45; f++) pausedSteps += clock.frame().steps;
    flush();
    result.paused = {
      steps: pausedSteps,
      samePositions: hash(solver.positions) === pausedAt,
      pixelsThatDiffer: differ(read(), pausedPicture),
    };
    clock.layers.setPaused('world', false);
    // Five seconds arrive in one delta (the tab was away): the cap is spent, the rest dropped.
    const gap = clock.frame(5);
    inside = Math.max(inside, solver.countInside());
    result.gap = { ...gap, inside: solver.countInside(), stretch: round(solver.measureStrain()) };
    frames(60);
    {
      const particle = where(hem),
        h = particle[1] - column.origin[1],
        fromAxis = sub(particle, [column.origin[0], particle[1], column.origin[2]]),
        angle = Math.atan2(fromAxis[0], fromAxis[2]);
      result.pressed = {
        fromAxis: round(Math.hypot(...fromAxis), 5),
        skin: round(Z.zhudaTableRadius(column, h, angle), 5),
        thickness: solver.options.thickness,
        depthInBody: round(
          Z.zhudaColliderDepth(column, 0, particle[0], particle[1], particle[2]),
          5,
        ),
      };
    }
    // Carried round the body to its far side.
    solver.dragTo(hem, -0.55, 1.15, -0.75);
    frames(90);
    result.round = { hem: where(hem).map((v) => round(v)) };
    shot('hang-round');
    // Let go.
    solver.release(hem);
    frames(24);
    result.released = { energy: round(solver.inspect().kineticEnergy, 4) };
    shot('hang-released');
    frames(900);
    const settled = shot('hang-settled');
    let farthest = 0;
    for (let i = 0; i < solver.count; i++)
      farthest = Math.max(
        farthest,
        Math.hypot(
          solver.positions[i * 3] - rest[i * 3],
          solver.positions[i * 3 + 1] - rest[i * 3 + 1],
          solver.positions[i * 3 + 2] - rest[i * 3 + 2],
        ),
      );
    const report = solver.inspect();
    result.settled = {
      energy: round(report.kineticEnergy, 7),
      farthestFromRest: round(farthest),
      // The weave's check moves with the cloth: counted where the picture is plainly another.
      pixelsUnlikeRest: differ(settled, restPicture, 60),
      stretch: round(report.maxStretch),
    };
    Object.assign(result, {
      inside,
      mostStretchInHand: round(stretch),
      steps: report.steps,
      dropped: report.dropped,
      positions: hash(solver.positions),
    });
    cloth.dispose();
    s.end();
    return { result, picture: settled };
  };
  const first = run(false),
    second = run(true);
  return {
    ...second.result,
    again: {
      positions: first.result.positions,
      samePositions: first.result.positions === second.result.positions,
      pixelsThatDiffer: differ(first.picture, second.picture),
    },
  };
}

// --- 3. A skirt pinned to a body that sways -------------------------------------------
function skirt() {
  const s = stage();
  s.view([1.5, 1.25, 2.3], [0, 0.72, 0], 30);
  const hips = (x: number) =>
    table(
      [x, 0.45, 0],
      0.65,
      (t) => 0.165 + 0.035 * Math.sin((t * 0.9 + 0.1) * Math.PI) - 0.04 * t * t,
      [1.15, 0.9],
    );
  const leg = (x: number, side: number) => ({
    type: 'capsule',
    a: [x + side * 0.09, 0.08, 0],
    b: [x + side * 0.09, 0.5, 0],
    radius: 0.075,
  });
  const columns = 36,
    rows = 16;
  const cloth = new Z.ZhudaCloth(
    Z.createZhudaClothTube({
      columns,
      rows,
      center: [0, 1.085, 0],
      topRadius: 0.17,
      bottomRadius: 0.36,
      length: 0.5,
    }),
    s.scene,
    { strain: { scale: 10 } },
  );
  cloth.node.meshRenderer.sharedMaterial = s.woven('ZhudaFixtureClothSkirt', 18).material;
  const solver = cloth.solver;
  solver.addCollider({ type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] });
  const ids = [
    solver.addCollider(hips(0)),
    solver.addCollider(leg(0, -1)),
    solver.addCollider(leg(0, 1)),
  ];
  let drawn = [s.body(hips(0)), s.body(leg(0, -1)), s.body(leg(0, 1))];
  const waist: V[] = [];
  for (let c = 0; c < columns; c++) {
    solver.pin(c);
    waist.push(Array.from(solver.positions.subarray(c * 3, c * 3 + 3)));
  }
  const clock = clocked(cloth);
  let inside = 0,
    stretch = 0;
  /** The body, the bodies the cloth is kept out of, and the waist's pins, all at one place. */
  const place = (x: number) => {
    solver.setCollider(ids[0], hips(x));
    solver.setCollider(ids[1], leg(x, -1));
    solver.setCollider(ids[2], leg(x, 1));
    for (const mesh of drawn) mesh.node.transform.position = v3([x, 0, 0]);
    for (let c = 0; c < columns; c++) solver.movePin(c, waist[c][0] + x, waist[c][1], waist[c][2]);
  };
  const hemAt = () => {
    let x = 0;
    for (let c = 0; c < columns; c++)
      x += solver.positions[((rows - 1) * columns + c) * 3] / columns;
    return x;
  };
  let spent = 0,
    counted = 0;
  const frames = (n: number, each?: (f: number) => void) => {
    for (let f = 0; f < n; f++) {
      each?.(f);
      const before = performance.now();
      clock.frame();
      spent += performance.now() - before;
      counted++;
      inside = Math.max(inside, solver.countInside());
      stretch = Math.max(stretch, solver.measureStrain());
    }
  };
  frames(240);
  const result: any = {
    rest: {
      hem: round(hemAt()),
      energy: round(solver.inspect().kineticEnergy, 7),
      stretch: round(solver.measureStrain()),
    },
  };
  flush();
  keep('skirt-rest');
  // Side to side, 35 cm each way, a sway every 1.6 seconds.
  const sway = (f: number) => 0.35 * Math.sin((f / 96) * 2 * Math.PI);
  let lag = 0,
    lead = 0;
  frames(288, (f) => {
    place(sway(f + 1));
    const behind = sway(f + 1) - hemAt();
    // Passing the middle at its fastest, one way and the other: the hem trails the waist.
    if (f % 96 === 95) lag = Math.max(lag, behind);
    if (f % 96 === 47) lead = Math.max(lead, -behind);
    if (f === 262) {
      flush();
      keep('skirt-sway');
    }
  });
  result.sway = { hemBehindGoingRight: round(lag), hemBehindGoingLeft: round(lead) };
  // It stops; the skirt comes to rest under the waist again.
  place(0);
  frames(480);
  flush();
  keep('skirt-stopped');
  const report = solver.inspect();
  Object.assign(result, {
    stopped: { hem: round(hemAt()), energy: round(report.kineticEnergy, 7) },
    inside,
    mostStretch: round(stretch),
    particles: report.particles,
    constraints: report.constraints,
    pinned: report.pinned,
    // The time of day, reported and never judged.
    msPerFrame: round(spent / counted, 3),
  });
  drawn = [];
  cloth.dispose();
  s.end();
  return result;
}

// --- 4. Made and destroyed thirty times ------------------------------------------------
function cycles() {
  const s = stage();
  s.view([0, 1.4, 3], [0, 1, 0], 34);
  flush();
  const before = held();
  const counts: number[] = [];
  for (let i = 0; i < 30; i++) {
    const cloth = new Z.ZhudaCloth(
      Z.createZhudaClothGrid({
        columns: 17,
        rows: 17,
        width: 1,
        height: 1,
        origin: [-0.5, 1.6, 0],
      }),
      s.scene,
      { strain: true },
    );
    const material = new Z.ZhudaLitSurfaceMaterial({
      name: 'ZhudaFixtureClothCycle',
      sheen: true,
      material: { doubleSided: true },
      surface:
        'void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 p,vec3 n){s.baseColor=vec3(0.2,0.3,0.7)+s.vertexColor.a;}',
    });
    cloth.node.meshRenderer.sharedMaterial = material.material;
    cloth.solver.pin(0);
    cloth.solver.pin(16);
    cloth.solver.addCollider({ type: 'sphere', center: [0, 1.1, 0.1], radius: 0.25 });
    const clock = clocked(cloth);
    for (let f = 0; f < 6; f++) clock.frame();
    flush(1);
    cloth.dispose();
    material.dispose();
    flush(1);
    counts.push(held() - before);
  }
  const result = {
    leftAfterEach: counts,
    most: Math.max(...counts),
    last: counts[counts.length - 1],
  };
  s.end();
  return result;
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
  flush(2);
  const only = new URLSearchParams(location.search).get('only');
  const parts: Record<string, () => any> = { drape, hang, skirt, cycles };
  out.left = {};
  // What LayaAir keeps once it has drawn anything is made before anything is counted.
  const warm = stage();
  flush(2);
  warm.end();
  for (const [name, part] of Object.entries(parts)) {
    if (only && only !== name) continue;
    const before = held();
    out[name] = part();
    out.left[name] = held() - before;
  }
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
