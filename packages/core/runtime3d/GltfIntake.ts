/**
 * glTF intake steps LayaAir 3.4.2's importer lacks. They read a glTF document,
 * or rewrite its bytes, before the native parser sees it. Nothing here makes a
 * Laya object, fetches a URL or allocates a GPU resource.
 */
type Json = Record<string, unknown>;
const record = (v: unknown): Json =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : {};
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const indexOf = (v: unknown): number | null =>
  Number.isSafeInteger(v) && (v as number) >= 0 ? (v as number) : null;
const label = (v: unknown): string => (typeof v === 'string' ? v : '');
function freeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

// ---------------------------------------------------------------- images ---

/** Texture-source extensions the engine resolves, in the order it prefers them. */
export type ZhudaGltfImageExtension = 'EXT_texture_avif' | 'EXT_texture_webp';
/** Whether this device decodes WebP and AVIF pictures (`probeZhudaImageDecode`). */
export interface ZhudaImageDecodeSupport {
  readonly webp: boolean;
  readonly avif: boolean;
}
export interface ZhudaGltfTextureSource {
  /** The image the texture loads, or null when the file offers nothing loadable. */
  readonly image: number | null;
  /** The extension that image came from; null for the core `source`. */
  readonly extension: ZhudaGltfImageExtension | null;
  /** Extensions whose image this device cannot decode. */
  readonly unavailable: readonly ZhudaGltfImageExtension[];
}
const imageExtensions: readonly (readonly [ZhudaGltfImageExtension, 'avif' | 'webp'])[] = [
  ['EXT_texture_avif', 'avif'],
  ['EXT_texture_webp', 'webp'],
];
/**
 * The image a glTF texture should load: its AVIF, then its WebP source when the
 * device decodes it, else the core `source` (the optional fallback). Without
 * `support` the core source is preferred, and an extension image is used only
 * when there is no fallback.
 */
export function resolveZhudaGltfTextureSource(
  texture: unknown,
  support?: ZhudaImageDecodeSupport,
): ZhudaGltfTextureSource {
  const t = record(texture),
    extensions = record(t.extensions),
    fallback = indexOf(t.source),
    unavailable: ZhudaGltfImageExtension[] = [];
  for (const [name, key] of imageExtensions) {
    const image = indexOf(record(extensions[name]).source);
    if (image === null) continue;
    if (support ? support[key] : fallback === null) return { image, extension: name, unavailable };
    if (support) unavailable.push(name);
  }
  return { image: fallback, extension: null, unavailable };
}
// One-pixel pictures, made with sharp 0.35.5 (libwebp 1.6.0, libheif 1.23.5 / aom 3.15.1).
const probes: Record<'webp' | 'avif', [string, string]> = {
  webp: ['image/webp', 'UklGRhwAAABXRUJQVlA4TA8AAAAvAAAAAAcQ/Y/+ByKi/wEA'],
  avif: [
    'image/avif',
    'AAAAHGZ0eXBhdmlmAAAAAG1pZjFhdmlmbWlhZgAAANZtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAACJpbG9jAAAAAERAAAEAAQAAAAAA+gABAAAAAAAAACYAAAAjaWluZgAAAAAAAQAAABVpbmZlAgAAAAABAABhdjAxAAAAAA5waXRtAAAAAAABAAAAVmlwcnAAAAA4aXBjbwAAAAxhdjFDgSACAAAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAABZpcG1hAAAAAAAAAAEAAQOBAgMAAAAubWRhdBIACgc4AAaQENBpMhkXgmMEwAAygAAAAEhUNmGsYoAKNr/ysfdA',
  ],
};
async function decodes(type: string, base64: string): Promise<boolean> {
  const g = globalThis as any;
  if (typeof g.Blob !== 'function' || typeof g.atob !== 'function') return false;
  const blob = new g.Blob([Uint8Array.from(g.atob(base64), (c: string) => c.charCodeAt(0))], {
    type,
  });
  // LayaAir decodes a texture through an image element (WebGL) or from one
  // (WebGPU): ask the same decoder. A worker or mini-game host without one
  // falls back to createImageBitmap, or reports no support.
  if (typeof g.Image === 'function' && typeof g.URL?.createObjectURL === 'function') {
    const url = g.URL.createObjectURL(blob);
    try {
      return await new Promise<boolean>((resolve) => {
        const image = new g.Image();
        // A decoder that never answers counts as no decoder. IO deadline only.
        const timer = setTimeout(() => resolve(false), 3000);
        image.onload = () => {
          clearTimeout(timer);
          resolve(image.naturalWidth === 1 && image.naturalHeight === 1);
        };
        image.onerror = () => {
          clearTimeout(timer);
          resolve(false);
        };
        image.src = url;
      });
    } finally {
      g.URL.revokeObjectURL(url);
    }
  }
  if (typeof g.createImageBitmap === 'function')
    try {
      const bitmap = await g.createImageBitmap(blob);
      const ok = bitmap.width === 1 && bitmap.height === 1;
      bitmap.close?.();
      return ok;
    } catch {
      return false;
    }
  return false;
}
let probing: Promise<ZhudaImageDecodeSupport> | undefined;
/** Decodes a one-pixel WebP and AVIF picture once per page and remembers the answer. */
export function probeZhudaImageDecode(): Promise<ZhudaImageDecodeSupport> {
  probing ??= Promise.all([decodes(...probes.webp), decodes(...probes.avif)]).then(([webp, avif]) =>
    Object.freeze({ webp, avif }),
  );
  return probing;
}

