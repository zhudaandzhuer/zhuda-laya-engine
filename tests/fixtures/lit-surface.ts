// Real-draw fixture for scripts/verify-lit-surface.mjs: what a lit surface's
// hook writes beyond its colour. A plate cut in strips by `alpha`, with the
// shadow and the depth it leaves; a plate cut by chance (`alphaHash`) at
// several alphas; a plate whose hook tilts its normal, on a mesh with
// tangents and on one without.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__LIT__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 320,
  H = 240;
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
/** What a pixel of the screen is as light: the screen's curve undone. */
const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);

// The view: where a point of the world is on the screen, from the camera's own numbers.
const EYE = [0, 5, 7],
  LOOK = [0, 0.75, 0],
  FOV = 40;
const forward = unit(sub(LOOK, EYE)),
  right = unit(cross(forward, [0, 1, 0])),
  up = cross(right, forward);
const depthOf = (p: V) => dot(sub(p, EYE), forward);
function pixel(p: V): [number, number] {
  const d = sub(p, EYE);
  const depth = dot(d, forward),
    h = Math.tan(((FOV / 2) * Math.PI) / 180);
  return [
    Math.floor(((dot(d, right) / (depth * h * (W / H)) + 1) / 2) * W),
    Math.floor(((1 - dot(d, up) / (depth * h)) / 2) * H),
  ];
}
/** The mean colour of the three by three pixels round a point of the world. */
function colourAt(p: Uint8ClampedArray, point: V): V {
  const [cx, cy] = pixel(point);
  const sum = [0, 0, 0];
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++)
      for (let k = 0; k < 3; k++) sum[k] += p[(y * W + x) * 4 + k] / 9;
  return sum.map((v) => round(v, 1));
}
const lum = (c: V) => round(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], 1);
const isPlate = (p: Uint8ClampedArray, i: number) => p[i] - p[i + 1] > 60;

/** A flat sheet lying in the ground plane, facing up: u along +x, v along +z. */
function sheet(width: number, depth: number, tangents: boolean) {
  const w = width / 2,
    d = depth / 2;
  const data: any = {
    positions: new Float32Array([-w, 0, -d, w, 0, -d, w, 0, d, -w, 0, d]),
    normals: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint16Array([0, 1, 2, 0, 2, 3]),
  };
  if (tangents) data.tangents = Z.computeMeshTangents(data);
  return data;
}

/** A scene with the camera, a floor and a sun, and what it made, destroyed together. */
function stage(options: { ambient: number; sun: V; shadows: boolean }) {
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
  const own = <T>(thing: T): T => {
    made.push(thing);
    return thing;
  };
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
  sun.node.transform.rotationEuler = v3(options.sun);
  if (options.shadows) {
    sun.light.shadowMode = Laya.ShadowMode.Hard;
    sun.light.shadowDistance = 30;
    sun.light.shadowResolution = 2048;
    sun.light.shadowStrength = 1;
  }
  const floorMesh = own(
    Z.Zhuda3D.createPrimitiveMesh('box', { width: 14, height: 0.1, depth: 14 }),
  );
  const floor = new Laya.MeshSprite3D(floorMesh);
  floor.meshRenderer.sharedMaterial = own(
    Z.createSurfaceMaterial({ type: 'pbr', color: [0.6, 0.6, 0.6, 1], roughness: 0.9 }),
  );
  floor.meshRenderer.receiveShadow = true;
  floor.meshRenderer.castShadow = false;
  floor.transform.position = v3([0, -0.05, 0]);
  scene.addChild(floor);
  /** A sheet at a height, drawn with a lit surface material. */
  const plate = (material: any, at: V, size: V = [4, 2], tangents = true) => {
    const mesh = own(new Z.ZhudaDynamicMesh(sheet(size[0], size[1], tangents), scene));
    mesh.node.meshRenderer.sharedMaterial = material.material;
    mesh.node.meshRenderer.castShadow = true;
    mesh.node.meshRenderer.receiveShadow = false;
    mesh.node.transform.position = v3(at);
    return mesh.node;
  };
  return {
    scene,
    camera,
    sun,
    own,
    plate,
    lit: (spec: any) => {
      const material = new Z.ZhudaLitSurfaceMaterial(spec);
      made.push({ destroy: () => material.dispose() });
      return material;
    },
    end() {
      scene.destroy(true);
      for (const thing of made.splice(0).reverse()) (thing.destroy ?? thing.dispose)?.call(thing);
      flush(2);
    },
  };
}

