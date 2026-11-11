// Generated from TypeScript source; run npm run types:generate.
/**
 * Turns the scenery of a film scene into a model prefab, so the same models
 * at the same places can be instantiated in a game Scene through
 * `ZhudaPrefabLibrary`.
 *
 * A prefab holds scenery only. What a film scene says about the camera, the
 * look (sun, sky, fog, grade), water, reflectors, lights and built-in boxes
 * stays with the Scene that instantiates the prefab; so do lightmaps,
 * animation and motion of model nodes. Everything left out is listed, never
 * dropped silently.
 */
import type { PrefabModelsDefinition } from '../prefabs/PrefabLibrary.js';
import { type ZhudaFilmScene } from './FilmScene.js';
export interface ZhudaFilmPrefabResult {
    definition: PrefabModelsDefinition;
    /** What the film scene holds that the prefab does not, for the Scene to supply. */
    left: string[];
}
export declare function zhudaPrefabFromFilmScene(scene: ZhudaFilmScene, id: string, options?: {
    assets?: readonly string[];
}): ZhudaFilmPrefabResult;
