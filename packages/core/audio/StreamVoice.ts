import type { IframeBackendVoice, IframeStreamOptions } from '../../types/zhuda-audio.ts';
import type { AssetStreamLease } from '../runtime3d/AssetProvider.ts';

/** One media element, routed exclusively through the owning adapter's graph. */
export class StreamVoice implements IframeBackendVoice {
  readonly output: MediaElementAudioSourceNode;
  onended: (() => void) | null = null;
  private alarm?: AudioBufferSourceNode;
  private deadline?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private ended = false;
  private paused = false;
  private started = false;
  private reportedStart = false;
  private readonly endedListener = () => this.end();
  private readonly errorListener = () =>
    this.fail(
      Error(
        `Media playback failed: ${this.media.error?.message || this.media.error?.code || 'unknown'}`,
      ),
    );
  private readonly context: AudioContext;
  private readonly media: HTMLAudioElement;
  private readonly timeoutMs: number;
  private readonly onFailure: (error: unknown) => void;
  private readonly onStarted: () => void;
  constructor(
    context: AudioContext,
    media: HTMLAudioElement,
    lease: AssetStreamLease,
    options: Readonly<IframeStreamOptions>,
    timeoutMs: number,
    onFailure: (error: unknown) => void,
    onStarted: () => void,
  ) {
    this.context = context;
    this.media = media;
    this.timeoutMs = timeoutMs;
    this.onFailure = onFailure;
    this.onStarted = onStarted;
    media.crossOrigin = lease.crossOrigin ?? 'anonymous';
    media.preload = 'metadata';
    media.loop = options.loop ?? false;
    media.volume = 1;
    media.muted = false;
    media.addEventListener('ended', this.endedListener);
    media.addEventListener('error', this.errorListener);
    try {
      media.src = lease.url;
      this.output = context.createMediaElementSource(media);
    } catch (error) {
      this.releaseMedia();
      throw error;
    }
  }
  start(_when: number, offsetSec: number): void {
    if (this.ended) throw Error('Stream voice ended');
    this.media.currentTime = offsetSec;
    this.started = true;
    this.play();
  }
  private play(): void {
    if (this.ended || this.paused || !this.started) return;
    const generation = ++this.generation;
    clearTimeout(this.deadline);
    this.deadline = setTimeout(() => this.fail(Error('Stream playback timeout')), this.timeoutMs);
    try {
      Promise.resolve(this.media.play()).then(
        () => {
          if (generation !== this.generation || this.ended || this.paused) return;
          clearTimeout(this.deadline);
          if (!this.reportedStart) {
            this.reportedStart = true;
            this.onStarted();
          }
        },
        (error) => {
          if (generation === this.generation && !this.ended) this.fail(error);
        },
      );
    } catch (error) {
      this.fail(error);
    }
  }
  setPaused(paused: boolean): void {
    if (this.ended || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.generation++;
      clearTimeout(this.deadline);
      this.media.pause();
    } else this.play();
  }
  stop(when = this.context.currentTime): void {
    if (this.alarm) {
      this.alarm.onended = null;
      try {
        this.alarm.stop();
      } catch {
        /* ended */
      }
      this.alarm.disconnect();
    }
    this.alarm = undefined;
    if (when <= this.context.currentTime) {
      this.end();
      return;
    }
    // An audio-clock completion marker pauses with the same context as fades.
    const alarm = (this.alarm = this.context.createBufferSource());
    alarm.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
    alarm.onended = () => {
      if (this.alarm === alarm) this.end();
    };
    alarm.start(when);
  }
  private fail(error: unknown): void {
    if (this.ended) return;
    try {
      this.onFailure(error);
    } finally {
      this.end();
    }
  }
  private end(): void {
    if (this.ended) return;
    this.ended = true;
    this.generation++;
    clearTimeout(this.deadline);
    this.media.pause();
    this.onended?.();
  }
  private releaseMedia(): void {
    this.media.removeEventListener('ended', this.endedListener);
    this.media.removeEventListener('error', this.errorListener);
    this.media.pause();
    this.media.removeAttribute('src');
    this.media.load();
  }
  disconnect(): void {
    this.ended = true;
    this.generation++;
    clearTimeout(this.deadline);
    if (this.alarm) {
      this.alarm.onended = null;
      try {
        this.alarm.stop();
      } catch {
        /* marker already ended */
      }
      this.alarm.disconnect();
      this.alarm = undefined;
    }
    this.onended = null;
    try {
      this.output.disconnect();
    } finally {
      this.releaseMedia();
    }
  }
}
