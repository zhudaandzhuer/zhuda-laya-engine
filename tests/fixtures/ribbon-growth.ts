// Fixture for scripts/verify-ribbon-growth.mjs: a 3D ribbon whose point
// count changes between drawn frames. It is first drawn with 3 points (two
// quads at the left edge), then grows to 54 points across the view, shrinks
// to 10 and grows again to 40. After each step the page reports what the
// draw call will use (the render element's index range) and the check
// screenshots it. Before the fix the WebGPU draw kept the first range.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__RIBBON__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const frame = () => new Promise<void>((resolve) => Laya.timer.frameOnce(1, null, resolve));

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  const context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: 640,
    height: 360,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
  });
  context.runtime.start(() => {});
  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [1, 1, 1, 1] });
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 0, 5],
    clearColor: [0, 0, 0, 1],
  });
  const path = new Z.ZhudaRibbonPath3D({ maxPoints: 64, width: 0.5 });
  path.edgeFade = 1e-4; // Must be positive; this keeps the ends opaque.
  const ribbon = new Z.ZhudaLayaRibbonRenderer3D(
    path,
    scene,
    Laya.Texture2D.whiteTexture,
    '#ffffff',
    'alpha',
  );
  // `count` points along y = 0 from x0 to x1 (world units; the view spans
  // about x -3.7..3.7 at z = 0).
  const line = (count: number, x0: number, x1: number) =>
    Array.from({ length: count }, (_, i) => ({
      x: x0 + ((x1 - x0) * i) / (count - 1),
      y: 0,
      z: 0,
    }));
  const element = () => ribbon.node.meshRenderer._renderElements[0];
  out.step = async (count: number, x0: number, x1: number) => {
    path.setPoints(line(count, x0, x1));
    // Several frames: the bug kept the range for good, not for one frame.
    for (let i = 0; i < 4; i++) {
      ribbon.render(camera);
      await frame();
    }
    const geometry = element()._renderElementOBJ.geometry;
    const params = geometry.drawParams || geometry._drawElementInfo;
    const list = Array.from(params.elements.slice(0, params.length) as ArrayLike<number>);
    // Both backends keep [byte offset, index count] pairs, one per draw call.
    let drawn = 0;
    for (let i = 1; i < list.length; i += 2) drawn += list[i];
    // Where the band's ends land, as fractions of the viewport width.
    const ends = [x0, x1].map((x) => {
      const p = new Laya.Vector4();
      camera.worldToViewportPoint(new Laya.Vector3(x, 0, 0), p);
      return p.x / camera.viewport.width;
    });
    return {
      expected: ends,
      points: count,
      submittedIndices: (count - 1) * 6,
      subMeshIndices: element()._geometry._indexCount,
      drawnIndices: drawn,
    };
  };
  await frame();
  out.ready = true;
}
main().catch((error) => out.errors.push(String(error?.stack || error)));
