// Generated from TypeScript source; run npm run types:generate.
export type ZhudaBasisKind = 'uastc' | 'etc1s';
export type ZhudaKtx2Supercompression = 'none' | 'basislz' | 'zstd' | 'zlib' | 'unknown';
export interface ZhudaKtx2Info {
    width: number;
    height: number;
    /** Mip levels in the file (at least 1). */
    levels: number;
    faces: number;
    layers: number;
    depth: number;
    /** The Basis payload, or null for a KTX 2 file of another kind (a plain or GPU-ready format). */
    basis: ZhudaBasisKind | null;
    /** Whether the payload carries an alpha channel. */
    alpha: boolean;
    /** Whether the colours are sRGB (a colour map) rather than linear (a normal or data map). */
    srgb: boolean;
    supercompression: ZhudaKtx2Supercompression;
    vkFormat: number;
}
export declare const ZHUDA_KTX2_MAX_SIZE = 16384;
/** Whether bytes begin as a KTX 2 file does. */
export declare function isZhudaKtx2(bytes: Uint8Array): boolean;
/**
 * Reads the header and the data format descriptor of a KTX 2 file. Returns
 * what is wrong with it in words, or the description. Pure: no transcoder.
 */
export declare function inspectZhudaKtx2(bytes: Uint8Array): {
    info?: ZhudaKtx2Info;
    problems: string[];
};
/** The formats a Basis texture is brought to. `rgba8` is uncompressed. */
export type ZhudaBasisTarget = 'astc-4x4' | 'etc2-rgba' | 'etc2-rgb' | 'bc3' | 'bc1' | 'rgba8';
export declare const ZHUDA_BASIS_TARGETS: readonly ZhudaBasisTarget[];
/** Bytes of one 4 by 4 block of a target; 0 for `rgba8`. */
export declare function zhudaBasisBlockBytes(target: ZhudaBasisTarget): number;
/** Bytes a texture of this size takes on the graphics card in a target, with or without mip levels. */
export declare function zhudaBasisTextureBytes(target: ZhudaBasisTarget, width: number, height: number, levels?: number): number;
/** Which block formats the graphics card samples. */
export interface ZhudaBasisSupport {
    astc: boolean;
    etc2: boolean;
    s3tc: boolean;
    /** S3TC with sRGB decoding; without it an sRGB map cannot be S3TC. */
    s3tcSrgb: boolean;
}
/** What this runtime's graphics card samples, as LayaAir reports it. */
export declare function zhudaBasisSupport(runtime?: any): ZhudaBasisSupport;
/**
 * The target for a texture on a device. UASTC: ASTC first (the same blocks,
 * nothing lost), then ETC2, then S3TC. ETC1S: ETC2 first (its blocks are
 * ETC1 blocks), then S3TC; never ASTC, which would keep the size of UASTC
 * and the losses of ETC1S. A size that is not a multiple of four, a cube or
 * an array is RGBA. Pure.
 */
export declare function chooseZhudaBasisTarget(support: ZhudaBasisSupport, texture: Pick<ZhudaKtx2Info, 'basis' | 'alpha' | 'srgb' | 'width' | 'height'>): ZhudaBasisTarget;
export interface ZhudaTranscodedLevel {
    width: number;
    height: number;
    data: Uint8Array;
}
export interface ZhudaTranscodedTexture {
    target: ZhudaBasisTarget;
    width: number;
    height: number;
    alpha: boolean;
    srgb: boolean;
    /** Level 0 first. `rgba8` has level 0 alone: the graphics card makes the others. */
    levels: ZhudaTranscodedLevel[];
}
/**
 * A transcoded texture as the file LayaAir's own parser reads: KTX 1 for
 * ASTC and ETC2, DDS for S3TC. `rgba8` has no container (it is uploaded as
 * pixels). Pure.
 */