// ---------------------------------------------------------------- lights ---

/** One `KHR_lights_punctual` light, as the file gives it (glTF units). */
export interface ZhudaGltfLight {
  readonly index: number;
  readonly name: string;
  readonly type: 'directional' | 'point' | 'spot';
  /** Linear RGB, 0..1. */
  readonly color: readonly [number, number, number];
  /** Lux (lm/m²) for a directional light; candela (lm/sr) for point and spot. */
  readonly intensity: number;
  /** Metres; null when the file gives none (no cut-off). */
  readonly range: number | null;
  /** Spot cone half-angles in radians (glTF defaults: 0 and π/4). */
  readonly innerConeAngle: number;
  readonly outerConeAngle: number;
}
export interface ZhudaGltfProblem {
  readonly index: number;
  readonly message: string;
}
/** The file's punctual lights; an invalid one is null and named in `problems`. */
export function readZhudaGltfLights(document: unknown): {
  lights: readonly (ZhudaGltfLight | null)[];
  problems: readonly ZhudaGltfProblem[];
} {
  const problems: ZhudaGltfProblem[] = [];
  const lights = list(record(record(record(document).extensions).KHR_lights_punctual).lights).map(
    (raw, index): ZhudaGltfLight | null => {
      const l = record(raw),
        spot = record(l.spot);
      const fail = (message: string) => (problems.push({ index, message }), null);
      if (l.type !== 'directional' && l.type !== 'point' && l.type !== 'spot')
        return fail('type must be directional, point or spot');
      const color = l.color === undefined ? [1, 1, 1] : list(l.color);
      if (color.length !== 3 || !color.every((c) => finite(c) && c >= 0 && c <= 1))
        return fail('color must be three linear values from 0 to 1');
      const intensity = l.intensity === undefined ? 1 : l.intensity;
      if (!finite(intensity) || intensity < 0) return fail('intensity must be 0 or more');
      if (l.range !== undefined && (!finite(l.range) || l.range <= 0))
        return fail('range must be more than 0');
      const inner = spot.innerConeAngle === undefined ? 0 : spot.innerConeAngle,
        outer = spot.outerConeAngle === undefined ? Math.PI / 4 : spot.outerConeAngle;
      if (l.type === 'spot') {
        if (l.spot === undefined) return fail('a spot light needs its spot object');
        if (
          !finite(inner) ||
          !finite(outer) ||
          inner < 0 ||
          outer <= inner ||
          outer > Math.PI / 2 + 1e-6
        )
          return fail('spot cone angles need 0 <= inner < outer <= π/2');
      }
      return freeze({
        index,
        name: label(l.name),
        type: l.type,
        color: color as [number, number, number],
        intensity,
        range: l.type === 'directional' || l.range === undefined ? null : (l.range as number),
        innerConeAngle: l.type === 'spot' ? (inner as number) : 0,
        outerConeAngle: l.type === 'spot' ? (outer as number) : 0,
      });
    },
  );
  return { lights, problems };
}
/** What `zhudaGltfLightToLaya` gives a LayaAir light component. */
export interface ZhudaLayaLightSettings {
  readonly kind: 'directional' | 'point' | 'spot';
  /** For `Light.color`, which LayaAir reads as sRGB-encoded: glTF's linear colour, encoded. */
  readonly color: readonly [number, number, number];
  readonly intensity: number;
  /** Point and spot: LayaAir's `range`, where its falloff reaches zero. */
  readonly range: number | null;
  /** Spot: LayaAir's full cone angle in degrees (its inner edge is fixed at half of it). */
  readonly spotAngleDeg: number | null;
}
const encode = (c: number) =>
  c <= 0 ? 0 : c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
