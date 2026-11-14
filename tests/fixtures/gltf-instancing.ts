// Real-draw fixture for scripts/verify-gltf-instancing.mjs: a model whose
// file draws one mesh twelve times (EXT_mesh_gpu_instancing), mounted in
// each of the ways a model is mounted and compared with the same crates put
// there one node at a time; a plate whose occlusion and emissive textures
// are laid out on the second set of texture coordinates; and Meshopt decoded
// in workers.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__COPIES__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 480,
  H = 320;
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
const dot = (a: V, b: V) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a: V, b: V) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V) => a.map((v) => v / Math.hypot(...a));
const flush = (frames = 3) => Z.ZhudaEngine.flushRenderFrames(frames);
const round = (v: number, places = 3) => +v.toFixed(places);
const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
const shot = (name?: string) => {
  flush(3);
  if (name) keep(name);
  return read();
};
/** How two pictures differ: the mean of a channel (0..255) and the share of pixels more than 12 apart. */
function compare(a: Uint8ClampedArray, b: Uint8ClampedArray) {
  let sum = 0,
    over = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
    );
    sum += d;
    if (d > 12) over++;
  }
  return { mean: round(sum / (a.length / 4)), over: round(over / (a.length / 4), 4) };
}
/** The share of a picture that is the crates' orange. */
function orange(p: Uint8ClampedArray) {
  let count = 0;
  for (let i = 0; i < p.length; i += 4) if (p[i] - p[i + 2] > 70 && p[i] > 120) count++;
  return round(count / (p.length / 4), 4);
}

const EYE = [0, 6, 9],
  LOOK = [0, 0.4, 0],
  FOV = 40;
const forward = unit(sub(LOOK, EYE)),
  right = unit(cross(forward, [0, 1, 0])),
  up = cross(right, forward);
function pixel(p: V): [number, number] {
  const d = sub(p, EYE);
  const depth = dot(d, forward),
    h = Math.tan(((FOV / 2) * Math.PI) / 180);
  return [
    Math.floor(((dot(d, right) / (depth * h * (W / H)) + 1) / 2) * W),
    Math.floor(((1 - dot(d, up) / (depth * h)) / 2) * H),
  ];
}
function colourAt(p: Uint8ClampedArray, point: V): V {
  const [cx, cy] = pixel(point);
  const sum = [0, 0, 0];
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let k = 0; k < 3; k++) sum[k] += p[(y * W + x) * 4 + k] / 9;
  return sum.map((v) => round(v, 1));
}

function stage(options: { ambient: number; sun: boolean; floor: boolean }) {
  const a = options.ambient;
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [a, a, a] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: EYE });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0.02, 0.03, 0.06, 1);
  camera.msaa = false;
  camera.fieldOfView = FOV;
  camera.transform.position = v3(EYE);
  camera.transform.lookAt(v3(LOOK), v3([0, 1, 0]));
  const made: any[] = [];
  if (options.sun) {
    const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
    sun.node.transform.rotationEuler = v3([-55, 35, 0]);
    sun.light.shadowMode = Laya.ShadowMode.Hard;
    sun.light.shadowDistance = 40;
    sun.light.shadowResolution = 2048;
    sun.light.shadowStrength = 1;
  }
  if (options.floor) {
    const mesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 18, height: 0.1, depth: 18 });
    made.push(mesh);
    const floor = new Laya.MeshSprite3D(mesh);
    const material = Z.createSurfaceMaterial({
      type: 'pbr',
      color: [0.6, 0.6, 0.6, 1],
      roughness: 0.9,
    });
    made.push(material);
    floor.meshRenderer.sharedMaterial = material;
    floor.meshRenderer.receiveShadow = true;
    floor.meshRenderer.castShadow = false;
    floor.transform.position = v3([0, -0.05, 0]);
    scene.addChild(floor);
  }
  const holder = (at: V = [0, 0, 0], yaw = 0, scale = 1) => {
    const node = new Laya.Sprite3D('holder');
    scene.addChild(node);
    node.transform.position = v3(at);
    node.transform.rotationEuler = v3([0, yaw, 0]);
    node.transform.localScale = v3([scale, scale, scale]);
    return node;
  };
  return {
    scene,
    camera,
    holder,
    end() {
      scene.destroy(true);
      for (const thing of made.splice(0).reverse()) thing.destroy?.();
      flush(2);
    },
  };
}

