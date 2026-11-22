// Fixture for scripts/verify-effects-2d.mjs: the built-in 2D effect presets
// (ZHUDA_EFFECT_PRESETS_2D) played by ZhudaEffect2D on a Laya 2D stage. The
// check opens one preset at a time, fitted into the view by its sizePixels
// and origin, asks for moments with seek, and screenshots each. A probe of
// one large soft particle tells whether the sprites' alpha reaches the
// screen as it should with each blend. Runtime functions come from the
// browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__FX2D__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 400,
  H = 300;
const frame = () => new Promise<void>((resolve) => Laya.timer.frameOnce(1, null, resolve));
const frames = async (n: number) => {
  for (let i = 0; i < n; i++) await frame();
};
const resources = () => Object.keys(Laya.Resource?._idResourcesMap ?? {}).length;

async function main() {
  const context = await Z.ZhudaEngine.boot({
    renderer: 'webgl',
    container: document.querySelector('#view'),
    width: W,
    height: H,
    dprCap: 1,
    bgColor: '#000000',
    features: [...(globalThis as any).ZhudaBundle.features],
  });
  context.runtime.start(() => {});
  out.gpu = context.renderer;
  const holder = new Laya.Sprite();
  holder.name = 'effects';
  context.rootScene.addChild(holder);
  let current: any = null;
  /** Where a preset goes and how big, so that its box fits the view. */
  const place = (preset: any) => {
    const [w, h] = preset.sizePixels;
    const scale = Math.max(0.05, Math.min(1, (0.92 * W) / w, (0.92 * H) / h));
    return {
      x: W / 2 + (preset.origin[0] - 0.5) * w * scale,
      y: H / 2 + (preset.origin[1] - 0.5) * h * scale,
      scale,
    };
  };
  const drawn = async () => {
    current?.render();
    await frames(3);
    return { alive: current?.aliveCount ?? 0, seconds: current?.seconds ?? 0 };
  };
  out.open = (id: string, seed = 0) => {
    current?.dispose();
    const preset = Z.ZHUDA_EFFECT_PRESETS_2D[id];
    current = new Z.ZhudaEffect2D(holder, id, { ...place(preset), seed });
    return { ...place(preset), emitters: preset.effect.emitters.length };
  };
  out.show = async (seconds: number) => {
    current.seek(seconds);
    return drawn();
  };
  /** A trail moved along an arc by the game's own frames (update, not seek). */
  out.trail = async (steps: number) => {
    const at = (i: number) => {
      const a = (i / steps) * Math.PI;
      return [W / 2 - Math.cos(a) * 150, H / 2 + 60 - Math.sin(a) * 120] as [number, number];
    };
    // Put it at the start before the restart: otherwise its first step would
    // lay a trail from where it was to where the arc begins.
    current.setPosition(...at(0));
    current.restart();
    for (let i = 1; i <= steps; i++) {
      current.setPosition(...at(i));
      current.update(1 / 60);
    }
    return drawn();
  };
  out.close = async () => {
    current?.dispose();
    current = null;
    await frames(3);
    return { children: holder.numChildren, resources: resources() };
  };
  /** One soft particle 200 pixels across at the centre, white, for ever. */
  out.probe = async (blend: 'alpha' | 'additive') => {
    current?.dispose();
    current = new Z.ZhudaEffect2D(
      holder,
      {
        description: 'A probe: one large soft white particle that stays.',
        kind: 'loop',
        sizePixels: [200, 200],
        origin: [0.5, 0.5],
        seconds: 1,
        effect: {
          schemaVersion: 1,
          emitters: [
            {
              id: 'probe',
              texture: 'soft',
              maxParticles: 1,
              seed: 1,
              space: 'world',
              blend,
              shape: { type: 'point' },
              rate: 0,
              bursts: [{ time: 0, count: 1 }],
              duration: 10,
              loop: false,
              lifetime: 100,
              speed: 0,
              angle: 0,
              size: 200,
            },
          ],
        },
      },
      { x: W / 2, y: H / 2, spriteSize: 256 },
    );
    current.seek(0.1);
    return drawn();
  };
  /** Thirty effects made and released: the holder is empty and no resource is left. */
  out.cycles = async (id: string, n: number) => {
    await out.close();
    const before = resources();
    for (let i = 0; i < n; i++) {
      out.open(id, i);
      current.seek(0.2);
      current.render();
      await frame();
    }
    const after = await out.close();
    return { before, after: after.resources, children: after.children };
  };
  await frames(2);
  out.ready = true;
}
main().catch((error) => out.errors.push(String(error?.stack || error)));
