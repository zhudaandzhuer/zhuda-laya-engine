import { registerZhudaEffectShaders } from './ShaderRegistry.ts';

/**
 * Shaders compiled before they are first drawn.
 *
 * LayaAir compiles a shader the first time something is drawn with it: for
 * that mesh's vertex layout and that set of defines (the material's, the
 * renderer's, the scene's lights, shadows and fog, the camera's). A scene
 * that comes on screen, a look that changes level and a model that changes
 * level of detail each bring shaders nobody has drawn yet, and the frame
 * that compiles them is long.
 *
 * LayaAir 3.4.2 can list what it compiles (`Shader3D.debugMode` with
 * `ShaderVariantCollection`) and compile from such a list
 * (`Shader3D.compileShaderByDefineNames`). This module makes the two usable:
 * - `ZhudaShaderVariantRecorder` lists every variant compiled while it runs,
 *   in an order that does not depend on what was drawn first. A game runs it
 *   once (in a development build, through each of its scenes and each level
 *   of its look) and ships the list;
 * - `zhudaWarmUpShaders` compiles a list a few milliseconds at a time behind
 *   a loading screen, and says what it compiled, what was there already and
 *   what it could not find.
 *
 * What it does not do: one shader cannot be compiled in parts, so the longest
 * single compile is the longest pause (the report gives it). On WebGPU the
 * list covers the shader modules; the render pipeline, which also depends on
 * the target and the blend state, is still made at the first draw. A list is
 * for the backend it was recorded on.
 *
 * A shader is compiled for the scene's uniform sets in force at that moment
 * (LayaAir's `preDrawUniformMaps`: the scene's, the global ones, and the
 * shadow maps on frames that draw shadows). They are not in LayaAir's own
 * list, and a shader compiled without them is wrong for good: on WebGL the
 * lights, fog and shadows of the scene are taken for the material's and the
 * surface is drawn dark; on WebGPU a shader that reads a shadow map does
 * not compile, and leaves the material's uniform block with members that
 * break every later compile of that shader. A node's uniform maps are
 * listed sorted by LayaAir, but on WebGPU their order is the order of the
 * bindings. So the recorder keeps the scene's sets and the node's maps in
 * their own order with each variant, the warm-up puts them in force for its
 * compile, and a 3D variant recorded without them is not compiled.
 * Only the recorder and the warm-up need the Laya runtime; the rest is pure.
 */
export interface ZhudaShaderVariant {
  /** The shader's registered name (`Shader3D.find`). */
  shader: string;
  subShader: number;
  pass: number;
  /** Define names, sorted, without those the engine's configuration gives every shader. */
  defines: string[];
  /**
   * Uniform maps of the node the pass was drawn for, in the node's own order:
   * on WebGPU the order is the order of the bindings.
   */
  nodeCommonMap: string[];
  /** Further uniform maps the pass was drawn with, in their own order. */
  additionMap: string[];
  /** Vertex attribute locations of the mesh it was drawn with, ascending. */
  attributeLocations: number[];
  is2D: boolean;
  /**
   * 3D shaders: the scene's uniform sets in force when it was compiled
   * (LayaAir's `preDrawUniformMaps`), sorted. A 3D variant without them is
   * not warmed up.
   */
  preDrawMaps?: string[];
}

export type ZhudaShaderBackend = 'webgl' | 'webgpu';

export interface ZhudaShaderVariantList {
  version: 1;
  /** The backend the list was recorded on; it is warmed up on the same one. */
  backend: ZhudaShaderBackend;
  variants: ZhudaShaderVariant[];
}

export const ZHUDA_SHADER_VARIANT_LIMIT = 4096;

const isIndex = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;
const isNames = (value: unknown, max: number) =>
  Array.isArray(value) &&
  value.length <= max &&
  value.every((name) => typeof name === 'string' && name.length > 0 && name.length <= 128);

