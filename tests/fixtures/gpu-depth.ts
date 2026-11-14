// Real-draw fixture for scripts/verify-gpu-depth.mjs: a compute step for
// many particles against the same step in JavaScript, drawn without a read
// back; a shader's integer, matrix, array and cube-map uniforms and the
// common functions against the arithmetic; screen reflections that read each
// surface's normal and roughness; and a moving thing under temporal
// anti-aliasing with and without its velocity.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__GPU__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) =>
  out.errors.push(String(event.reason?.stack ?? event.reason)),
);

const W = 320,
  H = 200;
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
const round = (v: number, places = 3) => +v.toFixed(places);
/** What a pixel of the screen is as light: the screen's curve undone. */
const toLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const held = () => Z.inspectSceneResources().resources - (Laya.RenderTexture._pool?.length ?? 0);

/** A scene with a camera, and what it made, destroyed together. */
function stage(ambient: V, look: (camera: any) => void) {
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: ambient });
  const camera = Z.Zhuda3D.createCamera(scene, { position: [0, 0, 10] });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.msaa = false;
  look(camera);
  const made: any[] = [];
  const own = <T>(thing: T): T => {
    made.push(thing);
    return thing;
  };
  const box = (size: V, at: V, material: any) => {
    const mesh = own(
      Z.Zhuda3D.createPrimitiveMesh('box', { width: size[0], height: size[1], depth: size[2] }),
    );
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.transform.position = v3(at);
    scene.addChild(node);
    return node;
  };
  return {
    scene,
    camera,
    own,
    box,
    surface: (spec: any) => own(Z.createSurfaceMaterial(spec)),
    end() {
      scene.destroy(true);
      for (const thing of made.splice(0).reverse()) thing.destroy?.();
      flush(2);
    },
  };
}

