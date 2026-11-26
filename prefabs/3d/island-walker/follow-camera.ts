// A third-person camera that orbits a walking character: yaw, pitch and distance
// ease toward a goal (which WalkInput turns and zooms), the point looked at eases
// after the feet, the eye pulls in in front of an obstacle (tree crowns as spheres)
// rather than look through it, and never goes below the ground.
//
//   const follow = new FollowCamera(camera, walker.feet, { ground: island.groundAt, obstacles: island.crowns });
//   runtime.start((dt) => {
//     walker.update(dt, input.stick(follow.orbit.yaw));
//     const eye = follow.update(dt, walker.feet);
//   });
import { add, approach, scale, type V3 } from '../math.ts';

/** A sphere the eye keeps out of: x, y, z, radius (metres). */
export type Obstacle = readonly [number, number, number, number];

export interface Orbit {
  /** Radians round the character (0: the eye to the south, +z, looking north). */
  yaw: number;
  /** Radians above the horizontal. */
  pitch: number;
  /** Metres from the point looked at. */
  distance: number;
}

export interface FollowCameraOptions {
  /** The ground's height at a place (null: off the map, taken as 0). */
  ground: (x: number, z: number) => number | null;
  /** What the eye does not look through: it comes in front instead. */
  obstacles?: readonly Obstacle[];
  /** The orbit to start with. Default yaw 0.25, pitch 0.32, distance 8. */
  orbit?: Partial<Orbit>;
  /** How high above the feet the eye looks, m. Default 1. */
  lift?: number;
  /** Closest the eye comes when it pulls in in front of an obstacle, m. Default 3. */
  nearest?: number;
  /** How far above the ground the eye stays, m. Default 0.4. */
  clearance?: number;
}

export class FollowCamera {
  readonly camera: Laya.Camera;
  /** Where the camera is now. */
  readonly orbit: Orbit;
  /** Where it eases to: input turns and zooms this one. */
  readonly goal: Orbit;
  /** The point looked at now (eases after the feet, or after `lookAt`). */
  target: V3;
  /** A fixed point to look at instead of the character (null: the character). */
  lookAt: V3 | null = null;
  /** Off: no pulling in front of obstacles (a shot framed by hand, a far wide view). */
  avoid = true;
  /** How far out the eye is now, after pulling in. */
  boom: number;
  /** The eye's place after the last update. */
  eye: V3;
  private readonly ground: (x: number, z: number) => number | null;
  private readonly obstacles: readonly Obstacle[];
  private readonly lift: number;
  private readonly nearest: number;
  private readonly clearance: number;

  constructor(camera: Laya.Camera, feet: V3, options: FollowCameraOptions) {
    this.camera = camera;
    this.ground = options.ground;
    this.obstacles = options.obstacles ?? [];
    this.lift = options.lift ?? 1;
    this.nearest = options.nearest ?? 3;
    this.clearance = options.clearance ?? 0.4;
    this.orbit = { yaw: options.orbit?.yaw ?? 0.25, pitch: options.orbit?.pitch ?? 0.32, distance: options.orbit?.distance ?? 8 };
    this.goal = { ...this.orbit };
    this.target = [feet[0], feet[1] + this.lift, feet[2]];
    this.boom = this.orbit.distance;
    this.eye = [...this.target];
  }

  /** Sets yaw, pitch or distance at once (no easing). */
  set(o: Partial<Orbit>) {
    if (o.yaw !== undefined) this.orbit.yaw = this.goal.yaw = o.yaw;
    if (o.pitch !== undefined) this.orbit.pitch = this.goal.pitch = o.pitch;
    if (o.distance !== undefined) this.orbit.distance = this.goal.distance = o.distance;
  }

  /** Looks at the character at once (after a cut or a jump to another place). */
  snap(feet: V3) {
    this.target = [feet[0], feet[1] + this.lift, feet[2]];
  }

  /** Eases the orbit, places the camera and returns the eye. */
  update(dt: number, feet: V3): V3 {
    const { orbit, goal } = this;
    orbit.yaw = approach(orbit.yaw, goal.yaw, 8, dt);
    orbit.pitch = approach(orbit.pitch, goal.pitch, 8, dt);
    orbit.distance = approach(orbit.distance, goal.distance, 6, dt);
    const want: V3 = this.lookAt ?? [feet[0], feet[1] + this.lift, feet[2]];
    const target: V3 = (this.target = [approach(this.target[0], want[0], 6, dt), approach(this.target[1], want[1], 6, dt), approach(this.target[2], want[2], 6, dt)]);
    const dir: V3 = [Math.sin(orbit.yaw) * Math.cos(orbit.pitch), Math.sin(orbit.pitch), Math.cos(orbit.yaw) * Math.cos(orbit.pitch)];
    // An obstacle between the eye and the character brings the eye in front of it.
    let reach = orbit.distance;
    for (let d = 1.5; d < orbit.distance && this.avoid; d += 0.5) {
      const p = add(target, scale(dir, d));
      if (this.obstacles.some((c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]) < c[3])) {
        // Only when that still leaves a view: closer than `nearest` the eye stays where it is, inside the leaves for a moment.
        reach = Math.max(this.nearest, d - 0.6);
        break;
      }
    }
    this.boom = reach < this.boom ? reach : approach(this.boom, reach, 3, dt);
    const eye = add(target, scale(dir, this.boom));
    const floor = (this.ground(eye[0], eye[2]) ?? 0) + this.clearance;
    if (eye[1] < floor) eye[1] = floor;
    this.camera.transform.position = new Laya.Vector3(...eye);
    this.camera.transform.lookAt(new Laya.Vector3(...target), new Laya.Vector3(0, 1, 0), false);
    this.eye = eye;
    return eye;
  }
}
