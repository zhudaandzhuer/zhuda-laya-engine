import { MeshoptDecoder } from 'meshoptimizer/decoder';
import type {
  ModelDecoderAdapter,
  ModelDecoderInput,
  ModelDecodedPayload,
} from './ModelDecoder.ts';
import { ModelDecoderError } from './ModelDecoder.ts';
import { readGltfAssetDocument, inspectGltfDocument } from './ModelCompatibility.ts';

// The ratified KHR name adds the COLOR filter; the layout is otherwise the EXT one.
const NAMES = ['EXT_meshopt_compression', 'KHR_meshopt_compression'] as const;
const FILTERS: Record<(typeof NAMES)[number], readonly string[]> = {
  EXT_meshopt_compression: ['NONE', 'OCTAHEDRAL', 'QUATERNION', 'EXPONENTIAL'],
  KHR_meshopt_compression: ['NONE', 'OCTAHEDRAL', 'QUATERNION', 'EXPONENTIAL', 'COLOR'],
};
type Json = Record<string, unknown>;
const object = (value: unknown): Json => {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw Error('Expected glTF object');
  return value as Json;
};
const integer = (value: unknown, min = 0): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min)
    throw Error('Invalid glTF byte count/index');
  return value;
};
const align = (value: number) => Math.ceil(value / 4) * 4;

/** Optional pinned CPU decoder: embedded glTF/GLB -> ordinary self-contained GLB.
 * Reads `EXT_meshopt_compression` and `KHR_meshopt_compression` (with its COLOR
 * filter). Uses existing ModelLibrary/provider ownership; no second renderer or cache.
 */