// --- 1. A compute step for many particles -------------------------------------------
async function particles() {
  const s = stage([0.5, 0.5, 0.5], (camera) => {
    camera.clearColor = new Laya.Color(0.02, 0.02, 0.04, 1);
    camera.fieldOfView = 45;
    camera.transform.position = v3([0, 3, 12]);
    camera.transform.lookAt(v3([0, 2, 0]), v3([0, 1, 0]));
  });
  const code = `void zhudaStep(uint index){
vec4 state=zhudaStates[index];vec4 speed=zhudaSpeeds[index];
float dt=u_ZhudaStep.x;
speed.y-=9.8*dt;state.xyz+=speed.xyz*dt;
if(state.y<0.0){state.y=-state.y;speed.y=-speed.y*0.8;}
zhudaStates[index]=state;zhudaSpeeds[index]=speed;
float s=u_ZhudaStep.y;uint at=index*5u;
zhudaPlaces[at]=vec4(s,0.0,0.0,0.0);zhudaPlaces[at+1u]=vec4(0.0,s,0.0,0.0);zhudaPlaces[at+2u]=vec4(0.0,0.0,s,0.0);zhudaPlaces[at+3u]=vec4(state.xyz,1.0);zhudaPlaces[at+4u]=vec4(1.0,0.0,0.0,0.0);}`;
  // The same step, rounded as a GPU rounds.
  const f = Math.fround;
  const step = (index: number, b: any, u: any) => {
    const state = b.zhudaStates,
      speed = b.zhudaSpeeds,
      i = index * 4;
    const dt = u.u_ZhudaStep[0];
    speed[i + 1] = f(speed[i + 1] - f(f(9.8) * dt));
    for (let k = 0; k < 3; k++) state[i + k] = f(state[i + k] + f(speed[i + k] * dt));
    if (state[i + 1] < 0) {
      state[i + 1] = -state[i + 1];
      speed[i + 1] = f(-speed[i + 1] * f(0.8));
    }
    const size = u.u_ZhudaStep[1];
    b.zhudaPlaces.set(
      [
        size,
        0,
        0,
        0,
        0,
        size,
        0,
        0,
        0,
        0,
        size,
        0,
        state[i],
        state[i + 1],
        state[i + 2],
        1,
        1,
        0,
        0,
        0,
      ],
      index * 20,
    );
  };
  const spec = (name: string, count: number, withStep: boolean) => ({
    name,
    code,
    buffers: {
      zhudaStates: { type: 'vec4', length: count },
      zhudaSpeeds: { type: 'vec4', length: count },
      zhudaPlaces: { type: 'vec4', length: count * 5, vertex: true },
    },
    uniforms: { u_ZhudaStep: { type: 'vec4', value: [1 / 60, 0.05, 0, 0] } },
    ...(withStep ? { step } : {}),
  });
  const seeded = (count: number) => {
    const states = new Float32Array(count * 4),
      speeds = new Float32Array(count * 4);
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < count; i++) {
      states.set([(random() - 0.5) * 8, 1 + random() * 5, (random() - 0.5) * 8, 0], i * 4);
      speeds.set([(random() - 0.5) * 2, random() * 3, (random() - 0.5) * 2, 0], i * 4);
    }
    return { states, speeds };
  };
  const result: any = { supported: Z.zhudaComputeSupported() };
  // Without a step in JavaScript: fine where there is compute, refused where there is none.
  try {
    new Z.ZhudaComputePass(spec('ZhudaGpuNoStep', 64, false)).dispose();
    result.withoutStep = 'made';
  } catch (error) {
    result.withoutStep = (error as any).code ?? String((error as Error).message);
  }

  const N = 20000,
    STEPS = 60;
  const pass = new Z.ZhudaComputePass(spec('ZhudaGpuParticles', N, true));
  result.backend = pass.backend;
  const { states, speeds } = seeded(N);
  pass.write('zhudaStates', states);
  pass.write('zhudaSpeeds', speeds);
  for (let k = 0; k < STEPS; k++) pass.dispatch(N);
  const got = await pass.read('zhudaStates');
  // The same sixty steps in JavaScript.
  const cpu = {
    zhudaStates: states.slice(),
    zhudaSpeeds: speeds.slice(),
    zhudaPlaces: new Float32Array(N * 20),
  };
  for (let k = 0; k < STEPS; k++)
    for (let i = 0; i < N; i++) step(i, cpu, { u_ZhudaStep: [1 / 60, 0.05, 0, 0] });
  let worst = 0;
  for (let i = 0; i < N * 4; i++) worst = Math.max(worst, Math.abs(got[i] - cpu.zhudaStates[i]));
  result.particles = N;
  result.steps = STEPS;
  result.worst = worst;
  // The places the step wrote are what a draw would read.
  const places = await pass.read('zhudaPlaces');
  let wrongPlaces = 0;
  for (let i = 0; i < N; i++)
    for (let k = 0; k < 3; k++)
      if (Math.abs(places[i * 20 + 12 + k] - got[i * 4 + k]) > 1e-6) wrongPlaces++;
  result.wrongPlaces = wrongPlaces;

  // Drawn without a read back: one draw of twenty thousand boxes.
  const before = read();
  const mesh = s.own(Z.Zhuda3D.createPrimitiveMesh('box', { width: 1, height: 1, depth: 1 }));
  const draw = new Z.ZhudaComputedInstances(
    s.scene,
    mesh,
    s.surface({ type: 'unlit', color: [1, 0.7, 0.2, 1] }),
    pass,
    'zhudaPlaces',
    N,
    { bounds: { min: [-20, -1, -20], max: [20, 20, 20] }, castShadow: false },
  );
  flush();
  keep('particles');
  const lit = (p: Uint8ClampedArray) => {
    let n = 0;
    for (let i = 0; i < p.length; i += 4) if (p[i] > 150 && p[i + 2] < 120) n++;
    return n;
  };
  const drawn = read();
  result.litBefore = lit(before);
  result.lit = lit(drawn);
  // Thirty more steps move what is drawn, with nothing handed back and forth.
  for (let k = 0; k < 30; k++) pass.dispatch(N);
  flush();
  const moved = read();
  let changed = 0;
  for (let i = 0; i < drawn.length; i += 4) if (Math.abs(drawn[i] - moved[i]) > 40) changed++;
  result.changedAfterMoreSteps = changed;
  draw.dispose();
  flush();
  result.litAfterDispose = lit(read());

  // What a step costs: the call, and the call with the GPU's work waited for.
  const device = pass.backend === 'webgpu' ? Laya.LayaGL.renderEngine.getDevice() : null;
  const timeOf = async (count: number) => {
    const timed = new Z.ZhudaComputePass(spec('ZhudaGpuTimed' + count, count, true));
    const seedsFor = seeded(count);
    timed.write('zhudaStates', seedsFor.states);
    timed.write('zhudaSpeeds', seedsFor.speeds);
    timed.dispatch(count);
    await device?.queue.onSubmittedWorkDone();
    const start = performance.now();
    for (let k = 0; k < 20; k++) timed.dispatch(count);
    const called = performance.now() - start;
    await device?.queue.onSubmittedWorkDone();
    const done = performance.now() - start;
    timed.dispose();
    const arrays = {
      zhudaStates: seedsFor.states,
      zhudaSpeeds: seedsFor.speeds,
      zhudaPlaces: new Float32Array(count * 20),
    };
    const js = performance.now();
    for (let k = 0; k < 20; k++)
      for (let i = 0; i < count; i++) step(i, arrays, { u_ZhudaStep: [1 / 60, 0.05, 0, 0] });
    return {
      count,
      callMs: round(called / 20, 2),
      doneMs: round(done / 20, 2),
      javascriptMs: round((performance.now() - js) / 20, 2),
    };
  };
  result.timing = [await timeOf(20000), await timeOf(200000), await timeOf(1000000)];

  // Whole numbers, and a buffer the step only reads.
  const counting = new Z.ZhudaComputePass({
    name: 'ZhudaGpuCounting',
    code: 'void zhudaStep(uint index){zhudaCounts[index]=uint(zhudaSeeds[index])*3u+index+uint(u_ZhudaAdd);}',
    buffers: {
      zhudaCounts: { type: 'uint', length: 100 },
      zhudaSeeds: { type: 'float', length: 100, access: 'read' },
    },
    uniforms: { u_ZhudaAdd: { type: 'int', value: 1000 } },
    step: (index: number, b: any, u: any) => {
      b.zhudaCounts[index] = Math.floor(b.zhudaSeeds[index]) * 3 + index + u.u_ZhudaAdd;
    },
  });
  counting.write(
    'zhudaSeeds',
    Float32Array.from({ length: 100 }, (_, i) => i * 2),
  );
  counting.dispatch(100);
  const counts = await counting.read('zhudaCounts');
  result.counts = {
    kind: counts.constructor.name,
    wrong: Array.from(counts).filter((value, i) => value !== i * 6 + i + 1000).length,
    last: counts[99],
  };
  // Fewer indices than the buffer holds: the rest is left alone.
  counting.setUniform('u_ZhudaAdd', 5);
  counting.dispatch(10);
  const partly = await counting.read('zhudaCounts');
  result.counts.partly = [partly[9], partly[10]];
  counting.dispose();
  pass.dispose();
  s.end();
  return result;
}