/**
 * glTF light units to LayaAir's. LayaAir's diffuse term has no 1/π
 * (`Fd_Lambert` returns 1), so a LayaAir intensity is radiance per unit of
 * albedo; glTF gives lux and candela.
 * - Directional: `scale × lux / π`.
 * - Point and spot: LayaAir's falloff is `1/(1+25f²)` (and a fade past 0.87),
 *   f = distance/range, not glTF's inverse square. The range is the file's,
 *   or `4·√(scale·cd/π)` when it gives none: a quarter of it is where the glTF
 *   light makes a white surface white. The intensity makes LayaAir's curve equal
 *   glTF's recommended falloff at half the range. Without a file range the two
 *   stay within about 30 % from a quarter to nine tenths of it. With one,
 *   glTF's window closes faster: LayaAir's light is about 0.63 of it at a
 *   quarter of the range and about twice it at three quarters. Nearer than a
 *   quarter, LayaAir's light stays finite.
 * - Spot: the full cone is twice glTF's outer angle (at most 179°). LayaAir puts
 *   the inner edge at half of it, whatever the file says, and dims the cone by
 *   the cosine to its axis as well.
 * `scale` stands in for exposure: physical units can be very large.
 */
export function zhudaGltfLightToLaya(
  light: ZhudaGltfLight,
  options: { scale?: number } = {},
): ZhudaLayaLightSettings {
  const scale = options.scale ?? 1;
  if (!finite(scale) || scale < 0) throw Error('Invalid glTF light scale');
  const color = freeze(light.color.map(encode) as [number, number, number]);
  if (light.type === 'directional')
    return freeze({
      kind: 'directional',
      color,
      intensity: (scale * light.intensity) / Math.PI,
      range: null,
      spotAngleDeg: null,
    });
  const power = scale * light.intensity;
  const range = light.range ?? Math.max(1e-3, 4 * Math.sqrt(power / Math.PI));
  // glTF's recommended window at half the range, (1 - (1/2)^4)^2; none without a range.
  const windowAtHalf = light.range === null ? 1 : (1 - 1 / 16) ** 2;
  return freeze({
    kind: light.type,
    color,
    intensity: (7.25 * 4 * power * windowAtHalf) / (Math.PI * range * range),
    range,
    spotAngleDeg:
      light.type === 'spot' ? Math.min(179, (2 * light.outerConeAngle * 180) / Math.PI) : null,
  });
}

// --------------------------------------------------------------- cameras ---

export type ZhudaGltfCamera =
  | {
      readonly index: number;
      readonly name: string;
      readonly type: 'perspective';
      /** Vertical field of view in degrees. */
      readonly yfovDeg: number;
      /** Width over height when the file fixes one; LayaAir uses its viewport's. */
      readonly aspectRatio: number | null;
      readonly znear: number;
      /** Null: no far plane in the file. */
      readonly zfar: number | null;
    }
  | {
      readonly index: number;
      readonly name: string;
      readonly type: 'orthographic';
      /** Half width and half height of the view, in metres. */
      readonly xmag: number;
      readonly ymag: number;
      readonly znear: number;
      readonly zfar: number;
    };
