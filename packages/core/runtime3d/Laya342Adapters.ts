const patched = new WeakSet<object>();
/** Version-specific sizing seam. Native retinal sizing preserves design units
 * and scales the stage transform, including pointer conversion and text caches.
 * Override the browser ratio only during the synchronous resize so a render
 * quality cap never changes the browser/device measurement seen by consumers. */
export function resizeLaya342Stage(
  runtime: {
    Browser: object;
    systemTimer?: { clearCallLater(caller: object, method: (...args: never[]) => unknown): void };
    stage: {
      size(width: number, height: number): unknown;
      setScreenSize(width: number, height: number): void;
      updateCanvasSize?: (...args: never[]) => unknown;
      _canvasTransform?: {
        a: number;
        b: number;
        c: number;
        d: number;
        tx: number;
        ty: number;
      };
    };
  },
  width: number,
  height: number,
  designWidth: number,
  designHeight: number,
  dpr: number,
  canvas?: HTMLCanvasElement,
): void {
  const descriptor = Object.getOwnPropertyDescriptor(runtime.Browser, 'pixelRatio');
  try {
    Object.defineProperty(runtime.Browser, 'pixelRatio', {
      configurable: true,
      get: () => dpr,
    });
    runtime.stage.size(designWidth, designHeight);
    // size/alignment can enqueue a native window-sized callLater even after
    // screenAdaptationEnabled=false. Retire only that queued resize before our
    // container-owned sizing; otherwise a later frame overwrites DPR/input.
    if (runtime.stage.updateCanvasSize)
      runtime.systemTimer?.clearCallLater(runtime.stage, runtime.stage.updateCanvasSize);
    runtime.stage.setScreenSize(width * dpr, height * dpr);
    // Native _canvasTransform maps backing pixels to browser pixels. When
    // logical CSS dimensions replace native backing-sized CSS dimensions, the
    // browser already rescales the backing image. Compose that implicit scale
    // into the CSS transform once, retaining the native matrix for Laya input.
    const matrix = runtime.stage._canvasTransform;
    if (canvas?.style) {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      canvas.style.display = 'block';
      canvas.style.touchAction = 'none';
      if (matrix) {
        const sx = canvas.width / width,
          sy = canvas.height / height;
        const tx = matrix.tx - (parseInt(canvas.style.left) || 0);
        const ty = matrix.ty - (parseInt(canvas.style.top) || 0);
        canvas.style.transform = `matrix(${matrix.a * sx},${matrix.b * sx},${matrix.c * sy},${matrix.d * sy},${tx},${ty})`;
      }
    }
    // Laya's input consumes page coordinates, but native setScreenSize only
    // includes canvas.style.left/top. Account for an embedded container after
    // native CSS placement; do not move the rendered canvas a second time.
    if (canvas?.getBoundingClientRect && matrix) {
      const rect = canvas.getBoundingClientRect();
      const x = [
        0,
        matrix.a * canvas.width,
        matrix.c * canvas.height,
        matrix.a * canvas.width + matrix.c * canvas.height,
      ];
      const y = [
        0,
        matrix.b * canvas.width,
        matrix.d * canvas.height,
        matrix.b * canvas.width + matrix.d * canvas.height,
      ];
      matrix.tx = rect.left + (globalThis.scrollX || 0) - Math.min(...x);
      matrix.ty = rect.top + (globalThis.scrollY || 0) - Math.min(...y);
    }
  } finally {
    if (descriptor) Object.defineProperty(runtime.Browser, 'pixelRatio', descriptor);
    else Reflect.deleteProperty(runtime.Browser, 'pixelRatio');
  }
}
/** Laya 3.4.2 allocates two process-owned fallback textures but releases only depth.
 * Keep this version-specific repair isolated from consumer scene code. */
export function installLaya342LifecycleFix(runtime: any = (globalThis as any).Laya) {
  const prototype = runtime?.WebRender3DProcess?.prototype;
  if (!prototype || patched.has(prototype)) return;
  const destroy = prototype.destroy;
  if (typeof destroy !== 'function') return;
  const retired = new WeakSet<object>();
  prototype.destroy = function (...args: any[]) {
    if (retired.has(this)) return;
    retired.add(this);
    const shadow = this._defaultShadowMap;
    try {
      return destroy.apply(this, args);
    } finally {
      if (shadow && !shadow.destroyed) shadow.destroy();
      this._defaultShadowMap = null;
    }
  };
  patched.add(prototype);
}