// --- 2. Uniform types and the common functions -----------------------------------------
function uniforms() {
  const s = stage([1, 1, 1], (camera) => {
    camera.clearColor = new Laya.Color(0, 0, 0, 1);
    camera.orthographic = true;
    camera.orthographicVerticalSize = 5;
    camera.enableHDR = false;
    camera.transform.position = v3([0, 0, 10]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  });
  // 40 pixels a unit.
  const pixel = (x: number, y: number) => [Math.floor(W / 2 + x * 40), Math.floor(H / 2 - y * 40)];
  const shaders: any[] = [];
  const put = (x: number, y: number, size: number, spec: any, textures: any = {}) => {
    const shader = new Z.ZhudaShaderMaterial(
      { schemaVersion: 1, dimension: 3, fog: false, uniforms: {}, ...spec },
      textures,
    );
    shaders.push(shader);
    s.box([size, size, 0.2], [x, y, 0], shader.material);
    return shader;
  };
  const body = (text: string) => `vec4 zhudaSurface(vec2 uv,vec3 p,vec3 n){${text}}`;
  put(-3.5, 2, 0.8, {
    name: 'ZhudaGpuInt',
    uniforms: { u_ZhudaMode: { type: 'int', value: 3 } },
    surface: body('return u_ZhudaMode==3?vec4(0.0,1.0,0.0,1.0):vec4(1.0,0.0,0.0,1.0);'),
  });
  put(-2.5, 2, 0.8, {
    name: 'ZhudaGpuMat',
    uniforms: {
      u_ZhudaTint: { type: 'mat4', value: [0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0.1, 0, 0, 1] },
    },
    surface: body('vec4 c=u_ZhudaTint*vec4(0.2,0.4,0.6,1.0);return vec4(c.rgb,1.0);'),
  });
  const stops = put(-1.5, 2, 0.8, {
    name: 'ZhudaGpuVec4s',
    uniforms: {
      u_ZhudaStops: {
        type: 'vec4',
        length: 4,
        value: [1, 0, 0, 1, 0, 1, 0, 1, 0.2, 0.5, 0.8, 1, 1, 1, 1, 1],
      },
    },
    surface: body('return u_ZhudaStops[2];'),
  });
  put(-0.5, 2, 0.8, {
    name: 'ZhudaGpuFloats',
    uniforms: { u_ZhudaLevels: { type: 'float', length: 3, value: [0.9, 0.3, 0.6] } },
    surface: body('return vec4(u_ZhudaLevels[0],u_ZhudaLevels[1],u_ZhudaLevels[2],1.0);'),
  });
  put(0.5, 2, 0.8, {
    name: 'ZhudaGpuVec3s',
    uniforms: { u_ZhudaPair: { type: 'vec3', length: 2, value: [1, 0, 0, 0.25, 0.5, 0.75] } },
    surface: body('return vec4(u_ZhudaPair[1],1.0);'),
  });
  // A cube map with a colour a face; the face toward the camera is LayaAir's first.
  const faces = [
    [255, 0, 0],
    [0, 255, 0],
    [0, 0, 255],
    [255, 255, 0],
    [0, 255, 255],
    [255, 0, 255],
  ];
  const cube = s.own(new Laya.TextureCube(4, Laya.TextureFormat.R8G8B8A8, false, false));
  cube.setPixelsData(
    faces.map((c) => {
      const data = new Uint8Array(4 * 4 * 4);
      for (let i = 0; i < 16; i++) data.set([...c, 255], i * 4);
      return data;
    }),
    false,
    false,
  );
  put(
    1.5,
    2,
    0.8,
    {
      name: 'ZhudaGpuCube',
      uniforms: { u_ZhudaSky: { type: 'textureCube' } },
      surface: body('return zhudaSample_u_ZhudaSky(n);'),
    },
    { u_ZhudaSky: cube },
  );
  put(2.5, 2, 0.8, {
    name: 'ZhudaGpuWeights',
    common: true,
    surface: body('return vec4(zhudaTriplanarWeights(normalize(vec3(1.0,2.0,3.0))),1.0);'),
  });
  const orange = s.own(new Laya.Texture2D(2, 2, Laya.TextureFormat.R8G8B8A8, false, false, false));
  orange.setPixelsData(new Uint8Array(Array(4).fill([255, 128, 0, 255]).flat()), false, false);
  put(
    3.5,
    2,
    0.8,
    {
      name: 'ZhudaGpuTriplanar',
      common: true,
      uniforms: { u_ZhudaMap: { type: 'texture2D' } },
      surface: body(
        'vec3 w=zhudaTriplanarWeights(n);return zhudaTriplanar(zhudaSample_u_ZhudaMap,p,w,1.0);',
      ),
    },
    { u_ZhudaMap: orange },
  );
  // The common functions over a face of 3 units: 120 pixels, 7.5 a cell of the hash.
  put(-2.4, -0.6, 3, {
    name: 'ZhudaGpuHash',
    common: true,
    surface: body('return vec4(vec3(zhudaHash(floor(uv*16.0))),1.0);'),
  });
  put(0.8, -0.6, 3, {
    name: 'ZhudaGpuNoise',
    common: true,
    surface: body(
      'return vec4(zhudaNoise(uv*6.0),zhudaFbm(uv*4.0),zhudaNoise(vec3(uv*6.0,0.5)),1.0);',
    ),
  });
  flush();
  keep('uniforms');
  const p = read();
  const at = (x: number, y: number) => {
    const [px, py] = pixel(x, y);
    const i = (py * W + px) * 4;
    return [p[i], p[i + 1], p[i + 2]].map((v) => round(toLinear(v)));
  };
  const result: any = {
    read: {
      int: at(-3.5, 2),
      mat4: at(-2.5, 2),
      vec4s: at(-1.5, 2),
      floats: at(-0.5, 2),
      vec3s: at(0.5, 2),
      cube: at(1.5, 2),
      weights: at(2.5, 2),
      triplanar: at(3.5, 2),
    },
    expected: {
      int: [0, 1, 0],
      mat4: [0.7, 0.2, 0.4],
      vec4s: [0.2, 0.5, 0.8],
      floats: [0.9, 0.3, 0.6],
      vec3s: [0.25, 0.5, 0.75],
      cube: [1, 0, 0],
      weights: Z.zhudaTriplanarWeights([1, 2, 3].map((v) => v / Math.sqrt(14))).map((v: number) =>
        round(v),
      ),
      triplanar: [1, round(128 / 255), 0],
    },
  };
  // The hash, cell by cell: sorted, so that which way the face's uv runs does not matter.
  const cells: number[] = [];
  for (let j = 0; j < 16; j++)
    for (let i = 0; i < 16; i++) {
      const [px, py] = pixel(-2.4 - 1.5 + ((i + 0.5) * 3) / 16, -0.6 - 1.5 + ((j + 0.5) * 3) / 16);
      cells.push(toLinear(p[(py * W + px) * 4]));
    }
  const drawn = [...cells].sort((a, b) => a - b);
  const js: number[] = [];
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) js.push(Z.zhudaHash2D(i, j));
  js.sort((a, b) => a - b);
  result.hash = {
    mean: round(cells.reduce((a, b) => a + b, 0) / cells.length),
    min: round(drawn[0]),
    max: round(drawn[255]),
    againstJavaScript: round(Math.max(...drawn.map((v, i) => Math.abs(v - js[i]))), 4),
  };
  // Noise along a row of the other face: channel by channel, how much it moves a pixel.
  const row = (channel: number) => {
    const values: number[] = [];
    const [, py] = pixel(0.8, -0.6);
    const [x0] = pixel(0.8 - 1.4, 0);
    for (let x = x0; x < x0 + 112; x++) values.push(toLinear(p[(py * W + x) * 4 + channel]));
    return values;
  };
  const stats = (values: number[]) => {
    let moved = 0;
    for (let i = 1; i < values.length; i++) moved += Math.abs(values[i] - values[i - 1]);
    return {
      min: round(Math.min(...values)),
      max: round(Math.max(...values)),
      step: round(moved / (values.length - 1), 4),
    };
  };
  result.noise = { noise2: stats(row(0)), fbm: stats(row(1)), noise3: stats(row(2)) };
  // An array is changed while the shader runs.
  stops.setUniform('u_ZhudaStops', [0, 0, 0, 1, 0, 0, 0, 1, 0.9, 0.1, 0.4, 1, 0, 0, 0, 1]);
  flush();
  const again = read();
  const [sx, sy] = pixel(-1.5, 2);
  const i = (sy * W + sx) * 4;
  result.changed = [again[i], again[i + 1], again[i + 2]].map((v) => round(toLinear(v)));
  for (const shader of shaders) shader.dispose();
  s.end();
  return result;
}

