// Real-draw fixture for scripts/verify-node-bindings.mjs: a render that
// shares a shader variant with one holding the reflection probe block it
// lacks (issue #8, docs/plans/records/webgpu-node-bindings), and a program
// that does not compile (WP23), and a sun beside a brighter rim light (WP22;
// both docs/plans/records/engine-defects).
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__NODE_BINDINGS__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 480,
  H = 270;
let context: any;
const frames = (n: number) =>
  new Promise<void>((done) => {
    let k = 0;
    const step = () => (++k >= n ? done() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
/** GPU errors arrive after the frame that made them. */
const settle = async () => {
  await frames(20);
  await new Promise((resolve) => setTimeout(resolve, 300));
};
/** The frame as drawn now: a WebGPU canvas is read in the task that drew it. */
function read() {
  Z.ZhudaEngine.flushRenderFrames(1);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const copy = canvas.getContext('2d', { willReadFrequently: true })!;
  copy.drawImage(context.canvas, 0, 0, W, H);
  return copy.getImageData(0, 0, W, H).data;
}
/** Mean luminance of a box of the frame. */
function mean(p: Uint8ClampedArray, x0: number, x1: number, y0: number, y1: number) {
  let sum = 0,
    n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      sum += 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
      n++;
    }
  return +(sum / n).toFixed(2);
}
const newErrors = (since: number) => context.renderer.errors.slice(since);

async function probeCase() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.3, 0.3, 0.3] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 6] });
  camera.transform.lookAt(new Laya.Vector3(0, 0, 0), new Laya.Vector3(0, 1, 0));
  Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
  const mesh = Z.Zhuda3D.createPrimitiveMesh('sphere', { radius: 1 });
  const materials: any[] = [];
  const make = (x: number) => {
    const sphere = new Laya.MeshSprite3D(mesh);
    const material = Z.createSurfaceMaterial({
      type: 'physical',
      color: [0.8, 0.5, 0.3, 1],
      roughness: 0.4,
      metallic: 0.5,
    });
    materials.push(material);
    sphere.meshRenderer.sharedMaterial = material;
    sphere.transform.position = new Laya.Vector3(x, 0, 0);
    scene.addChild(sphere);
    return sphere;
  };
  make(-1.6);
  const b = make(1.6);
  const errorsBefore = context.renderer.errors.length;
  await settle();
  const right = () => mean(read(), W / 2 + 40, W - 40, H / 2 - 40, H / 2 + 40);
  const withProbe = right();
  const fillsBefore = Z.zhudaReflectionProbeFills();
  // Issue #8: the same material and defines, its probe taken away.
  b.meshRenderer.reflectionMode = 0;
  b.meshRenderer.probReflection = null;
  await settle();
  const result = {
    withProbe,
    withoutProbe: right(),
    fills: Z.zhudaReflectionProbeFills() - fillsBefore,
    blocks: b.meshRenderer._renderElements[0]._renderElementOBJ.owner?._additionShaderDataKeys,
    errors: newErrors(errorsBefore).map((e: string) => String(e).slice(0, 200)),
  };
  scene.destroy(true);
  materials.forEach((m) => m.destroy?.());
  mesh.destroy();
  await frames(3);
  return result;
}

/**
 * WP23: a lit surface whose hook does not compile. On WebGPU LayaAir used to
 * throw while making the program and stop the engine's loop; now that
 * program's objects are left undrawn and the rest goes on.
 */
