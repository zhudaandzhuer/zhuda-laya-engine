// Generated from TypeScript source; run npm run types:generate.
/** Probes one volume may hold. */
export declare const ZHUDA_PROBE_VOLUME_MAX_PROBES = 512;
export interface ZhudaProbeVolumeOptions {
    /** Corners of the box the probes fill, world metres. */
    min: readonly number[];
    max: readonly number[];
    /** Probes along X, Y and Z, 1..16 each and at most 512 in all (default: one every 3 m or so). */
    counts?: readonly number[];
    /** Edge of each captured picture in pixels: 16, 32 or 64 (default 32). */
    captureSize?: 16 | 32 | 64;
    /** Multiplies the light, 0..4 (default 1). */
    strength?: number;
    /** Layers the captures leave out (overlays such as a reflector's mirror). */
    excludedLayers?: readonly number[];
    /**
     * Probes drawn into one picture before it is read back, 1..16 (default 8).
     * Reading back costs more than drawing: fewer, larger read-backs bake faster.
     */
    batch?: number;
    /** World axis-aligned boxes of solid things: probes inside them are switched off. */
    solids?: readonly {
        readonly min: readonly number[];
        readonly max: readonly number[];
    }[];
}
export declare function validateZhudaProbeVolume(options: ZhudaProbeVolumeOptions): string[];
/** About one probe every `spacing` metres, at most 16 per axis and 512 in all. */
export declare function zhudaProbeCounts(min: readonly number[], max: readonly number[], spacing?: number): [number, number, number];
/** LayaAir's octahedral decoding (`finalDecode`): a unit direction for x, y in -1..1. */
export declare function zhudaOctahedralDirection(x: number, y: number): [number, number, number];
/**
 * The picture LayaAir's shader reads: one tile of 8 by 8 texels per probe
 * (6 by 6 inside a border copied from the opposite edges), tile column
 * x + y * countX and tile row z. RGBA float, row 0 first.
 */
export declare function zhudaIrradianceAtlas(counts: readonly number[], ambientOf: (probe: number) => readonly number[], strength?: number): {
    width: number;
    height: number;
    data: Float32Array;
};
/**
 * One face cut out of a read-back picture of tiles `n` wide: the tile in
 * `column` and `row` counted from the top, its columns reversed when
 * `mirrored`.
 */
export declare function zhudaAtlasFace(picture: Float32Array, width: number, n: number, column: number, row: number, mirrored?: boolean): Float32Array;
/** The distance pictures LayaAir's shader reads: 16 by 16 texels per probe, laid out like the irradiance. */
export declare function zhudaProbeDistanceAtlas(counts: readonly number[], off: readonly boolean[]): {
    width: number;
    height: number;
    data: Float32Array;
};
export declare class ZhudaProbeVolume {
    readonly counts: [number, number, number];
    readonly min: [number, number, number];
    readonly max: [number, number, number];
    private readonly scene;
    private readonly options;
    private node;
    private volume;
    private irradiance;
    private distance;
    private restoreAmbient;
    private disposed;
    /** The nine ambient colours of each probe after `bake`, for inspection. */
    ambient: readonly (readonly number[])[];
    /** Which probes lie inside a solid and are switched off. */
    readonly off: readonly boolean[];
    constructor(scene: any, options: ZhudaProbeVolumeOptions);
    /** Probes in the volume. */
    get probes(): number;
    /** World position of probe `index` (x fastest, then y, then z): cell centres, as LayaAir places them. */
    probePosition(index: number): [number, number, number];
    /**
     * Captures every probe and lights the volume with the result. Call it
     * after the scene has drawn a frame or two, and again when its light or
     * what stands in it has changed. `signal` cancels the read-backs.
     */
    bake(signal?: AbortSignal): Promise<void>;
    private apply;
    dispose(): void;
}
