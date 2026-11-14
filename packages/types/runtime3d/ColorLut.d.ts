// Generated from TypeScript source; run npm run types:generate.
/**
 * A colour table from a grading tool (a `.cube` file, as DaVinci Resolve,
 * Photoshop and others write it) applied to the finished picture: the look
 * a colourist made on a still is the look of the game.
 *
 * `parseZhudaCubeLut` reads the text; `ZhudaColorLut` is a post-process
 * effect for `finishEffects` (after tone mapping, on the colours the screen
 * shows, which is what such a table is made for). Two reads of a small
 * texture a pixel. Only the class needs the Laya runtime.
 */
export interface ZhudaCubeLut {
    /** The file's `TITLE`, when it has one. */
    title?: string;
    /** Entries along each edge of the cube. */
    size: number;
    /** The input values the first and the last entry stand for (`DOMAIN_MIN`, `DOMAIN_MAX`). */
    domainMin: [number, number, number];
    domainMax: [number, number, number];
    /** `size`³ colours, three numbers each, red changing fastest and blue slowest (the file's order). */
    data: Float32Array;
}
/** The largest cube `parseZhudaCubeLut` reads, and the largest `ZhudaColorLut` draws with. */
export declare const ZHUDA_CUBE_LUT_MAX_SIZE = 256;
export declare const ZHUDA_COLOR_LUT_MAX_SIZE = 65;
/**
 * Reads a `.cube` file (Adobe Cube LUT 1.0, and the `LUT_3D_INPUT_RANGE`
 * line some tools write instead of a domain). Throws with the line number on
 * anything it does not understand: a one-dimensional table, a missing or
 * repeated size, a wrong number of entries, a number that is not finite.
 */
export declare function parseZhudaCubeLut(text: string): ZhudaCubeLut;
/** A table that changes nothing, for tests and as a start for a tool. */
export declare function zhudaIdentityCubeLut(size: number): ZhudaCubeLut;
/** Lists what is wrong with a table handed over as data; empty when it is valid. */
export declare function validateZhudaCubeLut(lut: ZhudaCubeLut): string[];
/**
 * The colour the table gives for a colour, blended between its eight nearest
 * entries: the shader's arithmetic. Input outside the domain takes the
 * nearest edge.
 */
export declare function zhudaSampleCubeLut(lut: ZhudaCubeLut, color: readonly [number, number, number]): [number, number, number];
/**
 * How the cube lies in its texture: its blue slices side by side in rows,
 * so that a cube of 65 fits where a single strip would be too wide for a
 * phone.
 */
export declare function zhudaCubeLutAtlas(size: number): {
    columns: number;
    rows: number;
    width: number;
    height: number;
};
export interface ZhudaColorLutOptions {
    /** How much of the table's colour is taken, 0..1 (default 1). */
    intensity?: number;
}
export declare class ZhudaColorLut {
    /** The Laya post-process effect; `ZhudaFilmicPipeline` takes it in `finishEffects`, first. */
    readonly effect: any;
    private readonly material;
    private texture;
    private intensity;
    private disposed;
    constructor(lut: ZhudaCubeLut, options?: ZhudaColorLutOptions);
    private upload;
    /** Another table in place (a look that changes with the hour). */
    setLut(lut: ZhudaCubeLut): void;
    /** How much of the table's colour is taken, 0..1; 0 leaves the picture as it is. */
    setIntensity(intensity: number): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
