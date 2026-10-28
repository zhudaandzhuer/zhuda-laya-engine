/**
 * @zhuda-laya/core — M2 適配基建：iframe 跨域音訊管理與生命週期焦點守衛 (IframeSoundAdapter)
 *
 * 解決 H5 商業平台 (Poki / CrazyGames / Telegram WebApp / 企業母殼 iframe) 三大痛點：
 * 1. Autoplay Policy 阻擋：未有手勢前自動排隊音訊指令，首個 pointerdown/touchstart/keydown 全自動解鎖 AudioContext + 1-sample 靜音緩衝喚醒
 * 2. 失焦與切頁漏音：監聽 visibilitychange / blur / focus / pagehide，切出視窗或 iframe 失焦時平滑靜音，返回時自動恢復
 * 3. 母殼跨域通訊橋 (postMessage Bridge)：支援父視窗發送 zhuda:audio:mute / unmute / setVolume / lifecycle:pause 指令並回傳遙測
 */

import type { IframeAudioChannel, IframeSoundDiagnostics } from '../types/index';

export interface QueuedAudioTask {
  id: string;
  channel: IframeAudioChannel;
  createdAt: number;
  execute: () => void;
}

export class IframeSoundAdapter {
  private static instance: IframeSoundAdapter | null = null;

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channelGains: Partial<Record<IframeAudioChannel, GainNode>> = {};

  private inIframe: boolean = false;
  private unlockedByGesture: boolean = false;
  private unlockGestureType: string = 'none';
  private pageVisible: boolean = true;
  private windowFocused: boolean = true;
  private autoSuspendedByBlur: boolean = false;
  private userMuted: boolean = false;
  private postMessageBridgeActive: boolean = false;
  private lastBridgeCommand: string = 'init';

  private volumes: Record<IframeAudioChannel, number> = {
    master: 0.85,
    bgm: 0.6,
    sfx: 0.9,
    ui: 0.85
  };

  private pendingQueue: QueuedAudioTask[] = [];
  private queuedBeforeUnlockCount: number = 0;
  private playedEventsCount: number = 0;

  public static getShared(): IframeSoundAdapter {
    if (!this.instance) {
      this.instance = new IframeSoundAdapter();
    }
    return this.instance;
  }

  constructor() {
    this.detectIframeContext();
    this.installGestureUnlockGuards();
    this.installVisibilityAndFocusGuards();
    this.installPostMessageBridge();
    this.syncLayaSoundManager();
    this.syncDomTelemetry();
  }

  private detectIframeContext(): void {
    if (typeof window === 'undefined') {
      this.inIframe = false;
      return;
    }
    try {
      this.inIframe = window.self !== window.top;
    } catch (_crossOriginErr) {
      // 若存取 window.top 拋出 SecurityError，代表處於跨域 iframe 中
      this.inIframe = true;
    }
  }

  private ensureAudioContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          this.masterGain = this.ctx.createGain();
          this.masterGain.gain.value = this.getEffectiveMasterVolume();
          this.masterGain.connect(this.ctx.destination);

