// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaFilmCamera, type ZhudaFilmVec3 } from './FilmScene.js';
export interface ZhudaFilmProjection {
    /** Across the picture from its left edge, 0..1 inside it. */
    x: number;
    /** Down the picture from its top edge, 0..1 inside it. */
    y: number;
    /** Metres in front of the camera along its view; zero or less is behind it. */
    depth: number;
    /** In front of the camera and inside the picture's edges. */
    inView: boolean;
}
/**
 * Projects `point` through `camera` onto a picture `aspect` times as wide as
 * it is high. Behind the camera `x` and `y` are where the point would be
 * were the view turned round: test `depth` or `inView` before placing a
 * marker. A camera looking straight up or down has no "right"; it is given
 * the world's -X, as a camera tipped there from looking along +Z has.
 */
export declare function projectZhudaFilmPoint(camera: ZhudaFilmCamera, point: ZhudaFilmVec3, aspect: number): ZhudaFilmProjection;