/** What is wrong with a variant list, in words; empty when `zhudaWarmUpShaders` takes it. */
export function validateZhudaShaderVariantList(value: unknown): string[] {
  const problems: string[] = [];
  const list = value as Partial<ZhudaShaderVariantList> | null;
  if (!list || typeof list !== 'object') return ['a variant list is an object'];
  if (list.version !== 1) problems.push('version must be 1');
  if (list.backend !== 'webgl' && list.backend !== 'webgpu')
    problems.push("backend must be 'webgl' or 'webgpu'");
  if (!Array.isArray(list.variants)) return [...problems, 'variants must be an array'];
  if (list.variants.length > ZHUDA_SHADER_VARIANT_LIMIT)
    problems.push(`at most ${ZHUDA_SHADER_VARIANT_LIMIT} variants (${list.variants.length})`);
  list.variants.slice(0, ZHUDA_SHADER_VARIANT_LIMIT).forEach((variant, index) => {
    const at = `variants[${index}]`;
    if (!variant || typeof variant !== 'object') return problems.push(`${at} must be an object`);
    if (typeof variant.shader !== 'string' || !variant.shader || variant.shader.length > 128)
      problems.push(`${at}.shader must be a shader name`);
    if (!isIndex(variant.subShader)) problems.push(`${at}.subShader must be an index`);
    if (!isIndex(variant.pass)) problems.push(`${at}.pass must be an index`);
    if (!isNames(variant.defines, 256)) problems.push(`${at}.defines must be define names`);
    if (!isNames(variant.nodeCommonMap, 32))
      problems.push(`${at}.nodeCommonMap must be uniform map names`);
    if (!isNames(variant.additionMap, 32))
      problems.push(`${at}.additionMap must be uniform map names`);
    if (
      !Array.isArray(variant.attributeLocations) ||
      variant.attributeLocations.length > 32 ||
      !variant.attributeLocations.every(isIndex)
    )
      problems.push(`${at}.attributeLocations must be attribute locations`);
    if (typeof variant.is2D !== 'boolean') problems.push(`${at}.is2D must be true or false`);
    if (variant.preDrawMaps !== undefined && !isNames(variant.preDrawMaps, 16))
      problems.push(`${at}.preDrawMaps must be uniform map names`);
  });
  return problems;
}

/** One line that names a variant: two variants with the same line are the same compile. */
export function zhudaShaderVariantKey(variant: ZhudaShaderVariant): string {
  return [
    variant.shader,
    variant.subShader,
    variant.pass,
    variant.is2D ? '2d' : '3d',
    variant.defines.join(','),
    variant.nodeCommonMap.join(','),
    variant.additionMap.join(','),
    variant.attributeLocations.join(','),
    ...(variant.preDrawMaps ? [variant.preDrawMaps.join(',')] : []),
  ].join('/');
}

/**
 * Variants without repeats, in the order of their keys: the same set of
 * variants gives the same list whatever was drawn first. Defines, attribute
 * locations and the scene's sets are sorted; a node's uniform maps keep
 * their order, which is part of what is compiled. Pure.
 */
export function zhudaSortShaderVariants(variants: readonly ZhudaShaderVariant[]) {
  const seen = new Map<string, ZhudaShaderVariant>();
  for (const variant of variants) {
    const clean: ZhudaShaderVariant = {
      shader: variant.shader,
      subShader: variant.subShader,
      pass: variant.pass,
      defines: [...new Set(variant.defines)].sort(),
      nodeCommonMap: [...new Set(variant.nodeCommonMap ?? [])],
      additionMap: [...new Set(variant.additionMap ?? [])],
      attributeLocations: [...new Set(variant.attributeLocations ?? [])].sort((a, b) => a - b),
      is2D: variant.is2D === true,
      ...(variant.preDrawMaps ? { preDrawMaps: [...new Set(variant.preDrawMaps)].sort() } : {}),
    };
    const key = zhudaShaderVariantKey(clean);
    if (!seen.has(key)) seen.set(key, clean);
  }
  return [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([, v]) => v);
}

