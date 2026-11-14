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
