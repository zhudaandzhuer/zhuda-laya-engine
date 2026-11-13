// Generated from TypeScript source; run npm run types:generate.
export interface ZhudaGrassOptions {
    /** The land grass may cover, world metres. */
    area: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
    };
    /** Height of the ground at a place, or null where there is none. */
    ground: (x: number, z: number) => number | null;
    /** False where nothing grows (a road, a floor, under water). Asked once a clump. */
    grows?: (x: number, z: number, y: number) => boolean;
    /** Blades on a square metre close to the eye, 20..1500 (default 400). */
    density?: number;
    /** Shortest and tallest blade, metres (default [0.14, 0.34]). */
    heightM?: readonly number[];
    /** Width of a blade at its foot, metres, 0.005..0.2 (default 0.03). */
    widthM?: number;
    /** How far from the eye grass is drawn, metres, 10..300 (default 60). */
    distanceM?: number;
    /** Within this distance every blade is drawn, metres (default a twelfth of `distanceM`). */
    fullDensityM?: number;
    /** Side of a patch of land, metres, 2..32 (default 6). */
    patchM?: number;
    /** Colour of a blade at its tip, display RGB 0..1 (default [0.46, 0.6, 0.22]). */
    tip?: readonly number[];
    /** Colour at its foot (default [0.1, 0.19, 0.06]). */
    root?: readonly number[];
    /** Colour dry blades turn toward (default [0.66, 0.62, 0.3]). */
    dry?: readonly number[];
    /** How much of the grass is dry, 0..1 (default 0.3). */
    dryness?: number;
    /** The wind: where it blows toward (degrees from +X toward +Z), how far it bends a blade (0..1) and how fast it moves. */
    wind?: {
        directionDeg?: number;
        strength?: number;
        speed?: number;
    };
    /** The same seed grows the same grass (default 1). */
    seed?: number;
    /** False leaves out the turf under the blades (default true). */
    turf?: boolean;
}
export interface ZhudaGrassResolved {
    area: {
        minX: number;
        maxX: number;
        minZ: number;
        maxZ: number;
    };
    density: number;
    heightM: [number, number];
    widthM: number;
    distanceM: number;
    fullDensityM: number;
    patchM: number;
    tip: [number, number, number];
    root: [number, number, number];
    dry: [number, number, number];
    dryness: number;
    wind: {
        directionDeg: number;
        strength: number;
        speed: number;
    };
    seed: number;
    turf: boolean;
}
/**
 * The blades of a patch are kept in five meshes by rank: the first holds the
 * few that are drawn far from the eye, each further one those that are added
 * nearer. A patch near the eye has all five, one far away the first only.
 * Coming nearer makes only the blades that are new; going away drops a mesh.
 * `segments` is how many pieces a blade is cut into along its length.
 */
export declare const ZHUDA_GRASS_BANDS: readonly {
    from: number;
    to: number;
    segments: number;
}[];
/** Numbers a blade is stored as: x, y, z of its foot, height, facing angle, lean (a share of the height) and rank. */
export declare const ZHUDA_GRASS_BLADE_FLOATS = 7;
/** Problems with grass options; an empty list means a field can be made of them. */
export declare function validateZhudaGrass(options: ZhudaGrassOptions): string[];
/** The options with every default filled in. Throws what `validateZhudaGrass` lists. */
export declare function resolveZhudaGrass(options: ZhudaGrassOptions): ZhudaGrassResolved;
/** The share of blades drawn at a distance from the eye: all of them close by, fewer further off, none past the end. */
export declare function zhudaGrassShown(distance: number, fullDensityM: number, distanceM: number): number;
/**
 * How many of its meshes a patch whose nearest point is this far from the
 * eye needs: all of `ZHUDA_GRASS_BANDS` close by, one far off, none past
 * the end. A mesh is needed where a blade of its ranks is drawn.
 */
