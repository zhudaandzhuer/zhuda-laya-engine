// Generated from TypeScript source; run npm run types:generate.
/**
 * Which lamps' shadows to draw this frame. A point light's shadow is six
 * pictures of the scene (`ZhudaPointShadow.render`), and nothing draws them
 * again by itself: a lamp that moved, or a lamp something moved under,
 * keeps its old shadow. Drawing all of eight lamps every frame is 48
 * pictures a frame.
 *
 * The schedule keeps, for each lamp, where it is and whether its pictures
 * are out of date, and draws at most so many lamps a frame, the one that
 * has waited longest first. A lamp is out of date when it is placed for the
 * first time, when it moves or its reach changes, when the game says
 * something moved near it (`touch`), and, for a lamp marked `moving`,
 * always: those are drawn in turn, so eight of them each get new pictures
 * every eighth frame at one lamp a frame.
 *
 * It has no clock and draws nothing itself: `update()` is one frame, and
 * `draw` is `ZhudaPointShadow.render` or anything with its arguments.
 * Needs no runtime.
 */
export interface ZhudaPointShadowLamp {
    position: readonly [number, number, number];
    /** How far the lamp's light reaches, in scene units. */
    range: number;
    /**
     * Things move in this lamp's light all the time (a street with walkers):
     * its pictures are out of date every frame, and it takes its turn with the
     * other such lamps (default false).
     */
    moving?: boolean;
}
export interface ZhudaPointShadowScheduleOptions {
    /** Lamps drawn in one `update()` at most, 1..8 (default 1). */
    perFrame?: number;
    /**
     * How far a lamp may move, in scene units, before its pictures count as
     * out of date, 0..10 (default 0.01).
     */
    tolerance?: number;
}
/** Lists what is wrong with the options; empty when they are valid. */
export declare function validateZhudaPointShadowSchedule(options: ZhudaPointShadowScheduleOptions): string[];
export declare class ZhudaPointShadowSchedule {
    private readonly entries;
    private readonly perFrame;
    private readonly tolerance;
    private frame;
    private readonly draw;
    private readonly clear;
    /**
     * `draw(position, range, light)` draws the six pictures of a lamp;
     * `clear(light)`, when given, is told that a lamp was taken away.
     */
    constructor(draw: (position: readonly number[], range: number, light: number) => void, options?: ZhudaPointShadowScheduleOptions, clear?: (light: number) => void);
    /**
     * Where lamp `light` is and how far it reaches. Its pictures count as out
     * of date when it is new, or moved by more than the tolerance, or reaches
     * another distance.
     */
    set(light: number, lamp: ZhudaPointShadowLamp): void;
    /** Something that casts a shadow moved near lamp `light` (or near every lamp, without one). */
    touch(light?: number): void;
    /** Lamp `light` is gone: it is not drawn again, and `clear` is told. */
    remove(light: number): void;
    /** The lamps whose pictures are out of date, the one waiting longest first. */
    pending(): number[];
    /**
     * One frame: draws up to `perFrame` of the lamps that are out of date and
     * returns which. Call it once a frame, after lamps and casters have moved.
     */
    update(): number[];
    /** Draws every lamp that is out of date now, whatever `perFrame` says (a cut, a loaded level). */
    flush(): number[];
}