const hidden = () => Laya.RenderBitFlag?.RenderBitFlag_Editor;
const find = (root: any, name: string): any => {
  if (root.name === name) return root;
  for (let i = 0; i < root.numChildren; i++) {
    const found = find(root.getChildAt(i), name);
    if (found) return found;
  }
  return null;
};
/**
 * The same crates one node at a time: under the node the file draws as
 * copies, a child for each copy, and the node's own draw switched off.
 */
function byHand(root: any, yard: any) {
  const node = find(root, 'Crates');
  const renderer = node.getComponent(Laya.MeshRenderer),
    mesh = node.getComponent(Laya.MeshFilter).sharedMesh;
  renderer.setRenderbitFlag(hidden(), true);
  for (const copy of yard.copies) {
    const child = new Laya.MeshSprite3D(mesh);
    child.meshRenderer.sharedMaterials = renderer.sharedMaterials;
    child.meshRenderer.castShadow = true;
    child.meshRenderer.receiveShadow = true;
    node.addChild(child);
    child.transform.localPosition = v3(copy.translation);
    child.transform.localRotation = new Laya.Quaternion(...copy.rotation);
    child.transform.localScale = v3(copy.scale);
  }
}

// --- 1. A mesh the file draws many times ---------------------------------------------
async function copies() {
  const provider = new Z.DirectoryAssetProvider({ baseUrl: './assets/' });
  const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
  const yard = await (await fetch('./assets/yard.json')).json();
  const s = stage({ ambient: 0.3, sun: true, floor: true });
  const result: any = {};
  const empty = shot();
  const spots: [V, number, number][] = [
    [[-2.2, 0, 0.5], 0, 0.8],
    [[2.4, 0, -1], 90, 0.7],
  ];
  const placements = spots.map(([at, yaw, scale]) => [at[0], at[1], at[2], yaw, scale]);

  // The pictures to match: the crates put there one node at a time.
  const reference = async (holders: any[], name?: string) => {
    const instances = [];
    for (const holder of holders) {
      const instance = await library.instantiate('yard.glb');
      holder.addChild(instance.node);
      byHand(instance.node, yard);
      instances.push(instance);
    }
    const picture = shot(name);
    for (const instance of instances) {
      instance.node.removeSelf();
      instance.dispose();
    }
    for (const holder of holders) holder.destroy();
    return picture;
  };
  const handOnce = await reference([s.holder()], 'copies-by-hand');
  const handMoved = await reference([s.holder([1.2, 0, -1.5], 40)]);
  const handPlaced = await reference(spots.map(([at, yaw, scale]) => s.holder(at, yaw, scale)));
  result.byHand = { orange: orange(handOnce), againstEmpty: compare(handOnce, empty) };

  // What LayaAir alone does with the file: the mesh once, where the node is.
  {
    const instance = await library.instantiate('yard.glb');
    const holder = s.holder();
    holder.addChild(instance.node);
    const picture = shot('copies-laya-alone');
    result.layaAlone = { orange: orange(picture), againstByHand: compare(picture, handOnce) };
    result.report = {
      status: instance.compatibility.status,
      codes: instance.compatibility.diagnostics.map((d: any) => d.code),
      extensions: instance.compatibility.extensions,
      nodes: instance.gltfNodes.map((n: any) => [
        n.name,
        n.instancing?.count ?? null,
        n.instances ? n.instances.length / 16 : null,
      ]),
    };
    instance.node.removeSelf();
    instance.dispose();
    holder.destroy();
  }

  // Mounted once, then the holder moved: the copies go with it.
  {
    const instance = await library.instantiate('yard.glb');
    const holder = s.holder();
    const mounted = Z.mountZhudaModel(holder, instance);
    const node = find(instance.node, 'Crates');
    const once = shot('copies-mounted');
    result.once = {
      orange: orange(once),
      againstByHand: compare(once, handOnce),
      groups: Array.from({ length: node.numChildren }, (_, i) => node.getChildAt(i).name),
      renderers: mounted.renderers.length,
    };
    holder.transform.position = v3([1.2, 0, -1.5]);
    holder.transform.rotationEuler = v3([0, 40, 0]);
    const moved = shot('copies-moved');
    result.moved = {
      againstByHand: compare(moved, handMoved),
      againstBefore: compare(moved, once),
    };
    mounted.dispose();
    // Unmounted, the model is LayaAir's again: the node draws its mesh once.
    holder.transform.position = v3([0, 0, 0]);
    holder.transform.rotationEuler = v3([0, 0, 0]);
    holder.addChild(instance.node);
    const after = shot();
    result.unmounted = { orange: orange(after), children: node.numChildren };
    instance.node.removeSelf();
    instance.dispose();
    holder.destroy();
  }

  // With a distance beyond which it is not drawn: the node's own draw stays off when shown.
  {
    const instance = await library.instantiate('yard.glb');
    const holder = s.holder();
    const far = Z.mountZhudaModel(holder, instance, { cullMeters: 100 });
    far.lod.update(EYE);
    const shown = shot();
    far.dispose();
    const near = Z.mountZhudaModel(holder, instance, { cullMeters: 1 });
    near.lod.update(EYE);
    const culled = shot();
    result.cull = {
      shown: compare(shown, handOnce),
      culledOrange: orange(culled),
    };
    near.dispose();
    instance.dispose();
    holder.destroy();
  }

  // Two copies of the model, each a clone with its own copies; then the same drawn instanced.
  {
    const instance = await library.instantiate('yard.glb');
    const holder = s.holder();
    const mounted = Z.mountZhudaModel(holder, instance, { placements });
    const placed = shot('copies-placed');
    result.placed = { againstByHand: compare(placed, handPlaced), orange: orange(placed) };
    mounted.dispose();
    instance.dispose();
    const other = await library.instantiate('yard.glb');
    const drawn = Z.mountZhudaModel(holder, other, { placements, instanced: true });
    const together = shot('copies-instanced');
    result.instanced = {
      againstByHand: compare(together, handPlaced),
      stats: drawn.instanced,
    };
    // Levels are not offered for such a model drawn this way: said, not drawn wrongly.
    drawn.dispose();
    try {
      Z.mountZhudaModel(holder, other, { placements, instanced: true, cullMeters: 50 });
      result.instanced.levels = 'mounted';
    } catch (error: any) {
      result.instanced.levels = String(error.message);
    }
    other.dispose();
    holder.destroy();
  }

  // The turns as normalized shorts; a copy turned inside out.
  {
    const short = await library.instantiate('yard-short.glb');
    const holder = s.holder();
    const mounted = Z.mountZhudaModel(holder, short);
    result.shorts = { againstByHand: compare(shot(), handOnce) };
    mounted.dispose();
    short.dispose();
    const mirror = await library.instantiate('yard-mirror.glb');
    const turned = Z.mountZhudaModel(holder, mirror);
    const picture = shot('copies-one-left-out');
    result.mirror = {
      status: mirror.compatibility.status,
      codes: mirror.compatibility.diagnostics.map((d: any) => d.code),
      copies: mirror.gltfNodes.find((n: any) => n.instances).instances.length / 16,
      againstByHand: compare(picture, handOnce),
      orange: orange(picture),
    };
    turned.dispose();
    mirror.dispose();
    holder.destroy();
  }

  // An instanced mesh by itself: its copies stay where they were drawn first, or follow.
  {
    const instance = await library.instantiate('yard.glb');
    const node = find(instance.node, 'Crates');
    const mesh = node.getComponent(Laya.MeshFilter).sharedMesh,
      materials = node.getComponent(Laya.MeshRenderer).sharedMaterials,
      matrices = instance.gltfNodes.find((n: any) => n.instances).instances;
    result.follow = {};
    for (const follow of [false, true]) {
      const parent = s.holder();
      const made = new Z.ZhudaInstancedMesh(parent, mesh, materials, matrices, { follow });
      const before = shot();
      parent.transform.position = v3([2, 0, -1]);
      const after = shot();
      result.follow[follow ? 'asked' : 'notAsked'] = compare(after, before);
      made.dispose();
      parent.destroy();
    }
    instance.dispose();
  }
  s.end();
  library.dispose();
  return result;
}

