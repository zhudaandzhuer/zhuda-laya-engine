// Generated from TypeScript source; run npm run types:generate.
/**
 * What a fly-through measured, against a frame budget, and the critic's
 * report on its pictures. Pure: no renderer, usable in Node and in a page.
 *
 * A fly-through (`runZhudaFlythrough`) draws a scene along a camera path
 * frame by frame and times each frame: the CPU time spent submitting it and,
 * where the browser gives one, the GPU time (WebGPU timestamps, WebGL's
 * disjoint timer query). `summarizeZhudaFlythrough` turns the frames into
 * average, p99 and max and checks them against a budget. GPU time that was
 * not measured is reported as unavailable with the reason, never as 0, and
 * a GPU limit that could not be checked makes the result `unavailable`, not
 * a pass.
 *
 * The critic: fixed poses of the same run, and a short recording, go to a
 * reviewer that sees only the pictures (an agent or a person) with
 * `zhudaCriticBrief`, and returns defects ranked by severity.
 * `gateZhudaCriticReport` proposes a gate: no defect above minor. That is a
 * proposal for a person to accept, not a pass by itself.
 */
/** One timed frame of a fly-through. */
export interface ZhudaFlythroughFrame {
    index: number;
    /** Seconds along the camera path. */
    time: number;
    /** Time spent on the CPU drawing (submitting) the frame. */
    cpuMs: number;
    /** GPU time of the frame, when measured. */
    gpuMs?: number;
    drawCalls?: number;
    triangles?: number;
}
/** Limits in milliseconds; any left out is not checked. */
export interface ZhudaFlythroughBudget {
    cpuAverageMs?: number;
    cpuP99Ms?: number;
    cpuMaxMs?: number;
    gpuAverageMs?: number;
    gpuP99Ms?: number;
    gpuMaxMs?: number;
}
export type ZhudaFlythroughLimit = keyof ZhudaFlythroughBudget;
export interface ZhudaFlythroughStats {
    averageMs: number;
    p99Ms: number;
    maxMs: number;
    /** The frame of the maximum. */
    maxAt: {
        index: number;
        time: number;
    };
}
export interface ZhudaFlythroughSummary {
    frames: number;
    cpu: ZhudaFlythroughStats;
    gpu: ({
        available: true;
        timed: number;
    } & ZhudaFlythroughStats) | {
        available: false;
        timed: number;
        reason: string;
    };
    /** Limits exceeded, with the frames over a p99 or max limit (at most 20, slowest first). */
    over: {
        limit: ZhudaFlythroughLimit;
        limitMs: number;
        valueMs: number;
        frames: {
            index: number;
            time: number;
            ms: number;
        }[];
    }[];
    /** Limits asked for that could not be checked (GPU time not measured). */
    unchecked: ZhudaFlythroughLimit[];
    /** `fail` when a measured limit is exceeded; `unavailable` when one could not be checked; else `pass`. */
    status: 'pass' | 'fail' | 'unavailable';
}
/** Lists what is wrong with a budget; empty when it is valid. */
export declare function validateZhudaFlythroughBudget(budget: unknown): string[];
/**
 * Average, p99 and max of the CPU and GPU times of a fly-through, checked
 * against `budget`. `gpuReason` says why GPU time is missing when no frame
 * has one. Frames must be in order and at least one.
 */
export declare function summarizeZhudaFlythrough(frames: readonly ZhudaFlythroughFrame[], options?: {
    budget?: ZhudaFlythroughBudget;
    gpuReason?: string;
}): ZhudaFlythroughSummary;
/** What a critic looks for, in the brief and in its report. */
export declare const ZHUDA_CRITIC_DEFECTS: readonly ["shimmer", "aliasing", "popping", "banding", "flat-light", "noise", "clipping", "other"];
export type ZhudaCriticDefectKind = (typeof ZHUDA_CRITIC_DEFECTS)[number];
export declare const ZHUDA_CRITIC_SEVERITIES: readonly ["minor", "major", "critical"];
export type ZhudaCriticSeverity = (typeof ZHUDA_CRITIC_SEVERITIES)[number];
export interface ZhudaCriticDefect {
    kind: ZhudaCriticDefectKind;
    severity: ZhudaCriticSeverity;
    /** The picture it shows in (a file name from the brief). */
    picture: string;
    /** Where in the picture and what it looks like. */
    where: string;
}
export interface ZhudaCriticReport {
    schemaVersion: 1;
    /** Who looked: an agent's model, or a person. */
    critic: string;
    /** The pictures it was given, by file name. */
    pictures: string[];
    /** Ranked, most severe first. */
    defects: ZhudaCriticDefect[];
}
/**
 * The brief handed to a critic with the pictures and nothing else: no
 * scene file, no code, no intended look. It names what to look for, the
 * severities and the report's format.
 */
export declare function zhudaCriticBrief(pictures: readonly string[], options?: {
    recording?: string;
}): string;
/** Lists what is wrong with a critic's report; empty when it is valid. */
export declare function validateZhudaCriticReport(value: unknown, pictures?: readonly string[]): string[];
/**
 * The gate the critic proposes: `minor-only` when no defect is above minor,
 * else `blocked` with the defects that block. A report that does not
 * validate is `invalid`. `minor-only` is a proposal for a person to accept.
 */
export declare function gateZhudaCriticReport(value: unknown, pictures?: readonly string[]): {
    status: 'minor-only' | 'blocked' | 'invalid';
    issues: string[];
    blocking: ZhudaCriticDefect[];
};