/** Model ownership seam: native Node.destroy queues component teardown for the
 * next frame. Finish only this tree's queued components before releasing its
 * cache lease; otherwise zero-reference clips/meshes survive resource disposal.
 * Never drain the global driver (which could destroy unrelated consumer nodes).
 */
export function destroyLaya342ModelTree(node: any, runtime: any = (globalThis as any).Laya): void {
  const pending: { component: any; queue: Set<any> | undefined }[] = [];
  const collect = (n: any) => {
    for (const component of n._components ?? [])
      pending.push({
        component,
        queue: (component._driver || runtime?.stage?._componentDriver)?._toDestroys,
      });
    for (let i = 0; i < (n.numChildren || 0); i++) collect(n.getChildAt(i));
  };
  collect(node);
  node.destroy(true);
  for (const { component, queue } of pending)
    if (component._status === 4 && queue?.delete(component)) component._destroy(true);
}

/**
 * glTF multiplies a mesh's `COLOR_0` into its base colour. Laya 3.4.2's glTF
 * shader does so only for a material that carries `ENABLEVERTEXCOLOR`, and its
 * loader never sets it: baked shade, wet bands and tints were silently dropped.
 * Switches it on for the materials of every mesh in the tree that has a colour
 * channel. Returns how many materials changed.
 */
export function enableLaya342VertexColors(
  node: any,
  runtime: any = (globalThis as any).Laya,
): number {
  const define = runtime?.Shader3D?.getDefineByName?.('ENABLEVERTEXCOLOR');
  const usage = runtime?.VertexMesh?.MESH_COLOR0;
  if (!define || usage === undefined) return 0;
  const changed = new Set<any>();
  const visit = (n: any) => {
    const renderer =
      n.meshRenderer ??
      n.skinnedMeshRenderer ??
      n.getComponent?.(runtime.SkinnedMeshRenderer) ??
      n.getComponent?.(runtime.MeshRenderer);
    const mesh =
      renderer?.sharedMesh ??
      n.meshFilter?.sharedMesh ??
      (runtime.MeshFilter && n.getComponent?.(runtime.MeshFilter))?.sharedMesh;
    if (mesh?.getVertexDeclaration?.()?.getVertexElementByUsage?.(usage))
      for (const material of renderer.sharedMaterials ?? [])
        if (material?.addDefine && !changed.has(material)) {
          material.addDefine(define);
          changed.add(material);
        }
    for (let i = 0; i < (n.numChildren || 0); i++) visit(n.getChildAt(i));
  };
  visit(node);
  return changed.size;
}

const translucencyPatched = new WeakSet<object>();
/** The define that switches leaf translucency on for a material. */
export const ZHUDA_TRANSLUCENT_DEFINE = 'ZHUDA_TRANSLUCENT';
const LIGHTING_TAIL = 'return shading*light.color*NoL;}';
const shadowBiasPatched = new WeakSet<object>();
const SHADOW_BIAS_UPSTREAM =
  'float invNdotL=1.0-clamp(dot(-lightDirection,normalWS),0.0,1.0);float scale=invNdotL*u_ShadowBias.y;';
const SHADOW_BIAS_FIXED =
  'float zhudaFacing=dot(-lightDirection,normalWS);float invNdotL=1.0-clamp(zhudaFacing,0.0,1.0);float scale=invNdotL*u_ShadowBias.y*smoothstep(-0.25,0.0,zhudaFacing);';
/**
 * The shadow caster's vertex code with the normal bias kept off faces that
 * look away from the light; text that does not hold the upstream line comes
 * back unchanged. Pure: no Laya needed.
 */
export function zhudaPatchShadowBias(text: string): string {
  return text.includes(SHADOW_BIAS_UPSTREAM)
    ? text.replace(SHADOW_BIAS_UPSTREAM, SHADOW_BIAS_FIXED)
    : text;
}
/**
 * Laya 3.4.2 draws a shadow caster a little smaller than it is: every vertex
 * is pulled back along its normal, most where the surface lies along the
 * light. A face that looks away from the light is pulled the full distance,
 * which moves it toward the light: the underside of a thin slab (a paved
 * road, a floor, a roof) rises above its top and the top lies in its own
 * shadow all day. With this the pull fades out as a face turns away from the
 * light. Must run before `Laya.init`, which registers the include.
 */
