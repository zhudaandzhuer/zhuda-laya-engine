/**
 * KTX2 textures with a Basis Universal payload (`KHR_texture_basisu`), brought
 * to the compressed format this device's graphics card reads.
 *
 * A PNG or JPEG is small to download and large in memory: it is decoded to
 * four bytes a pixel, and a mipmapped 2048 by 2048 map is 22 MB of the
 * graphics card. A Basis texture is transcoded to a block format the card
 * samples as it is (ASTC, ETC2 or S3TC): one byte a pixel, or half a byte
 * for an opaque ETC2 or BC1 map, with its mip levels as authored.
 *
 * LayaAir 3.4.2 reads KTX 1 and DDS files of those formats, and refuses KTX 2
 * (`"ktx2 !"`). Here a KTX 2 file is read, its levels are transcoded by the
 * Basis transcoder (WebAssembly, vendored in `vendor/basis`, brought by the
 * game: see `ZhudaBasisTranscoder.create`), and the result is wrapped as the
 * KTX 1 or DDS file LayaAir's own parser takes, so the upload is LayaAir's on
 * both backends. Where no block format fits (no support, a size that is not
 * a multiple of four) the texture is plain RGBA: as large in memory as a
 * PNG, still as small to download.
 *
 * Not here: BC7 (LayaAir has no such format), PVRTC and ETC1-only devices
 * (LayaAir's KTX parser takes neither usefully), cube and array textures,
 * HDR (UASTC HDR), video. Only `ZhudaBasisTranscoder` and
 * `createZhudaBasisTexture` need a runtime; the rest is pure.
 */
import { withDeadline } from './AsyncDeadline.ts';
import { ZHUDA_DEFAULT_ANISO } from './Surfaces.ts';

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

const KTX2_ID = [0xab, 0x4b, 0x54, 0x58, 0x20, 0x32, 0x30, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a];
const KTX2_HEADER_BYTES = 12 + 9 * 4 + 4 * 4 + 2 * 8;
const DF_MODEL_ETC1S = 163,
  DF_MODEL_UASTC = 166,
  DF_TRANSFER_SRGB = 2;
export const ZHUDA_KTX2_MAX_SIZE = 16384;

/** Whether bytes begin as a KTX 2 file does. */
export function isZhudaKtx2(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && KTX2_ID.every((value, index) => bytes[index] === value);
}

/**
 * Reads the header and the data format descriptor of a KTX 2 file. Returns
 * what is wrong with it in words, or the description. Pure: no transcoder.
 */
