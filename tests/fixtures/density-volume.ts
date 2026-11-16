// Browser fixture for scripts/verify-density-volume.mjs: a rock field (a
// patch of rolling ground with loose stones above it) computed as a density
// volume on the GPU (ZhudaComputePass, WebGPU) and in JavaScript, compared
// point by point and meshed with the floating stones removed; loads
// cancelled, timed out and failed; 30 loads and releases with the GPU
// buffers counted. Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__DENSITY__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

// The same field twice. Ground: a height of sines, cut to a box so it does
// not reach the sides of the mesher's box; three stones float above it.
const GLSL = `
float zhudaBox(vec3 p, vec3 c, vec3 h){vec3 q=abs(p-c)-h;return length(max(q,vec3(0.0)))+min(max(q.x,max(q.y,q.z)),0.0);}
float zhudaDensity(vec3 p){
  float height=1.0+0.5*sin(p.x*0.9)*cos(p.z*0.7)+0.25*sin(p.x*2.1+p.z*1.3);
  float ground=max(p.y-height,zhudaBox(p,vec3(0.0,1.0,0.0),vec3(5.0,1.0,5.0)));
  float s1=length(p-vec3(0.0,3.2,0.0))-0.45;
  float s2=length(p-vec3(2.5,3.6,1.5))-0.35;
  float s3=length(p-vec3(-2.0,3.0,-2.5))-0.4;
  return min(ground,min(s1,min(s2,s3)));
}`;
const boxSdf = (x: number, y: number, z: number, c: number[], h: number[]) => {
  const qx = Math.abs(x - c[0]) - h[0],
    qy = Math.abs(y - c[1]) - h[1],
    qz = Math.abs(z - c[2]) - h[2];
  return (
    Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) +
    Math.min(Math.max(qx, Math.max(qy, qz)), 0)
  );
};
const density = (x: number, y: number, z: number) => {
  const height =
    1 + 0.5 * Math.sin(x * 0.9) * Math.cos(z * 0.7) + 0.25 * Math.sin(x * 2.1 + z * 1.3);
  const ground = Math.max(y - height, boxSdf(x, y, z, [0, 1, 0], [5, 1, 5]));
  const s1 = Math.hypot(x, y - 3.2, z) - 0.45;
  const s2 = Math.hypot(x - 2.5, y - 3.6, z - 1.5) - 0.35;
  const s3 = Math.hypot(x + 2, y - 3, z + 2.5) - 0.4;
  return Math.min(ground, s1, s2, s3);
};
const SPEC = {
  name: 'ZhudaCheckRock',
  glsl: GLSL,
  density,
  min: [-5.5, -0.03, -5.5] as [number, number, number],
  max: [5.5, 4.5, 5.5] as [number, number, number],
  cellSize: 0.05,
};