/** The file's cameras; an invalid one is null and named in `problems`. */
export function readZhudaGltfCameras(document: unknown): {
  cameras: readonly (ZhudaGltfCamera | null)[];
  problems: readonly ZhudaGltfProblem[];
} {
  const problems: ZhudaGltfProblem[] = [];
  const cameras = list(record(document).cameras).map((raw, index): ZhudaGltfCamera | null => {
    const c = record(raw);
    const fail = (message: string) => (problems.push({ index, message }), null);
    if (c.type === 'perspective') {
      const p = record(c.perspective);
      if (!finite(p.yfov) || p.yfov <= 0 || p.yfov >= Math.PI)
        return fail('perspective yfov must be between 0 and π');
      if (!finite(p.znear) || p.znear <= 0) return fail('perspective znear must be more than 0');
      if (p.zfar !== undefined && (!finite(p.zfar) || p.zfar <= p.znear))
        return fail('perspective zfar must be more than znear');
      if (p.aspectRatio !== undefined && (!finite(p.aspectRatio) || p.aspectRatio <= 0))
        return fail('perspective aspectRatio must be more than 0');
      return freeze({
        index,
        name: label(c.name),
        type: 'perspective' as const,
        yfovDeg: (p.yfov * 180) / Math.PI,
        aspectRatio: (p.aspectRatio as number | undefined) ?? null,
        znear: p.znear,
        zfar: (p.zfar as number | undefined) ?? null,
      });
    }
    if (c.type === 'orthographic') {
      const o = record(c.orthographic);
      if (!finite(o.xmag) || !finite(o.ymag) || o.xmag === 0 || o.ymag === 0)
        return fail('orthographic xmag and ymag must be nonzero');
      if (!finite(o.znear) || !finite(o.zfar) || o.znear < 0 || o.zfar <= o.znear)
        return fail('orthographic planes need 0 <= znear < zfar');
      return freeze({
        index,
        name: label(c.name),
        type: 'orthographic' as const,
        xmag: o.xmag,
        ymag: o.ymag,
        znear: o.znear,
        zfar: o.zfar,
      });
    }
    return fail('type must be perspective or orthographic');
  });
  return { cameras, problems };
}
/**
 * Points a LayaAir camera as a glTF camera: its lens, and, given the Laya node
 * the camera hangs on, that node's world position and rotation (both look down
 * their local -Z). The aspect ratio stays the viewport's; an infinite far plane
 * keeps the camera's own.
 */
export function applyZhudaGltfCamera(
  camera: Laya.Camera,
  data: ZhudaGltfCamera,
  node?: Laya.Sprite3D,
): void {
  if (data.type === 'perspective') {
    camera.orthographic = false;
    camera.fieldOfView = data.yfovDeg;
    camera.nearPlane = data.znear;
    if (data.zfar !== null) camera.farPlane = data.zfar;
  } else {
    camera.orthographic = true;
    camera.orthographicVerticalSize = 2 * Math.abs(data.ymag);
    camera.nearPlane = data.znear;
    camera.farPlane = data.zfar;
  }
  if (node) {
    camera.transform.position = node.transform.position.clone();
    camera.transform.rotation = node.transform.rotation.clone();
  }
}

// ------------------------------------------------------------ node data ---

/** glTF node data LayaAir 3.4.2 drops on import: custom properties, a camera, a light. */
export interface ZhudaGltfNodeData {
  readonly index: number;
  /** The glTF name, or null (LayaAir then names the node `node_<n>`). */
  readonly name: string | null;
  /** A frozen copy of the node's `extras`, when it has any. */
  readonly extras?: unknown;
  readonly camera?: ZhudaGltfCamera;
  readonly light?: ZhudaGltfLight;
}
/** Every node that carries extras, a valid camera or a valid light. */
export function readZhudaGltfNodeData(document: unknown): readonly ZhudaGltfNodeData[] {
  const { lights } = readZhudaGltfLights(document),
    { cameras } = readZhudaGltfCameras(document);
  const out: ZhudaGltfNodeData[] = [];
  list(record(document).nodes).forEach((raw, index) => {
    const n = record(raw);
    const light = lights[indexOf(record(record(n.extensions).KHR_lights_punctual).light) ?? -1];
    const camera = cameras[indexOf(n.camera) ?? -1];
    if (n.extras === undefined && !light && !camera) return;
    out.push(
      freeze({
        index,
        name: typeof n.name === 'string' ? n.name : null,
        ...(n.extras === undefined ? {} : { extras: JSON.parse(JSON.stringify(n.extras)) }),
        ...(camera ? { camera } : {}),
        ...(light ? { light } : {}),
      }),
    );
  });
  return freeze(out);
}

// ---------------------------------------------------- quantized vertices ---

