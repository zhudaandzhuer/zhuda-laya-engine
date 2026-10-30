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
