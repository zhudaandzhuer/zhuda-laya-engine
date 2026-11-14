/** Types for the official classic-script browser bundle. No second API surface. */
export * from 'zhuda-laya-engine';
export as namespace Zhuda;
declare global {
  var ZhudaBranding: import('./zhuda-branding.js').ZhudaBrandingConfig | undefined;
  const ZhudaBundle: Readonly<{
    version: string;
    profile: '2d' | '3d' | '3d-gltf' | '2d-webgpu' | '3d-webgpu' | '3d-gltf-webgpu';
    renderer: 'webgl' | 'webgpu';
    features: readonly import('./zhuda-bootstrap.js').EngineFeatureTag[];
    libraries: readonly string[];
    sourceFingerprint: string;
    bundler: Readonly<{name: 'esbuild'; version: string}>;
    /** WebGPU bundles: the two shader compilers are in the bundle, or fetched from beside it. */
    compilers?: 'inline' | 'external';
  }>;
  /**
   * `zhuda-loader.js`, loaded before either bundle: asks the browser, then
   * loads the WebGPU bundle or the WebGL one. Only on a page that loaded it.
   */
  const ZhudaLoader: Readonly<{
    load(
      options: import('./runtime3d/BackendChoice.js').ZhudaLoaderOptions,
    ): Promise<import('./runtime3d/BackendChoice.js').ZhudaBackendRecord>;
    /** Loads the page again on WebGL after a WebGPU that did not start; false when it cannot. */
    retry(reason: string): boolean;
    choose(
      facts: import('./runtime3d/BackendChoice.js').ZhudaBackendFacts | null,
      options?: import('./runtime3d/BackendChoice.js').ZhudaBackendOptions,
      retry?: string | null,
    ): import('./runtime3d/BackendChoice.js').ZhudaBackendChoice;
    probe(timeoutMs?: number): Promise<{
      facts: import('./runtime3d/BackendChoice.js').ZhudaBackendFacts;
      adapter: import('./runtime3d/BackendChoice.js').ZhudaBackendAdapter | null;
    }>;
  }>;
  /** What the loader chose, from the moment the backend's scripts have run. */
  var ZhudaBackend: import('./runtime3d/BackendChoice.js').ZhudaBackendRecord | undefined;
  /**
   * A consumer build with `"renderer": "auto"`: set to `'webgl'` before the
   * libraries load (from the game's own settings) to stay on WebGL.
   */
  var ZhudaBackendPrefer: import('./runtime3d/BackendChoice.js').ZhudaBackendName | undefined;
}
