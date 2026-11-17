// Real-draw fixture for scripts/verify-node-bindings.mjs (issue #8,
// docs/plans/records/webgpu-node-bindings): a render that shares a shader
// variant with one holding the reflection probe block it lacks.
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
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
