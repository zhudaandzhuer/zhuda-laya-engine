// Generated from TypeScript source; run npm run types:generate.
/** Lattice hash -> unsigned 32-bit integer. */
export declare function latticeHash(ix: number, iy: number, seed: number): number;
/** Periodic gradient noise, roughly in [-1, 1]. */
export declare function gradientNoise(x: number, y: number, periodX: number, periodY: number, seed: number): number;
/**
 * Fractal noise over one tile, clamped to [0, 1] and centred on 0.5.
 * Frequencies must be positive integers for a seamless result.
 */
export declare function fractalNoise(u: number, v: number, frequencyX: number, frequencyY: number, octaves: number, seed: number): number;
/**
 * Periodic cellular noise. Writes [nearest distance, second distance, cell id]
 * into `out` (cell id is uniform in [0, 1) and constant inside one cell).
 */
export declare function cellularNoise(x: number, y: number, periodX: number, periodY: number, seed: number, out: number[]): number[];
