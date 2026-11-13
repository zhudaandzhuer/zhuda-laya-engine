// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaCubePicture } from './EnvironmentProbe.js';
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
    /**
     * Each probe also keeps how far it sees in every direction, and a surface
     * takes light only from probes that see it (LayaAir's own test). With it
     * a wall thinner than the probes' spacing no longer lets the light of one
     * side through to the other. One more depth pass a capture. Default false.
     */
    visibility?: boolean;
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
/**
 * How far a probe sees, as LayaAir's shader reads it: for each of the 16 by
 * 16 texels of its tile the mean distance and the mean squared distance
 * toward that texel's direction, two numbers a texel, row 0 first. `cube` is
 * a world cube picture whose red channel is the distance in metres. The
 * means are taken over a lobe about the direction (`sharpness`), so that the
 * edge of a wall is a spread of distances and not a step.
 */
export declare function zhudaProbeDistanceTile(cube: ZhudaCubePicture, sharpness?: number): Float32Array;
/**
 * The distance pictures LayaAir's shader reads: 16 by 16 texels per probe,
 * laid out like the irradiance. A probe with a tile (`zhudaProbeDistanceTile`)
 * is tested for what it sees (z = 1); one without is not (z = 0); one that is
 * off says everything is right at it, so every point counts as hidden from it.
 */
export declare function zhudaProbeDistanceAtlas(counts: readonly number[], off: readonly boolean[], tiles?: readonly (Float32Array | undefined)[]): {
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
    /** What each probe saw last: its nine ambient colours, and how far it sees. */
    private readonly seen;
    private readonly reach;
    /** Where `refresh` goes on next time. */
    private cursor;
    private capturing;
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
    /**
     * Captures the next `count` probes again (default: one read-back's worth)
     * and lights the volume with them, going round all of them call after
     * call: what has moved or changed its light since the last time is taken
     * up a few probes at a time while a game runs. Needs a `bake` first.
     * Returns how many probes were captured: 0 while another capture is still
     * under way. Each probe is six small scene draws.
     */
    refresh(count?: number, signal?: AbortSignal): Promise<number>;
    /** Draws and reads back `probes`, and keeps what each one saw. */
    private capture;
    /** Writes what the probes saw into the two pictures LayaAir reads, in place once they exist. */
    private apply;
    dispose(): void;
}
