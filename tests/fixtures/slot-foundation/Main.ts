import {
  ZhudaEngine,
  DirectoryAssetProvider,
  ZhudaThemeController,
  ZhudaPrefabLibrary,
  ZhudaResultPlayback,
  inspectSceneResources,
} from 'zhuda-laya-engine';
import type {
  ZhudaThemeManifest,
  ZhudaThemeContract,
  PrefabDefinition,
  PrefabInstance,
  ZhudaResultEnvelope,
} from 'zhuda-laya-engine';
import { themes, contract, definitions } from './themes';
type Presentation = { library: ZhudaPrefabLibrary; instance: PrefabInstance };
type Result = { symbols: number[] };
const params = new URLSearchParams(location.search),
  selection = params.get('id') || 'factory.grid',
  node = params.get('node') || '';
const scope = { gameId: 'neutral-grid', sessionId: 'fixture', epoch: 'v1' };
const store = {
  read: (key: string) => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  },
  write: (key: string, value: unknown) => localStorage.setItem(key, JSON.stringify(value)),
};
const playback = new ZhudaResultPlayback<Result>({
  scope,
  store,
  validate: (value) => {
    if (value.resultVersion !== 'fixture-v1' || value.payload.symbols.length !== 15)
      throw Error('Unknown fixture result');
  },
  validateCursor: (_r, c, done) => {
    if (c > 1 || (done && c !== 1)) throw Error('Invalid fixture cursor');
  },
});
let authoritative: ZhudaResultEnvelope<Result> | null = playback.snapshot().result;
async function main() {
  const context = await ZhudaEngine.boot({
    container: '#game',
    width: 640,
    height: 360,
    dprCap: 3,
    features: ['core', '2d', 'ui'],
    preserveDrawingBuffer: true,
    bgColor: '#152030',
  });
  const source = new DirectoryAssetProvider({ baseUrl: './assets/' });
  const controller = new ZhudaThemeController<Presentation>(
    source,
    contract as ZhudaThemeContract,
    2_000_000,
  );
  const releases: unknown[] = [];
  let ready = false,
    disposed = false,
    rounds = 0,
    remaining = 0,
    complete: (() => void) | undefined;
  let durations: number[] = [],
    lastFrame = performance.now();
  const prepare = async (
    provider: Parameters<Parameters<typeof controller.replace>[1]>[0],
    signal: AbortSignal,
  ) => {
    const library = new ZhudaPrefabLibrary({
      provider,
      definitions: definitions as PrefabDefinition[],
    });
    try {
      const instance = await library.instantiate(selection, { signal });
      return {
        value: { library, instance },
        dispose() {
          library.dispose();
          releases.push(library.report());
        },
      };
    } catch (error) {
      library.dispose();
      throw error;
    }
  };
  async function switchTheme(id: string) {
    const manifest = themes.find((t) => t.id === id);
    if (!manifest) throw Error('Missing theme');
    if (await controller.replace(manifest as ZhudaThemeManifest, prepare)) {
      const instance = controller.current!.value.instance;
      context.rootScene.addChild(instance.root);
      if (node) {
        const target = instance.find(node),
          keep = new Set<Laya.Node>();
        for (let p: Laya.Node | null = target; p; p = p.parent) keep.add(p);
        const visit = (parent: Laya.Node) => {
          for (let i = 0; i < parent.numChildren; i++) {
            const child = parent.getChildAt(i);
            if (!keep.has(child) && parent !== target) child.active = false;
            else visit(child);
          }
        };
        visit(instance.root);
      }
      ZhudaEngine.flushRenderFrames(3);
    }
  }
  await switchTheme(params.get('theme') || 'a');
  await playback.recover({ reconcile: async () => authoritative });
  context.runtime.start(() => {
    const now = performance.now();
    if (remaining > 0) {
      durations.push(now - lastFrame);
      const sequence = (playback.snapshot().result?.sequence ?? 0) + 1;
      authoritative = {
        schemaVersion: 1,
        ...scope,
        sequence,
        roundId: 'fixture-' + sequence,
        resultVersion: 'fixture-v1',
        payload: { symbols: Array.from({ length: 15 }, (_, i) => (sequence + i) % 6) },
      };
      playback.accept(authoritative);
      const instance = controller.current!.value.instance;
      for (let i = 0; i < 15; i++)
        (instance.find('Cell' + i + '/Label') as Laya.Label).text = String(
          authoritative.payload.symbols[i],
        );
      playback.advance(sequence, 1, true);
      rounds++;
      remaining--;
      if (!remaining) complete?.();
    }
    lastFrame = now;
  });
  await document.fonts.ready;
  ZhudaEngine.flushRenderFrames(3);
  ready = true;
  const report = () => ({
    ready,
    disposed,
    selection: { id: selection, node, state: 'idle' },
    theme: controller.current?.manifest.id,
    provenance: controller.current?.value.instance.provenance,
    resources: controller.current?.value.library.report(),
    sceneResources: inspectSceneResources(),
    dpr: devicePixelRatio,
    canvas: [context.canvas.width, context.canvas.height],
    rounds,
    checkpoint: playback.snapshot(),
    inputLocked: playback.inputLocked,
    releaseCount: releases.length,
    releases,
  });
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    controller.dispose();
    source.dispose();
    playback.dispose();
    context.dispose();
  };
  window.addEventListener('pagehide', dispose, { once: true });
  const api = {
    ready,
    report,
    switchTheme,
    dispose,
    async cycles() {
      const results = [];
      for (let i = 0; i < 100; i++) {
        await switchTheme(i % 2 ? 'a' : 'b');
        results.push(inspectSceneResources());
      }
      return results;
    },
    async benchmark() {
      durations = [];
      remaining = 1000;
      lastFrame = performance.now();
      await new Promise<void>((resolve) => (complete = resolve));
      const sorted = [...durations].sort((a, b) => a - b);
      return {
        rounds,
        frames: durations.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        over50ms: durations.filter((n) => n > 50).length,
        raw: durations,
      };
    },
    async recovery() {
      playback.suspend();
      const locked = playback.inputLocked;
      await playback.recover({ reconcile: async () => authoritative });
      return { locked, after: playback.snapshot(), unlocked: !playback.inputLocked };
    },
    async failure() {
      const previous = controller.current;
      const bad = structuredClone(themes[0]) as ZhudaThemeManifest;
      const mutated = { ...bad, assets: bad.assets.map((a) => ({ ...a, sha256: '0'.repeat(64) })) };
      let error = '';
      try {
        await controller.replace(mutated, prepare);
      } catch (e) {
        error = String(e);
      }
      return { error, kept: controller.current === previous };
    },
  };
  (window as unknown as { factoryTest: typeof api }).factoryTest = api;
}
void main().catch((error) => {
  (window as unknown as { factoryError: string }).factoryError = String(error);
});