export function installLaya342ShadowBias(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (shadowBiasPatched.has(shader)) return true;
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (name === 'DepthVertex.glsl' && typeof text === 'string') text = zhudaPatchShadowBias(text);
    return addInclude.call(this, name, text, ...rest);
  };
  shadowBiasPatched.add(shader);
  return true;
}

/**
 * Adds light that passes through thin surfaces to Laya 3.4.2's PBR lighting:
 * a leaf lit from behind glows in its own colour instead of going black.
 * Materials opt in with the `ZHUDA_TRANSLUCENT` define; everything else
 * compiles to the upstream code. Must run before `Laya.init`, which registers
 * the lighting include and compiles the PBR shaders from it.
 */
export function installLaya342Translucency(runtime: any = (globalThis as any).Laya): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  if (translucencyPatched.has(shader)) return true;
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (name === 'PBRLighting.glsl' && typeof text === 'string' && text.includes(LIGHTING_TAIL))
      text = text.replace(
        LIGHTING_TAIL,
        `vec3 zhudaLit=shading*light.color*NoL;
#ifdef ${ZHUDA_TRANSLUCENT_DEFINE}
// Light from behind, tinted by the leaf: warmer and greener than its surface colour.
zhudaLit+=surface.diffuseColor*vec3(1.25,1.3,0.55)*light.color*saturate(dot(pixel.normalWS,normalize(light.dir)))*0.42;
#endif
return zhudaLit;}`,
      );
    return addInclude.call(this, name, text, ...rest);
  };
  translucencyPatched.add(shader);
  return true;
}

/** The define that turns specular anti-aliasing on for a scene (or one material). */
export const ZHUDA_SPECULAR_AA_DEFINE = 'ZHUDA_SPECULAR_AA';
/**
 * The define a material carries while its normal map has no mipmaps: specular
 * anti-aliasing then leaves the map's part alone. Set and cleared as a
 * texture is given to a material (`Material.setTexture`, `normalTexture`); a
 * material whose normal map arrives another way can add it itself.
 */
export const ZHUDA_NORMAL_NOMIPMAP_DEFINE = 'ZHUDA_NORMAL_NOMIPMAP';
/** Laya 3.4.2's own function, in `PBRLighting.glsl`; nothing upstream calls it. */
const SPECULAR_AA_FUNCTION = 'float specularAA(float roughness,in vec3 normalWS){';
/** `PBRLighting.glsl`: the highlight of one light, up to its distribution and visibility terms. */
const SPECULAR_LOBE =
  'vec3 specularLobe(const in Surface surface,const in PixelInfo pixel,const in LightParams lightParams){float roughness=surface.roughness;float D=distribution(roughness,lightParams.NoH,lightParams.h,pixel.normalWS);float V=visibility(roughness,pixel.NoV,lightParams.NoL);';
/**
 * How a widened highlight is drawn, by where its width comes from.
 *
 * The part that comes from the surface turning across the pixel is a spread
 * over a small patch of normals, which has no long tail: for that share
 * (`zhudaWidened`, of the squared width) the lobe falls off as a Gaussian
 * (Beckmann) of the same width instead of GGX. GGX keeps a share of its light
 * far from the peak that grows with the width squared; on a lobe widened to a
 * pixel that drew a halo round a polished ball's highlight and a line along
 * its silhouette. The sine comes from a cross product, as in Laya's own
 * D_GGX, so mediump does not lose it near the peak.
 *
 * The part a normal map adds (`zhudaBumps`, its share of the squared width)
 * keeps GGX's shape: drawn with the Gaussian the picture stayed grainy. But
 * its bumps are little faces each turned its own way, and the ones that shine
 * are the ones that face halfway between the eye and the light. How much of
 * such a face is seen and lit depends on that angle, not on how the surface
 * as a whole lies to the eye: taking the surface's angle lit a bumpy ball up
 * to its edge. Toward the dark side the term still fades with the surface.
 *
 * Both shares start at nothing: a shader that lights a pixel it did not set
 * up through `PBRFrag.glsl` draws Laya's lobe as it was.
 */
