import path from "node:path";
import { fileURLToPath } from "node:url";
// Node 24 refuses TypeScript stripping inside node_modules. Published CLIs use
// the shipped JS SDK; repository builds still compile against current sources.
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
          "StaticAssetPipeline",
          "PixelCalibrationEngine",
          "ViewportMatrixEngine",
          "UnityBridgePipeline",
        ].map((name) => import(new URL(`../core/${name}.ts`, import.meta.url))),
      )),
    );
export const {
  TopologyResolver,
  ENGINE_PRESET_PROFILES,
  ZhudaAssetSerializer,
  PixelCalibrationEngine,
  ViewportMatrixEngine,
  UnityBridgePipeline,
} = runtime;