/** Pieces of a mesh and whether it is closed (every edge in two triangles). */
function pieces(mesh: any) {
  const parent = new Int32Array(mesh.positions.length / 3).map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const edges = new Map<number, number>();
  const ix = mesh.indices;
  const n = mesh.positions.length / 3;
  for (let t = 0; t < ix.length; t += 3)
    for (let k = 0; k < 3; k++) {
      const a = ix[t + k],
        b = ix[t + ((k + 1) % 3)];
      parent[find(a)] = find(b);
      const key = Math.min(a, b) * n + Math.max(a, b);
      edges.set(key, (edges.get(key) ?? 0) + 1);
    }
  const roots = new Set<number>();
  for (let t = 0; t < ix.length; t++) roots.add(find(ix[t]));
  return { count: roots.size, closed: [...edges.values()].every((c) => c === 2) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
const outcome = async (work: Promise<unknown>) => {
  try {
    const value: any = await work;
    return { ok: true, backend: value?.backend };
  } catch (error: any) {
    return { ok: false, name: error?.name, message: String(error?.message ?? error).slice(0, 300) };
  }
};

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  const context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: 64,
    height: 64,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
  });
  context.runtime.start(() => {});
  const r: any = { computeSupported: Z.zhudaComputeSupported() };

  // Live GPU buffers, counted from here on (WebGPU).
  const device = renderer === 'webgpu' ? Laya.LayaGL.renderEngine.getDevice() : null;
  let live = 0,
    made = 0;
  if (device) {
    const create = device.createBuffer.bind(device);
    device.createBuffer = (descriptor: any) => {
      const buffer = create(descriptor);
      live++;
      made++;
      const destroy = buffer.destroy.bind(buffer);
      let gone = false;
      buffer.destroy = () => {
        if (!gone) live--;
        gone = true;
        return destroy();
      };
      return buffer;
    };
  }

  // 1. The GPU volume against the JavaScript volume, point by point.
  let started = performance.now();
  const gpu = await Z.computeZhudaDensityVolume(SPEC);
  r.gpuMs = Math.round(performance.now() - started);
  started = performance.now();
  const cpu = await Z.computeZhudaDensityVolume(SPEC, { backend: 'cpu' });
  r.cpuMs = Math.round(performance.now() - started);
  let worst = 0,
    signFlips = 0;
  for (let i = 0; i < cpu.values.length; i++) {
    worst = Math.max(worst, Math.abs(gpu.values[i] - cpu.values[i]));
    if (gpu.values[i] <= 0 !== cpu.values[i] <= 0) signFlips++;
  }
  r.volume = {
    points: cpu.values.length,
    size: cpu.size,
    gpuBackend: gpu.backend,
    cpuBackend: cpu.backend,
    largestDifference: worst,
    signFlips,
  };
  const options = { ...SPEC, distance: density, removeFloating: true };
  const meshGpu = Z.createZhudaIsosurfaceMesh({ ...options, volume: gpu });
  const meshCpu = Z.createZhudaIsosurfaceMesh({ ...options, volume: cpu });
  const meshAll = Z.createZhudaIsosurfaceMesh({ ...options, volume: gpu, removeFloating: false });
  r.mesh = {
    gpu: { vertices: meshGpu.positions.length / 3, ...pieces(meshGpu) },
    cpu: { vertices: meshCpu.positions.length / 3, ...pieces(meshCpu) },
    withStones: { vertices: meshAll.positions.length / 3, ...pieces(meshAll) },
    // Where the two volumes differ by a float's last bits, a quad may be split along its other diagonal.
    largestMove: (() => {
      let worst = 0;
      if (meshGpu.positions.length !== meshCpu.positions.length) return null;
      for (let i = 0; i < meshGpu.positions.length; i++)
        worst = Math.max(worst, Math.abs(meshGpu.positions[i] - meshCpu.positions[i]));
      return worst;
    })(),
  };
  await settle();
  r.liveAfterFirst = live;

  // 2. Cancelled before, cancelled during the read back, timed out, failed.
  const before = new AbortController();
  before.abort();
  r.cancelBefore = await outcome(Z.computeZhudaDensityVolume(SPEC, { signal: before.signal }));
  const during = new AbortController();
  const pending = Z.computeZhudaDensityVolume(SPEC, { signal: during.signal });
  setTimeout(() => during.abort(), 2);
  r.cancelDuring = await outcome(pending);
  r.timeout = await outcome(Z.computeZhudaDensityVolume(SPEC, { timeoutMs: 1 }));
  r.wrongGlsl = await outcome(
    Z.computeZhudaDensityVolume({
      ...SPEC,
      name: 'ZhudaCheckWrong',
      glsl: 'float zhudaDensity(vec3 p){return p.y-1.0;}',
    }),
  );
  r.throwing = await outcome(
    Z.computeZhudaDensityVolume(
      {
        ...SPEC,
        density: () => {
          throw Error('bad rock');
        },
      },
      { backend: 'cpu' },
    ),
  );
  await settle();
  await settle();
  r.liveAfterFailures = live;

  // 3. Thirty loads and releases.
  const startLive = live;
  const heapBefore = (performance as any).memory?.usedJSHeapSize ?? null;
  for (let i = 0; i < 30; i++) {
    const volume = await Z.computeZhudaDensityVolume(SPEC);
    if (volume.values.length !== cpu.values.length) throw Error('a cycle lost points');
  }
  await settle();
  await settle();
  r.cycles = {
    count: 30,
    liveBefore: startLive,
    liveAfter: live,
    buffersMade: made,
    heapBefore,
    heapAfter: (performance as any).memory?.usedJSHeapSize ?? null,
  };
  out.r = r;
  out.backend = {
    selected: context.renderer.selected,
    adapter: context.renderer.adapter ?? null,
  };
  out.rendererErrors = context.renderer.errors.slice(0, 6);
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
