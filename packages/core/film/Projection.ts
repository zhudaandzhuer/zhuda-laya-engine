/**
 * Where a point of the world is on the picture a film camera takes: for
 * markers, labels and bars drawn over a scene by the page (DOM or 2D), which
 * have no camera of their own. Pure: no browser, no GPU.
 *
 * The world is right-handed with Y up, as the scene format is: a camera
 * looking along +Z has +X on the LEFT of its picture. The lens is the one
 * `ZhudaPhysicalCameraRig` sets: the sensor's height fits the picture's
 * height, so the vertical field of view depends on the focal length alone.
 */
import { physicalCameraMetrics } from '../runtime3d/PhysicalCamera.ts';
import { resolveZhudaFilmCamera, type ZhudaFilmCamera, type ZhudaFilmVec3 } from './FilmScene.ts';

export interface ZhudaFilmProjection {
  /** Across the picture from its left edge, 0..1 inside it. */
  x: number;
  /** Down the picture from its top edge, 0..1 inside it. */
  y: number;
  /** Metres in front of the camera along its view; zero or less is behind it. */
  depth: number;
  /** In front of the camera and inside the picture's edges. */
  inView: boolean;
}

/**
 * Projects `point` through `camera` onto a picture `aspect` times as wide as
 * it is high. Behind the camera `x` and `y` are where the point would be
 * were the view turned round: test `depth` or `inView` before placing a
 * marker. A camera looking straight up or down has no "right"; it is given
 * the world's -X, as a camera tipped there from looking along +Z has.
 */
export function projectZhudaFilmPoint(
  camera: ZhudaFilmCamera,
  point: ZhudaFilmVec3,
  aspect: number,
): ZhudaFilmProjection {
  if (!(Number.isFinite(aspect) && aspect > 0))
    throw Error('projectZhudaFilmPoint: aspect must be above zero');
  const c = resolveZhudaFilmCamera(camera);
  let fx = c.target[0] - c.eye[0],
    fy = c.target[1] - c.eye[1],
    fz = c.target[2] - c.eye[2];
  const length = Math.hypot(fx, fy, fz);
  if (!(length > 0)) throw Error('projectZhudaFilmPoint: the camera looks at its own eye');
  fx /= length;
  fy /= length;
  fz /= length;
  // right = forward x up(0, 1, 0); up' = right x forward.
  let rx = -fz,
    rz = fx;
  const flat = Math.hypot(rx, rz);
  if (flat < 1e-9) {
    rx = -1;
    rz = 0;
  } else {
    rx /= flat;
    rz /= flat;
  }
  const ux = -rz * fy,
    uy = rz * fx - rx * fz,
    uz = rx * fy;
  const dx = point[0] - c.eye[0],
    dy = point[1] - c.eye[1],
    dz = point[2] - c.eye[2];
  const depth = dx * fx + dy * fy + dz * fz;
  const fov = physicalCameraMetrics({ focalLengthMm: c.focalLengthMm }, 24).verticalFovDegrees;
  const scale =
    1 / Math.tan((fov * Math.PI) / 360) / (Math.abs(depth) > 1e-9 ? Math.abs(depth) : 1e-9);
  const sx = ((dx * rx + dz * rz) * scale) / aspect,
    sy = (dx * ux + dy * uy + dz * uz) * scale;
  const x = 0.5 + sx * 0.5,
    y = 0.5 - sy * 0.5;
  return { x, y, depth, inView: depth > 0 && x >= 0 && x <= 1 && y >= 0 && y <= 1 };
}
