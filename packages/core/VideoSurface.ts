import type { ZhudaVideoDiagnostics, ZhudaVideoMode, ZhudaVideoSurfaceOptions } from '../types/zhuda-video.ts';

/**
 * Small ownership wrapper around LayaAir's VideoNode. It deliberately uses the
 * vendor node rather than a DOM overlay, so decoder-mode video participates in
 * the same Laya hierarchy, transform and disposal path as other UI nodes.
 */
export class ZhudaVideoSurface {
  public readonly node: Laya.VideoNode;
  private disposed = false;

  public constructor(options: ZhudaVideoSurfaceOptions) {
    if (!options?.parent) throw new Error('ZhudaVideoSurface requires a parent Sprite.');
    const L = (globalThis as typeof globalThis & { Laya?: typeof Laya }).Laya;
    if (!L?.VideoNode) throw new Error('Laya.VideoNode is unavailable in this runtime.');
    this.node = new L.VideoNode();
    this.node.mode = options.mode ?? 'decoder';
    this.node.autoPlay = options.autoPlay ?? false;
    this.node.loop = options.loop ?? false;
    this.node.muted = options.muted ?? true;
    this.node.allowBackground = options.allowBackground ?? false;
    options.parent.addChild(this.node);
    if (options.source) this.node.source = options.source;
  }

  public get mode(): ZhudaVideoMode { return this.node.mode; }
  public get source(): string { return this.node.source; }
  public setSource(source: string): void {
    this.assertLive();
    if (!source) throw new Error('Video source is required.');
    this.node.source = source;
  }
  public play(): void { this.assertLive(); this.node.play(); }
  public pause(): void { this.assertLive(); this.node.pause(); }
  public stop(): void { this.assertLive(); this.node.pause(); this.node.currentTime = 0; }
  public diagnostics(): ZhudaVideoDiagnostics {
    return {
      source: this.node.source,
      mode: this.node.mode,
      attached: !!this.node.parent,
      readyState: this.node.readyState,
      paused: this.node.paused,
      ended: this.node.ended,
      nativeSize: { width: this.node.videoWidth, height: this.node.videoHeight }
    };
  }
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.node.pause();
    this.node.source = '';
    this.node.destroy(true);
  }
  private assertLive(): void { if (this.disposed) throw new Error('ZhudaVideoSurface is disposed.'); }
}
