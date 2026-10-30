import { type Vec3 } from "./Math3D";
import type { ZhudaSceneQueries } from "./SceneQueries";
export interface CameraCollisionOptions {
    queries: Pick<ZhudaSceneQueries, "raycast">;
    radius?: number;
    clearance?: number;
    layerMask?: number;
}
/** Nine probe rays protect the camera boom/near plane. Not a physics sphere sweep.
 * The focus must start outside solid geometry. Query providers own collision authority. */
export declare function resolveCameraBoom(focus: Vec3, desired: Vec3, options: CameraCollisionOptions): {
    position: {
        x: number;
        y: number;
        z: number;
    };
    distance: number;
    blocked: boolean;
};
