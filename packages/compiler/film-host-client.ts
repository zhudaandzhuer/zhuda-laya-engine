/**
 * Page script of the film host. It runs next to the public browser SDK bundle
 * (`Zhuda` global) and bundles the neutral starter props and recipes plus any
 * prop packs the server operator configured (`--film-pack`). The Node side
 * drives it through `window.__ZHUDA_FILM__`.
 */
import { ZHUDA_STARTER_PROPS, ZHUDA_STARTER_TEXTURES } from '../demo/ProceduralStarter.ts';

type Pack = { name: string; props?: { id: string }[]; recipes?: Record<string, unknown> };
/** Starter set first, then each operator pack; duplicate ids are an error. */
function catalogue(packs: readonly Pack[]) {
  const props: any[] = [...ZHUDA_STARTER_PROPS],
    recipes: Record<string, unknown> = { ...ZHUDA_STARTER_TEXTURES };
  for (const pack of packs) {
    for (const prop of pack.props ?? []) {
      if (props.some((existing) => existing.id === prop.id))
        throw Error(`Film pack ${pack.name}: duplicate prop ${prop.id}`);
      props.push(prop);
    }
    for (const [name, recipe] of Object.entries(pack.recipes ?? {})) {
      if (Object.hasOwn(recipes, name))
        throw Error(`Film pack ${pack.name}: duplicate recipe ${name}`);
      recipes[name] = recipe;
    }
  }
  return { props, recipes };
}
let library: ReturnType<typeof catalogue> | undefined;

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
  /** Models and lightmaps from the operator's asset directory, when one is served. */
  provider?: any;
  assets?: any;
  assetsVersion?: string;
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

async function mount(request: { scene: unknown; assetsVersion?: string }) {
  state.renderer?.dispose();
  state.stage?.dispose();
  state.renderer = state.stage = undefined;
  const started = performance.now();
  const options = {
    props: library!.props,
    recipes: library!.recipes,
    bakeCache: state.bakeCache,
  };
  if (state.provider) {
    // Files changed on disk: drop the warm models and lightmaps.
    if (state.assets && state.assetsVersion !== request.assetsVersion) {
      state.assets.dispose();
      state.assets = undefined;
    }
    state.assets ??= new Z.ZhudaFilmAssets(state.provider);
    state.assetsVersion = request.assetsVersion;
    state.stage = await Z.loadZhudaFilmScene(state.context.rootScene, request.scene, {
      ...options,
      assets: state.assets,
    });
  } else state.stage = Z.mountZhudaFilmScene(state.context.rootScene, request.scene, options);
  state.renderer = new Z.ZhudaFilmRenderer(state.stage, state.context.runtime);
  return {
    batches: state.stage.batches,
    models: state.stage.models,
    mountMs: Math.round(performance.now() - started),
    assetCache: state.assets ? state.assets.models.report() : undefined,
  };
}

async function render(options: {
  camera?: Camera;
  width: number;
  height: number;
  samples?: number;
  index?: number;
  fps?: number;
  timeSec?: number;
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
  shots: { label: string; camera: Camera; time?: number }[];
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
        timeSec: shot.time,
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

async function boot(packs: readonly Pack[], options: { assets?: boolean }) {
  library = catalogue(packs);
  if (options.assets)
    state.provider = new Z.DirectoryAssetProvider({
      baseUrl: 'assets/',
      timeoutMs: 60_000,
      maxBytes: 512 * 1024 * 1024,
    });
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

/**
 * Called by the host's entry with the operator packs. An explicit call, not a
 * side-effect import: the package declares `sideEffects: false`, so a bare
 * import of this file would be dropped by the bundler.
 */
export function startFilmHost(packs: readonly Pack[] = [], options: { assets?: boolean } = {}) {
  (globalThis as any).__ZHUDA_FILM__ = {
    state,
    mount,
    render,
    review,
    info: () => ({
      ready: state.ready,
      error: state.error,
      version: (globalThis as any).ZhudaBundle?.version,
      props: library ? library.props.map((p: { id: string }) => p.id).sort() : [],
      recipes: library ? Object.keys(library.recipes).sort() : [],
    }),
  };
  boot(packs, options).catch((error) => {
    state.error = String(error?.stack || error);
  });
}
