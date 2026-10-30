import {
  normalized,
  inverse4,
  multiply4,
  transformPoint,
  type Vec3,
  type Matrix4,
} from "./Math3D.ts";
export interface QueryRay {
  origin: Vec3;
  direction: Vec3;
}
export interface QueryHit {
  entityId: string;
  instanceId?: string | number;
  position: Vec3;
  normal: Vec3;
  distance: number;
}
export interface QueryProvider {
  entityId: string;
  instanceId?: string | number;
  layer?: number;
  raycast: (
    ray: QueryRay,
    maxDistance: number,
  ) => Omit<QueryHit, "entityId"> | null;
  sweepSphere?: (
    from: Vec3,
    to: Vec3,
    radius: number,
  ) => Omit<QueryHit, "entityId"> | null;
}
export class ZhudaSceneQueries {
  private providers = new Map<string, QueryProvider>();
  register(p: QueryProvider) {
    const key = p.entityId + "\0" + (p.instanceId ?? "");
    if (!p.entityId || this.providers.has(key))
      throw Error("Duplicate/missing stable query ID");
    this.providers.set(key, p);
    return () => this.providers.delete(key);
  }
  raycast(ray: QueryRay, maxDistance = Infinity, layerMask = 0xffffffff) {
    if (!(maxDistance >= 0)) throw Error("Invalid ray distance");
    const r = { origin: ray.origin, direction: normalized(ray.direction) };
    let hit: QueryHit | null = null;
    for (const p of this.providers.values()) {
      if (!((p.layer ?? 1) & layerMask)) continue;
      const h = p.raycast(r, hit?.distance ?? maxDistance);
      if (
        h &&
        Number.isFinite(h.distance) &&
        h.distance >= 0 &&
        h.distance <= maxDistance &&
        (!hit || h.distance < hit.distance)
      )
        hit = {
          ...h,
          entityId: p.entityId,
          instanceId: p.instanceId ?? h.instanceId,
        };
    }
    return hit;
  }
  sweepSphere(from: Vec3, to: Vec3, radius: number, layerMask = 0xffffffff) {
    if (!Number.isFinite(radius) || radius < 0)
      throw Error("Invalid sweep radius");
    let hit: QueryHit | null = null;
    for (const p of this.providers.values()) {
      if (!((p.layer ?? 1) & layerMask) || !p.sweepSphere) continue;
      const h = p.sweepSphere(from, to, radius);
      if (
        h &&
        h.distance >= 0 &&
        Number.isFinite(h.distance) &&
        (!hit || h.distance < hit.distance)
      )
        hit = {
          ...h,
          entityId: p.entityId,
          instanceId: p.instanceId ?? h.instanceId,
        };
    }
    return hit;
  }
  clear() {
    this.providers.clear();
  }
  get size() {
    return this.providers.size;
  }
}
export function rayBox(
  ray: QueryRay,
  min: Vec3,
  max: Vec3,
  maxDistance = Infinity,
) {
  let near = 0,
    far = maxDistance;
  let normal: Vec3 = { x: 0, y: 0, z: 0 };
  for (const axis of ["x", "y", "z"] as const) {
    const d = ray.direction[axis],
      o = ray.origin[axis];
    if (Math.abs(d) < 1e-10) {
      if (o < min[axis] || o > max[axis]) return null;
      continue;
    }
    let a = (min[axis] - o) / d,
      b = (max[axis] - o) / d,
      sign = -1;
    if (a > b) {
      [a, b] = [b, a];
      sign = 1;
    }
    if (a > near) {
      near = a;
      normal = { x: 0, y: 0, z: 0 };
      normal[axis] = sign;
    }
    far = Math.min(far, b);
    if (near > far) return null;
  }
  if (far < 0) return null;
  return {
    distance: near,
    normal,
    position: {
      x: ray.origin.x + ray.direction.x * near,
      y: ray.origin.y + ray.direction.y * near,
      z: ray.origin.z + ray.direction.z * near,
    },
  };
}
export interface CanvasViewport {
  left: number;
  top: number;
  width: number;
  height: number;
  backingWidth: number;
  backingHeight: number;
}
/** CSS pointer coordinates -> backing pixels. Camera viewport is owned by the Laya camera. */
export class ZhudaCameraCoordinates {
  readonly camera: any;
  readonly viewport: () => CanvasViewport;
  constructor(camera: any, viewport: () => CanvasViewport) {
    this.camera = camera;
    this.viewport = viewport;
  }
  private matrices() {
    return multiply4(
      this.camera.projectionMatrix.elements,
      this.camera.viewMatrix.elements,
    );
  }
  private rect() {
    const v = this.viewport(),
      n = this.camera.normalizedViewport || { x: 0, y: 0, width: 1, height: 1 };
    if (!(v.width > 0 && v.height > 0 && n.width > 0 && n.height > 0))
      throw Error("Empty camera viewport");
    return {
      left: v.left + n.x * v.width,
      top: v.top + n.y * v.height,
      width: v.width * n.width,
      height: v.height * n.height,
    };
  }
  screenToRay(x: number, y: number): QueryRay {
    if (![x, y].every(Number.isFinite)) throw Error("Invalid screen point");
    const r = this.rect(),
      inv = inverse4(this.matrices()),
      nx = ((x - r.left) / r.width) * 2 - 1,
      ny = 1 - ((y - r.top) / r.height) * 2;
    const origin = transformPoint(inv, { x: nx, y: ny, z: -1 }),
      far = transformPoint(inv, { x: nx, y: ny, z: 1 });
    return {
      origin,
      direction: normalized({
        x: far.x - origin.x,
        y: far.y - origin.y,
        z: far.z - origin.z,
      }),
    };
  }
  worldToScreen(p: Vec3) {
    const m = this.matrices(),
      v = transformPoint(m, p),
      r = this.rect(),
      w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15];
    return {
      x: r.left + (v.x + 1) * 0.5 * r.width,
      y: r.top + (1 - v.y) * 0.5 * r.height,
      depth: (v.z + 1) * 0.5,
      visible:
        w > 0 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 && Math.abs(v.z) <= 1,
    };
  }
}

export interface SurfaceSample {
  height: number;
  normal: Vec3;
  entityId?: string;
}
export class ZhudaSurfaceQuery {
  readonly sample: (x: number, z: number, time: number) => SurfaceSample | null;
  constructor(
    sample: (x: number, z: number, time: number) => SurfaceSample | null,
  ) {
    this.sample = sample;
  }
  at(x: number, z: number, time: number) {
    if (![x, z, time].every(Number.isFinite))
      throw Error("Invalid surface query");
    return this.sample(x, z, time);
  }
}
export { transformPoint };
