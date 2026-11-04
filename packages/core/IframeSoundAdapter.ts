/**
 * Single WebAudio authority for embedded games.
 *
 * The adapter owns context creation, the master/channel mixer, autoplay
 * unlocking, bridge security and every voice's lifetime. Consumers submit
 * logical events through scheduleTone; they must not create another
 * AudioContext for the same event.
 */

import type {
  AudioVoiceHandle,
  IframeAudioChannel,
  IframeSoundAdapterOptions,
  IframeSoundDiagnostics,
  IframeToneOptions,
  IframeSampleOptions,
  IframeSampleInfo
} from '../types/index.ts';

import { createProviderAssetCache, normalizeAssetId } from './runtime3d/AssetProvider.ts';
import type { AssetLease, ZhudaAssetCache } from './runtime3d/Assets.ts';

export interface QueuedAudioTask {
  sampleId?: string;
  id: string;
  channel: IframeAudioChannel;
  createdAt: number;
  execute: () => boolean;
}

type Cleanup = () => void;
type VoiceState = {
  logicalId: string;
  channel: IframeAudioChannel;
  source: AudioScheduledSourceNode;
  gain?: GainNode;
  sampleId?: string;
  stopping?: boolean;
  stopped: boolean;
};

const CHANNELS: readonly IframeAudioChannel[] = ['bgm', 'sfx', 'ui'];
const AUDIO_WAVE_TYPES: readonly OscillatorType[] = ['sine', 'square', 'sawtooth', 'triangle'];
const CONTEXT_STATES = new Set(['suspended', 'running', 'closed']);

