// Real-draw fixture for scripts/verify-spring-bones.mjs: a head that sways,
// a tail of six bones hung behind it that lies against a body going with the
// head, and a ribbon that points sideways at rest. Every delta comes from a
// `ZhudaLayeredClock`; nothing reads the time of day, so a run is the same
// run every time. Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__SPRINGS__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 480,
  H = 360;
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
const flush = (frames = 3) => Z.ZhudaEngine.flushRenderFrames(frames);
const round = (v: number, places = 4) => +v.toFixed(places);
const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);
const hash = (numbers: number[]) => {
  const bytes = new Uint8Array(new Float32Array(numbers).buffer);
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
};
const differ = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4)
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  return n;
};
const at = (node: any): V => {
  const p = node.transform.position;
  return [p.x, p.y, p.z];
};
const far = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const BONE = 0.1,
  BODY = { center: [0, -0.3, 0] as [number, number, number], radius: 0.18 };
/** A scene with a head, a tail of six bones behind it, a ribbon at its side, and a body under it. */
function stage() {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.4, 0.4, 0.45] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [1.9, 1.6, -1.6] });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0.05, 0.06, 0.08, 1);
  camera.msaa = false;
  camera.fieldOfView = 34;
  camera.transform.lookAt(v3([0, 1.35, 0]), v3([0, 1, 0]));
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1 });
  sun.node.transform.rotationEuler = v3([-50, 30, 0]);
  const made: any[] = [];
  const own = <T>(thing: T): T => {
    made.push(thing);
    return thing;
  };
  const paint = (color: V) => own(Z.createSurfaceMaterial({ type: 'pbr', color, roughness: 0.7 }));
  const bead = own(
    Z.Zhuda3D.createPrimitiveMesh('box', { width: 0.05, height: 0.05, depth: 0.05 }),
  );
  const ball = own(Z.Zhuda3D.createPrimitiveMesh('sphere', { radius: 1 }));
  const skin = paint([0.85, 0.65, 0.55, 1]),
    hair = paint([0.25, 0.14, 0.08, 1]),
    silk = paint([0.8, 0.15, 0.2, 1]);
  const head = new Laya.Sprite3D('head');
  scene.addChild(head);
  head.transform.position = v3([0, 1.6, 0]);
  const shape = (parent: any, mesh: any, material: any, size: number, local: V) => {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    parent.addChild(node);
    node.transform.localPosition = v3(local);
    node.transform.localScale = v3([size, size, size]);
    return node;
  };
  shape(head, ball, skin, 0.12, [0, 0, 0]);
  shape(head, ball, skin, BODY.radius, BODY.center);
  /** A chain of joints under `parent`, the first at `from`, each `step` on from the one before. */
  const chain = (parent: any, from: V, step: V, joints: number, material: any) => {
    const nodes: any[] = [];
    for (let i = 0; i < joints; i++) {
      const node = new Laya.Sprite3D('joint');
      (i ? nodes[i - 1] : parent).addChild(node);
      node.transform.localPosition = v3(i ? step : from);
      shape(node, bead, material, 1, [0, 0, 0]);
      nodes.push(node);
    }
    return nodes;
  };
  // The tail starts a little behind the body's skin, so that it lies on it.
  const tail = chain(head, [0, -0.02, -0.12], [0, -BONE, 0], 7, hair),
    ribbon = chain(head, [0.13, 0, 0], [BONE, 0, 0], 5, silk);
  const springs = new Z.ZhudaSpringBones({
    chains: [
      { nodes: tail, stiffness: 3, drag: 3, radius: 0.03 },
      { nodes: ribbon, stiffness: 25, drag: 5, radius: 0.03 },
    ],
    colliders: [{ node: head, type: 'sphere', center: BODY.center, radius: BODY.radius }],
  });
  return {
    scene,
    head,
    tail,
    ribbon,
    springs,
    end() {
      springs.dispose();
      scene.destroy(true);
      for (const thing of made.splice(0).reverse()) (thing.destroy ?? thing.dispose)?.call(thing);
      flush(2);
    },
  };
}