/**
 * Several lists of one backend as one (a list for each scene of a game, a
 * list for each level of its look). Throws when the lists are not all of the
 * same backend. Pure.
 */
export function zhudaMergeShaderVariants(
  ...lists: readonly ZhudaShaderVariantList[]
): ZhudaShaderVariantList {
  if (!lists.length) throw Error('zhudaMergeShaderVariants: give at least one list');
  const backend = lists[0].backend;
  for (const list of lists)
    if (list.backend !== backend)
      throw Error(`zhudaMergeShaderVariants: a ${list.backend} list among ${backend} lists`);
  return {
    version: 1,
    backend,
    variants: zhudaSortShaderVariants(lists.flatMap((list) => list.variants)),
  };
}

/** Which backend this runtime draws with. */
export function zhudaShaderBackend(runtime: any = (globalThis as any).Laya): ZhudaShaderBackend {
  const engine = runtime?.LayaGL?.renderEngine;
  const webgpu = runtime?.WebGPURenderEngine;
  return typeof webgpu === 'function' && engine instanceof webgpu ? 'webgpu' : 'webgl';
}

/** The scene's uniform sets a 3D shader is compiled for, on either backend (see the top of this file). */
function preDrawSets(runtime: any): Set<string> | undefined {
  const maps = (runtime?.WebGPURenderContext3D ?? runtime?.WebGLRenderContext3D)?._instance
    ?.preDrawUniformMaps;
  return maps instanceof Set ? maps : undefined;
}

const recording = new WeakMap<object, ZhudaShaderVariantRecorder>();

/**
 * Lists every shader variant LayaAir compiles from when it is made to when
 * it is stopped. Make it right after boot, before the scene: a variant
 * compiled earlier is not in the list. One at a time.
 */
export class ZhudaShaderVariantRecorder {
  private readonly l: any;
  private readonly collection: any;
  private readonly previous: { debugMode: boolean; active: unknown };
  private stopped = false;

  constructor(runtime: any = (globalThis as any).Laya) {
    const shader = runtime?.Shader3D,
      collection = runtime?.ShaderVariantCollection;
    if (typeof shader?.find !== 'function' || typeof collection !== 'function')
      throw Error('ZhudaShaderVariantRecorder: LayaAir is not loaded');
    if (recording.has(shader))
      throw Error('ZhudaShaderVariantRecorder: one recorder at a time (stop the other first)');
    this.l = runtime;
    this.previous = { debugMode: shader.debugMode === true, active: collection.active };
    this.collection = new collection();
    // LayaAir's own entry, and with it what the WebGPU backend compiles in besides.
    const add = this.collection.add;
    this.collection.add = function (this: any, pass: any, defines: string[], is2D: boolean) {
      const name = pass?._owner?._owner?._name;
      const before = this.items[name]?.length ?? 0;
      add.call(this, pass, defines, is2D);
      const entries = this.items[name];
      if (!entries || entries.length <= before) return;
      const entry = entries[entries.length - 1];
      // LayaAir keeps the node's maps sorted; their own order is what was compiled.
      entry.zhudaNodeMap = [...(pass.nodeCommonMap ?? [])];
      entry.zhudaAdditionMap = [...(pass.additionShaderData ?? [])];
      const maps = preDrawSets(runtime);
      if (!is2D && maps) entry.preDrawMaps = [...maps];
    };
    collection.active = this.collection;
    shader.debugMode = true;
    recording.set(shader, this);
  }

  /** Variants listed so far. */
  get count(): number {
    let count = 0;
    for (const name in this.collection.items) count += this.collection.items[name].length;
    return count;
  }

