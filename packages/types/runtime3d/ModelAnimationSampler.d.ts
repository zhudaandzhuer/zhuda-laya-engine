// Generated from TypeScript source; run npm run types:generate.
import type { ModelInstance } from './Assets.js';
/**
 * One thing poses a model at a time: a sampler or a blend takes its
 * animator here and gives it back when it is disposed.
 */
export declare function claimZhudaAnimator(animator: Laya.Animator): void;
export declare function releaseZhudaAnimator(animator: Laya.Animator): void;
export declare class ZhudaModelAnimationSampler {
    readonly durationSeconds: number;
    private readonly animator;
    private readonly layer;
    private readonly state;
    private readonly evaluator;
    private readonly applier;
    private readonly play;
    private readonly task;
    private readonly previousSpeed;
    private mark;
    private disposed;
    constructor(instance: ModelInstance, path: string, name: string, layerIndex?: number);
    /** Absolute clip-local seconds. Clamps by default; explicit loop wraps endpoint. */
    sample(seconds: number, loop?: boolean): void;
    /** Restore native playback speed. The last sampled pose remains until next tick. */
    dispose(): void;
}
