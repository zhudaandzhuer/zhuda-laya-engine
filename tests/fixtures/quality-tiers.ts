// Frame-rate fixture for scripts/measure-quality-tiers.mjs: a small town on
// grass under a game's look (ZhudaSceneLook: four shadow cascades of 4096,
// ambient occlusion, bloom, ground fog with beams, clouds), drawn at each
// look level from two views on the device's own screen. Two numbers a level:
// frames a second as the engine's loop draws them, paced by the browser, and
// milliseconds a frame drawn back to back with the graphics card waited for.
// With `post=<url>` the report is sent there when it is done (a phone whose
// browser cannot be driven from this machine).
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, done: false, errors: [] as string[], progress: '' };
(globalThis as any).__TIERS__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const params = new URLSearchParams(location.search);
const W = Number(params.get('w')) || window.innerWidth,
  H = Number(params.get('h')) || window.innerHeight,
  DPR_CAP = Number(params.get('dpr')) || 2,
  FOV = 55;
const VIEWS: Record<string, [number[], number[]]> = {
  // Walking down the main street, houses on both sides, grass ahead.
  street: [
    [0, 1.7, 34],
    [0, 2.2, -30],
  ],
  // From a roof over the whole town and the fields round it.
  wide: [
    [46, 22, 52],
    [0, 1, -8],
  ],
};
const LOOK = {
  preset: 'day',
  ambient: [0.9, 0.94, 1],
  ambientGround: [0.58, 0.58, 0.45],
  sun: { elevationDeg: 34, azimuthDeg: 140, intensity: 1.25, color: [1, 0.95, 0.86] },
  shadows: { distance: 60, resolution: 4096, cascades: 4 },
  grade: { exposure: 1.15, bloom: 0.3, ao: 0.55 },
  lightFog: { density: 0.006, shafts: { strength: 0.8, distance: 60 } },
  clouds: true,
};

