/** Public Laya video-in-node contract. The default decoder mode is canvas-nestable. */
export type ZhudaVideoMode = 'decoder' | 'player';

export interface ZhudaVideoSurfaceOptions {
  parent: Laya.Sprite;
  source?: string;
  mode?: ZhudaVideoMode;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  allowBackground?: boolean;
}

export interface ZhudaVideoDiagnostics {
  source: string;
  mode: ZhudaVideoMode;
  attached: boolean;
  readyState: number;
  paused: boolean;
  ended: boolean;
  nativeSize: { width: number; height: number };
}
