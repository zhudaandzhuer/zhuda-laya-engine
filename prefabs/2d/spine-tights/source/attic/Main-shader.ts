// 撕襪 2D: a flat picture brought to life on zhuda-laya-engine. 沈知微's legs (a photo, made with
// gpt-image-2.6) in sheer black tights the shader draws over them, and over them a pleated skirt (a product
// photo) hung as the engine's cloth. Drag a leg: the nylon stretches toward the finger, thinner as it
// goes; pull far and it tears (a ragged hole, ladders running up and down), and snaps back with the hole.
// Drag the skirt: a pinch of it follows the finger and swings when let go. An orthographic camera: no
// perspective, the picture as it was drawn.
import { ZhudaEngine, Zhuda3D, ZhudaLitSurfaceMaterial, ZhudaDynamicMesh, ZhudaCloth, createZhudaClothGrid, createSurfaceTexture } from 'zhuda-laya-engine';
import { TEARS, TEAR_GLSL, TEAR_CALLS, TEAR_UNIFORMS } from './tear';

const state: { ready: boolean; error?: string; note?: any; api?: any } = { ready: false };
Reflect.set(window, '__TEAR2D__', state);

const W = 1.0,
  H = 1.5; // the picture, in world units (1024 x 1536 pixels)
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

async function pixelsOf(url: string) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const g = canvas.getContext('2d')!;
  g.drawImage(bitmap, 0, 0);
  return { width: bitmap.width, height: bitmap.height, data: new Uint8Array(g.getImageData(0, 0, bitmap.width, bitmap.height).data.buffer) };
}

/**
 * Where the legs are (and so the tights), and how squarely each point faces us: for each row, each run
 * of leg pixels is a leg seen across, its middle facing us and its edges turned away. A pixel is leg
 * where it differs from that row's grey background and is neither black (shorts, shoes) nor cold.
 * R: leg (0..255), G: facing (0..255).
 */
function legData(img: { width: number; height: number; data: Uint8Array }) {
  const { width: w, height: h, data } = img;
  const out = new Uint8Array(w * h * 4);
  const top = Math.round(h * 0.205),
    bottom = Math.round(h * 0.95);
  const inLeg = new Uint8Array(w);
  for (let y = 0; y < h; y++) {
    // The row's background: the median of its outer edges.
    const sample: number[][] = [[], [], []];
    for (const x of [...Array(100).keys()].flatMap((i) => [i, w - 1 - i]))
      for (let c = 0; c < 3; c++) sample[c].push(data[(y * w + x) * 4 + c]);
    const bg = sample.map((list) => list.sort((a, b) => a - b)[list.length >> 1]);
    for (let x = 0; x < w; x++) {
      const k = (y * w + x) * 4,
        r = data[k],
        g = data[k + 1],
        b = data[k + 2];
      const diff = Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
      const lum = 0.3 * r + 0.6 * g + 0.1 * b;
      const warm = r - b;
      inLeg[x] = y >= top && y < bottom && diff > 22 && lum > 70 && warm > (y > h * 0.84 ? 18 : 8) ? 1 : 0;
    }
    let x = 0;
    while (x < w) {
      if (!inLeg[x]) {
        x++;
        continue;
      }
      let e = x;
      while (e < w && inLeg[e]) e++;
      // Below the ankles only real runs of skin (the floor's shadow leaves specks).
      if (e - x > (y > h * 0.84 ? 8 : 3)) {
        const mid = (x + e - 1) / 2,
          half = Math.max(1, (e - 1 - x) / 2);
        for (let i = x; i < e; i++) {
          const t = (i - mid) / half;
          const k = (y * w + i) * 4;
          out[k] = 255;
          out[k + 1] = Math.round(255 * Math.sqrt(Math.max(0, 1 - t * t)));
          out[k + 3] = 255;
        }
      }
      x = e;
    }
  }
  // Soften the outline a pixel (the photo's edge is soft too).
  const soft = new Uint8Array(out);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const k = (y * w + x) * 4;
      soft[k] = (out[k] * 4 + out[k - 4] + out[k + 4] + out[k - w * 4] + out[k + w * 4]) >> 3;
    }
  return soft;
}

