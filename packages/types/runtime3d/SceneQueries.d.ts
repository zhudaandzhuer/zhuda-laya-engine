import { transformPoint, type Vec3 } from "./Math3D";
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
    raycast: (ray: QueryRay, maxDistance: number) => Omit<QueryHit, "entityId"> | null;
    sweepSphere?: (from: Vec3, to: Vec3, radius: number) => Omit<QueryHit, "entityId"> | null;
}
export declare class ZhudaSceneQueries {
    private providers;
    register(p: QueryProvider): () => boolean;
    raycast(ray: QueryRay, maxDistance?: number, layerMask?: number): QueryHit | null;
    sweepSphere(from: Vec3, to: Vec3, radius: number, layerMask?: number): QueryHit | null;
    clear(): void;
    get size(): number;
}
export declare function rayBox(ray: QueryRay, min: Vec3, max: Vec3, maxDistance?: number): {
    distance: number;
    normal: Vec3;
    position: {
        x: number;
        y: number;
        z: number;
    };
} | null;
export interface CanvasViewport {
    left: number;
    top: number;
    width: number;
    height: number;
    backingWidth: number;
    backingHeight: number;
}
/** CSS pointer coordinates -> backing pixels. Camera viewport is owned by the Laya camera. */
export declare class ZhudaCameraCoordinates {
    readonly camera: any;
    readonly viewport: () => CanvasViewport;
    constructor(camera: any, viewport: () => CanvasViewport);
    private matrices;
    private rect;
    screenToRay(x: number, y: number): QueryRay;
    worldToScreen(p: Vec3): {
        x: number;
        y: number;
        depth: number;
        visible: boolean;
    };
}
export interface SurfaceSample {
    height: number;
    normal: Vec3;
    entityId?: string;
}
export declare class ZhudaSurfaceQuery {
    readonly sample: (x: number, z: number, time: number) => SurfaceSample | null;
    constructor(sample: (x: number, z: number, time: number) => SurfaceSample | null);
    at(x: number, z: number, time: number): SurfaceSample | null;
}
export { transformPoint };
