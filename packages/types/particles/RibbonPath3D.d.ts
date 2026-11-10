// Generated from TypeScript source; run npm run types:generate.
import type { ParticleColorKey, ParticleCurveKey } from './ParticleTypes';
import type { ParticleGeometry3D } from './ParticleMesh3D';
import type { ParticleVector3 } from './ParticleTypes3D';
export interface RibbonPathSpec3D {
    maxPoints: number;
    width: number;
    widthOverPath?: ParticleCurveKey[];
    alphaOverPath?: ParticleCurveKey[];
    colorOverPath?: ParticleColorKey[];
}
/** Authored XYZ flow paths. Geometry follows supplied world points, with a fade at either end. */
export declare class ZhudaRibbonPath3D {
    readonly spec: RibbonPathSpec3D;
    private readonly points;
    private readonly widthDirections;
    private hasWidthDirections;
    private readonly distances;
    private readonly geometry;
    private count;
    uvOffset: number;
    uvTiles: number;
    visibleStart: number;
    visibleEnd: number;
    edgeFade: number;
    constructor(spec: RibbonPathSpec3D);
    get pointCount(): number;
    clear(): void;
    setPoints(points: readonly ParticleVector3[], widthDirections?: readonly ParticleVector3[]): void;
    snapshot(): ParticleVector3[];
    buildMesh(camera: ParticleVector3, opacity?: number): ParticleGeometry3D;
}
