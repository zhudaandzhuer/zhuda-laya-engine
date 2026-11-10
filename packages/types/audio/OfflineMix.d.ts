// Generated from TypeScript source; run npm run types:generate.
import type { IframeOfflineMixOptions, IframeOfflineMix } from '../zhuda-audio.js';
import type { IframeAudioChannel } from '../zhuda-2d-ui.js';
export interface OfflineMixSnapshot {
    samples: ReadonlyMap<string, AudioBuffer>;
    volumes: Readonly<Record<IframeAudioChannel, number>>;
    maxVoices: number;
}
/** Internal export graph. The calling mixer owns samples, policy and all gains. */
export declare function renderOfflineMix(snapshot: OfflineMixSnapshot, options: IframeOfflineMixOptions, signal: AbortSignal): Promise<IframeOfflineMix>;
