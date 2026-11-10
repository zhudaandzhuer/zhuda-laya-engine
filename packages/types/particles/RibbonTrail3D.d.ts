// Generated from TypeScript source; run npm run types:generate.
import type { RibbonTrailSpec } from './RibbonTrail';
import type { ParticleGeometry3D } from './ParticleMesh3D';
import type { ParticleVector3 } from './ParticleTypes3D';
/** Bounded XYZ world history; camera-facing ribbon with stable normals. */
export declare class ZhudaRibbonTrail3D {
    readonly spec: RibbonTrailSpec;
    private readonly points;
    private readonly geometry;
    private head;
    private count;
    private time;
    constructor(spec: RibbonTrailSpec);
    get pointCount(): number;
    clear(): void;
    update(dt: number, x: number, y: number, z: number, emitting?: boolean): void;
    buildMesh(cameraPosition: ParticleVector3, opacity?: number): ParticleGeometry3D;
    snapshot(): Array<ParticleVector3 & {
        age: number;
    }>;
    private at;
}