// A view of what the camera wrote beside its colours: the depth, or the
// depth and normal it keeps for ambient occlusion. Fixture code only.
let viewRegistered = false;
function depthView(camera: any, what: 'depth' | 'normals') {
  if (!viewRegistered) {
    const shader = Laya.Shader3D.add('ZhudaFixtureDepthView');
    shader.shaderType = Laya.ShaderFeatureType.PostProcess;
    const sub = new Laya.SubShader(
      { a_PositionTexcoord: [Laya.VertexMesh.MESH_POSITION0, Laya.ShaderDataType.Vector4] },
      { u_MainTex: Laya.ShaderDataType.Texture2D, u_ZhudaView: Laya.ShaderDataType.Vector4 },
    );
    shader.addSubShader(sub);
    const pass = sub.addShaderPass(
      '#define SHADER_NAME ZhudaFixtureDepthViewVS\nvarying vec2 v_Texcoord0;void main(){gl_Position=vec4(a_PositionTexcoord.xy,0.0,1.0);v_Texcoord0=a_PositionTexcoord.zw;}',
      `#define SHADER_NAME ZhudaFixtureDepthViewFS
precision highp sampler2D;
#include "Camera.glsl";
precision lowp sampler2D;
varying vec2 v_Texcoord0;
void main(){
vec4 kept=texture2D(u_MainTex,v_Texcoord0);
float raw=texture2D(u_CameraDepthTexture,v_Texcoord0).x;
float eye=1.0/(u_ZBufferParams.z*raw+u_ZBufferParams.w);
vec4 both=texture2D(u_CameraDepthNormalsTexture,v_Texcoord0);
// Written so that the screen's curve, applied after this, gives the number back.
// The second picture keeps its depth in two bytes: put back together, and scaled to be seen.
float kept2=dot(both.zw,vec2(1.0,1.0/255.0));
vec3 shown=u_ZhudaView.x<0.5?vec3(clamp(eye/20.0,0.0,1.0)):vec3(both.rg,clamp(kept2*40.0,0.0,1.0));
gl_FragColor=vec4(pow(shown,vec3(2.2)),1.0)+kept*0.0;
}`,
    );
    pass.statefirst = true;
    pass.renderState.cull = Laya.RenderState.CULL_NONE;
    viewRegistered = true;
  }
  const material = new Laya.Material();
  material.setShaderName('ZhudaFixtureDepthView');
  material.setVector4('u_ZhudaView', new Laya.Vector4(what === 'depth' ? 0 : 1, 0, 0, 0));
  const effect = new Laya.MaterialPostProcessEffect();
  effect.material = material;
  const post = new Laya.PostProcess();
  post.addEffect(effect);
  const before = camera.depthTextureMode;
  camera.depthTextureMode |= Laya.DepthTextureMode.Depth | Laya.DepthTextureMode.DepthNormals;
  camera.postProcess = post;
  return () => {
    camera.postProcess = null;
    camera.depthTextureMode = before;
    material.destroy();
  };
}

const RED = 'vec3(0.9,0.1,0.1)';
const head = 'void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 p,vec3 n){';

