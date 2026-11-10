// Real-draw fixture for scripts/verify-procedural-draw.mjs. Runtime functions
// come from the browser SDK global (Zhuda); only neutral starter data is bundled.
import {
  ZHUDA_STARTER_TEXTURES,
  ZHUDA_STARTER_PROPS,
} from '../../packages/demo/ProceduralStarter.ts';

const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__PROC__ = out;

async function main() {
  const params = new URLSearchParams(location.search);
  const view = params.get('view') || 'yard';
  const context = await Z.ZhudaEngine.boot({
    renderer: 'webgl',
    container: document.querySelector('#view'),
    width: 960,
    height: 600,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
    preserveDrawingBuffer: true,
  });
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.25, 0.25, 0.28, 1] });
  const light = Z.Zhuda3D.createDirectionalLight(scene, {
    rotationEuler: [-40, -50, 0],
    intensity: 1.2,
  });
  const materials = new Map<string, any>();
  const timings: Record<string, number> = {};
  const materialFor = (name: string, recipe = ZHUDA_STARTER_TEXTURES[name]) => {
    if (!materials.has(name)) {
      const t0 = performance.now();
      const set = Z.bakeZhudaTextureSet(recipe, { size: 512 });
      timings[name] = Math.round(performance.now() - t0);
      materials.set(name, Z.createZhudaProceduralMaterial(set));
    }
    return materials.get(name).material;
  };

  if (view === 'yard') {
    Z.Zhuda3D.createCamera(scene, {
      position: [9, 5.5, 12],
      rotationEuler: [-18, 35, 0],
      clearColor: [0.55, 0.65, 0.78, 1],
    });
    const props = new Z.ZhudaPropRegistry();
    for (const definition of ZHUDA_STARTER_PROPS) props.register(definition);
    const placed = [
      props.place('container20', { position: [0, 0, 0], seed: 1 }),
      props.place('container20', { position: [0, 2.6, 0], seed: 2 }),
      props.place('container20', { position: [0, 0, 3], yawDeg: 180, seed: 3 }),
      props.place('pallet', { position: [5, 0, 1], yawDeg: 30 }),
      props.place('pallet', { position: [5.3, 0.15, 1.1], yawDeg: 20 }),
      props.place('jersey-barrier', { position: [2, 0, 6.5], yawDeg: 0 }),
      props.place('jersey-barrier', { position: [6, 0, 6.2], yawDeg: 15 }),
    ];
    const batches = Z.mergeZhudaPlacedProps(placed);
    const yard = Z.instantiateZhudaPropBatches(batches, (n: string) => materialFor(n), scene);
    const groundData = Z.createZhudaBoxMesh({
      width: 40,
      height: 0.1,
      depth: 40,
      origin: 'bottom',
    });
    const ground = new Z.ZhudaDynamicMesh(
      { ...groundData, tangents: Z.computeMeshTangents(groundData) },
      scene,
    );
    ground.node.transform.localPositionY = -0.1;
    ground.node.meshRenderer.sharedMaterial = materialFor('asphalt');
    out.placed = placed.length;
    out.batches = batches.map((b: any) => ({ material: b.material, meshes: b.meshes.length }));
    out.meshes = yard.meshes.length + 1;
  } else {
    // Normal-direction check: a flat normal-mapped panel (left) next to real
    // geometry carrying the same relief (right), under the same light. If the
    // normal map is decoded correctly the two shading profiles correlate.
    const axis = view === 'relief-v' ? 'v' : 'u';
    const H = 0.15;
    const recipe = {
      schemaVersion: 1,
      id: 'relief-' + axis,
      tileMeters: [1, 1],
      seed: 3,
      base: { color: [0.6, 0.6, 0.6], roughness: 0.7, metallic: 0 },
      layers: [{ name: 'ribs', mask: { type: 'stripes', axis, count: 1 }, heightMm: H * 1000 }],
    };
    out.lightEuler = axis === 'u' ? [0, -70, 0] : [-70, 0, 0];
    light.node.transform.localRotationEuler = new Laya.Vector3(...out.lightEuler);
    Z.Zhuda3D.createCamera(scene, {
      position: [0, 0, 5],
      rotationEuler: [0, 0, 0],
      clearColor: [0.1, 0.1, 0.12, 1],
    });
    const flatData = Z.transformZhudaMesh(
      Z.createZhudaBoxMesh({ width: 2, height: 2, depth: 0.02 }),
      { position: [-1.15, 0, 0] },
    );
    const panel = new Z.ZhudaDynamicMesh(
      { ...flatData, tangents: Z.computeMeshTangents(flatData) },
      scene,
    );
    const mat = materialFor(recipe.id, recipe);
    if (params.get('nonormal')) mat.normalTexture = null;
    panel.node.meshRenderer.sharedMaterial = mat;
    // Geometry: same h(u) = H(0.5 - 0.5 cos 2πu) with u = x + 1 (or v = y + 1).
    const N = 128,
      pos: number[] = [],
      nor: number[] = [],
      uv: number[] = [],
      idx: number[] = [];
    for (let j = 0; j <= N; j++)
      for (let i = 0; i <= N; i++) {
        const x = -1 + (2 * i) / N,
          y = -1 + (2 * j) / N,
          t = axis === 'u' ? x + 1 : y + 1;
        const h = H * (0.5 - 0.5 * Math.cos(2 * Math.PI * t)),
          d = H * Math.PI * Math.sin(2 * Math.PI * t);
        pos.push(x + 1.15, y, h);
        const n = axis === 'u' ? [-d, 0, 1] : [0, -d, 1],
          l = Math.hypot(...n);
        nor.push(n[0] / l, n[1] / l, n[2] / l);
        uv.push(x + 1, y + 1);
      }
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i,
          b2 = a + 1,
          c = a + N + 1,
          d2 = c + 1;
        idx.push(a, d2, b2, a, c, d2);
      }
    const geo = {
      positions: new Float32Array(pos),
      normals: new Float32Array(nor),
      uvs: new Float32Array(uv),
      indices: new Uint16Array(idx),
    };
    const reference = new Z.ZhudaDynamicMesh(geo, scene);
    reference.node.meshRenderer.sharedMaterial = Z.Zhuda3D.createMaterial({
      type: 'pbr',
      color: [0.6, 0.6, 0.6, 1],
      metallic: 0,
      roughness: 0.7,
    });
  }

  context.runtime.start(() => {});
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  Z.ZhudaEngine.flushRenderFrames(6);
  out.bakeMs = timings;
  const tex = [...materials.values()][0]?.textures?.[0];
  out.mipmap = tex ? { mipmap: tex.mipmap, mipmapCount: tex.mipmapCount, width: tex.width } : null;
  out.drawCalls = Laya.Stat?.drawCall ?? null;
  out.ready = true;
}
main().catch((e) => {
  out.error = String(e?.stack || e);
});
