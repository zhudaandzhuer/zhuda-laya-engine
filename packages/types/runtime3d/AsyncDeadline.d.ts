// Generated from TypeScript source; run npm run types:generate.
/** IO deadline only; never a gameplay time source. Releases non-cooperative late results. */
export declare function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, options: {
    signal?: AbortSignal;
    timeoutMs?: number;
}, discard?: (value: T) => void): Promise<T>;
