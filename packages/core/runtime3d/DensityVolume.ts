/**
 * A density volume for `createZhudaIsosurfaceMesh`, computed on the GPU at
 * load and read back once.
 *
 * The consumer writes its density twice: in GLSL (`float zhudaDensity(vec3
 * p)`, negative inside) for the GPU, and in JavaScript (`density`) for a
 * backend without compute (WebGL) and as the reference. On WebGPU a
 * `ZhudaComputePass` fills the grid `zhudaIsosurfaceGrid` gives for the box;
 * elsewhere the pass's JavaScript step runs over the grid in slices, with
 * the browser given a turn between them, so a large grid can still be
 * cancelled or run out of time part way. Before a GPU result is
 * used it is checked against the JavaScript density at sample points: a
 * shader that failed to compile, or that computes another field, is a
 * failure, not rock.
 *
 * A load: an `AbortSignal`, a time limit, the pass disposed on every path,
 * and no result once cancelled.
 */
import {
  ZhudaComputePass,
  validateZhudaComputeSpec,
  zhudaComputeSupported,
  type ZhudaComputeSpec,
} from './ComputePass.ts';
import { zhudaIsosurfaceGrid, type ZhudaDensityVolume } from '../procedural/Isosurface.ts';

type Vec3 = [number, number, number];

export interface ZhudaDensitySpec {
  /** `Zhuda` and letters, digits or `_`: names the compute code (one name, one code). */
  name: string;
  /** GLSL: `float zhudaDensity(vec3 p)` and what it calls; negative inside. */
  glsl: string;
  /** The same density in JavaScript: the fallback and the reference. */
  density: (x: number, y: number, z: number) => number;
  /** The box the mesh is made in, as for `createZhudaIsosurfaceMesh`. */
  min: Vec3;
  max: Vec3;
  cellSize: number;
}

export interface ZhudaDensityOptions {
  signal?: AbortSignal;
  /** Milliseconds before the load gives up (default 30 000). */
  timeoutMs?: number;
  /** `'cpu'` runs the JavaScript density even where there is compute (default `'auto'`). */
  backend?: 'auto' | 'cpu';
  /**
   * Grid points where a GPU result is compared with the JavaScript density
   * (default 64, spread over the grid); 0 skips the check.
   */
  checkPoints?: number;
  /** Largest difference the check allows, in the field's units (default 1e-3 × cellSize + 1e-4). */
  tolerance?: number;
}

const LIMIT = 16777216;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown): v is Vec3 => Array.isArray(v) && v.length === 3 && v.every(finite);

/** Lists what is wrong with a density spec; empty when it can be used. Needs no GPU. */
export function validateZhudaDensitySpec(spec: ZhudaDensitySpec): string[] {
  const s = (spec ?? {}) as ZhudaDensitySpec;
  const issues: string[] = [];
  if (typeof s.name !== 'string' || !/^Zhuda[A-Za-z0-9_]{1,100}$/.test(s.name))
    issues.push('name: start with Zhuda, then letters, digits or _');
  if (typeof s.glsl !== 'string' || !/\bfloat\s+zhudaDensity\s*\(\s*vec3\s+\w+\s*\)/.test(s.glsl))
    issues.push('glsl: define float zhudaDensity(vec3 p)');
  if (typeof s.density !== 'function') issues.push('density: the same field in JavaScript');
  if (!isVec(s.min) || !isVec(s.max) || !s.min.every((v, k) => v < s.max[k]))
    issues.push('min and max: three numbers each, min below max');
  if (!(finite(s.cellSize) && s.cellSize > 0)) issues.push('cellSize: a positive number of metres');
  if (!issues.length) {
    const { size } = zhudaIsosurfaceGrid(s.min, s.max, s.cellSize);
    const points = size[0] * size[1] * size[2];
    if (points > LIMIT)
      issues.push(`the grid has ${size.join(' x ')} = ${points} points; at most ${LIMIT}`);
  }
  if (!issues.length) issues.push(...validateZhudaComputeSpec(computeSpec(s, 1)));
  return issues;
}

function computeSpec(spec: ZhudaDensitySpec, length: number): ZhudaComputeSpec {
  return {
    name: spec.name,
    code: `${spec.glsl}
void zhudaStep(uint index){
  uint nx=uint(u_ZhudaGrid.x);uint ny=uint(u_ZhudaGrid.y);
  uint x=index%nx;uint y=(index/nx)%ny;uint z=index/(nx*ny);
  vec3 p=u_ZhudaOrigin.xyz+vec3(float(x),float(y),float(z))*u_ZhudaOrigin.w;
  zhudaValues[index]=zhudaDensity(p);
}`,
    buffers: { zhudaValues: { type: 'float', length } },
    uniforms: { u_ZhudaOrigin: { type: 'vec4' }, u_ZhudaGrid: { type: 'vec4' } },
    step: (index, buffers, uniforms) => {
      const o = uniforms.u_ZhudaOrigin as number[],
        g = uniforms.u_ZhudaGrid as number[];
      const nx = g[0],
        ny = g[1];
      const x = index % nx,
        y = Math.floor(index / nx) % ny,
        z = Math.floor(index / (nx * ny));
      (buffers.zhudaValues as Float32Array)[index] = spec.density(
        o[0] + x * o[3],
        o[1] + y * o[3],
        o[2] + z * o[3],
      );
    },
  };
}