export declare function zhudaBasisContainer(texture: ZhudaTranscodedTexture): {
    kind: 'ktx' | 'dds';
    bytes: ArrayBuffer;
};
/** SHA-256 of the transcoder this engine vendors (`vendor/basis/basis_transcoder.wasm`), in hex. */
export declare const ZHUDA_BASIS_WASM_SHA256 = "6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a";
/** Subresource integrity of the vendored `basis_transcoder.js`, for a script tag. */
export declare const ZHUDA_BASIS_SCRIPT_SRI = "sha256-hHi1tta3Tn0wgrifZBcyHY0dwDB/KzDUSEuxG0QWlqE=";
export interface ZhudaBasisTranscoderOptions {
    /**
     * The transcoder's module factory: what `basis_transcoder.js` defines as
     * `BASIS`. The game brings the script the way its platform allows (a
     * script tag, a bundled import, a mini-game `require`), so that no code is
     * fetched and run from here.
     */
    factory: (module: {
        wasmBinary: ArrayBuffer | Uint8Array;
    }) => Promise<any>;
    /** The bytes of `basis_transcoder.wasm`. */
    wasm: ArrayBuffer | Uint8Array;
    /**
     * SHA-256 the bytes must have, in hex (default: the vendored transcoder's,
     * `ZHUDA_BASIS_WASM_SHA256`). `false` accepts any bytes: only for a
     * transcoder the game has built and checked itself.
     */
    sha256?: string | false;
    /** How long start-up may take, in milliseconds (default 15 000). */
    timeoutMs?: number;
    signal?: AbortSignal;
}
/**
 * The Basis transcoder, started once and used for every texture. Transcoding
 * runs on the calling thread: a 1024 by 1024 UASTC map takes a few
 * milliseconds on a desktop and tens on a phone, so a game transcodes
 * behind its loading screen.
 */
export declare class ZhudaBasisTranscoder {
    private module;
    private disposed;
    private constructor();
    /**
     * Checks the transcoder's bytes against their hash, then starts it.
     * Rejects when the hash differs, when start-up fails or runs over its
     * time, or when the signal is aborted; a transcoder that comes up after
     * that is let go.
     */
    static create(options: ZhudaBasisTranscoderOptions): Promise<ZhudaBasisTranscoder>;
    /**
     * A KTX 2 file transcoded to a target, every mip level of it (`rgba8`:
     * level 0 only). Throws with the reason when the file is not a Basis
     * texture this build reads, or the transcoder refuses it.
     */
    transcode(bytes: Uint8Array, target: ZhudaBasisTarget, options?: {
        maxLevels?: number;
    }): ZhudaTranscodedTexture;
    dispose(): void;
}
export interface ZhudaBasisLoadOptions {
    /**
     * Where `basis_transcoder.js` and `basis_transcoder.wasm` are served from,
     * with its closing slash (default `'libs/basis/'`, where a consumer build
     * with `"basis": true` puts them).
     */
    baseUrl?: string;
    /** How long loading and start-up may take, in milliseconds (default 30 000). */
    timeoutMs?: number;
    signal?: AbortSignal;
}
/**
 * In a web page: brings the vendored transcoder in with a script tag that
 * carries its integrity value, fetches the WebAssembly file, checks it and
 * starts it. Calls share one transcoder; a failed load can be tried again.
 * A mini-game, or a page that bundles the script, uses
 * `ZhudaBasisTranscoder.create` with its own factory and bytes instead.
 */
export declare function loadZhudaBasisTranscoder(options?: ZhudaBasisLoadOptions): Promise<ZhudaBasisTranscoder>;
export interface ZhudaBasisTextureOptions {
    /** Forces a target (default: `chooseZhudaBasisTarget` for this device). */
    target?: ZhudaBasisTarget;
    /**
     * How the colours are read: `'color'` and `'emission'` as sRGB, `'normal'`
     * and `'data'` as they are. Default: what the file says of itself.
     */
    role?: 'color' | 'emission' | 'normal' | 'data';
    /** Anisotropic filtering, 1..16 (default `ZHUDA_DEFAULT_ANISO` with mip levels, 1 without). */
    anisoLevel?: number;
}
/**
 * A LayaAir `Texture2D` from a KTX 2 Basis file, in the best format this
 * device samples, with the file's own mip levels. The texture carries what
 * was done as `texture.zhudaBasis` (`target`, `bytes` on the graphics card,
 * `levels`). The caller owns it and destroys it.
 */
export declare function createZhudaBasisTexture(transcoder: ZhudaBasisTranscoder, bytes: Uint8Array, options?: ZhudaBasisTextureOptions, runtime?: any): any;
