// Frame-cost fixture for scripts/measure-water-ripples.mjs: a 1280×720 view
// filled with water over sand, drawn frame after frame with the graphics card
// waited for before and after, with no bodies in the water, one still body
// and four moving ones. Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__RIPPLES__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 1280,
  H = 720;
const EYE: [number, number, number] = [0, 7, 9],
  TARGET: [number, number, number] = [0, 1, -2],
  FOV = 60;

async function main() {
  const context = await Z.ZhudaEngine.boot({
    container: document.getElementById('view'),
    width: W,
    height: H,
    dprCap: 1,
    features: ['core', '3d'],
    bgColor: '#8aa0b8',
  });
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.6, 0.6, 0.6, 1] });
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: EYE,
    rotationEuler: [0, 0, 0],
    fov: FOV,
    near: 0.1,
    far: 300,
  });
  camera.transform.lookAt(new Laya.Vector3(...TARGET), new Laya.Vector3(0, 1, 0));
  // The water reads the scene behind it and how far away that is.
  camera.depthTextureMode |= Laya.DepthTextureMode.Depth;
  camera.opaquePass = true;
  const sun = new Laya.Sprite3D('sun');
  const light = sun.addComponent(Laya.DirectionLightCom);
  light.color = new Laya.Color(1, 0.95, 0.9, 1);
  scene.addChild(sun);
  sun.transform.rotationEuler = new Laya.Vector3(-50, 30, 0);
  const sand = new Laya.BlinnPhongMaterial();
  sand.albedoColor = new Laya.Color(0.75, 0.6, 0.3, 1);
  const bed = new Laya.MeshSprite3D(Laya.PrimitiveMesh.createPlane(120, 120, 4, 4));
  bed.meshRenderer.sharedMaterial = sand;
  scene.addChild(bed);
  const water = new Z.ZhudaWaterSurface(scene, {
    position: [0, 1, 0],
    size: [100, 100],
    flow: [0.3, 0.1],
    color: [0.05, 0.3, 0.32],
    clarity: 1,
    waves: 0.3,
    refraction: 0.6,
    sun: { toward: [0.3994, 0.7689, 0.4993], color: [2, 1.9, 1.8] },
  });
  water.camera.clearFlag = camera.clearFlag;
  water.camera.clearColor = camera.clearColor;
  water.update(EYE, TARGET, FOV, W / H);
  const canvas = context.canvas as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2');
  const settle = async () => {
    const device = (Laya.LayaGL.renderEngine as any).getDevice?.();
    if (device?.queue?.onSubmittedWorkDone) await device.queue.onSubmittedWorkDone();
    else if (gl) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
  };
  let seconds = 0;
  const frame = () => {
    seconds += 1 / 60;
    water.setTime(seconds);
    water.render();
    Z.ZhudaEngine.flushRenderFrames(1);
  };
  /** Milliseconds a frame with these bodies in the water. */
  out.cost = async (sources: any[], frames = 120) => {
    water.setRipples(sources);
    for (let i = 0; i < 20; i++) frame();
    await settle();
    const from = performance.now();
    for (let i = 0; i < frames; i++) frame();
    await settle();
    return (performance.now() - from) / frames;
  };
  out.backend = Z.ZhudaBackend?.backend ?? (gl ? 'webgl' : 'webgpu');
  out.ready = true;
}
void main().catch((error) => {
  out.errors.push(String(error?.stack || error));
});