function swing() {
  const run = (last: boolean) => {
    const s = stage();
    const { springs, head, tail, ribbon } = s,
      solver = springs.solver;
    const layers = new Z.ZhudaLayeredClock();
    let inside = 0,
      stretched = 0,
      apart = 0;
    const measure = () => {
      inside = Math.max(inside, solver.countInside());
      // From the nodes themselves: each bone its own length, each joint where the solver has it.
      for (const [id, nodes] of [
        [1, tail],
        [2, ribbon],
      ] as const) {
        const tails = solver.tails(id);
        for (let i = 0; i < nodes.length - 1; i++) {
          stretched = Math.max(stretched, Math.abs(far(at(nodes[i]), at(nodes[i + 1])) - BONE));
          apart = Math.max(
            apart,
            far(at(nodes[i + 1]), [tails[i * 3], tails[i * 3 + 1], tails[i * 3 + 2]]),
          );
        }
      }
    };
    const frames = (n: number, each?: (f: number) => void) => {
      for (let f = 0; f < n; f++) {
        each?.(f);
        layers.advance(1 / 60);
        springs.updateFrom(layers);
        measure();
      }
    };
    const tip = () => at(tail[tail.length - 1]);
    const shot = (name: string) => {
      flush();
      if (last) keep(name);
      return read();
    };
    const result: any = {};
    frames(300);
    const rest = tip();
    result.rest = {
      tip: rest.map((v) => round(v)),
      ribbonTip: at(ribbon[ribbon.length - 1]).map((v) => round(v)),
      energy: round(solver.inspect().kineticEnergy, 8),
      // The tail lies on the body: its nearest joint is the body's radius and its own from the middle.
      nearestToBody: round(
        Math.min(...tail.map((n) => far(at(n), [0, 1.6 + BODY.center[1], 0]))) - BODY.radius,
      ),
    };
    shot('springs-rest');
    // The head sways 30 cm each way along z, once every 1.2 seconds.
    const sway = (f: number) => 0.3 * Math.sin((f / 72) * 2 * Math.PI);
    // How far the tip gets from where it would be if the tail were a stick on the head.
    let off = 0;
    frames(288, (f) => {
      head.transform.position = v3([0, 1.6, sway(f + 1)]);
      const carried = [rest[0], rest[1], rest[2] + sway(f + 1)];
      off = Math.max(off, far(tip(), carried));
      if (f === 250) shot('springs-swing');
    });
    result.sway = { tipOffWhereAStickWouldBe: round(off) };
    // Paused while it swings: nothing moves.
    layers.setPaused('world', true);
    const pausedAt = hash([...tail, ...ribbon].flatMap(at));
    let pausedSteps = 0;
    for (let f = 0; f < 45; f++) {
      layers.advance(1 / 60);
      pausedSteps += springs.updateFrom(layers).steps;
    }
    result.paused = {
      steps: pausedSteps,
      sameJoints: hash([...tail, ...ribbon].flatMap(at)) === pausedAt,
    };
    layers.setPaused('world', false);
    // Five seconds in one delta.
    layers.advance(5);
    result.gap = springs.updateFrom(layers);
    measure();
    // The head stops where it began: the tail comes back to where it hung.
    head.transform.position = v3([0, 1.6, 0]);
    frames(600);
    const settled = shot('springs-settled');
    Object.assign(result, {
      settled: {
        tipFromRest: round(far(tip(), rest), 5),
        energy: round(solver.inspect().kineticEnergy, 8),
      },
      inside,
      bonesOffTheirLength: round(stretched, 6),
      jointsOffTheSolver: round(apart, 6),
      steps: solver.inspect().steps,
      dropped: solver.inspect().dropped,
      joints: hash([...tail, ...ribbon].flatMap(at)),
    });
    s.end();
    return { result, picture: settled };
  };
  const first = run(false),
    second = run(true);
  return {
    ...second.result,
    again: {
      sameJoints: first.result.joints === second.result.joints,
      pixelsThatDiffer: differ(first.picture, second.picture),
    },
  };
}

// Turned from LayaAir's own frame, after its animation: the place a model's springs are called from.
function hooked() {
  const s = stage();
  const layers = new Z.ZhudaLayeredClock();
  let steps = 0;
  const stop = Z.runZhudaAfterAnimation(s.head, () => {
    steps += s.springs.updateFrom(layers).steps;
  });
  const before = at(s.tail[s.tail.length - 1]);
  for (let f = 0; f < 60; f++) {
    s.head.transform.position = v3([0.2 * Math.sin(f / 8), 1.6, 0]);
    layers.advance(1 / 60);
    flush(1);
  }
  const moved = far(at(s.tail[s.tail.length - 1]), before);
  stop();
  const stepsWhenStopped = steps;
  layers.advance(1 / 60);
  flush(1);
  const result = {
    steps: stepsWhenStopped,
    afterStop: steps - stepsWhenStopped,
    tipMoved: round(moved),
    inside: s.springs.solver.countInside(),
  };
  s.end();
  return result;
}

function cycles() {
  const warm = stage();
  flush();
  warm.end();
  const before = held();
  const counts: number[] = [];
  for (let i = 0; i < 30; i++) {
    const s = stage();
    const layers = new Z.ZhudaLayeredClock();
    for (let f = 0; f < 6; f++) {
      layers.advance(1 / 60);
      s.springs.updateFrom(layers);
    }
    flush(1);
    s.end();
    counts.push(held() - before);
  }
  return { leftAfterEach: counts, most: Math.max(...counts) };
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
  const parts: Record<string, () => any> = { swing, hooked, cycles };
  out.left = {};
  const warm = stage();
  flush(2);
  warm.end();
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
