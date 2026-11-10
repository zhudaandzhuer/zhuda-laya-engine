import type {
  ZhudaWebViewAdapter,
  ZhudaWebViewDiagnostics,
  ZhudaWebViewFrame,
  ZhudaWebViewSurfaceOptions,
} from '../types/zhuda-webview.ts';

const finite = (value: number, name: string): number => {
  if (!Number.isFinite(value)) throw new Error(`Invalid ${name}.`);
  return value;
};

function frameOf(value: ZhudaWebViewFrame | undefined): ZhudaWebViewFrame {
  const frame = value ?? { x: 0, y: 0, width: 1, height: 1 };
  const result = {
    x: finite(frame.x, 'frame.x'),
    y: finite(frame.y, 'frame.y'),
    width: finite(frame.width, 'frame.width'),
    height: finite(frame.height, 'frame.height'),
    rotation: finite(frame.rotation ?? 0, 'frame.rotation'),
    scaleX: finite(frame.scaleX ?? 1, 'frame.scaleX'),
    scaleY: finite(frame.scaleY ?? 1, 'frame.scaleY'),
  };
  if (result.width <= 0 || result.height <= 0)
    throw new Error('WebView frame dimensions must be greater than zero.');
  return result;
}

/**
 * Keeps a platform WebView aligned with a Laya hierarchy anchor. The WebView
 * itself remains outside the canvas when the platform requires it; this class
 * makes that boundary explicit and prevents unowned DOM overlays.
 */
export class ZhudaWebViewSurface {
  public readonly anchor: Laya.Sprite;
  private readonly adapter: ZhudaWebViewAdapter;
  private frameValue: ZhudaWebViewFrame;
  private urlValue: string;
  private visibleValue: boolean;
  private disposed = false;

  public constructor(options: ZhudaWebViewSurfaceOptions) {
    if (!options?.parent) throw new Error('ZhudaWebViewSurface requires a parent Sprite.');
    if (!options?.adapter) throw new Error('ZhudaWebViewSurface requires a platform adapter.');
    const L = (globalThis as typeof globalThis & { Laya?: typeof Laya }).Laya;
    if (!L?.Sprite) throw new Error('Laya.Sprite is unavailable in this runtime.');
    this.adapter = options.adapter;
    this.frameValue = frameOf(options.frame);
    this.urlValue = options.url ?? '';
    this.visibleValue = options.visible ?? true;
    this.anchor = new L.Sprite();
    this.anchor.name = 'ZhudaWebViewAnchor';
    options.parent.addChild(this.anchor);
    this.applyAnchor();
    this.adapter.mount({
      url: this.urlValue || undefined,
      frame: this.frameValue,
      anchor: this.anchor,
    });
    this.adapter.update({ url: this.urlValue, frame: this.frameValue, visible: this.visibleValue });
  }

  public get url(): string {
    return this.urlValue;
  }
  public get frame(): ZhudaWebViewFrame {
    return { ...this.frameValue };
  }
  public setUrl(url: string): void {
    this.assertLive();
    this.urlValue = url;
    this.sync();
  }
  public setFrame(frame: ZhudaWebViewFrame): void {
    this.assertLive();
    this.frameValue = frameOf(frame);
    this.applyAnchor();
    this.sync();
  }
  public setVisible(visible: boolean): void {
    this.assertLive();
    this.visibleValue = !!visible;
    this.anchor.visible = this.visibleValue;
    this.sync();
  }
  public diagnostics(): ZhudaWebViewDiagnostics {
    return {
      url: this.urlValue,
      attached: !!this.anchor.parent,
      visible: this.visibleValue,
      frame: this.frame,
      disposed: this.disposed,
    };
  }
  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.adapter.dispose();
    this.anchor.destroy(true);
  }

  private applyAnchor(): void {
    this.anchor.pos(this.frameValue.x, this.frameValue.y);
    this.anchor.size(this.frameValue.width, this.frameValue.height);
    this.anchor.rotation = this.frameValue.rotation ?? 0;
    this.anchor.scaleX = this.frameValue.scaleX ?? 1;
    this.anchor.scaleY = this.frameValue.scaleY ?? 1;
    this.anchor.visible = this.visibleValue;
  }
  private sync(): void {
    this.adapter.update({ url: this.urlValue, frame: this.frameValue, visible: this.visibleValue });
  }
  private assertLive(): void {
    if (this.disposed) throw new Error('ZhudaWebViewSurface is disposed.');
  }
}
