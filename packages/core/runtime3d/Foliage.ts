/**
 * Foliage that moves in the wind and stays full in the distance, for models
 * drawn with LayaAir 3.4.2's PBR shaders (glTF trees, shrubs, ferns).
 *
 * Wind (`ZHUDA_WIND` on a material): every vertex is moved where LayaAir
 * computes its place in the world, in the visible pass (`shadingPixelParams`)
 * and in the shadow and depth passes (`DepthPositionCS`), so the leaves and
 * their shadows move together. The whole plant leans with the gusts and sways
 * back, more the higher above its base (a stem bends with the square of the
 * height); the leaves of a cut-out material also flutter, each part on its own
 * clock. Direction, strength and time are the scene's (`ZhudaFoliageWind`).
 *
 * Coverage (`ZHUDA_KEEP_COVERAGE` on a cut-out material of LayaAir's glTF
 * shader): a leaf picture loses its leaves as it is minified, because its
 * smaller mipmaps average the alpha toward the empty background and more of
 * each leaf falls under the cut-off. The alpha that is tested is raised by a
 * quarter for each mip level the picture is read at, in the visible, shadow
 * and depth passes, so a crown far away stays about as full as near.
 *
 * Materials without the defines compile to LayaAir's own code. The include
 * and pass texts are changed as LayaAir registers them; install before
 * `Laya.init` (`ZhudaEngine.boot` does it). `zhudaWindOffset` is the shader's
 * wind in TypeScript.
 */

export const ZHUDA_WIND_DEFINE = 'ZHUDA_WIND';
export const ZHUDA_KEEP_COVERAGE_DEFINE = 'ZHUDA_KEEP_COVERAGE';
/** Scene uniform: direction x, z (a unit vector), strength, seconds. */
export const ZHUDA_WIND_UNIFORM = 'u_ZhudaWind';

/** How far a plant bends per metre of height squared at strength 1 (0.16 m at 10 m). */
const BEND = 0.0016;
/** How far a leaf flutters at strength 1, in metres. */
const FLUTTER = 0.02;

const WIND_GLSL = `
#ifdef ${ZHUDA_WIND_DEFINE}
uniform vec4 ${ZHUDA_WIND_UNIFORM};
vec3 zhudaWindMove(vec3 p,mat4 world){vec3 base=world[3].xyz;float h=max(p.y-base.y,0.0);float t=${ZHUDA_WIND_UNIFORM}.w;float s=${ZHUDA_WIND_UNIFORM}.z;float phase=dot(base.xz,vec2(0.173,0.311));float gust=0.6+0.25*sin(t*0.37+phase*0.5)+0.15*sin(t*1.13+phase);float sway=0.3*sin(t*0.9+phase)+0.1*sin(t*2.3+phase*1.7);p.xz+=${ZHUDA_WIND_UNIFORM}.xy*(s*${BEND}*h*h)*(gust+sway);
#ifdef ALPHATEST
float f=0.6*sin(t*7.3+dot(p,vec3(3.1,2.3,2.7)))+0.4*sin(t*11.0+dot(p,vec3(-1.7,3.9,1.3)));p+=vec3(${ZHUDA_WIND_UNIFORM}.x,0.5,${ZHUDA_WIND_UNIFORM}.y)*(f*${FLUTTER}*s*smoothstep(0.3,2.0,h)*gust);
#endif
return p;}
#endif
`;
/** The alpha raised by the mip level `uv` is read at in `tex` (a quarter a level). */
const coverage = (uv: string) =>
  `{vec2 zhudaSize=vec2(textureSize(u_BaseColorTexture,0));vec2 zhudaX=dFdx(${uv}*zhudaSize),zhudaY=dFdy(${uv}*zhudaSize);zhudaAlpha*=1.0+max(0.0,0.5*log2(max(dot(zhudaX,zhudaX),dot(zhudaY,zhudaY))))*0.25;}`;

