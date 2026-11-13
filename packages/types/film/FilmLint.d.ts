// Generated from TypeScript source; run npm run types:generate.
/**
 * Advice for a film scene that is valid but will not look its best.
 * Validation refuses what cannot be built; this names what its author would
 * regret, each with the change that fixes it. Pure: no browser, no GPU.
 *
 * Every rule was a trap found by drawing scenes (see
 * docs/plans/records/quality-defaults). A rule earns its place only when it
 * names a visible defect and a concrete fix; taste is not linted.
 */
import { type ZhudaFilmScene } from './FilmScene.js';
export interface ZhudaFilmAdvice {
    /** Stable id of the rule (see `ZHUDA_FILM_LINT_RULES`). */
    rule: string;
    /** `warn`: a visible defect. `tip`: a likely improvement. */
    level: 'warn' | 'tip';
    /** Where in the scene, written like a validation path. */
    path: string;
    /** What is the matter, in one sentence. */
    message: string;
    /** The change that fixes it: a patch fragment where one exists. */
    fix: string;
}
export interface ZhudaFilmLintContext {
    /**
     * Tile size in metres of each texture recipe the host can bake, by name
     * (`tileMeters` of the recipe). Without it texture density is not judged.
     */
    tileMeters?: Readonly<Record<string, readonly [number, number]>>;
}
/** What each rule looks for. The ids are stable; new rules get new ids. */
export declare const ZHUDA_FILM_LINT_RULES: Readonly<Record<string, string>>;
/**
 * Returns advice for `scene`, warnings first. The scene must already be valid
 * (`validateZhudaFilmScene` returned no issue). An empty list means none of
 * the known traps applies, not that the picture is good.
 */
export declare function lintZhudaFilmScene(scene: ZhudaFilmScene, context?: ZhudaFilmLintContext): ZhudaFilmAdvice[];
