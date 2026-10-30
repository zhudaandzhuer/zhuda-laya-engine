import { ZhudaRequestSlot } from "./Assets.ts";
import type { Vec3 } from "./Math3D.ts";

/** Owned releases execute in reverse order. Borrowed resources must not be registered here. */
export class ZhudaResourceScope {
  private releases: (() => void)[] = [];
  disposed = false;
  own<T>(value: T, release: (value: T) => void): T {
    if (this.disposed) {
      release(value);
      throw Error("Disposed resource scope");
    }
    this.releases.push(() => release(value));
    return value;
  }
  defer(release: () => void) {
    this.own(release, (f) => f());
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const errors: unknown[] = [];
    for (const release of this.releases.reverse())
      try {
        release();
      } catch (e) {
        errors.push(e);
      }
    this.releases = [];
    if (errors.length)
      throw Object.assign(Error("Resource release failed"), { errors });
  }
}
export interface SceneRegion {
  dispose(): void;
}
/** Regions are consumer-defined. Leaving a region cancels pending work and rejects late additions. */
export class ZhudaSceneRegions {
  private regions = new Map<
    string,
    { slot: ZhudaRequestSlot; value?: SceneRegion }
  >();
  async enter(
    id: string,
    create: (signal: AbortSignal) => Promise<SceneRegion>,
  ) {
    if (!id) throw Error("Missing region ID");
    this.leave(id);
    const record = {
      slot: new ZhudaRequestSlot(),
      value: undefined as SceneRegion | undefined,
    };
    this.regions.set(id, record);
    try {
      return await record.slot.replace(
        create,
        (value) => (record.value = value),
        (value) => value.dispose(),
      );
    } catch (e) {
      if (this.regions.get(id) === record) this.regions.delete(id);
      throw e;
    }
  }
  leave(id: string) {
    const r = this.regions.get(id);
    if (!r) return;
    this.regions.delete(id);
    r.slot.cancel();
    r.value?.dispose();
  }
  clear() {
    for (const id of [...this.regions.keys()]) this.leave(id);
  }
  get size() {
    return this.regions.size;
  }
}
export type SceneResourceKind = "mesh" | "texture" | "renderTarget";
export class ZhudaSceneBudget {
  private resources = new Map<
    string,
    { kind: SceneResourceKind; estimatedBytes: number }
  >();
  track(id: string, kind: SceneResourceKind, estimatedBytes: number) {
    if (
      !id ||
      this.resources.has(id) ||
      !Number.isFinite(estimatedBytes) ||
      estimatedBytes < 0
    )
      throw Error("Invalid/duplicate resource budget");
    this.resources.set(id, { kind, estimatedBytes });
    return () => this.resources.delete(id);
  }
  report() {
    const counts = { mesh: 0, texture: 0, renderTarget: 0 };
    let estimatedBytes = 0;
    for (const r of this.resources.values()) {
      counts[r.kind]++;
      estimatedBytes += r.estimatedBytes;
    }
    return { counts, estimatedBytes, memoryMeasurement: "estimate" as const };
  }
}
export interface SceneQuality {
  dprCap: number;
  shadowDistance: number;
  shadowResolution: 512 | 1024 | 2048;
  extraPasses: number;
  lodDistance: number;
}
export const sceneQuality: Record<"low" | "medium" | "high", SceneQuality> = {
  low: {
    dprCap: 1,
    shadowDistance: 0,
    shadowResolution: 512,
    extraPasses: 0,
    lodDistance: 20,
  },
  medium: {
    dprCap: 1.5,
    shadowDistance: 30,
    shadowResolution: 1024,
    extraPasses: 0,
    lodDistance: 40,
  },
  high: {
    dprCap: 2,
    shadowDistance: 60,
    shadowResolution: 2048,
    extraPasses: 2,
    lodDistance: 80,
  },
};
/** Hysteresis avoids repeated mesh swaps at a distance boundary. Consumer owns LOD meshes. */
export class ZhudaDistanceLOD {
  readonly distance: number;
  readonly hysteresis: number;
  private near = true;
  constructor(distance: number, hysteresis = 2) {
    this.distance = distance;
    this.hysteresis = hysteresis;
    if (!(distance > hysteresis && hysteresis >= 0))
      throw Error("Invalid LOD bounds");
  }
  update(camera: Vec3, object: Vec3) {
    const d = Math.hypot(
      camera.x - object.x,
      camera.y - object.y,
      camera.z - object.z,
    );
    if (d > this.distance + this.hysteresis) this.near = false;
    else if (d < this.distance - this.hysteresis) this.near = true;
    return this.near;
  }
}

/** Logical resource inventory. Byte totals are estimates, never driver/GPU measurements. */
export function inspectSceneResources(runtime: any = (globalThis as any).Laya) {
  const map = runtime.Resource._idResourcesMap,
    items: any[] =
      map instanceof Map ? [...map.values()] : Object.values(map || {});
  const counts = { mesh: 0, texture: 0, renderTarget: 0 };
  let meshBytes = 0,
    textureBytes = 0,
    renderTargetBytes = 0;
  for (const r of items) {
    if (r.destroyed) continue;
    if (r instanceof runtime.Mesh) {
      counts.mesh++;
      meshBytes += r.gpuMemory || 0;
    } else if (
      (runtime.RenderTexture && r instanceof runtime.RenderTexture) ||
      (runtime.RenderTexture2D && r instanceof runtime.RenderTexture2D)
    ) {
      counts.renderTarget++;
      renderTargetBytes +=
        (r.width || 0) * (r.height || 0) * 8 * Math.max(1, r.samples || 1);
    } else if (r instanceof runtime.BaseTexture) {
      counts.texture++;
      textureBytes +=
        (r.width || 0) *
        (r.height || 0) *
        4 *
        (r.mipmap ? 4 / 3 : 1) *
        (r.isCube ? 6 : 1);
    }
  }
  return {
    counts,
    resources: items.filter((r) => !r.destroyed).length,
    estimatedBytes: meshBytes + textureBytes + renderTargetBytes,
    meshBytes,
    textureBytes,
    renderTargetBytes,
    memoryMeasurement: "estimate" as const,
    assumptions:
      "Texture RGBA8, render target RGBA8 + 32-bit depth; vendor mesh accounting. Excludes driver overhead and compressed/HDR format corrections.",
  };
}

/** Presentation budget only. Consumers retain authority over simulation and visibility rules. */
export function applySceneQuality(
  quality: SceneQuality,
  session: { options: { dprCap?: number }; resize(): void },
  camera: any,
  lights: any[] = [],
) {
  const l = (globalThis as any).Laya;
  if (
    ![quality.dprCap, quality.shadowDistance, quality.extraPasses].every(
      Number.isFinite,
    ) ||
    quality.dprCap < 0.5 ||
    quality.dprCap > 4 ||
    quality.shadowDistance < 0 ||
    quality.extraPasses < 0 ||
    !Number.isFinite(quality.lodDistance) ||
    quality.lodDistance <= 0 ||
    ![512, 1024, 2048].includes(quality.shadowResolution)
  )
    throw Error("Invalid scene quality");
  session.options.dprCap = quality.dprCap;
  session.resize();
  camera.msaa = false;
  for (const light of lights) {
    light.shadowDistance = quality.shadowDistance;
    light.shadowResolution = quality.shadowResolution;
    light.shadowMode =
      quality.shadowDistance > 0 ? l.ShadowMode.SoftLow : l.ShadowMode.None;
  }
  return { ...quality, additionalPassBudget: quality.extraPasses };
}