// --- 2. Occlusion and emission by the second set of texture coordinates --------------
async function secondSet() {
  const provider = new Z.DirectoryAssetProvider({ baseUrl: './assets/' });
  const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
  // The room's light alone: occlusion takes it away, emission adds its own.
  const s = stage({ ambient: 0.9, sun: false, floor: false });
  const quarters: Record<string, V> = {
    leftFar: [-0.5, 0, -0.5],
    rightFar: [0.5, 0, -0.5],
    leftNear: [-0.5, 0, 0.5],
    rightNear: [0.5, 0, 0.5],
  };
  const result: any = { status: Z.zhudaSecondUvStatus() };
  // A plain model as two clones, mount and model let go of in one go: LayaAir
  // would destroy the clones' renderers a frame later, after the library has
  // destroyed the model, and what they still held would stay for good.
  {
    const start = held();
    const instance = await library.instantiate('plate-first.glb');
    const holder = s.holder();
    const mounted = Z.mountZhudaModel(holder, instance, {
      placements: [
        [-1, 0, 0, 0, 1],
        [1, 0, 0, 0, 1],
      ],
    });
    flush(2);
    const loaded = held() - start;
    mounted.dispose();
    instance.dispose();
    holder.destroy();
    result.clones = { loaded, left: held() - start };
  }
  for (const name of ['plate-first', 'plate-second']) {
    const instance = await library.instantiate(`${name}.glb`);
    const holder = s.holder();
    const mounted = Z.mountZhudaModel(holder, instance, { castShadow: false });
    const p = shot(name);
    result[name] = {
      status: instance.compatibility.status,
      codes: instance.compatibility.diagnostics.map((d: any) => d.code),
      quarters: Object.fromEntries(
        Object.entries(quarters).map(([key, at]) => [key, colourAt(p, at)]),
      ),
    };
    mounted.dispose();
    instance.dispose();
    holder.destroy();
  }
  s.end();
  library.dispose();
  return result;
}