/** Sheer black nylon over the photo, pulled and torn. Unlit: the photo is already lit. */
const LEGS_GLSL = `${TEAR_GLSL}
void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  vec3 photo = zhudaSample_u_ZhudaPhoto(uv).rgb;
  // The pull: the fabric at uv came from nearer the grip (the skin does not move).
  vec2 d = (uv - u_ZhudaPull.xy) * vec2(1.0, ${(H / W).toFixed(3)});
  float reach = u_ZhudaPullShape.x;
  float fall = exp(-dot(d, d) / (reach * reach));
  vec2 src = uv - u_ZhudaPull.zw * fall;
  // The tights stay on the leg's outline; only their knit, thickness and tears move with the pull.
  vec4 leg = zhudaSample_u_ZhudaLegData(uv);
  float mask = leg.r;
  float facing = leg.g;
  float strain = u_ZhudaPullShape.y * fall;
  // Pulled away from the leg, the nylon makes a tent from the leg to the fingers: a narrowing
  // translucent sheet between the grip and where the grip has been pulled to.
  vec2 g0 = u_ZhudaPull.xy, g1 = u_ZhudaPull.xy + u_ZhudaPull.zw;
  vec2 seg = (g1 - g0) * vec2(1.0, ${(H / W).toFixed(3)});
  vec2 rel = (uv - g0) * vec2(1.0, ${(H / W).toFixed(3)});
  float segLen = max(length(seg), 1e-5);
  float along = clamp(dot(rel, seg) / (segLen * segLen), 0.0, 1.0);
  float off = length(rel - seg * along);
  float tentWidth = mix(0.075, 0.008, pow(along, 0.7)) * smoothstep(0.004, 0.02, segLen);
  float tent = (1.0 - smoothstep(tentWidth * 0.6, tentWidth, off)) * step(0.0, dot(rel, seg));
  // The knit, seen only close (faded by its footprint).
  vec2 k = src * vec2(1024.0, 1536.0) * 1.1;
  float seen = 1.0 - smoothstep(0.35, 0.9, max(length(dFdx(k)), length(dFdy(k))));
  float knit = 1.0 + 0.16 * seen * sin(k.x * 2.6) * sin(k.y * 2.2);
  // Beer-Lambert through one layer: sheer where it faces us, dense at the edges, thinner stretched.
  float path = max(0.18, facing);
  float depth = u_ZhudaPullShape.z * knit * (1.0 - 0.85 * strain);
  float a = (1.0 - exp(-depth / pow(path, 0.6))) * mask;
  // Tears, in the fabric's own place (they travel with it when it is pulled).
  float fray = 0.0, runs = 0.0, tearCoverage = 1.0;
  vec2 scale = vec2(${W.toFixed(3)}, ${H.toFixed(3)});
  vec2 tearDx = dFdx(src) * scale, tearDy = dFdy(src) * scale;
  float edgeAA = clamp(0.55 * max(length(tearDx), length(tearDy)), 0.0003, 0.02);
  uv = src;
${TEAR_CALLS('0.85')}
  a = max(fray * 0.7 * mask, a * (1.0 - runs) * tearCoverage);
  // The tent: a sheet of nylon drawn out in threads along the pull, denser toward the fingers
  // where it bunches; a bright line down its middle where it is folded.
  float streak = 0.7 + 0.3 * sin(off * 900.0 + along * 3.0);
  float tentA = tent * mix(0.5, 0.92, along) * streak;
  float fold = tent * exp(-pow(off / max(tentWidth * 0.18, 1e-4), 2.0));
  a = max(a, tentA);
  facing = max(facing, tent * (0.3 + 0.7 * along));
  vec3 nylon = vec3(0.012, 0.011, 0.013);
  float lit = dot(photo, vec3(0.3, 0.6, 0.1));
  // Its sheen: a soft band down the front of each leg, brighter where the photo is lit.
  vec3 sheen = vec3(0.16, 0.16, 0.18) * pow(facing, 6.0) * (0.4 + lit) * (1.0 - 0.5 * strain);
  vec3 colour = mix(photo, nylon + sheen + vec3(0.09, 0.09, 0.1) * fold, a) + vec3(0.04) * fray * mask;
  s.baseColor = vec3(0.0);
  s.emission = colour;
  s.roughness = 1.0;
}`;

