// What a scene preset is: one way to open a shared 3D scene in the viewer.
// A preset is the thin layer a game would write: boot the engine, call the
// scene module(s) from src/common/3d/…, wire camera, input and the frame loop.
// It keeps no scene content of its own beyond that wiring.

export interface ScenePreset {
  /** The address id: index.html?scene=<id>. */
  id: string;
  /** Short name shown in the gallery. */
  title: string;
  /** One or two sentences: what is in it and what it is good for. */
  summary: string;
  /** The library modules it is built from (catalog ids), for whoever wants to reuse it. */
  modules: string[];
  /** Addresses worth opening: label → extra query (without scene=), e.g. { 黃昏: 'hour=18.2' }. */
  views: Record<string, string>;
  /** Builds the scene in the container and starts it; sets window.__SCENE__ (see SceneHook) when the first frame is drawn. */
  start(container: HTMLElement, params: URLSearchParams): Promise<void>;
}

/**
 * The page hook every preset sets on window.__SCENE__, for tools/play.mjs and other checks.
 * `ready` turns true once models are in and the first frames are drawn. A preset may add its
 * own handles (the pig, the walker, the fx) next to these.
 */
export interface SceneHook {
  ready: boolean;
  state(): Record<string, unknown>;
  set(options: Record<string, unknown>): void;
  errors(): unknown[];
  [handle: string]: unknown;
}

export function setSceneHook(hook: SceneHook) {
  Reflect.set(window, '__SCENE__', hook);
}