export function inspectZhudaKtx2(bytes: Uint8Array): {
  info?: ZhudaKtx2Info;
  problems: string[];
} {
  if (!(bytes instanceof Uint8Array)) return { problems: ['KTX 2 data must be a Uint8Array'] };
  if (!isZhudaKtx2(bytes)) return { problems: ['not a KTX 2 file (wrong first twelve bytes)'] };
  if (bytes.length < KTX2_HEADER_BYTES) return { problems: ['the KTX 2 header is cut short'] };
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u32 = (offset: number) => view.getUint32(offset, true);
  const vkFormat = u32(12),
    width = u32(20),
    height = u32(24),
    depth = u32(28),
    layers = u32(32),
    faces = u32(36),
    levels = Math.max(1, u32(40)),
    scheme = u32(44),
    dfdOffset = u32(48),
    dfdLength = u32(52);
  const problems: string[] = [];
  if (width < 1 || width > ZHUDA_KTX2_MAX_SIZE || height < 1 || height > ZHUDA_KTX2_MAX_SIZE)
    problems.push(`size ${width} by ${height} is outside 1..${ZHUDA_KTX2_MAX_SIZE}`);
  if (levels > 15) problems.push(`${levels} mip levels (at most 15)`);
  if (faces !== 1 && faces !== 6) problems.push(`${faces} faces (1 or 6)`);
  const levelIndexEnd = KTX2_HEADER_BYTES + levels * 24;
  if (bytes.length < levelIndexEnd) problems.push('the level index is cut short');
  else
    for (let level = 0; level < levels; level++) {
      const at = KTX2_HEADER_BYTES + level * 24;
      const offset = Number(view.getBigUint64(at, true)),
        length = Number(view.getBigUint64(at + 8, true));
      if (offset < levelIndexEnd || length < 1 || offset + length > bytes.length) {
        problems.push(`level ${level} lies outside the file`);
        break;
      }
    }
  let basis: ZhudaBasisKind | null = null,
    alpha = false,
    srgb = false;
  if (dfdLength >= 44 && dfdOffset >= KTX2_HEADER_BYTES && dfdOffset + dfdLength <= bytes.length) {
    // The descriptor: its total size, then one basic block of 24 bytes and 16 for each sample.
    const block = dfdOffset + 4;
    const model = view.getUint8(block + 8),
      transfer = view.getUint8(block + 10),
      blockSize = view.getUint16(block + 6, true);
    const samples = Math.max(0, Math.floor((blockSize - 24) / 16));
    const channel = (index: number) => view.getUint8(block + 24 + index * 16 + 3) & 0x0f;
    srgb = transfer === DF_TRANSFER_SRGB;
    if (model === DF_MODEL_UASTC) {
      basis = 'uastc';
      // Channel ids of UASTC: 0 RGB, 3 RGBA, 4 RRR, 5 RRRG, 6 RG.
      alpha = samples > 0 && (channel(0) === 3 || channel(0) === 5);
    } else if (model === DF_MODEL_ETC1S) {
      basis = 'etc1s';
      // Two slices: the second is alpha (channel id 15) or green of a two-channel map (channel id 4).
      alpha = samples > 1 && channel(1) === 15;
    }
  } else problems.push('the data format descriptor is missing or lies outside the file');
  if (problems.length) return { problems };
  const supercompression: ZhudaKtx2Supercompression =
    scheme === 0
      ? 'none'
      : scheme === 1
        ? 'basislz'
        : scheme === 2
          ? 'zstd'
          : scheme === 3
            ? 'zlib'
            : 'unknown';
  return {
    info: {
      width,
      height,
      levels,
      faces,
      layers,
      depth,
      basis,
      alpha,
      srgb,
      supercompression,
      vkFormat,
    },
    problems,
  };
}

/** The formats a Basis texture is brought to. `rgba8` is uncompressed. */
export type ZhudaBasisTarget = 'astc-4x4' | 'etc2-rgba' | 'etc2-rgb' | 'bc3' | 'bc1' | 'rgba8';

export const ZHUDA_BASIS_TARGETS: readonly ZhudaBasisTarget[] = [
  'astc-4x4',
  'etc2-rgba',
  'etc2-rgb',
  'bc3',
  'bc1',
  'rgba8',
];

/** Bytes of one 4 by 4 block of a target; 0 for `rgba8`. */
export function zhudaBasisBlockBytes(target: ZhudaBasisTarget): number {
  return target === 'rgba8' ? 0 : target === 'etc2-rgb' || target === 'bc1' ? 8 : 16;
}

/** Bytes a texture of this size takes on the graphics card in a target, with or without mip levels. */
export function zhudaBasisTextureBytes(
  target: ZhudaBasisTarget,
  width: number,
  height: number,
  levels = 1,
): number {
  let total = 0;
  for (let level = 0; level < levels; level++) {
    const w = Math.max(1, width >> level),
      h = Math.max(1, height >> level);
    const block = zhudaBasisBlockBytes(target);
    total += block ? Math.ceil(w / 4) * Math.ceil(h / 4) * block : w * h * 4;
  }
  return total;
}

/** Which block formats the graphics card samples. */
export interface ZhudaBasisSupport {
  astc: boolean;
  etc2: boolean;
  s3tc: boolean;
  /** S3TC with sRGB decoding; without it an sRGB map cannot be S3TC. */
  s3tcSrgb: boolean;
}

/** What this runtime's graphics card samples, as LayaAir reports it. */
export function zhudaBasisSupport(runtime: any = (globalThis as any).Laya): ZhudaBasisSupport {
  const engine = runtime?.LayaGL?.renderEngine,
    capable = runtime?.RenderCapable;
  const has = (name: string) =>
    typeof engine?.getCapable === 'function' &&
    capable?.[name] !== undefined &&
    engine.getCapable(capable[name]) === true;
  return {
    astc: has('COMPRESS_TEXTURE_ASTC'),
    etc2: has('COMPRESS_TEXTURE_ETC'),
    s3tc: has('COMPRESS_TEXTURE_S3TC'),
    s3tcSrgb: has('COMPRESS_TEXTURE_S3TC_SRGB'),
  };
}