const aborted = (signal: AbortSignal) =>
  signal.reason ?? new DOMException('Density volume cancelled', 'AbortError');

/**
 * Fills the isosurface grid of `spec`'s box with its density, on the GPU
 * where there is compute, and reads it back once. Rejects when cancelled,
 * past the time limit, when the density throws or is not finite, and when a
 * GPU result disagrees with the JavaScript density.
 */
export async function computeZhudaDensityVolume(
  spec: ZhudaDensitySpec,
  options: ZhudaDensityOptions = {},
): Promise<ZhudaDensityVolume> {
  const issues = validateZhudaDensitySpec(spec);
  if (issues.length) throw Error('Invalid density volume: ' + issues.join('; '));
  const timeoutMs = options.timeoutMs ?? 30000;
  if (!(finite(timeoutMs) && timeoutMs > 0)) throw Error('Invalid density volume: timeoutMs');
  const checkPoints = options.checkPoints ?? 64;
  if (!(Number.isInteger(checkPoints) && checkPoints >= 0 && checkPoints <= 4096))
    throw Error('Invalid density volume: checkPoints is 0..4096');
  const { signal } = options;
  if (signal?.aborted) throw aborted(signal);
  const { origin, size } = zhudaIsosurfaceGrid(spec.min, spec.max, spec.cellSize);
  const count = size[0] * size[1] * size[2];
  const tolerance = options.tolerance ?? spec.cellSize * 1e-3 + 1e-4;
  const controller = new AbortController();
  const stop = () => controller.abort(aborted(signal!));
  signal?.addEventListener('abort', stop, { once: true });
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          `Density volume timed out after ${timeoutMs} ms (${count} grid points); pass a larger timeoutMs or a larger cellSize`,
          'TimeoutError',
        ),
      ),
    timeoutMs,
  );
  const until = <T>(work: Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      if (controller.signal.aborted) return reject(controller.signal.reason);
      const onAbort = () => reject(controller.signal.reason);
      controller.signal.addEventListener('abort', onAbort, { once: true });
      work.then(
        (value) => {
          controller.signal.removeEventListener('abort', onAbort);
          resolve(value);
        },
        (error) => {
          controller.signal.removeEventListener('abort', onAbort);
          reject(error);
        },
      );
    });
  const computed = computeSpec(spec, count);
  const gpu = options.backend !== 'cpu' && zhudaComputeSupported();
  let pass: ZhudaComputePass | undefined;
  let reading: Promise<unknown> | undefined;
  try {
    // One turn first, so a cancel or a deadline already due is seen before any work.
    await until(new Promise<void>((resolve) => setTimeout(resolve, 0)));
    let values: Float32Array;
    const uniforms = {
      u_ZhudaOrigin: [origin[0], origin[1], origin[2], spec.cellSize],
      u_ZhudaGrid: [size[0], size[1], size[2], 0],
    };
    if (gpu) {
      pass = new ZhudaComputePass(computed);
      pass.setUniform('u_ZhudaOrigin', uniforms.u_ZhudaOrigin);
      pass.setUniform('u_ZhudaGrid', uniforms.u_ZhudaGrid);
      pass.dispatch(count);
      const read = pass.read('zhudaValues');
      reading = read;
      values = (await until(read)) as Float32Array;
    } else {
      values = new Float32Array(count);
      const arrays = { zhudaValues: values };
      const step = computed.step!;
      // Slices of about a plane of the grid, a turn between them.
      const slice = Math.max(4096, size[0] * size[1]);
      for (let start = 0; start < count; start += slice) {
        const end = Math.min(count, start + slice);
        for (let i = start; i < end; i++) step(i, arrays, uniforms);
        await until(new Promise<void>((resolve) => setTimeout(resolve, 0)));
      }
    }
    if (controller.signal.aborted) throw controller.signal.reason;
    const backend = gpu ? 'webgpu' : 'cpu';
    for (let i = 0; i < values.length; i++)
      if (!Number.isFinite(values[i]))
        throw Error(`Density volume: the ${backend} density is not finite at grid point ${i}`);
    if (backend === 'webgpu' && checkPoints) {
      let worst = 0,
        at = -1;
      for (let k = 0; k < checkPoints; k++) {
        // Spread over the grid: a fixed stride through all points.
        const i = Math.floor(((k + 0.5) / checkPoints) * count);
        const x = i % size[0],
          y = Math.floor(i / size[0]) % size[1],
          z = Math.floor(i / (size[0] * size[1]));
        const reference = spec.density(
          origin[0] + x * spec.cellSize,
          origin[1] + y * spec.cellSize,
          origin[2] + z * spec.cellSize,
        );
        const difference = Math.abs(values[i] - reference);
        if (!(difference <= worst)) ((worst = difference), (at = i));
      }
      if (!(worst <= tolerance))
        throw Error(
          `Density volume: the GPU density differs from the JavaScript density by ${worst} at grid point ${at} (tolerance ${tolerance}); the GLSL and the JavaScript must be the same field`,
        );
    }
    return { values, size, origin, cellSize: spec.cellSize, backend };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', stop);
    // A read still on its way back (cancelled, timed out) is let finish before its buffers go.
    const held = pass;
    if (held && reading)
      reading.then(
        () => held.dispose(),
        () => held.dispose(),
      );
    else held?.dispose();
  }
}