const components: Record<number, { size: number; read: string; max: number }> = {
  5120: { size: 1, read: 'getInt8', max: 127 },
  5121: { size: 1, read: 'getUint8', max: 255 },
  5122: { size: 2, read: 'getInt16', max: 32767 },
  5123: { size: 2, read: 'getUint16', max: 65535 },
};
const counts: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
// The vertex attributes LayaAir reads as four-byte floats. COLOR_0 is left to
// the parse-time repair (zhudaGltfColors) and JOINTS_0 stays integer.
const attributeTypes: Record<string, readonly string[]> = {
  POSITION: ['VEC3'],
  NORMAL: ['VEC3'],
  TANGENT: ['VEC4'],
  TEXCOORD_0: ['VEC2'],
  TEXCOORD_1: ['VEC2'],
  WEIGHTS_0: ['VEC4'],
};
const targetTypes: Record<string, readonly string[]> = {
  POSITION: ['VEC3'],
  NORMAL: ['VEC3'],
  TANGENT: ['VEC3'],
};
/**
 * Vertex attribute accessors LayaAir would read wrongly: integers, normalized or
 * not (`KHR_mesh_quantization`, or core glTF's normalized texture coordinates
 * and weights). LayaAir copies them into a float vertex buffer unscaled.
 */
export function quantizedZhudaGltfAccessors(document: unknown): number[] {
  const accessors = list(record(document).accessors),
    found = new Set<number>();
  const take = (value: unknown, types: readonly string[] | undefined, where: string) => {
    const index = indexOf(value);
    if (index === null || !types) return;
    const a = record(accessors[index]);
    if (a.componentType === 5126) return;
    if (!components[a.componentType as number] || !types.includes(String(a.type)))
      throw Error(`${where}: accessors[${index}] has a layout no vertex attribute may have`);
    found.add(index);
  };
  list(record(document).meshes).forEach((mesh, m) =>
    list(record(mesh).primitives).forEach((primitive, p) => {
      const where = `meshes[${m}].primitives[${p}]`;
      for (const [name, value] of Object.entries(record(record(primitive).attributes)))
        take(value, attributeTypes[name], `${where}.attributes.${name}`);
      list(record(primitive).targets).forEach((target, t) => {
        for (const [name, value] of Object.entries(record(target)))
          take(value, targetTypes[name], `${where}.targets[${t}].${name}`);
      });
    }),
  );
  return [...found].sort((a, b) => a - b);
}
export interface ZhudaDequantizeResult {
  /** A GLB: the source data in one buffer, then the float copies. */
  readonly bytes: Uint8Array;
  /** Accessors turned into floats. */
  readonly accessors: number;
  /** Bytes of float data added. */
  readonly floatBytes: number;
}
const align4 = (n: number) => Math.ceil(n / 4) * 4;
/**
 * Turns quantized vertex attributes into 32-bit floats before LayaAir parses
 * the file (see `quantizedZhudaGltfAccessors`). Node transforms are kept: they
 * still carry `KHR_mesh_quantization`'s scale and offset. Needs embedded
 * buffers. Returns null when nothing needs it. GPU memory becomes that of an
 * unquantized export; the quantized source bytes stay in the file unread.
 */
