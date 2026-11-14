// Real-draw fixture for scripts/verify-dither.mjs: a ramp of ten steps of
// eight bits across the view, drawn straight to the canvas and through an
// HDR chain, without dither and with it; and a lit surface, for the
// programs LayaAir registers itself.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__DITHER__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 512,
  H = 128,
  // The ramp fills the upper three quarters; the rest of the wall is black.
  RAMP = 96;
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
/** Kept eight times as bright, so that ten steps of eight bits can be seen. */
const keep = (name: string) => {
  const p = read();
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const image = canvas.getContext('2d')!.createImageData(W, H);
  for (let i = 0; i < p.length; i += 4) {
    for (let k = 0; k < 3; k++) image.data[i + k] = Math.min(255, (p[i + k] - 16) * 14);
    image.data[i + 3] = 255;
  }
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  saved[name] = canvas.toDataURL('image/png');
};
out.picture = (name: string) => saved[name];
out.pictures = () => Object.keys(saved);

const v3 = (a: number[]) => new Laya.Vector3(a[0], a[1], a[2]);
const flush = (frames = 3) => Z.ZhudaEngine.flushRenderFrames(frames);
const round = (v: number, places = 4) => +v.toFixed(places);
const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);

/** The green of every pixel, a row after a row. */
const greens = (p: Uint8ClampedArray) => {
  const g = new Float64Array(W * H);
  for (let i = 0; i < g.length; i++) g[i] = p[i * 4 + 1];
  return g;
};
/** The mean of each column of the ramp. */
function columns(g: Float64Array) {
  const means = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    for (let y = 0; y < RAMP; y++) means[x] += g[y * W + x];
    means[x] /= RAMP;
  }
  return means;
}
/** The ramp as it was meant: the dithered picture's columns, smoothed over 33 of them. */
function meant(g: Float64Array) {
  const means = columns(g),
    smooth = new Float64Array(W);
  for (let x = 0; x < W; x++) {
    let sum = 0,
      count = 0;
    for (let k = Math.max(0, x - 16); k <= Math.min(W - 1, x + 16); k++) {
      sum += means[k];
      count++;
    }
    smooth[x] = sum / count;
  }
  return smooth;
}
/** How far a picture's ramp is from what was meant: a pixel, and a block of eight by eight. */
function against(g: Float64Array, smooth: Float64Array) {
  let pixels = 0,
    blocks = 0,
    count = 0;
  const levels = new Set<number>();
  // The ends are left out: there the smoothing has less to go on.
  for (let y = 0; y < RAMP; y++)
    for (let x = 32; x < W - 32; x++) {
      pixels += Math.abs(g[y * W + x] - smooth[x]);
      levels.add(g[y * W + x]);
    }
  for (let by = 0; by < RAMP; by += 8)
    for (let bx = 32; bx < W - 32; bx += 8) {
      let sum = 0,
        want = 0;
      for (let y = by; y < by + 8; y++)
        for (let x = bx; x < bx + 8; x++) {
          sum += g[y * W + x];
          want += smooth[x];
        }
      blocks += Math.abs(sum - want) / 64;
      count++;
    }
  return {
    pixel: round(pixels / (RAMP * (W - 64))),
    block: round(blocks / count),
    levels: levels.size,
  };
}
/** The brightest pixel of the black part of the wall. */
function black(g: Float64Array) {
  let most = 0;
  for (let y = RAMP + 4; y < H; y++)
    for (let x = 0; x < W; x++) most = Math.max(most, g[y * W + x]);
  return most;
}
/** Two pictures: the mean of each, the most a pixel differs, and how many pixels differ. */
function apart(a: Float64Array, b: Float64Array) {
  let most = 0,
    changed = 0,
    meanA = 0,
    meanB = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Math.abs(a[i] - b[i]);
    most = Math.max(most, d);
    if (d) changed++;
    meanA += a[i];
    meanB += b[i];
  }
  return {
    most,
    changed: round(changed / a.length),
    meanShift: round((meanB - meanA) / a.length),
  };
}

