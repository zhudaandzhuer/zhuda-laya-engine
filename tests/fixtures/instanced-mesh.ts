// Real-draw fixture for scripts/verify-instanced-mesh.mjs: five thousand
// copies of a mesh drawn in groups against the same copies as nodes, their
// shadows, a holder that is not at the origin, a tint for each copy, a model
// prefab mounted instanced with levels, and identical nodes casting shadows
// (which LayaAir's WebGPU batches do not).
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__INSTANCED__ = out;
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
out.pictures = () => Object.keys(saved);

type V = number[];
const v3 = (a: V) => new Laya.Vector3(a[0], a[1], a[2]);
const sub = (a: V, b: V) => a.map((v, i) => v - b[i]);
const add = (a: V, b: V) => a.map((v, i) => v + b[i]);
const scale = (a: V, s: number) => a.map((v) => v * s);
const dot = (a: V, b: V) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = (a: V) => scale(a, 1 / Math.hypot(...a));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (low: number, high: number, x: number) => {
  const t = clamp01((x - low) / (high - low));
  return t * t * (3 - 2 * t);
};
/** What the screen shows for a linear value, without a grade. */
const shown = (linear: number) => 255 * clamp01(linear) ** (1 / 2.2);
const at = (p: Uint8Array, x: number, y: number) => {
  const i = (Math.round(y) * W + Math.round(x)) * 4;
  return [p[i], p[i + 1], p[i + 2]];
};
/** Mean colour of a square round a point. */
const patch = (p: Uint8Array, cx: number, cy: number, half = 2) => {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.round(cy) - half; y <= Math.round(cy) + half; y++)
    for (let x = Math.round(cx) - half; x <= Math.round(cx) + half; x++, n++)
      for (let c = 0; c < 3; c++) sum[c] += p[(y * W + x) * 4 + c];
  return sum.map((v) => +(v / n).toFixed(1));
};
const far = (a: V, b: V) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
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

/** Copies on a grid, each turned and sized a little differently: [x, y, z, yawDeg, scale]. */
function grid(columns: number, rows: number, gap: number, lift = 0): number[][] {
  const places: number[][] = [];
  for (let i = 0; i < columns * rows; i++)
    places.push([
      ((i % columns) - (columns - 1) / 2) * gap,
      lift,
      (Math.floor(i / columns) - (rows - 1) / 2) * gap,
      (i * 37) % 360,
      0.8 + (((i * 7) % 10) / 10) * 0.4,
    ]);
  return places;
}

async function boot(width: number, height: number, dprCap: number) {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width,
    height,
    dprCap,
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
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/** A sun with shadows, a floor, and the same five thousand balls two ways. */
function world(reach: number) {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.2, 0.22, 0.25] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 30, 45], fov: 45 });
  camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  camera.clearColor = new Laya.Color(0.4, 0.5, 0.6, 1);
  camera.enableHDR = false;
  camera.msaa = false;
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1.2 });
  sun.node.transform.rotationEuler = v3([-45, 30, 0]);
  sun.light.shadowMode = Laya.ShadowMode.SoftLow;
  sun.light.shadowDistance = reach;
  sun.light.shadowResolution = 2048;
  const floorPaint = Z.createSurfaceMaterial({
    type: 'pbr',
    color: [0.8, 0.8, 0.8, 1],
    roughness: 0.9,
  });
  const floor = new Laya.MeshSprite3D(
    Z.Zhuda3D.createPrimitiveMesh('box', { width: 140, height: 0.2, depth: 140 }),
  );
  floor.meshRenderer.sharedMaterial = floorPaint;
  floor.meshRenderer.receiveShadow = true;
  floor.transform.position = v3([0, -0.1, 0]);
  scene.addChild(floor);
  return { scene, camera, sun, floor, floorPaint };
}

/** One node a copy, as a scene made of nodes would hold them. */
function copies(parent: any, mesh: any, material: any, places: number[][]) {
  const holder = new Laya.Sprite3D('copies');
  parent.addChild(holder);
  for (const [x, y, z, yaw, size] of places) {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.transform.localPosition = v3([x, y, z]);
    node.transform.localRotationEuler = v3([0, yaw, 0]);
    node.transform.localScale = v3([size, size, size]);
    holder.addChild(node);
  }
  return holder;
}