// --- 1. Cut in strips by the hook's alpha: the picture, the shadow, the depth ------
function strips() {
  const s = stage({ ambient: 0.25, sun: [-90, 0, 0], shadows: true });
  // Strips two metres apart along x: the middle one, a metre wide, is cut away.
  const cut = s.lit({
    name: 'ZhudaFixtureStrips',
    surface: `${head}s.baseColor=${RED};s.alpha=step(0.5,fract(p.x*0.5+0.25));}`,
    material: { blend: 'cutout', doubleSided: true, roughness: 0.9 },
  });
  const whole = s.lit({
    name: 'ZhudaFixtureWhole',
    surface: `${head}s.baseColor=${RED};}`,
    material: { doubleSided: true, roughness: 0.9 },
  });
  const node = s.plate(cut, [0, 1.5, 0]);
  const points = {
    kept: [1, 1.5, 0],
    hole: [0, 1.5, 0],
    underKept: [1, 0, 0],
    underHole: [0, 0, 0],
    aside: [3.5, 0, 0],
  };
  const sample = () => {
    flush(3);
    const p = read();
    return Object.fromEntries(
      Object.entries(points).map(([name, point]) => [name, colourAt(p, point)]),
    );
  };
  const result: any = { cut: sample() };
  keep('strips');
  // What the camera wrote beside the colours.
  for (const what of ['depth', 'normals'] as const) {
    const off = depthView(s.camera, what);
    result[what] = { cut: sample() };
    if (what === 'depth') keep('strips-depth');
    node.meshRenderer.sharedMaterial = whole.material;
    result[what].whole = sample();
    node.meshRenderer.sharedMaterial = cut.material;
    off();
  }
  node.meshRenderer.sharedMaterial = whole.material;
  result.whole = sample();
  // How far the two places on the plate are from the eye, for the depth view.
  result.eyeDepth = {
    kept: round(depthOf(points.kept)),
    hole: round(depthOf(points.hole)),
    // The floor seen through the hole.
    behindHole: round(depthOf([0, 0, 7 - (7 * 5) / 3.5]) * 1),
  };
  s.end();
  return result;
}

// --- 2. Cut by chance: how much is kept, how dark the shadow, and that it stays put --
function chance() {
  const s = stage({ ambient: 0.25, sun: [-90, 0, 0], shadows: true });
  const material = s.lit({
    name: 'ZhudaFixtureChance',
    surface: `${head}s.baseColor=${RED};s.alpha=u_ZhudaAlpha;}`,
    uniforms: { u_ZhudaAlpha: { type: 'float', value: 1 } },
    alphaHash: true,
    material: { doubleSided: true, roughness: 0.9 },
  });
  const node = s.plate(material, [0, 1.5, 0]);
  // The plate's inside on the screen, and the floor under it.
  const corners = [
    pixel([-1.8, 1.5, -0.8]),
    pixel([1.8, 1.5, -0.8]),
    pixel([1.8, 1.5, 0.8]),
    pixel([-1.8, 1.5, 0.8]),
  ];
  const x0 = Math.max(...[corners[0][0], corners[3][0]]),
    x1 = Math.min(...[corners[1][0], corners[2][0]]),
    y0 = corners[0][1],
    y1 = corners[3][1];
  const kept = (p: Uint8ClampedArray) => {
    let count = 0,
      all = 0;
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        all++;
        if (isPlate(p, (y * W + x) * 4)) count++;
      }
    return round(count / all);
  };
  const floor = (p: Uint8ClampedArray) => {
    let sum = 0,
      count = 0;
    for (let z = -0.6; z <= 0.6; z += 0.1)
      for (let x = -1.5; x <= 1.5; x += 0.1) {
        const [px, py] = pixel([x, 0, z]);
        const i = (py * W + px) * 4;
        sum += toLinear(p[i + 1]);
        count++;
      }
    return round(sum / count, 4);
  };
  const result: any = { shares: {}, shadow: {}, pixels: (x1 - x0 + 1) * (y1 - y0 + 1) };
  for (const alpha of [0, 0.1, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.75, 0.8, 0.9, 0.95, 1]) {
    material.set('u_ZhudaAlpha', alpha);
    flush(3);
    const p = read();
    result.shares[alpha] = kept(p);
    result.shadow[alpha] = floor(p);
    if (alpha === 0.5) keep('chance-half');
  }
  // The same frame again is the same picture.
  material.set('u_ZhudaAlpha', 0.5);
  flush(3);
  const first = read();
  flush(2);
  const again = read();
  let changed = 0;
  for (let i = 0; i < first.length; i += 4) if (first[i] !== again[i]) changed++;
  result.changedWhenStill = changed;
  // The pattern stays on the plate: moved sideways by a whole number of
  // pixels of its middle row, that row shows the pattern it showed, moved.
  const row = pixel([0, 1.5, 0])[1],
    perMetre = W / (2 * depthOf([0, 1.5, 0]) * Math.tan(((FOV / 2) * Math.PI) / 180) * (W / H)),
    shift = 6;
  const pattern = (p: Uint8ClampedArray) =>
    Array.from({ length: W }, (_, x) => isPlate(p, (row * W + x) * 4));
  const before = pattern(first);
  node.transform.position = v3([shift / perMetre, 1.5, 0]);
  flush(3);
  const after = pattern(read());
  const from = pixel([-1.5, 1.5, 0])[0],
    to = pixel([1.5, 1.5, 0])[0];
  let same = 0,
    sameUnmoved = 0;
  for (let x = from; x <= to; x++) {
    if (before[x] === after[x + shift]) same++;
    if (before[x] === after[x]) sameUnmoved++;
  }
  result.moved = {
    pixels: shift,
    row: to - from + 1,
    sameWithThePlate: round(same / (to - from + 1)),
    sameOnTheScreen: round(sameUnmoved / (to - from + 1)),
  };
  s.end();
  return result;
}