async function brokenProgramCase() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.3, 0.3, 0.3] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 6] });
  camera.transform.lookAt(new Laya.Vector3(0, 0, 0), new Laya.Vector3(0, 1, 0));
  Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
  const mesh = Z.Zhuda3D.createPrimitiveMesh('sphere', { radius: 1 });
  const goodMaterial = Z.createSurfaceMaterial({ type: 'pbr', color: [0.8, 0.5, 0.3, 1] });
  const good = new Laya.MeshSprite3D(mesh);
  good.meshRenderer.sharedMaterial = goodMaterial;
  good.transform.position = new Laya.Vector3(-1.6, 0, 0);
  scene.addChild(good);
  await frames(5);
  const errorsBefore = context.renderer.errors.length;
  const broken = new Z.ZhudaLitSurfaceMaterial({
    name: 'ZhudaCheckBrokenHook',
    surface:
      'void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 p,vec3 n){s.baseColor*=zhudaNoSuchThing;}',
  });
  const bad = new Laya.MeshSprite3D(mesh);
  bad.meshRenderer.sharedMaterial = broken.material;
  bad.transform.position = new Laya.Vector3(1.6, 0, 0);
  scene.addChild(bad);
  let ticks = 0;
  const counter = {};
  Laya.timer.frameLoop(1, counter, () => ticks++);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  Laya.timer.clearAll(counter);
  const result = {
    ticks,
    good: mean(read(), 40, W / 2 - 40, H / 2 - 40, H / 2 + 40),
    errors: newErrors(errorsBefore).map((e: string) => String(e).slice(0, 200)),
  };
  scene.destroy(true);
  broken.dispose();
  goodMaterial.destroy?.();
  mesh.destroy();
  await frames(3);
  return result;
}

/**
 * WP22: a sun that casts shadows beside a brighter directional light that
 * does not (a rim light). LayaAir gave the shadow, and the sky's sun, to the
 * brightest directional light; the sun keeps them now. A shadow is measured
 * as how much of the frame darkens when the sun casts it, against the same
 * frame with the sun's shadow off.
 */
async function shadowLightCase() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.2, 0.2, 0.2] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 7, 9] });
  camera.transform.lookAt(new Laya.Vector3(0, 0, 0), new Laya.Vector3(0, 1, 0));
  const material = Z.createSurfaceMaterial({
    type: 'pbr',
    color: [0.7, 0.7, 0.7, 1],
    roughness: 0.9,
  });
  const floorMesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 14, height: 0.1, depth: 14 });
  const floor = new Laya.MeshSprite3D(floorMesh);
  floor.meshRenderer.sharedMaterial = material;
  floor.meshRenderer.receiveShadow = true;
  floor.meshRenderer.castShadow = false;
  floor.transform.position = new Laya.Vector3(0, -0.05, 0);
  scene.addChild(floor);
  const boxMesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 1.5, height: 1.5, depth: 1.5 });
  const box = new Laya.MeshSprite3D(boxMesh);
  box.meshRenderer.sharedMaterial = material;
  box.meshRenderer.castShadow = true;
  box.transform.position = new Laya.Vector3(0, 1.5, 0);
  scene.addChild(box);
  // The consumer's numbers: a sun at 1.8 with its shadow, a rim at 3.6.
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1.8 });
  sun.node.transform.rotationEuler = new Laya.Vector3(-55, 30, 0);
  sun.light.shadowMode = Laya.ShadowMode.Hard;
  sun.light.shadowDistance = 30;
  sun.light.shadowResolution = 2048;
  sun.light.shadowStrength = 1;
  const luminance = (p: Uint8ClampedArray, i: number) =>
    0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
  /** Mean darkening over the frame by the sun's shadow, and whether the sun is the main light. */
  const measure = async () => {
    await settle();
    const on = read();
    const main = scene._mainDirectionLight === sun.light;
    sun.light.shadowMode = Laya.ShadowMode.None;
    await settle();
    const off = read();
    sun.light.shadowMode = Laya.ShadowMode.Hard;
    let sum = 0;
    for (let i = 0; i < on.length; i += 4) sum += Math.max(0, luminance(off, i) - luminance(on, i));
    return { shadow: +(sum / (W * H)).toFixed(3), main };
  };
  const errorsBefore = context.renderer.errors.length;
  const alone = await measure();
  const rim = Z.Zhuda3D.createDirectionalLight(scene, {
    color: [0.6, 0.7, 1, 1],
    intensity: 3.6,
  });
  rim.node.transform.rotationEuler = new Laya.Vector3(-20, 200, 0);
  rim.light.shadowMode = Laya.ShadowMode.None;
  const withRim = await measure();
  const result = {
    alone,
    withRim,
    errors: newErrors(errorsBefore).map((e: string) => String(e).slice(0, 200)),
  };
  scene.destroy(true);
  material.destroy?.();
  floorMesh.destroy();
  boxMesh.destroy();
  await frames(3);
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
  await frames(3);
  out.probe = await probeCase();
  out.broken = await brokenProgramCase();
  out.shadowLight = await shadowLightCase();
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
