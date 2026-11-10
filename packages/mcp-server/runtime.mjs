import path from 'node:path';
import { fileURLToPath } from 'node:url';
const installed = fileURLToPath(import.meta.url)
  .split(path.sep)
  .includes('node_modules');
const runtime = installed
  ? Object.assign(
      {},
      await import('../../dist/sdk/zhuda-laya-engine.esm.js'),
      await import('../../dist/sdk/zhuda-laya-demo.esm.js'),
    )
  : Object.assign(
      {},
      ...(await Promise.all(
        [
          'TopologyGraph',
          'BenchmarkEngine',
          'StaticAssetPipeline',
          'PixelCalibrationEngine',
          'ViewportMatrixEngine',
          'UnityBridgePipeline',
          'particles/ParticleTypes',
          'particles/ParticleTypes3D',
          'terrain/index',
          'shaders/index',
          'runtime3d/Timeline',
          'runtime3d/ModelCompatibility',
        ].map(
          (name) =>
            import(
              new URL(
                `../${['BenchmarkEngine', 'StaticAssetPipeline', 'UnityBridgePipeline', 'PixelCalibrationEngine'].includes(name) ? 'demo' : 'core'}/${name}.ts`,
                import.meta.url,
              )
            ),
        ),
      )),
    );
export const {
  TopologyResolver,
  ZhudaBenchmarkEngine,
  ZhudaAssetSerializer,
  PixelCalibrationEngine,
  ViewportMatrixEngine,
  UnityBridgePipeline,
  validateParticleEffect,
  validateParticleEffect3D,
  validateTerrain2D,
  validateHeightfield,
  validateShaderSpec,
  validateTimelineSpec,
  gltfAssetCapabilities,
  gltfExtensionCapabilities,
} = runtime;