// --- 3. A normal tilted by the hook, with tangents and without ----------------------
function tilted() {
  // The sun is high and to one side: a tilt toward it brightens, away from it dims.
  const s = stage({ ambient: 0, sun: [-60, 40, 0], shadows: false });
  const matrix = s.sun.node.transform.worldMatrix.elements;
  // From the surface toward the light.
  const toSun = unit([matrix[8], matrix[9], matrix[10]]);
  const material = s.lit({
    name: 'ZhudaFixtureTilt',
    surface: `${head}s.baseColor=vec3(0.8);s.metallic=0.0;s.roughness=1.0;s.normalTS=vec3(u_ZhudaTilt.x,u_ZhudaTilt.y,1.0);}`,
    uniforms: { u_ZhudaTilt: { type: 'vec2', value: [0, 0] } },
    material: { roughness: 1 },
  });
  const plain = s.lit({
    name: 'ZhudaFixturePlain',
    surface: `${head}s.baseColor=vec3(0.8);s.metallic=0.0;s.roughness=1.0;}`,
    material: { roughness: 1 },
  });
  const places = { tangents: [-1.6, 1, 0], bare: [1.6, 1, 0] };
  const nodes = {
    tangents: s.plate(material, places.tangents, [2, 2], true),
    bare: s.plate(material, places.bare, [2, 2], false),
  };
  const tilts: Record<string, V> = {
    flat: [0, 0],
    alongU: [0.6, 0],
    againstU: [-0.6, 0],
    alongV: [0, 0.6],
    againstV: [0, -0.6],
  };
  const result: any = {
    toSun: toSun.map((v) => round(v)),
    light: {},
    normals: {},
  };
  const both = () => {
    flush(3);
    const p = read();
    return Object.fromEntries(
      Object.entries(places).map(([name, at]) => [name, colourAt(p, at)]),
    ) as Record<string, V>;
  };
  for (const [name, tilt] of Object.entries(tilts)) {
    material.set('u_ZhudaTilt', tilt);
    const seen = both();
    result.light[name] = {
      tangents: round(toLinear(seen.tangents[1]), 4),
      bare: round(toLinear(seen.bare[1]), 4),
    };
    if (name === 'alongU') keep('tilted');
  }
  // A surface that writes no normal, for what "flat" should be.
  for (const node of Object.values(nodes)) node.meshRenderer.sharedMaterial = plain.material;
  const untouched = both();
  result.light.untouched = {
    tangents: round(toLinear(untouched.tangents[1]), 4),
    bare: round(toLinear(untouched.bare[1]), 4),
  };
  for (const node of Object.values(nodes)) node.meshRenderer.sharedMaterial = material.material;
  // The normal the camera keeps beside its colours follows the hook too.
  const off = depthView(s.camera, 'normals');
  for (const name of ['flat', 'alongU', 'alongV']) {
    material.set('u_ZhudaTilt', tilts[name]);
    result.normals[name] = both();
  }
  off();
  // LayaAir hands a camera's depth pictures back at the next frame, not when the camera goes.
  flush(2);
  s.end();
  return result;
}

