import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaModelLibrary,
  ZhudaDynamicMesh,
  ZhudaSceneQueries,
  ZhudaSimulationClock,
  ZhudaRealtimeClock,
  ZhudaLayeredClock,
  ZhudaTimerScheduler,
  ZhudaActionStateMachine,
  ZhudaInputBuffer,
  ZhudaSceneMutationQueue,
  ZhudaRenderSpace,
  ZhudaGraphicsGuard,
  ZhudaObjectPool,
  ZhudaCombatWorld,
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
} from 'zhuda-laya-engine';
const options: ZhudaBootOptions = {
  container: '#game',
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
  const instance = await models.instantiate('/models/pig.bin', {
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
  const safe = resolveCameraBoom({ x: 0, y: 3, z: 0 }, { x: 0, y: 4, z: 8 }, { queries });
  console.log(safe.blocked);
  const hit: QueryHit | null = queries.raycast(coordinates.screenToRay(10, 20));
  // A miss must remain nullable in the generated public declarations.
  // @ts-expect-error a hit needs a null check
  const unsafe: QueryHit = queries.raycast(coordinates.screenToRay(10, 20));
  console.log(hit?.entityId, unsafe, inspectSceneResources());
  const clock = new ZhudaSimulationClock();
  const realtime = new ZhudaRealtimeClock();
  realtime.timeScale = 0.5;
  const scheduler = new ZhudaTimerScheduler();
  scheduler.scheduleOnce(0.1, () => {}, { channel: 'unscaled' });
  const layered = new ZhudaLayeredClock({ world: { timeScale: 0.5 }, ui: { timeScale: 1 } });
  layered.advance(0.016);
  scheduler.scheduleOnce(0.01, () => {}, { layer: 'world' });
  scheduler.advance(layered.unscaledDeltaTime, realtime.scaledDeltaTime, layered.scaledDeltas);
  const action = new ZhudaActionStateMachine({
    id: 'light',
    frameRate: 60,
    frameCount: 12,
    startup: { from: 0, until: 3 },
    active: { from: 3, until: 6 },
    recovery: { from: 6, until: 12 },
    sockets: [{ id: 'hand', bone: 'hand_r' }],
  });
  action.play();
  action.advance(1 / 60);
  const input = new ZhudaInputBuffer();
  input.push('light', 0);
  input.consume('light', 0);
  const mutations = new ZhudaSceneMutationQueue();
  mutations.deferDestroy(() => {});
  const renderSpace = new ZhudaRenderSpace();
  renderSpace.register({ onRenderOverlay: () => {} });
  const graphics = new ZhudaGraphicsGuard({} as any);
  graphics.drawCircle(0, 0, 1, '#fff');
  const pool = new ZhudaObjectPool({ capacity: 1, create: () => ({}) });
  pool.release(pool.acquire()!);
  const combat = new ZhudaCombatWorld();
  combat.registerHurtbox({
    id: 'hurt',
    ownerId: 'enemy',
    layer: 2,
    rect: { x: 0, y: 0, width: 1, height: 1 },
  });
  combat.registerHitbox({
    id: 'hit',
    ownerId: 'hero',
    layer: 1,
    mask: 2,
    swingId: 1,
    rect: { x: 0, y: 0, width: 1, height: 1 },
  });
  console.log(
    realtime.sample(),
    scheduler.size,
    mutations.size,
    renderSpace.size,
    pool.activeCount,
    combat.hurtboxCount,
  );
  const snapshots = new ZhudaSnapshotBuffer(
    'round-1',
    (a: number, b: number, t) => a + (b - a) * t,
  );
  const gate = new ZhudaEventGate('round-1');
  clock.advance(0.016, (_dt, tick) => gate.dispatch(String(tick), clock.simulationTime, () => {}));
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
} from 'zhuda-laya-engine';
const tiles: Terrain2DSpec = {
  schemaVersion: 1,
  dimension: 2,
  width: 1,
  height: 1,
  tileSize: 20,
  palette: [{ id: 1, color: '#339955' }],
  layers: [{ id: 'ground', tiles: [1] }],
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

import {
  ZhudaLitSurfaceMaterial,
  ZhudaFilmicPipeline,
  ZhudaPlanarReflection,
  computeMeshTangents,
  createPrefilteredEnvironment,
} from 'zhuda-laya-engine';
const lit = new ZhudaLitSurfaceMaterial({
  name: 'PublicWetStone',
  normalConvention: 'opengl',
  uniforms: { u_ZhudaWet: { type: 'float', value: 0.5 } },
  material: { roughness: 0.8, clearCoat: 0.2 },
  surface: `void zhudaSurface(inout ZhudaLitSurface s,vec2 uv,vec3 p,vec3 n){s.roughness=mix(.8,.2,u_ZhudaWet);}`,
});
lit.set('u_ZhudaWet', 0.7);
const pipeline = new ZhudaFilmicPipeline({}, { temporalAA: true });
pipeline.resetHistory();
pipeline.dispose();
const reflection = new ZhudaPlanarReflection({}, { width: 512, height: 512, excludedLayer: 2 });
const columns = reflection.update([0, 2, 4], [0, 0, 0], 45, 16 / 9);
computeMeshTangents({
  positions: new Float32Array(9),
  normals: new Float32Array(9),
  uvs: new Float32Array(6),
  indices: new Uint16Array([0, 1, 2]),
});
createPrefilteredEnvironment(
  {
    size: 1,
    levels: [{ size: 1, offset: 0, elements: 24 }],
    ambientSH: Array(27).fill(0),
  },
  new Float32Array(24),
);
console.log(columns);
import {
  ZhudaUI,
  ZhudaPrefab,
  ZhudaPrefabLibrary,
  DirectoryAssetProvider,
  inspectPrefabInstance,
} from 'zhuda-laya-engine';
const prefabLibrary = new ZhudaPrefabLibrary({
  provider: new DirectoryAssetProvider({ baseUrl: '/assets/' }),
  definitions: [{ id: 'panel', asset: 'panel.lh', states: { default: {} } }],
});
prefabLibrary.instantiate('panel').then((instance) => {
  const child: Laya.Sprite = instance.find('value');
  inspectPrefabInstance(instance.root);
  ZhudaUI.createVectorButton(child, 0, 0, 'OK', { width: 80, height: 30 }, () => {});
  ZhudaPrefab.instantiate({ _$id: 'label', _$type: 'Text' }, child);
  instance.dispose();
});
import {
  createSurfaceMaterial as createPhysicalSurface,
  configureSurfacePasses as askCameraPasses,
  physicalSurfaceTextureLimit,
  surfaceMaterialPasses,
  validatePhysicalSurfaceSpec,
  type PhysicalSurfaceUse,
  type SurfaceMaterialSpec,
} from 'zhuda-laya-engine';
const glassSpec: SurfaceMaterialSpec = {
  type: 'physical',
  roughness: 0.05,
  ior: 1.5,
  specular: { factor: 1, color: [1, 1, 1] },
  transmission: {
    factor: 1,
    volume: { thickness: 0.3, attenuationColor: [0.3, 0.85, 0.5], attenuationDistance: 0.3 },
  },
};
const clothSpec: SurfaceMaterialSpec = {
  type: 'physical',
  sheen: { color: [0.75, 0.78, 1], roughness: 0.4 },
  iridescence: { factor: 1, ior: 1.8, thicknessRange: [100, 500] },
  anisotropy: 0.8,
  anisotropyRotationDeg: 135,
};
// The spec as docs/filmic-rendering.md writes it: a literal `as const`, whose
// colours are readonly tuples.
const literalGlassSpec = {
  type: 'physical',
  roughness: 0.05,
  ior: 1.5,
  transmission: {
    factor: 1,
    volume: { thickness: 0.3, attenuationColor: [0.3, 0.85, 0.5], attenuationDistance: 0.3 },
  },
} as const;
function physicalSurfaces(camera: Laya.Camera) {
  const problems: string[] = validatePhysicalSurfaceSpec(glassSpec);
  const passes = askCameraPasses(camera, [surfaceMaterialPasses(glassSpec)], 1);
  if (!problems.length && passes.ready) createPhysicalSurface(glassSpec);
  askCameraPasses(camera, [surfaceMaterialPasses(literalGlassSpec)], 1);
  createPhysicalSurface(literalGlassSpec);
  // On a lightmapped renderer a surface carries fewer textures.
  const use: PhysicalSurfaceUse = { lightmap: 'directional' };
  const most: number = physicalSurfaceTextureLimit(use);
  if (validatePhysicalSurfaceSpec(clothSpec, use).length || most < 1) return null;
  return createPhysicalSurface(clothSpec);
}
console.log(physicalSurfaces);