/** How many things LayaAir drew in the last frame: the scene's pass and the shadow maps. */
function draws() {
  const agent = Laya.LayaGL.statAgent;
  const read = () => [
    agent._timeArray[Laya.StatElement.CT_OpaqueDrawCall],
    agent._timeArray[Laya.StatElement.CT_ShadowDrawCall],
  ];
  for (let attempt = 0; attempt < 4; attempt++) {
    const before = read();
    Z.ZhudaEngine.flushRenderFrames(1);
    const after = read();
    // The counters are folded into an average once a second: taken again if that fell between.
    if (after[0] >= before[0] && after[1] >= before[1])
      return { scene: after[0] - before[0], shadow: after[1] - before[1] };
  }
  return { scene: -1, shadow: -1 };
}

const pixelOne = new Uint8Array(4);
/** Median time of a frame, drawn and finished, over forty. */
function measure() {
  Z.ZhudaEngine.flushRenderFrames(12);
  const times: number[] = [];
  for (let i = 0; i < 40; i++) {
    const started = performance.now();
    Z.ZhudaEngine.flushRenderFrames(1);
    if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixelOne);
    times.push(performance.now() - started);
  }
  return +[...times].sort((a, b) => a - b)[20].toFixed(2);
}

/**
 * `?time=1`: the cost of five thousand props as nodes and in groups, in a
 * picture as large as the window.
 */
async function timing() {
  await boot(Math.min(innerWidth, 1280), Math.min(innerHeight, 1280), 2);
  const { scene, camera } = world(120);
  const mesh = Laya.PrimitiveMesh.createSphere(0.35, 12, 12);
  const material = Z.createSurfaceMaterial({
    type: 'pbr',
    color: [0.9, 0.4, 0.2, 1],
    roughness: 0.6,
  });
  const places = grid(100, 50, 0.9, 0.35);
  const cases: Record<string, number> = { empty: measure() };
  const asNodes = copies(scene, mesh, material, places);
  cases.nodes = measure();
  cases.nodesDraws = draws().scene;
  asNodes.destroy(true);
  Z.ZhudaEngine.flushRenderFrames(3);
  const grouped = new Z.ZhudaInstancedMesh(
    scene,
    mesh,
    material,
    Z.zhudaPlacementMatrices(places),
    {
      cellMeters: 16,
    },
  );
  cases.groups = measure();
  cases.groupsDraws = draws().scene;
  camera.transform.lookAt(v3([0, 200, 300]), v3([0, 1, 0]));
  cases.groupsAway = measure();
  grouped.dispose();
  // Three hundred of a character on twelve bones: each with a skeleton of its own, then baked.
  camera.transform.position = v3([0, 14, 24]);
  camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  const provider = new Z.DirectoryAssetProvider({ baseUrl: './fixtures/' });
  const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
  const stand = grid(20, 15, 1.4);
  const walkers: any[] = [];
  for (const [x, y, z, yaw] of stand) {
    const walker = await library.instantiate('character.glb');
    walker.node.transform.position = v3([x, y, z]);
    walker.node.transform.rotationEuler = v3([0, yaw, 0]);
    const cast = (node: any) => {
      const renderer = node.getComponent(Laya.SkinnedMeshRenderer);
      if (renderer) renderer.castShadow = renderer.receiveShadow = true;
      for (let i = 0; i < node.numChildren; i++) cast(node.getChildAt(i));
    };
    cast(walker.node);
    scene.addChild(walker.node);
    walkers.push(walker);
  }
  cases.skeletons = measure();
  cases.skeletonsDraws = draws().scene;
  for (const walker of walkers) walker.dispose();
  Z.ZhudaEngine.flushRenderFrames(3);
  const source = await library.instantiate('character.glb');
  const character = new Z.ZhudaBakedCharacter(source, { fps: 30 });
  const crowd = new Z.ZhudaBakedCrowd(
    scene,
    character,
    stand.map((place, i) => ({ place, clip: i % 2 ? 'Sway' : 'Bend', phase: (i * 0.137) % 1 })),
    { cellMeters: 8 },
  );
  // A crowd is told the time every frame, as a game would.
  let clock = 0;
  const tick = () => crowd.update((clock += 1 / 60));
  Laya.timer.frameLoop(1, crowd, tick);
  cases.baked = measure();
  cases.bakedDraws = draws().scene;
  Laya.timer.clear(crowd, tick);
  crowd.dispose();
  character.dispose();
  source.dispose();
  out.timing = {
    picture: [context.canvas.width, context.canvas.height],
    synced: !!gl,
    copies: places.length,
    characters: stand.length,
    cases,
  };
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}