// --- 3. Reflections that read each surface ------------------------------------------------
function reflections() {
  const EYE = [0, 1.2, 6],
    LOOK = [0, 0.4, 0],
    FOV = 45;
  const s = stage([0.15, 0.15, 0.15], (camera) => {
    camera.clearColor = new Laya.Color(0.01, 0.01, 0.015, 1);
    camera.fieldOfView = FOV;
    camera.transform.position = v3(EYE);
    camera.transform.lookAt(v3(LOOK), v3([0, 1, 0]));
  });
  const grey = [0.3, 0.3, 0.3, 1];
  // Three strips of floor: a rough one, a smooth one, and a rough one in the
  // material glTF models are drawn with; a bright wall behind them.
  s.box(
    [2, 0.1, 6],
    [-2, -0.05, 0],
    s.surface({ type: 'pbr', color: grey, roughness: 0.9, metallic: 0 }),
  );
  s.box(
    [2, 0.1, 6],
    [0, -0.05, 0],
    s.surface({ type: 'pbr', color: grey, roughness: 0.05, metallic: 0 }),
  );
  const model = s.surface({ type: 'physical', color: grey, roughness: 0.9, metallic: 0 });
  s.box([2, 0.1, 6], [2, -0.05, 0], model);
  s.box([6, 1.5, 0.2], [0, 0.75, -3], s.surface({ type: 'unlit', color: [1, 0.8, 0.3, 1] }));
  const sub = (a: V, b: V) => a.map((v, i) => v - b[i]);
  const dot = (a: V, b: V) => a.reduce((n, v, i) => n + v * b[i], 0);
  const unit = (a: V) => a.map((v) => v / Math.hypot(...a));
  const forward = unit(sub(LOOK, EYE));
  const right = unit([-forward[2], 0, forward[0]]);
  const up = [
    right[1] * forward[2] - right[2] * forward[1],
    right[2] * forward[0] - right[0] * forward[2],
    right[0] * forward[1] - right[1] * forward[0],
  ];
  const pixel = (point: V) => {
    const d = sub(point, EYE);
    const depth = dot(d, forward),
      h = Math.tan(((FOV / 2) * Math.PI) / 180);
    return [
      Math.floor(((dot(d, right) / (depth * h * (W / H)) + 1) / 2) * W),
      Math.floor(((1 - dot(d, up) / (depth * h)) / 2) * H),
    ];
  };
  const mean = (p: Uint8ClampedArray, point: V) => {
    const [cx, cy] = pixel(point);
    let sum = 0,
      n = 0;
    for (let y = cy - 3; y <= cy + 3; y++)
      for (let x = cx - 6; x <= cx + 6; x++) {
        const i = (y * W + x) * 4;
        sum += p[i] + p[i + 1] + p[i + 2];
        n += 3;
      }
    return round(sum / n, 1);
  };
  // On each strip, where the wall is mirrored.
  const spots = { rough: [-2, 0, -1.5], smooth: [0, 0, -1.5], model: [2, 0, -1.5] };
  const result: any = {
    installed: Z.zhudaSurfaceBufferInstalled(),
    supported: Z.zhudaSurfaceBufferSupported(),
    modelShader: model._shader?.name ?? null,
    shots: {},
  };
  const draw = (name: string, options: any, picture = false) => {
    const mirror = options ? new Z.ZhudaScreenReflections(options) : null;
    const film = new Z.ZhudaFilmicPipeline(s.camera, {
      bloom: false,
      ao: false,
      toneMapping: 'none',
      ...(mirror ? { sceneEffects: [mirror.effect] } : {}),
    });
    mirror?.update(EYE, LOOK, FOV, W / H);
    flush(4);
    const p = read();
    result.shots[name] = {
      rough: mean(p, spots.rough),
      smooth: mean(p, spots.smooth),
      model: mean(p, spots.model),
    };
    if (picture) keep('reflections-' + name);
    return { mirror, film };
  };
  const end = (made: { mirror: any; film: any }) => {
    made.film.dispose();
    made.mirror?.dispose();
  };
  end(draw('none', null));
  end(draw('alike', { strength: 2, wetness: 0.5 }, true));
  end(draw('surfaces', { strength: 2, wetness: 0.5, surfaces: true }, true));
  end(draw('surfacesWet', { strength: 2, wetness: 1, surfaces: true }));
  // Switched while it runs: on, and off again.
  const live = draw('liveOff', { strength: 2, wetness: 0.5 });
  live.mirror.setReflections({ strength: 2, wetness: 0.5, surfaces: true });
  flush(4);
  const on = read();
  result.shots.liveOn = {
    rough: mean(on, spots.rough),
    smooth: mean(on, spots.smooth),
    model: mean(on, spots.model),
  };
  live.mirror.setReflections({ strength: 2, wetness: 0.5 });
  flush(4);
  const off = read();
  result.shots.liveOffAgain = {
    rough: mean(off, spots.rough),
    smooth: mean(off, spots.smooth),
    model: mean(off, spots.model),
  };
  end(live);
  s.end();
  return result;
}