function ramp(pipeline: boolean) {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0, 0, 0] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 5] });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0, 0, 0, 1);
  camera.msaa = false;
  camera.orthographic = true;
  camera.orthographicVerticalSize = 2;
  camera.transform.position = v3([0, 0, 5]);
  camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  // Ten steps of eight bits across the view (which is eight units wide), as light.
  const material = new Z.ZhudaShaderMaterial({
    schemaVersion: 1,
    name: 'ZhudaFixtureRamp',
    dimension: 3,
    uniforms: {},
    fog: false,
    surface:
      'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){float d=mix(20.0,30.0,(p.x+4.0)/8.0)/255.0;return vec4(vec3(p.y<-0.5?0.0:pow(d,2.2)),1.0);}',
  });
  const mesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 10, height: 4, depth: 0.1 });
  const wall = new Laya.MeshSprite3D(mesh);
  wall.meshRenderer.sharedMaterial = material.material;
  scene.addChild(wall);
  const chain = pipeline
    ? new Z.ZhudaFilmicPipeline(camera, {
        toneMapping: 'none',
        bloom: false,
        ao: false,
        antialias: 'none',
      })
    : null;
  const result: any = {};
  flush(3);
  const plain = greens(read());
  keep(pipeline ? 'chain-plain' : 'direct-plain');
  result.mode = Z.setZhudaDither(scene, true);
  result.said = Z.zhudaDitherMode(scene);
  flush(3);
  const dithered = greens(read());
  keep(pipeline ? 'chain-dithered' : 'direct-dithered');
  const smooth = meant(dithered);
  result.ramp = { from: round(smooth[32], 2), to: round(smooth[W - 33], 2) };
  result.plain = against(plain, smooth);
  result.dithered = against(dithered, smooth);
  result.apart = apart(plain, dithered);
  result.black = { plain: black(plain), dithered: black(dithered) };
  flush(2);
  result.again = apart(dithered, greens(read()));
  // The grain is the arithmetic's: a pixel that went up or down did so as in JavaScript.
  let agree = 0,
    moved = 0;
  for (let y = 0; y < RAMP; y++)
    for (let x = 0; x < W; x++) {
      const d = dithered[y * W + x] - plain[y * W + x];
      if (!d) continue;
      moved++;
      // The picture is read here from the top; a backend may count its rows from the bottom.
      const noise = Z.zhudaDitherNoise(x + 0.5, H - 1 - y + 0.5),
        other = Z.zhudaDitherNoise(x + 0.5, y + 0.5);
      if (Math.sign(noise) === Math.sign(d) || Math.sign(other) === Math.sign(d)) agree++;
    }
  result.sameSign = round(agree / Math.max(1, moved));
  // The other place does nothing for this camera, or less.
  const elsewhere = Z.setZhudaDither(scene, pipeline ? 'materials' : 'screen');
  flush(3);
  result.otherPlace = { mode: elsewhere, ...against(greens(read()), smooth) };
  Z.setZhudaDither(scene, false);
  flush(3);
  result.offAgain = apart(plain, greens(read()));
  chain?.dispose();
  flush(2);
  scene.destroy(true);
  material.dispose?.();
  mesh.destroy();
  flush(3);
  return result;
}

/** A sphere lit by a lamp from the side: the soft fall of light LayaAir's own PBR program draws. */
function lit() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.02, 0.02, 0.02] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 5] });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0, 0, 0, 1);
  camera.msaa = false;
  camera.fieldOfView = 30;
  camera.transform.position = v3([0, 0, 5]);
  camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 0.15 });
  sun.node.transform.rotationEuler = v3([-20, 70, 0]);
  const mesh = Z.Zhuda3D.createPrimitiveMesh('sphere', { radius: 2.4 });
  const material = Z.createSurfaceMaterial({
    type: 'pbr',
    color: [0.7, 0.7, 0.7, 1],
    roughness: 1,
  });
  const ball = new Laya.MeshSprite3D(mesh);
  ball.meshRenderer.sharedMaterial = material;
  scene.addChild(ball);
  flush(3);
  const plain = greens(read());
  Z.setZhudaDither(scene, true);
  flush(3);
  const dithered = greens(read());
  const result = { apart: apart(plain, dithered) };
  scene.destroy(true);
  material.destroy();
  mesh.destroy();
  flush(2);
  return result;
}

/** A game's look with `grade.dither`: switched on with the look, in place, and off with it. */
function look() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0, 0, 0] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 1, 5] });
  const mesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 20, height: 0.1, depth: 20 });
  const material = Z.createSurfaceMaterial({
    type: 'pbr',
    color: [0.5, 0.5, 0.5, 1],
    roughness: 1,
  });
  const floor = new Laya.MeshSprite3D(mesh);
  floor.meshRenderer.sharedMaterial = material;
  scene.addChild(floor);
  const night = (dither: boolean) => ({ preset: 'night', grade: { dither } });
  const applied = new Z.ZhudaSceneLook(scene, camera, night(true));
  flush(3);
  const result: any = { built: Z.zhudaDitherMode(scene) };
  const plain = greens(read());
  result.switchedOff = [applied.setLook(night(false)), Z.zhudaDitherMode(scene)];
  flush(3);
  result.apart = apart(greens(read()), plain);
  result.switchedOn = [applied.setLook(night(true)), Z.zhudaDitherMode(scene)];
  flush(3);
  result.backAgain = apart(greens(read()), plain);
  applied.dispose();
  result.disposed = Z.zhudaDitherMode(scene);
  // LayaAir hands a camera's pictures back at the next frame, not when the camera goes.
  flush(2);
  scene.destroy(true);
  material.destroy();
  mesh.destroy();
  flush(3);
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
  out.status = Z.zhudaDitherStatus();
  // What LayaAir makes once and keeps (a sun's shadow map, the tables of its
  // chain) is made before anything is counted.
  look();
  out.left = {};
  const parts: Record<string, () => any> = {
    direct: () => ramp(false),
    chain: () => ramp(true),
    lit,
    look,
  };
  for (const [name, part] of Object.entries(parts)) {
    const before = held();
    out[name] = part();
    out.left[name] = held() - before;
  }
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