async function main() {
  if (new URLSearchParams(location.search).has('time')) return timing();
  await boot(W, H, 1);
  const { scene, camera, sun, floor } = world(120);
  const frame = (name?: string) => {
    Z.ZhudaEngine.flushRenderFrames(3);
    const p = read();
    if (name) saved[name] = p;
    return p;
  };
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
  /** Live resources by class, to name what a disposal leaves. */
  const census = () => {
    const map = Laya.Resource._idResourcesMap;
    const items: any[] = map instanceof Map ? [...map.values()] : Object.values(map || {});
    const count: Record<string, number> = {};
    const pooled = new Set<any>(Laya.RenderTexture._pool ?? []);
    for (const item of items)
      if (!item.destroyed && !pooled.has(item)) {
        const name = `${item.constructor?.name}:${item.width ?? ''}x${item.height ?? ''}:${item.format ?? ''}:${item.name ?? ''}`;
        count[name] = (count[name] ?? 0) + 1;
      }
    return count;
  };
  frame();
  const resourcesBefore = held();
  const censusBefore = census();
  const owned: any[] = [];
  const keep = <T>(item: T) => (owned.push(item), item);
  const mesh = keep(Laya.PrimitiveMesh.createSphere(0.35, 12, 12));
  const material = keep(
    Z.createSurfaceMaterial({ type: 'pbr', color: [0.9, 0.4, 0.2, 1], roughness: 0.6 }),
  );

  // 1. Five thousand copies: as nodes, then in groups. The same picture.
  const places = grid(100, 50, 0.9, 0.35);
  const asNodes = copies(scene, mesh, material, places);
  const nodesFrame = frame('nodes');
  const nodesDraws = draws();
  asNodes.destroy(true);
  frame();
  const emptyFrame = frame('empty');
  let grouped = new Z.ZhudaInstancedMesh(scene, mesh, material, Z.zhudaPlacementMatrices(places), {
    cellMeters: 16,
  });
  const groupsFrame = frame('groups');
  const groupsDraws = draws();
  camera.transform.lookAt(v3([0, 200, 300]), v3([0, 1, 0]));
  const awayDraws = draws();
  camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  out.props = {
    copies: places.length,
    stats: grouped.stats,
    against: difference(nodesFrame, groupsFrame),
    drawn: difference(emptyFrame, groupsFrame),
    nodesDraws,
    groupsDraws,
    awayDraws,
  };
  // Without shadows cast the picture differs from the one with them: the copies do cast.
  grouped.dispose();
  grouped = new Z.ZhudaInstancedMesh(scene, mesh, material, Z.zhudaPlacementMatrices(places), {
    cellMeters: 16,
    castShadow: false,
  });
  out.props.noCast = difference(groupsFrame, frame('groups-no-cast'));
  out.props.noCastDraws = draws();
  grouped.dispose();
  frame();
  out.props.afterDispose = difference(emptyFrame, frame());

  // 2. Under a holder that is moved, turned and scaled: the copies are places under it.
  {
    const few = grid(12, 8, 1.4, 0.35);
    const pose = (node: any) => {
      node.transform.position = v3([6, 0.5, -4]);
      node.transform.rotationEuler = v3([0, 30, 0]);
      node.transform.localScale = v3([1.5, 1.5, 1.5]);
    };
    const holderA = new Laya.Sprite3D('holder-a');
    scene.addChild(holderA);
    pose(holderA);
    const nodesUnder = copies(holderA, mesh, material, few);
    const a = frame('holder-nodes');
    holderA.destroy(true);
    frame();
    const holderB = new Laya.Sprite3D('holder-b');
    scene.addChild(holderB);
    pose(holderB);
    const under = new Z.ZhudaInstancedMesh(holderB, mesh, material, Z.zhudaPlacementMatrices(few));
    out.holder = { against: difference(a, frame('holder-groups')), groups: under.stats.groups };
    void nodesUnder;
    under.dispose();
    holderB.destroy(true);
    frame();
  }

  // 3. A colour for each copy, with a toon material lit by a flat ambient light only: each ball is its tint.
  {
    sun.node.active = false;
    floor.active = false;
    scene.ambientColor = new Laya.Color(0.5, 0.5, 0.5, 1);
    camera.orthographic = true;
    camera.orthographicVerticalSize = 3;
    camera.transform.position = v3([0, 0, 10]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    camera.clearColor = new Laya.Color(0, 0, 0, 1);
    const toon = keep(new Z.ZhudaToonMaterial({ name: 'ZhudaInstancedToon' }));
    const TINTS = [
      [1, 0.2, 0.2],
      [0.2, 1, 0.2],
      [0.3, 0.3, 1],
    ];
    const three = [-1.2, 0, 1.2].map((x) => [x, 0, 0, 0, 1]);
    const tints = new Float32Array(TINTS.flatMap((t) => [...t, 1]));
    const tinted = new Z.ZhudaInstancedMesh(
      scene,
      mesh,
      toon.material,
      Z.zhudaPlacementMatrices(three),
      {
        tints,
        castShadow: false,
      },
    );
    const p = frame('tints');
    const ambient = Z.zhudaSrgbToLinear(0.5);
    out.tints = {
      got: [-1.2, 0, 1.2].map((x) => at(p, W / 2 + x * 100, H / 2)),
      want: TINTS.map((t) => t.map((c) => +shown(Z.zhudaSrgbToLinear(c) * ambient).toFixed(1))),
    };
    tinted.dispose();
    // The same material on plain nodes and on copies without tints is untouched by it.
    const plain = new Z.ZhudaInstancedMesh(
      scene,
      mesh,
      toon.material,
      Z.zhudaPlacementMatrices(three),
      {
        castShadow: false,
      },
    );
    out.tints.plain = at(frame(), W / 2, H / 2);
    out.tints.plainWant = +shown(ambient).toFixed(1);
    plain.dispose();
    const refuse = (make: () => unknown) => {
      try {
        make();
        return 'accepted';
      } catch (error) {
        return String((error as Error).message);
      }
    };
    out.refused = {
      tintsOnStock: refuse(
        () =>
          new Z.ZhudaInstancedMesh(scene, mesh, material, Z.zhudaPlacementMatrices(three), {
            tints,
          }),
      ),
      tintCount: refuse(
        () =>
          new Z.ZhudaInstancedMesh(scene, mesh, toon.material, Z.zhudaPlacementMatrices(three), {
            tints: new Float32Array(4),
          }),
      ),
      noCopies: refuse(() => new Z.ZhudaInstancedMesh(scene, mesh, material, new Float32Array(0))),
      mirrored: refuse(
        () =>
          new Z.ZhudaInstancedMesh(
            scene,
            mesh,
            material,
            new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
          ),
      ),
      mesh: refuse(
        () => new Z.ZhudaInstancedMesh(scene, {}, material, Z.zhudaPlacementMatrices(three)),
      ),
    };
    camera.orthographic = false;
    camera.transform.position = v3([0, 30, 45]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    camera.clearColor = new Laya.Color(0.4, 0.5, 0.6, 1);
    scene.ambientColor = new Laya.Color(0.2, 0.22, 0.25, 1);
    sun.node.active = true;
    floor.active = true;
  }

  // 4. A model prefab of two meshes, copied 600 times: as nodes and instanced, with a lighter version for distance.
  {
    camera.transform.position = v3([0, 14, 22]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    const provider = new Z.DirectoryAssetProvider({ baseUrl: './fixtures/' });
    const stand = grid(30, 20, 1.6);
    const node = (instanced: boolean, levels: boolean) => ({
      name: 'props',
      asset: 'prop.glb',
      placements: stand,
      ...(instanced ? { instanced: true, cellMeters: 8 } : {}),
      ...(levels ? { lod: [{ asset: 'prop-light.glb', fromMeters: 30 }], cullMeters: 55 } : {}),
    });
    const definitions = [
      { id: 'as-nodes', kind: 'models', nodes: [node(false, false)], states: { all: {} } },
      { id: 'in-groups', kind: 'models', nodes: [node(true, false)], states: { all: {} } },
      { id: 'levels-nodes', kind: 'models', nodes: [node(false, true)], states: { all: {} } },
      { id: 'levels-groups', kind: 'models', nodes: [node(true, true)], states: { all: {} } },
      {
        id: 'skinned',
        kind: 'models',
        nodes: [
          { name: 'limbs', asset: 'limb.glb', placements: stand.slice(0, 4), instanced: true },
        ],
        states: { all: {} },
      },
    ];
    const library = new Z.ZhudaPrefabLibrary({ provider, definitions });
    const show = async (id: string, name: string, eye?: number[]) => {
      const instance = await library.instantiate(id, { parent: scene });
      const counts = eye ? instance.updateLod(eye) : null;
      const picture = frame(name);
      const drawn = draws();
      instance.dispose();
      frame();
      return { picture, drawn, counts };
    };
    const nodes = await show('as-nodes', 'model-nodes');
    const groups = await show('in-groups', 'model-groups');
    // An eye far to one side: the near copies full, the middle ones light, the far ones not drawn.
    const eye = [-40, 2, 0];
    const levelNodes = await show('levels-nodes', 'levels-nodes', eye);
    const levelGroups = await show('levels-groups', 'levels-groups', eye);
    out.model = {
      copies: stand.length,
      against: difference(nodes.picture, groups.picture),
      nodesDraws: nodes.drawn,
      groupsDraws: groups.drawn,
      levels: {
        nodes: levelNodes.counts,
        groups: levelGroups.counts,
        // Chosen a group at a time, the picture is near the one chosen a copy at a time, not equal to it.
        against: difference(levelNodes.picture, levelGroups.picture),
        changed: difference(groups.picture, levelGroups.picture),
        draws: levelGroups.drawn,
      },
      skinned: await library.instantiate('skinned', { parent: scene }).then(
        (instance: any) => (instance.dispose(), 'accepted'),
        (error: Error) => String(error.message),
      ),
    };
    library.dispose();
    provider.dispose?.();
    camera.transform.position = v3([0, 30, 45]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  }

  // 5. Nine nodes of one mesh and one material: each casts its shadow.
  {
    camera.orthographic = true;
    camera.orthographicVerticalSize = 8;
    camera.transform.position = v3([0, 9, 9]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    const right = new Laya.Vector3(),
      up = new Laya.Vector3();
    camera.transform.getRight(right);
    camera.transform.getUp(up);
    const pixel = (p: V) => {
      const d = sub(p, [0, 9, 9]);
      return [
        W / 2 + dot(d, [right.x, right.y, right.z]) * (H / 8),
        H / 2 - dot(d, [up.x, up.y, up.z]) * (H / 8),
      ] as [number, number];
    };
    // The sun from one side, so each shadow lies beside its ball as the eye sees it.
    sun.node.transform.rotationEuler = v3([-45, 90, 0]);
    Z.ZhudaEngine.flushRenderFrames(2);
    const travel = sun.light.direction;
    const nine = grid(3, 3, 2.2, 0.35).map((place) => [place[0], place[1], place[2], 0, 1]);
    const holder = copies(scene, mesh, material, nine);
    const p = frame('identical-nodes');
    const lit = patch(p, ...pixel([3.6, 0, 3.2]));
    // A point of the floor well inside each ball's shadow: 0.6 along the light from under the ball.
    const along = Math.hypot(travel.x, travel.z);
    const shadows = nine.map(([x, , z]) =>
      patch(p, ...pixel([x + (travel.x / along) * 0.6, 0, z + (travel.z / along) * 0.6]), 1),
    );
    out.sunTravel = [travel.x, travel.y, travel.z].map((v) => +v.toFixed(3));
    out.identical = { lit, shadows: shadows.map((s) => s[0]) };
    holder.destroy(true);
    camera.orthographic = false;
    sun.node.transform.rotationEuler = v3([-45, 30, 0]);
  }

  // 6. A crowd of one animated character: every bone of every frame in a texture.
  {
    camera.transform.position = v3([0, 5, 11]);
    camera.transform.lookAt(v3([0, 1, 0]), v3([0, 1, 0]));
    const provider = new Z.DirectoryAssetProvider({ baseUrl: './fixtures/' });
    const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
    const refuse = (make: () => unknown) => {
      try {
        make();
        return 'accepted';
      } catch (error) {
        return String((error as Error).message);
      }
    };
    const crowd: any = (out.crowd = { against: {} });
    let kept: { source: any; character: any } | null = null;
    for (const asset of ['character.glb', 'character30.glb']) {
      const source = await library.instantiate(asset);
      const started = performance.now();
      const character = new Z.ZhudaBakedCharacter(source, { fps: 30 });
      const bakeMs = +(performance.now() - started).toFixed(1);
      // The same character as LayaAir animates it, posed at a time, against one baked copy at that time.
      const reference = await library.instantiate(asset);
      scene.addChild(reference.node);
      const walk = (node: any) => {
        const renderer = node.getComponent(Laya.SkinnedMeshRenderer);
        if (renderer) {
          renderer.castShadow = true;
          renderer.receiveShadow = true;
        }
        for (let i = 0; i < node.numChildren; i++) walk(node.getChildAt(i));
      };
      walk(reference.node);
      const poses: [string, number][] = [
        ['Bend', 0],
        ['Bend', 0.5],
        ['Bend', 0.9],
        ['Sway', 0.3],
      ];
      const natural: Uint8Array[] = [];
      for (const [clip, seconds] of poses) {
        const sampler = new Z.ZhudaModelAnimationSampler(reference, '$', clip);
        sampler.sample(seconds);
        natural.push(frame(asset === 'character.glb' ? `natural-${clip}-${seconds}` : undefined));
        sampler.dispose();
      }
      reference.dispose();
      frame();
      const one = new Z.ZhudaBakedCrowd(scene, character, [
        { place: [0, 0, 0, 0, 1], clip: 'Bend' },
      ]);
      const result: any = {
        layout: character.layout,
        bakeMs,
        textureBytes: character.textureBytes,
        box: [character.min, character.max].map((p: number[]) => p.map((v) => +v.toFixed(2))),
        poses: {},
      };
      poses.forEach(([clip, seconds], i) => {
        one.setClip(0, clip);
        one.update(seconds);
        const baked = frame(asset === 'character.glb' ? `baked-${clip}-${seconds}` : undefined);
        result.poses[`${clip} ${seconds}`] = difference(natural[i], baked);
      });
      // The pose changes with the time: the first and the middle of the bend are not one picture.
      result.moved = difference(natural[0], natural[1]);
      one.dispose();
      crowd.against[asset] = result;
      if (asset === 'character.glb') kept = { source, character };
      else {
        character.dispose();
        source.dispose();
      }
    }
    // Five hundred of them, each at its own point of one of two clips.
    const { source, character } = kept!;
    const stand = grid(25, 20, 1.3);
    const copies = stand.map((place, i) => ({
      place,
      clip: i % 2 ? 'Sway' : 'Bend',
      phase: (i * 0.137) % 1,
      speed: 0.5 + ((i * 3) % 7) / 7,
    }));
    camera.transform.position = v3([0, 14, 24]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
    const empty = frame();
    const many = new Z.ZhudaBakedCrowd(scene, character, copies, { cellMeters: 8 });
    many.update(0.4);
    const drawn = frame('crowd');
    crowd.five = {
      stats: many.stats,
      drawn: difference(empty, drawn),
      draws: draws(),
      // Asked for the same time again nothing changes; a frame later most copies do.
      again: many.update(0.4),
      later: many.update(0.4 + 1 / 30),
      updateMs: (() => {
        const started = performance.now();
        for (let i = 0; i < 120; i++) many.update(1 + i / 60);
        return +((performance.now() - started) / 120).toFixed(3);
      })(),
    };
    many.update(0.4);
    crowd.five.back = difference(drawn, frame());
    many.setClip(0, 'Sway', { phase: 0.5 });
    crowd.five.oneChanged = many.update(0.4);
    many.dispose();
    const noShadow = new Z.ZhudaBakedCrowd(scene, character, copies, {
      cellMeters: 8,
      castShadow: false,
    });
    noShadow.update(0.4);
    crowd.five.noCast = difference(drawn, frame('crowd-no-cast'));
    noShadow.dispose();
    frame();
    crowd.five.afterDispose = difference(empty, frame());
    const still = await library.instantiate('prop.glb');
    crowd.refused = {
      noSkin: refuse(() => new Z.ZhudaBakedCharacter(still)),
      clip: refuse(() => new Z.ZhudaBakedCharacter(source, { clips: ['Jump'] })),
      copyClip: refuse(
        () => new Z.ZhudaBakedCrowd(scene, character, [{ place: [0, 0, 0, 0, 1], clip: 'Jump' }]),
      ),
      none: refuse(() => new Z.ZhudaBakedCrowd(scene, character, [])),
    };
    still.dispose();
    character.dispose();
    crowd.refused.disposed = refuse(
      () => new Z.ZhudaBakedCrowd(scene, character, [{ place: [0, 0, 0, 0, 1] }]),
    );
    source.dispose();
    library.dispose?.();
    provider.dispose?.();
    camera.transform.position = v3([0, 30, 45]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  }

  for (const item of owned) (item.dispose ?? item.destroy).call(item);
  sun.light.shadowMode = Laya.ShadowMode.None;
  frame();
  out.resourcesLeft = held() - resourcesBefore;
  out.left = (() => {
    const now = census();
    return Object.keys(now)
      .filter((name) => now[name] !== (censusBefore[name] ?? 0))
      .map((name) => `${name} ${censusBefore[name] ?? 0}->${now[name]}`);
  })();
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
