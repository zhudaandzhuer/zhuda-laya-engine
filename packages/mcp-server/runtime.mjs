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
          'procedural/TextureRecipe',
          'procedural/SynthAudio',
          'film/FilmScene',
          'ProceduralStarter',
        ].map(
          (name) =>
            import(
              new URL(
                `../${['BenchmarkEngine', 'StaticAssetPipeline', 'UnityBridgePipeline', 'PixelCalibrationEngine', 'ProceduralStarter'].includes(name) ? 'demo' : 'core'}/${name}.ts`,
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
  validateZhudaTextureRecipe,
  validateZhudaSynthRecipe,
  validateZhudaFilmScene,
  parseZhudaFilmScene,
  applyZhudaFilmScenePatch,
  validateZhudaFilmCameraPath,
  sampleZhudaFilmCameraPath,
  resolveZhudaFilmCamera,
  ZHUDA_STARTER_PROPS,
  ZHUDA_STARTER_TEXTURES,
} = runtime;
