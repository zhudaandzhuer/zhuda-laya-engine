import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaPrefabLibrary,
  inspectSceneResources,
  type PrefabInstance,
} from 'zhuda-laya-engine';
import { definitions, createAssetProvider, preview3D } from './prefabs';
async function main() {
  const params = new URLSearchParams(location.search);
  let ticks = 0,
    losses = 0,
    clears = 0,
    clicks = 0;
  const abort = new AbortController();
  if (params.get('abort') === 'before') abort.abort();
  Object.assign(window, { backendAbort: () => abort.abort() });
  const context = await ZhudaEngine.boot({
    signal: abort.signal,
    bootTimeoutMs: Number(params.get('timeout') || 30000),
    container: '#game',
    width: 640,
    height: 360,
    dprCap: 3,
    features: ['core', '2d', '3d', 'ui'],
    preserveDrawingBuffer: true,
    bgColor: '#152030',
    onContextLost: () => losses++,
    clearInput: () => clears++,
  });
  const provider = createAssetProvider(),
    library = new ZhudaPrefabLibrary({ provider, definitions, share3DResources: true });
  const scene = Zhuda3D.createScene3D(context.rootScene, { ambientColor: [0.4, 0.4, 0.4, 1] });
  Zhuda3D.createCamera(scene, preview3D.camera);
  Zhuda3D.createDirectionalLight(scene, { rotationEuler: [-35, -30, 0], intensity: 1 });
  const instances: PrefabInstance<Laya.Node>[] = [];
  const id = params.get('id');
  const mount = async () => {
    for (const definition of definitions) {
      if (id && id !== definition.id) continue;
      instances.push(
        await library.instantiate(definition.id, {
          parent: definition.kind === '3d' ? scene : context.rootScene,
          state: 'idle',
        }),
      );
    }
  };
  await mount();
  if (id === 'backend.2d') scene.active = false;
  const selected = params.get('node');
  if (selected)
    for (const instance of instances) {
      const target = instance.find(selected),
        keep = new Set<Laya.Node>();
      for (let p: Laya.Node | null = target; p; p = p.parent) keep.add(p);
      const visit = (parent: Laya.Node) => {
        for (let i = 0; i < parent.numChildren; i++) {
          const child = parent.getChildAt(i);
          if (!keep.has(child) && parent !== target) {
            if (instance.provenance.kind === '3d') child.active = false;
            else (child as Laya.Sprite).visible = false;
          } else visit(child);
        }
      };
      visit(instance.root);
    }
  const panel = instances.find(
    (_, index) => definitions.filter((d) => !id || id === d.id)[index].id === 'backend.2d',
  );
  const icon = panel?.find('Icon') as Laya.Sprite | undefined;
  icon?.on(Laya.Event.CLICK, () => clicks++);
  context.runtime.start(() => ticks++);
  await document.fonts.ready;
  ZhudaEngine.flushRenderFrames(3);
  const frames = async () => {
    for (let i = 0; i < 4; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
  };
  await frames();
  const report = () => ({
    renderer: context.renderer,
    ticks,
    losses,
    clears,
    clicks,
    paused: context.runtime.paused,
    contextLost: context.runtime.contextLost,
    dpr: devicePixelRatio,
    canvas: [context.canvas.width, context.canvas.height],
    provenance: instances.map((i) => i.provenance),
    library: library.report(),
    resources: inspectSceneResources(),
    icon: icon ? { x: icon.x, y: icon.y, width: icon.width, height: icon.height } : null,
  });
  Object.assign(window, {
    backendTest: {
      ready: true,
      report,
      async cycles() {
        const results = [];
        for (let i = 0; i < 30; i++) {
          instances.splice(0).forEach((i) => i.dispose());
          await mount();
          await frames();
          results.push(report());
        }
        return results;
      },
      dispose() {
        instances.splice(0).forEach((i) => i.dispose());
        library.dispose();
        provider.dispose();
        context.dispose();
        return report();
      },
    },
  });
}
void main().catch((error) =>
  Object.assign(window, { backendTest: { ready: false, error: String(error) } }),
);
