// Generated from TypeScript source; run npm run types:generate.
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
export declare const ZHUDA_COMMON_INCLUDE = "ZhudaCommon.glsl";
/** Octaves `zhudaFbm` sums. */
export declare const ZHUDA_FBM_OCTAVES = 5;
export declare const ZHUDA_COMMON_GLSL = "#if !defined(ZhudaCommon_lib)\n#define ZhudaCommon_lib\n// 0..1 from a cell. No sine: the same expression on every backend.\nfloat zhudaHash(vec2 p){vec3 q=fract(vec3(p.xyx)*0.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}\nfloat zhudaHash(vec3 p){vec3 q=fract(p*0.1031);q+=dot(q,q.zyx+31.32);return fract((q.x+q.y)*q.z);}\nvec2 zhudaHash2(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy);}\n// Value noise, 0..1, smooth between the corners of unit cells.\nfloat zhudaNoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);\nreturn mix(mix(zhudaHash(i),zhudaHash(i+vec2(1.0,0.0)),u.x),mix(zhudaHash(i+vec2(0.0,1.0)),zhudaHash(i+vec2(1.0,1.0)),u.x),u.y);}\nfloat zhudaNoise(vec3 p){vec3 i=floor(p);vec3 f=fract(p);vec3 u=f*f*(3.0-2.0*f);\nfloat a=mix(mix(zhudaHash(i),zhudaHash(i+vec3(1.0,0.0,0.0)),u.x),mix(zhudaHash(i+vec3(0.0,1.0,0.0)),zhudaHash(i+vec3(1.0,1.0,0.0)),u.x),u.y);\nfloat b=mix(mix(zhudaHash(i+vec3(0.0,0.0,1.0)),zhudaHash(i+vec3(1.0,0.0,1.0)),u.x),mix(zhudaHash(i+vec3(0.0,1.0,1.0)),zhudaHash(i+vec3(1.0,1.0,1.0)),u.x),u.y);\nreturn mix(a,b,u.z);}\n// Five octaves of it, each half as strong and twice as fine: 0..0.97.\nfloat zhudaFbm(vec2 p){float sum=0.0;float amp=0.5;for(int k=0;k<5;k++){sum+=amp*zhudaNoise(p);p=p*2.0+vec2(17.0,31.0);amp*=0.5;}return sum;}\nfloat zhudaFbm(vec3 p){float sum=0.0;float amp=0.5;for(int k=0;k<5;k++){sum+=amp*zhudaNoise(p);p=p*2.0+vec3(17.0,31.0,13.0);amp*=0.5;}return sum;}\n// How much of each of the three flat projections a surface facing n takes: they sum to 1.\nvec3 zhudaTriplanarWeights(vec3 n){vec3 w=abs(n);w=w*w;w=w*w;return w/max(w.x+w.y+w.z,0.00001);}\n// sample is a function of a vec2 (zhudaSample_u_ZhudaRock): the three projections of p, mixed by w.\n#define zhudaTriplanar(sample,p,w,scale) (sample((p).zy*(scale))*(w).x+sample((p).xz*(scale))*(w).y+sample((p).xy*(scale))*(w).z)\n#endif\n";
/** Makes `ZhudaCommon.glsl` known to this runtime's shaders; once a runtime. */
export declare function registerZhudaCommon(runtime?: any): void;
/** `zhudaHash(vec2)` in JavaScript: 0..1 from a cell. */
export declare function zhudaHash2D(x: number, y: number): number;
/** `zhudaNoise(vec2)` in JavaScript: value noise, 0..1. */
export declare function zhudaNoise2D(x: number, y: number): number;
/** `zhudaFbm(vec2)` in JavaScript: five octaves, 0..0.97. */
export declare function zhudaFbm2D(x: number, y: number): number;
/** `zhudaTriplanarWeights` in JavaScript: three shares that sum to 1. */
export declare function zhudaTriplanarWeights(normal: readonly [number, number, number]): [number, number, number];
