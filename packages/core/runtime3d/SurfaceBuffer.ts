/**
 * What every pixel's surface is, beside its colour: LayaAir 3.4.2 can draw
 * a scene's opaque things into more than one picture at once (`GBuffer`,
 * `Camera.opaqueMRT`): the world normal, and the metalness, roughness and
 * occlusion. Its standard PBR material writes them; the shader glTF models
 * are drawn with does not, so a scene of models has empty pictures.
 *
 * `installLaya342SurfaceBuffer` changes that shader's include as text
 * before LayaAir compiles it, so that it writes what the standard material
 * writes. The call compiles to nothing while a camera asks for no such
 * picture: a scene that uses none draws as before.
 *
 * An effect asks a camera for the pictures through LayaAir's own
 * `getCameraOpaqueMRTRequirements` (see `ZhudaScreenReflections`,
 * `surfaces`). A pixel a material did not write has alpha 0 in them: an
 * effect has to treat it as unknown.
 */

const GLTF_INCLUDE = 'glTFMetallicRoughness.glsl';
/** The two places of the glTF include the patch goes into; both or neither. */
const GLTF: readonly (readonly [string, string])[] = [
  // As LayaAir's own PBR include does: every output unless a material says otherwise.
  [
    '#include "PBRFrag.glsl";',
    '#include "PBRFrag.glsl";\n#ifdef LAYA_MRT\n#if !defined(GBUFFER_OUTPUTS_CONFIGURED)\n#define GBUFFER_NORMAL\n#define GBUFFER_ALBEDO\n#define GBUFFER_SURFACE\n#endif\n#include "GBuffer.glsl";\n#endif',
  ],
  [
    'getPixelInfo(info,pixel,surface);vec3 surfaceColor=vec3(0.0);',
    'getPixelInfo(info,pixel,surface);\n#ifdef LAYA_MRT\nwriteGBuffer(info.normalWS,inputs.diffuseColor,inputs.metallic,surface.perceptualRoughness,surface.occlusion);\n#endif\nvec3 surfaceColor=vec3(0.0);',
  ],
];

const patched = new WeakSet<object>();
const applied = new WeakMap<object, Set<string>>();

/**
 * Teaches the glTF shader to write LayaAir's surface pictures. Must run
 * before `Laya.init` (`ZhudaEngine.boot` does it). Returns false when there
 * is no runtime to patch.
 */
export function installLaya342SurfaceBuffer(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (patched.has(shader)) return true;
  const addInclude = shader.addInclude;
  const done = new Set<string>();
  applied.set(shader, done);
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    // All of the include or none of it: a release of LayaAir with other text is left alone.
    if (
      name === GLTF_INCLUDE &&
      typeof text === 'string' &&
      GLTF.every(([from]) => text.includes(from))
    ) {
      for (const [from, to] of GLTF) text = text.replace(from, to);
      done.add(name);
    }
    return addInclude.call(this, name, text, ...rest);
  };
  patched.add(shader);
  return true;
}

/** Whether glTF models write the surface pictures in this runtime (after `Laya.init`). */
export function zhudaSurfaceBufferInstalled(runtime: any = (globalThis as any).Laya): boolean {
  return !!applied.get(runtime?.Shader3D)?.has(GLTF_INCLUDE);
}

/** Whether this runtime's LayaAir has the surface pictures at all. */
export function zhudaSurfaceBufferSupported(runtime: any = (globalThis as any).Laya): boolean {
  return !!(
    runtime?.GBuffer?.Normal &&
    runtime.GBuffer.Surface &&
    typeof runtime.Camera?.prototype?.getOpaqueAuxiliaryTexture === 'function'
  );
}
