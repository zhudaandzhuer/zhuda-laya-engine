// Generated from TypeScript source; run npm run types:generate.
/**
 * Levels of detail by distance for copies of models: near the eye a copy
 * draws its full model, farther away a lighter one, and beyond a limit
 * nothing. The caller says where the eye is; this never reads a camera or a
 * clock, and it owns no model: it only switches nodes it was given on and off.
 */
/** What `update` did: how many copies draw each level, how many draw nothing, how many changed. */
export interface ZhudaLodCounts {
    levels: number[];
    culled: number;
    switched: number;
}
/** A copy that is not drawn. */
export declare const ZHUDA_LOD_CULLED = -1;
/**
 * The level a copy at `distance` draws. `from[k]` is where level `k + 1`
 * takes over from level `k`; beyond `cull` nothing is drawn. A copy keeps its
 * `current` level until it is past a border by `hysteresis` (a share of that
 * border), so one standing on a border does not flicker.
 */
export declare function zhudaLodLevel(distance: number, from: readonly number[], cull: number | undefined, current?: number, hysteresis?: number): number;
/** Lists what is wrong with level borders and a cull distance; empty when valid. */
export declare function validateZhudaLodDistances(from: readonly unknown[], cull: unknown, max?: number): string[];
export interface ZhudaLodItem {
    /** The node whose world position the distance is measured to. */
    anchor: any;
    /** One node per level, nearest first; exactly one is active, or none when culled. */
    nodes: any[];
    /** Where each further level begins, in metres. */
    from: readonly number[];
    cull?: number;
}
/** Switches the levels of many copies for one eye position. */
export declare class ZhudaModelLod {
    private readonly items;
    private readonly current;
    private positions;
    private disposed;
    private readonly most;
    readonly hysteresis: number;
    private readonly show;
    /**
     * `show` makes one level's node drawn or not; by default it sets the node's
     * `active`. A renderer that must stay in its scene's lists passes its own.
     */
    constructor(items: ZhudaLodItem[], hysteresis?: number, show?: (node: any, visible: boolean) => void);
    get size(): number;
    /** Call after the copies moved: their positions are read again on the next update. */
    invalidate(): void;
    /**
     * Chooses what every copy draws for an eye at `[x, y, z]` in world metres.
     * `reach` scales every distance at once (default 1): at 0.5 a copy turns
     * to its lighter version, and stops being drawn, at half the distance it
     * was authored for. For a device that cannot draw as much: one number
     * instead of a second set of distances. 0.05..8.
     */
    update(eye: readonly [number, number, number], reach?: number): ZhudaLodCounts;
    /** Puts every copy back to its full model and stops. The nodes belong to their owner. */
    dispose(): void;
}