/** Each include's changes: all of an include or none of it. */
const INCLUDES: Record<string, readonly (readonly [string, string])[]> = {
  // The function, where both the visible and the depth programs have the world matrix.
  'Sprite3DVertex.glsl': [['return worldMat;}', `return worldMat;}\n${WIND_GLSL}\n`]],
  'ShadingVertex.glsl': [
    [
      'params.positionWS=pos.xyz/pos.w;',
      `params.positionWS=pos.xyz/pos.w;\n#ifdef ${ZHUDA_WIND_DEFINE}\nparams.positionWS=zhudaWindMove(params.positionWS,worldMat);\n#endif\n`,
    ],
  ],
  'DepthVertex.glsl': [
    [
      'vec4 DepthPositionCS(in vec3 positionWS,in vec3 normalWS){',
      `vec4 DepthPositionCS(in vec3 positionWS,in vec3 normalWS){\n#ifdef ${ZHUDA_WIND_DEFINE}\npositionWS=zhudaWindMove(positionWS,getWorldMatrix());\n#endif\n`,
    ],
  ],
  'glTFMetallicRoughness.glsl': [
    [
      'if(inputs.alpha<inputs.alphaTest){discard;}',
      `float zhudaAlpha=inputs.alpha;\n#if defined(${ZHUDA_KEEP_COVERAGE_DEFINE}) && defined(UV) && defined(BASECOLORMAP)\n${coverage('pixel.uv0')}\n#endif\nif(zhudaAlpha<inputs.alphaTest){discard;}`,
    ],
  ],
};
/** The glTF shader's shadow and depth programs read the alpha themselves. */
const PASS_ALPHA = 'alpha*=texture2D(u_BaseColorTexture,baseColorUV).a;';
const PASS_ALPHA_KEPT = `${PASS_ALPHA}\n#ifdef ${ZHUDA_KEEP_COVERAGE_DEFINE}\n{float zhudaAlpha=alpha;${coverage('baseColorUV')}alpha=zhudaAlpha;}\n#endif\n`;

/** An include's text with this module's changes, or unchanged with the reason. Pure. */
export function zhudaPatchFoliageInclude(
  name: string,
  text: string,
): { text: string; reason?: string } {
  const pairs = INCLUDES[name];
  if (!pairs) return { text };
  for (const [from] of pairs)
    if (text.split(from).length !== 2)
      return { text, reason: `${name} no longer holds the line the patch follows` };
  for (const [from, to] of pairs) text = text.replace(from, to);
  return { text };
}

/** A pass fragment with coverage kept after each alpha read of the glTF shader. Pure. */
export function zhudaPatchFoliagePass(fragment: string): { text: string; reads: number } {
  const parts = fragment.split(PASS_ALPHA);
  return { text: parts.join(PASS_ALPHA_KEPT), reads: parts.length - 1 };
}

interface State {
  includes: Set<string>;
  passes: number;
  declared: boolean;
}
const states = new WeakMap<object, State>();

/**
 * Teaches LayaAir's PBR and glTF shaders the wind and the kept coverage.
 * Must run before `Laya.init`. Returns false when there is no runtime to patch.
 */
export function installLaya342Foliage(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (states.has(shader)) return true;
  const state: State = { includes: new Set(), passes: 0, declared: false };
  states.set(shader, state);
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (typeof text === 'string' && INCLUDES[name]) {
      const made = zhudaPatchFoliageInclude(name, text);
      if (!made.reason) {
        text = made.text;
        state.includes.add(name);
        if (name === 'Sprite3DVertex.glsl') state.declared = declareWind(runtime);
      }
    }
    return addInclude.call(this, name, text, ...rest);
  };
  const sub = runtime.SubShader?.prototype;
  if (sub && typeof sub.addShaderPass === 'function') {
    const addShaderPass = sub.addShaderPass;
    sub.addShaderPass = function (vertex: string, fragment: string, ...rest: unknown[]) {
      if (typeof fragment === 'string' && fragment.includes(PASS_ALPHA)) {
        const made = zhudaPatchFoliagePass(fragment);
        fragment = made.text;
        state.passes += made.reads ? 1 : 0;
      }
      return addShaderPass.call(this, vertex, fragment, ...rest);
    };
  }
  return true;
}

