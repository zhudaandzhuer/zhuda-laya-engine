/** Import diagnostics describe the shipped importer, not complete glTF conformance. */
export interface ModelDiagnostic {
    code: 'INVALID_DOCUMENT' | 'INVALID_EXTENSION_DECLARATION' | 'UNDECLARED_EXTENSION' | 'UNSUPPORTED_REQUIRED_EXTENSION' | 'UNSUPPORTED_OPTIONAL_EXTENSION' | 'REQUIRED_RENDER_INPUT' | 'INVALID_MORPH_WEIGHTS';
    severity: 'error' | 'warning';
    path: string;
    extension?: string;
    message: string;
    hint: string;
}
export interface GltfExtensionCapability {
    name: string;
    implementation: 'native';
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
export interface ModelSourceInventory {
    nodes: readonly {
        index: number;
        name: string;
        mesh: number | null;
        skin: number | null;
        children: readonly number[];
        morphWeights: readonly number[];
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
        image: number | null;
        sampler: number | null;
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
export declare function inspectGltfDocument(document: unknown): ModelCompatibilityReport;
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
export declare function inspectGltfAsset(bytes: ArrayBuffer | Uint8Array): ModelCompatibilityReport;
export {};