function isAudioChannel(value: unknown): value is IframeAudioChannel {
  return value === 'master' || value === 'bgm' || value === 'sfx' || value === 'ui';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export class IframeSoundAdapter {
  private static instance: IframeSoundAdapter | null = null;

  private readonly options: Required<
    Pick<IframeSoundAdapterOptions, 'queueMaxAgeMs' | 'maxPendingQueue' | 'maxActiveVoices' | 'syncLayaSoundManager'>
  > & IframeSoundAdapterOptions;
  private readonly allowedParentOrigins: ReadonlySet<string>;
  private readonly now: () => number;
  private readonly cleanupFns: Cleanup[] = [];
  private readonly gestureCleanupFns: Cleanup[] = [];

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channelGains: Partial<Record<IframeAudioChannel, GainNode>> = {};

  private inIframe = false;
  private unlockedByGesture = false;
  private unlockGestureType = 'none';
  private pageVisible = true;
  private windowFocused = true;
  private autoSuspendedByBlur = false;
  private userMuted = false;
  private postMessageBridgeActive = false;
  private lastBridgeCommand = 'init';
  private lastError: string | null = null;
  private disposed = false;
  private unlockAttempt = 0;

  private volumes: Record<IframeAudioChannel, number> = {
    master: 0.85,
    bgm: 0.6,
    sfx: 0.9,
    ui: 0.85
  };

  private pendingQueue: QueuedAudioTask[] = [];
  private queuedBeforeUnlockCount = 0;
  private droppedQueue = 0;
  private activeVoices = new Map<string, VoiceState>();
  private droppedVoices = 0;
  private playedEventsCount = 0;
  private voiceSerial = 0;
  private sampleCache?: ZhudaAssetCache<AudioBuffer>;
  private readonly samples = new Map<string, AssetLease<AudioBuffer>>();
  private readonly sampleLoads = new Map<AbortController, string>();
  private readonly sampleTimeoutMs: number;
  private readonly maxSamples: number;
  private readonly maxDecodedSampleBytes: number;

  public static getShared(): IframeSoundAdapter {
    if (!this.instance || this.instance.disposed) {
      this.instance = new IframeSoundAdapter();
    }
    return this.instance;
  }

  constructor(options: IframeSoundAdapterOptions = {}) {
    this.options = {
      ...options,
      queueMaxAgeMs: options.queueMaxAgeMs ?? 500,
      maxPendingQueue: options.maxPendingQueue ?? 32,
      maxActiveVoices: options.maxActiveVoices ?? 32,
      syncLayaSoundManager: options.syncLayaSoundManager ?? false
    };
    this.sampleTimeoutMs = options.sampleTimeoutMs ?? 15_000;
    this.maxSamples = options.maxSamples ?? 32;
    this.maxDecodedSampleBytes = options.maxDecodedSampleBytes ?? 64 * 1024 * 1024;
    for (const [name, value] of Object.entries({sampleTimeoutMs:this.sampleTimeoutMs,maxSamples:this.maxSamples,maxDecodedSampleBytes:this.maxDecodedSampleBytes,
      maxActiveVoices:this.options.maxActiveVoices,maxPendingQueue:this.options.maxPendingQueue,queueMaxAgeMs:this.options.queueMaxAgeMs}))
      if (!Number.isSafeInteger(value) || value <= 0) throw Error(`Invalid audio limit: ${name}`);
    if (options.sampleProvider) this.sampleCache = createProviderAssetCache(options.sampleProvider, async (asset, signal) => {
      const context = this.ensureAudioContext();
      if (!context) throw Error('WebAudio decoder unavailable');
      if (signal.aborted) throw new DOMException('Sample decode cancelled', 'AbortError');
      let cancel: () => void = () => {};
      try {
        const decoded = await Promise.race([
          context.decodeAudioData(new Uint8Array(asset.bytes).buffer),
          new Promise<never>((_, reject) => {
            cancel = () => reject(new DOMException('Sample decode cancelled', 'AbortError'));
            signal.addEventListener('abort', cancel, { once: true });
            if (signal.aborted) cancel();
          }),
        ]);
        if (signal.aborted || this.disposed) throw new DOMException('Sample decode cancelled', 'AbortError');
        const bytes = decoded.length * decoded.numberOfChannels * 4;
        if (!Number.isSafeInteger(bytes) || bytes <= 0 || bytes > this.maxDecodedSampleBytes || !Number.isFinite(decoded.duration) || decoded.duration <= 0)
          throw Error('Decoded sample exceeds PCM bound or is empty');
        return decoded;
      } finally { signal.removeEventListener('abort', cancel); }
    }, () => {});
    this.allowedParentOrigins = new Set(
      (options.allowedParentOrigins ?? []).filter((origin): origin is string =>
        typeof origin === 'string' && origin.length > 0 && origin !== '*'
      )
    );
    this.now = options.now ?? (() => Date.now());

    this.detectIframeContext();
    this.installGestureUnlockGuards();
    this.installVisibilityAndFocusGuards();
    this.installPostMessageBridge();
    this.syncLayaSoundManager();
    this.syncDomTelemetry();
  }

  private recordError(error: unknown): void {
    this.lastError = error instanceof Error ? error.message : String(error);
  }

  private detectIframeContext(): void {
    if (typeof window === 'undefined') {
      this.inIframe = false;
      return;
    }
    try {
      this.inIframe = window.self !== window.top;
    } catch (_crossOriginErr) {
      this.inIframe = true;
    }
  }

  private defaultAudioContextFactory(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    return new AudioCtx();
  }

  private ensureAudioContext(recreateClosed = true): AudioContext | null {
    if (this.disposed) return null;
    if (this.ctx && this.ctx.state !== 'closed') return this.ctx;
    if (this.ctx?.state === 'closed') {
      this.recordError('AudioContext is closed');
      this.unlockedByGesture = false;
      for (const key of [...this.activeVoices.keys()]) this.finishVoice(key);
      this.ctx = null;
      this.masterGain = null;
      this.channelGains = {};
      // A new context must be resumed from a fresh user gesture. Callers that
      // are already inside playback must not recreate it behind the gesture.
      if (!recreateClosed) return null;
    }

    let context: AudioContext | null = null;
    try {
      context = this.options.audioContextFactory
        ? this.options.audioContextFactory()
        : this.defaultAudioContextFactory();
      if (!context) return null;
      this.ctx = context;
      this.masterGain = context.createGain();
      this.masterGain.gain.value = this.getEffectiveMasterVolume();
      this.masterGain.connect(context.destination);
      this.channelGains = {};
      for (const channel of CHANNELS) {
        const gain = context.createGain();
        gain.gain.value = this.volumes[channel];
        gain.connect(this.masterGain);
        this.channelGains[channel] = gain;
      }
      return context;
    } catch (error) {
      this.recordError(error);
      try {
        if (context && context.state !== 'closed') void context.close();
      } catch (_closeError) {
        // Keep the original construction error as the actionable diagnostic.
      }
      this.ctx = null;
      this.masterGain = null;
      this.channelGains = {};
      return null;
    }
  }

  private getEffectiveMasterVolume(): number {
    return this.userMuted || this.autoSuspendedByBlur ? 0 : this.volumes.master;
  }

  private setGainValue(node: GainNode, value: number): void {
    if (!this.ctx) return;
    try {
      node.gain.setValueAtTime(value, this.ctx.currentTime);
    } catch (_error) {
      node.gain.value = value;
    }
  }

  private updateGainNodes(): void {
    if (this.masterGain) this.setGainValue(this.masterGain, this.getEffectiveMasterVolume());
    for (const channel of CHANNELS) {
      const node = this.channelGains[channel];
      if (node) this.setGainValue(node, this.volumes[channel]);
    }
    this.syncLayaSoundManager();
    this.syncDomTelemetry();
  }

  /** Optional state mirroring for consumers that explicitly still use Laya SoundManager. */
  private syncLayaSoundManager(): void {
    if (!this.options.syncLayaSoundManager) return;
    const g = globalThis as unknown as {
      Laya?: {
        SoundManager?: {
          muted?: boolean;
          autoStopMusic?: boolean;
          setMusicVolume?: (volume: number) => void;
          setSoundVolume?: (volume: number) => void;
        };
      };
    };
    const soundManager = g.Laya?.SoundManager;
    if (!soundManager) return;
    soundManager.muted = this.userMuted || this.autoSuspendedByBlur;
    soundManager.autoStopMusic = true;
    soundManager.setMusicVolume?.(Number((this.volumes.master * this.volumes.bgm).toFixed(2)));
    soundManager.setSoundVolume?.(Number((this.volumes.master * this.volumes.sfx).toFixed(2)));
  }

  private addEventListener(
    target: EventTarget,
    type: string,
    listener: EventListener,
    options?: AddEventListenerOptions,
    gesture = false
  ): void {
    target.addEventListener(type, listener, options);
    const cleanup = () => target.removeEventListener(type, listener, options);
    this.cleanupFns.push(cleanup);
    if (gesture) this.gestureCleanupFns.push(cleanup);
  }

  private removeGestureUnlockGuards(): void {
    for (const cleanup of this.gestureCleanupFns.splice(0)) {
      cleanup();
      const index = this.cleanupFns.indexOf(cleanup);
      if (index >= 0) this.cleanupFns.splice(index, 1);
    }
  }

  private installGestureUnlockGuards(): void {
    if (typeof window === 'undefined') return;
    const events = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
    const onFirstGesture: EventListener = (event) => {
      this.unlockAudio(event.type || 'gesture');
      if (this.unlockedByGesture) this.removeGestureUnlockGuards();
    };
    for (const event of events) {
      this.addEventListener(window, event, onFirstGesture, { capture: true, passive: true }, true);
    }
  }

  private markUnlocked(gestureSource: string): void {
    this.unlockedByGesture = true;
    this.unlockGestureType = gestureSource;
    this.playSilentUnlockSample();
    this.flushPendingQueue();
    this.syncDomTelemetry();
  }

  private playSilentUnlockSample(): void {
    if (!this.ctx) return;
    try {
      const silentBuffer = this.ctx.createBuffer(1, 1, 22050);
      const source = this.ctx.createBufferSource();
      source.buffer = silentBuffer;
      source.onended = () => source.disconnect?.();
      source.connect(this.ctx.destination);
      source.start(0);
    } catch (error) {
      this.recordError(error);
    }
  }

  /** Unlocks only after a real context exists and resume succeeds or is already running. */
  public unlockAudio(gestureSource = 'programmatic-unlock'): boolean {
    if (this.disposed) return false;
    // Record the attempted source separately from unlockedByGesture. A headless
    // or blocked context may receive a gesture without becoming playable.
    this.unlockGestureType = gestureSource;
    const context = this.ensureAudioContext();
    if (!context) {
      this.recordError('WebAudio is unavailable');
      this.syncDomTelemetry();
      return false;
    }

    const attempt = ++this.unlockAttempt;
    if (context.state === 'running') {
      this.markUnlocked(gestureSource);
      return true;
    }
    if (context.state !== 'suspended' || typeof context.resume !== 'function') {
      this.recordError(`AudioContext cannot resume from ${context.state}`);
      this.syncDomTelemetry();
      return false;
    }

    try {
      const result = context.resume();
      Promise.resolve(result).then(
        () => {
          if (this.disposed || attempt !== this.unlockAttempt || this.ctx !== context) return;
          if (context.state === 'running') {
            this.markUnlocked(gestureSource);
            this.removeGestureUnlockGuards();
          } else {
            this.recordError(`AudioContext resume ended in ${context.state}`);
            this.unlockedByGesture = false;
            this.syncDomTelemetry();
          }
        },
        (error) => {
          if (this.disposed || attempt !== this.unlockAttempt) return;
          this.unlockedByGesture = false;
          this.recordError(error);
          this.syncDomTelemetry();
        }
      );
    } catch (error) {
      this.unlockedByGesture = false;
      this.recordError(error);
      this.syncDomTelemetry();
      return false;
    }
    this.syncDomTelemetry();
    return this.unlockedByGesture;
  }

  private flushPendingQueue(): void {
    if (!this.unlockedByGesture) return;
    if (this.userMuted || this.autoSuspendedByBlur) { this.pendingQueue = []; return; }
    const now = this.now();
    const tasks = this.pendingQueue.splice(0);
    for (const task of tasks) {
      if (now - task.createdAt > this.options.queueMaxAgeMs) {
        this.droppedQueue++;
        continue;
      }
      try {
        if (!task.execute()) this.droppedQueue++;
      } catch (error) {
        this.droppedQueue++;
        this.recordError(error);
      }
    }
    this.syncDomTelemetry();
  }

  private installVisibilityAndFocusGuards(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    this.addEventListener(document, 'visibilitychange', () => {
      this.handleFocusOrVisibilityChange(document.visibilityState !== 'hidden', this.windowFocused);
    });
    this.addEventListener(window, 'blur', () => {
      this.handleFocusOrVisibilityChange(this.pageVisible, false);
    });
    this.addEventListener(window, 'focus', () => {
      this.handleFocusOrVisibilityChange(true, true);
    });
    this.addEventListener(window, 'pagehide', () => {
      this.handleFocusOrVisibilityChange(false, false);
    });
    this.addEventListener(window, 'pageshow', () => {
      this.handleFocusOrVisibilityChange(true, true);
    });
  }

  public handleFocusOrVisibilityChange(visible: boolean, focused: boolean): void {
    if (this.disposed) return;
    this.pageVisible = Boolean(visible);
    this.windowFocused = Boolean(focused);
    this.autoSuspendedByBlur = !this.pageVisible || !this.windowFocused;

    if (this.ctx) {
      if (this.autoSuspendedByBlur && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
        try {
          Promise.resolve(this.ctx.suspend()).catch((error) => this.recordError(error));
        } catch (error) {
          this.recordError(error);
        }
      } else if (
        !this.autoSuspendedByBlur &&
        !this.userMuted &&
        this.unlockedByGesture &&
        this.ctx.state === 'suspended' &&
        typeof this.ctx.resume === 'function'
      ) {
        try {
          Promise.resolve(this.ctx.resume()).catch((error) => this.recordError(error));
        } catch (error) {
          this.recordError(error);
        }
      }
    }
    this.updateGainNodes();
  }

  private isAllowedBridgeOrigin(origin: string): boolean {
    if (!origin || origin === 'null') return false;
    if (this.allowedParentOrigins.size > 0) return this.allowedParentOrigins.has(origin);
    if (typeof window === 'undefined' || !window.location) return false;
    return origin === window.location.origin;
  }

  private installPostMessageBridge(): void {
    if (typeof window === 'undefined') return;
    const listener = (event: Event) => {
      const messageEvent = event as MessageEvent;
      if (!this.isAllowedBridgeOrigin(messageEvent.origin)) return;
      const data = messageEvent.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      if (!data.type.startsWith('zhuda:')) return;

      this.handleBridgeMessage(data);
      const source = messageEvent.source as WindowProxy | null;
      if (source && typeof source.postMessage === 'function') {
        try {
          source.postMessage(
            {
              type: 'zhuda:telemetry:ack',
              receivedCommand: data.type,
              diagnostics: this.getDiagnostics()
            },
            messageEvent.origin
          );
        } catch (error) {
          this.recordError(error);
        }
      }
    };
    this.addEventListener(window, 'message', listener);
    this.postMessageBridgeActive = true;
  }

  public handleBridgeMessage(msg: {
    type: string;
    channel?: IframeAudioChannel;
    volume?: number;
  }): IframeSoundDiagnostics {
    if (this.disposed) return this.getDiagnostics();
    this.lastBridgeCommand = typeof msg?.type === 'string' ? msg.type : 'invalid';
    switch (msg?.type) {
      case 'zhuda:audio:mute':
        this.setMuted(true);
        break;
      case 'zhuda:audio:unmute':
        this.setMuted(false);
        this.unlockAudio('bridge-unmute');
        break;
      case 'zhuda:audio:setVolume':
        if (isAudioChannel(msg.channel) && isFiniteNumber(msg.volume)) {
          this.setChannelVolume(msg.channel, msg.volume);
        }
        break;
      case 'zhuda:lifecycle:pause':
        this.handleFocusOrVisibilityChange(false, false);
        break;
      case 'zhuda:lifecycle:resume':
        this.handleFocusOrVisibilityChange(true, true);
        break;
      case 'zhuda:audio:unlock':
        this.unlockAudio('bridge-unlock');
        break;
      default:
        break;
    }
    this.syncDomTelemetry();
    return this.getDiagnostics();
  }

  public setMuted(muted: boolean): void {
    if (this.disposed) return;
    this.userMuted = Boolean(muted);
    this.updateGainNodes();
  }

  public isMuted(): boolean {
    return this.userMuted;
  }

  public setChannelVolume(channel: IframeAudioChannel, volume: number): boolean {
    if (!isAudioChannel(channel) || !isFiniteNumber(volume) || volume < 0 || volume > 1) return false;
    this.volumes[channel] = volume;
    this.updateGainNodes();
    return true;
  }

  public getChannelVolume(channel: IframeAudioChannel): number {
    return this.volumes[channel];
  }

  private validateTone(options: IframeToneOptions): IframeAudioChannel | null {
    if (!options || typeof options.id !== 'string' || options.id.trim().length === 0) return null;
    const channel = options.channel ?? 'sfx';
    if (!isAudioChannel(channel)) return null;
    if (!isFiniteNumber(options.startFreq) || options.startFreq <= 0 || options.startFreq > 24000) return null;
    if (options.endFreq !== undefined && (!isFiniteNumber(options.endFreq) || options.endFreq <= 0 || options.endFreq > 24000)) return null;
    if (!isFiniteNumber(options.durationSec) || options.durationSec <= 0 || options.durationSec > 30) return null;
    if (options.peakGain !== undefined && (!isFiniteNumber(options.peakGain) || options.peakGain < 0 || options.peakGain > 1)) return null;
    if (options.delaySec !== undefined && (!isFiniteNumber(options.delaySec) || options.delaySec < 0 || options.delaySec > 60)) return null;
    if (options.waveType !== undefined && !AUDIO_WAVE_TYPES.includes(options.waveType)) return null;
    return channel;
  }

  private runSynthesis(options: IframeToneOptions, channel: IframeAudioChannel): AudioVoiceHandle | null {
    const context = this.ensureAudioContext(false);
    const channelGain = channel === 'master' ? this.masterGain : this.channelGains[channel];
    if (!context || !this.masterGain || !channelGain) {
      this.recordError('WebAudio mixer is unavailable');
      this.syncDomTelemetry();
      return null;
    }
    if (this.activeVoices.size >= this.options.maxActiveVoices) {
      this.droppedVoices++;
      this.syncDomTelemetry();
      return null;
    }

    const voiceKey = `${options.id}:${++this.voiceSerial}`;
    const when = context.currentTime + (options.delaySec ?? 0);
    const duration = options.durationSec;
    const state: VoiceState = {
      logicalId: options.id,
      channel,
      source: null as unknown as OscillatorNode,
      stopped: false
    };
    try {
      const source = context.createOscillator();
      const gain = context.createGain();
      state.source = source;
      state.gain = gain;
      source.type = options.waveType ?? 'triangle';
      source.frequency.setValueAtTime(options.startFreq, when);
      if (options.endFreq !== undefined && options.endFreq !== options.startFreq) {
        source.frequency.exponentialRampToValueAtTime(options.endFreq, when + duration);
      }

      const peak = options.peakGain ?? 0.18;
      // Master and channel volumes are applied only by the mixer gain chain.
      gain.gain.setValueAtTime(Math.max(0.001, peak), when);
      gain.gain.exponentialRampToValueAtTime(0.0008, when + duration);
      source.connect(gain);
      gain.connect(channelGain);

      source.onended = () => this.finishVoice(voiceKey);
      this.activeVoices.set(voiceKey, state);
      source.start(when);
      source.stop(when + duration);
      this.playedEventsCount++;

      const handle: AudioVoiceHandle = {
        id: options.id,
        channel,
        get stopped() {
          return state.stopped;
        },
        stop: () => this.stopVoice(voiceKey)
      };
      this.syncDomTelemetry();
      return handle;
    } catch (error) {
      this.recordError(error);
      state.stopped = true;
      try { state.source?.disconnect?.(); state.gain?.disconnect?.(); } catch { /* failed setup */ }
      this.activeVoices.delete(voiceKey);
      this.syncDomTelemetry();
      return null;
    }
  }

  private submit(task: Omit<QueuedAudioTask, 'createdAt'>, replace = false): boolean {
    if (this.disposed || this.userMuted || this.autoSuspendedByBlur) return false;
    if (this.unlockedByGesture) return task.execute();
    const old = this.pendingQueue.findIndex(value => value.id === task.id);
    if (old >= 0 && !replace) { this.droppedQueue++; this.syncDomTelemetry(); return false; }
    if (old < 0 && this.pendingQueue.length >= this.options.maxPendingQueue) {
      this.droppedQueue++; this.syncDomTelemetry(); return false;
    }
    const queued = { ...task, createdAt: this.now() };
    if (old >= 0) this.pendingQueue[old] = queued;
    else this.pendingQueue.push(queued);
    this.queuedBeforeUnlockCount++;
    this.syncDomTelemetry();
    return true;
  }

  /** Queues once before unlock, then starts one voice through the shared mixer. */
  public scheduleTone(options: IframeToneOptions): boolean {
    const channel = this.validateTone(options);
    if (!channel) return false;
    const snapshot = { ...options };
    return this.submit({ id: snapshot.id, channel, execute: () => this.runSynthesis(snapshot, channel) !== null });
  }

  private sampleInfo(id: string, buffer: AudioBuffer): IframeSampleInfo {
    return { id, durationSec: buffer.duration, channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate,
      frames: buffer.length, decodedBytes: buffer.length * buffer.numberOfChannels * 4 };
  }

  /** Load and decode a provider logical ID. Repeated callers share the existing cache work. */
  public async loadSample(id: string, options: { signal?: AbortSignal } = {}): Promise<IframeSampleInfo> {
    normalizeAssetId(id);
    if (this.disposed || !this.sampleCache) throw Error('Sample loading requires a live adapter with sampleProvider');
    if (options.signal?.aborted) throw new DOMException('Sample load cancelled', 'AbortError');
    const existing = this.samples.get(id);
    if (existing) return this.sampleInfo(id, existing.value);
    const reserved = new Set([...this.samples.keys(), ...this.sampleLoads.values(), id]);
    if (reserved.size > this.maxSamples) throw Error('Audio sample capacity exceeded');
    const controller = new AbortController();
    const abort = () => controller.abort();
    options.signal?.addEventListener('abort', abort, { once: true });
    this.sampleLoads.set(controller, id);
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; abort(); }, this.sampleTimeoutMs);
    let lease: AssetLease<AudioBuffer> | undefined;
    try {
      lease = await this.sampleCache.acquire(id, { signal: controller.signal });
      if (controller.signal.aborted || this.disposed) throw new DOMException('Sample load cancelled', 'AbortError');
      const info = this.sampleInfo(id, lease.value);
      if (!this.samples.has(id)) {
        if (this.getDiagnostics().decodedSampleBytes + info.decodedBytes > this.maxDecodedSampleBytes) throw Error('Total decoded sample PCM bound exceeded');
        this.samples.set(id, lease); lease = undefined;
      }
      return info;
    } catch (error) {
      const failure = timedOut ? new Error(`Audio sample load/decode timeout: ${id}`) : error;
      this.recordError(failure); throw failure;
    } finally {
      lease?.release(); clearTimeout(timer);
      options.signal?.removeEventListener('abort', abort);
      this.sampleLoads.delete(controller);
      if (this.disposed && !this.sampleLoads.size) this.sampleCache.dispose();
      this.syncDomTelemetry();
    }
  }

  /** Stops this sample's queued/active voices, cancels pending loads and releases its PCM lease. */
  public unloadSample(id: string): boolean {
    let changed = false;
    for (const [controller, sampleId] of this.sampleLoads) if (sampleId === id) { controller.abort(); changed = true; }
    for (const [key, voice] of [...this.activeVoices]) if (voice.sampleId === id) { this.stopVoice(key); changed = true; }
    const before = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter(task => task.sampleId !== id);
    changed ||= before !== this.pendingQueue.length;
    const lease = this.samples.get(id);
    if (lease) { this.samples.delete(id); lease.release(); changed = true; }
    this.syncDomTelemetry(); return changed;
  }

  public playSample(options: IframeSampleOptions): boolean {
    if (!options || typeof options.id !== 'string' || !options.id.trim()) return false;
    const lease = this.samples.get(options.sampleId);
    const channel = options.channel ?? 'sfx';
    if (!lease || !isAudioChannel(channel)) return false;
    const buffer = lease.value;
    const offset = options.offsetSec ?? 0, loopStart = options.loopStartSec ?? 0, loopEnd = options.loopEndSec ?? buffer.duration;
    for (const value of [offset, loopStart, loopEnd, options.fadeInSec ?? 0, options.fadeOutSec ?? 0, options.crossFadeSec ?? 0])
      if (!Number.isFinite(value) || value < 0) return false;
    if (offset >= buffer.duration || loopStart >= loopEnd || loopEnd > buffer.duration ||
        (options.loop !== undefined && typeof options.loop !== 'boolean') ||
        (options.replace !== undefined && typeof options.replace !== 'boolean') ||
        ((options.crossFadeSec ?? 0) > 0 && !options.replace) ||
        (options.durationSec !== undefined && (!Number.isFinite(options.durationSec) || options.durationSec <= 0)) ||
        (options.peakGain !== undefined && (!Number.isFinite(options.peakGain) || options.peakGain < 0 || options.peakGain > 1))) return false;
    const duration = options.loop ? options.durationSec : Math.min(options.durationSec ?? Infinity, buffer.duration - offset);
    const fadeIn = options.fadeInSec ?? options.crossFadeSec ?? 0, fadeOut = options.fadeOutSec ?? 0;
    if (fadeIn > 60 || fadeOut > 60 || (options.crossFadeSec ?? 0) > 60 ||
        (duration === undefined ? fadeOut > 0 : fadeIn + fadeOut > duration)) return false;
    const snapshot = { ...options };
    return this.submit({ id: snapshot.id, sampleId: snapshot.sampleId, channel, execute: () => {
      if (this.samples.get(snapshot.sampleId) !== lease || this.userMuted || this.autoSuspendedByBlur) return false;
      const previous = [...this.activeVoices].filter(([, voice]) => voice.logicalId === snapshot.id).map(([key]) => key);
      if (previous.length && !snapshot.replace) return false;
      const context = this.ensureAudioContext(false);
      const channelGain = channel === 'master' ? this.masterGain : this.channelGains[channel];
      if (!context || !channelGain) return false;
      if (this.activeVoices.size >= this.options.maxActiveVoices) { this.droppedVoices++; this.syncDomTelemetry(); return false; }
      const key = `${snapshot.id}:${++this.voiceSerial}`;
      let source: AudioBufferSourceNode | undefined, gain: GainNode | undefined;
      try {
        source = context.createBufferSource(); gain = context.createGain();
        source.buffer = buffer; source.loop = snapshot.loop ?? false; source.loopStart = loopStart; source.loopEnd = loopEnd;
        const now = context.currentTime, peak = snapshot.peakGain ?? 1;
        gain.gain.setValueAtTime(fadeIn ? 0 : peak, now);
        if (fadeIn) gain.gain.linearRampToValueAtTime(peak, now + fadeIn);
        if (duration !== undefined && fadeOut) {
          gain.gain.setValueAtTime(peak, now + duration - fadeOut);
          gain.gain.linearRampToValueAtTime(0, now + duration);
        }
        source.connect(gain); gain.connect(channelGain);
        source.onended = () => this.finishVoice(key);
        this.activeVoices.set(key, { logicalId: snapshot.id, channel, source, gain, sampleId: snapshot.sampleId, stopped: false });
        source.start(now, offset);
        if (duration !== undefined) source.stop(now + duration);
        for (const old of previous) this.stopVoice(old, snapshot.crossFadeSec ?? 0);
        this.playedEventsCount++; this.syncDomTelemetry(); return true;
      } catch (error) {
        try { source?.stop(); } catch { /* not started */ }
        source?.disconnect(); gain?.disconnect(); this.activeVoices.delete(key);
        this.recordError(error); this.syncDomTelemetry(); return false;
      }
    } }, snapshot.replace);
  }

  public stop(id: string, fadeOutSec = 0): boolean {
    if (!Number.isFinite(fadeOutSec) || fadeOutSec < 0 || fadeOutSec > 60) return false;
    let stopped = false;
    for (const [voiceKey, voice] of [...this.activeVoices.entries()]) {
      if (voice.logicalId === id) stopped = this.stopVoice(voiceKey, fadeOutSec) || stopped;
    }
    const before = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter((task) => task.id !== id);
    if (before !== this.pendingQueue.length) stopped = true;
    this.syncDomTelemetry();
    return stopped;
  }

  private finishVoice(voiceKey: string): void {
    const voice = this.activeVoices.get(voiceKey);
    if (!voice) return;
    this.activeVoices.delete(voiceKey); voice.stopped = true;
    voice.source.onended = null;
    try { voice.source.disconnect?.(); } catch { /* already disconnected */ }
    try { voice.gain?.disconnect?.(); } catch { /* already disconnected */ }
    this.syncDomTelemetry();
  }

  private stopVoice(voiceKey: string, fadeOutSec = 0): boolean {
    const voice = this.activeVoices.get(voiceKey);
    if (!voice) return false;
    if (fadeOutSec && voice.stopping) return false;
    try {
      if (fadeOutSec && this.ctx && voice.gain) {
        const now = this.ctx.currentTime;
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
        voice.gain.gain.linearRampToValueAtTime(0, now + fadeOutSec);
        voice.source.stop(now + fadeOutSec); voice.stopping = true;
        return true;
      }
      voice.source.stop();
    } catch (_error) { /* source may have ended */ }
    this.finishVoice(voiceKey);
    return true;
  }

  public stopAll(channel?: IframeAudioChannel): number {
    const before = this.pendingQueue.length;
    this.pendingQueue = this.pendingQueue.filter(task => channel !== undefined && task.channel !== channel);
    let count = before - this.pendingQueue.length;
    for (const [voiceKey, voice] of [...this.activeVoices.entries()]) {
      if (channel === undefined || voice.channel === channel) {
        if (this.stopVoice(voiceKey)) count++;
      }
    }
    this.syncDomTelemetry();
    return count;
  }

  public getDiagnostics(): IframeSoundDiagnostics {
    const state = this.ctx && CONTEXT_STATES.has(this.ctx.state)
      ? (this.ctx.state as IframeSoundDiagnostics['contextState'])
      : 'uninitialized';
    return {
      loadedSamples: this.samples.size,
      pendingSampleLoads: this.sampleLoads.size,
      decodedSampleBytes: [...this.samples.values()].reduce((sum, lease) => sum + lease.value.length * lease.value.numberOfChannels * 4, 0),
      inIframe: this.inIframe,
      contextState: state,
      unlockedByGesture: this.unlockedByGesture,
      unlockGestureType: this.unlockGestureType,
      pageVisible: this.pageVisible,
      windowFocused: this.windowFocused,
      autoSuspendedByBlur: this.autoSuspendedByBlur,
      userMuted: this.userMuted,
      volumes: { ...this.volumes },
      queuedBeforeUnlockCount: this.queuedBeforeUnlockCount,
      pendingQueue: this.pendingQueue.length,
      droppedQueue: this.droppedQueue,
      activeVoices: this.activeVoices.size,
      droppedVoices: this.droppedVoices,
      playedEventsCount: this.playedEventsCount,
      postMessageBridgeActive: this.postMessageBridgeActive,
      lastBridgeCommand: this.lastBridgeCommand,
      backend: this.ctx ? 'webaudio' : 'unavailable',
      contextAvailable: this.ctx !== null,
      lastError: this.lastError
    };
  }

  private syncDomTelemetry(): void {
    const diagnostics = this.getDiagnostics();
    const win = globalThis as unknown as {
      __ZHUDA_IFRAME_AUDIO__?: IframeSoundDiagnostics;
      __ZHUDA_IFRAME_ADAPTER__?: IframeSoundAdapter;
    };
    win.__ZHUDA_IFRAME_AUDIO__ = diagnostics;
    if (!this.disposed) win.__ZHUDA_IFRAME_ADAPTER__ = this;

    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.zhudaIframeAudio = this.postMessageBridgeActive ? 'ready' : 'inactive';
      document.body.dataset.zhudaAudioMuted = String(this.userMuted || this.autoSuspendedByBlur);
      document.body.dataset.zhudaAudioPlayed = String(this.playedEventsCount);
    }
  }

  /** Stops voices, removes every event listener and closes the owned context. */
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unlockAttempt++;
    this.pendingQueue = [];
    this.stopAll();
    for (const controller of this.sampleLoads.keys()) controller.abort();
    for (const id of [...this.samples.keys()]) this.unloadSample(id);
    if (!this.sampleLoads.size) this.sampleCache?.dispose();
    try { this.masterGain?.disconnect?.(); for (const node of Object.values(this.channelGains)) node.disconnect?.(); } catch { /* context already closed */ }
    for (const cleanup of this.cleanupFns.splice(0)) cleanup();
    this.gestureCleanupFns.splice(0);
    this.postMessageBridgeActive = false;
    if (this.ctx && typeof this.ctx.close === 'function' && this.ctx.state !== 'closed') {
      try {
        Promise.resolve(this.ctx.close()).catch((error) => this.recordError(error));
      } catch (error) {
        this.recordError(error);
      }
    }
    this.syncDomTelemetry();
    if (IframeSoundAdapter.instance === this) IframeSoundAdapter.instance = null;
  }
}