export function dequantizeZhudaGltf(
  input: ArrayBuffer | Uint8Array,
  options: { maxOutputBytes?: number } = {},
): ZhudaDequantizeResult | null {
  const limit = options.maxOutputBytes ?? 256 * 1024 * 1024;
  if (!Number.isSafeInteger(limit) || limit <= 0) throw Error('Invalid dequantize output limit');
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const { document, bin } = readZhudaGltfBytes(bytes);
  const targets = quantizedZhudaGltfAccessors(document);
  if (!targets.length) return null;
  const accessors = list(document.accessors).map(record),
    views = list(document.bufferViews).map(record),
    sources = list(document.buffers).map(record);
  // Every buffer a view uses, laid end to end in the one GLB buffer.
  const data = new Map<number, Uint8Array>(),
    starts = new Map<number, number>();
  let length = 0;
  views.forEach((view, v) => {
    const i = indexOf(view.buffer);
    if (i === null || !sources[i]) throw Error(`bufferViews[${v}] names no buffer`);
    if (data.has(i)) return;
    const source = sources[i],
      declared = indexOf(source.byteLength);
    if (declared === null) throw Error(`buffers[${i}] has no byteLength`);
    let bytesOf: Uint8Array;
    if (source.uri === undefined && i === 0 && bin) bytesOf = bin;
    else if (
      typeof source.uri === 'string' &&
      /^data:(application\/(octet-stream|gltf-buffer))?;base64,/.test(source.uri)
    ) {
      const encoded = source.uri.slice(source.uri.indexOf(',') + 1);
      if (Math.floor((encoded.length * 3) / 4) > limit) throw Error('Oversized embedded buffer');
      bytesOf = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
    } else throw Error(`Dequantizing needs embedded buffers; buffers[${i}] has no bytes here`);
    if (bytesOf.byteLength < declared) throw Error(`buffers[${i}] is shorter than its byteLength`);
    data.set(i, bytesOf.subarray(0, declared));
    starts.set(i, length);
    length = align4(length + declared);
  });
  /** A buffer view's bytes, bounds-checked. */
  const viewOf = (value: unknown) => {
    const index = indexOf(value),
      view = index === null ? undefined : views[index];
    if (!view) throw Error(`bufferViews[${String(value)}] is missing`);
    const source = data.get(indexOf(view.buffer)!)!,
      offset = indexOf(view.byteOffset ?? 0),
      size = indexOf(view.byteLength);
    if (offset === null || size === null || offset + size > source.byteLength)
      throw Error(`bufferViews[${index}] lies outside its buffer`);
    return {
      bytes: new DataView(source.buffer, source.byteOffset + offset, size),
      offset,
      stride: indexOf(view.byteStride),
    };
  };
  const floats = new Map<number, Float32Array>();
  let floatBytes = 0;
  for (const index of targets) {
    const a = accessors[index];
    const c = components[a.componentType as number],
      n = counts[String(a.type)],
      count = indexOf(a.count),
      element = c.size * n;
    if (count === null || count < 1) throw Error(`accessors[${index}] has no count`);
    floatBytes += count * n * 4;
    if (floatBytes + length > limit) throw Error('Dequantized output budget exceeded');
    const out = new Float32Array(count * n);
    const value = (view: DataView, at: number) => {
      const raw = (view as any)[c.read](at, true) as number;
      return a.normalized === true ? Math.max(raw / c.max, -1) : raw;
    };
    if (a.bufferView !== undefined) {
      const start = indexOf(a.byteOffset ?? 0),
        { bytes: view, offset, stride } = viewOf(a.bufferView),
        step = stride ?? element;
      if (start === null || (offset + start) % c.size || step < element || step % c.size)
        throw Error(`accessors[${index}] is misaligned or has an invalid stride`);
      if (start + step * (count - 1) + element > view.byteLength)
        throw Error(`accessors[${index}] reads past its buffer view`);
      for (let i = 0; i < count; i++)
        for (let k = 0; k < n; k++) out[i * n + k] = value(view, start + i * step + k * c.size);
    }
    if (a.sparse !== undefined) {
      const sparse = record(a.sparse),
        many = indexOf(sparse.count),
        ids = record(sparse.indices),
        values = record(sparse.values);
      const idSize = ({ 5121: 1, 5123: 2, 5125: 4 } as Record<number, number>)[
        ids.componentType as number
      ];
      const idStart = indexOf(ids.byteOffset ?? 0),
        valueStart = indexOf(values.byteOffset ?? 0);
      if (!many || many > count || !idSize || idStart === null || valueStart === null)
        throw Error(`accessors[${index}].sparse is invalid`);
      const idView = viewOf(ids.bufferView).bytes,
        valueView = viewOf(values.bufferView).bytes;
      if (idStart + many * idSize > idView.byteLength)
        throw Error(`accessors[${index}].sparse indices read past their view`);
      if (valueStart + many * element > valueView.byteLength)
        throw Error(`accessors[${index}].sparse values read past their view`);
      let previous = -1;
      for (let s = 0; s < many; s++) {
        const at = idStart + s * idSize;
        const target =
          idSize === 1
            ? idView.getUint8(at)
            : idSize === 2
              ? idView.getUint16(at, true)
              : idView.getUint32(at, true);
        if (target <= previous || target >= count)
          throw Error(`accessors[${index}].sparse indices must rise inside the accessor`);
        previous = target;
        for (let k = 0; k < n; k++)
          out[target * n + k] = value(valueView, valueStart + s * element + k * c.size);
      }
    }
    floats.set(index, out);
  }
  // Lay out: the sources (their views re-pointed to buffer 0), then one view per float copy.
  for (const view of views) {
    view.byteOffset = starts.get(indexOf(view.buffer)!)! + (indexOf(view.byteOffset ?? 0) ?? 0);
    view.buffer = 0;
  }
  const output = new Uint8Array(length + floatBytes);
  for (const [buffer, bytesOf] of data) output.set(bytesOf, starts.get(buffer)!);
  let cursor = length;
  for (const [index, values] of floats) {
    const a = accessors[index],
      n = counts[String(a.type)];
    output.set(new Uint8Array(values.buffer), cursor);
    views.push({ buffer: 0, byteOffset: cursor, byteLength: values.byteLength });
    cursor += values.byteLength;
    a.bufferView = views.length - 1;
    a.componentType = 5126;
    delete a.byteOffset;
    delete a.normalized;
    delete a.sparse;
    // LayaAir takes a mesh's bounds from POSITION's min and max: give the float ones.
    const min = Array<number>(n).fill(Infinity),
      max = Array<number>(n).fill(-Infinity);
    for (let i = 0; i < values.length; i++) {
      min[i % n] = Math.min(min[i % n], values[i]);
      max[i % n] = Math.max(max[i % n], values[i]);
    }
    a.min = min;
    a.max = max;
  }
  document.accessors = accessors;
  document.bufferViews = views;
  document.buffers = [{ byteLength: output.byteLength }];
  for (const key of ['extensionsUsed', 'extensionsRequired']) {
    const names = list(document[key]).filter((x) => x !== 'KHR_mesh_quantization');
    if (names.length) document[key] = names;
    else delete document[key];
  }
  const glb = writeZhudaGlb(document, output);
  if (glb.byteLength > limit) throw Error('Dequantized output budget exceeded');
  return { bytes: glb, accessors: floats.size, floatBytes };
}

