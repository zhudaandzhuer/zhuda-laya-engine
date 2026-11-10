import {
  ZhudaEngine,
  Zhuda3D,
  ZhudaModelLibrary,
  ZhudaAssetShowcase,
  ZhudaModelInspector,
  DirectoryAssetProvider,
  inspectSceneResources,
  type AssetShowcaseMode,
} from 'zhuda-laya-engine';
const start = async () => {
  const params = new URLSearchParams(location.search);
  const context = await ZhudaEngine.boot({
    container: '#game',
    width: 720,
    height: 480,
    dprCap: Number(params.get('dpr') || 1),
    features: ['core', '2d', '3d', 'gltf', 'postProcess'],
    preserveDrawingBuffer: true,
  });
  const scene = Zhuda3D.createScene3D(context.rootScene);
  const camera = Zhuda3D.createCamera(scene, {
    position: [0, 0, 3],
    clearColor: [0.04, 0.07, 0.11, 1],
  });
  const provider = new DirectoryAssetProvider({ baseUrl: './assets/' });
  const library = new ZhudaModelLibrary({ provider, maxIdle: 0 });
  const initialCamera = {
    opaque: camera.opaquePass,
    hdr: camera.enableHDR,
    msaa: camera.msaa,
    depth: camera.depthTextureMode,
    post: camera.postProcess,
  };
  const show = new ZhudaAssetShowcase({ library, parent: scene, camera });
  const load = async (id: string) => {
    await show.load(id);
    const inspector = new ZhudaModelInspector(show.instance!);
    for (const a of inspector.inspect().animations) inspector.setAnimationSpeed(a.path, 0);
    return inspector.inspect();
  };
  const asset = params.get('asset') || 'multi-cubicspline.gltf';
  await load(asset);
  const selected = params.get('node');
  if (selected) {
    const inspector = new ZhudaModelInspector(show.instance!);
    const target = inspector.inspect().nodes.find((n) => n.name === selected);
    if (!target) throw Error('Unknown selection');
    for (const n of inspector.inspect().nodes)
      if (
        n.path !== target.path &&
        !target.path.startsWith(n.path + '/') &&
        !n.path.startsWith(target.path + '/')
      )
        inspector.node(n.path).active = false;
  }
  const morph = (channel: string, weight: number) => {
    const inspector = new ZhudaModelInspector(show.instance!);
    const n = inspector.inspect().nodes.find((n) => channel in n.morphWeights);
    if (!n) throw Error('Unknown morph');
    inspector.setMorphWeight(n.path, channel, weight);
  };
  if (params.get('state') === 'weighted') morph('bend', 1);
  show.setMode((params.get('mode') || 'raw') as AssetShowcaseMode);
  context.runtime.start(() => {});
  ZhudaEngine.flushRenderFrames(3);
  const frames = async (n = 3) => {
    for (let i = 0; i < n; i++) await new Promise<void>((r) => requestAnimationFrame(() => r()));
  };
  const report = () => ({
    inspection: show.instance ? show.inspect() : null,
    models: library.report(),
    resources: inspectSceneResources(),
    mode: show.mode,
    dpr: devicePixelRatio,
    canvas: [context.canvas.width, context.canvas.height],
    camera: {
      opaque: camera.opaquePass,
      hdr: camera.enableHDR,
      msaa: camera.msaa,
      depth: camera.depthTextureMode,
      post: !!camera.postProcess,
    },
  });
  const api = {
    ready: true,
    load,
    report,
    morph,
    mode: (m: AssetShowcaseMode) => {
      show.setMode(m);
      ZhudaEngine.flushRenderFrames(3);
      return report();
    },
    async sample(id: string, t: number) {
      await load(id);
      const inspector = new ZhudaModelInspector(show.instance!);
      for (const a of inspector.inspect().animations)
        inspector.play(a.path, a.name, { layer: a.layer, normalizedTime: t, speed: 1e-8 });
      await frames();
      for (const a of inspector.inspect().animations) inspector.setAnimationSpeed(a.path, 0);
      return inspector.inspect();
    },
    async clones() {
      const a = await library.instantiate('node-weights.gltf'),
        b = await library.instantiate('node-weights.gltf');
      const ia = new ZhudaModelInspector(a),
        ib = new ZhudaModelInspector(b);
      const target = ia.inspect().nodes.find((n) => 'bend' in n.morphWeights)!;
      ia.setMorphWeight(target.path, 'bend', 0.3);
      const values = [ia.inspect(), ib.inspect()];
      a.dispose();
      b.dispose();
      return values;
    },
    async lifecycle() {
      const results = [];
      for (let i = 0; i < 33; i++) {
        show.setMode('raw');
        show.clear();
        await load(asset);
        for (const m of ['gameplay', 'cinematic', 'raw'] as const) {
          show.setMode(m);
          await frames();
        }
        show.clear();
        await frames();
        results.push(report());
      }
      await load(asset);
      return results;
    },
    async failure() {
      const malformed = [];
      for (let i = 0; i < 30; i++) {
        try {
          await show.load('invalid-cubic.gltf');
        } catch (e) {
          malformed.push(String(e));
        }
      }
      const failureResources = inspectSceneResources();
      const node = show.instance!.node;
      let rejected = '';
      try {
        await show.load('required-extension.gltf');
      } catch (e) {
        rejected = String(e);
      }
      const kept = show.instance!.node === node;
      const c = new AbortController();
      c.abort();
      let aborted = '';
      try {
        await show.load(asset, { signal: c.signal });
      } catch (e) {
        aborted = String(e);
      }
      let timeout = '';
      try {
        await show.load('slow.gltf', { timeoutMs: 10 });
      } catch (e) {
        timeout = String(e);
      }
      const slow = show.load('slow.gltf');
      await show.load(asset);
      const stale = await slow;
      return {
        rejected,
        kept,
        aborted,
        timeout,
        stale,
        models: library.report(),
        malformed,
        failureResources,
      };
    },
    dispose() {
      show.dispose();
      library.dispose();
      provider.dispose();
      const restored =
        camera.opaquePass === initialCamera.opaque &&
        camera.enableHDR === initialCamera.hdr &&
        camera.msaa === initialCamera.msaa &&
        camera.depthTextureMode === initialCamera.depth &&
        camera.postProcess === initialCamera.post;
      const value = { restored, ...report() };
      context.dispose();
      return value;
    },
  };
  Object.assign(window, { modelTest: api });
};
start().catch((error) =>
  Object.assign(window, { modelTest: { ready: false, error: String(error) } }),
);