/** The skirt: the product photo, a little lit by its folds; its inside darker. */
const SKIRT_GLSL = `
void zhudaSurface(inout ZhudaLitSurface s, vec2 uv, vec3 p, vec3 n) {
  vec4 photo = zhudaSample_u_ZhudaSkirt(uv);
  float front = step(0.0, dot(n, s.viewDirection));
  vec3 colour = photo.rgb * mix(0.35, 1.0, front);
  s.alpha = photo.a;
  s.baseColor = colour * 0.45;
  s.emission = colour * 0.7;
  s.roughness = 0.8;
}`;

async function main() {
  const params = new URLSearchParams(location.search);
  const number = (name: string, fallback: number) => (params.has(name) ? Number(params.get(name)) : fallback);
  const container = document.querySelector<HTMLElement>('#game')!;
  const coarse = matchMedia('(pointer: coarse)').matches;
  const context = await ZhudaEngine.boot({ container, dprCap: number('dpr', 2), features: ['core', '3d'], bgColor: '#a49e9f' });
  Reflect.set(window, '__TEAR2D_RENDERER__', () => context.renderer.errors.slice(0, 6));
  const scene = Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.55, 0.55, 0.55, 1] });
  const size = () => ({ width: Math.max(1, container.clientWidth), height: Math.max(1, container.clientHeight) });

  // The camera: orthographic, the whole picture in view, looking along -z.
  const camera = Zhuda3D.createCamera(scene, { position: [0, H / 2, 5], fov: 30, near: 0.1, far: 20, clearColor: [0.64, 0.62, 0.62, 1] });
  camera.orthographic = true;
  const frame = () => {
    const { width, height } = size();
    // A tall screen shows the legs large (the picture's grey sides are cut); a wide one the whole picture.
    camera.orthographicVerticalSize = Math.max(H * 0.9, (W * 0.8) / (width / height));
    camera.transform.position = new Laya.Vector3(0, H / 2, 5);
    camera.transform.lookAt(new Laya.Vector3(0, H / 2, 0), new Laya.Vector3(0, 1, 0));
  };
  frame();
  window.addEventListener('resize', frame);
  const sun = Zhuda3D.createDirectionalLight(scene);
  sun.light.color = new Laya.Color(1, 1, 1, 1);
  sun.light.intensity = 0.9;
  sun.node.transform.position = new Laya.Vector3(0.3, 2.5, 3);
  sun.node.transform.lookAt(new Laya.Vector3(0, 1.1, 0), new Laya.Vector3(0, 1, 0));

  // --- the legs: the photo on a quad, the tights in its shader ------------------------------------
  const legsImage = await pixelsOf('assets/art/legs.jpg');
  const legsTexture = createSurfaceTexture(legsImage.width, legsImage.height, legsImage.data, 'color', { mipmap: true });
  const legDataPixels = legData(legsImage);
  const legDataTexture = createSurfaceTexture(legsImage.width, legsImage.height, legDataPixels, 'data', { mipmap: true });
  const quad = new ZhudaDynamicMesh(
    {
      positions: new Float32Array([-W / 2, H, 0, W / 2, H, 0, -W / 2, 0, 0, W / 2, 0, 0]),
      normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1]),
      uvs: new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]),
      indices: new Uint32Array([0, 2, 1, 1, 2, 3]),
    },
    scene,
  );
  quad.refreshBounds();
  const zeros = (names: string[]) => Object.fromEntries(names.map((name) => [name, { type: 'vec4' as const, value: [0, 0, 0, 0] }]));
  const legs = new ZhudaLitSurfaceMaterial(
    {
      name: 'ZhudaTear2DLegs',
      surface: LEGS_GLSL,
      uniforms: { u_ZhudaPhoto: { type: 'texture2D' }, u_ZhudaLegData: { type: 'texture2D' }, ...zeros(['u_ZhudaPull', 'u_ZhudaPullShape']), ...TEAR_UNIFORMS() },
      material: { color: [1, 1, 1, 1], roughness: 1, metallic: 0, doubleSided: true },
    },
    { u_ZhudaPhoto: legsTexture, u_ZhudaLegData: legDataTexture },
  );
  const tightsDepth = number('denier', 20) / 20 * 0.7;
  legs.set('u_ZhudaPullShape', [0.09, 0, tightsDepth, 0]);
  legs.set('u_ZhudaPull', [0.5, 0.5, 0, 0]);
  quad.node.meshRenderer.sharedMaterial = legs.material;
  quad.node.meshRenderer.castShadow = false;
  quad.node.meshRenderer.receiveShadow = false;
  const isLeg = (u: number, v: number) => {
    const x = Math.round(clamp(u, 0, 1) * (legsImage.width - 1)),
      y = Math.round(clamp(v, 0, 1) * (legsImage.height - 1));
    return legDataPixels[(y * legsImage.width + x) * 4] > 128;
  };

  // Tears: up to twelve, each a place (uv), a direction (ladders run along the leg) and a shape.
  const tears: { place: number[]; shape: number[] }[] = [];
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const addTear = (u: number, v: number, pull: number[]) => {
    // Pulled again near a hole: the hole grows instead of a new one.
    const near = tears.find((t) => Math.hypot(t.place[0] - u, (t.place[1] - v) * (H / W)) < 0.05);
    if (near) {
      near.shape[0] = Math.min(0.32, near.shape[0] * 1.45);
      near.shape[1] = Math.min(0.075, near.shape[1] * 1.4);
      near.shape[3] = Math.min(near.shape[3], 0.7);
      pushTears();
      return;
    }
    if (tears.length >= TEARS) tears.shift();
    // The ladders run up and down the leg; the hole opens across the pull.
    const tilt = clamp(pull[0] * 1.5, -0.15, 0.15);
    tears.push({ place: [u, v, Math.sin(tilt), Math.cos(tilt)], shape: [0.12 + 0.06 * random(), 0.03 + 0.012 * random(), random() * 6.283, 0.25] });
    pushTears();
  };
  const pushTears = () => {
    tears.forEach((tear, i) => {
      legs.set(`u_ZhudaTearPlace${i}`, tear.place);
      legs.set(`u_ZhudaTearShape${i}`, tear.shape);
    });
    legs.set('u_ZhudaTearCount', tears.length);
  };
  // A fresh tear opens fast, then its ladders keep creeping a little (as nylon runs).
  const growTears = (dt: number) => {
    let changed = false;
    for (const tear of tears)
      if (tear.shape[3] < 1) {
        tear.shape[3] = Math.min(1, tear.shape[3] + dt * (tear.shape[3] < 0.8 ? 4 : 0.3));
        changed = true;
      }
    if (changed) pushTears();
  };

  // --- the skirt: the engine's cloth, the product photo on it ------------------------------------
  const skirtImage = await pixelsOf('assets/art/skirt.png');
  const skirtTexture = createSurfaceTexture(skirtImage.width, skirtImage.height, skirtImage.data, 'color', { mipmap: true });
  // Its waistband over the shorts' waistband (6.5% down the picture), 0.47 of the photo's scale.
  const skirtWidth = number('skirtW', 0.72),
    skirtHeight = (skirtWidth * skirtImage.height) / skirtImage.width;
  const skirtTop = H * (1 - number('skirtTop', 0.04));
  // The same grid on phones (a coarser one settled into a balloon on the V40).
  const columns = 36,
    rows = 24;
  const shape = createZhudaClothGrid({ columns, rows, width: skirtWidth, height: skirtHeight, origin: [-skirtWidth / 2, skirtTop, 0.05] });
  const cloth = new ZhudaCloth(shape, scene, { thickness: 0.004, friction: 0.5, compliance: { structural: 0, shear: 2e-4, bend: 4e-5 }, windDrag: 1.2, drag: number('drag', 1.4) });
  const skirtMaterial = new ZhudaLitSurfaceMaterial(
    {
      name: 'ZhudaTear2DSkirt',
      surface: SKIRT_GLSL,
      uniforms: { u_ZhudaSkirt: { type: 'texture2D' } },
      material: { color: [1, 1, 1, 1], roughness: 0.8, metallic: 0, doubleSided: true, blend: 'cutout', alphaCutoff: 0.5 },
    },
    { u_ZhudaSkirt: skirtTexture },
  );
  cloth.node.meshRenderer.sharedMaterial = skirtMaterial.material;
  cloth.node.meshRenderer.castShadow = false;
  // The waistband is sewn on: its rows are pinned.
  const band = Math.max(2, Math.round(rows * 0.17));
  for (let i = 0; i < columns * band; i++) cloth.solver.pin(i);
  // It stays in front of the legs.
  cloth.solver.addCollider({ type: 'plane', point: [0, 0, 0.02], normal: [0, 0, 1] } as any);
  for (let i = 0; i < 60; i++) cloth.update(1 / 60);

  // --- input --------------------------------------------------------------------------------------
  const toWorld = (clientX: number, clientY: number) => {
    const box = container.getBoundingClientRect();
    const vs = camera.orthographicVerticalSize,
      aspect = box.width / box.height;
    return [((clientX - box.left) / box.width - 0.5) * vs * aspect, H / 2 - ((clientY - box.top) / box.height - 0.5) * vs];
  };
  type Held =
    | { kind: 'leg'; id: number; start: number[]; grip: number[] }
    | { kind: 'skirt'; id: number; start: number[]; pinch: { index: number; offset: number[] }[]; anchor: number[]; at: number[]; want: number[] };
  let held: Held | null = null;
  // The pull: where the fabric is held (uv), how far it is pulled (uv), how strained (0..1).
  const pull = { grip: [0.5, 0.5], offset: [0, 0], velocity: [0, 0], target: [0, 0] };
  const reachUv = 0.09,
    tearAt = number('tearAt', 0.17); // uv distance of a pull that tears

  const down = (event: PointerEvent) => {
    if (held || event.button !== 0) return;
    const [x, y] = toWorld(event.clientX, event.clientY);
    container.setPointerCapture?.(event.pointerId);
    const { solver } = cloth;
    const particle = solver.nearestToRay([x, y, 5] as any, [0, 0, -1] as any, coarse ? 0.03 : 0.018);
    if (particle >= 0 && !solver.isPinned(particle)) {
      const p = Array.from(solver.positions.subarray(particle * 3, particle * 3 + 3));
      const row = Math.floor(particle / columns),
        column = particle % columns,
        pinch: { index: number; offset: number[] }[] = [];
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const r = row + dr,
            c = column + dc;
          if (r < band || r >= rows || c < 0 || c >= columns) continue;
          const index = r * columns + c;
          if (solver.isPinned(index)) continue;
          const q = solver.positions.subarray(index * 3, index * 3 + 3);
          solver.pin(index);
          pinch.push({ index, offset: [q[0] - p[0], q[1] - p[1], q[2] - p[2]] });
        }
      held = { kind: 'skirt', id: event.pointerId, start: [x, y], pinch, anchor: p, at: [...p], want: [...p] };
      return;
    }
    const u = (x + W / 2) / W,
      v = (H - y) / H;
    if (isLeg(u, v)) {
      pull.grip = [u, v];
      pull.offset = [0, 0];
      pull.velocity = [0, 0];
      pull.target = [0, 0];
      held = { kind: 'leg', id: event.pointerId, start: [x, y], grip: [u, v] };
    }
  };
  const move = (event: PointerEvent) => {
    if (!held || held.id !== event.pointerId) return;
    const [x, y] = toWorld(event.clientX, event.clientY);
    const dx = x - held.start[0],
      dy = y - held.start[1];
    if (held.kind === 'skirt') {
      const h = held;
      // Lifted, the cloth also comes toward us (as a skirt does when its hem is raised).
      const lift = Math.max(0, dy);
      const want = [h.anchor[0] + dx, h.anchor[1] + dy, h.anchor[2] + 0.45 * lift + 0.15 * Math.abs(dx)];
      const most = 0.3,
        len = Math.hypot(want[0] - h.anchor[0], want[1] - h.anchor[1], want[2] - h.anchor[2]),
        k = len > most ? most / len : 1;
      h.want = [0, 1, 2].map((c) => h.anchor[c] + (want[c] - h.anchor[c]) * k);
      return;
    }
    // The fabric follows the finger, a little less the farther it goes (it resists as it stretches).
    const ou = dx / W,
      ov = -dy / H;
    const len = Math.hypot(ou, ov * (H / W));
    const give = len > 0 ? Math.min(len, tearAt * 1.25) * (1 - 0.25 * Math.min(1, len / tearAt)) / len : 0;
    pull.target = [ou * give, ov * give];
    if (len > tearAt) {
      addTear(held.grip[0], held.grip[1], [ou, ov]);
      pull.target = [0, 0];
      held = null;
    }
  };
  const up = (event: PointerEvent) => {
    if (!held || held.id !== event.pointerId) return;
    if (held.kind === 'skirt') for (const { index } of held.pinch) cloth.solver.unpin(index);
    else pull.target = [0, 0];
    held = null;
  };
  container.addEventListener('pointerdown', down, true);
  container.addEventListener('pointermove', move, true);
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) container.addEventListener(type, up as any, true);

  // --- each frame -----------------------------------------------------------------------------------
  context.runtime.start(() => {
    const dt = Math.min(context.runtime.layers.scaledDeltas.get('world') ?? 1 / 60, 0.04);
    if (held?.kind === 'skirt') {
      const h = held;
      const d = [0, 1, 2].map((c) => h.want[c] - h.at[c]),
        far = Math.hypot(d[0], d[1], d[2]),
        most = 2.2 * dt;
      const k = far > most ? most / far : 1;
      for (let c = 0; c < 3; c++) h.at[c] += d[c] * k;
      for (const { index, offset } of h.pinch) cloth.solver.movePin(index, h.at[0] + offset[0], h.at[1] + offset[1], h.at[2] + offset[2]);
    }
    cloth.update(dt);
    growTears(dt);
    // The pull: held, the fabric is where the finger asks (a stiff spring, no lag to feel); let go, it
    // springs back with a little overshoot.
    const holding = held?.kind === 'leg';
    const stiffness = holding ? 900 : 260,
      damping = holding ? 60 : 16;
    const steps = Math.max(1, Math.ceil(dt * 240));
    for (let i = 0; i < steps; i++) {
      const h = dt / steps;
      for (let c = 0; c < 2; c++) {
        pull.velocity[c] += ((pull.target[c] - pull.offset[c]) * stiffness - pull.velocity[c] * damping) * h;
        pull.offset[c] += pull.velocity[c] * h;
      }
    }
    const strain = clamp(Math.hypot(pull.offset[0], pull.offset[1] * (H / W)) / tearAt, 0, 1);
    legs.set('u_ZhudaPull', [pull.grip[0], pull.grip[1], pull.offset[0], pull.offset[1]]);
    legs.set('u_ZhudaPullShape', [reachUv, strain, tightsDepth, 0]);
  });
  ZhudaEngine.flushRenderFrames(4);
  state.note = { legs: [legsImage.width, legsImage.height], skirt: [columns, rows], tightsDepth };
  state.api = {
    stats: () => ({ tears: tears.length, held: held?.kind ?? null, grip: pull.grip, offset: pull.offset, renderer: context.renderer.errors.slice(0, 3) }),
    tear: (u: number, v: number) => (addTear(u, v, [0, -0.05]), tears.length),
  };
  state.ready = true;
}

main().catch((error) => {
  state.error = String(error?.stack || error);
  const note = document.createElement('pre');
  note.style.cssText = 'position:fixed;left:8px;top:8px;right:8px;color:#fff;font:12px/1.4 monospace;white-space:pre-wrap;z-index:9';
  note.textContent = state.error;
  document.body.appendChild(note);
});