const SPECULAR_LOBE_PATCHED = `
#ifdef ${ZHUDA_SPECULAR_AA_DEFINE}
float zhudaWidened=0.0;
float zhudaBumps=0.0;
float zhudaLobe(float d,float roughness,vec3 h,vec3 n){vec3 x=cross(n,h);float s=dot(x,x);float c=max(1.0-s,0.0001);float q=min(sqrt(s)/roughness,100.0);float k=1.0/(roughness*c);return mix(d,saturateMediump(exp(-q*q/c)*k*k*INVERT_PI),zhudaWidened);}
float zhudaFacets(float v,float roughness,float VoH,float NoL){float c=max(VoH,0.05);return mix(v,visibility(roughness,c,c)*c/max(NoL,0.3),zhudaBumps);}
#endif
${SPECULAR_LOBE}
#ifdef ${ZHUDA_SPECULAR_AA_DEFINE}
D=zhudaLobe(D,roughness,lightParams.h,pixel.normalWS);V=zhudaFacets(V,roughness,lightParams.VoH,lightParams.NoL);
#endif
`;
/** `PBRFrag.glsl`: the surface comes in read-only. */
const PIXEL_INFO_HEAD =
  'void getPixelInfo(inout PixelInfo info,const in PixelParams pixel,const in Surface surface){';
const PIXEL_INFO_HEAD_PATCHED =
  'void getPixelInfo(inout PixelInfo info,const in PixelParams pixel,inout Surface surface){';
/**
 * `PBRFrag.glsl`: the gain for light scattered more than once has just been
 * worked out from the material's own roughness.
 */
const PIXEL_ENERGY_SET = 'info.energyCompensation=(1.0+surface.f0*(1.0/info.dfg.y-1.0));\n#endif\n';
/**
 * Roughness squared grows by two amounts (Laya's `alpha`; the perceptual
 * roughness follows as its root):
 * - Laya's `specularAA` on the mesh's own normal: how far the surface turns
 *   across a pixel (Kaplanyan 2016, Tokuyoshi 2019; Laya's constants,
 *   variance 0.15, at most 0.04);
 * - the normal map's own filtering: a mipmap averages the bumps under a pixel
 *   into a shorter normal, and the shorter it is, the wider the spread of
 *   normals it stands for (Toksvig 2004, as a von Mises-Fisher lobe of
 *   concentration kappa). Normals spread with a variance of 1/kappa to each
 *   side widen a lobe of roughness alpha to alpha squared + 2/kappa; at most
 *   0.5 is added, so a surface never goes fully matte.
 * `max` keeps a mediump underflow of roughness squared from making a surface
 * smoother than it was. The derivatives run in getPixelInfo, which every
 * caller reaches outside any branch, as WebGPU's uniformity rule asks.
 */
const SPECULAR_AA_HELPER = `
#ifdef ${ZHUDA_SPECULAR_AA_DEFINE}
float zhudaSpecularAA(float roughness,vec3 normalWS,vec3 normalTS){float r=specularAA(roughness,normalWS);float l=clamp(length(normalTS),0.05,1.0);float spread=2.0*(1.0-l*l)/(l*(3.0-l*l));float wide=max(sqrt(saturate(r*r+min(spread,0.5))),roughness);zhudaWidened=saturate((r*r-roughness*roughness)/(wide*wide));zhudaBumps=saturate(min(spread,0.5)/(wide*wide));return wide;}
#endif
`;
/**
 * After the gain for light scattered more than once, which stays that of the
 * material: the wider highlight stands for bumps under the pixel, each as
 * smooth as the material, not for a rougher material. Without tangents the
 * normal map is not applied to the shading, so it widens nothing either.
 */
const PIXEL_ENERGY_SET_PATCHED = `${PIXEL_ENERGY_SET}#ifdef ${ZHUDA_SPECULAR_AA_DEFINE}
vec3 zhudaNormalTS=vec3(0.0,0.0,1.0);
#ifdef TANGENT
zhudaNormalTS=surface.normalTS;
#endif
surface.roughness=zhudaSpecularAA(surface.roughness,info.vertexNormalWS,zhudaNormalTS);surface.perceptualRoughness=sqrt(surface.roughness);
#endif
`;
const occurrences = (text: string, part: string) => text.split(part).length - 1;

/**
 * `PBRFrag.glsl` with specular anti-aliasing in `getPixelInfo`, behind
 * `ZHUDA_SPECULAR_AA`; the surface becomes `inout` so the widened roughness
 * reaches the lights, the environment lookup and the G-buffer. Text that does
 * not hold each anchor exactly once comes back unchanged with the reason.
 * Pure: no Laya needed.
 */
