// Real-draw fixture for scripts/verify-csg.mjs: meshes made by
// zhuda-laya-engine/csg (bundled here from its source entry, as a game
// bundles the subpath) drawn with ZhudaDynamicMesh through the browser SDK:
// a wall with a door cut through it, seen straight on, and a box with a
// sphere cut out of its corner. Runtime functions come from the SDK global.
import { zhudaCsg } from '../../packages/core/csg/index.ts';

const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__CSG__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 270;
let context: any;
let gl: WebGL2RenderingContext | null = null;
let copy: CanvasRenderingContext2D | null = null;
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
const saved: Record<string, Uint8Array> = {};
out.picture = (name: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const image = canvas.getContext('2d')!.createImageData(W, H);
  image.data.set(saved[name]);
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
};
/** Mean colour over a box in pixels. */
const mean = (p: Uint8Array, x0: number, y0: number, x1: number, y1: number) => {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * W + x) * 4;
      sum[0] += p[i];
      sum[1] += p[i + 1];
      sum[2] += p[i + 2];
      n++;
    }
  return sum.map((v) => +(v / n).toFixed(1));
};
const moved = (mesh: any, at: number[]) => {
  for (let i = 0; i < mesh.positions.length; i += 3)
    for (let k = 0; k < 3; k++) mesh.positions[i + k] += at[k];
  return mesh;
};
const sphere = (r: number) => {
  const rings = 16;
  return Z.createZhudaLatheMesh({
    profile: Array.from({ length: rings + 1 }, (_, i) => {
      const a = -Math.PI / 2 + (Math.PI * i) / rings;
      return [i === 0 || i === rings ? 0 : Math.cos(a) * r, Math.sin(a) * r];
    }),
    segments: 24,
  });
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
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  else {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    copy = canvas.getContext('2d', { willReadFrequently: true });
  }
  context.runtime.start(() => {});
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.35, 0.35, 0.38, 1] });
  // Straight on, an orthographic view: 50 pixels a metre round (0, 1.5, 0).
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 1.5, 8],
    clearColor: [1, 0, 1, 1],
  });
  camera.orthographic = true;
  camera.orthographicVerticalSize = H / 50;
  camera.transform.lookAt(new Laya.Vector3(0, 1.5, 0), new Laya.Vector3(0, 1, 0));
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1.1 });
  sun.node.transform.rotationEuler = new Laya.Vector3(-35, 30, 0);
  const material = Z.Zhuda3D.createMaterial({ type: 'pbr', albedoColor: [0.75, 0.72, 0.68, 1] });
  const pixel = (x: number, y: number): [number, number] => [
    Math.round(W / 2 + x * 50),
    Math.round(H / 2 - (y - 1.5) * 50),
  ];
  const r: any = {};

  // 1. A wall 4 m by 3 m with a door 1 m by 2.1 m, its left edge at x = 0.1.
  const wall = Z.createZhudaBoxMesh({ width: 4, height: 3, depth: 0.3, origin: 'bottom' });
  const door = moved(
    Z.createZhudaBoxMesh({ width: 1, height: 2.1, depth: 1, origin: 'bottom' }),
    [0.6, 0, 0],
  );
  const cut = zhudaCsg(wall, door, 'subtract');
  r.wall = { report: cut.report, groups: cut.groups };
  const wallMesh = new Z.ZhudaDynamicMesh(cut.mesh, scene);
  wallMesh.node.meshRenderer.sharedMaterial = material;
  Z.ZhudaEngine.flushRenderFrames(3);
  let p = (saved.wall = read());
  const [dx0, dy0] = pixel(0.2, 1.9),
    [dx1, dy1] = pixel(1.0, 0.2);
  const [wx0, wy0] = pixel(-1.6, 2.7),
    [wx1, wy1] = pixel(-0.4, 0.3);
  r.wall.door = mean(p, dx0, dy0, dx1, dy1);
  r.wall.solid = mean(p, wx0, wy0, wx1, wy1);
  r.wall.above = mean(p, ...pixel(0.2, 2.9), ...pixel(1.0, 2.3));
  wallMesh.dispose();

  // 2. A box 2 m round with a sphere of 1.2 m cut from its upper right front corner.
  const box = moved(Z.createZhudaBoxMesh({ width: 2, height: 2, depth: 2 }), [0, 1.5, 0]);
  const ball = moved(sphere(1.2), [1, 2.5, 1]);
  const bite = zhudaCsg(box, ball, 'subtract');
  r.box = { report: bite.report, groups: bite.groups };
  const boxMesh = new Z.ZhudaDynamicMesh(bite.mesh, scene);
  boxMesh.node.meshRenderer.sharedMaterial = material;
  camera.orthographic = false;
  camera.fieldOfView = 40;
  camera.transform.position = new Laya.Vector3(4, 4.2, 5);
  camera.transform.lookAt(new Laya.Vector3(0, 1.4, 0), new Laya.Vector3(0, 1, 0));
  Z.ZhudaEngine.flushRenderFrames(3);
  p = saved.box = read();
  // How much of the frame is the box (not the magenta background).
  let covered = 0;
  for (let i = 0; i < p.length; i += 4)
    if (!(p[i] > 200 && p[i + 1] < 60 && p[i + 2] > 200)) covered++;
  r.box.covered = covered;
  boxMesh.dispose();
  material.destroy();
  out.r = r;
  out.backend = { selected: context.renderer.selected, adapter: context.renderer.adapter ?? null };
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
