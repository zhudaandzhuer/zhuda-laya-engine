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
  }>;
}
