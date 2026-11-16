// Real-draw fixture for scripts/verify-foliage.mjs: cut-out leaf cards (a
// glTF with an alpha-masked picture, LayaAir's glTF shader) standing on a pale
// floor in the sun. Near: two cards side by side, the left one marked as
// foliage (wind), the right one not. Far: two cards 70 m away, the left one
// keeping its coverage, the right one not, out to the sides. The page draws on request and
// reads the frame back. Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__FOLIAGE__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 640,
  H = 400;
let context: any;
let gl: WebGL2RenderingContext | null = null;
let copy: CanvasRenderingContext2D | null = null;

/** The frame, top row first on both backends. */
function read(): Uint8Array {
  if (gl) {
    const raw = new Uint8Array(W * H * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return pixels;
  }
  copy!.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy!.getImageData(0, 0, W, H).data.buffer);
}

async function main() {
  context = await Z.ZhudaEngine.boot({
    container: document.getElementById('view'),
    width: W,
    height: H,
    dprCap: 1,
    features: ['core', '3d', 'gltf'],
    bgColor: '#ff00ff',
  });
  const canvas = context.canvas as HTMLCanvasElement;
  gl = canvas.getContext('webgl2');
  if (!gl) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    copy = c.getContext('2d', { willReadFrequently: true });
  }
  out.status = Z.zhudaFoliageStatus();
  out.backend = Z.ZhudaBackend?.backend ?? (gl ? 'webgl' : 'webgpu');
  out.canvas = gl ? 'webgl2' : 'webgpu';
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.5, 0.5, 0.5, 1] });
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 4, 15],
    rotationEuler: [0, 0, 0],
    fov: 50,
    near: 0.1,
    far: 300,
  });
  camera.transform.lookAt(new Laya.Vector3(0, 3.6, 0), new Laya.Vector3(0, 1, 0));
  camera.clearColor = new Laya.Color(1, 0, 1, 1);
  const sunNode = new Laya.Sprite3D('sun');
  const sun = sunNode.addComponent(Laya.DirectionLightCom);
  sun.color = new Laya.Color(1, 1, 1, 1);
  sun.intensity = 1.2;
  sun.shadowMode = Laya.ShadowMode.Hard;
  sun.shadowDistance = 40;
  sun.shadowResolution = 2048;
  sun.shadowCascadesMode = Laya.ShadowCascadesMode.NoCascades;
  scene.addChild(sunNode);
  // Low from the side and behind: the cards throw long shadows toward the camera.
  sunNode.transform.rotationEuler = new Laya.Vector3(-35, 150, 0);
  const pale = new Laya.PBRStandardMaterial();
  pale.albedoColor = new Laya.Color(0.85, 0.85, 0.85, 1);
  const floor = new Laya.MeshSprite3D(Laya.PrimitiveMesh.createPlane(140, 160, 4, 4));
  floor.meshRenderer.sharedMaterial = pale;
  floor.meshRenderer.receiveShadow = true;
  floor.transform.position = new Laya.Vector3(0, 0, -50);
  scene.addChild(floor);

  const load = async (url: string) => {
    const res = await Laya.loader.load(url);
    return res.create();
  };
  // Two models from two files: each mark touches only its own materials.
  const card = (node: any, x: number, z: number, scale = 1) => {
    scene.addChild(node);
    node.transform.position = new Laya.Vector3(x, 0, z);
    node.transform.localScale = new Laya.Vector3(scale, scale, scale);
    const cast = (n: any) => {
      const r = n.getComponent?.(Laya.MeshRenderer);
      if (r) r.castShadow = r.receiveShadow = true;
      for (let i = 0; i < n.numChildren; i++) cast(n.getChildAt(i));
    };
    cast(node);
    return node;
  };
  const windy = card(await load('wind-card.glb'), -2.6, 0);
  card(await load('still-card.glb'), 2.6, 0);
  const keep = card(await load('keep-card.glb'), -42, -70, 1.2);
  card(await load('thin-card.glb'), 42, -70, 1.2);
  const wind = new Z.ZhudaFoliageWind(scene, { direction: [1, 0], strength: 2 });
  out.marks = {
    wind: Z.zhudaMarkFoliage(windy, { wind: true, keepCoverage: false }).materials,
    keep: Z.zhudaMarkFoliage(keep, { wind: false, keepCoverage: true }).materials,
  };
  /** A frame at this many seconds of wind, read back. */
  out.frame = (seconds: number) => {
    wind.update(seconds);
    Z.ZhudaEngine.flushRenderFrames(2);
    return Array.from(read());
  };
  out.size = [W, H];
  out.ready = true;
}
void main().catch((error) => out.errors.push(String(error?.stack || error)));
