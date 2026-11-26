// Generated from TypeScript source; run npm run types:generate.
/**
 * UTF-8 to text. A host without `TextDecoder` (WeChat's mini-game runtime on iOS) gets the same
 * answer from the loop below: a GLB's JSON chunk is read on every host.
 */
export declare function zhudaUtf8Decode(bytes: Uint8Array, host?: {
    TextDecoder?: unknown;
}): string;
/** Text to UTF-8, with the same fallback for a host without `TextEncoder`. */
export declare function zhudaUtf8Encode(text: string, host?: {
    TextEncoder?: unknown;
}): Uint8Array;
