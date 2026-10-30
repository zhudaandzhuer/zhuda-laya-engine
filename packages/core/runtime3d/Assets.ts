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
export class ZhudaModelLibrary {
  readonly cache: ZhudaAssetCache<any>;
  private instances = new Set<any>();
  constructor(maxIdle = 3) {
    this.cache = new ZhudaAssetCache(
      async (url, signal, phase) => {
        const l = (globalThis as any).Laya;
        if (!l?.glTFResource)
          throw Error("Load Laya glTF module before models");
        const response = await fetch(url, { signal });
        if (!response.ok) throw Error(`Model HTTP ${response.status}`);
        const bytes = await response.arrayBuffer();
        if (signal.aborted) throw abortError();
        phase("parsing");
        const resource = new l.glTFResource();
        try {
          const view = new DataView(bytes);
          if (bytes.byteLength >= 12 && view.getUint32(0, true) === 0x46546c67)
            await resource._parseglb(bytes, url);
          else
            await resource._parse(
              JSON.parse(new TextDecoder().decode(bytes)),
              url,
            );
          if (signal.aborted) {
            resource.destroy();
            throw abortError();
          }
          resource._addReference(); // Cache owns the prefab even while no instances are visible.
          return resource;
        } catch (e) {
          if (!resource.destroyed) resource.destroy();
          throw e;
        }
      },
      (r) => {
        r._removeReference();
        r.destroy();
      },
      maxIdle,
    );
  }
  async instantiate(
    url: string,
    options: {
      signal?: AbortSignal;
      independentMaterials?: boolean;
      retries?: number;
    } = {},
  ) {
    const lease = await this.cache.acquire(url, options);
    let node: any;
    const materials: any[] = [];
    try {
      if (options.signal?.aborted) throw abortError();
      node = lease.value.create();
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
      node?.destroy(true);
      lease.release();
      throw e;
    }
    this.instances.add(node);
    let disposed = false;
    return {
      node,
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
        node.destroy(true);
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