export function zhudaPatchSpecularAA(text: string): { text: string; reason?: string } {
  if (text.includes(PIXEL_INFO_HEAD_PATCHED) && text.includes(ZHUDA_SPECULAR_AA_DEFINE))
    return { text };
  for (const [anchor, name] of [
    [PIXEL_INFO_HEAD, 'the getPixelInfo signature'],
    [PIXEL_ENERGY_SET, 'the line that sets info.energyCompensation'],
  ]) {
    const found = occurrences(text, anchor);
    if (found !== 1) return { text, reason: `PBRFrag.glsl holds ${name} ${found} times, not once` };
  }
  return {
    text: text
      .replace(PIXEL_INFO_HEAD, SPECULAR_AA_HELPER + PIXEL_INFO_HEAD_PATCHED)
      .replace(PIXEL_ENERGY_SET, PIXEL_ENERGY_SET_PATCHED),
  };
}

/**
 * `PBRLighting.glsl` with the widened highlight's fall-off in `specularLobe`,
 * behind `ZHUDA_SPECULAR_AA` (see `SPECULAR_LOBE_PATCHED`). Text that does
 * not hold Laya's `specularAA` and the head of `specularLobe` exactly once
 * each comes back unchanged with the reason. Pure: no Laya needed.
 */
export function zhudaPatchSpecularLobe(text: string): { text: string; reason?: string } {
  if (text.includes('float zhudaLobe(')) return { text };
  for (const [anchor, name] of [
    [SPECULAR_AA_FUNCTION, 'specularAA(roughness, normalWS)'],
    [SPECULAR_LOBE, 'the head of specularLobe'],
  ]) {
    const found = occurrences(text, anchor);
    if (found !== 1)
      return { text, reason: `PBRLighting.glsl holds ${name} ${found} times, not once` };
  }
  return { text: text.replace(SPECULAR_LOBE, SPECULAR_LOBE_PATCHED) };
}

const NORMAL_SAMPLE =
  /vec3 normalSampler=texture2D\(u_NormalTexture,(\w+)\)\.(rgb|xyz);normalSampler=normalize\(normalSampler\*2\.0-1\.0\);/g;
const NORMAL_STORE = 'inputs.normalTS=normalScale(normalSampler,u_NormalScale);';
const PBR_FORWARD = /#include "(?:PBRMetallicFrag|glTFMetallicRoughness)\.glsl"/;
const SHADER_NAME = /#define SHADER_NAME (\w+)/;
/**
 * The forward pass of a physically based shader (Laya's `PBR`, `glTFPBR`, a
 * `ZhudaLitSurfaceMaterial`) with the spread of the normals under the pixel
 * kept as the length of `inputs.normalTS`, for `PBRFrag.glsl` to read;
 * `getPixelInfo` normalises it as before. The spread is read one mipmap level
 * above the one the shading uses: the bumps under the pixel and its
 * neighbours, which is steadier from pixel to pixel. It is kept:
 * - only where the map is drawn at less than half its size, fading in from two
 *   texels to a pixel to four (along the way it is most squeezed): nearer
 *   than that its bumps can be seen one by one and are left as they are, and
 *   magnified, the shorter normal halfway between two texels is no sign of
 *   bumps lost; it would draw their grid;
 * - only where the map has mipmaps: a material whose normal map has none
 *   carries `ZHUDA_NORMAL_NOMIPMAP` and compiles none of this, and where the
 *   read one level up comes back the same as the first there was no other
 *   level to read. Without mipmaps the shortness of a normal is chance and the
 *   sparkle is in the read itself, which no roughness repairs;
 * - less 0.004, which is 8-bit rounding, and in step with the normal scale
 *   (a map applied at half strength spreads the normals a quarter as far).
 * WebGL 1 has no `textureSize` and keeps the curvature term alone; so does a
 * material with a detail normal map, which renormalises the blend.
 *
 * Text that is not such a pass comes back unchanged. One that is, but reads
 * its normal map in another way, comes back unchanged with the reason.
 * Pure: no Laya needed.
 */
