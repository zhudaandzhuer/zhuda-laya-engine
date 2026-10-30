import { type Vec3 } from "./Math3D";
/** Camera presentation only: movement/support authority remains in the consumer's simulation. */
export declare class ZhudaCameraRig {
    readonly camera: any;
    readonly options: {
        mode?: "orbit" | "firstPerson";
        minDistance?: number;
        maxDistance?: number;
        sensitivity?: number;
    };
    yaw: number;
    pitch: number;
    distance: number;
    constructor(camera: any, options?: {
        mode?: "orbit" | "firstPerson";
        minDistance?: number;
        maxDistance?: number;
        sensitivity?: number;
    });
    rotate(dx: number, dy: number): void;
    zoom(delta: number): void;
    update(target: Vec3): void;
}
