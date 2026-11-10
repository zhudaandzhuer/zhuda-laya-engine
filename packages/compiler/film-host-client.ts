/**
 * Page script of the film host. It runs next to the public browser SDK bundle
 * (`Zhuda` global) and only bundles the neutral starter props and recipes.
 * The Node side drives it through `window.__ZHUDA_FILM__`.
 */
import { ZHUDA_STARTER_PROPS, ZHUDA_STARTER_TEXTURES } from '../demo/ProceduralStarter.ts';

type Camera = {
  eye: number[];
  target: number[];
  focalLengthMm?: number;
  fStop?: number;
  focusDistanceM?: number;
};
type Frame = { width: number; height: number; rgba: Uint8Array };

const Z = (globalThis as any).Zhuda;
const state: {
  context?: any;
  stage?: any;
  renderer?: any;
  bakeCache: Map<string, unknown>;
  ready: boolean;
  error?: string;
} = { bakeCache: new Map(), ready: false };

/** Raw RGBA as base64; the Node host encodes PNG. No DOM canvas is involved. */
function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(text);
}

function requireStage() {
  if (!state.stage || !state.renderer) throw Error('No film scene mounted');
  return state.stage;
}

async function mount(scene: unknown) {
  state.renderer?.dispose();
  state.stage?.dispose();
  state.renderer = state.stage = undefined;
  const started = performance.now();
  state.stage = Z.mountZhudaFilmScene(state.context.rootScene, scene, {
    props: ZHUDA_STARTER_PROPS,
    recipes: ZHUDA_STARTER_TEXTURES,
    bakeCache: state.bakeCache,
  });
  state.renderer = new Z.ZhudaFilmRenderer(state.stage, state.context.runtime);
  return { batches: state.stage.batches, mountMs: Math.round(performance.now() - started) };
}

async function render(options: {
  camera?: Camera;
  width: number;
  height: number;
  samples?: number;
  index?: number;
  fps?: number;
}) {
  requireStage();
  const started = performance.now();
  const frame: Frame = await state.renderer.render(options);
  return {
    rgba: toBase64(frame.rgba),
    width: frame.width,
    height: frame.height,
    renderMs: Math.round(performance.now() - started),
  };
}

async function review(options: {
  shots: { label: string; camera: Camera }[];
  width: number;
  height: number;
  samples?: number;
}) {
  requireStage();
  const shots = [];
  for (const shot of options.shots)
    shots.push({
      label: shot.label,
      frame: await state.renderer.render({
        camera: shot.camera,
        width: options.width,
        height: options.height,
        samples: options.samples ?? 1,
      }),
    });
  // The sheet is composed with Laya 2D (Sprite, Text, RenderTexture2D).
  const sheet = await Z.composeZhudaFilmReview(shots);
  return {
    rgba: toBase64(sheet.rgba),
    width: sheet.width,
    height: sheet.height,
    cells: sheet.cells,
  };
}

async function boot() {
  state.context = await Z.ZhudaEngine.boot({
    renderer: 'webgl',
    container: document.querySelector('#view'),
    width: 64,
    height: 64,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
    preserveDrawingBuffer: true,
  });
  state.context.runtime.start(() => {});
  Z.ZhudaEngine.flushRenderFrames(2);
  state.ready = true;
}

(globalThis as any).__ZHUDA_FILM__ = {
  state,
  mount,
  render,
  review,
  info: () => ({
    ready: state.ready,
    error: state.error,
    version: (globalThis as any).ZhudaBundle?.version,
    props: ZHUDA_STARTER_PROPS.map((p: { id: string }) => p.id),
    recipes: Object.keys(ZHUDA_STARTER_TEXTURES),
  }),
};
boot().catch((error) => {
  state.error = String(error?.stack || error);
});