// --- 4. A moving thing under temporal anti-aliasing -------------------------------------------
function motion() {
  const s = stage([1, 1, 1], (camera) => {
    camera.clearColor = new Laya.Color(0, 0, 0, 1);
    camera.orthographic = true;
    camera.orthographicVerticalSize = 5;
    camera.transform.position = v3([0, 0, 10]);
    camera.transform.lookAt(v3([0, 0, 0]), v3([0, 1, 0]));
  });
  // 40 pixels a unit. A grey wall, and a striped box that crosses it four pixels a frame.
  s.box([10, 6, 0.1], [0, 0, -1], s.surface({ type: 'unlit', color: [0.2, 0.2, 0.2, 1] }));
  const stripes = s.own(new Laya.Texture2D(8, 1, Laya.TextureFormat.R8G8B8A8, false, false, false));
  stripes.setPixelsData(
    new Uint8Array(
      Array.from({ length: 8 }, (_, i) => (i % 2 ? [0, 0, 0, 255] : [255, 255, 255, 255])).flat(),
    ),
    false,
    false,
  );
  stripes.filterMode = Laya.FilterMode.Point;
  const striped = s.surface({ type: 'unlit', color: [1, 1, 1, 1] });
  striped.albedoTexture = stripes;
  const mover = s.box([1, 1, 1], [-3, 0, 0], striped);
  const SPEED = 0.1,
    FRAMES = 30;
  const row = (p: Uint8ClampedArray) => {
    const values: number[] = [];
    for (let x = 0; x < W; x++) values.push(p[((H / 2) * W + x) * 4]);
    return values;
  };
  const run = (taa: boolean, prepare?: () => void, each?: () => void, picture?: string) => {
    mover.transform.position = v3([-3, 0, 0]);
    const film = new Z.ZhudaFilmicPipeline(s.camera, {
      bloom: false,
      ao: false,
      toneMapping: 'none',
      temporalAA: taa,
    });
    prepare?.();
    flush(8);
    for (let i = 0; i < FRAMES; i++) {
      mover.transform.position = v3([-3 + (i + 1) * SPEED, 0, 0]);
      each?.();
      flush(1);
    }
    const p = read();
    if (picture) keep(picture);
    film.dispose();
    return row(p);
  };
  // The box ends at x = 0: pixels 140..180.
  const sharp = run(false);
  const off = (values: number[], from: number, to: number) => {
    let sum = 0;
    for (let x = from; x < to; x++) sum += Math.abs(values[x] - sharp[x]);
    return round(sum / (to - from), 2);
  };
  const body = (values: number[]) => off(values, 144, 176);
  const trail = (values: number[]) => off(values, 100, 138);
  const result: any = { installed: Z.zhudaObjectMotionInstalled() };
  const smeared = run(true, undefined, undefined, 'motion-untracked');
  result.untracked = { body: body(smeared), trail: trail(smeared) };
  const tracker = new Z.ZhudaObjectMotion();
  let handle: any;
  const followed = run(
    true,
    () => {
      handle = tracker.track(mover);
      tracker.update();
    },
    () => tracker.update(),
    'motion-tracked',
  );
  result.tracked = { body: body(followed), trail: trail(followed) };
  // Let go of: as LayaAir writes it again.
  handle.remove();
  const again = run(true);
  result.untrackedAgain = { body: body(again) };
  tracker.dispose();
  // Standing still, the smoothing leaves the stripes as they are.
  mover.transform.position = v3([0, 0, 0]);
  const stillFilm = new Z.ZhudaFilmicPipeline(s.camera, {
    bloom: false,
    ao: false,
    toneMapping: 'none',
    temporalAA: true,
  });
  flush(12);
  result.still = { body: body(row(read())) };
  stillFilm.dispose();
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
    bgColor: '#000000',
  });
  context.runtime.start(() => {});
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 300));
  // Each part once before anything is counted: what LayaAir keeps after its first use stays.
  const before = held();
  out.compute = await particles();
  out.left = { compute: held() - before };
  out.uniforms = uniforms();
  out.left.uniforms = held() - before;
  out.reflections = reflections();
  out.left.reflections = held() - before;
  out.motion = motion();
  out.left.motion = held() - before;
  out.rendererErrors = context.renderer.errors;
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack ?? error);
});
