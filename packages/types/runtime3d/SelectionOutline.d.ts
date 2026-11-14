// Generated from TypeScript source; run npm run types:generate.
export type ZhudaOutlineColor = readonly [number, number, number];
export interface ZhudaSelectionOutlineOptions {
    /**
     * Colour of the line where the selected thing is seen (default amber): a
     * display colour, as `SurfaceMaterialSpec.color` is, so the line matches an
     * unlit surface of the same colour.
     */
    visibleColor?: ZhudaOutlineColor;
    /**
     * Colour of the line, and of the fill, where it is behind something
     * (default: `visibleColor`). `null`: no line there.
     */
    hiddenColor?: ZhudaOutlineColor | null;
    /** How strong the hidden line is beside the seen one, 0..1 (default 0.6). */
    hiddenStrength?: number;
    /** How much the hidden part is filled with `hiddenColor`, 0..1 (default 0, not at all). */
    hiddenFill?: number;
    /** Width of the line in pixels of the picture, 1..6 (default 2). */
    width?: number;
    /**
     * Tell the hidden parts from the seen ones (default true). It reads the
     * camera's depth texture, which the camera then draws if nothing else
     * asked for it: one more pass over the scene's depth. `false`: one colour,
     * drawn through everything, and no depth texture.
     */
    occlusion?: boolean;
}
/** Problems with the options; an empty list means `ZhudaSelectionOutline` takes them. */
export declare function validateZhudaSelectionOutline(options: unknown): string[];
/**
 * A strength that swells and fades for a line that pulses: 1 at `seconds`
 * 0, down to `low` half a `period` later, and back. Give it the time of the
 * clock the scene runs on; it keeps none of its own.
 */
export declare function zhudaOutlinePulse(seconds: number, period?: number, low?: number): number;
export declare class ZhudaSelectionOutline {
    /**
     * The Laya post-process effect. `ZhudaFilmicPipeline` takes it in
     * `finishEffects`, where the line keeps its colour (before edge smoothing,
     * which then smooths the line too); in `sceneEffects` or a camera's own
     * chain it is graded with the scene.
     */
    readonly effect: any;
    private readonly mask;
    private readonly line;
    private options;
    private readonly nodes;
    private strength;
    private disposed;
    constructor(options?: ZhudaSelectionOutlineOptions);
    private colours;
    private renderers;
    private alive;
    /** Replaces the selection: each node with everything under it. A destroyed node leaves by itself. */
    select(nodes: readonly any[]): void;
    add(node: any): void;
    remove(node: any): void;
    clear(): void;
    /** How many nodes are selected. */
    get count(): number;
    /** Colours, width and fill; what is left out stays. `occlusion` is fixed when it is made. */
    set(options: Omit<ZhudaSelectionOutlineOptions, 'occlusion'>): void;
    /** 0..1 over the whole line and fill: `zhudaOutlinePulse` gives one that pulses. 0 draws nothing. */
    setStrength(strength: number): void;
    /** Call after the effect has been removed from its post-process chain. */
    dispose(): void;
}
