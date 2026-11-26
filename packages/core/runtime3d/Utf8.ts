// Text in and out of bytes on every host. WeChat's mini-game runtime on iOS has neither
// `TextDecoder` nor `TextEncoder`; a GLB's JSON chunk, a manifest and a prefab library are read
// and written through these two, which use the host's own where it has them.
/**
 * UTF-8 to text. A host without `TextDecoder` (WeChat's mini-game runtime on iOS) gets the same
 * answer from the loop below: a GLB's JSON chunk is read on every host.
 */
export function zhudaUtf8Decode(
  bytes: Uint8Array,
  host: { TextDecoder?: unknown } = globalThis as any,
): string {
  const Decoder = host?.TextDecoder as (new () => { decode(data: Uint8Array): string }) | undefined;
  if (typeof Decoder === 'function') return new Decoder().decode(bytes);
  // The decoder of the Encoding Standard, so that bad bytes come out as the host's would.
  let out = '',
    run: number[] = [];
  const emit = (code: number) => {
    if (code > 0xffff)
      run.push(0xd800 + ((code - 0x10000) >> 10), 0xdc00 + ((code - 0x10000) & 0x3ff));
    else run.push(code);
    if (run.length > 8000) ((out += String.fromCharCode(...run)), (run = []));
  };
  let code = 0,
    needed = 0,
    seen = 0,
    lower = 0x80,
    upper = 0xbf;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (needed === 0) {
      if (b <= 0x7f) emit(b);
      else if (b >= 0xc2 && b <= 0xdf) ((needed = 1), (code = b & 0x1f));
      else if (b >= 0xe0 && b <= 0xef) {
        if (b === 0xe0) lower = 0xa0;
        if (b === 0xed) upper = 0x9f;
        ((needed = 2), (code = b & 0x0f));
      } else if (b >= 0xf0 && b <= 0xf4) {
        if (b === 0xf0) lower = 0x90;
        if (b === 0xf4) upper = 0x8f;
        ((needed = 3), (code = b & 0x07));
      } else emit(0xfffd);
      continue;
    }
    if (b < lower || b > upper) {
      ((code = needed = seen = 0), (lower = 0x80), (upper = 0xbf));
      emit(0xfffd);
      i--; // this byte starts again as a first byte
      continue;
    }
    ((lower = 0x80), (upper = 0xbf), (code = (code << 6) | (b & 0x3f)));
    if (++seen === needed) (emit(code), (code = needed = seen = 0));
  }
  if (needed !== 0) emit(0xfffd);
  if (run.length) out += String.fromCharCode(...run);
  // A byte order mark is not part of the text (`TextDecoder` drops it too).
  return out.charCodeAt(0) === 0xfeff ? out.slice(1) : out;
}
/** Text to UTF-8, with the same fallback for a host without `TextEncoder`. */
export function zhudaUtf8Encode(
  text: string,
  host: { TextEncoder?: unknown } = globalThis as any,
): Uint8Array {
  const Encoder = host?.TextEncoder as (new () => { encode(text: string): Uint8Array }) | undefined;
  if (typeof Encoder === 'function') return new Encoder().encode(text);
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c < 0xdc00 && i + 1 < text.length) {
      const low = text.charCodeAt(i + 1);
      if (low >= 0xdc00 && low < 0xe000)
        ((c = 0x10000 + ((c - 0xd800) << 10) + (low - 0xdc00)), i++);
    }
    // A lone surrogate becomes U+FFFD, as `TextEncoder` writes it.
    if (c >= 0xd800 && c < 0xe000) c = 0xfffd;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      out.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f),
      );
  }
  return Uint8Array.from(out);
}
