// Generated from TypeScript source; run npm run types:generate.
/**
 * A VRM 1.0 avatar on a model copy from `ZhudaModelLibrary`: what the file's
 * `VRMC_*` extensions describe, applied with the engine's own parts.
 *
 * - **Humanoid**: `bone(name)` is the Laya node of a humanoid bone.
 * - **Expressions**: `setExpression(name, weight)`; each `update` zeroes the
 *   morph targets the expressions move and adds each bind's share, moves
 *   material colours and texture offsets from their rest toward their
 *   targets, with the specification's `isBinary` and override rules
 *   (`zhudaVrmExpressionWeights`).
 * - **Gaze**: `lookAt(point)` or `setGaze(yaw, pitch)` turns the eye bones
 *   or sets the four gaze expressions, through the file's range maps.
 * - **Node constraints**: roll, aim and rotation, each frame.
 * - **Spring bones**: `ZhudaSpringBones` on the engine's solver, each joint
 *   with its own settings (`zhudaVrmSpringSetting`), kept out of its spring's
 *   colliders.
 * - **MToon**: each MToon material drawn as a `ZhudaToonMaterial` with a
 *   shade colour (`zhudaVrmToonPlan`), one for this copy, put back on
 *   `dispose`.
 *
 * It has no timer: `update(seconds)` or `updateFrom(session.layers)` once a
 * frame, after the frame's animation has posed the model
 * (`runAfterAnimation` does that), in the order three-vrm runs them: gaze,
 * expressions, constraints, springs. Make it before any clip plays: the
 * pose the model has then is its rest.
 */
import type { ModelInstance } from './Assets.js';
import type { ZhudaLayeredClock } from './Clocks.js';
import { ZhudaSpringBones } from './SpringBones.js';
import { ZhudaToonMaterial } from '../shaders/ToonMaterial.js';
import { type ZhudaVrmDocument, type ZhudaVrmHumanBoneName, type ZhudaVrmIssue } from './VrmDocument.js';
export interface ZhudaVrmOptions {
    /** Draw the MToon materials as toon materials (default true). Without, they stay LayaAir's glTF materials. */
    mtoon?: boolean;
    /** Spring bones (default true): `step` and `maxSteps` as `ZhudaSpringBoneSolver`'s. */
    springBones?: boolean | {
        step?: number;
        maxSteps?: number;
    };
    /**
     * Height in pixels of the picture MToon's screen outlines are a share of
     * (`outlineWidthMode: screenCoordinates`). Default: the stage's height, or 1080.
     */
    screenHeight?: number;
    /** Shader name prefix of the toon materials (default `ZhudaVrmMToon`). */
    shaderName?: string;
}
export declare class ZhudaVrm {
    readonly vrm: ZhudaVrmDocument;
    readonly instance: ModelInstance;
    /** What the file's reading found, then what this copy could not apply. */
    readonly issues: readonly ZhudaVrmIssue[];
    /** The toon materials made for the MToon materials, by glTF material index. */
    readonly toonMaterials: ReadonlyMap<number, ZhudaToonMaterial>;
    /** The spring bones, one set for each set of colliders the springs use. */
    readonly springBones: readonly ZhudaSpringBones[];
    private readonly weights;
    private applied;
    private readonly morphs;
    private readonly touched;
    private readonly toons;
    /** Materials of this copy that are not MToon, cloned because an expression moves their colour. */
    private readonly clones;
    /** Each renderer slot this changed, with what it had. */
    private readonly replaced;
    private readonly rest;
    private readonly constraints;
    private readonly eyes;
    private head;
    private gaze;
    private lastGaze;
    private disposed;
    constructor(instance: ModelInstance, options?: ZhudaVrmOptions);
    /** Puts `material` in every slot of this copy made from glTF material `index`. */
    private swap;
    private restore;
    private alive;
    /** The Laya node of a humanoid bone, or null when the model has none. */
    bone(name: ZhudaVrmHumanBoneName): any | null;
    /** The model's expressions: the presets it has, then its custom ones. */
    get expressionNames(): string[];
    /** Sets an expression's weight, 0..1 (clamped), applied at the next `update`. */
    setExpression(name: string, weight: number): void;
    /** An expression's weight as set (not as applied). */
    expression(name: string): number;
    /** Every weight back to 0. */
    resetExpressions(): void;
    /** The weights the last `update` applied, after `isBinary` and the overrides. */
    get appliedExpressions(): ReadonlyMap<string, number>;
    /** Looks at a point in the world (metres) from the next `update` on; `null` looks ahead again. */
    lookAt(target: readonly [number, number, number] | null): void;
    /** Looks by angles, degrees, in the gaze's own space: yaw toward the model's left, pitch down. */
    setGaze(yawDeg: number, pitchDeg: number): void;
    /** The yaw and pitch the last `update` looked at, degrees. */
    get gazeAngles(): {
        yaw: number;
        pitch: number;
    };
    /** The gaze's own space now: where it is in the world and how it is turned. */
    private gazeSpace;
    /** Runs one frame: gaze, expressions, constraints, then the springs on `deltaSeconds`. */
    update(deltaSeconds: number): void;
    /** The same, with a layer of the engine's clock (default `world`). */
    updateFrom(layers: ZhudaLayeredClock, layer?: string): void;
    /** Calls `updateFrom(layers)` each frame once LayaAir's animation has posed the model; returns the stop. */
    runAfterAnimation(layers: ZhudaLayeredClock, layer?: string): () => void;
    /** The springs put back at rest where the model is now: after it was put elsewhere at once. */
    resetSpringBones(): void;
    private updateGaze;
    private updateExpressions;
    private updateToon;
    private updateConstraints;
    /**
     * Lets go of what it made: the springs, the toon materials and copies
     * (the model's own materials go back on), the morph targets to 0. The
     * model's nodes keep the pose they have.
     */
    dispose(): void;
}
