export interface ZhudaWebViewFrame { x: number; y: number; width: number; height: number; rotation?: number; scaleX?: number; scaleY?: number; }
export interface ZhudaWebViewAdapter {
  mount(options: { url?: string; frame: ZhudaWebViewFrame; anchor: Laya.Sprite }): void;
  update(options: { url: string; frame: ZhudaWebViewFrame; visible: boolean }): void;
  dispose(): void;
}
export interface ZhudaWebViewSurfaceOptions { parent: Laya.Sprite; adapter: ZhudaWebViewAdapter; url?: string; frame?: ZhudaWebViewFrame; visible?: boolean; }
export interface ZhudaWebViewDiagnostics { url: string; attached: boolean; visible: boolean; frame: ZhudaWebViewFrame; disposed: boolean; }
