/**
 * @zhuda-laya/core — built-in NoSleep-compatible screen wake lock.
 *
 * Uses the browser Screen Wake Lock API without bundling FairyGUI or a second
 * UI/runtime dependency. Consumers explicitly enable it from a user gesture;
 * this adapter owns re-acquisition, stale request rejection and cleanup.
 */

import type {
  NoSleepAdapterOptions,
  NoSleepDiagnostics,
  NoSleepState,
  NoSleepWakeLockProvider,
  NoSleepWakeLockSentinel,
} from '../types/index.ts';

type Cleanup = () => void;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class NoSleepAdapter {
  private readonly options: Required<
    Pick<NoSleepAdapterOptions, 'autoEnableOnGesture' | 'releaseOnBlur'>
  > &
    NoSleepAdapterOptions;
  private readonly cleanupFns: Cleanup[] = [];
  private readonly gestureCleanupFns: Cleanup[] = [];

  private state: NoSleepState = 'disabled';
  private desiredEnabled = false;
  private pageVisible = true;
  private windowFocused = true;
  private sentinel: NoSleepWakeLockSentinel | null = null;
  private sentinelReleaseCleanup: Cleanup | null = null;
  private pendingRequest: Promise<boolean> | null = null;
  private requestGeneration = 0;
  private requestCount = 0;
  private releaseCount = 0;
  private staleRequestCount = 0;
  private lastError: string | null = null;
  private disposed = false;

  constructor(options: NoSleepAdapterOptions = {}) {
    this.options = {
      ...options,
      autoEnableOnGesture: options.autoEnableOnGesture ?? true,
      releaseOnBlur: options.releaseOnBlur ?? true,
    };
    this.pageVisible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
    this.installLifecycleGuards();
    if (this.options.autoEnableOnGesture) this.installGestureGuards();
  }

  private addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    gesture = false,
  ): void {
    target.addEventListener(type, listener, options);
    const cleanup = () => target.removeEventListener(type, listener, options);
    this.cleanupFns.push(cleanup);
    if (gesture) this.gestureCleanupFns.push(cleanup);
  }

  private removeGestureGuards(): void {
    for (const cleanup of this.gestureCleanupFns.splice(0)) {
      cleanup();
      const index = this.cleanupFns.indexOf(cleanup);
      if (index >= 0) this.cleanupFns.splice(index, 1);
    }
  }

  private installGestureGuards(): void {
    if (typeof window === 'undefined') return;
    const events = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
    const onGesture: EventListener = () => {
      void this.enable().then((enabled) => {
        if (enabled) this.removeGestureGuards();
      });
    };
    for (const type of events) {
      this.addEventListener(window, type, onGesture, { capture: true, passive: true }, true);
    }
  }

  private installLifecycleGuards(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.addEventListener(document, 'visibilitychange', () => {
      const visible = document.visibilityState !== 'hidden';
      this.handleLifecycleChange(visible, this.windowFocused);
    });
    this.addEventListener(window, 'blur', () => {
      this.handleLifecycleChange(this.pageVisible, false);
    });
    this.addEventListener(window, 'focus', () => {
      this.handleLifecycleChange(this.pageVisible, true);
    });
    this.addEventListener(window, 'pagehide', () => {
      this.handleLifecycleChange(false, false);
    });
    this.addEventListener(window, 'pageshow', () => {
      this.handleLifecycleChange(true, true);
    });
  }

  private getProvider(): NoSleepWakeLockProvider | null {
    if (this.options.wakeLockProvider) {
      try {
        return this.options.wakeLockProvider();
      } catch (error) {
        this.lastError = errorMessage(error);
        return null;
      }
    }
    const root = globalThis as typeof globalThis & {
      navigator?: { wakeLock?: NoSleepWakeLockProvider };
    };
    return root.navigator?.wakeLock ?? null;
  }

  private isSupported(): boolean {
    return this.getProvider() !== null;
  }

  private recordError(error: unknown): void {
    this.lastError = errorMessage(error);
  }

  private canRequest(): boolean {
    return !this.disposed && this.desiredEnabled && this.pageVisible && this.windowFocused;
  }

  private releaseCandidate(candidate: NoSleepWakeLockSentinel): void {
    this.releaseCount++;
    try {
      Promise.resolve(candidate.release()).catch((error) => this.recordError(error));
    } catch (error) {
      this.recordError(error);
    }
  }

  private detachSentinel(candidate: NoSleepWakeLockSentinel): void {
    if (this.sentinel !== candidate) return;
    this.sentinel = null;
    this.sentinelReleaseCleanup?.();
    this.sentinelReleaseCleanup = null;
  }

  private releaseSentinel(keepDesired: boolean): void {
    this.requestGeneration++;
    const candidate = this.sentinel;
    if (candidate) {
      this.detachSentinel(candidate);
      this.releaseCandidate(candidate);
    }
    if (this.disposed) return;
    this.state = keepDesired && this.desiredEnabled ? 'suspended' : 'disabled';
  }

  private attachSentinel(candidate: NoSleepWakeLockSentinel, generation: number): boolean {
    if (!candidate || typeof candidate.release !== 'function') {
      this.state = 'error';
      this.lastError = 'Wake Lock provider returned an invalid sentinel';
      return false;
    }
    if (candidate.released === true) {
      this.staleRequestCount++;
      this.releaseCandidate(candidate);
      this.state = 'suspended';
      return false;
    }
    if (!this.canRequest() || generation !== this.requestGeneration) {
      this.staleRequestCount++;
      this.releaseCandidate(candidate);
      return false;
    }

    this.sentinel = candidate;
    const onRelease: EventListener = () => {
      if (this.sentinel !== candidate) return;
      this.detachSentinel(candidate);
      this.releaseCount++;
      if (this.disposed) return;
      this.state = this.desiredEnabled ? 'suspended' : 'disabled';
      if (this.canRequest()) void this.requestLock();
    };
    candidate.addEventListener?.('release', onRelease);
    this.sentinelReleaseCleanup = () => candidate.removeEventListener?.('release', onRelease);
    this.state = 'enabled';
    this.lastError = null;
    return true;
  }

  private requestLock(): Promise<boolean> {
    if (!this.canRequest()) return Promise.resolve(false);
    if (this.sentinel && this.sentinel.released !== true) {
      this.state = 'enabled';
      return Promise.resolve(true);
    }
    if (this.pendingRequest) return this.pendingRequest;

    const provider = this.getProvider();
    if (!provider) {
      this.state = 'unsupported';
      this.lastError = 'Screen Wake Lock API is unavailable';
      return Promise.resolve(false);
    }

    const generation = ++this.requestGeneration;
    this.requestCount++;
    this.state = 'requesting';
    let request: Promise<boolean>;
    try {
      request = Promise.resolve(provider.request('screen')).then(
        (candidate) => this.attachSentinel(candidate, generation),
        (error) => {
          if (generation === this.requestGeneration && !this.disposed) {
            this.state = error?.name === 'NotAllowedError' ? 'denied' : 'error';
            this.recordError(error);
          }
          return false;
        },
      );
    } catch (error) {
      this.state = 'error';
      this.recordError(error);
      return Promise.resolve(false);
    }
    this.pendingRequest = request;
    void request
      .finally(() => {
        if (this.pendingRequest === request) this.pendingRequest = null;
      })
      .catch((error) => this.recordError(error));
    return request;
  }

  private handleLifecycleChange(visible: boolean, focused: boolean): void {
    if (this.disposed) return;
    this.pageVisible = Boolean(visible);
    this.windowFocused = Boolean(focused);
    if (!this.pageVisible || (!this.windowFocused && this.options.releaseOnBlur)) {
      this.releaseSentinel(true);
      return;
    }
    if (this.desiredEnabled) void this.requestLock();
  }

  /** Enable the native screen wake lock. Call from a user gesture when possible. */
  public enable(): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false);
    this.desiredEnabled = true;
    if (!this.pageVisible || (!this.windowFocused && this.options.releaseOnBlur)) {
      this.state = 'suspended';
      return Promise.resolve(false);
    }
    return this.requestLock();
  }

  /** Disable and release the current sentinel; release failures are diagnosed. */
  public disable(): void {
    if (this.disposed) return;
    this.desiredEnabled = false;
    this.removeGestureGuards();
    this.releaseSentinel(false);
  }

  public isEnabled(): boolean {
    return !this.disposed && this.state === 'enabled' && this.sentinel !== null;
  }

  public getDiagnostics(): NoSleepDiagnostics {
    return {
      state: this.state,
      supported: this.isSupported(),
      desiredEnabled: this.desiredEnabled,
      pageVisible: this.pageVisible,
      windowFocused: this.windowFocused,
      requestCount: this.requestCount,
      releaseCount: this.releaseCount,
      staleRequestCount: this.staleRequestCount,
      lastError: this.lastError,
    };
  }

  /** Remove listeners and release all owned wake-lock resources. */
  public dispose(): void {
    if (this.disposed) return;
    this.desiredEnabled = false;
    this.requestGeneration++;
    this.releaseSentinel(false);
    this.disposed = true;
    this.state = 'disposed';
    for (const cleanup of this.cleanupFns.splice(0)) cleanup();
    this.gestureCleanupFns.splice(0);
  }
}