export function zhudaPatchNormalLength(fragment: string): { text: string; reason?: string } {
  if (!PBR_FORWARD.test(fragment) || !fragment.includes('u_NormalTexture'))
    return { text: fragment };
  if (fragment.includes('zhudaFine')) return { text: fragment };
  const samples = [...fragment.matchAll(NORMAL_SAMPLE)];
  const stores = occurrences(fragment, NORMAL_STORE);
  if (samples.length !== 1 || stores !== 1) {
    const name = SHADER_NAME.exec(fragment)?.[1] ?? 'a PBR pass';
    return {
      text: fragment,
      reason:
        samples.length !== 1
          ? `${name} reads its normal map ${samples.length} times in the known way, not once`
          : `${name} stores its normal ${stores} times in the known way, not once`,
    };
  }
  const [sample, uv, swizzle] = samples[0];
  return {
    text: fragment
      .replace(
        sample,
        `vec3 normalSampler=texture2D(u_NormalTexture,${uv}).${swizzle};vec3 zhudaFine=normalSampler*2.0-1.0;normalSampler=normalize(normalSampler*2.0-1.0);`,
      )
      .replace(
        NORMAL_STORE,
        `${NORMAL_STORE}\n#if defined(${ZHUDA_SPECULAR_AA_DEFINE}) && defined(GRAPHICS_API_GLES3) && !defined(DETAILNORMAL) && !defined(${ZHUDA_NORMAL_NOMIPMAP_DEFINE})\n{vec2 zhudaSize=vec2(textureSize(u_NormalTexture,0));vec2 zhudaX=dFdx(${uv})*zhudaSize;vec2 zhudaY=dFdy(${uv})*zhudaSize;vec3 zhudaCoarse=texture2D(u_NormalTexture,${uv},1.0).${swizzle}*2.0-1.0;vec3 zhudaStep=zhudaCoarse-zhudaFine;float zhudaShort=max(1.0-length(zhudaCoarse)-0.004,0.0)*u_NormalScale*u_NormalScale*smoothstep(4.0,16.0,max(dot(zhudaX,zhudaX),dot(zhudaY,zhudaY)))*smoothstep(0.0,0.0001,dot(zhudaStep,zhudaStep));inputs.normalTS*=1.0-min(zhudaShort,0.9);}\n#endif\n`,
      ),
  };
}

/** Where specular anti-aliasing stands in this runtime. */
export interface ZhudaSpecularAAStatus {
  /** `PBRFrag.glsl` and `PBRLighting.glsl` carry it, behind `ZHUDA_SPECULAR_AA`. */
  patched: boolean;
  /**
   * Every scene made from now on has the define. False unless it was asked
   * for (`installLaya342SpecularAA(runtime, { defaultOn: true })`): a scene
   * turns it on itself with `setZhudaSpecularAA(scene, true)`.
   */
  defaultOn: boolean;
  /** Why it is off, when it is. */
  reason?: string;
  /**
   * Forward passes registered so far that also read the normal map's own
   * filtering: Laya's `PBR` and `glTFPBR` and each `ZhudaLitSurfaceMaterial`
   * shader. Without it they keep the curvature term alone.
   */
  normalMapPasses: number;
  /**
   * Physically based forward passes that read a normal map in a way the
   * patch does not know, each with why: they keep the curvature term alone,
   * and a dense normal map on them sparkles as it did. Each was warned of
   * once on the console.
   */
  normalMapSkipped: string[];
  /**
   * Materials are told when their normal map has no mipmaps
   * (`ZHUDA_NORMAL_NOMIPMAP`). False when this runtime has no
   * `Material.setTextureByIndex` to watch.
   */
  watchesNormalMaps: boolean;
}
interface SpecularAAState extends ZhudaSpecularAAStatus {
  /** Asked to be on for every new scene. */
  wantDefault: boolean;
  lighting?: boolean;
  lightingReason?: string;
  fragment?: boolean;
  fragmentReason?: string;
  warned?: boolean;
}
const specularAAStates = new WeakMap<object, SpecularAAState>();

/** Decides once both includes have been seen, in whichever order they come. */
function settleSpecularAA(shader: any, state: SpecularAAState) {
  if (state.fragment === undefined || state.lighting === undefined) return;
  state.patched = state.fragment && state.lighting;
  let reason: string | undefined;
  if (!state.fragment) reason = state.fragmentReason;
  else if (!state.lighting) reason = state.lightingReason;
  else if (state.wantDefault) {
    if (typeof shader._configDefineValues?.add !== 'function')
      reason = 'Shader3D._configDefineValues is missing: the define cannot be made a default';
    else if (!state.defaultOn) {
      shader._configDefineValues.add(shader.getDefineByName(ZHUDA_SPECULAR_AA_DEFINE));
      state.defaultOn = true;
    }
  }
  state.reason = reason;
  if (reason && !state.warned) {
    state.warned = true;
    console.warn(`[zhuda] specular anti-aliasing is off: ${reason}`);
  }
}