/**
 * The target for a texture on a device. UASTC: ASTC first (the same blocks,
 * nothing lost), then ETC2, then S3TC. ETC1S: ETC2 first (its blocks are
 * ETC1 blocks), then S3TC; never ASTC, which would keep the size of UASTC
 * and the losses of ETC1S. A size that is not a multiple of four, a cube or
 * an array is RGBA. Pure.
 */
export function chooseZhudaBasisTarget(
  support: ZhudaBasisSupport,
  texture: Pick<ZhudaKtx2Info, 'basis' | 'alpha' | 'srgb' | 'width' | 'height'>,
): ZhudaBasisTarget {
  if (texture.width % 4 || texture.height % 4) return 'rgba8';
  const etc2: ZhudaBasisTarget = texture.alpha ? 'etc2-rgba' : 'etc2-rgb',
    s3tc: ZhudaBasisTarget = texture.alpha ? 'bc3' : 'bc1';
  const s3tcFits = support.s3tc && (!texture.srgb || support.s3tcSrgb);
  if (texture.basis === 'uastc' && support.astc) return 'astc-4x4';
  if (support.etc2) return etc2;
  if (s3tcFits) return s3tc;
  return 'rgba8';
}

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

/** GL internal formats LayaAir's KTX 1 parser maps to its own, linear then sRGB. */
const KTX1_FORMAT: Partial<Record<ZhudaBasisTarget, [number, number]>> = {
  'astc-4x4': [37808, 37840],
  'etc2-rgba': [37496, 37497],
  'etc2-rgb': [37492, 37493],
};
const DDS_FOURCC: Partial<Record<ZhudaBasisTarget, string>> = { bc3: 'DXT5', bc1: 'DXT1' };

/**
 * A transcoded texture as the file LayaAir's own parser reads: KTX 1 for
 * ASTC and ETC2, DDS for S3TC. `rgba8` has no container (it is uploaded as
 * pixels). Pure.
 */
