/**
 * Dither where a picture is written in eight bits. A slow gradient (a night
 * sky, fog, the edge of a soft shadow, a vignette) has more shades than
 * eight bits hold, and rounding each pixel to the nearest one shows as
 * bands. A little noise added before the rounding, about one step, trades
 * the bands for grain too fine to see: over a few pixels the picture
 * averages to the shade that was meant.
 *
 * Where the rounding happens depends on the camera:
 *
 * - An HDR camera (a `ZhudaFilmicPipeline`, a look) keeps the picture in
 *   floats to the end of its chain; it is rounded once, where LayaAir turns
 *   it for the screen (`outputTransform` with `GAMMACORRECT`).
 * - A plain camera draws its materials into an eight-bit picture first
 *   (LayaAir's built-in target, in the sRGB curve) and copies that to the
 *   canvas: it is rounded as each material is written.
 *
 * The noise is added at the one or the other. The text of one include and
 * of the fragment programs that call it is changed as LayaAir registers
 * them, and compiles to LayaAir's own code until a scene asks. Vendor files
 * are not modified.
 */

/** On a scene's values: the picture is dithered where it is turned for the screen. */
export const ZHUDA_DITHER_DEFINE = 'ZHUDA_DITHER';
/** On a scene's values: the picture is dithered as each material is written (a camera with an eight-bit target). */
export const ZHUDA_DITHER_LINEAR_DEFINE = 'ZHUDA_DITHER_LINEAR';

const INCLUDE_ANCHOR = 'vec4 outputTransform(in vec4 color){';
/**
 * Two hashes of the pixel, added: noise between -1 and 1 of a step, most of
 * it near none (triangular), which leaves no trace of the rounding in how
 * bright the grain is. The same for red, green and blue: grey stays grey.
 * Below one step of eight bits the noise fades to nothing: black stays
 * black. The functions take the pixel as an argument: the include is read
 * by vertex programs too, which have no pixel.
 *
 * A colour as light, on its way into an eight-bit picture in the sRGB
 * curve, is dithered near that curve. In the curve's straight toe (below
 * 0.0031308) a step of the picture is 1/(12.92 x 255) of light, exactly.
 * Above it the square root stands in for the curve: there one step of the
 * picture is 0.7 to 1.1 steps of 1/255 of the root (0.85 is used).
 */
const INCLUDE_ADDED = `#if defined(${ZHUDA_DITHER_DEFINE})||defined(${ZHUDA_DITHER_LINEAR_DEFINE})
float zhudaDitherNoise(vec2 p){vec3 a=fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973));a+=dot(a,a.yzx+33.33);vec3 b=fract(vec3(p.yxy+19.19)*vec3(0.1031,0.1030,0.0973));b+=dot(b,b.yzx+33.33);return fract((a.x+a.y)*a.z)+fract((b.x+b.y)*b.z)-1.0;}
vec3 zhudaDither(vec3 c,vec2 p){return c+zhudaDitherNoise(p)/255.0*clamp(c*255.0,0.0,1.0);}
vec3 zhudaDitherLinear(vec3 c,vec2 p){float n=zhudaDitherNoise(p)/255.0;c=max(c,vec3(0.0));vec3 toe=c+n/12.92*clamp(c*3294.6,0.0,1.0);vec3 s=sqrt(c)+n*0.85;return mix(s*s,toe,1.0-step(vec3(0.0031308),c));}
#endif
`;
const CALL = /gl_FragColor\s*=\s*outputTransform\([^;]*\);/g;
const CALL_ADDED = `\n#ifdef ${ZHUDA_DITHER_DEFINE}\n#ifdef GAMMACORRECT\ngl_FragColor.rgb=zhudaDither(gl_FragColor.rgb,gl_FragCoord.xy);\n#endif\n#endif\n#ifdef ${ZHUDA_DITHER_LINEAR_DEFINE}\n#ifndef GAMMACORRECT\ngl_FragColor.rgb=zhudaDitherLinear(gl_FragColor.rgb,gl_FragCoord.xy);\n#endif\n#endif\n`;

/** `OutputTransform.glsl` with the noise function. Pure. */
export function zhudaPatchDitherInclude(text: string): { text: string; reason?: string } {
  const at = text.indexOf(INCLUDE_ANCHOR);
  if (at < 0 || text.indexOf(INCLUDE_ANCHOR, at + 1) >= 0)
    return { text, reason: 'OutputTransform.glsl no longer holds the line the patch precedes' };
  return { text: text.slice(0, at) + INCLUDE_ADDED + text.slice(at) };
}
/**
 * A fragment program with the noise added after each place it turns its
 * colour for the screen; a program that does not is returned as it was.
 * `calls` says how many places. Pure.
 */
export function zhudaPatchDitherPass(fragment: string): { text: string; calls: number } {
  let calls = 0;
  const text = fragment.replace(CALL, (found) => {
    calls++;
    return found + CALL_ADDED;
  });
  return { text, calls };
}

/**
 * The noise the shader adds at a pixel, in steps of eight bits (-1..1), from
 * the same arithmetic in JavaScript; a GPU rounds a little differently.
 */
