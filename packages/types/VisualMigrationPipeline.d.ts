// Generated from TypeScript source; run npm run types:generate.
import type { EffectKey } from './effects/EffectDirector';
import type { VfxMaterialSpec } from './effects/VfxMaterial';
export interface UnityVisualMaterial {
    id: string;
    shader: string;
    color?: [number, number, number, number];
    metallic?: number;
    smoothness?: number;
    emission?: [number, number, number];
    transparent?: boolean;
    textures?: {
        albedo?: string;
        normal?: string;
        metallicGloss?: string;
        emission?: string;
    };
    vfx?: VfxMaterialSpec;
}
export interface MigratedVisualMaterial {
    id: string;
    target: 'PBRStandardMaterial' | 'UnlitMaterial' | 'ZhudaVfx';
    properties: Record<string, any>;
    textures: Record<string, string>;
    vfx?: VfxMaterialSpec;
}
/** Converts explicit Unity exporter data. Unknown shaders block conversion instead of silently falling back to BlinnPhong. */
export declare function convertUnityVisualMaterial(input: UnityVisualMaterial): MigratedVisualMaterial;
export declare function instantiateMigratedMaterial(spec: MigratedVisualMaterial, resolve: (key: string) => any): any;
/** Dispose a migrated material without cascading into shared application textures. */
export declare function disposeMigratedMaterial(material: any): void;
export interface UnityCurveKey {
    time: number;
    value: number;
    inTangent?: number;
    outTangent?: number;
    weightedMode?: number;
}
/** Adaptive Hermite baking with an explicit error bound at quarter points. Weighted tangents need an exporter-side bake. */
export declare function convertUnityAnimationCurve(keys: readonly UnityCurveKey[], tolerance?: number): EffectKey[];
export interface VisualFrameMetrics {
    passed: boolean;
    intersectionOverUnion: number;
    sourcePixels: number;
    targetPixels: number;
    centroidErrorPx: number;
}
/** Compare aligned RGBA captures by silhouette. Color is intentionally excluded; render timing and viewport must be matched by the caller. */
export declare function compareVisualFrames(source: ArrayLike<number>, target: ArrayLike<number>, width: number, height: number, options?: {
    alphaThreshold?: number;
    minIoU?: number;
    maxCentroidErrorPx?: number;
}): VisualFrameMetrics;