// --- 3. Meshopt decoded in workers ---------------------------------------------------
async function workers() {
  const bytes = new Uint8Array(await (await fetch('./assets/ring-meshopt.glb')).arrayBuffer());
  // Counted as the decoder library makes and stops them.
  const Original = (globalThis as any).Worker;
  const counted = { made: 0, stopped: 0 };
  (globalThis as any).Worker = class extends Original {
    constructor(...args: any[]) {
      super(...args);
      counted.made++;
    }
    postMessage(data: any, ...rest: any[]) {
      if (data && !data.id) counted.stopped++;
      return super.postMessage(data, ...rest);
    }
  };
  const result: any = {};
  try {
    const decode = async (decoder: any) => {
      let best = Infinity,
        data: Uint8Array | null = null;
      for (let i = 0; i < 5; i++) {
        const start = performance.now();
        const decoded = await decoder.decode({
          assetId: 'ring-meshopt.glb',
          bytes,
          signal: new AbortController().signal,
          maxOutputBytes: 64 * 1024 * 1024,
        });
        best = Math.min(best, performance.now() - start);
        data = decoded.data;
        decoded.release();
      }
      return { ms: round(best, 2), data: data! };
    };
    const plain = new Z.ZhudaMeshoptModelDecoder();
    const here = await decode(plain);
    const threaded = new Z.ZhudaMeshoptModelDecoder({ workers: 2 });
    result.asked = { workers: threaded.workers, unavailable: threaded.workersUnavailable };
    result.made = counted.made;
    const there = await decode(threaded);
    let different = here.data.length === there.data.length ? 0 : -1;
    if (!different)
      for (let i = 0; i < here.data.length; i++) if (here.data[i] !== there.data[i]) different++;
    result.bytes = { compressed: bytes.length, decoded: here.data.length, different };
    result.ms = { callingThread: here.ms, workers: there.ms };
    // The decoded file is one the model library takes: the ring is drawn from it.
    const decoders = new Z.ZhudaModelDecoderRegistry();
    decoders.register(threaded);
    const provider = new Z.DirectoryAssetProvider({ baseUrl: './assets/' });
    const library = new Z.ZhudaModelLibrary({ provider, decoders, maxIdle: 0 });
    const s = stage({ ambient: 0.6, sun: true, floor: false });
    const emptyPicture = shot();
    const instance = await library.instantiate('ring-meshopt.glb');
    const holder = s.holder([0, 1, 0]);
    holder.transform.localScale = v3([3, 3, 3]);
    const mounted = Z.mountZhudaModel(holder, instance);
    result.drawn = compare(shot('ring-from-workers'), emptyPicture);
    result.report = instance.compatibility.diagnostics.map((d: any) => d.code);
    mounted.dispose();
    instance.dispose();
    s.end();
    library.dispose();
    decoders.dispose();
    plain.dispose();
    threaded.dispose();
    result.afterDispose = { workers: threaded.workers, stopped: counted.stopped };
  } finally {
    (globalThis as any).Worker = Original;
  }
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
  // LayaAir keeps a sun's shadow map once it has made one: made before anything is counted.
  const warm = stage({ ambient: 0.2, sun: true, floor: true });
  flush(2);
  warm.end();
  const only = new URLSearchParams(location.search).get('only');
  const parts: Record<string, () => Promise<any>> = { copies, secondSet, workers };
  out.left = {};
  for (const [name, part] of Object.entries(parts)) {
    if (only && only !== name) continue;
    const before = held();
    out[name] = await part();
    out.left[name] = held() - before;
  }
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
