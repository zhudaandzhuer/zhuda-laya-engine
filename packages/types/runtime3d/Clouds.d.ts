// Generated from TypeScript source; run npm run types:generate.
/**
 * A layer of clouds with depth: a slab of air between two heights in which
 * a drifting noise says how much cloud there is, followed along each view
 * ray by a post-process effect in linear HDR. The sun lights the side of a
 * cloud that faces it and the cloud shades itself; the sky's own light fills
 * the rest. Clouds are drawn where the view reaches the slab before it
 * reaches anything solid, so hills and towers stand in front of them.
 *
 * It is one layer of one kind of cloud: no weather, no rain, no shadows of
 * clouds on the ground, and nothing mirrors them but what mirrors the screen
 * (`screenReflections`). The noise is computed, not stored: each step along
 * a ray costs about seventy arithmetic lookups. The rays are followed at
 * half size, each from another offset, and the result is blurred before it
 * is laid over the picture: a few steps then show neither as layers nor as
 * a hatching. A hill that stands up into the layer has the clouds beyond it
 * drawn in front of it.
 */
export declare const ZHUDA_CLOUD_MAX_STEPS = 64;
export interface ZhudaCloudsOptions {
    /** How much of the sky is cloud, 0..1 (default 0.5). */
    coverage?: number;
    /** Height of the clouds' underside in metres, 50..20000 (default 1500). */
    baseMeters?: number;
    /** How thick the layer is in metres, 50..8000 (default 900). */
    thicknessMeters?: number;
    /** Size of a cloud in metres, 100..50000 (default 2600). */
    sizeMeters?: number;
    /** How dense the cloud is, 0..4 (default 1): higher is darker underneath and harder edged. */
    density?: number;
    /** The wind: metres a second along X and Z (default [8, 0]), each within 300. */
    wind?: readonly number[];
    /** Steps along each view ray, 8..64 (default 32). */
    steps?: number;
    /** How far clouds are drawn in metres, 1000..200000 (default 40000). */
    distanceMeters?: number;
    /** Direction toward the sun (default straight up). */
    sunToward?: readonly number[];
    /** The sun's light on the clouds, scene-linear RGB (default [1, 1, 1]). */
    sunColor?: readonly number[];
    /** The sky's own light in the clouds, scene-linear RGB (default [0.35, 0.4, 0.5]). */
    skyColor?: readonly number[];
}
export declare function validateZhudaClouds(options: ZhudaCloudsOptions): string[];
export declare function resolveZhudaClouds(options?: ZhudaCloudsOptions): Required<ZhudaCloudsOptions>;
export declare class ZhudaClouds {
    /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, first. */
    readonly effect: any;
    private options;
    /** The pass that follows the rays, the one that lays the clouds over the picture, and all four. */
    private readonly trace;
    private readonly compose;
    private readonly passes;
    private seconds;
    private disposed;
    constructor(options?: ZhudaCloudsOptions);
    /** Changes the clouds in place: how many, how high, how dense, the wind, their light. */
    setClouds(options: ZhudaCloudsOptions): void;
    /** The time the clouds have drifted for, in seconds. The same time draws the same sky. */
    setTime(seconds: number): void;
    private shape;
    /** Call after the camera has moved or its field of view has changed. */
    update(eye: readonly number[], target: readonly number[], fieldOfViewDeg: number, aspect: number): void;
    dispose(): void;
}
