import { ZhudaRequestSlot, type ZhudaModelLibrary, type ModelInstance } from './Assets.ts';
import { ZhudaFilmicPipeline, type FilmicOptions } from './Filmic.ts';
import { ZhudaModelInspector } from './ModelInspector.ts';

export type AssetShowcaseMode = 'raw' | 'gameplay' | 'cinematic';
export interface AssetShowcasePresentation {
  /** Raw always disables postprocessing. Other modes may opt out explicitly. */
  filmic: false | FilmicOptions;
  opaqueColor: boolean;
}
const defaults: Readonly<Record<AssetShowcaseMode, AssetShowcasePresentation>> = {
  raw: { filmic: false, opaqueColor: true },
  gameplay: { filmic: { ao: false, bloom: false, exposure: 1, contrast: 1, saturation: 1 }, opaqueColor: true },
  cinematic: { filmic: { ao: true, bloom: true, temporalAA: false }, opaqueColor: true },
};
const owners = new WeakSet<Laya.Camera>();
/** Same-instance presentation modes. Consumer supplies lighting, environment and scene art.
 * Borrows library/parent/camera; owns the loaded instance and its postprocess only. */
export class ZhudaAssetShowcase {
  private readonly library: ZhudaModelLibrary;
  private readonly parent: Laya.Sprite3D | Laya.Scene3D;
  private readonly camera: Laya.Camera;
  private readonly modes: Record<AssetShowcaseMode, AssetShowcasePresentation>;
  private readonly previousOpaque: boolean;
  private readonly slot = new ZhudaRequestSlot();
  private pipeline: ZhudaFilmicPipeline | null = null;
  private current: ModelInstance | null = null;
  private currentMode: AssetShowcaseMode = 'raw';
  private disposed = false;
  constructor(options: { library: ZhudaModelLibrary; parent: Laya.Sprite3D | Laya.Scene3D; camera: Laya.Camera;
    presentations?: Partial<Record<AssetShowcaseMode, AssetShowcasePresentation>> }) {
    this.library = options.library; this.parent = options.parent; this.camera = options.camera;
    if (this.camera.destroyed || this.parent.destroyed || owners.has(this.camera) || this.camera.postProcess || this.camera.taa)
      throw Error('Showcase requires a live exclusive camera without postprocessing or TAA');
    this.modes = {} as Record<AssetShowcaseMode, AssetShowcasePresentation>;
    for (const mode of ['raw', 'gameplay', 'cinematic'] as const) {
      const value = options.presentations?.[mode] ?? defaults[mode];
      if (typeof value.opaqueColor !== 'boolean' || (value.filmic !== false && (!value.filmic || typeof value.filmic !== 'object')) || (mode === 'raw' && value.filmic !== false)) throw Error('Invalid showcase presentation: ' + mode);
      if (value.filmic !== false) {
        for (const key of ['exposure','contrast','saturation','aoIntensity','aoRadius','bloomIntensity'] as const) {
          const n = value.filmic[key];
          if (n !== undefined && (!Number.isFinite(n) || n < 0)) throw Error('Invalid filmic option: ' + key);
        }
        for (const key of ['ao','bloom','temporalAA'] as const) if (value.filmic[key] !== undefined && typeof value.filmic[key] !== 'boolean') throw Error('Invalid filmic option: ' + key);
      }
      this.modes[mode] = { opaqueColor: value.opaqueColor, filmic: value.filmic === false ? false : { ...value.filmic } };
    }
    this.previousOpaque = this.camera.opaquePass;
    owners.add(this.camera);
    this.camera.opaquePass = this.modes.raw.opaqueColor;
  }
  get mode(): AssetShowcaseMode { return this.currentMode; }
  get instance(): ModelInstance | null { return this.current; }
  private alive() {
    if (this.disposed || this.parent.destroyed || this.camera.destroyed) throw Error('Disposed showcase or borrowed scene');
  }
  private requireInputs(instance: ModelInstance, mode: AssetShowcaseMode) {
    if (instance.compatibility.requiredRenderInputs.includes('opaqueColor') && !this.modes[mode].opaqueColor)
      throw Error('REQUIRED_RENDER_INPUT: this asset requires opaqueColor in mode ' + mode);
  }
  async load(assetId: string, options: { signal?: AbortSignal; timeoutMs?: number; independentMaterials?: boolean } = {}): Promise<boolean> {
    this.alive();
    return this.slot.replace(
      async signal => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        signal.addEventListener('abort', abort, { once: true });
        options.signal?.addEventListener('abort', abort, { once: true });
        if (signal.aborted || options.signal?.aborted) abort();
        try { return await this.library.instantiate(assetId, { ...options, signal: controller.signal }); }
        finally { signal.removeEventListener('abort', abort); options.signal?.removeEventListener('abort', abort); }
      },
      instance => {
        this.alive(); this.requireInputs(instance, this.currentMode);
        this.parent.addChild(instance.node);
        const previous = this.current; this.current = instance;
        previous?.dispose(); this.pipeline?.resetHistory();
      },
      instance => instance.dispose(),
    );
  }
  inspect(): ReturnType<ZhudaModelInspector['inspect']> {
    this.alive(); if (!this.current) throw Error('No loaded showcase asset');
    return new ZhudaModelInspector(this.current).inspect();
  }
  setMode(mode: AssetShowcaseMode): void {
    this.alive();
    if (!Object.prototype.hasOwnProperty.call(this.modes, mode)) throw Error('Unknown showcase mode');
    if (mode === this.currentMode) return;
    if (this.current) this.requireInputs(this.current, mode);
    if (this.camera.postProcess && this.camera.postProcess !== this.pipeline?.post) throw Error('Showcase camera postprocess ownership changed');
    const next = this.modes[mode], previous = this.modes[this.currentMode];
    // Preflight before releasing the existing chain. No silent quality downgrade.
    if (next.filmic !== false) {
      const l = (globalThis as unknown as { Laya: typeof Laya }).Laya;
      if (!l.PostProcess || !l.ScalableAO || !l.BloomEffect || !l.ColorGradEffect || !l.LayaGL.renderEngine.getCapable(l.RenderCapable.RenderTextureFormat_R16G16B16A16)) throw Error('Showcase Filmic requires postprocess module and half-float render targets');
    }
    this.pipeline?.dispose(); this.pipeline = null;
    try {
      if (next.filmic !== false) this.pipeline = new ZhudaFilmicPipeline(this.camera, next.filmic);
      this.camera.opaquePass = next.opaqueColor;
      this.currentMode = mode;
    } catch (error) {
      if (previous.filmic !== false) this.pipeline = new ZhudaFilmicPipeline(this.camera, previous.filmic);
      this.camera.opaquePass = previous.opaqueColor;
      throw error;
    }
  }
  cancel(): void { this.slot.cancel(); }
  clear(): void { this.slot.cancel(); this.current?.dispose(); this.current = null; }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.clear(); this.pipeline?.dispose(); this.pipeline = null;
    if (!this.camera.destroyed) this.camera.opaquePass = this.previousOpaque;
    owners.delete(this.camera);
  }
}