  /** The variants compiled so far, sorted; the recorder goes on listing. */
  list(): ZhudaShaderVariantList {
    const variants: ZhudaShaderVariant[] = [];
    const items = this.collection.items as Record<string, any[]>;
    for (const shader in items)
      for (const item of items[shader])
        variants.push({
          shader,
          subShader: item.subShaderIndex,
          pass: item.passIndex,
          defines: item.defines ?? [],
          nodeCommonMap: item.zhudaNodeMap ?? item.nodeCommonMap ?? [],
          additionMap: item.zhudaAdditionMap ?? item.additionMap ?? [],
          attributeLocations: item.attributeLocations ?? [],
          is2D: item.is2D === true,
          ...(item.preDrawMaps ? { preDrawMaps: item.preDrawMaps } : {}),
        });
    return {
      version: 1,
      backend: zhudaShaderBackend(this.l),
      variants: zhudaSortShaderVariants(variants),
    };
  }

  /** Gives LayaAir its own collection and debug switch back. The list stays readable. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    const shader = this.l.Shader3D,
      collection = this.l.ShaderVariantCollection;
    if (collection.active === this.collection) collection.active = this.previous.active;
    shader.debugMode = this.previous.debugMode;
    recording.delete(shader);
  }
}

export interface ZhudaShaderWarmUpOptions {
  /**
   * Milliseconds of compiling before the next frame is let through, 1..1000
   * (default 8). One compile is never cut: a slice ends after the compile
   * that passes the budget.
   */
  budgetMs?: number;
  /** Stops between two compiles; the promise rejects with the signal's reason. */
  signal?: AbortSignal;
  /** Called after every slice, for a loading bar. */
  onProgress?: (done: number, total: number) => void;
  /**
   * Waits for the next frame between slices. Default: one frame of LayaAir's
   * system timer. A test gives its own.
   */
  wait?: () => Promise<void>;
  /** A clock in milliseconds (default `performance.now`). */
  now?: () => number;
}

export interface ZhudaShaderWarmUpReport {
  total: number;
  /** Compiled now. */
  compiled: number;
  /** Compiled before the warm-up reached them. */
  cached: number;
  /** Not found: the shader, sub-shader or pass of that name is not registered (yet). By key. */
  missing: string[];
  /**
   * Not compiled, by key with the reason: it threw, or it is a 3D variant
   * recorded without the scene's uniform sets. The warm-up went on.
   */
  failed: string[];
  /** Why nothing was compiled, when the list was not for this runtime. */
  refused?: string;
  /** Milliseconds spent compiling, and the longest single compile among them. */
  ms: number;
  longestMs: number;
  /** Frames the warm-up was spread over. */
  slices: number;
}

/**
 * Compiles the variants of a list that are not compiled yet, `budgetMs` at a
 * time, and resolves with what happened. A list of the other backend, or one
 * the validator refuses, compiles nothing and says so in `refused`: a
 * warm-up never keeps a game from starting. The engine's own effects are
 * registered for it when a name is not known (`registerZhudaEffectShaders`);
 * a material's shader is registered when the material is first made, so
 * run the warm-up after the scene is made and before it is drawn. What is
 * still not registered comes back in `missing`.
 */
