// Generated from TypeScript source; run npm run types:generate.
/** Internal deadline boundary. Timers bound IO; they never drive simulation. */
export declare function awaitAbortable<T>(work: Promise<T>, signal: AbortSignal, discard?: (value: T) => void): Promise<T>;
