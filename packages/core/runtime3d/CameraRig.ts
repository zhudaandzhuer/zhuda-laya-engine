import { type Vec3 } from "./Math3D.ts";
import {
  resolveCameraBoom,
  type CameraCollisionOptions,
} from "./CameraCollision.ts";
/** Camera presentation only: movement/support authority remains in the consumer's simulation. */
export class ZhudaCameraRig {
  readonly camera: any;
  readonly options: {
    mode?: "orbit" | "firstPerson";
    minDistance?: number;
    maxDistance?: number;
    sensitivity?: number;
    collision?: CameraCollisionOptions;
  };
  yaw = 0;
  pitch = 0.48;
  distance = 16;
  constructor(
    camera: any,
    options: {
      mode?: "orbit" | "firstPerson";
      minDistance?: number;
      maxDistance?: number;
      sensitivity?: number;
      collision?: CameraCollisionOptions;
    } = {},
  ) {
    this.camera = camera;
    this.options = options;
  }
  rotate(dx: number, dy: number) {
    if (![dx, dy].every(Number.isFinite)) throw Error("Invalid camera input");
    const s = this.options.sensitivity ?? 0.005;
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.4, Math.min(1.4, this.pitch + dy * s));
  }
  zoom(delta: number) {
    if (!Number.isFinite(delta)) throw Error("Invalid camera zoom");
    this.distance = Math.max(
      this.options.minDistance ?? 2,
      Math.min(
        this.options.maxDistance ?? 80,
        this.distance * Math.exp(delta * 0.001),
      ),
    );
  }
  update(target: Vec3) {
    const l = (globalThis as any).Laya,
      first = this.options.mode === "firstPerson",
      d = first ? 1 : this.distance;
    const offset = {
      x: Math.sin(this.yaw) * Math.cos(this.pitch) * d,
      y: Math.sin(this.pitch) * d,
      z: Math.cos(this.yaw) * Math.cos(this.pitch) * d,
    };
    let position = first
      ? target
      : {
          x: target.x + offset.x,
          y: target.y + offset.y,
          z: target.z + offset.z,
        };
    if (!first && this.options.collision)
      position = resolveCameraBoom(
        target,
        position,
        this.options.collision,
      ).position;
    const look = first
      ? {
          x: target.x - offset.x,
          y: target.y - offset.y,
          z: target.z - offset.z,
        }
      : target;
    this.camera.transform.position = new l.Vector3(
      position.x,
      position.y,
      position.z,
    );
    this.camera.transform.lookAt(
      new l.Vector3(look.x, look.y, look.z),
      new l.Vector3(0, 1, 0),
    );
  }
}