export function zhudaBasisContainer(texture: ZhudaTranscodedTexture): {
  kind: 'ktx' | 'dds';
  bytes: ArrayBuffer;
} {
  const levels = texture.levels;
  if (!levels.length) throw Error('zhudaBasisContainer: a texture without levels');
  const ktx = KTX1_FORMAT[texture.target];
  if (ktx) {
    let size = 64;
    for (const level of levels) size += 4 + Math.ceil(level.data.length / 4) * 4;
    const bytes = new ArrayBuffer(size),
      out = new Uint8Array(bytes),
      view = new DataView(bytes);
    out.set([0xab, 0x4b, 0x54, 0x58, 0x20, 0x31, 0x31, 0xbb, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const base = texture.target === 'etc2-rgb' ? 0x1907 : 0x1908;
    // endianness, glType, glTypeSize, glFormat, glInternalFormat, glBaseInternalFormat,
    // width, height, depth, array elements, faces, mip levels, bytes of key/value data
    const header = [
      0x04030201,
      0,
      1,
      0,
      ktx[texture.srgb ? 1 : 0],
      base,
      texture.width,
      texture.height,
      0,
      0,
      1,
      levels.length,
      0,
    ];
    header.forEach((value, index) => view.setUint32(12 + index * 4, value, true));
    let at = 64;
    for (const level of levels) {
      view.setUint32(at, level.data.length, true);
      out.set(level.data, at + 4);
      at += 4 + Math.ceil(level.data.length / 4) * 4;
    }
    return { kind: 'ktx', bytes };
  }
  const fourCC = DDS_FOURCC[texture.target];
  if (!fourCC) throw Error(`zhudaBasisContainer: ${texture.target} has no container`);
  let size = 128;
  for (const level of levels) size += level.data.length;
  const bytes = new ArrayBuffer(size),
    out = new Uint8Array(bytes),
    view = new DataView(bytes);
  const code = (text: string) =>
    text.charCodeAt(0) |
    (text.charCodeAt(1) << 8) |
    (text.charCodeAt(2) << 16) |
    (text.charCodeAt(3) << 24);
  view.setUint32(0, code('DDS '), true);
  view.setUint32(4, 124, true);
  // caps, height, width, pixel format, linear size; and the mip count when there is more than one level
  view.setUint32(8, 0x1 | 0x2 | 0x4 | 0x1000 | 0x80000 | (levels.length > 1 ? 0x20000 : 0), true);
  view.setUint32(12, texture.height, true);
  view.setUint32(16, texture.width, true);
  view.setUint32(20, levels[0].data.length, true);
  view.setUint32(28, levels.length, true);
  view.setUint32(76, 32, true);
  view.setUint32(80, 0x4, true);
  view.setUint32(84, code(fourCC), true);
  view.setUint32(108, 0x1000 | (levels.length > 1 ? 0x400000 | 0x8 : 0), true);
  let at = 128;
  for (const level of levels) {
    out.set(level.data, at);
    at += level.data.length;
  }
  return { kind: 'dds', bytes };
}

/** SHA-256 of the transcoder this engine vendors (`vendor/basis/basis_transcoder.wasm`), in hex. */
export const ZHUDA_BASIS_WASM_SHA256 =
  '6cf17dc889352c42e9acf8897107978d127005fe3386c36a0e3845e27967630a';

/** Subresource integrity of the vendored `basis_transcoder.js`, for a script tag. */
export const ZHUDA_BASIS_SCRIPT_SRI = 'sha256-hHi1tta3Tn0wgrifZBcyHY0dwDB/KzDUSEuxG0QWlqE=';

/** Names of the transcoder's own formats for each target. */
const BASIS_FORMAT: Record<ZhudaBasisTarget, [name: string, value: number]> = {
  'astc-4x4': ['cTFASTC_4x4_RGBA', 10],
  'etc2-rgba': ['cTFETC2_RGBA', 1],
  'etc2-rgb': ['cTFETC1_RGB', 0],
  bc3: ['cTFBC3_RGBA', 3],
  bc1: ['cTFBC1_RGB', 2],
  rgba8: ['cTFRGBA32', 13],
};

export interface ZhudaBasisTranscoderOptions {
  /**
   * The transcoder's module factory: what `basis_transcoder.js` defines as
   * `BASIS`. The game brings the script the way its platform allows (a
   * script tag, a bundled import, a mini-game `require`), so that no code is
   * fetched and run from here.
   */
  factory: (module: { wasmBinary: ArrayBuffer | Uint8Array }) => Promise<any>;
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

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = (globalThis as any).crypto?.subtle;
  if (!subtle) throw Error('no SHA-256 here (crypto.subtle): the transcoder cannot be checked');
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The Basis transcoder, started once and used for every texture. Transcoding
 * runs on the calling thread: a 1024 by 1024 UASTC map takes a few
 * milliseconds on a desktop and tens on a phone, so a game transcodes
 * behind its loading screen.
 */
export class ZhudaBasisTranscoder {
  private module: any;
  private disposed = false;

  private constructor(module: any) {
    this.module = module;
  }

  /**
   * Checks the transcoder's bytes against their hash, then starts it.
   * Rejects when the hash differs, when start-up fails or runs over its
   * time, or when the signal is aborted; a transcoder that comes up after
   * that is let go.
   */
  static async create(options: ZhudaBasisTranscoderOptions): Promise<ZhudaBasisTranscoder> {
    if (typeof options?.factory !== 'function')
      throw Error('ZhudaBasisTranscoder: give the transcoder module factory (BASIS)');
    const wasm =
      options.wasm instanceof Uint8Array ? options.wasm : new Uint8Array(options.wasm ?? 0);
    if (!wasm.length) throw Error('ZhudaBasisTranscoder: give the bytes of basis_transcoder.wasm');
    const expected = options.sha256 ?? ZHUDA_BASIS_WASM_SHA256;
    return withDeadline(
      async (signal) => {
        if (expected !== false) {
          const actual = await sha256Hex(wasm);
          if (actual !== String(expected).toLowerCase())
            throw Error(
              `ZhudaBasisTranscoder: the transcoder is not the expected one (SHA-256 ${actual})`,
            );
        }
        if (signal.aborted) throw signal.reason;
        const module = await options.factory({ wasmBinary: wasm });
        if (typeof module?.initializeBasis !== 'function' || typeof module.KTX2File !== 'function')
          throw Error('ZhudaBasisTranscoder: the factory did not give a Basis transcoder');
        module.initializeBasis();
        return new ZhudaBasisTranscoder(module);
      },
      { signal: options.signal, timeoutMs: options.timeoutMs ?? 15_000 },
      (late) => late.dispose(),
    );
  }

  /**
   * A KTX 2 file transcoded to a target, every mip level of it (`rgba8`:
   * level 0 only). Throws with the reason when the file is not a Basis
   * texture this build reads, or the transcoder refuses it.
   */
  transcode(
    bytes: Uint8Array,
    target: ZhudaBasisTarget,
    options: { maxLevels?: number } = {},
  ): ZhudaTranscodedTexture {
    if (this.disposed) throw Error('ZhudaBasisTranscoder: disposed');
    if (!ZHUDA_BASIS_TARGETS.includes(target))
      throw Error(`ZhudaBasisTranscoder: unknown target ${String(target)}`);
    const { info, problems } = inspectZhudaKtx2(bytes);
    if (!info) throw Error(`Invalid KTX 2 texture: ${problems.join('; ')}`);
    if (!info.basis)
      throw Error('KTX 2 texture without a Basis payload (UASTC or ETC1S): not read here');
    if (info.faces !== 1 || info.layers > 1 || info.depth > 1)
      throw Error('KTX 2 cube, array and volume textures are not read here');
    const m = this.module;
    const file = new m.KTX2File(bytes);
    try {
      if (!file.isValid()) throw Error('the Basis transcoder does not accept this KTX 2 file');
      if (!file.startTranscoding())
        throw Error('the Basis transcoder could not start on this file');
      const [name, fallback] = BASIS_FORMAT[target];
      const format = m.transcoder_texture_format?.[name]?.value ?? fallback;
      const count =
        target === 'rgba8'
          ? 1
          : Math.max(1, Math.min(info.levels, options.maxLevels ?? info.levels));
      const levels: ZhudaTranscodedLevel[] = [];
      for (let level = 0; level < count; level++) {
        const size = file.getImageTranscodedSizeInBytes(level, 0, 0, format);
        if (!(size > 0)) throw Error(`level ${level} has no size in ${target}`);
        const data = new Uint8Array(size);
        if (!file.transcodeImage(data, level, 0, 0, format, 0, -1, -1))
          throw Error(`level ${level} did not transcode to ${target}`);
        levels.push({
          width: Math.max(1, info.width >> level),
          height: Math.max(1, info.height >> level),
          data,
        });
      }
      return {
        target,
        width: info.width,
        height: info.height,
        alpha: info.alpha,
        srgb: info.srgb,
        levels,
      };
    } finally {
      file.close();
      file.delete();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.module = null;
  }
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

let loading: Promise<ZhudaBasisTranscoder> | undefined;

/**
 * In a web page: brings the vendored transcoder in with a script tag that
 * carries its integrity value, fetches the WebAssembly file, checks it and
 * starts it. Calls share one transcoder; a failed load can be tried again.
 * A mini-game, or a page that bundles the script, uses
 * `ZhudaBasisTranscoder.create` with its own factory and bytes instead.
 */
export function loadZhudaBasisTranscoder(
  options: ZhudaBasisLoadOptions = {},
): Promise<ZhudaBasisTranscoder> {
  if (loading) return loading;
  const base = options.baseUrl ?? 'libs/basis/';
  const page = (globalThis as any).document;
  if (!page?.createElement || typeof fetch !== 'function')
    return Promise.reject(
      Error('loadZhudaBasisTranscoder needs a web page; use ZhudaBasisTranscoder.create here'),
    );
  const attempt = withDeadline(
    async (signal) => {
      const scope = globalThis as any;
      if (typeof scope.BASIS !== 'function')
        await new Promise<void>((resolve, reject) => {
          const tag = page.createElement('script');
          tag.src = base + 'basis_transcoder.js';
          tag.integrity = ZHUDA_BASIS_SCRIPT_SRI;
          tag.crossOrigin = 'anonymous';
          tag.onload = () => resolve();
          tag.onerror = () =>
            reject(Error(`the Basis transcoder script did not load from ${tag.src}`));
          signal.addEventListener('abort', () => reject(signal.reason), { once: true });
          page.head.appendChild(tag);
        });
      if (typeof scope.BASIS !== 'function')
        throw Error('the Basis transcoder script loaded without defining BASIS');
      const response = await fetch(base + 'basis_transcoder.wasm', { signal });
      if (!response.ok)
        throw Error(`the Basis transcoder WebAssembly did not load (HTTP ${response.status})`);
      const wasm = new Uint8Array(await response.arrayBuffer());
      return ZhudaBasisTranscoder.create({ factory: scope.BASIS, wasm, signal });
    },
    { signal: options.signal, timeoutMs: options.timeoutMs ?? 30_000 },
    (late) => late.dispose(),
  );
  loading = attempt;
  attempt.catch(() => {
    if (loading === attempt) loading = undefined;
  });
  return attempt;
}

/**
 * LayaAir gives an S3TC texture the graphics card's sRGB decoding only when
 * it has no mip levels (`supportSRGB`), because it cannot make the levels of
 * such a texture itself. With levels it reads the texture raw and converts
 * in the shader with a power of 2.2: the filtering is done on encoded
 * values and dark colours come out darker (26 of 255 was drawn as 19). A
 * Basis texture brings its own levels, so for the one call that makes it
 * the question is answered by what the graphics card can do.
 */
function withHardwareSrgbS3tc<T>(runtime: any, srgb: boolean, make: () => T): T {
  const context = runtime?.LayaGL?.textureContext;
  const formats = runtime?.TextureFormat;
  if (!srgb || typeof context?.supportSRGB !== 'function' || !formats) return make();
  if (!zhudaBasisSupport(runtime).s3tcSrgb) return make();
  const own = Object.prototype.hasOwnProperty.call(context, 'supportSRGB');
  const original = context.supportSRGB;
  context.supportSRGB = function (this: unknown, format: number, mipmap: boolean) {
    if (format === formats.DXT1 || format === formats.DXT3 || format === formats.DXT5) return true;
    return original.call(this, format, mipmap);
  };
  try {
    return make();
  } finally {
    if (own) context.supportSRGB = original;
    else delete context.supportSRGB;
  }
}

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
export function createZhudaBasisTexture(
  transcoder: ZhudaBasisTranscoder,
  bytes: Uint8Array,
  options: ZhudaBasisTextureOptions = {},
  runtime: any = (globalThis as any).Laya,
): any {
  const { info, problems } = inspectZhudaKtx2(bytes);
  if (!info) throw Error(`Invalid KTX 2 texture: ${problems.join('; ')}`);
  const srgb = options.role ? options.role === 'color' || options.role === 'emission' : info.srgb;
  const target =
    options.target ?? chooseZhudaBasisTarget(zhudaBasisSupport(runtime), { ...info, srgb });
  if (target !== 'rgba8' && (info.width % 4 || info.height % 4))
    throw Error(
      `${target} needs a width and height that are multiples of four (${info.width} by ${info.height}); use rgba8`,
    );
  const transcoded = { ...transcoder.transcode(bytes, target), srgb };
  const mipmapped = transcoded.levels.length > 1 || target === 'rgba8';
  const anisoLevel = options.anisoLevel ?? (mipmapped ? ZHUDA_DEFAULT_ANISO : 1);
  if (!Number.isInteger(anisoLevel) || anisoLevel < 1 || anisoLevel > 16)
    throw Error('anisoLevel: use a whole number 1..16');
  let texture: any;
  if (target === 'rgba8') {
    texture = new runtime.Texture2D(
      info.width,
      info.height,
      runtime.TextureFormat.R8G8B8A8,
      true,
      false,
      srgb,
    );
    texture.setPixelsData(transcoded.levels[0].data, false, false);
  } else {
    const container = zhudaBasisContainer(transcoded);
    // LayaAir's own parsers; the last argument is its construct parameters (index 5: sRGB).
    const construct = [0, 0, 0, transcoded.levels.length > 1, false, srgb];
    texture =
      container.kind === 'ktx'
        ? runtime.Texture2D._parseKTX(container.bytes, null, construct)
        : withHardwareSrgbS3tc(runtime, srgb, () =>
            runtime.Texture2D._parseDDS(container.bytes, null, construct),
          );
  }
  if (anisoLevel > 1) texture.anisoLevel = anisoLevel;
  texture.zhudaBasis = {
    target,
    levels: transcoded.levels.length,
    bytes: zhudaBasisTextureBytes(
      target,
      info.width,
      info.height,
      target === 'rgba8'
        ? Math.floor(Math.log2(Math.max(info.width, info.height))) + 1
        : transcoded.levels.length,
    ),
  };
  return texture;
}
