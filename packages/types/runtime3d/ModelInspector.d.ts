// Generated from TypeScript source; run npm run types:generate.
import type { ModelInstance } from './Assets.js';
import type { ModelCompatibilityReport } from './ModelCompatibility.js';
export interface ModelInspection {
    compatibility: ModelCompatibilityReport;
    /** Paths identify child indices in this instance, not glTF source node indices. */
    nodes: {
        path: string;
        name: string;
        active: boolean;
        mesh: null | {
            id: number;
            vertices: number;
            indices: number;
        };
        materialIds: number[];
        morphWeights: Record<string, number>;
    }[];
    materials: {
        id: number;
        name: string;
        textures: {
            uniform: string;
            id: number;
            width: number;
            height: number;
        }[];
    }[];
    animations: {
        path: string;
        layer: number;
        name: string;
        durationSeconds: number;
        speed: number;
    }[];
    textureScope: 'known-gltf-and-unlit-uniforms';
}
/** Borrows a live instance. Does not own resources or drive an animation clock. */
export declare class ZhudaModelInspector {
    private readonly instance;
    constructor(instance: ModelInstance);
    private root;
    node(path: string): Laya.Sprite3D;
    inspect(): ModelInspection;
    setMorphWeight(path: string, channel: string, weight: number): void;
    /** Starts native playback. Pose is evaluated by the next native animation frame, not synchronously. */
    play(path: string, name: string, options?: {
        layer?: number;
        normalizedTime?: number;
        speed?: number;
    }): void;
    /**
     * Fades from the clip that is playing to another over `seconds` (default
     * 0.25), with LayaAir's own playback. With nothing playing it starts the
     * clip. `normalizedTime` (0..1) is where the new clip begins.
     */
    crossFade(path: string, name: string, options?: {
        seconds?: number;
        layer?: number;
        normalizedTime?: number;
    }): void;
    setAnimationSpeed(path: string, speed: number): void;
}