/** A seeded random, so every device draws the same town. */
function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  const context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: W,
    height: H,
    dprCap: DPR_CAP,
    features: [...(globalThis as any).ZhudaBundle.features],
  });
  // What the engine's loop does each turn while a paced run is on; nothing otherwise.
  let onLoop: (() => void) | null = null;
  context.runtime.start(() => onLoop?.());
  const canvas = context.canvas as HTMLCanvasElement;
  const gl = renderer === 'webgl' ? canvas.getContext('webgl2') : null;
  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 1.7, 34],
    rotationEuler: [0, 0, 0],
  });
  camera.fieldOfView = FOV;
  camera.nearPlane = 0.05;
  camera.farPlane = 600;

  const rand = random(20261120);
  const paint = (color: number[], roughness: number) =>
    Z.createSurfaceMaterial({ type: 'pbr', color: [...color, 1], roughness });
  const walls = [
    paint([0.78, 0.74, 0.66], 0.9),
    paint([0.62, 0.52, 0.42], 0.85),
    paint([0.84, 0.82, 0.78], 0.8),
    paint([0.5, 0.46, 0.44], 0.95),
  ];
  const roofs = [paint([0.32, 0.16, 0.12], 0.7), paint([0.18, 0.2, 0.24], 0.6)];
  const earth = paint([0.3, 0.24, 0.16], 0.95),
    paving = paint([0.46, 0.45, 0.43], 0.9);
  let meshes = 0;
  const nodes: any[] = [];
  // `town=instanced`: the houses are copies of one box drawn by ZhudaInstancedMesh,
  // a group for each material and square of ground, instead of a node each.
  const instanced = params.get('town') === 'instanced';
  const holder = new Laya.Sprite3D('town');
  scene.addChild(holder);
  const copies = new Map<any, number[]>();
  const box = (size: number[], at: number[], material: any, turnY = 0) => {
    meshes++;
    if (instanced && meshes > 3) {
      const c = Math.cos((turnY * Math.PI) / 180),
        n = Math.sin((turnY * Math.PI) / 180);
      const list = copies.get(material) ?? [];
      copies.set(material, list);
      // Column-major: the box scaled, turned about the vertical, put in its place.
      list.push(
        ...[c * size[0], 0, -n * size[0], 0],
        ...[0, size[1], 0, 0],
        ...[n * size[2], 0, c * size[2], 0],
        ...[at[0], at[1], at[2], 1],
      );
      return;
    }
    const mesh = Z.Zhuda3D.createPrimitiveMesh('box', {
      width: size[0],
      height: size[1],
      depth: size[2],
    });
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.receiveShadow = true;
    node.meshRenderer.castShadow = true;
    node.transform.position = new Laya.Vector3(at[0], at[1], at[2]);
    node.transform.rotationEuler = new Laya.Vector3(0, turnY, 0);
    scene.addChild(node);
    nodes.push(node);
  };
  box([600, 0.2, 600], [0, -0.1, 0], earth);
  // The main street, 6 m wide along z, and a cross street.
  box([6, 0.04, 120], [0, 0.02, -10], paving);
  box([90, 0.04, 5], [0, 0.02, -8], paving);
  const onStreet = (x: number, z: number) => Math.abs(x) < 3.6 || Math.abs(z + 8) < 3.2;
  const town = (x: number, z: number) => Math.abs(x) < 44 && z > -66 && z < 26;
  // Houses in rows of plots 8 m apart: walls, a roof, a chimney, a fence post or two.
  for (let ix = -5; ix <= 5; ix++)
    for (let iz = -8; iz <= 3; iz++) {
      const x = ix * 8 + (rand() - 0.5) * 1.6,
        z = iz * 8 + (rand() - 0.5) * 1.6;
      if (onStreet(x, z) || Math.abs(x) < 6.5) continue;
      const w = 4 + rand() * 2.4,
        d = 4 + rand() * 2.4,
        h = 2.8 + Math.floor(rand() * 3) * 2.4,
        turn = (rand() - 0.5) * 14;
      box([w, h, d], [x, h / 2, z], walls[Math.floor(rand() * walls.length)], turn);
      box(
        [w + 0.6, 0.5, d + 0.6],
        [x, h + 0.25, z],
        roofs[Math.floor(rand() * roofs.length)],
        turn,
      );
      box([0.5, 1.1, 0.5], [x + w * 0.25, h + 1.0, z], walls[3], turn);
      for (let p = 0; p < 2; p++)
        box([0.12, 1.1, 0.12], [x + (p ? 1 : -1) * (w / 2 + 0.7), 0.55, z + d / 2 + 0.9], roofs[1]);
    }

  let groups = 0;
  if (instanced) {
    const unit = Z.Zhuda3D.createPrimitiveMesh('box', { width: 1, height: 1, depth: 1 });
    for (const [material, list] of copies) {
      const drawn = new Z.ZhudaInstancedMesh(holder, unit, material, new Float32Array(list), {
        cellMeters: 32,
        castShadow: true,
      });
      groups += drawn.stats.groups;
    }
  }

  const look = new Z.ZhudaSceneLook(scene, camera, LOOK);
  const grass = new Z.ZhudaGrassField(scene, {
    area: { minX: -90, maxX: 90, minZ: -110, maxZ: 70 },
    ground: () => 0,
    grows: (x: number, z: number) => !town(x, z),
  });

  let view = VIEWS.street,
    seconds = 0;
  const frame = () => {
    seconds += 1 / 60;
    look.update(view[0], view[1], FOV, W / H, 1 / 60);
    grass.update(view[0], seconds);
    Z.ZhudaEngine.flushRenderFrames(1);
  };
  const settle = async () => {
    const device = (Laya.LayaGL.renderEngine as any).getDevice?.();
    if (device?.queue?.onSubmittedWorkDone) await device.queue.onSubmittedWorkDone();
    else if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  };
  const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
  /** Milliseconds a frame, drawn back to back, the graphics card waited for: the median of three runs. */
  /** The time the page spent issuing the last back-to-back run's frames, before the graphics card was waited for. */
  let issueMs = 0;
  const backToBack = async (frames: number) => {
    const runs: number[] = [],
      issue: number[] = [];
    for (let run = 0; run < 3; run++) {
      await settle();
      const from = performance.now();
      for (let i = 0; i < frames; i++) frame();
      issue.push((performance.now() - from) / frames);
      await settle();
      runs.push((performance.now() - from) / frames);
    }
    issueMs = +median(issue).toFixed(2);
    return +median(runs).toFixed(2);
  };
  /**
   * Frames a second as the engine's own loop draws them over `ms` (it is
   * paced by the browser's requestAnimationFrame and draws once a turn), and
   * the slow end of the gaps between them.
   */
  const paced = (ms: number) =>
    new Promise<{ fps: number; p95Ms: number }>((resolve) => {
      const gaps: number[] = [];
      let first = 0,
        last = 0,
        warm = 30;
      onLoop = () => {
        const now = performance.now();
        seconds += 1 / 60;
        look.update(view[0], view[1], FOV, W / H, 1 / 60);
        grass.update(view[0], seconds);
        // The first paced frames follow a run drawn back to back and can stall: not counted.
        if (warm > 0) warm--;
        else if (!first) first = now;
        else gaps.push(now - last);
        last = now;
        if (!first || now - first < ms) return;
        onLoop = null;
        const sorted = [...gaps].sort((x, y) => x - y);
        resolve({
          fps: +((gaps.length * 1000) / (last - first)).toFixed(1),
          p95Ms: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1),
        });
      };
    });

  out.measure = async (level: number, name: string, scale = 1) => {
    view = VIEWS[name];
    camera.transform.position = new Laya.Vector3(...view[0]);
    camera.transform.lookAt(new Laya.Vector3(...view[1]), new Laya.Vector3(0, 1, 0));
    look.setStep({ look: level, renderScale: scale });
    grass.fill(view[0], seconds);
    for (let i = 0; i < 40; i++) frame();
    await settle();
    const ms = await backToBack(40);
    const rate = await paced(4000);
    return {
      level,
      scale,
      view: name,
      msBackToBack: ms,
      msIssued: issueMs,
      fps: rate.fps,
      p95GapMs: rate.p95Ms,
    };
  };
  out.info = {
    renderer,
    cssSize: [W, H],
    backing: [canvas.width, canvas.height],
    devicePixelRatio: window.devicePixelRatio,
    dprCap: DPR_CAP,
    userAgent: navigator.userAgent,
    meshes,
    town: instanced ? `instanced, ${groups} groups` : 'a node each',
    grass: grass.stats ?? null,
  };
  out.ready = true;

  // `profile=1@0.7`: one step from the street, with parts of the look and of the
  // scene taken away one at a time, each measured twice.
  if (params.has('profile')) {
    const [level, scale] = params.get('profile')!.split('@').map(Number);
    const NONE = { shadows: false, lightFog: false, clouds: false, grade: false };
    const variants: Record<string, [any, boolean]> = {
      full: [{}, true],
      'no clouds': [{ clouds: false }, true],
      'no light fog': [{ lightFog: false }, true],
      'no shadows': [{ shadows: false }, true],
      'no bloom': [{ grade: { ...LOOK.grade, bloom: 0 } }, true],
      'no edge smoothing': [{ grade: { ...LOOK.grade, antialias: 'none' } }, true],
      // Fog and clouds are part of the HDR chain: they go with it.
      'bare HDR chain (no fog, clouds, bloom, occlusion, smoothing)': [
        {
          lightFog: false,
          clouds: false,
          grade: { exposure: LOOK.grade.exposure, bloom: 0, ao: 0, antialias: 'none' },
        },
        true,
      ],
      'no HDR chain (shadows only)': [{ lightFog: false, clouds: false, grade: false }, true],
      'none of them': [NONE, true],
      'full, the town hidden': [{}, false],
      'none of them, the town hidden': [NONE, false],
    };
    const rows: any[] = [];
    for (let round = 0; round < 2; round++)
      for (const [name, [patch, town]] of Object.entries(variants)) {
        out.progress = `${name}, round ${round}`;
        look.setLook({ ...LOOK, ...patch });
        // The ground and the two streets stay; the houses go.
        nodes.forEach((node, i) => (node.active = town || i < 3));
        holder.active = town;
        rows.push({ variant: name, round, ...(await out.measure(level, 'street', scale || 1)) });
      }
    out.report = { ...out.info, profile: params.get('profile'), rows, errors: out.errors };
    out.done = true;
    const post = params.get('post');
    if (post)
      await fetch(post, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(out.report),
      });
    document.title = 'done';
    return;
  }
  if (params.has('run')) {
    // `steps=3@1,1@0.7`: look levels at render scales; without it, the four levels at full size.
    const steps = (params.get('steps') || '3@1,2@1,1@1,0@1')
      .split(',')
      .map((text) => text.split('@').map(Number));
    const rows: any[] = [];
    for (const name of Object.keys(VIEWS))
      for (const [level, scale] of steps) {
        out.progress = `${name} level ${level} at ${scale}`;
        rows.push(await out.measure(level, name, scale || 1));
      }
    out.report = { ...out.info, rows, errors: out.errors };
    out.done = true;
    const post = params.get('post');
    if (post)
      await fetch(post, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(out.report),
      });
    document.title = 'done';
  }
}
void main().catch((error) => {
  out.errors.push(String(error?.stack || error));
  out.done = true;
  const post = params.get('post');
  if (post) void fetch(post, { method: 'POST', body: JSON.stringify({ errors: out.errors }) });
});
