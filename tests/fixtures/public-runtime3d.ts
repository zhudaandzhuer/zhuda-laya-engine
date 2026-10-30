import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaModelLibrary,
  ZhudaDynamicMesh,
  ZhudaSceneQueries,
  ZhudaSimulationClock,
  ZhudaSnapshotBuffer,
  ZhudaEventGate,
  ZhudaCameraCoordinates,
  ZhudaCameraRig,
  resolveCameraBoom,
  ZhudaResourceScope,
  sceneQuality,
  applySceneQuality,
  inspectSceneResources,
  type QueryHit,
  type ZhudaBootOptions,
} from "zhuda-laya-engine";
const options: ZhudaBootOptions = {
  container: "#game",
  dprCap: 1.5,
  antialias: false,
  preserveDrawingBuffer: false,
  targetFPS: 60,
  onResize: (size) => console.log(size.dpr),
};
async function consume() {
  const context = await ZhudaEngine.boot(options);
  const scene = Zhuda3D.createScene3D(context.rootScene);
  const camera = Zhuda3D.createCamera(scene, { position: [0, 2, 6] });
  applySceneQuality(sceneQuality.low, context.runtime, camera);
  const scope = new ZhudaResourceScope();
  const models = new ZhudaModelLibrary();
  const instance = await models.instantiate("/models/pig.bin", {
    independentMaterials: true,
  });
  scope.own(instance, (model) => model.dispose());
  instance.setTint([1, 0.1, 0.1, 1]);
  const coordinates = new ZhudaCameraCoordinates(camera, () => ({
    left: 0,
    top: 0,
    width: 390,
    height: 844,
    backingWidth: 780,
    backingHeight: 1688,
  }));
  const queries = new ZhudaSceneQueries();
  const rig = new ZhudaCameraRig(camera, {
    collision: { queries, radius: 0.4, clearance: 0.2 },
  });
  rig.update({ x: 0, y: 3, z: 0 });
  const safe = resolveCameraBoom(
    { x: 0, y: 3, z: 0 },
    { x: 0, y: 4, z: 8 },
    { queries },
  );
  console.log(safe.blocked);
  const hit: QueryHit | null = queries.raycast(coordinates.screenToRay(10, 20));
  // A miss must remain nullable in the generated public declarations.
  // @ts-expect-error a hit needs a null check
  const unsafe: QueryHit = queries.raycast(coordinates.screenToRay(10, 20));
  console.log(hit?.entityId, unsafe, inspectSceneResources());
  const clock = new ZhudaSimulationClock();
  const snapshots = new ZhudaSnapshotBuffer(
    "round-1",
    (a: number, b: number, t) => a + (b - a) * t,
  );
  const gate = new ZhudaEventGate("round-1");
  clock.advance(0.016, (_dt, tick) =>
    gate.dispatch(String(tick), clock.simulationTime, () => {}),
  );
  console.log(snapshots.sample(0)?.value);
  const mesh = new ZhudaDynamicMesh(
    {
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      indices: new Uint16Array([0, 1, 2]),
    },
    scene,
  );
  mesh.dispose();
  scope.dispose();
  models.dispose();
  context.dispose();
}
void consume;

import {
  ZhudaTerrain2D,
  ZhudaTerrain2DRenderer,
  ZhudaHeightfield,
  ZhudaTerrain3D,
  ZhudaShaderMaterial,
  shaderRecipes,
  type Terrain2DSpec,
} from "zhuda-laya-engine";
const tiles: Terrain2DSpec = {
  schemaVersion: 1,
  dimension: 2,
  width: 1,
  height: 1,
  tileSize: 20,
  palette: [{ id: 1, color: "#339955" }],
  layers: [{ id: "ground", tiles: [1] }],
};
const tileData = new ZhudaTerrain2D(tiles);
const renderer2D = new ZhudaTerrain2DRenderer(tileData);
renderer2D.setView({ x: 0, y: 0, width: 20, height: 20 });
const field = ZhudaHeightfield.generate({
  cellsX: 4,
  cellsZ: 4,
  cellSize: 1,
  seed: 42,
});
const shader = new ZhudaShaderMaterial({
  ...shaderRecipes.terrain3D,
  fog: false,
});
const renderer3D = new ZhudaTerrain3D(field, {
  material: shader.material,
  chunkCells: 4,
  solid: { depth: 12 },
});
renderer3D.setRegion({ minX: 0, minZ: 0, maxX: 4, maxZ: 4 });
const terrainMiss = renderer3D.raycast({
  origin: { x: 0, y: 10, z: 0 },
  direction: { x: 0, y: -1, z: 0 },
});
console.log(terrainMiss?.position, renderer2D.residentChunks);
// @ts-expect-error the public spec preserves the dimension discriminator
new ZhudaTerrain2D({ schemaVersion: 1, dimension: 3, width: 1 });