export interface ZhudaSpecularAAInstallOptions {
  /**
   * Every `Scene3D` made from now on has it (default false: a scene asks
   * with `setZhudaSpecularAA(scene, true)`). A later call can ask for it;
   * none takes it back.
   */
  defaultOn?: boolean;
}

/** Whether a texture has mipmaps; one that cannot say is taken to have them. */
function hasMipmaps(texture: any): boolean {
  try {
    return texture?.mipmap !== false;
  } catch {
    return true;
  }
}

/**
 * Specular anti-aliasing for Laya 3.4.2's physically based shaders (`PBR`,
 * the glTF `glTFPBR`, and `ZhudaLitSurfaceMaterial`, which all set up their
 * pixel in `PBRFrag.glsl`). A dense normal map seen from afar has more bumps
 * under a pixel than the pixel can show: one pixel catches the sun on a bump
 * and its neighbour misses it, and as the camera moves the highlight
 * sparkles, worst on a phone's small pixels. The highlight is widened by the
 * spread of the normals the map's mipmap has averaged away, and by how far
 * the mesh's own surface turns across the pixel, so the light is spread over
 * the pixel instead.
 *
 * What it leaves alone: a flat surface without a normal map; a normal map
 * seen close up; a normal map without mipmaps (see
 * `ZHUDA_NORMAL_NOMIPMAP_DEFINE`). What it changes besides the sparkle: a
 * highlight narrower than a pixel on a curved surface (a small or polished
 * ball) becomes about a pixel wide and dimmer.
 *
 * Off until a scene asks: what the patch adds is behind the define and is
 * compiled out without it. `setZhudaSpecularAA(scene, true)` turns it on for one
 * scene; `{ defaultOn: true }` here adds the define to Laya's configuration
 * defines, which every `Scene3D` made afterwards copies. It is not the
 * default because of what was measured (docs/plans/records/specular-aa):
 * between two and four texels to a pixel a bumpy metal changes more from
 * frame to frame with it than without, its rim is brighter than the truth,
 * and one more read of the normal map a pixel cost a phone up to 3 ms a
 * frame in the one game measured. If the vendored text no longer holds an
 * anchor, nothing is changed and `zhudaSpecularAAStatus()` (and a console
 * warning) says why.
 * Must run before `Laya.init`, which registers the includes and the shaders.
 */
export function installLaya342SpecularAA(
  runtime: any = (globalThis as any).Laya,
  options: ZhudaSpecularAAInstallOptions = {},
): boolean {
  const shader = runtime?.Shader3D;
  if (!shader || typeof shader.addInclude !== 'function') return false;
  const installed = specularAAStates.get(shader);
  if (installed) {
    if (options.defaultOn && !installed.wantDefault) {
      installed.wantDefault = true;
      settleSpecularAA(shader, installed);
    }
    return true;
  }
  const state: SpecularAAState = {
    wantDefault: options.defaultOn === true,
    patched: false,
    defaultOn: false,
    reason: 'the PBR includes have not been registered (install before Laya.init)',
    normalMapPasses: 0,
    normalMapSkipped: [],
    watchesNormalMaps: false,
  };
  specularAAStates.set(shader, state);
  const addInclude = shader.addInclude;
  shader.addInclude = function (name: string, text: string, ...rest: unknown[]) {
    if (typeof text === 'string' && name === 'PBRLighting.glsl') {
      const result = zhudaPatchSpecularLobe(text);
      text = result.text;
      state.lighting = !result.reason;
      state.lightingReason = result.reason;
      settleSpecularAA(shader, state);
    } else if (typeof text === 'string' && name === 'PBRFrag.glsl') {
      const result = zhudaPatchSpecularAA(text);
      text = result.text;
      state.fragment = !result.reason;
      state.fragmentReason = result.reason;
      settleSpecularAA(shader, state);
    }
    return addInclude.call(this, name, text, ...rest);
  };
  const sub = runtime.SubShader?.prototype;
  if (sub && typeof sub.addShaderPass === 'function') {
    const addShaderPass = sub.addShaderPass;
    sub.addShaderPass = function (vertex: string, fragment: string, ...rest: unknown[]) {
      if (typeof fragment === 'string') {
        const result = zhudaPatchNormalLength(fragment);
        if (result.reason) {
          if (!state.normalMapSkipped.includes(result.reason)) {
            state.normalMapSkipped.push(result.reason);
            console.warn(
              `[zhuda] specular anti-aliasing leaves a normal map unfiltered: ${result.reason}`,
            );
          }
        } else if (result.text !== fragment) state.normalMapPasses++;
        fragment = result.text;
      }
      return addShaderPass.call(this, vertex, fragment, ...rest);
    };
  }
  // A material is told when its normal map has no mipmaps, as it is given one.
  const material = runtime.Material?.prototype;
  if (
    material &&
    typeof material.setTextureByIndex === 'function' &&
    typeof shader.propertyNameToID === 'function'
  ) {
    const setTextureByIndex = material.setTextureByIndex;
    let normalMap: number | undefined;
    material.setTextureByIndex = function (index: number, texture: any, ...rest: unknown[]) {
      const result = setTextureByIndex.call(this, index, texture, ...rest);
      normalMap ??= shader.propertyNameToID('u_NormalTexture');
      if (index === normalMap) {
        const define = shader.getDefineByName(ZHUDA_NORMAL_NOMIPMAP_DEFINE);
        if (texture && !hasMipmaps(texture)) this.addDefine?.(define);
        else this.removeDefine?.(define);
      }
      return result;
    };
    state.watchesNormalMaps = true;
  }
  return true;
}

