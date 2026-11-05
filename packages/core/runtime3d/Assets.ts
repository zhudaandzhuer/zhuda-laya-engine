import { prepareLaya342GltfResource, copyLaya342MorphWeights, createLaya342ModelTemplate } from "./Laya342GltfAdapter.ts";
import { inspectGltfAsset, readGltfAssetDocument, ZhudaModelCompatibilityError, type ModelCompatibilityReport } from "./ModelCompatibility.ts";
import { destroyLaya342ModelTree } from "./Laya342Adapters.ts";
import type { AssetProvider, LoadedAssetBytes } from "./AssetProvider.ts";
import { normalizeAssetId } from "./AssetProvider.ts";
export type AssetPhase = "downloading" | "parsing" | "ready";
export interface AssetLease<T> {
  readonly value: T;
  release(): void;
}
type Entry<T> = {
  refs: number;
  value?: T;
  ready: boolean;
  promise: Promise<T>;
  abort: AbortController;
  phase: AssetPhase;
  used: number;
};
const abortError = () =>
  new DOMException("Asset request cancelled", "AbortError");
/** Per-caller cancellation, shared in-flight work, bounded warm cache, explicit ownership. */
export class ZhudaAssetCache<T> {
  readonly load: (
    key: string,
    signal: AbortSignal,
    phase: (p: AssetPhase) => void,
  ) => Promise<T>;
  readonly destroy: (value: T) => void;
  readonly maxIdle: number;
  private entries = new Map<string, Entry<T>>();
  private disposed = false;
  private serial = 0;
  loads = 0;
  constructor(
    load: (
      key: string,
      signal: AbortSignal,
      phase: (p: AssetPhase) => void,
    ) => Promise<T>,
    destroy: (value: T) => void,
    maxIdle = 0,
  ) {
    this.load = load;
    this.destroy = destroy;
    this.maxIdle = maxIdle;
    if (!Number.isInteger(maxIdle) || maxIdle < 0)
      throw Error("Invalid warm asset bound");
  }
  async acquire(
    key: string,
    options: { signal?: AbortSignal; retries?: number } = {},
  ): Promise<AssetLease<T>> {
    if (this.disposed) throw Error("Disposed asset cache");
    if (options.signal?.aborted) throw abortError();
    if (
      !key ||
      (options.retries !== undefined &&
        (!Number.isInteger(options.retries) ||
          options.retries < 0 ||
          options.retries > 3))
    )
      throw Error("Invalid asset request");
    let e = this.entries.get(key);
    if (!e) {
      const controller = new AbortController();
      e = {
        refs: 0,
        ready: false,
        abort: controller,
        phase: "downloading",
        used: ++this.serial,
        promise: null!,
      };
      const created = e;
      this.entries.set(key, e);
      this.loads++;
      e.promise = (async () => {
        let last: any;
        for (
          let i = 0;
          i <= Math.max(0, Math.min(3, options.retries ?? 0));
          i++
        ) {
          try {
            return await this.load(
              key,
              controller.signal,
              (p) => (created.phase = p),
            );
          } catch (error) {
            last = error;
            if (controller.signal.aborted) throw error;
          }
        }
        throw last;
      })().then(
        (value) => {
          created.value = value;
          created.ready = true;
          created.phase = "ready";
          if (
            controller.signal.aborted ||
            this.disposed ||
            this.entries.get(key) !== created
          ) {
            this.destroy(value);
            throw abortError();
          }
          return value;
        },
        (error) => {
          if (this.entries.get(key) === created) this.entries.delete(key);
          throw error;
        },
      );
    }
    const target = e;
    target.refs++;
    target.used = ++this.serial;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      target.refs--;
      target.used = ++this.serial;
      this.evict();
    };
    let cancel: (() => void) | undefined;
    try {
      const value = await new Promise<T>((resolve, reject) => {
        cancel = () => {
          release();
          reject(abortError());
        };
        options.signal?.addEventListener("abort", cancel, { once: true });
        target.promise.then(resolve, reject);
      });
      if (released) throw abortError();
      return { value, release };
    } catch (error) {
      release();
      throw error;
    } finally {
      if (cancel) options.signal?.removeEventListener("abort", cancel);
    }
  }
  private evict() {
    for (const [k, e] of this.entries)
      if (!e.refs && !e.ready) {
        this.entries.delete(k);
        e.abort.abort();
      }
    const idle = [...this.entries]
      .filter(([, e]) => !e.refs && e.ready)
      .sort((a, b) => a[1].used - b[1].used);
    while (idle.length > this.maxIdle) {
      const [k, e] = idle.shift()!;
      this.entries.delete(k);
      this.destroy(e.value!);
    }
  }
  report() {
    return {
      entries: this.entries.size,
      references: [...this.entries.values()].reduce((n, e) => n + e.refs, 0),
      pending: [...this.entries.values()].filter((e) => !e.ready).length,
      loads: this.loads,
      phases: [...this.entries].map(([key, e]) => ({
        key,
        phase: e.phase,
        references: e.refs,
      })),
      gpuReady: "requires-first-draw" as const,
    };
  }
  dispose() {
    if (this.disposed) return;
    if ([...this.entries.values()].some((e) => e.refs > 0))
      throw Error("Release all asset leases before disposing cache");
    this.disposed = true;
    for (const e of this.entries.values()) {
      e.abort.abort();
      if (e.ready) this.destroy(e.value!);
    }
    this.entries.clear();
  }
}
export class ZhudaRequestSlot {
  private generation = 0;
  private active: AbortController | null = null;
  async replace<T>(
    load: (signal: AbortSignal) => Promise<T>,
    commit: (value: T) => void,
    discard: (value: T) => void,
  ) {
    this.cancel();
    const n = this.generation,
      c = (this.active = new AbortController());
    try {
      const value = await load(c.signal);
      if (n !== this.generation || c.signal.aborted) {
        discard(value);
        return false;
      }
      try {
        commit(value);
      } catch (error) {
        discard(value);
        throw error;
      }
      return true;
    } catch (e) {
      if (c.signal.aborted) return false;
      throw e;
    }
  }
  cancel() {
    this.generation++;
    this.active?.abort();
    this.active = null;
  }
}
function visit(node: any, fn: (n: any) => void) {
  fn(node);
  for (let i = 0; i < (node.numChildren || 0); i++)
    visit(node.getChildAt(i), fn);
}
export interface ModelInstance {
  readonly node: Laya.Sprite3D;
  readonly compatibility: ModelCompatibilityReport;
  readonly materials: readonly Laya.Material[];
  setTint(color: [number, number, number, number]): void;
  find(name: string): Laya.Sprite3D | null;
  dispose(): void;
}
export interface ModelLibraryOptions {
  maxIdle?: number;
  /** Borrowed provider. Embedded GLB/glTF only; external URI dependencies are rejected. */
  provider?: AssetProvider;
  /** Per-caller download + parse deadline. Default 15000ms. */
  timeoutMs?: number;
}
export class ZhudaModelLibrary {
  readonly cache: ZhudaAssetCache<any>;
  private instances = new Set<any>();
  // glTFResource.create() rebuilds animation clips on every call in 3.4.2.
  // Retain one off-scene template per existing cache lease and clone its tree.
  private templates = new WeakMap<object, { node: Laya.Sprite3D; clips: Set<Laya.AnimationClip>; compatibility: ModelCompatibilityReport }>();
  private readonly timeoutMs: number;
  private readonly provider?: AssetProvider;
  constructor(options: number | ModelLibraryOptions = 3) {
    const config = typeof options === "number" ? { maxIdle: options } : options;
    this.provider = config.provider;
    this.timeoutMs = config.timeoutMs ?? 15000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs <= 0) throw Error("Invalid model deadline");
    this.cache = new ZhudaAssetCache(
      async (url, signal, phase) => {
        const l = (globalThis as any).Laya;
        if (!l?.glTFResource)
          throw Error("Load Laya glTF module before models");
        let asset: LoadedAssetBytes | undefined;
        let resource: any;
        try {
          let bytes: ArrayBuffer;
          if (this.provider) {
            asset = await this.provider.load(url, { signal });
            if (signal.aborted) throw abortError();
            // Isolate offset/shared provider storage from the native parser.
            bytes = new Uint8Array(asset.bytes).buffer;
          } else {
            const response = await fetch(url, { signal });
            if (!response.ok) throw Error(`Model HTTP ${response.status}`);
            bytes = await response.arrayBuffer();
          }
          if (signal.aborted) throw abortError();
          const compatibility = inspectGltfAsset(bytes);
          if (compatibility.status === "unsupported") throw new ZhudaModelCompatibilityError(compatibility, url);
          const parsed = readGltfAssetDocument(bytes);
          if (this.provider) {
            for (const item of [...((parsed.document.buffers ?? []) as {uri?: string}[]), ...((parsed.document.images ?? []) as {uri?: string}[])])
              if (item.uri !== undefined && !item.uri.startsWith("data:"))
                throw Error("Provider models require embedded buffers/images; repack as a self-contained GLB");
          }
          phase("parsing");
          resource = new l.glTFResource();
          prepareLaya342GltfResource(resource, l);
          if (parsed.binary) await resource._parseglb(bytes, url);
          else await resource._parse(parsed.document, url);
          if (signal.aborted) {
            resource.destroy();
            throw abortError();
          }
          const template = createLaya342ModelTemplate(resource, l);
          const clips = new Set<Laya.AnimationClip>();
          visit(template, n => {
            const animator = l.Animator && n.getComponent?.(l.Animator);
            if (animator) for (let i = 0; i < animator.controllerLayerCount; i++)
              for (const state of animator.getControllerLayer(i).states) if (state.clip) clips.add(state.clip);
          });
          this.templates.set(resource, { node: template, clips, compatibility });
          resource._addReference(); // Cache owns the prefab even while no instances are visible.
          return resource;
        } catch (e) {
          if (resource && !resource.destroyed) resource.destroy();
          throw e;
        } finally {
          asset?.release?.();
        }
      },
      (r) => {
        const template = this.templates.get(r);
        if (template) destroyLaya342ModelTree(template.node);
        r._removeReference();
        r.destroy();
        // Imported clips are created by glTF rather than registered as resource
        // dependencies. Node teardown drops references but doesn't collect them.
        for (const clip of template?.clips ?? [])
          if (!clip.destroyed && clip.referenceCount === 0) clip.destroy();
        this.templates.delete(r);
      },
      config.maxIdle ?? 3,
    );
  }
  async instantiate(
    url: string,
    options: {
      signal?: AbortSignal;
      independentMaterials?: boolean;
      retries?: number;
      timeoutMs?: number;
    } = {},
  ): Promise<ModelInstance> {
    const key = this.provider ? normalizeAssetId(url) : url;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw Error("Invalid model deadline");
    const controller = new AbortController();
    const relay = () => controller.abort(options.signal?.reason);
    options.signal?.addEventListener("abort", relay, { once: true });
    if (options.signal?.aborted) relay();
    // IO deadline only. No gameplay time is driven by this timer.
    const timer = setTimeout(() => controller.abort(new DOMException("Model request timed out", "TimeoutError")), timeoutMs);
    let lease: AssetLease<any>;
    try { lease = await this.cache.acquire(key, { ...options, signal: controller.signal }); }
    catch (error) { if (controller.signal.reason?.name === "TimeoutError") throw controller.signal.reason; throw error; }
    finally { clearTimeout(timer); options.signal?.removeEventListener("abort", relay); }
    let node: any;
    const materials: any[] = [];
    try {
      if (options.signal?.aborted) throw abortError();
      const template = this.templates.get(lease.value);
      if (!template) throw Error("Model template unavailable");
      node = template.node.clone();
      // Native clone selects the first state, while glTF may author a different
      // default. Preserve each layer's selected state before the clone is mounted.
      const l = (globalThis as any).Laya;
      const restoreDefaults = (source: any, target: any) => {
        copyLaya342MorphWeights(source, target, l);
        const a = l.Animator && source.getComponent?.(l.Animator), b = l.Animator && target.getComponent?.(l.Animator);
        if (a && b) for (let i = 0; i < a.controllerLayerCount; i++) {
          const original = a.getControllerLayer(i).defaultState;
          const layer = b.getControllerLayer(i);
          if (original) layer.defaultState = layer.getAnimatorState(original.name);
        }
        for (let i = 0; i < (source.numChildren || 0); i++) restoreDefaults(source.getChildAt(i), target.getChildAt(i));
      };
      restoreDefaults(template.node, node);
      if (options.independentMaterials)
        visit(node, (n) => {
          const l = (globalThis as any).Laya;
          const renderer =
            n.meshRenderer ||
            n.skinnedMeshRenderer ||
            n.getComponent?.(l.SkinnedMeshRenderer) ||
            n.getComponent?.(l.MeshRenderer);
          if (renderer) {
            renderer.sharedMaterials = renderer.sharedMaterials.map(
              (m: any) => {
                const copy = m.clone();
                materials.push(copy);
                return copy;
              },
            );
          }
        });
    } catch (e) {
      if (node) destroyLaya342ModelTree(node);
      for (const m of materials) if (!m.destroyed) m.destroy();
      lease.release();
      throw e;
    }
    this.instances.add(node);
    let disposed = false;
    return {
      node,
      compatibility: this.templates.get(lease.value)!.compatibility,
      materials,
      setTint: (color: [number, number, number, number]) => {
        if (disposed) throw Error("Disposed model instance");
        if (!options.independentMaterials)
          throw Error("Tint requires independent materials");
        if (
          color.length !== 4 ||
          !color.every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
        )
          throw Error("Invalid linear tint");
        const l = (globalThis as any).Laya;
        for (const m of materials) {
          if ("albedoColor" in m) m.albedoColor = new l.Color(...color);
          else if (m.getVector4("u_BaseColorFactor"))
            m.setVector4("u_BaseColorFactor", new l.Vector4(...color));
          else throw Error("Model material does not expose a base color");
        }
      },
      find: (name: string) => {
        let found: any = null;
        visit(node, (n) => {
          if (n.name === name) found = n;
        });
        return found;
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        destroyLaya342ModelTree(node);
        for (const m of materials) if (!m.destroyed) m.destroy();
        this.instances.delete(node);
        lease.release();
      },
    };
  }
  report() {
    return { ...this.cache.report(), instances: this.instances.size };
  }
  dispose() {
    if (this.instances.size)
      throw Error("Dispose model instances before library");
    this.cache.dispose();
  }
}
