// Generated from TypeScript source; run npm run types:generate.
import { type ZhudaImageDecodeSupport } from './GltfIntake.js';
/** Import diagnostics describe the shipped importer, not complete glTF conformance. */
export interface ModelDiagnostic {
    code: 'INVALID_DOCUMENT' | 'INVALID_EXTENSION_DECLARATION' | 'UNDECLARED_EXTENSION' | 'UNSUPPORTED_REQUIRED_EXTENSION' | 'UNSUPPORTED_OPTIONAL_EXTENSION' | 'REQUIRED_RENDER_INPUT' | 'INVALID_MORPH_WEIGHTS'
    /** Meshopt data: only a registered decoder (ZhudaMeshoptModelDecoder) reads it. */
     | 'DECODER_REQUIRED'
    /** Integer vertex attributes the engine turns into floats before LayaAir parses them. */
     | 'DEQUANTIZED_ATTRIBUTES'
    /** This device cannot decode a texture's WebP/AVIF image: its fallback loads, or nothing. */
     | 'IMAGE_DECODE_UNAVAILABLE'
    /** A WebP/AVIF image without a fallback, inspected without a device answer. */
     | 'IMAGE_DECODE_UNCHECKED'
    /** A punctual light LayaAir can only approximate (falloff, spot cone). */
     | 'LIGHT_APPROXIMATED' | 'INVALID_LIGHT' | 'INVALID_CAMERA';
    severity: 'error' | 'warning';
    path: string;
    extension?: string;
    message: string;
    hint: string;
}
export interface GltfExtensionCapability {
    name: string;
    /** `native`: LayaAir's importer; `engine`: this engine before or around it. */
    implementation: 'native' | 'engine';
    requiredRenderInputs: readonly 'opaqueColor'[];
    /** An implemented parser is not a visual conformance certificate. */
    visualConformance: 'not-certified';
}
export interface GltfAssetCapability {
    name: string;
    kind: 'container' | 'delivery' | 'geometry-compression' | 'image-compression';
    status: 'supported' | 'adapter-required' | 'unsupported';
    message: string;
    hint: string;
}
/** Machine-readable import/delivery boundary for agents and model tooling. */
export declare const gltfAssetCapabilities: readonly GltfAssetCapability[];
export declare const gltfExtensionCapabilities: readonly GltfExtensionCapability[];
/** Options for a compatibility inspection. */
export interface GltfInspectOptions {
    /** This device's WebP/AVIF decoding (`probeZhudaImageDecode`). Without it no device answer is assumed. */
    imageDecode?: ZhudaImageDecodeSupport;
}
export interface ModelSourceInventory {
    /** Source complexity only; this does not predict native/GPU upload time. */
    summary: {
        nodes: number;
        meshes: number;
        primitives: number;
        vertices: number;
        indices: number;
        triangles: number;
        materials: number;
        textures: number;
        images: number;
        animations: number;
    };
    nodes: readonly {
        index: number;
        name: string;
        mesh: number | null;
        skin: number | null;
        children: readonly number[];
        morphWeights: readonly number[];
        /** glTF camera index, or null. */
        camera: number | null;
        /** `KHR_lights_punctual` light index, or null. */
        light: number | null;
    }[];
    meshes: readonly {
        index: number;
        name: string;
        primitives: readonly {
            mode: number;
            vertices: number;
            indices: number;
            triangles: number | null;
            material: number | null;
            morphTargets: number;
            attributes: readonly string[];
        }[];
    }[];
    materials: readonly {
        index: number;
        name: string;
        alphaMode: string;
        doubleSided: boolean;
        baseColor: readonly number[];
        metallic: number;
        roughness: number;
        extensions: readonly string[];
        textures: readonly {
            slot: string;
            texture: number;
            texCoord: number;
            colorSpace: 'srgb' | 'linear';
        }[];
    }[];
    textures: readonly {
        index: number;
        /** The core `source` image (the fallback when an extension image is offered). */
        image: number | null;
        sampler: number | null;
        /** `EXT_texture_webp` / `EXT_texture_avif` images, or null. */
        webp: number | null;
        avif: number | null;
    }[];
    images: readonly {
        index: number;
        name: string;
        delivery: 'embedded' | 'external';
        mimeType: string | null;
    }[];
    animations: readonly {
        index: number;
        name: string;
        channels: readonly {
            node: number | null;
            path: string;
            interpolation: string;
        }[];
    }[];
}
export interface ModelCompatibilityReport {
    schemaVersion: 1;
    status: 'supported' | 'conditional' | 'degraded' | 'unsupported';
    /** Known importer gates only. Does not replace Khronos Validator or pixel acceptance. */
    validationScope: 'importer-capabilities';
    extensions: readonly {
        name: string;
        required: boolean;
        implemented: boolean;
    }[];
    requiredRenderInputs: readonly 'opaqueColor'[];
    diagnostics: readonly ModelDiagnostic[];
    inventory: ModelSourceInventory;
}
type RecordValue = Record<string, unknown>;
export declare function inspectGltfDocument(document: unknown, options?: GltfInspectOptions): ModelCompatibilityReport;
export declare class ZhudaModelCompatibilityError extends Error {
    readonly report: ModelCompatibilityReport;
    readonly assetId?: string;
    constructor(report: ModelCompatibilityReport, assetId?: string);
}
/** Internal shared decode seam. No fetching or native resource allocation. */
export declare function readGltfAssetDocument(input: ArrayBuffer | Uint8Array): {
    binary: boolean;
    document: RecordValue;
};
export declare function inspectGltfAsset(bytes: ArrayBuffer | Uint8Array, options?: GltfInspectOptions): ModelCompatibilityReport;
export {};