/** Where specular anti-aliasing stands (see `installLaya342SpecularAA`). */
export function zhudaSpecularAAStatus(
  runtime: any = (globalThis as any).Laya,
): ZhudaSpecularAAStatus {
  const state = runtime?.Shader3D && specularAAStates.get(runtime.Shader3D);
  if (!state)
    return {
      patched: false,
      defaultOn: false,
      reason: 'not installed',
      normalMapPasses: 0,
      normalMapSkipped: [],
      watchesNormalMaps: false,
    };
  return {
    patched: state.patched,
    defaultOn: state.defaultOn,
    ...(state.reason ? { reason: state.reason } : {}),
    normalMapPasses: state.normalMapPasses,
    normalMapSkipped: [...state.normalMapSkipped],
    watchesNormalMaps: state.watchesNormalMaps,
  };
}

/**
 * Turns specular anti-aliasing on or off for everything a scene draws. New
 * scenes have it off unless it was installed with `defaultOn`. Every shader
 * of the scene is compiled again for the new
 * set of defines, so switch it when the scene is set up, not every frame.
 * Returns whether it is now on; it cannot be turned on when the patch is not
 * in place (see `zhudaSpecularAAStatus`). Throws when `scene` is not a Laya
 * `Scene3D`, or when LayaAir is not loaded.
 */
export function setZhudaSpecularAA(
  scene: any,
  enabled: boolean,
  runtime: any = (globalThis as any).Laya,
): boolean {
  const values = scene?._shaderValues;
  if (typeof values?.addDefine !== 'function' || typeof values.removeDefine !== 'function')
    throw Error('setZhudaSpecularAA: pass a Laya Scene3D');
  const shader = runtime?.Shader3D;
  if (typeof shader?.getDefineByName !== 'function')
    throw Error('setZhudaSpecularAA: LayaAir is not loaded');
  const define = shader.getDefineByName(ZHUDA_SPECULAR_AA_DEFINE);
  const state = specularAAStates.get(shader);
  if (!enabled || !state?.patched) {
    values.removeDefine(define);
    return false;
  }
  values.addDefine(define);
  return true;
}

/**
 * Call before drawing a scene by hand (`Camera.drawRenderTextureByScene`)
 * from inside an update: a mirror, a depth picture, a capture.
 *
 * Laya 3.4.2 gives renderers their reflection probe in the scene's own
 * update. A hand-drawn pass in a scene that is on the stage skips that step,
 * so a renderer added since the last frame is drawn without a probe. Its
 * shaders are then compiled without the probe's uniform block; on WebGPU the
 * probe's uniforms are added to the shared material map instead, and every
 * pass of that shader compiled afterwards fails ("nameless block contains a
 * member that already has a name", "u_IBLTex_Texture: redefinition").
 * This runs the scene's own probe assignment; it does nothing when no
 * renderer is waiting.
 */
export function prepareLaya342ManualDraw(scene: any): void {
  const volumes = scene?._volumeManager;
  if (!volumes) return;
  if (volumes.needreCaculateAllRenderObjects?.())
    volumes.reCaculateAllRenderObjects?.(scene._sceneRenderManager?.list);
  else volumes.handleMotionlist?.();
}