function declareWind(l: any): boolean {
  const map =
    l.Scene3D?.sceneUniformMap ??
    l.LayaGL?.renderDeviceFactory?.createGlobalUniformMap?.('Scene3D');
  if (!map?.addShaderUniform) return false;
  map.addShaderUniform(
    l.Shader3D.propertyNameToID(ZHUDA_WIND_UNIFORM),
    ZHUDA_WIND_UNIFORM,
    l.ShaderDataType.Vector4,
  );
  return true;
}

/** Whether the wind and the coverage reach LayaAir's shaders in this runtime (after `Laya.init`). */
export function zhudaFoliageStatus(runtime: any = (globalThis as any).Laya): {
  wind: boolean;
  coverage: boolean;
  passes: number;
} {
  const state = states.get(runtime?.Shader3D);
  if (!state) return { wind: false, coverage: false, passes: 0 };
  const wind =
    state.declared &&
    ['Sprite3DVertex.glsl', 'ShadingVertex.glsl', 'DepthVertex.glsl'].every((name) =>
      state.includes.has(name),
    );
  return { wind, coverage: state.includes.has('glTFMetallicRoughness.glsl'), passes: state.passes };
}

export interface ZhudaWindOptions {
  /** Where the wind blows to on the ground, x and z (normalised; default [1, 0.35]). */
  direction?: readonly [number, number];
  /** 0..2 (default 1): 1 bends a 10 m tree about 16 cm at its top and flutters its leaves about 2 cm. */
  strength?: number;
}

/** Lists what is wrong with wind options; empty when they are valid. */
export function validateZhudaWind(options: ZhudaWindOptions): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  if (
    o.direction !== undefined &&
    !(
      Array.isArray(o.direction) &&
      o.direction.length === 2 &&
      o.direction.every((v) => typeof v === 'number' && Number.isFinite(v)) &&
      Math.hypot(...(o.direction as number[])) > 1e-6
    )
  )
    issues.push('direction: use [x, z], not both zero');
  if (
    o.strength !== undefined &&
    !(typeof o.strength === 'number' && o.strength >= 0 && o.strength <= 2)
  )
    issues.push('strength: use 0..2');
  return issues;
}

/**
 * Where the wind moves a point of a plant whose base (the model's origin) is
 * at `base`, at `seconds`: the shader's displacement in TypeScript, in metres.
 * `leaf` is a cut-out material (it flutters too).
 */
export function zhudaWindOffset(
  point: readonly [number, number, number],
  base: readonly [number, number, number],
  seconds: number,
  wind: ZhudaWindOptions = {},
  leaf = false,
): [number, number, number] {
  const [dx, dz] = unit(wind.direction ?? [1, 0.35]);
  const s = wind.strength ?? 1;
  const h = Math.max(point[1] - base[1], 0);
  const phase = base[0] * 0.173 + base[2] * 0.311;
  const gust =
    0.6 + 0.25 * Math.sin(seconds * 0.37 + phase * 0.5) + 0.15 * Math.sin(seconds * 1.13 + phase);
  const sway = 0.3 * Math.sin(seconds * 0.9 + phase) + 0.1 * Math.sin(seconds * 2.3 + phase * 1.7);
  const bend = s * BEND * h * h * (gust + sway);
  const p = [point[0] + dx * bend, point[1], point[2] + dz * bend];
  if (leaf) {
    const f =
      0.6 * Math.sin(seconds * 7.3 + p[0] * 3.1 + p[1] * 2.3 + p[2] * 2.7) +
      0.4 * Math.sin(seconds * 11 - p[0] * 1.7 + p[1] * 3.9 + p[2] * 1.3);
    const t = Math.min(1, Math.max(0, (h - 0.3) / 1.7));
    const amount = f * FLUTTER * s * t * t * (3 - 2 * t) * gust;
    p[0] += dx * amount;
    p[1] += 0.5 * amount;
    p[2] += dz * amount;
  }
  return [p[0] - point[0], p[1] - point[1], p[2] - point[2]];
}

function unit([x, z]: readonly [number, number]): [number, number] {
  const length = Math.hypot(x, z) || 1;
  return [x / length, z / length];
}

