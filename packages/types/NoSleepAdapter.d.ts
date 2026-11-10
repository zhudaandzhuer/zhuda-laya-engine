// Generated from TypeScript source; run npm run types:generate.
/**
 * @zhuda-laya/core — built-in NoSleep-compatible screen wake lock.
 *
 * Uses the browser Screen Wake Lock API without bundling FairyGUI or a second
 * UI/runtime dependency. Consumers explicitly enable it from a user gesture;
 * this adapter owns re-acquisition, stale request rejection and cleanup.
 */
import type { NoSleepAdapterOptions, NoSleepDiagnostics } from './index.js';
export declare class NoSleepAdapter {
    private readonly options;
    private readonly cleanupFns;
    private readonly gestureCleanupFns;
    private state;
    private desiredEnabled;
    private pageVisible;
    private windowFocused;
    private sentinel;
    private sentinelReleaseCleanup;
    private pendingRequest;
    private requestGeneration;
    private requestCount;
    private releaseCount;
    private staleRequestCount;
    private lastError;
    private disposed;
    constructor(options?: NoSleepAdapterOptions);
    private addEventListener;
    private removeGestureGuards;
    private installGestureGuards;
    private installLifecycleGuards;
    private getProvider;
    private isSupported;
    private recordError;
    private canRequest;
    private releaseCandidate;
    private detachSentinel;
    private releaseSentinel;
    private attachSentinel;
    private requestLock;
    private handleLifecycleChange;
    /** Enable the native screen wake lock. Call from a user gesture when possible. */
    enable(): Promise<boolean>;
    /** Disable and release the current sentinel; release failures are diagnosed. */
    disable(): void;
    isEnabled(): boolean;
    getDiagnostics(): NoSleepDiagnostics;
    /** Remove listeners and release all owned wake-lock resources. */
    dispose(): void;
}
