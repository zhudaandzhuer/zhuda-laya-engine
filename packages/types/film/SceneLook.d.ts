// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaFilmLook } from './FilmScene.js';
import { type ZhudaLookQuality } from './LookQuality.js';
export declare class ZhudaSceneLook {
    /** The directional light of the look (`look.sun`). */
    readonly sun: any;
    private look;
    private parts;
    private readonly sunNode;
    private cleanups;
    private lightFog;
    /** How long the clouds have drifted, in seconds. */
    private cloudSeconds;
    private level;
    private frame;
    private disposed;
    private readonly hemisphere;
    private readonly scene3D;
    private readonly camera;
    constructor(scene3D: any, camera: any, look: ZhudaFilmLook, options?: {
        quality?: ZhudaLookQuality;
    });
    get quality(): ZhudaLookQuality;
    /** Unit vector from the scene toward the sun, for water and other surfaces that glint. */
    get towardSun(): [number, number, number];
    /**
     * Changes the look while the game runs (a day passing, weather turning),
     * at the current quality level. A rejected look changes nothing. When only
     * continuous values differ (see `zhudaFilmLookRebuildReason`) they are set
     * in place, cheap enough for every frame, and `'updated'` is returned;
     * otherwise the look is rebuilt and `'rebuilt'` is returned. A panorama or
     * environment probe is refused, as in the constructor.
     */
    setLook(look: ZhudaFilmLook): 'updated' | 'rebuilt';
    /** Rebuilds the look at another level; nothing happens when it is the current one. */
    setQuality(level: ZhudaLookQuality): void;
    /**
     * Call every frame after the camera has moved. `frameSeconds` is the time
     * since the frame before (default 1/60): how far automatic exposure adapts.
     */
    update(eye: readonly [number, number, number], target: readonly [number, number, number], fieldOfViewDeg: number, aspect: number, frameSeconds?: number): void;
    dispose(): void;
    private updateInPlace;
    private apply;
    private release;
}