// ------------------------------------------------------------------- GLB ---

/** A glTF JSON or GLB file's document and, for a GLB, its binary chunk. */
export function readZhudaGltfBytes(bytes: Uint8Array): { document: Json; bin?: Uint8Array } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || view.getUint32(0, true) !== 0x46546c67)
    return { document: record(JSON.parse(new TextDecoder().decode(bytes))) };
  if (view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength)
    throw Error('Invalid GLB header');
  let offset = 12,
    document: Json | undefined,
    bin: Uint8Array | undefined;
  for (let chunk = 0; offset < bytes.byteLength; chunk++) {
    if (offset + 8 > bytes.byteLength) throw Error('Truncated GLB chunk');
    const size = view.getUint32(offset, true),
      kind = view.getUint32(offset + 4, true);
    if (size % 4 || offset + 8 + size > bytes.byteLength) throw Error('Invalid GLB chunk length');
    const data = bytes.subarray(offset + 8, offset + 8 + size);
    if (chunk === 0) {
      if (kind !== 0x4e4f534a) throw Error('GLB JSON must be first');
      document = record(JSON.parse(new TextDecoder().decode(data)));
    } else if (chunk === 1 && kind === 0x004e4942) bin = data;
    else throw Error('Unsupported GLB chunk');
    offset += 8 + size;
  }
  if (!document) throw Error('GLB has no JSON chunk');
  return { document, bin };
}
/** A GLB of a document and its one binary buffer. */
export function writeZhudaGlb(document: unknown, bin: Uint8Array): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(document)),
    jsonLength = align4(json.byteLength),
    binLength = align4(bin.byteLength);
  const total = 28 + jsonLength + binLength;
  if (total > 0xffffffff) throw Error('GLB too large');
  const glb = new Uint8Array(total),
    header = new DataView(glb.buffer);
  header.setUint32(0, 0x46546c67, true);
  header.setUint32(4, 2, true);
  header.setUint32(8, total, true);
  header.setUint32(12, jsonLength, true);
  header.setUint32(16, 0x4e4f534a, true);
  glb.fill(32, 20, 20 + jsonLength);
  glb.set(json, 20);
  header.setUint32(20 + jsonLength, binLength, true);
  header.setUint32(24 + jsonLength, 0x004e4942, true);
  glb.set(bin, 28 + jsonLength);
  return glb;
}