/** A scene's wind: direction, strength and the seconds it has blown. */
export class ZhudaFoliageWind {
  private readonly values: any;
  private readonly id: number;
  private direction: [number, number];
  private strength: number;
  private seconds = 0;
  private disposed = false;

  constructor(scene: any, options: ZhudaWindOptions = {}, runtime: any = (globalThis as any).Laya) {
    const issues = validateZhudaWind(options);
    if (issues.length) throw Error('Invalid wind: ' + issues.join('; '));
    this.values = scene?._shaderValues;
    if (typeof this.values?.setVector !== 'function')
      throw Error('ZhudaFoliageWind: pass a Laya Scene3D');
    if (!zhudaFoliageStatus(runtime).wind)
      throw Error(
        'ZhudaFoliageWind: the wind is not installed (installLaya342Foliage before Laya.init)',
      );
    this.id = runtime.Shader3D.propertyNameToID(ZHUDA_WIND_UNIFORM);
    this.direction = unit(options.direction ?? [1, 0.35]);
    this.strength = options.strength ?? 1;
    this.write(runtime);
  }

  /** Changes the direction or the strength (a calm, a storm). */
  setWind(options: ZhudaWindOptions, runtime: any = (globalThis as any).Laya): void {
    if (this.disposed) throw Error('Disposed wind');
    const issues = validateZhudaWind(options);
    if (issues.length) throw Error('Invalid wind: ' + issues.join('; '));
    if (options.direction) this.direction = unit(options.direction);
    if (options.strength !== undefined) this.strength = options.strength;
    this.write(runtime);
  }

  /** Seconds the wind has blown: call once a frame with the game's clock. */
  update(seconds: number, runtime: any = (globalThis as any).Laya): void {
    if (this.disposed) return;
    if (!Number.isFinite(seconds) || seconds < 0) throw Error('Invalid wind time');
    this.seconds = seconds;
    this.write(runtime);
  }

  private write(runtime: any): void {
    // A new vector each time: one changed in place is not uploaded on WebGPU.
    this.values.setVector(
      this.id,
      new runtime.Vector4(this.direction[0], this.direction[1], this.strength, this.seconds),
    );
  }

  /** Stills the scene's plants. */
  dispose(runtime: any = (globalThis as any).Laya): void {
    if (this.disposed) return;
    this.strength = 0;
    this.write(runtime);
    this.disposed = true;
  }
}

/**
 * Marks the materials under `root` as foliage: all of them move in the wind
 * (`wind`, default true), and cut-out ones keep their coverage in the
 * distance (`keepCoverage`, default true). Materials are shared between the
 * copies of a model: every copy is marked. `dispose` takes off what this mark
 * put on.
 */
export function zhudaMarkFoliage(
  root: any,
  options: { wind?: boolean; keepCoverage?: boolean } = {},
  runtime: any = (globalThis as any).Laya,
): { materials: number; dispose(): void } {
  const shader = runtime?.Shader3D;
  if (typeof shader?.getDefineByName !== 'function')
    throw Error('zhudaMarkFoliage: LayaAir is not loaded');
  const wind = shader.getDefineByName(ZHUDA_WIND_DEFINE);
  const keep = shader.getDefineByName(ZHUDA_KEEP_COVERAGE_DEFINE);
  const added: [any, any][] = [];
  const seen = new Set<any>();
  const visit = (node: any) => {
    const renderer = node?.getComponent?.(runtime.BaseRender) ?? node?.meshRenderer;
    for (const material of renderer?.sharedMaterials ?? []) {
      if (!material || seen.has(material)) continue;
      seen.add(material);
      const data = material.shaderData ?? material._shaderValues;
      if (!data?.addDefine) continue;
      const cut = !!material.alphaTest;
      for (const [define, on] of [
        [wind, options.wind !== false],
        [keep, options.keepCoverage !== false && cut],
      ] as const)
        if (on && !data.hasDefine(define)) {
          data.addDefine(define);
          added.push([data, define]);
        }
    }
    for (let i = 0; i < (node?.numChildren ?? 0); i++) visit(node.getChildAt(i));
  };
  visit(root);
  let disposed = false;
  return {
    materials: seen.size,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [data, define] of added) data.removeDefine(define);
    },
  };
}
