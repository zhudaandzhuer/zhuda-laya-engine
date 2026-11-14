/**
 * Functions a shader would otherwise paste in: a hash, value noise, fractal
 * noise, and the weights of a triplanar projection. One include,
 * `ZhudaCommon.glsl`, for every shader of a game (`common: true` in a
 * `ZhudaShaderSpec`), and the same arithmetic in JavaScript for placing
 * things where a shader will draw them.
 *
 * The hash uses no sine and no integer operation, so it is the same
 * expression on GLSL ES 1, GLSL ES 3 and WGSL. It is still a hash: a GPU
 * rounds its floats in its own way, and two GPUs may give different numbers
 * for the same cell. What holds everywhere is what noise is used for: values
 * in 0..1, even over many cells, and noise that is smooth between them. The
 * JavaScript functions round as a 32-bit GPU would where it matters and
 * agree with one to the last place only by luck.
 */

/** The include's name: `#include "ZhudaCommon.glsl";`. */
export const ZHUDA_COMMON_INCLUDE = 'ZhudaCommon.glsl';

/** Octaves `zhudaFbm` sums. */
export const ZHUDA_FBM_OCTAVES = 5;

export const ZHUDA_COMMON_GLSL = `#if !defined(ZhudaCommon_lib)
#define ZhudaCommon_lib
// 0..1 from a cell. No sine: the same expression on every backend.
float zhudaHash(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
float zhudaHash(vec3 p){vec3 q=fract(p*0.1031);q+=dot(q,q.zyx+31.32);return fract((q.x+q.y)*q.z);}
vec2 zhudaHash2(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}
// Value noise, 0..1, smooth between the corners of unit cells.
float zhudaNoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);
return mix(mix(zhudaHash(i),zhudaHash(i+vec2(1.0,0.0)),u.x),mix(zhudaHash(i+vec2(0.0,1.0)),zhudaHash(i+vec2(1.0,1.0)),u.x),u.y);}
float zhudaNoise(vec3 p){vec3 i=floor(p);vec3 f=fract(p);vec3 u=f*f*(3.0-2.0*f);
float a=mix(mix(zhudaHash(i),zhudaHash(i+vec3(1.0,0.0,0.0)),u.x),mix(zhudaHash(i+vec3(0.0,1.0,0.0)),zhudaHash(i+vec3(1.0,1.0,0.0)),u.x),u.y);
float b=mix(mix(zhudaHash(i+vec3(0.0,0.0,1.0)),zhudaHash(i+vec3(1.0,0.0,1.0)),u.x),mix(zhudaHash(i+vec3(0.0,1.0,1.0)),zhudaHash(i+vec3(1.0,1.0,1.0)),u.x),u.y);
return mix(a,b,u.z);}
// Five octaves of it, each half as strong and twice as fine: 0..0.97.
float zhudaFbm(vec2 p){float sum=0.0;float amp=0.5;for(int k=0;k<${ZHUDA_FBM_OCTAVES};k++){sum+=amp*zhudaNoise(p);p=p*2.0+vec2(17.0,31.0);amp*=0.5;}return sum;}
float zhudaFbm(vec3 p){float sum=0.0;float amp=0.5;for(int k=0;k<${ZHUDA_FBM_OCTAVES};k++){sum+=amp*zhudaNoise(p);p=p*2.0+vec3(17.0,31.0,13.0);amp*=0.5;}return sum;}
// How much of each of the three flat projections a surface facing n takes: they sum to 1.
vec3 zhudaTriplanarWeights(vec3 n){vec3 w=abs(n);w=w*w;w=w*w;return w/max(w.x+w.y+w.z,0.00001);}
// sample is a function of a vec2 (zhudaSample_u_ZhudaRock): the three projections of p, mixed by w.
#define zhudaTriplanar(sample,p,w,scale) (sample((p).zy*(scale))*(w).x+sample((p).xz*(scale))*(w).y+sample((p).xy*(scale))*(w).z)
#endif
`;

const includes = new WeakSet<object>();
/** Makes `ZhudaCommon.glsl` known to this runtime's shaders; once a runtime. */
export function registerZhudaCommon(runtime: any = (globalThis as any).Laya): void {
  const shaders = runtime?.Shader3D;
  if (typeof shaders?.addInclude !== 'function')
    throw Error('ZhudaCommon.glsl needs LayaAir (ZhudaEngine.boot first)');
  if (includes.has(shaders)) return;
  shaders.addInclude(ZHUDA_COMMON_INCLUDE, ZHUDA_COMMON_GLSL);
  includes.add(shaders);
}

const f = Math.fround;
const fract = (v: number) => f(v - Math.floor(v));

/** `zhudaHash(vec2)` in JavaScript: 0..1 from a cell. */
export function zhudaHash2D(x: number, y: number): number {
  let a = fract(f(f(x) * f(0.1031))),
    b = fract(f(f(y) * f(0.1031))),
    c = fract(f(f(x) * f(0.1031)));
  // dot(q, q.yzx + 33.33)
  const d = f(f(f(a * f(b + f(33.33))) + f(b * f(c + f(33.33)))) + f(c * f(a + f(33.33))));
  a = f(a + d);
  b = f(b + d);
  c = f(c + d);
  return fract(f(f(a + b) * c));
}

/** `zhudaNoise(vec2)` in JavaScript: value noise, 0..1. */
export function zhudaNoise2D(x: number, y: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx),
    uy = fy * fy * (3 - 2 * fy);
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  return mix(
    mix(zhudaHash2D(ix, iy), zhudaHash2D(ix + 1, iy), ux),
    mix(zhudaHash2D(ix, iy + 1), zhudaHash2D(ix + 1, iy + 1), ux),
    uy,
  );
}

/** `zhudaFbm(vec2)` in JavaScript: five octaves, 0..0.97. */
export function zhudaFbm2D(x: number, y: number): number {
  let sum = 0,
    amp = 0.5;
  for (let k = 0; k < ZHUDA_FBM_OCTAVES; k++) {
    sum += amp * zhudaNoise2D(x, y);
    x = x * 2 + 17;
    y = y * 2 + 31;
    amp *= 0.5;
  }
  return sum;
}

/** `zhudaTriplanarWeights` in JavaScript: three shares that sum to 1. */
export function zhudaTriplanarWeights(
  normal: readonly [number, number, number],
): [number, number, number] {
  const w = normal.map((v) => Math.abs(v) ** 4);
  const sum = Math.max(w[0] + w[1] + w[2], 0.00001);
  return [w[0] / sum, w[1] / sum, w[2] / sum];
}
