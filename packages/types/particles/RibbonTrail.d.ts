// Generated from TypeScript source; run npm run types:generate.
import type { ParticleCurveKey } from './ParticleTypes.js';
export interface RibbonTrailSpec {
    maxPoints: number;
    lifetime: number;
    width: number;
    minDistance: number;
    teleportDistance: number;
    widthOverLife?: ParticleCurveKey[];
}
export interface RibbonMesh {
    vertices: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
    pointCount: number;
    indexCount: number;
}
/** World-space path history. Moving an emitter never drags its old trail. */
export declare class ZhudaRibbonTrail {
    readonly spec: RibbonTrailSpec;
    private readonly points;
    private head;
    private count;
    private time;
    private readonly mesh;
    constructor(spec: RibbonTrailSpec);
    get pointCount(): number;
    clear(): void;
    update(dt: number, x: number, y: number, emitting?: boolean): void;
    /** Reuses storage; UV.x encodes age, UV.y crosses the ribbon width. */
    buildMesh(): RibbonMesh;
    snapshot(): Array<{
        x: number;
        y: number;
        age: number;
    }>;
    private at;
}