export async function zhudaWarmUpShaders(
  list: ZhudaShaderVariantList,
  options: ZhudaShaderWarmUpOptions = {},
  runtime: any = (globalThis as any).Laya,
): Promise<ZhudaShaderWarmUpReport> {
  const budget = options.budgetMs ?? 8;
  if (typeof budget !== 'number' || !Number.isFinite(budget) || budget < 1 || budget > 1000)
    throw Error('zhudaWarmUpShaders: budgetMs must be 1..1000');
  const report: ZhudaShaderWarmUpReport = {
    total: Array.isArray(list?.variants) ? list.variants.length : 0,
    compiled: 0,
    cached: 0,
    missing: [],
    failed: [],
    ms: 0,
    longestMs: 0,
    slices: 0,
  };
  const problems = validateZhudaShaderVariantList(list);
  if (problems.length) return { ...report, refused: `not a variant list: ${problems[0]}` };
  const shader = runtime?.Shader3D,
    passClass = runtime?.ShaderPass;
  if (
    typeof shader?.compileShaderByDefineNames !== 'function' ||
    typeof shader.find !== 'function' ||
    typeof passClass?.createShaderInstance !== 'function'
  )
    return { ...report, refused: 'LayaAir is not loaded, or is not 3.4.2' };
  const backend = zhudaShaderBackend(runtime);
  if (list.backend !== backend)
    return { ...report, refused: `the list was recorded on ${list.backend}, this is ${backend}` };

  const now = options.now ?? (() => performance.now());
  const wait =
    options.wait ??
    (() =>
      new Promise<void>((resolve) => {
        const timer = runtime.systemTimer ?? runtime.timer;
        if (typeof timer?.frameOnce === 'function') timer.frameOnce(1, null, resolve);
        else resolve();
      }));
  const aborted = () => {
    if (options.signal?.aborted)
      throw options.signal.reason ?? new DOMException('Cancelled', 'AbortError');
  };
  // Counts what LayaAir really compiles: a variant that is in its cache makes no instance.
  let made = 0;
  const create = passClass.createShaderInstance;
  const counting = function (this: unknown, ...args: unknown[]) {
    made++;
    return create.apply(this, args);
  };

  const preDraw = preDrawSets(runtime);
  const find = (variant: ZhudaShaderVariant) =>
    shader.find(variant.shader)?.getSubShaderAt?.(variant.subShader)?._passes?.[variant.pass];
  let registeredEffects = false;
  const variants = zhudaSortShaderVariants(list.variants);
  report.total = variants.length;
  let index = 0;
  while (index < variants.length) {
    aborted();
    const sliceStart = now();
    report.slices++;
    passClass.createShaderInstance = counting;
    try {
      // One compile at least in every slice, so that a slow clock cannot stall it.
      do {
        const variant = variants[index++];
        const key = zhudaShaderVariantKey(variant);
        let pass = find(variant);
        if (!pass && !registeredEffects) {
          // An effect of the engine that nothing has made yet: register them all, once.
          registeredEffects = true;
          registerZhudaEffectShaders(runtime);
          pass = find(variant);
        }
        if (!pass) {
          report.missing.push(key);
          continue;
        }
        const scoped = !variant.is2D;
        if (scoped && (!variant.preDrawMaps || !preDraw)) {
          report.failed.push(`${key}: recorded without the scene's uniform sets`);
          continue;
        }
        // LayaAir's compile leaves the pass set up for this variant; a draw
        // that does not set these itself would inherit them.
        const before = {
          nodeCommonMap: pass.nodeCommonMap,
          additionShaderData: pass.additionShaderData,
          attributeLocations: pass.attributeLocations,
        };
        const inForce = scoped ? [...preDraw!] : [];
        if (scoped) {
          preDraw!.clear();
          for (const name of variant.preDrawMaps!) preDraw!.add(name);
        }
        const from = now(),
          count = made;
        try {
          shader.compileShaderByDefineNames(
            variant.shader,
            variant.subShader,
            variant.pass,
            variant.defines,
            variant.nodeCommonMap,
            variant.additionMap,
            variant.is2D,
            variant.attributeLocations,
          );
          if (made > count) report.compiled++;
          else report.cached++;
        } catch (error) {
          report.failed.push(`${key}: ${String((error as Error)?.message ?? error)}`);
        } finally {
          pass.nodeCommonMap = before.nodeCommonMap;
          pass.additionShaderData = before.additionShaderData;
          pass.attributeLocations = before.attributeLocations;
          if (scoped) {
            preDraw!.clear();
            for (const name of inForce) preDraw!.add(name);
          }
        }
        const took = now() - from;
        report.ms += took;
        if (took > report.longestMs) report.longestMs = took;
      } while (index < variants.length && now() - sliceStart < budget);
    } finally {
      // Only while a slice runs: a draw between slices is not counted or slowed.
      if (passClass.createShaderInstance === counting) passClass.createShaderInstance = create;
    }
    options.onProgress?.(index, variants.length);
    if (index < variants.length) await wait();
  }
  report.ms = +report.ms.toFixed(2);
  report.longestMs = +report.longestMs.toFixed(2);
  return report;
}