export class ZhudaMeshoptModelDecoder implements ModelDecoderAdapter {
  readonly descriptor = Object.freeze({
    format: 'meshopt' as const,
    name: 'meshoptimizer',
    version: '1.3.0',
    integritySha256: '10b313edaa0e322b0c1b46443f6c8b186b42139fe1eca189d50c09511d0ebedc',
  });
  private disposed = false;
  async decode({
    assetId,
    bytes,
    signal,
    maxOutputBytes,
  }: ModelDecoderInput): Promise<ModelDecodedPayload> {
    const check = () => {
      if (this.disposed || signal.aborted)
        throw new DOMException('Meshopt decode cancelled', 'AbortError');
    };
    check();
    if (!MeshoptDecoder.supported)
      throw new ModelDecoderError('unsupported', 'Meshopt requires WebAssembly', {
        format: 'meshopt',
        assetId,
      });
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0)
      throw Error('Invalid Meshopt output limit');
    const { document, binary } = readGltfAssetDocument(bytes);
    const report = inspectGltfDocument(document);
    const isMeshopt = (name: unknown) => NAMES.includes(name as (typeof NAMES)[number]);
    if (
      report.diagnostics.some(
        (d) => d.severity === 'error' && !(d.code === 'DECODER_REQUIRED' && isMeshopt(d.extension)),
      )
    )
      throw Error(
        'Invalid or unsupported glTF input: ' +
          report.diagnostics
            .filter((d) => d.severity === 'error')
            .map((d) => d.message)
            .join('; '),
      );
    if (!Array.isArray(document.extensionsUsed) || !document.extensionsUsed.some(isMeshopt))
      throw Error('Meshopt extension is not declared');
    const sourceBuffers = document.buffers;
    const views = document.bufferViews;
    if (!Array.isArray(sourceBuffers) || !Array.isArray(views))
      throw Error('Meshopt requires buffers and bufferViews');
    let bin: Uint8Array | undefined;
    if (binary) {
      const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      let offset = 12,
        chunks = 0;
      while (offset < bytes.byteLength) {
        if (offset + 8 > bytes.byteLength) throw Error('Truncated GLB chunk');
        const size = data.getUint32(offset, true),
          kind = data.getUint32(offset + 4, true);
        if (size % 4 || offset + 8 + size > bytes.byteLength)
          throw Error('Invalid GLB chunk length');
        if (chunks === 0 && kind !== 0x4e4f534a) throw Error('GLB JSON must be first');
        if (kind === 0x004e4942) {
          if (bin || chunks !== 1) throw Error('Duplicate or misplaced GLB binary chunk');
          bin = bytes.subarray(offset + 8, offset + 8 + size);
        } else if (kind !== 0x4e4f534a || chunks !== 0) throw Error('Unsupported GLB chunk');
        offset += size + 8;
        chunks++;
      }
    }
    const buffers = new Map<number, Uint8Array>();
    let embeddedBytes = 0;
    const buffer = (value: unknown): Uint8Array => {
      const index = integer(value),
        source = object(sourceBuffers[index]);
      if (buffers.has(index)) return buffers.get(index)!;
      const length = integer(source.byteLength),
        uri = source.uri;
      let result: Uint8Array;
      if (uri === undefined && index === 0 && bin) result = bin;
      else if (
        typeof uri === 'string' &&
        /^data:(application\/(octet-stream|gltf-buffer))?;base64,/.test(uri)
      ) {
        const encoded = uri.slice(uri.indexOf(',') + 1);
        if (
          !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded) ||
          Math.floor((encoded.length * 3) / 4) > maxOutputBytes + 2
        )
          throw Error('Invalid or oversized embedded buffer');
        result = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
      } else
        throw Error(
          'Meshopt requires embedded buffers; no external fetch or missing fallback bytes',
        );
      if (result.byteLength < length || result.byteLength > length + (uri === undefined ? 3 : 0))
        throw Error('Embedded buffer length mismatch');
      embeddedBytes += result.byteLength;
      if (embeddedBytes > maxOutputBytes) throw Error('Meshopt embedded buffer budget exceeded');
      buffers.set(index, result.subarray(0, length));
      return buffers.get(index)!;
    };
    // Preserve image references, but never allow a bypass of the provider boundary.
    for (const item of (document.images ?? []) as unknown[]) {
      const image = object(item);
      if (
        image.uri !== undefined &&
        (typeof image.uri !== 'string' || !image.uri.startsWith('data:'))
      )
        throw Error('Meshopt requires embedded images');
    }
    const plans = views.map((raw, index) => {
      const view = object(raw),
        extensions = view.extensions === undefined ? {} : object(view.extensions);
      const names = NAMES.filter((name) => extensions[name] !== undefined);
      if (names.length > 1) throw Error(`bufferViews[${index}] carries both Meshopt names`);
      const name = names[0],
        e = name === undefined ? undefined : object(extensions[name]);
      if (name && !(document.extensionsUsed as unknown[]).includes(name))
        throw Error(`${name} is used but not declared`);
      const length = integer(view.byteLength, 1),
        fallbackIndex = integer(view.buffer);
      const fallback = object(sourceBuffers[fallbackIndex]);
      if (integer(view.byteOffset ?? 0) + length > integer(fallback.byteLength))
        throw Error(`bufferViews[${index}] exceeds declared fallback buffer`);
      if (!e || !name)
        return {
          view,
          length,
          source: buffer(view.buffer),
          offset: integer(view.byteOffset ?? 0),
          compressedLength: length,
          e,
          name,
        };
      const stride = integer(e.byteStride, 1),
        count = integer(e.count, 1),
        mode = e.mode,
        filter = e.filter ?? 'NONE';
      if (
        stride * count !== length ||
        (view.byteStride !== undefined && view.byteStride !== stride) ||
        !['ATTRIBUTES', 'TRIANGLES', 'INDICES'].includes(String(mode)) ||
        !FILTERS[name].includes(String(filter)) ||
        (mode === 'ATTRIBUTES' && (stride % 4 !== 0 || stride > 256)) ||
        (mode !== 'ATTRIBUTES' && (![2, 4].includes(stride) || filter !== 'NONE')) ||
        (mode === 'TRIANGLES' && count % 3 !== 0) ||
        (filter === 'OCTAHEDRAL' && ![4, 8].includes(stride)) ||
        (filter === 'QUATERNION' && stride !== 8) ||
        (filter === 'EXPONENTIAL' && stride % 4 !== 0) ||
        (filter === 'COLOR' && ![4, 8].includes(stride))
      )
        throw Error(`Invalid Meshopt layout at bufferViews[${index}]`);
      return {
        view,
        length,
        source: buffer(e.buffer),
        offset: integer(e.byteOffset ?? 0),
        compressedLength: integer(e.byteLength, 1),
        e,
        name,
      };
    });
    let total = 0;
    for (const p of plans) {
      if (p.offset + p.compressedLength > p.source.byteLength)
        throw Error('Meshopt source range exceeds buffer');
      total += align(p.length);
      if (!Number.isSafeInteger(total) || total > maxOutputBytes)
        throw Error('Meshopt decoded output budget exceeded');
    }
    await MeshoptDecoder.ready;
    check();
    const output = new Uint8Array(total);
    let offset = 0;
    for (const p of plans) {
      check();
      const target = output.subarray(offset, offset + p.length),
        source = p.source.subarray(p.offset, p.offset + p.compressedLength);
      if (p.e)
        MeshoptDecoder.decodeGltfBuffer(
          target,
          p.e.count as number,
          p.e.byteStride as number,
          source,
          p.e.mode as string,
          (p.e.filter ?? 'NONE') as string,
        );
      else target.set(source);
      p.view.buffer = 0;
      p.view.byteOffset = offset;
      if (p.view.extensions) {
        if (p.name) delete object(p.view.extensions)[p.name];
        if (!Object.keys(object(p.view.extensions)).length) delete p.view.extensions;
      }
      offset += align(p.length);
      // Yield between bounded CPU blocks so cancellation/deadline can be observed.
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    check();
    document.buffers = [{ byteLength: output.byteLength }];
    for (const name of ['extensionsUsed', 'extensionsRequired'])
      if (Array.isArray(document[name])) {
        document[name] = (document[name] as unknown[]).filter((x) => !isMeshopt(x));
        if (!(document[name] as unknown[]).length) delete document[name];
      }
    // Reject any unhandled extension location rather than stripping its declaration.
    if (inspectGltfDocument(document).diagnostics.some((d) => d.severity === 'error'))
      throw Error('Unhandled Meshopt extension location');
    const json = new TextEncoder().encode(JSON.stringify(document)),
      jsonLength = align(json.byteLength);
    const fileLength = 12 + 8 + jsonLength + 8 + output.byteLength;
    if (fileLength > maxOutputBytes || fileLength > 0xffffffff)
      throw Error('Meshopt GLB output budget exceeded');
    const glb = new Uint8Array(fileLength),
      header = new DataView(glb.buffer);
    header.setUint32(0, 0x46546c67, true);
    header.setUint32(4, 2, true);
    header.setUint32(8, fileLength, true);
    header.setUint32(12, jsonLength, true);
    header.setUint32(16, 0x4e4f534a, true);
    glb.fill(32, 20, 20 + jsonLength);
    glb.set(json, 20);
    header.setUint32(20 + jsonLength, output.byteLength, true);
    header.setUint32(24 + jsonLength, 0x004e4942, true);
    glb.set(output, 28 + jsonLength);
    // This adapter owns only JS bytes; no persistent worker, native handle or GPU resource.
    return { assetId, format: 'meshopt', data: glb, byteLength: glb.byteLength, release() {} };
  }
  dispose(): void {
    this.disposed = true;
  }
}
