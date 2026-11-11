// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaFilmLook } from './FilmScene.js';
import { type ZhudaLookQuality } from './LookQuality.js';
export declare class ZhudaSceneLook {
    /** The directional light of the look (`look.sun`). */
    readonly sun: any;
    private readonly look;
    private readonly sunNode;
    private cleanups;
    private lightFog;
    private level;
    private frame;
    private disposed;
    private restoreAmbient;
    private readonly scene3D;
    private readonly camera;
    constructor(scene3D: any, camera: any, look: ZhudaFilmLook, options?: {
        quality?: ZhudaLookQuality;
    });
    get quality(): ZhudaLookQuality;
    /** Unit vector from the scene toward the sun, for water and other surfaces that glint. */
    get towardSun(): [number, number, number];
    /** Rebuilds the look at another level; nothing happens when it is the current one. */
    setQuality(level: ZhudaLookQuality): void;
    /** Call every frame after the camera has moved. */
    update(eye: readonly [number, number, number], target: readonly [number, number, number], fieldOfViewDeg: number, aspect: number): void;
    dispose(): void;
    private apply;
    private release;
}
