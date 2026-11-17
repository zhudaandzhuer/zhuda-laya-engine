// Real-draw fixture for scripts/verify-developer-tooling.mjs: the helpers
// that show what is in a scene (axes, a grid, bounds, lights, a camera, a
// skeleton, the sun's shadow cascades), LayaAir's statistics panel, a shader
// that does not compile, the profiler's draws, triangles and GPU time, and
// the transform gizmo dragged along its handles. What the screen shows is
// read back at the places the arithmetic says the lines are.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__TOOLING__ = out;
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
const dot = (a: V, b: V) => a.reduce((n, v, i) => n + v * b[i], 0);
const cross = (a: V, b: V) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const unit = (a: V) => a.map((v) => v / Math.hypot(...a));
const round3 = (v: number) => +v.toFixed(3);
const flush = (frames = 3) => Z.ZhudaEngine.flushRenderFrames(frames);

// The view: where a point of the world is on the screen, from the camera's own numbers.
const EYE = [6, 5, 9],
  LOOK = [0, 0.5, 0],
  FOV = 45;
const forward = unit(sub(LOOK, EYE)),
  right = unit(cross(forward, [0, 1, 0])),
  up = cross(right, forward);
function pixel(p: V): [number, number] {
  const d = sub(p, EYE);
  const depth = dot(d, forward),
    h = Math.tan(((FOV / 2) * Math.PI) / 180);
  return [
    ((dot(d, right) / (depth * h * (W / H)) + 1) / 2) * W,
    ((1 - dot(d, up) / (depth * h)) / 2) * H,
  ];
}
/** The pixel within `reach` of a world point that is most like a colour, and how far off it is (0..255). */
function nearest(p: Uint8Array, point: V, colour: V, reach = 2) {
  const [cx, cy] = pixel(point);
  let best = Infinity;
  for (let y = Math.floor(cy) - reach; y <= Math.floor(cy) + reach; y++)
    for (let x = Math.floor(cx) - reach; x <= Math.floor(cx) + reach; x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = (y * W + x) * 4;
      const off = Math.max(...colour.map((c, k) => Math.abs(p[i + k] - c * 255)));
      if (off < best) best = off;
    }
  return Math.round(best);
}
const middle = (a: V, b: V, t = 0.5) => a.map((v, i) => v + (b[i] - v) * t);
const difference = (a: Uint8Array, b: Uint8Array) => {
  let changed = 0;
  for (let i = 0; i < a.length; i += 4)
    if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24)
      changed++;
  return changed;
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

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.3, 0.3, 0.3] });
  const camera = Z.Zhuda3D.createCamera(scene, { position: EYE, fov: FOV });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(0.04, 0.05, 0.07, 1);
  camera.msaa = false;
  camera.enableHDR = false;
  camera.fieldOfView = FOV;
  camera.transform.position = v3(EYE);
  camera.transform.lookAt(v3(LOOK), v3([0, 1, 0]));
  const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);

  const meshes: any[] = [],
    materials: any[] = [];
  const surface = (spec: any) => {
    const made = Z.createSurfaceMaterial(spec);
    materials.push(made);
    return made;
  };
  /** Meshes and materials a section makes for itself, gone when it is over. */
  const passing: any[] = [];
  const box = (size: V, at: V, material: any, list: any[] = meshes) => {
    const mesh = Z.Zhuda3D.createPrimitiveMesh('box', {
      width: size[0],
      height: size[1],
      depth: size[2],
    });
    list.push(mesh);
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.castShadow = true;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = v3(at);
    scene.addChild(node);
    return node;
  };
  const grey = surface({ type: 'pbr', color: [0.55, 0.55, 0.55, 1], roughness: 0.8 });
  // Its top a little under the world's own plane, where the axes and the grid are drawn.
  const floor = box([14, 0.1, 14], [0, -0.08, 0], grey);
  const crate = box([1, 1, 1], [0, 0.5, 0], grey);
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 0.95, 0.85, 1], intensity: 1 });
  const SUN = [-1.5, 3, -1];
  sun.node.transform.position = v3(SUN);
  sun.node.transform.rotationEuler = v3([-50, -30, 0]);
  const sunMatrix = sun.node.transform.worldMatrix.elements;
  const sunForward = unit([-sunMatrix[8], -sunMatrix[9], -sunMatrix[10]]);
  const lamp = (kind: 'point' | 'spot', at: V, colour: V) => {
    const holder = new Laya.Sprite3D('lamp');
    scene.addChild(holder);
    holder.transform.position = v3(at);
    const light = holder.addComponent(kind === 'spot' ? Laya.SpotLightCom : Laya.PointLightCom);
    light.color = new Laya.Color(colour[0], colour[1], colour[2], 1);
    light.intensity = 1;
    return { holder, light };
  };
  const point = lamp('point', [-2.5, 1.2, 1.5], [1, 0.8, 0.2]);
  point.light.range = 1.5;
  const spot = lamp('spot', [2.5, 3, 0], [0.3, 0.6, 1]);
  spot.light.range = 3;
  spot.light.spotAngle = 50;
  spot.holder.transform.rotationEuler = v3([-90, 0, 0]);
  // A second camera, looked at and not drawn through.
  const subject = Z.Zhuda3D.createCamera(scene, { position: [-3, 1.5, 5], fov: 40 });
  subject.transform.position = v3([-3, 1.5, 5]);
  subject.transform.lookAt(v3([-1, 0.5, 2]), v3([0, 1, 0]));
  subject.nearPlane = 0.3;
  subject.farPlane = 2.5;
  subject.active = false;
  const provider = new Z.DirectoryAssetProvider({ baseUrl: './fixtures/' });
  const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
  const model = await library.instantiate('character.glb');
  scene.addChild(model.node);
  model.node.transform.position = v3([2, 0, 3]);
  // Held at the first frame of its clip, before anything is drawn: LayaAir
  // moves an animation on by the clock, and a pose that depends on how long
  // the page took to get here once bent the character across the z axis.
  const animator = model.node.getComponent(Laya.Animator);
  if (animator) animator.speed = 0;
  // LayaAir keeps a sun's shadow map once it has made one: made before anything is counted.
  sun.light.shadowMode = Laya.ShadowMode.SoftLow;
  flush();
  sun.light.shadowMode = Laya.ShadowMode.None;
  flush();
  const resourcesBefore = held();
  saved.plain = read();
  /** Resources held beyond the scene's own, after each part. */
  const left: Record<string, number> = (out.left = {});

  // --- 1. A sheet of every helper ---------------------------------------------------
  {
    const draw = new Z.ZhudaDebugDraw(scene);
    const made = {
      axes: draw.axes(null, 1.5),
      // Under the axes, which lie on two of its lines, and over the floor.
      grid: draw.grid({ size: 8, divisions: 8, y: -0.01 }),
      bounds: draw.bounds(crate),
      sun: draw.light(sun.node),
      point: draw.light(point.holder),
      spot: draw.light(spot.light),
      camera: draw.camera(subject),
    };
    // Bones are inside what they move: drawn over everything.
    const over = new Z.ZhudaDebugDraw(scene, { onTop: true });
    over.skeleton(model.node);
    draw.update();
    over.update();
    flush();
    const sheet = (saved.sheet = read());
    const bones = Z.zhudaBonesOf(model.node);
    const frustum = Z.zhudaFrustumLines({
      matrix: subject.transform.worldMatrix.elements,
      fieldOfView: subject.fieldOfView,
      aspect: subject.aspectRatio,
      near: subject.nearPlane,
      far: subject.farPlane,
    });
    // How far the screen is from each helper's colour where its lines are (0 is exact).
    out.sheet = {
      lines: draw.lineCount,
      expected: 3 + 2 * 9 + 12 + 25 + 96 + 36 + 12,
      boneLines: over.lineCount,
      boneLinesExpected: Z.zhudaSkeletonLines(bones).length / 6,
      dropped: draw.dropped,
      bones: bones.length,
      off: {
        axisX: nearest(sheet, [1.2, 0, 0], [1, 0.2, 0.2]),
        axisY: nearest(sheet, [0, 1.3, 0], [0.2, 1, 0.2]),
        axisZ: nearest(sheet, [0, 0, 1.2], [0.3, 0.5, 1]),
        grid: nearest(sheet, [3, -0.01, -3.5], [0.35, 0.35, 0.35]),
        boundsEdge: nearest(sheet, [0.5, 1, 0.1], [1, 0.9, 0.2]),
        sunShaft: nearest(
          sheet,
          SUN.map((v, i) => v + sunForward[i] * 0.75),
          [1, 0.95, 0.85],
        ),
        pointReach: nearest(sheet, [-2.5, 1.2 + 1.5, 1.5], [1, 0.8, 0.2]),
        spotRim: nearest(sheet, [2.5 + Math.tan((25 * Math.PI) / 180) * 3, 0, 0], [0.3, 0.6, 1], 3),
        // The top edge of the rectangle nearest the camera that is shown.
        cameraNear: nearest(
          sheet,
          middle(frustum.slice(36, 39), frustum.slice(39, 42)),
          [1, 0.6, 0.1],
        ),
        bone: nearest(
          sheet,
          middle(bones[1].position, bones[bones[1].parent].position),
          [0.2, 1, 1],
        ),
      },
    };
    // The helpers follow: the crate moves, and its box is where the crate is.
    crate.transform.position = v3([-1.5, 0.5, -1]);
    draw.update();
    flush();
    const moved = (saved.sheetMoved = read());
    out.follows = {
      oldPlace: nearest(moved, [0.5, 1, 0.1], [1, 0.9, 0.2]),
      newPlace: nearest(moved, [-1, 1, -0.9], [1, 0.9, 0.2]),
    };
    crate.transform.position = v3([0, 0.5, 0]);
    // One helper taken away: the others stay.
    made.grid.remove();
    draw.update();
    flush();
    const fewer = read();
    out.removed = {
      lines: draw.lineCount,
      grid: nearest(fewer, [3, -0.01, -3.5], [0.35, 0.35, 0.35]),
      axisX: nearest(fewer, [1.2, 0, 0], [1, 0.2, 0.2]),
    };
    draw.dispose();
    over.dispose();
    flush();
    out.sheetGone = difference(read(), saved.plain);
  }
  left.sheet = held() - resourcesBefore;

  // --- 2. Behind things, or over them -------------------------------------------------
  {
    // A line through the crate: the part inside it is hidden, unless asked otherwise.
    const through = () => [-1.5, 0.5, 0.2, 1.5, 0.5, 0.2];
    const inside = [0.2, 0.5, 0.2];
    const behind = new Z.ZhudaDebugDraw(scene);
    behind.lines(through, [1, 0, 1]);
    behind.update();
    flush();
    const hidden = read();
    behind.dispose();
    const over = new Z.ZhudaDebugDraw(scene, { onTop: true });
    over.lines(through, [1, 0, 1]);
    over.update();
    flush();
    const shown = (saved.onTop = read());
    over.dispose();
    out.onTop = {
      hiddenInside: nearest(hidden, inside, [1, 0, 1]),
      hiddenOutside: nearest(hidden, [1.3, 0.5, 0.2], [1, 0, 1]),
      shownInside: nearest(shown, inside, [1, 0, 1]),
    };
  }
  left.onTop = held() - resourcesBefore;

  // --- 3. What the sun's shadow cascades cover -----------------------------------------
  {
    const draw = new Z.ZhudaDebugDraw(scene);
    draw.shadowCascades();
    draw.update();
    const without = draw.lineCount;
    sun.light.shadowMode = Laya.ShadowMode.SoftLow;
    sun.light.shadowDistance = 12;
    sun.light.shadowResolution = 1024;
    sun.light.shadowCascadesMode = Laya.ShadowCascadesMode.TwoCascades;
    flush();
    draw.update();
    flush();
    saved.cascades = read();
    const spheres = Z.zhudaShadowCascades(scene);
    out.cascades = {
      linesWithoutShadows: without,
      lines: draw.lineCount,
      spheres: spheres.map((s: any) => ({
        center: s.center.map(round3),
        radius: round3(s.radius),
      })),
      // The crate, at the middle of the view, is inside the first sphere.
      // The crate, in the middle of the view, is inside the farthest of them.
      crateInside: spheres.length
        ? round3(Math.hypot(...sub([0, 0.5, 0], spheres.at(-1).center)) / spheres.at(-1).radius)
        : null,
      // The first is nearer the camera than the second.
      nearestFirst: spheres.map((s: any) => round3(Math.hypot(...sub(s.center, EYE)))),
    };
    draw.dispose();
    sun.light.shadowMode = Laya.ShadowMode.None;
    flush();
  }
  left.cascades = held() - resourcesBefore;

  // --- 4. LayaAir's statistics panel ---------------------------------------------------
  {
    const before = read();
    const panel = Z.showZhudaStats({ x: 10, y: 20 });
    flush(4);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    flush(4);
    const shown = (saved.stats = read());
    // The check's own screenshot of the page is taken while the panel is up.
    out.statsShown = true;
    await new Promise((resolve) => setTimeout(resolve, 700));
    out.statsShown = false;
    panel.hide();
    flush(4);
    const hidden = read();
    // Shown again after it was hidden, and hidden twice.
    Z.showZhudaStats();
    flush(2);
    const again = read();
    Z.hideZhudaStats();
    Z.hideZhudaStats();
    flush(2);
    out.stats = {
      fps: Laya.Stat.FPS,
      // Pixels of the game's own picture the panel changed.
      shown: difference(shown, before),
      afterHide: difference(hidden, before),
      shownAgain: difference(again, before),
      afterSecondHide: difference(read(), before),
    };
  }
  left.stats = held() - resourcesBefore;

  // --- 5. A shader that does not compile -----------------------------------------------
  {
    const before = context.renderer.errors.length;
    const broken = new Z.ZhudaShaderMaterial({
      schemaVersion: 1,
      name: 'ZhudaToolingBroken',
      dimension: 3,
      uniforms: {},
      surface:
        'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){\nfloat ok=1.0;\nreturn vec4(notDeclared,ok);\n}',
    });
    const probe = box([0.5, 0.5, 0.5], [0, 2.5, 0], broken.material, passing);
    let threw: string | null = null;
    try {
      flush();
    } catch (error) {
      // LayaAir on WebGPU threw here, on the buffer the failed shader never
      // made, until the engine's adapter (WP23); kept to show that it does not.
      threw = String((error as Error).message ?? error);
    }
    probe.destroy();
    broken.dispose?.();
    try {
      flush();
    } catch {
      // The frame after the probe is gone.
    }
    passing.splice(0).forEach((made) => made.destroy());
    out.shader = { threw, errors: context.renderer.errors.slice(before) };
    // Kept apart from the errors a healthy run must not have.
    out.shaderErrorsAt = [before, context.renderer.errors.length];
  }
  left.shader = held() - resourcesBefore;

  // --- 6. The profiler: draws, triangles, GPU time -------------------------------------
  {
    floor.active = crate.active = model.node.active = false;
    const device = renderer === 'webgpu' ? Laya.LayaGL.renderEngine.getDevice() : null;
    const profiler = new Z.ZhudaRuntimeProfiler();
    if (device) profiler.attachWebGPU(device);
    else profiler.attach(gl);
    const frame = () => {
      profiler.beginFrame();
      flush(1);
      return profiler.endFrame(16, 1);
    };
    flush();
    const base = frame();
    // Ten more boxes, each with a material of its own so that none are drawn together.
    const extra = Array.from({ length: 10 }, (_, i) => {
      const own = Z.createSurfaceMaterial({ type: 'unlit', color: [0.2 + i * 0.05, 0.5, 0.9, 1] });
      const node = box([0.4, 0.4, 0.4], [-3 + i * 0.6, 0.3, 2], own, passing);
      passing.push(own);
      return node;
    });
    extra.forEach((node) => (node.meshRenderer.castShadow = false));
    flush();
    const more = frame();
    out.profiler = {
      source: profiler.report().sources.draw,
      base: { drawCalls: base.drawCalls, triangles: base.triangles },
      more: { drawCalls: more.drawCalls, triangles: more.triangles },
      addedDraws: more.drawCalls - base.drawCalls,
      addedTriangles: more.triangles - base.triangles,
    };
    // GPU time: the same scene, and the same scene under 1,500 sheets of glass
    // that fill the view. (With 500 the two overlapped once in a dozen runs
    // on WebGL: its timer gives the plain scene anything from 0.3 to 1.6 ms.)
    const timed = profiler.enableGpuTiming(device ?? gl);
    out.profiler.gpuTiming = timed;
    out.profiler.gpuSource = profiler.report().sources.gpu;
    if (timed) {
      const median = async (frames: number) => {
        const startAt = profiler.report().totalSamples;
        for (let i = 0; i < frames; i++) {
          frame();
          await new Promise(requestAnimationFrame);
        }
        for (let i = 0; i < 6; i++) await new Promise(requestAnimationFrame);
        frame();
        await new Promise((resolve) => setTimeout(resolve, 100));
        const times = profiler
          .report()
          .samples.slice(startAt)
          .map((s: any) => s.gpuMs)
          .filter((ms: any) => typeof ms === 'number')
          .sort((a: number, b: number) => a - b);
        return {
          timed: times.length,
          ms: times.length ? times[times.length >> 1] : null,
          // Chrome rounds each stamp to 0.1 ms: a frame shorter than that reads
          // 0 or 0.1, and how often 0.1 follows its length, so the mean
          // estimates it where the median stays at 0 (QA-03).
          mean: times.length
            ? times.reduce((a: number, b: number) => a + b, 0) / times.length
            : null,
        };
      };
      const light = await median(40);
      const glass = new Z.ZhudaShaderMaterial({
        schemaVersion: 1,
        name: 'ZhudaToolingGlass',
        dimension: 3,
        uniforms: {},
        blend: 'alpha',
        depthWrite: false,
        fog: false,
        surface: 'vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){return vec4(0.5,0.6,0.7,0.05);}',
      });
      const sheets = Array.from({ length: 1500 }, (_, i) => {
        const node = box(
          [30, 30, 0.01],
          middle(EYE, LOOK, 0.3 + i * 0.0003),
          glass.material,
          passing,
        );
        node.transform.lookAt(v3(EYE), v3([0, 1, 0]));
        node.meshRenderer.castShadow = false;
        return node;
      });
      flush();
      const heavy = await median(40);
      sheets.forEach((node) => node.destroy());
      glass.dispose?.();
      out.profiler.gpu = { light, heavy, reason: profiler.report().gpuTimeReason };
    } else out.profiler.gpuReason = profiler.report().gpuTimeReason;
    profiler.dispose();
    extra.forEach((node) => node.destroy());
    passing.splice(0).forEach((made) => made.destroy());
    // The browser's own methods are back.
    out.profiler.restored =
      renderer === 'webgpu'
        ? ['draw', 'drawIndexed', 'setPipeline'].every((name) =>
            String((globalThis as any).GPURenderPassEncoder.prototype[name]).includes(
              '[native code]',
            ),
          ) &&
          String((globalThis as any).GPUCommandEncoder.prototype.beginRenderPass).includes(
            '[native code]',
          )
        : String((gl as any).drawElements).includes('[native code]');
    floor.active = crate.active = model.node.active = true;
    flush();
  }
  left.profiler = held() - resourcesBefore;

  // --- 7. The gizmo --------------------------------------------------------------------
  {
    const gizmo = new Z.ZhudaTransformGizmo(scene, camera, { size: 0.2 });
    const where = () => {
      const p = crate.transform.position;
      return [p.x, p.y, p.z];
    };
    const start = [0, 0.5, 0];
    gizmo.attach(crate);
    gizmo.update();
    flush();
    saved.gizmoMove = read();
    // How long a handle is: a fifth of the view's height at the crate's distance.
    const reach = 2 * Math.tan(((FOV / 2) * Math.PI) / 180) * dot(sub(start, EYE), forward) * 0.2;
    const axes: Record<string, V> = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] };
    const colours: Record<string, V> = { x: [1, 0.25, 0.25], y: [0.3, 1, 0.3], z: [0.35, 0.55, 1] };
    const along = (axis: V, distance: number) => start.map((v, i) => v + axis[i] * distance);
    out.gizmo = { reach: round3(reach), drawn: {}, moved: {}, missed: false };
    for (const name of ['x', 'y', 'z']) {
      // Drawn over the crate, in the axis' colour.
      out.gizmo.drawn[name] = nearest(
        saved.gizmoMove,
        along(axes[name], reach * 0.6),
        colours[name],
      );
      // Down in the middle of the handle, dragged until the pointer is `reach` further along it.
      const down = pixel(along(axes[name], reach * 0.5)),
        to = pixel(along(axes[name], reach * 1.5));
      const hit = gizmo.pointerDown(down[0], down[1], W, H);
      const dragging = gizmo.pointerMove(to[0], to[1], W, H);
      gizmo.pointerUp();
      out.gizmo.moved[name] = { hit, dragging, axis: name, to: where().map(round3) };
      crate.transform.position = v3(start);
    }
    out.gizmo.missed = gizmo.pointerDown(20, 20, W, H);
    // Lit up under the pointer.
    const hover = pixel(along(axes.x, reach * 0.5));
    gizmo.pointerMove(hover[0], hover[1], W, H);
    gizmo.update();
    flush();
    out.gizmo.hovered = {
      axis: gizmo.axis,
      colour: nearest(read(), along(axes.x, reach * 0.6), [1, 0.9, 0.1]),
    };
    // A turn about Y: down on the ring where it crosses +X, dragged to where it crosses -Z.
    gizmo.set({ mode: 'rotate' });
    gizmo.update();
    flush();
    saved.gizmoTurn = read();
    const ringDown = pixel(along(axes.x, reach)),
      ringTo = pixel(along(axes.z, -reach));
    const ringHit = gizmo.pointerDown(ringDown[0], ringDown[1], W, H);
    const ringAxis = gizmo.axis;
    gizmo.pointerMove(ringTo[0], ringTo[1], W, H);
    gizmo.pointerUp();
    const q = crate.transform.rotation;
    out.gizmo.turned = { hit: ringHit, axis: ringAxis, rotation: [q.x, q.y, q.z, q.w].map(round3) };
    crate.transform.rotation = new Laya.Quaternion(0, 0, 0, 1);
    // A scale along Y: the handle's end pulled to one and a half times its length.
    gizmo.set({ mode: 'scale' });
    gizmo.update();
    flush();
    saved.gizmoScale = read();
    const scaleDown = pixel(along(axes.y, reach)),
      scaleTo = pixel(along(axes.y, reach * 1.5));
    const scaleHit = gizmo.pointerDown(scaleDown[0], scaleDown[1], W, H);
    gizmo.pointerMove(scaleTo[0], scaleTo[1], W, H);
    const s = crate.transform.localScale;
    out.gizmo.scaled = { hit: scaleHit, scale: [s.x, s.y, s.z].map(round3) };
    // Let go of: back where the drag began.
    gizmo.cancel();
    const back = crate.transform.localScale;
    out.gizmo.cancelled = [back.x, back.y, back.z].map(round3);
    gizmo.dispose();
    flush();
    out.gizmoGone = difference(read(), saved.plain);
  }
  left.gizmo = held() - resourcesBefore;

  // --- Nothing left behind ---------------------------------------------------------------
  flush();
  out.rendererErrors = context.renderer.errors.filter(
    (_: string, i: number) => i < out.shaderErrorsAt[0] || i >= out.shaderErrorsAt[1],
  );
  // What the tools left behind, with the scene they were shown on still there.
  out.resourcesLeft = held() - resourcesBefore;
  for (const node of [floor, crate, sun.node, point.holder, spot.holder, subject]) node.destroy();
  model.dispose();
  library.dispose?.();
  provider.dispose?.();
  for (const mesh of meshes) mesh.destroy();
  for (const material of materials) material.destroy();
  flush(2);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack ?? error);
});
