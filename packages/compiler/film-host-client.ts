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

function toPng(frame: Frame): string {
  const canvas = document.createElement('canvas');
  canvas.width = frame.width;
  canvas.height = frame.height;
  const g = canvas.getContext('2d')!;
  g.putImageData(new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height), 0, 0);
  return canvas.toDataURL('image/png').slice('data:image/png;base64,'.length);
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
  const frame = await state.renderer.render(options);
  return {
    png: toPng(frame),
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
  const count = options.shots.length,
    columns = count === 1 ? 1 : 2,
    rows = Math.ceil(count / columns),
    gap = 4;
  const canvas = document.createElement('canvas');
  canvas.width = columns * options.width + (columns - 1) * gap;
  canvas.height = rows * options.height + (rows - 1) * gap;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#111';
  g.fillRect(0, 0, canvas.width, canvas.height);
  const cells = [];
  for (let i = 0; i < count; i++) {
    const shot = options.shots[i];
    const frame: Frame = await state.renderer.render({
      camera: shot.camera,
      width: options.width,
      height: options.height,
      samples: options.samples ?? 1,
    });
    const x = (i % columns) * (options.width + gap),
      y = Math.floor(i / columns) * (options.height + gap);
    g.putImageData(
      new ImageData(new Uint8ClampedArray(frame.rgba), frame.width, frame.height),
      x,
      y,
    );
    g.font = 'bold 14px system-ui, sans-serif';
    const label = shot.label,
      w = g.measureText(label).width + 12;
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.fillRect(x + 6, y + 6, w, 22);
    g.fillStyle = '#fff';
    g.fillText(label, x + 12, y + 22);
    cells.push({ label, x, y, width: options.width, height: options.height });
  }
  return {
    png: canvas.toDataURL('image/png').slice('data:image/png;base64,'.length),
    width: canvas.width,
    height: canvas.height,
    cells,
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
