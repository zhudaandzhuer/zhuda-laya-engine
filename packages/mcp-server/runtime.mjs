import path from "node:path";
import { fileURLToPath } from "node:url";
const installed = fileURLToPath(import.meta.url)
  .split(path.sep)
  .includes("node_modules");
const runtime = installed
  ? await import("../../dist/sdk/zhuda-laya-engine.esm.js")
  : Object.assign(
      {},
      ...(await Promise.all(
        [
          "TopologyGraph",
          "BenchmarkEngine",
          "StaticAssetPipeline",
          "PixelCalibrationEngine",
          "ViewportMatrixEngine",
          "UnityBridgePipeline",
          "particles/ParticleTypes",
          "particles/ParticleTypes3D",
          "terrain/index",
          "shaders/index",
        ].map((name) => import(new URL(`../core/${name}.ts`, import.meta.url))),
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
} = runtime;