          const channels: IframeAudioChannel[] = ['bgm', 'sfx', 'ui'];
          for (const ch of channels) {
            const g = this.ctx.createGain();
            g.gain.value = this.volumes[ch];
            g.connect(this.masterGain);
            this.channelGains[ch] = g;
          }
        } catch (_e) {
          this.ctx = null;
        }
      }
    }
    return this.ctx;
  }

  private getEffectiveMasterVolume(): number {
    if (this.userMuted || this.autoSuspendedByBlur) {
      return 0;
    }
    return this.volumes.master;
  }

  private updateGainNodes(): void {
    const effectiveMaster = this.getEffectiveMasterVolume();
    if (this.ctx && this.masterGain) {
      try {
        this.masterGain.gain.setValueAtTime(effectiveMaster, this.ctx.currentTime);
      } catch (_e) {
        this.masterGain.gain.value = effectiveMaster;
      }
    }
    const channels: IframeAudioChannel[] = ['bgm', 'sfx', 'ui'];
    for (const ch of channels) {
      const node = this.channelGains[ch];
      if (node) {
        node.gain.value = this.volumes[ch];
      }
    }
    this.syncLayaSoundManager();
    this.syncDomTelemetry();
  }

  private syncLayaSoundManager(): void {
    const g = globalThis as unknown as {
      Laya?: {
        SoundManager?: {
          muted?: boolean;
          autoStopMusic?: boolean;
          setMusicVolume?: (v: number) => void;
          setSoundVolume?: (v: number) => void;
        };
      };
    };
    const sm = g.Laya?.SoundManager;
    if (sm) {
      sm.muted = this.userMuted || this.autoSuspendedByBlur;
      sm.autoStopMusic = true;
      if (typeof sm.setMusicVolume === 'function') {
        sm.setMusicVolume(Number((this.volumes.master * this.volumes.bgm).toFixed(2)));
      }
      if (typeof sm.setSoundVolume === 'function') {
        sm.setSoundVolume(Number((this.volumes.master * this.volumes.sfx).toFixed(2)));
      }
    }
  }

  /**
   * 安裝首觸手勢解鎖守衛 (支援 pointerdown / touchstart / mousedown / keydown)
   */
  private installGestureUnlockGuards(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const gestureEvents = ['pointerdown', 'touchstart', 'mousedown', 'keydown'];
    const onFirstGesture = (ev: Event) => {
      this.unlockAudio(ev.type || 'gesture');
      if (this.unlockedByGesture) {
        for (const evtName of gestureEvents) {
          window.removeEventListener(evtName, onFirstGesture, true);
        }
      }
    };

    for (const evtName of gestureEvents) {
      window.addEventListener(evtName, onFirstGesture, { capture: true, passive: true });
    }
  }

  /**
   * 執行音訊解鎖與排隊任務沖刷 (可由手勢事件或測試/母殼直接觸發)
   */
  public unlockAudio(gestureSource: string = 'programmatic-unlock'): boolean {
    const ctx = this.ensureAudioContext();
    this.unlockedByGesture = true;
    this.unlockGestureType = gestureSource;

    if (ctx) {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }
      // 播放 1-sample 無聲緩衝，徹底解鎖 iOS WebKit / iframe 音訊通道
      try {
        const silentBuf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(ctx.destination);
        src.start(0);
      } catch (_e) {
        // Ignore in headless environments without hardware audio device
      }
    }

    // 沖刷解鎖前排隊的音效任務 (僅播放最近 500ms 內的排隊音效避免爆音)
    const now = Date.now();
    const tasks = this.pendingQueue.splice(0, this.pendingQueue.length);
    for (const task of tasks) {
      if (now - task.createdAt <= 1200) {
        try {
          task.execute();
        } catch (_e) {
          // Ignore playback error
        }
      }
    }

    this.syncDomTelemetry();
    return this.unlockedByGesture;
  }

  /**
   * 安裝視窗可見度與 iframe 焦點守衛
   */
  private installVisibilityAndFocusGuards(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      const visible = document.visibilityState !== 'hidden';
      this.handleFocusOrVisibilityChange(visible, this.windowFocused);
    });

    window.addEventListener('blur', () => {
      this.handleFocusOrVisibilityChange(this.pageVisible, false);
    });

    window.addEventListener('focus', () => {
      this.handleFocusOrVisibilityChange(true, true);
    });

    window.addEventListener('pagehide', () => {
      this.handleFocusOrVisibilityChange(false, false);
    });

    window.addEventListener('pageshow', () => {
      this.handleFocusOrVisibilityChange(true, true);
    });
  }

  public handleFocusOrVisibilityChange(visible: boolean, focused: boolean): void {
    this.pageVisible = visible;
    this.windowFocused = focused;
    this.autoSuspendedByBlur = !visible || !focused;

    if (this.ctx) {
      if (this.autoSuspendedByBlur && this.ctx.state === 'running' && typeof this.ctx.suspend === 'function') {
        this.ctx.suspend().catch(() => {});
      } else if (!this.autoSuspendedByBlur && !this.userMuted && this.ctx.state === 'suspended' && typeof this.ctx.resume === 'function') {
        this.ctx.resume().catch(() => {});
      }
    }

    this.updateGainNodes();
  }

  /**
   * 安裝跨域 postMessage 通訊橋 (相容父層平台控制音訊與暫停)
   */
  private installPostMessageBridge(): void {
    this.postMessageBridgeActive = true;
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event: MessageEvent) => {
      const data = event?.data;
      if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;
      if (!data.type.startsWith('zhuda:')) return;

      this.handleBridgeMessage(data);

      // 若母視窗要求回傳狀態，安全透過 postMessage 回覆
      if (event.source && typeof (event.source as WindowProxy).postMessage === 'function') {
        try {
          (event.source as WindowProxy).postMessage(
            {
              type: 'zhuda:telemetry:ack',
              receivedCommand: data.type,
              diagnostics: this.getDiagnostics()
            },
            '*'
          );
        } catch (_e) {
          // Ignore cross-origin postMessage restrictions
        }
      }
    });
  }

  /**
   * 處理來自父層 iframe 或 SDK 測試的結構化通訊指令
   */
  public handleBridgeMessage(msg: {
    type: string;
    channel?: IframeAudioChannel;
    volume?: number;
  }): IframeSoundDiagnostics {
    this.lastBridgeCommand = msg.type;

    switch (msg.type) {
      case 'zhuda:audio:mute':
        this.setMuted(true);
        break;
      case 'zhuda:audio:unmute':
        this.setMuted(false);
        this.unlockAudio('bridge-unmute');
        break;
      case 'zhuda:audio:setVolume':
        if (msg.channel && typeof msg.volume === 'number') {
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
    this.userMuted = muted;
    this.updateGainNodes();
  }

  public isMuted(): boolean {
    return this.userMuted;
  }

  public setChannelVolume(channel: IframeAudioChannel, volume: number): void {
    const clamped = Math.max(0, Math.min(1, Number(volume.toFixed(2))));
    this.volumes[channel] = clamped;
    this.updateGainNodes();
  }

  public getChannelVolume(channel: IframeAudioChannel): number {
    return this.volumes[channel];
  }

  /**
   * 排程或立即播放合成音訊 (若尚未解鎖則安全入列，絕不拋出 DOMException NotAllowedError)
   */
  public scheduleTone(options: {
    id: string;
    channel?: IframeAudioChannel;
    waveType?: OscillatorType;
    startFreq: number;
    endFreq?: number;
    durationSec: number;
    peakGain?: number;
  }): boolean {
    const channel = options.channel ?? 'sfx';
    if (this.userMuted || this.autoSuspendedByBlur) {
      return false;
    }

    const runSynthesis = () => {
      this.playedEventsCount++;
      const ctx = this.ensureAudioContext();
      if (!ctx) {
        this.syncDomTelemetry();
        return;
      }
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }

      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = options.waveType ?? 'triangle';
        osc.frequency.setValueAtTime(options.startFreq, ctx.currentTime);
        if (options.endFreq && options.endFreq !== options.startFreq) {
          osc.frequency.exponentialRampToValueAtTime(
            Math.max(20, options.endFreq),
            ctx.currentTime + options.durationSec
          );
        }

        const peak = (options.peakGain ?? 0.18) * this.volumes.master * this.volumes[channel];
        gain.gain.setValueAtTime(Math.max(0.001, peak), ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + options.durationSec);

        const targetDest = this.channelGains[channel] || this.masterGain || ctx.destination;
        osc.connect(gain);
        gain.connect(targetDest);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + options.durationSec);
      } catch (_e) {
        // Safe fallback in headless mode
      }
      this.syncDomTelemetry();
    };

    if (!this.unlockedByGesture) {
      this.queuedBeforeUnlockCount++;
      this.pendingQueue.push({
        id: options.id,
        channel,
        createdAt: Date.now(),
        execute: runSynthesis
      });
      // 在支援直接播放的桌面環境同時嘗試溫和啟動
      runSynthesis();
      return true;
    }

    runSynthesis();
    return true;
  }

  public getDiagnostics(): IframeSoundDiagnostics {
    const state = this.ctx ? (this.ctx.state as IframeSoundDiagnostics['contextState']) : 'uninitialized';
    return {
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
      playedEventsCount: this.playedEventsCount,
      postMessageBridgeActive: this.postMessageBridgeActive,
      lastBridgeCommand: this.lastBridgeCommand
    };
  }

  private syncDomTelemetry(): void {
    const diag = this.getDiagnostics();
    const win = globalThis as unknown as {
      __ZHUDA_IFRAME_AUDIO__?: IframeSoundDiagnostics;
      __ZHUDA_IFRAME_ADAPTER__?: IframeSoundAdapter;
    };
    win.__ZHUDA_IFRAME_AUDIO__ = diag;
    win.__ZHUDA_IFRAME_ADAPTER__ = this;

    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.zhudaIframeAudio = this.postMessageBridgeActive ? 'ready' : 'inactive';
      document.body.dataset.zhudaAudioMuted = String(this.userMuted || this.autoSuspendedByBlur);
      document.body.dataset.zhudaAudioPlayed = String(this.playedEventsCount);
    }
  }
}