export function zhudaDitherNoise(x: number, y: number): number {
  const fract = (v: number) => v - Math.floor(v);
  const hash = (px: number, py: number) => {
    let a = [fract(px * 0.1031), fract(py * 0.103), fract(px * 0.0973)];
    const d = a[0] * (a[1] + 33.33) + a[1] * (a[2] + 33.33) + a[2] * (a[0] + 33.33);
    a = a.map((v) => v + d);
    return fract((a[0] + a[1]) * a[2]);
  };
  return hash(x, y) + hash(y + 19.19, x + 19.19) - 1;
}

export interface ZhudaDitherStatus {
  /** The include was found and changed: a scene may ask. */
  ready: boolean;
  /** Why not, when it is not. */
  reason: string | null;
  /** How many fragment programs were given the noise as they were registered. */
  passes: number;
}
interface State {
  reason: string | null;
  passes: number;
}
const states = new WeakMap<object, State>();

/**
 * Changes the include and the fragment programs as LayaAir registers them.
 * Must run before `Laya.init`; `ZhudaEngine.boot` calls it. If the vendored
 * include no longer holds its anchor nothing is changed and
 * `zhudaDitherStatus()` says why; `setZhudaDither` then refuses.
 */
export function installLaya342Dither(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (states.has(shader)) return true;
  const state: State = {
    reason: 'LayaAir has not registered its shaders (install before Laya.init)',
    passes: 0,
  };
  states.set(shader, state);
  let patched = false;
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (typeof text === 'string' && name === 'OutputTransform.glsl') {
      const made = zhudaPatchDitherInclude(text);
      text = made.text;
      patched = !made.reason;
      state.reason = made.reason ?? null;
    }
    return addInclude.call(this, name, text, ...rest);
  };
  const sub = runtime.SubShader?.prototype;
  if (sub && typeof sub.addShaderPass === 'function') {
    const addShaderPass = sub.addShaderPass;
    sub.addShaderPass = function (vertex: string, fragment: string, ...rest: unknown[]) {
      // Only once the function it calls is there: a call to nothing would not compile.
      if (patched && typeof fragment === 'string') {
        const made = zhudaPatchDitherPass(fragment);
        if (made.calls) {
          fragment = made.text;
          state.passes++;
        }
      }
      return addShaderPass.call(this, vertex, fragment, ...rest);
    };
  }
  return true;
}

/** Whether a scene may ask for dither, and how many programs carry it. */
export function zhudaDitherStatus(runtime: any = (globalThis as any).Laya): ZhudaDitherStatus {
  const state = runtime?.Shader3D ? states.get(runtime.Shader3D) : undefined;
  if (!state) return { ready: false, reason: 'installLaya342Dither was not called', passes: 0 };
  return { ready: state.reason === null, reason: state.reason, passes: state.passes };
}

/** Where a scene's picture is dithered. */
export type ZhudaDitherMode = 'off' | 'screen' | 'materials' | 'both';

/**
 * Switches dither on or off for what a scene draws. `true` looks at the
 * scene's cameras as they are now: `'screen'` when all of them are HDR (the
 * picture is rounded once, at the end of the chain), `'materials'` when
 * none is (each material is written into eight bits), `'both'` when they
 * differ. Call it again after a camera is given a pipeline or loses one; or
 * name the mode. Returns the mode that was set. The shaders in use compile
 * once more the first time. Throws when the shader text could not be put in
 * place (`zhudaDitherStatus()` says why).
 */
export function setZhudaDither(scene3D: any, on: boolean | ZhudaDitherMode): ZhudaDitherMode {
  const l = (globalThis as any).Laya;
  const data = scene3D?._shaderValues;
  if (!data || typeof data.addDefine !== 'function') throw Error('A Scene3D is required');
  let mode: ZhudaDitherMode;
  if (on === true) {
    const cameras: any[] = (scene3D._cameraPool ?? []).filter((camera: any) => !camera.destroyed);
    const hdr = cameras.filter((camera) => camera.enableHDR).length;
    mode = !cameras.length || hdr === 0 ? 'materials' : hdr === cameras.length ? 'screen' : 'both';
  } else if (on === false) mode = 'off';
  else if (['off', 'screen', 'materials', 'both'].includes(on)) mode = on;
  else throw Error('Invalid dither: true, false, screen, materials or both');
  const status = zhudaDitherStatus(l);
  if (mode !== 'off' && !status.ready) throw Error(`Dither is unavailable: ${status.reason}`);
  const set = (name: string, wanted: boolean) => {
    const define = l.Shader3D.getDefineByName(name);
    if (wanted) data.addDefine(define);
    else data.removeDefine(define);
  };
  set(ZHUDA_DITHER_DEFINE, mode === 'screen' || mode === 'both');
  set(ZHUDA_DITHER_LINEAR_DEFINE, mode === 'materials' || mode === 'both');
  return mode;
}

/** Where a scene's picture is dithered now. */
export function zhudaDitherMode(scene3D: any): ZhudaDitherMode {
  const l = (globalThis as any).Laya;
  const data = scene3D?._shaderValues;
  const has = (name: string) => !!data?.hasDefine?.(l?.Shader3D?.getDefineByName?.(name));
  const screen = has(ZHUDA_DITHER_DEFINE),
    materials = has(ZHUDA_DITHER_LINEAR_DEFINE);
  return screen && materials ? 'both' : screen ? 'screen' : materials ? 'materials' : 'off';
}
