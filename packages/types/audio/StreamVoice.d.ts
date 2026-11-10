// Generated from TypeScript source; run npm run types:generate.
import type { IframeBackendVoice, IframeStreamOptions } from '../zhuda-audio';
import type { AssetStreamLease } from '../runtime3d/AssetProvider';
/** One media element, routed exclusively through the owning adapter's graph. */
export declare class StreamVoice implements IframeBackendVoice {
    readonly output: MediaElementAudioSourceNode;
    onended: (() => void) | null;
    private alarm?;
    private deadline?;
    private generation;
    private ended;
    private paused;
    private started;
    private reportedStart;
    private readonly endedListener;
    private readonly errorListener;
    private readonly context;
    private readonly media;
    private readonly timeoutMs;
    private readonly onFailure;
    private readonly onStarted;
    constructor(context: AudioContext, media: HTMLAudioElement, lease: AssetStreamLease, options: Readonly<IframeStreamOptions>, timeoutMs: number, onFailure: (error: unknown) => void, onStarted: () => void);
    start(_when: number, offsetSec: number): void;
    private play;
    setPaused(paused: boolean): void;
    stop(when?: number): void;
    private fail;
    private end;
    private releaseMedia;
    disconnect(): void;
}
