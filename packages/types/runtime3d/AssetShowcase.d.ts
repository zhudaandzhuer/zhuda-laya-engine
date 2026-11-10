// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaModelLibrary, type ModelInstance } from './Assets';
import { type FilmicOptions } from './Filmic';
import { ZhudaModelInspector } from './ModelInspector';
export type AssetShowcaseMode = 'raw' | 'gameplay' | 'cinematic';
export interface AssetShowcasePresentation {
    /** Raw always disables postprocessing. Other modes may opt out explicitly. */
    filmic: false | FilmicOptions;
    opaqueColor: boolean;
}
/** Same-instance presentation modes. Consumer supplies lighting, environment and scene art.
 * Borrows library/parent/camera; owns the loaded instance and its postprocess only. */
export declare class ZhudaAssetShowcase {
    private readonly library;
    private readonly parent;
    private readonly camera;
    private readonly modes;
    private readonly previousOpaque;
    private readonly slot;
    private pipeline;
    private current;
    private currentMode;
    private disposed;
    constructor(options: {
        library: ZhudaModelLibrary;
        parent: Laya.Sprite3D | Laya.Scene3D;
        camera: Laya.Camera;
        presentations?: Partial<Record<AssetShowcaseMode, AssetShowcasePresentation>>;
    });
    get mode(): AssetShowcaseMode;
    get instance(): ModelInstance | null;
    private alive;
    private requireInputs;
    load(assetId: string, options?: {
        signal?: AbortSignal;
        timeoutMs?: number;
        independentMaterials?: boolean;
    }): Promise<boolean>;
    inspect(): ReturnType<ZhudaModelInspector['inspect']>;
    setMode(mode: AssetShowcaseMode): void;
    cancel(): void;
    clear(): void;
    dispose(): void;
}
