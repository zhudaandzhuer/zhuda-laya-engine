/**
 * A glTF material's occlusion and emissive textures on the mesh's second set
 * of texture coordinates (`texCoord: 1`): a baked map laid out on its own,
 * apart from the tiling one the colour uses.
 *
 * LayaAir 3.4.2 loads `TEXCOORD_1` into the mesh and carries it to the pixel
 * only for a lightmap; its glTF shader reads every texture by the first set
 * and its loader says "non 0 uv channel unsupported" on the console. The
 * text of two includes and of the glTF shader is changed as LayaAir
 * registers them, and compiles to LayaAir's own code until a material asks.
 * Vendor files are not modified.
 */

/** On a material one of whose textures reads the second set: the set is carried to the pixel. */
export const ZHUDA_UV1_DEFINE = 'ZHUDA_UV1';
export const ZHUDA_OCCLUSION_UV1_DEFINE = 'ZHUDA_OCCLUSION_UV1';
export const ZHUDA_EMISSION_UV1_DEFINE = 'ZHUDA_EMISSION_UV1';

const COMMON_ANCHOR = '#ifdef COLOR\nvarying vec4 v_VertexColor;\n#endif\nstruct PixelParams{';
const COMMON_ADDED = `#ifdef UV1\n#ifdef ${ZHUDA_UV1_DEFINE}\nvarying vec2 v_ZhudaTexcoord1;\n#endif\n#endif\n`;
const VERTEX_ANCHOR = '#ifdef UV\nparams.uv0=vertex.texCoord0;\n#endif\n';
const VERTEX_ADDED = `#ifdef UV1\n#ifdef ${ZHUDA_UV1_DEFINE}\nv_ZhudaTexcoord1=vertex.texCoord1;\n#endif\n#endif\n`;
const SLOTS = [
  { anchor: 'vec2 occlusionUV=uv;\n', name: 'occlusionUV', define: ZHUDA_OCCLUSION_UV1_DEFINE },
  { anchor: 'vec2 emissionUV=uv;\n', name: 'emissionUV', define: ZHUDA_EMISSION_UV1_DEFINE },
] as const;

const once = (text: string, anchor: string) => {
  const at = text.indexOf(anchor);
  return at >= 0 && text.indexOf(anchor, at + 1) < 0 ? at : -1;
};
function insertAfter(text: string, anchor: string, added: string, what: string) {
  const at = once(text, anchor);
  if (at < 0) return { text, reason: `${what} no longer holds the line the patch follows` };
  return { text: text.slice(0, at + anchor.length) + added + text.slice(at + anchor.length) };
}

/** `ShadingCommon.glsl` with a varying for the second set. Pure. */
export function zhudaPatchSecondUvCommon(text: string): { text: string; reason?: string } {
  const at = once(text, COMMON_ANCHOR);
  if (at < 0)
    return { text, reason: 'ShadingCommon.glsl no longer holds the line the patch precedes' };
  return { text: text.slice(0, at) + COMMON_ADDED + text.slice(at) };
}
/** `ShadingVertex.glsl` handing the second set to the pixel. Pure. */
export function zhudaPatchSecondUvVertex(text: string): { text: string; reason?: string } {
  return insertAfter(text, VERTEX_ANCHOR, VERTEX_ADDED, 'ShadingVertex.glsl');
}
/**
 * The glTF shader's fragment program reading occlusion and emission by the
 * second set under their defines. A program without those lines (another
 * shader, or the glTF shader's other passes) comes back as it was. Pure.
 */
export function zhudaPatchSecondUvGltf(fragment: string): { text: string; reason?: string } {
  if (!SLOTS.some((slot) => fragment.includes(slot.anchor))) return { text: fragment };
  let text = fragment;
  for (const slot of SLOTS) {
    const made = insertAfter(
      text,
      slot.anchor,
      `#ifdef UV1\n#ifdef ${slot.define}\n${slot.name}=v_ZhudaTexcoord1;\n#endif\n#endif\n`,
      'the glTF shader',
    );
    if (made.reason) return { text: fragment, reason: made.reason };
    text = made.text;
  }
  return { text };
}

export interface ZhudaSecondUvStatus {
  /** The three texts were found and changed: a material may ask. */
  ready: boolean;
  /** Why not, when it is not. */
  reason: string | null;
}
interface State {
  common?: boolean;
  vertex?: boolean;
  gltf?: boolean;
  reason: string | null;
}
const states = new WeakMap<object, State>();

/**
 * Changes the two includes and the glTF shader as LayaAir registers them.
 * Must run before `Laya.init`; `ZhudaEngine.boot` calls it. If the vendored
 * text no longer holds an anchor, nothing of that text is changed and
 * `zhudaSecondUvStatus()` says why: such a texture is then drawn with the
 * first set, and the model's report says so.
 */
export function installLaya342SecondUv(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (states.has(shader)) return true;
  const state: State = {
    reason: 'LayaAir has not registered its shaders (install before Laya.init)',
  };
  states.set(shader, state);
  const settle = (reason?: string) => {
    if (reason) state.reason = reason;
    else if (state.common && state.vertex && state.gltf) state.reason = null;
  };
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (
      typeof text === 'string' &&
      (name === 'ShadingCommon.glsl' || name === 'ShadingVertex.glsl')
    ) {
      const made =
        name === 'ShadingCommon.glsl'
          ? zhudaPatchSecondUvCommon(text)
          : zhudaPatchSecondUvVertex(text);
      text = made.text;
      state[name === 'ShadingCommon.glsl' ? 'common' : 'vertex'] = !made.reason;
      settle(made.reason);
    }
    return addInclude.call(this, name, text, ...rest);
  };
  const sub = runtime.SubShader?.prototype;
  if (sub && typeof sub.addShaderPass === 'function') {
    const addShaderPass = sub.addShaderPass;
    sub.addShaderPass = function (vertex: string, fragment: string, ...rest: unknown[]) {
      // The glTF shader's lit pass is the one that reads occlusion and emission.
      if (typeof fragment === 'string' && SLOTS.some((slot) => fragment.includes(slot.anchor))) {
        const made = zhudaPatchSecondUvGltf(fragment);
        if (made.text !== fragment || made.reason) {
          fragment = made.text;
          state.gltf = !made.reason;
          settle(made.reason);
        }
      }
      return addShaderPass.call(this, vertex, fragment, ...rest);
    };
  }
  return true;
}

/** Whether a glTF material may read its occlusion and emissive textures by the second set. */
export function zhudaSecondUvStatus(runtime: any = (globalThis as any).Laya): ZhudaSecondUvStatus {
  const state = runtime?.Shader3D ? states.get(runtime.Shader3D) : undefined;
  if (!state) return { ready: false, reason: 'installLaya342SecondUv was not called' };
  return { ready: state.reason === null, reason: state.reason };
}

/** Which set of texture coordinates a glTF texture reference asks for (`KHR_texture_transform` may say another). */
export function zhudaGltfTexCoord(info: unknown): number {
  const record = (v: unknown): Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const own = record(info).texCoord,
    moved = record(record(record(info).extensions).KHR_texture_transform).texCoord;
  const value = moved ?? own ?? 0;
  return Number.isSafeInteger(value) && (value as number) >= 0 ? (value as number) : 0;
}
