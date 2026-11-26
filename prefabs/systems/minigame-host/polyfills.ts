// systems/minigame-host/polyfills: what the engine needs and WeChat's mini-game runtime on iOS does
// not have. Import it for its effect, before the engine: `import './common/systems/minigame-host/polyfills.ts'`.
// Each piece is installed only when the host lacks it.
// From the workspace game zhuda-raft-survival (`src/polyfills.ts`, 2026-11-19), unchanged apart
// from this header.
//
// WeChat mini game (iOS) has no TextDecoder; the engine's GLB parser needs it to read the JSON
// chunk. Minimal UTF-8 decoder, installed only when the host lacks one.
type Bytes = ArrayBuffer | ArrayBufferView;

class Utf8Decoder {
  readonly encoding = 'utf-8';
  decode(input?: Bytes): string {
    if (!input) return '';
    const b = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
    let out = '';
    let chunk: number[] = [];
    const flush = () => {
      out += String.fromCharCode.apply(null, chunk);
      chunk = [];
    };
    let i = 0;
    if (b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf) i = 3; // BOM
    while (i < b.length) {
      const c = b[i++]!;
      let cp: number;
      if (c < 0x80) cp = c;
      else if (c < 0xe0) cp = ((c & 0x1f) << 6) | (b[i++]! & 0x3f);
      else if (c < 0xf0) cp = ((c & 0x0f) << 12) | ((b[i++]! & 0x3f) << 6) | (b[i++]! & 0x3f);
      else cp = ((c & 0x07) << 18) | ((b[i++]! & 0x3f) << 12) | ((b[i++]! & 0x3f) << 6) | (b[i++]! & 0x3f);
      if (cp > 0xffff) {
        cp -= 0x10000;
        chunk.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
      } else chunk.push(cp);
      if (chunk.length > 8000) flush();
    }
    flush();
    return out;
  }
}

const g = globalThis as { TextDecoder?: unknown };
if (typeof g.TextDecoder !== 'function') g.TextDecoder = Utf8Decoder;

// WeChat iOS also lacks structuredClone; the engine uses it to copy plain option objects
// (scene look, water, light fog). Deep copy of plain data, typed arrays, Map, Set and Date.
function cloneDeep(v: unknown, seen = new Map<unknown, unknown>()): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v);
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof ArrayBuffer) return v.slice(0);
  if (ArrayBuffer.isView(v)) {
    const t = v as unknown as { slice(): unknown };
    return typeof t.slice === 'function' ? t.slice() : v;
  }
  if (v instanceof Map) {
    const m = new Map();
    seen.set(v, m);
    v.forEach((val, key) => m.set(cloneDeep(key, seen), cloneDeep(val, seen)));
    return m;
  }
  if (v instanceof Set) {
    const st = new Set();
    seen.set(v, st);
    v.forEach((val) => st.add(cloneDeep(val, seen)));
    return st;
  }
  const out: Record<string, unknown> | unknown[] = Array.isArray(v) ? [] : {};
  seen.set(v, out);
  for (const k of Object.keys(v)) (out as Record<string, unknown>)[k] = cloneDeep((v as Record<string, unknown>)[k], seen);
  return out;
}
const gc = globalThis as { structuredClone?: unknown };
if (typeof gc.structuredClone !== 'function') gc.structuredClone = (v: unknown) => cloneDeep(v);
export {};
