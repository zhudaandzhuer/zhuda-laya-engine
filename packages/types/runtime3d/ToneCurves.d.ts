// Generated from TypeScript source; run npm run types:generate.
/**
 * The curve that turns the light of a scene into the colours of a screen.
 * LayaAir 3.4.2 has one, ACES; this adds AgX and the Khronos PBR Neutral
 * curve, and "none".
 *
 * A curve costs no pass of its own. LayaAir's colour grade looks every pixel
 * up in a small table it draws once (contrast, saturation, white balance and
 * the rest), in one pass over the picture; with one of these curves that
 * pass is this module's, and works the curve out for each pixel after the
 * table. The table then holds the graded light in the encoding it is looked
 * up by, so a grade that changes nothing changes nothing: LayaAir's own
 * table holds plain light and is up to 1.2 % off between its entries.
 *
 * The constants of both curves are those of three.js 0.187.0 (MIT), which
 * took AgX from Filament and Blender and Neutral from Khronos:
 * `vendor/threejs-post/README.md`. The functions here are the shader's
 * arithmetic on the CPU, for tests and tools. Only `applyZhudaToneCurve`
 * needs the Laya runtime.
 */
/**
 * `aces`: LayaAir's filmic curve, strong contrast, bright colours lose
 * saturation late and shift hue (a bright red turns orange).
 * `agx`: bright colours fade to white without changing hue; softer contrast.
 * `neutral`: colours below 0.76 come out as they went in (a product shot, a
 * material that must match its swatch); only what is brighter is rolled off.
 * `none`: no curve; what is brighter than white is cut off.
 */
export type ZhudaToneMapping = 'aces' | 'agx' | 'neutral' | 'none';
export declare const ZHUDA_TONE_MAPPINGS: readonly ZhudaToneMapping[];
type Rgb = readonly [number, number, number];
/** The AgX contrast curve on a value 0..1 (a share of the 16.5 stops the curve holds). */
export declare function zhudaAgxContrast(x: number): number;
/**
 * AgX on a scene-linear colour (after exposure): linear colour for the
 * screen, 0..1. Middle grey 0.18 comes out as 0.18 of the screen's light
 * within a percent or two; 16.3 and above is white.
 */
export declare function zhudaAgxToneMap(color: Rgb): [number, number, number];
/**
 * The Khronos PBR Neutral curve on a scene-linear colour (after exposure).
 * A colour whose brightest channel is below 0.76 keeps its value but for a
 * small lift taken off the darkest channel (0.04 at most); above it the
 * brightness is rolled off toward 1 and the colour toward white.
 */
export declare function zhudaNeutralToneMap(color: Rgb): [number, number, number];
/** The curve a name stands for, on the CPU. `aces` is LayaAir's and has no twin here. */
export declare function zhudaToneMap(kind: Exclude<ZhudaToneMapping, 'aces'>, color: Rgb): [number, number, number];
/**
 * Makes a LayaAir `ColorGradEffect` end in this curve. Call it after the
 * effect has joined a chain, and before it leaves or joins one again put
 * `aces` back (LayaAir sets its own passes up on joining). The table is
 * drawn again on the next frame. `aces` is LayaAir's own path, untouched.
 * `releaseZhudaToneCurve` frees what this made for a grade.
 */
export declare function applyZhudaToneCurve(l: any, grade: any, kind: ZhudaToneMapping): void;
/** Gives a grade its own objects back and frees what `applyZhudaToneCurve` made for it. */
export declare function releaseZhudaToneCurve(l: any, grade: any): void;
export {};
