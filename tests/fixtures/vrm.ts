// Fixture for scripts/verify-vrm.mjs: the generated VRM 1.0 avatar
// (tests/fixtures/vrm-avatar.mjs, served as avatar.vrm) loaded through
// ZhudaModelLibrary and given to ZhudaVrm. Each step poses it, draws a
// frame and measures the picture where the model's own geometry says to
// look (pupils, mouth, lit and shaded skin, the hair), and reads the nodes
// and morph weights back. Runtime functions come from the browser SDK.
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__VRM__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 360;
let context: any;
let gl: WebGL2RenderingContext | null = null;
const frame = () => new Promise<void>((resolve) => Laya.timer.frameOnce(1, null, resolve));
type V = number[];
const v3 = (a: V) => new Laya.Vector3(a[0], a[1], a[2]);
const p3 = (p: any): V => [p.x, p.y, p.z];
const q4 = (q: any): V => [q.x, q.y, q.z, q.w];
const angleOf = (q: V) => (2 * Math.acos(Math.min(1, Math.abs(q[3]))) * 180) / Math.PI;

function read(): Uint8Array {
  const raw = new Uint8Array(W * H * 4);
  if (gl) {
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const flipped = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      flipped.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return flipped;
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  c.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(c.getImageData(0, 0, W, H).data.buffer);
}
const saved: Record<string, Uint8Array> = {};
out.pictures = () => Object.keys(saved);
out.picture = (name: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const image = canvas.getContext('2d')!.createImageData(W, H);
  image.data.set(saved[name]);
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
};
const differing = (a: Uint8Array, b: Uint8Array, threshold = 24) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4)
    if (
      Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) >
      threshold
    )
      n++;
  return n;
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
    bgColor: '#000000',
  });
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  context.runtime.start(() => {});
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.3, 0.3, 0.33] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 1.5, 0.75], fov: 30 });
  camera.transform.lookAt(v3([0, 1.5, 0]), v3([0, 1, 0]));
  camera.clearColor = new Laya.Color(0.7, 0.75, 0.8, 1);
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
  // From the model's left (+X), a little above: the head's +X half is lit, its -X half shaded.
  sun.node.transform.rotationEuler = v3([-20, 90, 0]);
  const library = new Z.ZhudaModelLibrary({ maxIdle: 2 });
  out.library = library;
  const instance = await library.instantiate('avatar.vrm');
  scene.addChild(instance.node);
  const pixel = (world: V) => {
    const p = new Laya.Vector4();
    camera.worldToViewportPoint(v3(world), p);
    return [p.x, p.y];
  };
  const node = (name: string) => instance.find(name);
  const world = (name: string, offset: V = [0, 0, 0]) => {
    const n = node(name),
      o = new Laya.Vector3();
    Laya.Vector3.transformCoordinate(v3(offset), n.transform.worldMatrix, o);
    return p3(o);
  };
  /** Pixels in a box round a point that pass a test. */
  const count = (p: Uint8Array, at: V, half: V, test: (c: number[]) => boolean) => {
    let n = 0;
    for (let y = Math.round(at[1] - half[1]); y <= Math.round(at[1] + half[1]); y++)
      for (let x = Math.round(at[0] - half[0]); x <= Math.round(at[0] + half[0]); x++) {
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const i = (y * W + x) * 4;
        if (test([p[i], p[i + 1], p[i + 2]])) n++;
      }
    return n;
  };
  const mean = (p: Uint8Array, at: V, half = 2) => {
    const s = [0, 0, 0];
    let n = 0;
    for (let y = Math.round(at[1]) - half; y <= Math.round(at[1]) + half; y++)
      for (let x = Math.round(at[0]) - half; x <= Math.round(at[0]) + half; x++, n++)
        for (let c = 0; c < 3; c++) s[c] += p[(y * W + x) * 4 + c];
    return s.map((v) => +(v / n).toFixed(1));
  };
  const dark = (c: number[]) => c[0] + c[1] + c[2] < 200;
  const red = (c: number[]) => c[0] > 120 && c[1] < 60 && c[2] < 60;
  const draw = async (name?: string) => {
    for (let i = 0; i < 3; i++) await frame();
    const p = read();
    if (name) saved[name] = p;
    return p;
  };
  const face = () => {
    const eyes = [world('leftEye', [0, 0, 0.012]), world('rightEye', [0, 0, 0.012])].map(pixel);
    const mouth = pixel(world('head', [0, -0.012, 0.098]));
    return { eyes, mouth };
  };
  const faceRenderer = () => {
    const n = node('FaceMesh');
    return n.getComponent(Laya.MeshRenderer);
  };
  const morphs = () => ({ ...faceRenderer().morphTargetValues });

  // 1. As LayaAir's glTF materials, then as toon.
  const pbr = await draw('pbr');
  const vrm = new Z.ZhudaVrm(instance, { screenHeight: H });
  out.vrm = vrm;
  vrm.update(0);
  const toon = await draw('toon');
  const headCentre = world('head', [0, 0.05, 0]);
  const lit = pixel([headCentre[0] + 0.07, headCentre[1] - 0.01, headCentre[2] + 0.065]);
  const shaded = pixel([headCentre[0] - 0.07, headCentre[1] - 0.01, headCentre[2] + 0.065]);
  const skin = vrm.toonMaterials.get(0);
  const outlineOn = toon;
  skin.setOutline({ color: [0, 0, 0], width: 0, space: 'world' });
  const outlineOff = await draw();
  skin.setOutline({ ...skin.spec.outline, width: 0.006 });
  vrm.update(0);
  const loaded = {
    issues: vrm.issues.map((i: any) => `${i.code} ${i.path}: ${i.message}`),
    expressions: vrm.expressionNames,
    toonMaterials: [...vrm.toonMaterials.keys()],
    springSets: vrm.springBones.length,
    bones: ['hips', 'head', 'leftEye', 'rightHand'].map((b) => vrm.bone(b)?.name ?? null),
    meta: { name: vrm.vrm.meta.name, avatarPermission: vrm.vrm.meta.avatarPermission },
    pbrVsToon: differing(pbr, toon),
    lit: mean(toon, lit),
    shaded: mean(toon, shaded),
    pbrLit: mean(pbr, lit),
    pbrShaded: mean(pbr, shaded),
    outlinePixels: differing(outlineOn, outlineOff),
    slotOfSkin: instance.gltfMaterialSlots.findIndex((s: any) => s.materials[0] === 0),
    slotsAreToon: instance.gltfMaterialSlots.every((s: any) =>
      s.materials.every((m: number, k: number) =>
        m === 0 || m === 1
          ? s.renderer.sharedMaterials[k] === vrm.toonMaterials.get(m).material
          : true,
      ),
    ),
  };
  out.loaded = loaded;

  // 2. Expressions.
  out.expressions = async () => {
    const result: any = {};
    const shot = async (name: string, weights: Record<string, number>) => {
      vrm.resetExpressions();
      for (const [k, w] of Object.entries(weights)) vrm.setExpression(k, w);
      vrm.update(0);
      const p = await draw(name);
      const { eyes, mouth } = face();
      return {
        applied: Object.fromEntries(vrm.appliedExpressions),
        morphs: morphs(),
        pupils: eyes.map((e: V) => count(p, e, [9, 9], dark)),
        mouth: count(p, [mouth[0], mouth[1] + 8], [14, 12], dark),
        redPupils: eyes.map((e: V) => count(p, e, [9, 9], red)),
        skin: mean(p, lit),
        picture: p,
      };
    };
    const rest = await shot('face-rest', {});
    const blink = await shot('face-blink', { blink: 1 });
    const aa = await shot('face-aa', { aa: 1 });
    const happyBlink = await shot('face-happy-blink', { happy: 1, blink: 1 });
    const angry = await shot('face-angry', { angry: 1 });
    const angryAa = await shot('face-angry-aa', { angry: 1, aa: 1 });
    const winkLow = await shot('face-wink-low', { wink: 0.4 });
    const winkHigh = await shot('face-wink-high', { wink: 0.6 });
    await shot('face-surprised', { surprised: 1 });
    const t = vrm.toonMaterials.get(1).material.tilingOffset;
    result.hairTiling = [t.x, t.y, t.z, t.w];
    for (const [k, v] of Object.entries({
      rest,
      blink,
      aa,
      happyBlink,
      angry,
      angryAa,
      winkLow,
      winkHigh,
    })) {
      const { picture, ...rest } = v as any;
      result[k] = rest;
    }
    result.blinkChanged = differing(rest.picture, blink.picture);
    vrm.resetExpressions();
    vrm.update(0);
    result.backToRest = differing(rest.picture, await draw());
    return result;
  };

  // 3. Gaze.
  out.gaze = async () => {
    const turn = (name: string) => q4(node(name).transform.localRotation);
    vrm.setGaze(30, 0);
    vrm.update(0);
    const byAngles = {
      left: angleOf(turn('leftEye')),
      right: angleOf(turn('rightEye')),
      gaze: vrm.gazeAngles,
    };
    const ahead = face().eyes;
    vrm.setGaze(0, 0);
    vrm.update(0);
    const straight = await draw('gaze-ahead');
    // As far to the left as the range maps go (12° and 10°): the pupils' shift is a few pixels.
    vrm.setGaze(90, 0);
    vrm.update(0);
    const farLeft = await draw('gaze-far-left');
    const centre = (p: Uint8Array, at: V) => {
      let sx = 0,
        n = 0;
      for (let y = Math.round(at[1] - 20); y <= Math.round(at[1] + 20); y++)
        for (let x = Math.round(at[0] - 26); x <= Math.round(at[0] + 26); x++) {
          const i = (y * W + x) * 4;
          if (dark([p[i], p[i + 1], p[i + 2]])) {
            sx += x;
            n++;
          }
        }
      return n ? sx / n : null;
    };
    const before = ahead.map((e: V) => centre(straight, e));
    const after = ahead.map((e: V) => centre(farLeft, e));
    // A point ahead of the eyes and to the model's left: yaw atan2(0.5, 1).
    const eyes = world('head', [0, 0.06, 0.09]);
    vrm.lookAt([eyes[0] + 0.5, eyes[1], eyes[2] + 1]);
    vrm.update(0);
    const byPoint = {
      gaze: vrm.gazeAngles,
      left: angleOf(turn('leftEye')),
      right: angleOf(turn('rightEye')),
    };
    vrm.lookAt(null);
    vrm.update(0);
    return {
      byAngles,
      byPoint,
      pupilX: { before, after },
      expectedYaw: (Math.atan2(0.5, 1) * 180) / Math.PI,
    };
  };

  // 4. Constraints.
  out.constraints = () => {
    const head = node('head'),
      hand = node('leftHand');
    const headRest = head.transform.localRotation.clone(),
      handRest = hand.transform.localRotation.clone();
    const axis = (a: V, deg: number) => {
      const h = (deg * Math.PI) / 360;
      return new Laya.Quaternion(
        a[0] * Math.sin(h),
        a[1] * Math.sin(h),
        a[2] * Math.sin(h),
        Math.cos(h),
      );
    };
    head.transform.localRotation = axis([0, 1, 0], 30);
    hand.transform.localRotation = axis([1, 0, 0], 40);
    vrm.update(0);
    const badge = q4(node('badge').transform.localRotation);
    const twist = q4(node('leftTwist').transform.localRotation);
    // The pointer's +Z in the world, against the way to the hand.
    const pointer = node('pointer');
    const forward = new Laya.Vector3();
    Laya.Vector3.transformQuat(v3([0, 0, 1]), pointer.transform.rotation, forward);
    const way = p3(hand.transform.position).map((v, i) => v - p3(pointer.transform.position)[i]);
    const length = Math.hypot(...way);
    const facing = (forward.x * way[0] + forward.y * way[1] + forward.z * way[2]) / length;
    head.transform.localRotation = headRest;
    hand.transform.localRotation = handRest;
    vrm.update(0);
    return {
      badge,
      badgeAngle: angleOf(badge),
      twistAngle: angleOf(twist),
      twist,
      facing,
      badgeAtRest: angleOf(q4(node('badge').transform.localRotation)),
    };
  };

  // 5. Spring bones: the model sways side to side, then stands still.
  out.springs = async () => {
    const tail = () => {
      const t = p3(node('hair4').transform.position),
        h = p3(node('head').transform.position);
      return t.map((v, i) => v - h[i]);
    };
    vrm.resetSpringBones();
    const rest = tail();
    const solvers = vrm.springBones.map((s: any) => s.solver);
    let lag = 0,
      inside = 0;
    const samples: V[] = [];
    camera.transform.position = v3([0.9, 1.35, -0.25]);
    camera.transform.lookAt(v3([0, 1.35, -0.1]), v3([0, 1, 0]));
    const still = await draw('hair-rest');
    let swung: Uint8Array | null = null;
    for (let i = 0; i < 120; i++) {
      instance.node.transform.position = v3([0, 0, Math.sin((i / 60) * Math.PI * 2) * 0.15]);
      vrm.update(1 / 60);
      const t = tail();
      lag = Math.max(lag, Math.hypot(...t.map((v, k) => v - rest[k])));
      inside = Math.max(inside, ...solvers.map((s: any) => s.countInside()));
      if (i % 20 === 0) samples.push(t.map((v) => +v.toFixed(4)));
      if (i === 45) swung = await draw('hair-swung');
    }
    instance.node.transform.position = v3([0, 0, 0]);
    for (let i = 0; i < 360; i++) {
      vrm.update(1 / 60);
      inside = Math.max(inside, ...solvers.map((s: any) => s.countInside()));
    }
    const settled = tail();
    const energy = solvers.reduce((sum: number, s: any) => sum + s.inspect().kineticEnergy, 0);
    const back = await draw('hair-settled');
    camera.transform.position = v3([0, 1.5, 0.75]);
    camera.transform.lookAt(v3([0, 1.5, 0]), v3([0, 1, 0]));
    // A second run of the same deltas from the same start: the same tail to the last bit.
    const replay = async () => {
      instance.node.transform.position = v3([0, 0, 0]);
      vrm.resetSpringBones();
      for (let i = 0; i < 60; i++) {
        instance.node.transform.position = v3([0, 0, Math.sin((i / 60) * Math.PI * 2) * 0.15]);
        vrm.update(1 / 60);
      }
      const t = tail();
      instance.node.transform.position = v3([0, 0, 0]);
      vrm.resetSpringBones();
      return t;
    };
    const first = await replay(),
      second = await replay();
    return {
      rest,
      settled,
      lag,
      settleDistance: Math.hypot(...settled.map((v, k) => v - rest[k])),
      inside,
      energy,
      samples,
      swungPixels: swung ? differing(still, swung) : 0,
      settledPixels: differing(still, back),
      replaySame: first.every((v, k) => v === second[k]),
    };
  };

  // 6. Thirty made and let go: the model's own materials come back, nothing is left.
  out.cycles = async () => {
    const skinSlot = instance.gltfMaterialSlots.find((s: any) => s.materials[0] === 0);
    const original = skinSlot.renderer.sharedMaterials[0];
    const errors: string[] = [];
    for (let i = 0; i < 30; i++) {
      const copy = await library.instantiate('avatar.vrm');
      scene.addChild(copy.node);
      const v = new Z.ZhudaVrm(copy);
      v.setExpression('blink', 1);
      v.update(1 / 60);
      await frame();
      const materials = [...v.toonMaterials.values()].map((t: any) => t.material);
      v.dispose();
      if (materials.some((m: any) => !m.destroyed))
        errors.push(`cycle ${i}: a toon material is left`);
      copy.dispose();
    }
    await frame();
    return {
      errors,
      report: library.report(),
      ownStillToon: skinSlot.renderer.sharedMaterials[0] === vrm.toonMaterials.get(0).material,
      toonBeforeCycles: original === vrm.toonMaterials.get(0).material,
    };
  };
  out.disposeMain = async () => {
    const slot = instance.gltfMaterialSlots.find((s: any) => s.materials[0] === 0);
    const toonMaterial = slot.renderer.sharedMaterials[0];
    vrm.dispose();
    const back = slot.renderer.sharedMaterials[0];
    await frame();
    const after = read();
    return {
      restored: back !== toonMaterial,
      toonDestroyed: toonMaterial.destroyed,
      likePbr: differing(after, pbr),
    };
  };
  await frame();
  out.ready = true;
}
main().catch((error) => {
  out.errors.push(String(error?.stack || error));
  out.error = String(error?.message || error);
});
