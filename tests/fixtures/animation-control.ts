// Real-draw fixture for scripts/verify-animation-control.mjs: clips mixed
// by weight and laid over one another on some bones, LayaAir's cross-fade
// asked for in seconds, and bones bent to reach a point (two bones, a
// chain, an aim) on a character made by the check. Most of what is checked
// is read from the bones themselves; the pictures are for looking at.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__ANIMATION__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300;
let context: any;
let gl: WebGL2RenderingContext | null = null;

function read() {
  if (gl) {
    const raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return pixels;
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const copy = canvas.getContext('2d', { willReadFrequently: true })!;
  copy.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy.getImageData(0, 0, W, H).data.buffer);
}
function png(pixels: Uint8Array) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const image = canvas.getContext('2d')!.createImageData(W, H);
  image.data.set(pixels);
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
const saved: Record<string, Uint8Array> = {};
out.picture = (name: string) => png(saved[name]);
out.pictures = () => Object.keys(saved);

type V = number[];
const v3 = (a: V) => new Laya.Vector3(a[0], a[1], a[2]);
const sub = (a: V, b: V) => a.map((v, i) => v - b[i]);
const add = (a: V, b: V) => a.map((v, i) => v + b[i]);
const scale = (a: V, s: number) => a.map((v) => v * s);
const dot = (a: V, b: V) => a.reduce((s, v, i) => s + v * b[i], 0);
const unit = (a: V) => scale(a, 1 / Math.hypot(...a));
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (low: number, high: number, x: number) => {
  const t = clamp01((x - low) / (high - low));
  return t * t * (3 - 2 * t);
};
/** What the screen shows for a linear value, without a grade. */
const shown = (linear: number) => 255 * clamp01(linear) ** (1 / 2.2);
const at = (p: Uint8Array, x: number, y: number) => {
  const i = (Math.round(y) * W + Math.round(x)) * 4;
  return [p[i], p[i + 1], p[i + 2]];
};
/** Mean colour of a square round a point. */
const patch = (p: Uint8Array, cx: number, cy: number, half = 2) => {
  const sum = [0, 0, 0];
  let n = 0;
  for (let y = Math.round(cy) - half; y <= Math.round(cy) + half; y++)
    for (let x = Math.round(cx) - half; x <= Math.round(cx) + half; x++, n++)
      for (let c = 0; c < 3; c++) sum[c] += p[(y * W + x) * 4 + c];
  return sum.map((v) => +(v / n).toFixed(1));
};
const far = (a: V, b: V) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const difference = (a: Uint8Array, b: Uint8Array) => {
  let sum = 0,
    worst = 0;
  for (let i = 0; i < a.length; i += 4)
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c] - b[i + c]);
      sum += d;
      if (d > worst) worst = d;
    }
  return { mean: +(sum / ((a.length / 4) * 3)).toFixed(3), worst };
};

const quat = (q: any): number[] => [q.x, q.y, q.z, q.w];
const where = (node: any): number[] => {
  const p = node.transform.position;
  return [p.x, p.y, p.z];
};
const span = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** Two rotations mixed as the blend mixes them: added on the same side, made a unit again. */
const mixTurns = (a: number[], b: number[], share: number) => {
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1;
  const sum = a.map((v, i) => v * (1 - share) + b[i] * share * sign);
  const size = Math.hypot(...sum);
  return sum.map((v) => v / size);
};
/** The largest difference between two rotations, whichever sign they are written with. */
const turnGap = (a: number[], b: number[]) =>
  Math.min(
    far(a, b),
    far(
      a,
      b.map((v) => -v),
    ),
  );
