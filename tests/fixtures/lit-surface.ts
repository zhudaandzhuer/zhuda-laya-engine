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
  const meshes = new Map<any, any>();
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
  const plate = (material: any, at: V, size: V = [4, 2], tangents = true, colors?: number[]) => {
    const data = sheet(size[0], size[1], tangents);
    if (colors) data.colors = new Float32Array(colors);
    const mesh = own(new Z.ZhudaDynamicMesh(data, scene));
    meshes.set(mesh.node, mesh);
    mesh.node.meshRenderer.sharedMaterial = material.material;
    mesh.node.meshRenderer.castShadow = true;
    mesh.node.meshRenderer.receiveShadow = false;
    mesh.node.transform.position = v3(at);
    return mesh.node;
  };
  /** A ball, for what depends on how steeply a surface is seen. */
  const ball = (material: any, at: V, radius = 1) => {
    const mesh = own(Z.Zhuda3D.createPrimitiveMesh('sphere', { radius }));
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material.material;
    node.meshRenderer.castShadow = false;
    node.transform.position = v3(at);
    scene.addChild(node);
    return node;
  };
  /** Looks at a ball from far off through a long lens: every part of it is seen from nearly one side. */
  const farView = (centre: V, radius: number) => {
    const distance = 40,
      fov = 4;
    camera.fieldOfView = fov;
    camera.transform.position = v3([centre[0], centre[1], centre[2] + distance]);
    camera.transform.lookAt(v3(centre), v3([0, 1, 0]));
    const h = Math.tan(((fov / 2) * Math.PI) / 180);
    /** The pixel of the ball's front at a share of its radius to the right of its middle. */
    return (share: number): [number, number] => {
      const x = share * radius,
        z = Math.sqrt(Math.max(0, radius * radius - x * x));
      return [Math.floor(((x / ((distance - z) * h * (W / H)) + 1) / 2) * W), Math.floor(H / 2)];
    };
  };
  /** Puts the camera somewhere else; returns where a point of the world is on the screen from there. */
  const view = (eye: V, look: V, fov: number, upward: V = [0, 1, 0]) => {
    camera.fieldOfView = fov;
    camera.transform.position = v3(eye);
    camera.transform.lookAt(v3(look), v3(upward));
    const f = unit(sub(look, eye)),
      r = unit(cross(f, upward)),
      u = cross(r, f),
      h = Math.tan(((fov / 2) * Math.PI) / 180);
    return (p: V): [number, number] => {
      const d = sub(p, eye),
        depth = dot(d, f);
      return [
        Math.floor(((dot(d, r) / (depth * h * (W / H)) + 1) / 2) * W),
        Math.floor(((1 - dot(d, u) / (depth * h)) / 2) * H),
      ];
    };
  };
  return {
    scene,
    camera,
    sun,
    own,
    plate,
    ball,
    farView,
    view,
    mesh: (node: any) => meshes.get(node),
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

/** Light at a pixel as the screen's curve gives it back (LayaAir writes a power of 1/2.2). */
const lightAt = (p: Uint8ClampedArray, at: [number, number]) => {
  let sum = 0;
  for (let y = at[1] - 1; y <= at[1] + 1; y++)
    for (let x = at[0] - 1; x <= at[0] + 1; x++) {
      const i = (y * W + x) * 4;
      sum +=
        (0.2126 * (p[i] / 255) ** 2.2 +
          0.7152 * (p[i + 1] / 255) ** 2.2 +
          0.0722 * (p[i + 2] / 255) ** 2.2) /
        9;
    }
  return sum;
};
const channels = (p: Uint8ClampedArray, at: [number, number]) =>
  [0, 1, 2].map((k) => round((p[(at[1] * W + at[0]) * 4 + k] / 255) ** 2.2));

// --- 5. Sheer cloth: how clear it is goes with how steeply it is seen ----------------
function sheer() {
  const s = stage({ ambient: 0, sun: [-90, 0, 0], shadows: false });
  s.sun.light.intensity = 0;
  s.camera.clearColor = new Laya.Color(0.6, 0.6, 0.6, 1);
  // A dark yarn that takes no light: what is seen through it is the ground behind.
  const cover = 0.35;
  const material = s.lit({
    name: 'ZhudaFixtureSheer',
    surface: `${head}s.baseColor=vec3(0.0);float steep=max(0.23,dot(normalize(n),s.viewDirection));s.alpha=1.0-exp(-${cover}/pow(steep,0.52));}`,
    material: { blend: 'alpha', roughness: 1 },
  });
  s.ball(material, [0, 3, 0]);
  const at = s.farView([0, 3, 0], 1);
  flush(3);
  const p = read();
  keep('sheer');
  const ground = lightAt(p, [8, 8]);
  const result: any = { ground: round(ground), shares: {} };
  for (const share of [0, 0.5, 0.8, 0.97]) {
    // Seen from far off, the cosine to the eye at a share of the radius is what is left of 1.
    const steep = Math.max(0.23, Math.sqrt(1 - share * share));
    result.shares[share] = {
      alpha: round(1 - lightAt(p, at(share)) / ground),
      expected: round(1 - Math.exp(-cover / steep ** 0.52)),
    };
  }
  s.end();
  return result;
}

// --- 6. Blended, added and opaque, as the material says and nothing more -------------
function blends() {
  const s = stage({ ambient: 0, sun: [-90, 0, 0], shadows: false });
  s.sun.light.intensity = 0;
  s.camera.clearColor = new Laya.Color(0.3, 0.3, 0.3, 1);
  // A surface that only gives off light, so that what is drawn is known.
  const glow = [0.5, 0.1, 0.05];
  const surface = `${head}s.baseColor=vec3(0.0);s.emission=vec3(${glow.join(',')});}`;
  const result: any = { glow };
  const places: Record<string, V> = { opaque: [-3, 3, 0], alpha: [0, 3, 0], additive: [3, 3, 0] };
  const materials: Record<string, any> = {};
  for (const blend of Object.keys(places)) {
    const material = (materials[blend] = s.lit({
      name: 'ZhudaFixtureGlow',
      surface,
      material: { blend, color: [1, 1, 1, 0.5], doubleSided: true, roughness: 1 },
    }));
    const node = s.plate(material, places[blend], [2, 2]);
    // Upright, facing the eye.
    node.transform.rotationEuler = v3([90, 0, 0]);
  }
  s.camera.fieldOfView = 30;
  s.camera.transform.position = v3([0, 3, 14]);
  s.camera.transform.lookAt(v3([0, 3, 0]), v3([0, 1, 0]));
  flush(3);
  const p = read();
  keep('blends');
  const h = Math.tan((15 * Math.PI) / 180);
  const at = (x: number): [number, number] => [
    Math.floor(((x / (14 * h * (W / H)) + 1) / 2) * W),
    Math.floor(H / 2),
  ];
  result.ground = channels(p, [8, 8]);
  for (const [blend, place] of Object.entries(places)) result[blend] = channels(p, at(place[0]));
  result.state = Object.fromEntries(
    Object.entries(materials).map(([blend, material]) => [
      blend,
      { depthWrite: material.material.depthWrite, alphaTest: material.material.alphaTest },
    ]),
  );
  s.end();
  return result;
}

// --- 7. A normal written by the hook moves the highlight ------------------------------
function highlight() {
  // The sun is where a mirror lying on the ground would show it to the eye, at the plate's middle.
  const s = stage({ ambient: 0, sun: [-144.5, 0, 0], shadows: false });
  const material = s.lit({
    name: 'ZhudaFixtureGloss',
    surface: `${head}s.baseColor=vec3(0.02);s.metallic=1.0;s.roughness=0.25;s.normalTS=vec3(u_ZhudaTilt.x,u_ZhudaTilt.y,1.0);}`,
    uniforms: { u_ZhudaTilt: { type: 'vec2', value: [0, 0] } },
    material: { roughness: 0.25, metallic: 1 },
  });
  /** The middle of the brightest pixels of the picture. */
  const middle = (p: Uint8ClampedArray) => {
    let most = 0;
    for (let i = 0; i < p.length; i += 4) most = Math.max(most, p[i + 1]);
    let sx = 0,
      sy = 0,
      count = 0;
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (p[(y * W + x) * 4 + 1] >= most * 0.8) {
          sx += x;
          sy += y;
          count++;
        }
    return { x: round(sx / count, 1), y: round(sy / count, 1), most, pixels: count };
  };
  const tilts = { flat: [0, 0], alongU: [0.12, 0], alongV: [0, 0.12] };
  const result: any = {};
  // The same plate twice: with tangents of its own, and with none (the
  // frame then comes from the texture coordinates on the screen).
  for (const [mesh, tangents] of [
    ['tangents', true],
    ['bare', false],
  ] as const) {
    const node = s.plate(material, [0, 0.02, 0], [10, 10], tangents);
    result[mesh] = {};
    for (const [name, tilt] of Object.entries(tilts)) {
      material.set('u_ZhudaTilt', tilt);
      flush(3);
      result[mesh][name] = middle(read());
      if (mesh === 'tangents' && name !== 'alongV') keep(`highlight-${name}`);
    }
    node.active = false;
  }
  s.end();
  return result;
}

// --- 8. A number a vertex, read in the hook; a part of the mesh changed ----------------
function vertexValue() {
  const s = stage({ ambient: 0, sun: [-90, 0, 0], shadows: false });
  s.sun.light.intensity = 0;
  // Alpha carries a plain number (none at the left edge, one at the right);
  // red, green and blue carry a display colour, which arrives as light.
  const material = s.lit({
    name: 'ZhudaFixtureVertexValue',
    surface: `${head}s.baseColor=vec3(0.0);s.emission=vec3(s.vertexColor.a,s.vertexColor.g,1.0-s.vertexColor.a);}`,
    material: { roughness: 1 },
  });
  const grey = [0.5, 0.5, 0.5];
  const node = s.plate(material, [0, 1.5, 0], [4, 2], true, [
    ...grey,
    0,
    ...grey,
    1,
    ...grey,
    1,
    ...grey,
    0,
  ]);
  const mesh = s.mesh(node);
  const places = { left: [-1, 1.5, 0], right: [1, 1.5, 0] };
  const sample = () => {
    flush(3);
    const p = read();
    return Object.fromEntries(
      Object.entries(places).map(([name, at]) => [name, channels(p, pixel(at))]),
    );
  };
  const result: any = {
    layout: { stride: mesh.stride, offsets: mesh.offsets },
    made: sample(),
  };
  keep('vertex-value');
  // The two vertices at the right edge are told there is none there either.
  mesh.setColor(1, ...grey, 0);
  mesh.setColor(2, ...grey, 0);
  result.beforeUpload = sample();
  mesh.updateRange(1, 2);
  result.changed = sample();
  // A plain plate beside it: a mesh without colours reads white.
  const bare = s.plate(material, [0, 1.5, 2.2], [4, 0.6], true);
  result.withoutColours = (() => {
    flush(3);
    return channels(read(), pixel([0, 1.5, 2.2]));
  })();
  void bare;
  s.end();
  return result;
}

// --- 9. Sheen on a lit surface with a hook --------------------------------------------
function cloth() {
  // Lit from where the eye is: a matt black ball is dark all over, cloth glows at its edge.
  const s = stage({ ambient: 0, sun: [0, 0, 0], shadows: false });
  const at = s.farView([0, 3, 0], 1);
  const result: any = {};
  const balls: Record<string, any> = {
    matt: { name: 'ZhudaFixtureMatt', surface: `${head}s.baseColor=vec3(0.0);s.roughness=1.0;}` },
    sheen: {
      name: 'ZhudaFixtureSheen',
      surface: `${head}s.baseColor=vec3(0.0);s.roughness=1.0;}`,
      sheen: { color: [1, 1, 1], roughness: 0.4 },
    },
    // The hook has the last word: red, whatever the material said.
    red: {
      name: 'ZhudaFixtureSheenRed',
      surface: `${head}s.baseColor=vec3(0.0);s.roughness=1.0;s.sheenColor=vec3(1.0,0.0,0.0);}`,
      sheen: true,
    },
  };
  for (const [name, spec] of Object.entries(balls)) {
    const material = s.lit({ ...spec, material: { roughness: 1 } });
    const node = s.ball(material, [0, 3, 0]);
    flush(3);
    const p = read();
    if (name === 'sheen') keep('cloth');
    result[name] = { middle: channels(p, at(0)), edge: channels(p, at(0.92)) };
    if (name === 'sheen') {
      // Changed in place: half the glow.
      material.setSheen({ color: [0.5, 0.5, 0.5] });
      flush(3);
      result.halved = { edge: channels(read(), at(0.92)) };
    }
    node.destroy();
  }
  s.end();
  return result;
}

// --- 10. Two sheets through each other: cut by chance, the nearer one is seen ----------
function cards() {
  const result: any = {};
  // Two sheets tilted opposite ways about the line they share, seen from
  // straight above: on one side of the line the one is on top, on the
  // other side the other.
  const lean = 20,
    red = [0.8, 0.02, 0.02],
    green = [0.02, 0.6, 0.02];
  /** The shares of red (sheet A) and green (sheet B) pixels round a place, and the mean light there. */
  const shares = (p: Uint8ClampedArray, at: [number, number]) => {
    let a = 0,
      b = 0,
      all = 0;
    const light = [0, 0, 0];
    for (let y = at[1] - 6; y <= at[1] + 6; y++)
      for (let x = at[0] - 40; x <= at[0] + 40; x++) {
        const i = (y * W + x) * 4;
        all++;
        if (p[i] - p[i + 1] > 60) a++;
        else if (p[i + 1] - p[i] > 60) b++;
        for (let k = 0; k < 3; k++) light[k] += (p[i + k] / 255) ** 2.2;
      }
    return { A: round(a / all), B: round(b / all), light: light.map((v) => round(v / all)) };
  };
  const draw = (hash: boolean, first: 'A' | 'B') => {
    const s = stage({ ambient: 0, sun: [-90, 0, 0], shadows: false });
    s.sun.light.intensity = 0;
    const at = s.view([0, 12, 0], [0, 1.5, 0], 30, [0, 0, -1]);
    const nodes: Record<string, any> = {};
    const sheet = (key: 'A' | 'B') => {
      const material = s.lit({
        name: `ZhudaFixtureCard${key}${hash ? 'Hash' : 'Blend'}`,
        surface: `${head}s.baseColor=vec3(0.0);s.emission=vec3(${(key === 'A' ? red : green).join(',')});s.alpha=0.5;}`,
        ...(hash ? { alphaHash: true } : {}),
        material: { doubleSided: true, roughness: 1, ...(hash ? {} : { blend: 'alpha' }) },
      });
      // Sheet B a little to the side: the chance is drawn from where a point
      // is on its own sheet, and two sheets laid out alike would draw alike.
      const node = (nodes[key] = s.plate(material, [key === 'A' ? 0 : 0.37, 1.5, 0], [4, 2]));
      node.transform.rotationEuler = v3([key === 'A' ? lean : -lean, 0, 0]);
    };
    sheet(first);
    sheet(first === 'A' ? 'B' : 'A');
    flush(3);
    const p = read();
    if (first === 'A') keep(hash ? 'cards-hash' : 'cards-blend');
    // Which sheet is on top on each side, from where the nodes put their own points.
    const height = (key: string, z: number) => {
      const out = new Laya.Vector3();
      Laya.Vector3.transformCoordinate(v3([0, 0, z]), nodes[key].transform.worldMatrix, out);
      return out.y;
    };
    const sides: any = {};
    for (const [name, z] of [
      ['plusZ', 0.5],
      ['minusZ', -0.5],
    ] as const) {
      const top = height('A', z) > height('B', z) ? 'A' : 'B';
      const seen = shares(p, at([0, 1.5, z]));
      sides[name] = {
        top,
        topShare: seen[top],
        underShare: seen[top === 'A' ? 'B' : 'A'],
        light: seen.light,
      };
    }
    s.end();
    return { sides, picture: p };
  };
  for (const [name, hash] of [
    ['hash', true],
    ['blend', false],
  ] as const) {
    const one = draw(hash, 'A'),
      other = draw(hash, 'B');
    let differ = 0;
    for (let i = 0; i < one.picture.length; i += 4)
      if (
        Math.abs(one.picture[i] - other.picture[i]) +
          Math.abs(one.picture[i + 1] - other.picture[i + 1]) >
        24
      )
        differ++;
    result[name] = {
      madeAFirst: one.sides,
      madeBFirst: other.sides,
      pixelsThatDiffer: round(differ / (W * H), 4),
    };
  }
  // What half-clear sheets over a dark floor come to where they are drawn in the right order.
  result.rightLight = {
    topA: red.map((v, k) => round(0.5 * v + 0.25 * green[k])),
    topB: green.map((v, k) => round(0.5 * v + 0.25 * red[k])),
  };
  return result;
}

// --- 11. What the hook reads, in the shadow and in the depth too -----------------------
function passes() {
  const s = stage({ ambient: 0.25, sun: [-90, 0, 0], shadows: true });
  // Kept where the vertex's number is over a half (the right half of the
  // plate) and where the surface is seen steeply enough. The plate faces up:
  // the eye sees it at a cosine of 0.447, the sun overhead at 1.
  const surface = (limit: number) =>
    `${head}s.baseColor=${RED};s.alpha=step(0.5,s.vertexColor.a)*step(${limit.toFixed(2)},dot(normalize(n),s.viewDirection));}`;
  const seen = s.lit({
    name: 'ZhudaFixturePassesSeen',
    surface: surface(0.3),
    material: { blend: 'cutout', doubleSided: true, roughness: 0.9 },
  });
  // Too flat to the eye to be drawn; the sun, overhead, still meets it squarely.
  const unseen = s.lit({
    name: 'ZhudaFixturePassesUnseen',
    surface: surface(0.7),
    material: { blend: 'cutout', doubleSided: true, roughness: 0.9 },
  });
  const white = [1, 1, 1];
  const node = s.plate(seen, [0, 1.5, 0], [4, 2], true, [
    ...white,
    0,
    ...white,
    1,
    ...white,
    1,
    ...white,
    0,
  ]);
  const points = {
    kept: [1, 1.5, 0],
    cut: [-1, 1.5, 0],
    underKept: [1, 0, 0],
    underCut: [-1, 0, 0],
    aside: [3.5, 0, 0],
  };
  const sample = () => {
    flush(3);
    const p = read();
    return Object.fromEntries(
      Object.entries(points).map(([name, point]) => [name, colourAt(p, point)]),
    );
  };
  const result: any = { seen: sample() };
  keep('passes');
  for (const what of ['depth', 'normals'] as const) {
    const off = depthView(s.camera, what);
    result[what] = { seen: sample() };
    node.meshRenderer.sharedMaterial = unseen.material;
    result[what].unseen = sample();
    node.meshRenderer.sharedMaterial = seen.material;
    off();
  }
  node.meshRenderer.sharedMaterial = unseen.material;
  result.unseen = sample();
  keep('passes-unseen');
  result.eyeDepth = { kept: round(depthOf(points.kept)), cut: round(depthOf(points.cut)) };
  s.end();
  return result;
}

// --- 12. The surface's frame: a disc under the surface is seen where a point that deep is ---
function under() {
  const s = stage({ ambient: 0, sun: [-90, 0, 0], shadows: false });
  s.sun.light.intensity = 0;
  const deep = 0.4,
    radius = 0.3;
  // The plates are two by two: a length in the world is half as much of u and of v.
  const material = s.lit({
    name: 'ZhudaFixtureUnder',
    surface: `${head}vec2 below=uv-s.viewTS.xy/max(s.viewTS.z,0.2)*u_ZhudaDeep*0.5;s.baseColor=vec3(0.0);s.roughness=1.0;s.emission=vec3(step(length((below-0.5)*2.0),${radius}));}`,
    uniforms: { u_ZhudaDeep: { type: 'float', value: 0 } },
    material: { roughness: 1 },
  });
  const plates: Record<string, { node: any; at: V }> = {
    tangents: { node: s.plate(material, [-1.5, 1, 0], [2, 2], true), at: [-1.5, 1, 0] },
    bare: { node: s.plate(material, [1.5, 1, 0], [2, 2], false), at: [1.5, 1, 0] },
  };
  const eyes: Record<string, V> = { front: EYE, side: [4, 4, 3] };
  const look = [0, 1, 0];
  /** Where a point of the world is on the screen, in parts of a pixel. */
  const project = (eye: V, p: V) => {
    const f = unit(sub(look, eye)),
      r = unit(cross(f, [0, 1, 0])),
      u = cross(r, f),
      h = Math.tan(((FOV / 2) * Math.PI) / 180),
      d = sub(p, eye),
      depth = dot(d, f);
    return [
      round(((dot(d, r) / (depth * h * (W / H)) + 1) / 2) * W, 2),
      round(((1 - dot(d, u) / (depth * h)) / 2) * H, 2),
    ];
  };
  /** The middle of what is bright, and how many pixels that is. */
  const middle = (p: Uint8ClampedArray) => {
    let n = 0,
      x = 0,
      y = 0;
    for (let j = 0; j < H; j++)
      for (let i = 0; i < W; i++)
        if (p[(j * W + i) * 4] > 128) {
          n++;
          x += i + 0.5;
          y += j + 0.5;
        }
    return { found: n ? [round(x / n, 2), round(y / n, 2)] : [0, 0], pixels: n };
  };
  const result: any = {};
  for (const [mesh, plate] of Object.entries(plates)) {
    for (const other of Object.values(plates)) other.node.active = other === plate;
    result[mesh] = {};
    for (const [name, eye] of Object.entries(eyes)) {
      s.view(eye, look, FOV);
      result[mesh][name] = {};
      for (const depth of [0, deep]) {
        material.set('u_ZhudaDeep', depth);
        flush(3);
        if (mesh === 'tangents' && name === 'side' && depth) keep('under');
        result[mesh][name][depth ? 'deep' : 'onTop'] = {
          ...middle(read()),
          expected: project(eye, [plate.at[0], plate.at[1] - depth, plate.at[2]]),
        };
      }
    }
  }
  s.end();
  return result;
}

// --- 13. Skin: a light reaches round the edge of its shadow, and through what is thin ---
function skin() {
  // The sun from one side, the eye in front.
  const s = stage({ ambient: 0, sun: [0, 90, 0], shadows: false });
  const toSun = () => {
    const m = s.sun.node.transform.worldMatrix.elements;
    return unit([m[8], m[9], m[10]]).map((v) => round(v, 4));
  };
  const at = s.farView([0, 3, 0], 1);
  const shares = [-0.6, -0.3, 0.3, 0.6];
  const body = 's.baseColor=vec3(0.8);s.metallic=0.0;s.roughness=1.0;';
  const result: any = { shares, fromTheSide: toSun() };
  const balls: Record<string, any> = {
    plain: { name: 'ZhudaFixtureSkinPlain', surface: `${head}${body}}` },
    skin: {
      name: 'ZhudaFixtureSkin',
      surface: `${head}${body}}`,
      subsurface: { color: [1, 0.35, 0.25], wrap: 0.5 },
    },
    // The hook has the last word on the colour.
    green: {
      name: 'ZhudaFixtureSkinGreen',
      surface: `${head}${body}s.subsurfaceColor=vec3(0.0,1.0,0.0);}`,
      subsurface: { wrap: 0.5 },
    },
    // Thin on its right half only, by the hook.
    thin: {
      name: 'ZhudaFixtureSkinThin',
      surface: `${head}${body}s.thickness=step(0.0,p.x);}`,
      subsurface: { color: [1, 0.35, 0.25], wrap: 0, back: 0.5, power: 6, distortion: 0.3 },
    },
  };
  for (const [name, spec] of Object.entries(balls)) {
    const material = s.lit({ ...spec, material: { roughness: 1 } });
    const node = s.ball(material, [0, 3, 0]);
    if (name === 'thin') {
      // The sun behind the ball: nothing of it lights the side that is seen.
      s.sun.node.transform.rotationEuler = v3([0, 180, 0]);
      result.fromBehind = toSun();
    }
    const sample = () => {
      flush(3);
      const p = read();
      return shares.map((share) => channels(p, at(share)));
    };
    result[name] = sample();
    if (name === 'skin' || name === 'thin') keep(name === 'skin' ? 'skin' : 'skin-thin');
    if (name === 'thin') {
      material.setSubsurface({ back: 0.25 });
      result.halved = sample();
    }
    node.destroy();
  }
  s.end();
  return result;
}

// --- 14. Strands: a band of light across them, moved along them by a shift ---------------
function strands() {
  // The sun straight overhead: the band is under the eye's own line, in the middle of the plate.
  const s = stage({ ambient: 0, sun: [-90, 0, 0], shadows: false });
  const m = s.sun.node.transform.worldMatrix.elements;
  const toSun = unit([m[8], m[9], m[10]]);
  const hook = `${head}s.baseColor=vec3(0.0);s.metallic=0.0;s.roughness=1.0;s.strandShift=u_ZhudaShift;}`;
  const make = (name: string, along: string) =>
    s.lit({
      name,
      surface: hook,
      uniforms: { u_ZhudaShift: { type: 'float', value: 0 } },
      strands: { along, strength: 0.5, color: [0, 0, 0], shift: [0, 0], exponent: [2000, 24] },
      material: { roughness: 1 },
    });
  const alongU = make('ZhudaFixtureStrandsU', 'u'),
    alongV = make('ZhudaFixtureStrandsV', 'v');
  const node = s.plate(alongU, [0, 1, 0], [4, 2], true);
  /** Where along the row through the plate's middle the band is, and how bright there. */
  const band = () => {
    flush(3);
    const p = read();
    let peak = 0;
    const row: [number, number[]][] = [];
    for (let x = -1.95; x <= 1.951; x += 0.01) {
      const c = channels(p, pixel([x, 1, 0]));
      row.push([x, c]);
      peak = Math.max(peak, c[0] + c[1] + c[2]);
    }
    let weight = 0,
      sum = 0;
    const top = [0, 0, 0];
    for (const [x, c] of row) {
      const v = c[0] + c[1] + c[2];
      if (v < peak / 2) continue;
      weight += v;
      sum += v * x;
      for (let k = 0; k < 3; k++) top[k] = Math.max(top[k], c[k]);
    }
    return { at: weight ? round(sum / weight) : null, peak: top };
  };
  /** Where the band is by the formula: the half vector square to the shifted strand. */
  const predicted = (shift: number) => {
    const f = (x: number) => {
      const v = unit(sub(EYE, [x, 1, 0]));
      return toSun[0] + v[0] + shift * (toSun[1] + v[1]);
    };
    let low = -4,
      high = 4;
    for (let i = 0; i < 60; i++) {
      const mid = (low + high) / 2;
      if (f(low) * f(mid) <= 0) high = mid;
      else low = mid;
    }
    return round((low + high) / 2);
  };
  const result: any = {
    toSun: toSun.map((v) => round(v, 4)),
    expected: { plain: predicted(0), shifted: predicted(0.05) },
    plain: band(),
  };
  keep('strands');
  alongU.set('u_ZhudaShift', 0.05);
  result.byTheHook = band();
  alongU.set('u_ZhudaShift', 0);
  alongU.setStrands({ shift: [0.05, 0] });
  result.byTheMaterial = band();
  // The second band on the first, in its colour: both as strong as `strength`.
  alongU.setStrands({
    shift: [0, 0],
    exponent: [2000, 2000],
    strength: 0.5,
    color: [0.5, 0.25, 0],
  });
  result.coloured = band();
  // A lower strength dims both bands, the coloured one too.
  alongU.setStrands({ strength: 0.1 });
  result.dimmed = band();
  // Strands the other way: none of this row is square to the half vector.
  node.meshRenderer.sharedMaterial = alongV.material;
  result.acrossV = band();
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
  const parts: Record<string, () => any> = {
    strips,
    chance,
    tilted,
    dissolve,
    sheer,
    blends,
    highlight,
    vertexValue,
    cloth,
    cards,
    passes,
    under,
    skin,
    strands,
  };
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