// --- 4. The surface the documentation shows: noise eats a plate away -----------------
function dissolve() {
  const s = stage({ ambient: 0.25, sun: [-90, 0, 0], shadows: true });
  const material = s.lit({
    name: 'ZhudaDissolve',
    common: true,
    material: { blend: 'cutout', doubleSided: true, color: [0.2, 0.5, 0.9, 1] },
    uniforms: { u_ZhudaGone: { type: 'float', value: 0 } },
    surface: `void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
    float grain = zhudaFbm(p * 3.0);
    s.alpha = step(u_ZhudaGone, grain);
    s.emission += vec3(4.0, 1.2, 0.2) * smoothstep(0.08, 0.0, grain - u_ZhudaGone);
    s.normalTS = normalize(vec3(zhudaNoise(p.xz * 40.0) - 0.5, zhudaNoise(p.zx * 40.0) - 0.5, 4.0));
  }`,
  });
  s.plate(material, [0, 1.5, 0]);
  const corners = [pixel([-1.8, 1.5, -0.8]), pixel([1.8, 1.5, 0.8])];
  const x0 = pixel([-1.8, 1.5, 0.8])[0] + 12,
    x1 = pixel([1.8, 1.5, 0.8])[0] - 12;
  const result: any = {};
  for (const gone of [0, 0.5, 1]) {
    material.set('u_ZhudaGone', gone);
    flush(3);
    const p = read();
    let kept = 0,
      glowing = 0,
      all = 0;
    for (let y = corners[0][1]; y <= corners[1][1]; y++)
      for (let x = x0; x <= x1; x++) {
        const i = (y * W + x) * 4;
        all++;
        // The plate is blue, its burning edge brighter than anything else
        // (clipped to white: nothing here maps tones), the floor behind grey.
        if (p[i] > 230 && p[i + 1] > 180) glowing++;
        else if (p[i + 2] - p[i] > 40) kept++;
      }
    // The floor under the plate: how much of the sun still reaches it.
    let lit = 0,
      count = 0;
    for (let z = -0.6; z <= 0.6; z += 0.1)
      for (let x = -1.5; x <= 1.5; x += 0.1) {
        const [px, py] = pixel([x, 0, z]);
        lit += toLinear(p[(py * W + px) * 4 + 1]);
        count++;
      }
    result[gone] = {
      kept: round(kept / all),
      glowing: round(glowing / all),
      floor: round(lit / count, 4),
    };
    if (gone === 0.5) keep('dissolve');
  }
  s.end();
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
  const only = new URLSearchParams(location.search).get('only');
  const parts: Record<string, () => any> = { strips, chance, tilted, dissolve };
  out.left = {};
  // LayaAir keeps a sun's shadow map once it has made one: made before anything is counted.
  const warm = stage({ ambient: 0.2, sun: [-90, 0, 0], shadows: true });
  flush(2);
  warm.end();
  for (const [name, part] of Object.entries(parts)) {
    if (only && only !== name) continue;
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