const refuse = (make: () => unknown) => {
  try {
    make();
    return 'accepted';
  } catch (error) {
    return String((error as Error).message);
  }
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
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
  };
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.35, 0.37, 0.4] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 1.2, 9], fov: 40 });
  camera.clearColor = new Laya.Color(0.45, 0.5, 0.55, 1);
  camera.enableHDR = false;
  camera.msaa = false;
  camera.orthographic = true;
  camera.orthographicVerticalSize = 6;
  camera.transform.position = v3([0, 1.5, 10]);
  camera.transform.lookAt(v3([0, 1.5, 0]), v3([0, 1, 0]));
  /** The pixel of a world point: the view is flat, 50 pixels a metre, looking along -Z. */
  const pixel = (p: number[]): [number, number] => [W / 2 + p[0] * 50, H / 2 - (p[1] - 1.5) * 50];
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1.1 });
  sun.node.transform.rotationEuler = v3([-40, 25, 0]);
  const frame = (name?: string) => {
    Z.ZhudaEngine.flushRenderFrames(3);
    const p = read();
    if (name) saved[name] = p;
    return p;
  };
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
  frame();
  const resourcesBefore = held();
  const provider = new Z.DirectoryAssetProvider({ baseUrl: './fixtures/' });
  const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
  const background = at(frame(), 20, 20);
  const isLimb = (c: number[]) => far(c, background) > 40;

  // 1. Clips mixed by weight. Read from the bones: a mix of two clips is the two poses mixed.
  {
    const model = await library.instantiate('character.glb');
    scene.addChild(model.node);
    const joints = Array.from({ length: 12 }, (_, k) => model.find('joint' + k));
    const turns = () => joints.map((joint: any) => quat(joint.transform.localRotation));
    // Each clip alone, posed by LayaAir's own animation at 0.3 s.
    const alone: Record<string, { turns: number[][]; picture: Uint8Array }> = {};
    for (const clip of ['Bend', 'Sway']) {
      const sampler = new Z.ZhudaModelAnimationSampler(model, '$', clip);
      sampler.sample(0.3);
      alone[clip] = { turns: turns(), picture: frame('alone-' + clip) };
      sampler.dispose();
    }
    const blend = new Z.ZhudaAnimationBlend(model, '$', ['Bend', 'Sway']);
    const result: any = (out.blend = { clips: blend.clips });
    const gap = (expected: number[][]) =>
      Math.max(...turns().map((turn, k) => turnGap(turn, expected[k])));
    blend.apply([1, 0], 0.3);
    result.allBend = {
      turns: gap(alone.Bend.turns),
      picture: difference(alone.Bend.picture, frame()),
    };
    blend.apply([0, 1], 0.3);
    result.allSway = {
      turns: gap(alone.Sway.turns),
      picture: difference(alone.Sway.picture, frame()),
    };
    // Weights need not add up to 1: they are made to.
    for (const [name, weights, share] of [
      ['half', [1, 1], 0.5],
      ['quarter', [3, 1], 0.25],
      ['most', [0.1, 0.9], 0.9],
    ] as [string, number[], number][]) {
      blend.apply(weights, 0.3);
      const expected = alone.Bend.turns.map((turn, k) =>
        mixTurns(turn, alone.Sway.turns[k], share),
      );
      const picture = frame('blend-' + name);
      result[name] = {
        turns: gap(expected),
        fromBend: difference(alone.Bend.picture, picture).mean,
        fromSway: difference(alone.Sway.picture, picture).mean,
      };
    }
    // The same weights and phase again: the same pose. A whole round later: the same pose.
    blend.apply([1, 1], 0.3);
    const once = turns();
    blend.apply([1, 1], 0.3);
    result.again = gap(once);
    blend.apply([1, 1], 1.3);
    result.nextRound = gap(once);
    // What a pose from two clips costs, on twelve bones.
    {
      const started = performance.now();
      for (let i = 0; i < 2000; i++) blend.apply([1, 1], (i % 100) / 100);
      result.applyMs = +((performance.now() - started) / 2000).toFixed(4);
    }
    // One clip laid over the other from the seventh joint up.
    blend.apply([1, 0], 0.3);
    blend.overlay('Sway', 0.3, 1, ['joint6']);
    const over = turns();
    result.overlay = {
      below: Math.max(...over.slice(0, 6).map((turn, k) => turnGap(turn, alone.Bend.turns[k]))),
      above: Math.max(...over.slice(6).map((turn, k) => turnGap(turn, alone.Sway.turns[k + 6]))),
      picture: difference(alone.Bend.picture, frame('overlay')).mean,
    };
    blend.apply([1, 0], 0.3);
    blend.overlay('Sway', 0.3, 0.5, ['joint6']);
    const halfOver = turns();
    result.overlayHalf = Math.max(
      ...halfOver
        .slice(6)
        .map((turn, k) =>
          turnGap(turn, mixTurns(alone.Bend.turns[k + 6], alone.Sway.turns[k + 6], 0.5)),
        ),
    );
    result.refused = {
      owned: refuse(() => new Z.ZhudaModelAnimationSampler(model, '$', 'Bend')),
      weights: refuse(() => blend.apply([1], 0.3)),
      zero: refuse(() => blend.apply([0, 0], 0.3)),
      clip: refuse(() => blend.overlay('Jump', 0, 1, ['joint6'])),
      under: refuse(() => blend.overlay('Sway', 0, 1, [])),
      unknown: refuse(() => new Z.ZhudaAnimationBlend(model, '$', ['Bend', 'Jump'])),
    };
    blend.dispose();
    // Given back: a sampler may take it again.
    const after = new Z.ZhudaModelAnimationSampler(model, '$', 'Bend');
    after.dispose();
    result.refused.disposed = refuse(() => blend.apply([1, 0], 0));

    // 2. LayaAir's own cross-fade, asked for in seconds.
    const inspector = new Z.ZhudaModelInspector(model);
    const animator = model.node.getComponent(Laya.Animator);
    const playing = () => animator.getCurrentAnimatorPlayState(0)?.animatorState?.name ?? null;
    inspector.play('$', 'Bend');
    Z.ZhudaEngine.flushRenderFrames(6);
    const before = playing();
    inspector.crossFade('$', 'Sway', { seconds: 0.2 });
    Z.ZhudaEngine.flushRenderFrames(30);
    out.crossFade = {
      before,
      after: playing(),
      refused: {
        state: refuse(() => inspector.crossFade('$', 'Jump')),
        seconds: refuse(() => inspector.crossFade('$', 'Sway', { seconds: -1 })),
      },
    };
    model.dispose();
    frame();
  }

  // 3. Two bones bent to put a foot on sloping ground.
  {
    const slope = (x: number) => 0.25 * x;
    const slab = Z.Zhuda3D.createPrimitiveMesh('box', { width: 12, height: 0.2, depth: 4 });
    const ground = new Laya.MeshSprite3D(slab);
    const paint = Z.createSurfaceMaterial({
      type: 'pbr',
      color: [0.5, 0.55, 0.45, 1],
      roughness: 0.9,
    });
    ground.meshRenderer.sharedMaterial = paint;
    // Its top face on the line y = 0.25 x: turned by the slope, lowered by its half thickness along its own up.
    const tilt = Math.atan(0.25);
    ground.transform.rotationEuler = v3([0, 0, (tilt * 180) / Math.PI]);
    ground.transform.position = v3([Math.sin(tilt) * 0.1, -Math.cos(tilt) * 0.1, 0]);
    scene.addChild(ground);
    const legs: any[] = [];
    // LayaAir's own playback poses the bones again every frame: each model is held at a pose instead,
    // as a game holds it by solving after the animation, every frame.
    const holds: any[] = [];
    const feet: any[] = (out.feet = []);
    for (const x of [-2, -1, 0, 1, 2]) {
      const leg = await library.instantiate('leg.glb');
      scene.addChild(leg.node);
      // Hung by the hip: the model stands on its first joint, so it is turned over.
      leg.node.transform.position = v3([x, 1.6, 0]);
      leg.node.transform.rotationEuler = v3([180, 0, 0]);
      const hold = new Z.ZhudaModelAnimationSampler(leg, '$', 'Bend');
      hold.sample(0);
      holds.push(hold);
      const hip = leg.find('joint0'),
        knee = leg.find('joint1'),
        ankle = leg.find('joint2');
      // The foot is the tip of the capsule, a third of the leg past the last joint.
      const foot = new Laya.Sprite3D('foot');
      ankle.addChild(foot);
      foot.transform.localPosition = v3([0, 2 / 3, 0]);
      const lengths = [span(where(hip), where(knee)), span(where(knee), where(foot))];
      const hanging = where(foot);
      const target = [x, slope(x), 0];
      const solver = new Z.ZhudaTwoBoneIK(hip, knee, foot);
      const solved = solver.solve(target, { pole: [x + 3, 1, 0] });
      feet.push({
        x,
        hanging: hanging.map((v) => +v.toFixed(3)),
        target,
        foot: where(foot).map((v) => +v.toFixed(4)),
        miss: +span(where(foot), target).toFixed(5),
        reached: solved.reached,
        knee: where(knee).map((v) => +v.toFixed(3)),
        stretch: [
          +(span(where(hip), where(knee)) - lengths[0]).toFixed(6),
          +(span(where(knee), where(foot)) - lengths[1]).toFixed(6),
        ],
      });
      legs.push(leg);
    }
    const picture = frame('ik-slope');
    // A little way up the shin from each foot the leg is drawn.
    for (const footing of feet)
      footing.drawn = isLimb(
        at(
          picture,
          ...pixel([
            footing.foot[0] + (footing.knee[0] - footing.foot[0]) * 0.2,
            footing.foot[1] + (footing.knee[1] - footing.foot[1]) * 0.2,
            0,
          ]),
        ),
      );
    // Half the weight: the foot is half way from where it hung to the ground.
    {
      const leg = await library.instantiate('leg.glb');
      scene.addChild(leg.node);
      leg.node.transform.position = v3([0, 1.6, 0]);
      leg.node.transform.rotationEuler = v3([180, 0, 0]);
      const foot = new Laya.Sprite3D('foot');
      leg.find('joint2').addChild(foot);
      foot.transform.localPosition = v3([0, 2 / 3, 0]);
      const sampler = new Z.ZhudaModelAnimationSampler(leg, '$', 'Bend');
      sampler.sample(0);
      const hanging = where(foot);
      const solver = new Z.ZhudaTwoBoneIK(leg.find('joint0'), leg.find('joint1'), foot);
      solver.solve([0.6, 0.4, 0], { weight: 0.5 });
      out.halfWeight = {
        foot: where(foot).map((v) => +v.toFixed(4)),
        want: hanging.map((v, i) => +((v + [0.6, 0.4, 0][i]) / 2).toFixed(4)),
      };
      // After an animated pose: the solver starts from where the clip left the bones.
      sampler.sample(0.5);
      const posed = where(foot);
      const reached = solver.solve([0.5, 0.3, 0.2]);
      out.afterClip = {
        moved: +span(posed, hanging).toFixed(3),
        miss: +span(where(foot), [0.5, 0.3, 0.2]).toFixed(5),
        reached: reached.reached,
      };
      sampler.dispose();
      leg.dispose();
    }
    // While LayaAir plays a clip itself: solved every frame after the animation and before the draw.
    {
      for (const each of legs) each.node.active = false;
      const leg = await library.instantiate('leg.glb');
      scene.addChild(leg.node);
      leg.node.transform.position = v3([0, 1.6, 0]);
      leg.node.transform.rotationEuler = v3([180, 0, 0]);
      const foot = new Laya.Sprite3D('foot');
      leg.find('joint2').addChild(foot);
      foot.transform.localPosition = v3([0, 2 / 3, 0]);
      const solver = new Z.ZhudaTwoBoneIK(leg.find('joint0'), leg.find('joint1'), foot);
      new Z.ZhudaModelInspector(leg).play('$', 'Sway');
      const target = [0.3, 0.1, 0];
      let solves = 0;
      // In a late update it would be undone: LayaAir poses the bones after it.
      // In a pre-render it would move the bones and not the mesh: the skin is worked out before it.
      let undone = 0;
      const Late = class extends Laya.Script {
        onLateUpdate() {
          solver.solve(target, { pole: [3, 1, 0] });
        }
      };
      const late = leg.node.addComponent(Late);
      Z.ZhudaEngine.flushRenderFrames(6);
      undone = +span(where(foot), target).toFixed(3);
      late.destroy();
      const Pre = class extends Laya.Script {
        onPreRender() {
          solver.solve(target, { pole: [3, 1, 0] });
        }
      };
      const pre = leg.node.addComponent(Pre);
      const tooLate = frame();
      const shin = (picture: Uint8Array) => {
        const knee = where(leg.find('joint1'));
        return isLimb(
          at(
            picture,
            ...pixel([
              target[0] + (knee[0] - target[0]) * 0.2,
              target[1] + (knee[1] - target[1]) * 0.2,
              0,
            ]),
          ),
        );
      };
      const preRender = { miss: +span(where(foot), target).toFixed(3), drawn: shin(tooLate) };
      pre.destroy();
      const stop = Z.runZhudaAfterAnimation(leg.node, () => {
        solver.solve(target, { pole: [3, 1, 0] });
        solves++;
      });
      Z.ZhudaEngine.flushRenderFrames(12);
      const playing = frame('ik-while-playing');
      const knee = where(leg.find('joint1'));
      out.whilePlaying = {
        solves,
        miss: +span(where(foot), target).toFixed(5),
        drawn: isLimb(
          at(
            playing,
            ...pixel([
              target[0] + (knee[0] - target[0]) * 0.2,
              target[1] + (knee[1] - target[1]) * 0.2,
              0,
            ]),
          ),
        ),
        undone,
        preRender,
      };
      stop();
      stop();
      const before = solves;
      Z.ZhudaEngine.flushRenderFrames(4);
      out.whilePlaying.stopped = solves === before;
      leg.dispose();
      for (const each of legs) each.node.active = true;
    }
    for (const hold of holds) hold.dispose();
    for (const leg of legs) leg.dispose();
    ground.destroy(true);
    slab.destroy();
    paint.destroy();
    frame();
  }

  // 4. A chain of twelve joints reaching for a point, and a box turned to face one.
  {
    const model = await library.instantiate('character.glb');
    scene.addChild(model.node);
    model.node.transform.position = v3([-1.5, 0, 0]);
    const joints = Array.from({ length: 12 }, (_, k) => model.find('joint' + k));
    const hold = new Z.ZhudaModelAnimationSampler(model, '$', 'Bend');
    hold.sample(0);
    const lengths = joints
      .slice(1)
      .map((joint: any, k: number) => span(where(joint), where(joints[k])));
    const root = where(joints[0]);
    const target = [-0.4, 1.2, 0.3];
    const chain = new Z.ZhudaChainIK(joints);
    const solved = chain.solve(target, { iterations: 80, tolerance: 1e-4 });
    out.chain = {
      reached: solved.reached,
      error: +solved.error.toFixed(6),
      miss: +span(where(joints[11]), target).toFixed(5),
      rootMoved: +span(where(joints[0]), root).toFixed(6),
      stretch: Math.max(
        ...joints
          .slice(1)
          .map((joint: any, k: number) =>
            Math.abs(span(where(joint), where(joints[k])) - lengths[k]),
          ),
      ),
      beyond: (() => {
        const far = chain.solve([40, 0, 0]);
        return { reached: far.reached, endX: +where(joints[11])[0].toFixed(3) };
      })(),
    };
    // The picture is of the chain on its target, not stretched toward the far one.
    hold.sample(0);
    chain.solve(target, { iterations: 80, tolerance: 1e-4 });
    const reaching = frame('ik-chain');
    out.chain.drawn = isLimb(at(reaching, ...pixel([target[0] - 0.05, target[1] - 0.1, 0])));
    hold.dispose();
    model.dispose();
    const block = Z.Zhuda3D.createPrimitiveMesh('box', { width: 0.3, height: 0.3, depth: 1.2 });
    const head = new Laya.MeshSprite3D(block);
    const paint = Z.createSurfaceMaterial({
      type: 'pbr',
      color: [0.9, 0.8, 0.3, 1],
      roughness: 0.6,
    });
    head.meshRenderer.sharedMaterial = paint;
    head.transform.position = v3([1.5, 1.5, 0]);
    scene.addChild(head);
    const facing = () => {
      const q = quat(head.transform.rotation);
      return Z.zhudaQuatRotate(q, [0, 0, -1]) as number[];
    };
    const aim = new Z.ZhudaAimIK(head);
    const look = [4.5, 3.5, -1];
    const toward = unit(sub(look, [1.5, 1.5, 0]));
    aim.solve(look);
    const whole = dot(facing(), toward);
    head.transform.rotation = new Laya.Quaternion(0, 0, 0, 1);
    aim.solve(look, { maxDeg: 20 });
    const limited = (Math.acos(Math.min(1, dot(facing(), [0, 0, -1]))) * 180) / Math.PI;
    out.aim = { whole: +whole.toFixed(6), limitedDeg: +limited.toFixed(3) };
    frame('ik-aim');
    out.ikRefused = {
      nodes: refuse(() => new Z.ZhudaTwoBoneIK(null, null, null)),
      chain: refuse(() => new Z.ZhudaChainIK([head])),
      weight: refuse(() => aim.solve([0, 0, 0], { weight: 3 })),
      angle: refuse(() => aim.solve([0, 0, 0], { maxDeg: 400 })),
    };
    head.destroy(true);
    block.destroy();
    paint.destroy();
  }

  library.dispose?.();
  provider.dispose?.();
  frame();
  out.resourcesLeft = held() - resourcesBefore;
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
