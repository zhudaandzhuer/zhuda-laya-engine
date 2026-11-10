// Generated from TypeScript source; run npm run types:generate.
export interface ZhudaFilmReviewShot {
    label: string;
    /** Top-left RGBA8, opaque sRGB (as returned by the film renderer). */
    frame: {
        width: number;
        height: number;
        rgba: Uint8Array;
    };
}
export interface ZhudaFilmReviewSheet {
    width: number;
    height: number;
    /** Top-left RGBA8, opaque sRGB. */
    rgba: Uint8Array;
    cells: {
        label: string;
        x: number;
        y: number;
        width: number;
        height: number;
    }[];
}
/** One to four shots of the same size: one column for a single shot, otherwise two. */
export declare function composeZhudaFilmReview(shots: readonly ZhudaFilmReviewShot[], options?: {
    gap?: number;
}): Promise<ZhudaFilmReviewSheet>;
