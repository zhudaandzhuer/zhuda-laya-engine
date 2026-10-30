import { normalized, type Vec3 } from "./Math3D.ts";
import type { ZhudaSceneQueries } from "./SceneQueries.ts";

export interface CameraCollisionOptions {
  queries: Pick<ZhudaSceneQueries, "raycast">;
  radius?: number;
  clearance?: number;
  layerMask?: number;
}

/** Nine probe rays protect the camera boom/near plane. Not a physics sphere sweep.
 * The focus must start outside solid geometry. Query providers own collision authority. */
export function resolveCameraBoom(
  focus: Vec3,
  desired: Vec3,
  options: CameraCollisionOptions,
) {
  const radius = options.radius ?? 0.25,
    clearance = options.clearance ?? 0.1;
  if (
    ![
      ...Object.values(focus),
      ...Object.values(desired),
      radius,
      clearance,
    ].every(Number.isFinite) ||
    radius < 0 ||
    clearance < 0
  )
    throw Error("Invalid camera collision parameters");
  const delta = {
      x: desired.x - focus.x,
      y: desired.y - focus.y,
      z: desired.z - focus.z,
    },
    length = Math.hypot(delta.x, delta.y, delta.z);
  if (length < 1e-8)
    return { position: { ...focus }, distance: 0, blocked: false };
  const direction = normalized(delta),
    axis =
      Math.abs(direction.y) < 0.95
        ? { x: 0, y: 1, z: 0 }
        : { x: 1, y: 0, z: 0 },
    cross = (a: Vec3, b: Vec3) => ({
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    }),
    right = normalized(cross(direction, axis)),
    up = cross(right, direction);
  let distance = length;
  for (const [x, y] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [0.707, 0.707],
    [-0.707, 0.707],
    [0.707, -0.707],
    [-0.707, -0.707],
  ]) {
    const origin = {
        x: focus.x + (right.x * x + up.x * y) * radius,
        y: focus.y + (right.y * x + up.y * y) * radius,
        z: focus.z + (right.z * x + up.z * y) * radius,
      },
      hit = options.queries.raycast(
        { origin, direction },
        length + radius,
        options.layerMask,
      );
    if (hit)
      distance = Math.min(
        distance,
        Math.max(0, hit.distance - radius - clearance),
      );
  }
  return {
    position: {
      x: focus.x + direction.x * distance,
      y: focus.y + direction.y * distance,
      z: focus.z + direction.z * distance,
    },
    distance,
    blocked: distance < length,
  };
}
