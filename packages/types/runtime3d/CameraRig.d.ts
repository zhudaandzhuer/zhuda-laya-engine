import { type Vec3 } from "./Math3D";
import { type CameraCollisionOptions } from "./CameraCollision";
/** Camera presentation only: movement/support authority remains in the consumer's simulation. */
export declare class ZhudaCameraRig {
    readonly camera: any;
    readonly options: {
        mode?: "orbit" | "firstPerson";
        minDistance?: number;
        maxDistance?: number;
        sensitivity?: number;
        collision?: CameraCollisionOptions;
    };
    yaw: number;
    pitch: number;
    distance: number;
    constructor(camera: any, options?: {
        mode?: "orbit" | "firstPerson";
        minDistance?: number;
        maxDistance?: number;
        sensitivity?: number;
        collision?: CameraCollisionOptions;
    });
    rotate(dx: number, dy: number): void;
    zoom(delta: number): void;
    update(target: Vec3): void;
}
