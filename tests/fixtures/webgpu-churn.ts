// Churn fixture for scripts/verify-webgpu-churn.mjs (MEM-01 of
// docs/plans/records/windows-acceptance/plan.md): content made, drawn for
// one frame and destroyed, many times over, on one running engine. The
// check counts what is still alive between blocks of cycles.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__CHURN__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

let context: any;
const frame = () => new Promise<void>((resolve) => Laya.timer.frameOnce(1, null, resolve));

/** A panel of 2D content: graphics, an image-less sprite tree and text. */
function make2d(i: number) {
  const panel = new Laya.Sprite();
  panel.pos(20 + (i % 7) * 10, 20 + (i % 5) * 10);
  panel.graphics.drawRect(0, 0, 160, 90, ['#3a6ea5', '#a5563a', '#4f8a3a'][i % 3]);
  panel.graphics.drawCircle(130, 45, 18, '#f0d060');
  const label = new Laya.Text();
  label.text = 'cycle ' + i;
  label.fontSize = 16;
  label.color = '#ffffff';
  label.pos(10, 10);
  panel.addChild(label);
  context.rootScene.addChild(panel);
  return () => panel.destroy(true);
}

/** A small 3D scene: camera, light, a lit box and an unlit sphere, each with its own material. */
function make3d(i: number) {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.4, 0.4, 0.45, 1] });
  Z.Zhuda3D.createCamera(scene, { position: [0, 1, 5], clearColor: [0.1, 0.12, 0.16, 1] });
  Z.Zhuda3D.createDirectionalLight(scene, { rotationEuler: [-40, -30, 0], intensity: 1 });
  const tree = Z.Zhuda3D.buildPrefabTree({
    materials: {
      lit: { type: 'pbr', albedoColor: [0.3 + (i % 3) * 0.2, 0.5, 0.4, 1] },
      flat: { type: 'unlit', albedoColor: [0.9, 0.7, 0.2, 1] },
    },
    root: {
      name: 'Root',
      children: [
        { name: 'Box', mesh: { type: 'box' }, material: 'lit', localPosition: [-0.8, 0, 0] },
        { name: 'Ball', mesh: { type: 'sphere' }, material: 'flat', localPosition: [0.8, 0, 0] },
      ],
    },
  });
  scene.addChild(tree.root);
  return () => {
    tree.dispose();
    scene.destroy(true);
  };
}

let batchScene: any = null;
/**
 * In one scene that stays: three boxes with a mesh and a material of their
 * own each cycle, drawn as one batch on WebGPU. LayaAir keeps a batch mark
 * for every material and mesh it batched; the scene outlives them all.
 */
function makeBatch(i: number) {
  if (!batchScene) {
    batchScene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.4, 0.4, 0.45, 1] });
    Z.Zhuda3D.createCamera(batchScene, { position: [0, 1, 6], clearColor: [0.1, 0.12, 0.16, 1] });
    Z.Zhuda3D.createDirectionalLight(batchScene, { rotationEuler: [-40, -30, 0], intensity: 1 });
  }
  const mesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 0.6, height: 0.6, depth: 0.6 });
  const material = Z.createSurfaceMaterial({
    type: 'pbr',
    color: [0.3 + (i % 3) * 0.2, 0.5, 0.4, 1],
  });
  const boxes = [-1, 0, 1].map((x) => {
    const box = new Laya.MeshSprite3D(mesh);
    box.meshRenderer.sharedMaterial = material;
    box.transform.position = new Laya.Vector3(x, 0, 0);
    batchScene.addChild(box);
    return box;
  });
  return () => {
    boxes.forEach((box) => box.destroy(true));
    material.destroy();
    mesh.destroy();
  };
}

/** `count` cycles of `kind`: make, draw one frame, destroy, draw one frame. */
async function run(kind: '2d' | '3d' | 'batch', count: number) {
  const make = kind === '2d' ? make2d : kind === '3d' ? make3d : makeBatch;
  for (let i = 0; i < count; i++) {
    const destroy = make(out.cycles[kind]++);
    await frame();
    destroy();
    await frame();
  }
  return out.cycles[kind];
}

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: 640,
    height: 360,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
  });
  context.runtime.start(() => {});
  out.cycles = { '2d': 0, '3d': 0, batch: 0 };
  out.run = run;
  out.report = () => context.runtime.renderer?.report?.() ?? null;
  await frame();
  out.ready = true;
}
main().catch((error) => out.errors.push(String(error?.stack || error)));