export declare function zhudaGrassBands(nearest: number, fullDensityM: number, distanceM: number): number;
/** How many clumps a patch of land has. */
export declare function zhudaGrassPatchClumps(resolved: ZhudaGrassResolved): number;
/**
 * The blades of one patch of land, `ZHUDA_GRASS_BLADE_FLOATS` numbers each.
 * A patch is the square `[px, px + 1) × [pz, pz + 1)` times `patchM`. Blades
 * stand in clumps that open outward like a fountain; the land is thicker and
 * taller in places and thin in others. The same patch always grows the same
 * blades. `ranks` ([from, to), default all) keeps the blades of those ranks:
 * the ranks of `ZHUDA_GRASS_BANDS` together give every blade once, and a
 * narrow range is made quickly. `slice` ([first, end)) makes only those of
 * the patch's clumps, for a patch made over several frames. Pure: no Laya
 * needed.
 */
export declare function zhudaGrassPatchBlades(resolved: ZhudaGrassResolved, ground: (x: number, z: number) => number | null, grows: ((x: number, z: number, y: number) => boolean) | undefined, px: number, pz: number, ranks?: readonly number[], slice?: readonly number[]): Float32Array;
export interface ZhudaGrassMeshData {
    /** POSITION, NORMAL, UV interleaved: eight numbers a vertex. */
    vertices: Float32Array;
    indices: Uint16Array;
    blades: number;
    min: [number, number, number];
    max: [number, number, number];
}
/** How far the turf lies above the ground, metres. */
export declare const ZHUDA_GRASS_TURF_LIFT_M = 0.02;
/**
 * The turf of one patch: a sheet over the ground in squares of about half a
 * metre, or null where nothing grows. A corner where grass grows carries 1
 * in its texture coordinate and one where it does not carries 0; the
 * fragment program cuts a ragged edge between them. Squares with no growing
 * corner, or with a corner off the ground, are left out. Pure: no Laya needed.
 */
export declare function zhudaGrassTurf(resolved: ZhudaGrassResolved, ground: (x: number, z: number) => number | null, grows: ((x: number, z: number, y: number) => boolean) | undefined, px: number, pz: number): ZhudaGrassMeshData | null;
/**
 * Meshes of blades, each cut into `segments` pieces along its length, so
 * that none has more than 65 535 vertices. Both edges of a blade are stored on its middle line;
 * the vertex program opens them. The normal is the way the blade faces; the
 * texture coordinate carries rank and edge in x; height, lean and place
 * along the blade in y. Pure: no Laya needed.
 */
export declare function zhudaGrassMeshes(blades: Float32Array, segments: number): ZhudaGrassMeshData[];
export interface ZhudaGrassStats {
    /** Patches of land that have a mesh now. */
    patches: number;
    /** Blades in those meshes (those drawn are fewer: far ones are thinned). */
    blades: number;
    vertices: number;
    /** Patches round the eye still waiting for their mesh. */
    pending: number;
}
/**
 * A field of grass in a scene. Call `update` every frame with the eye and the
 * time; it makes at most a few patches a call. `fill` makes every patch the
 * eye needs at once (a first frame, a picture). `dispose` gives it all back.
 */
export declare class ZhudaGrassField {
    readonly options: ZhudaGrassResolved;
    private readonly scene;
    private readonly ground;
    private readonly grows?;
    private readonly material;
    private readonly patches;
    private pending;
    /** The patch being made, over several calls when it is a large one. */
    private job;
    private disposed;
    constructor(scene: any, options: ZhudaGrassOptions);
    /** Changes the wind in place. */
    setWind(wind: {
        directionDeg?: number;
        strength?: number;
        speed?: number;
    }): void;
    get stats(): ZhudaGrassStats;
    /**
     * Moves the grass to the eye and the time. Makes the meshes the eye needs,
     * nearest first, until it has made `blades` blades (default 6000; always
     * some), and returns how many patches are still short of a mesh. The mesh
     * a patch near the eye gains is tens of thousands of blades: it is made
     * over several calls and shown when it is whole.
     */
    update(eye: readonly number[], seconds: number, blades?: number): number;
    /** Makes every patch the eye needs now, however many. */
    fill(eye: readonly number[], seconds: number): void;
    /**
     * Makes the next part of a band: some of the patch's clumps as meshes that
     * are not drawn yet. With the last part of a patch's first band comes its
     * turf, and a band that is whole is shown. Returns how many blades it made.
     */
    private step;
    private release;
    dispose(): void;
}
