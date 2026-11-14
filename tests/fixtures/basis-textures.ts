// Real-draw fixture for scripts/verify-basis-textures.mjs: KTX 2 / Basis
// textures (made by tests/helpers/ktx2-fixture.mjs, served beside this page
// with the pixels they stand for) are transcoded to every block format this
// device samples, uploaded through LayaAir's own parsers and drawn on a
// plane, next to the same pixels uploaded uncompressed.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__BASIS__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const W = 480,
  H = 300;
/** The plane is 224 pixels across at scale 1: at this scale a 1024 texel map is a texel to a pixel. */
const LARGE_SCALE = 1024 / 224;
let context: any;
let gl: WebGL2RenderingContext | null = null;

function read() {
  if (gl) {
    const raw = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    const pixels = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y++)
      pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
    return pixels;
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const copy = canvas.getContext('2d', { willReadFrequently: true })!;
  copy.drawImage(context.canvas, 0, 0, W, H);
  return new Uint8Array(copy.getImageData(0, 0, W, H).data.buffer);
}
function png(pixels: Uint8Array) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const image = canvas.getContext('2d')!.createImageData(W, H);
  image.data.set(pixels);
  canvas.getContext('2d')!.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
const saved: Record<string, Uint8Array> = {};
out.picture = (name: string) => png(saved[name]);

/** Pixels that are not the background (the colour of the frame's corner), and how far two frames differ over them. */
const BACKGROUND = [32, 36, 40];
const covered = (p: Uint8Array) => {
  const list: number[] = [];
  for (let i = 0; i < p.length; i += 4)
    if (Math.abs(p[i] - p[0]) > 3 || Math.abs(p[i + 1] - p[1]) > 3 || Math.abs(p[i + 2] - p[2]) > 3)
      list.push(i);
  return list;
};
function compare(a: Uint8Array, b: Uint8Array, where: number[]) {
  let sum = 0,
    worst = 0,
    over = 0;
  for (const i of where)
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(a[i + c] - b[i + c]);
      sum += d;
      if (d > worst) worst = d;
      if (d > 12) over++;
    }
  return {
    pixels: where.length,
    mean: +(sum / Math.max(1, where.length * 3)).toFixed(3),
    worst,
    // Share of channel values further than 12 of 255 from the reference.
    over12: +(over / Math.max(1, where.length * 3)).toFixed(4),
  };
}
const meanColor = (p: Uint8Array, where: number[]) => {
  const sum = [0, 0, 0];
  for (const i of where) for (let c = 0; c < 3; c++) sum[c] += p[i + c];
  return sum.map((v) => +(v / Math.max(1, where.length)).toFixed(1));
};

async function bytes(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw Error(`${url}: HTTP ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: W,
    height: H,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
    preserveDrawingBuffer: true,
    bgColor: '#202428',
  });
  if (renderer === 'webgl') gl = context.canvas.getContext('webgl2');
  context.runtime.start(() => {});
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
    adapter: context.renderer.adapter ?? null,
    features: context.renderer.features ?? null,
  };
  const support = (out.support = Z.zhudaBasisSupport());

  const scene = Z.Zhuda3D.createScene3D(context.rootScene, { ambientColor: [1, 1, 1] });
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 0, 5],
    target: [0, 0, 0],
    fov: 30,
  });
  camera.clearFlag = Laya.CameraClearFlags.SolidColor;
  camera.clearColor = new Laya.Color(
    BACKGROUND[0] / 255,
    BACKGROUND[1] / 255,
    BACKGROUND[2] / 255,
    1,
  );
  camera.enableHDR = false;
  // One plane facing the camera; its texture and its size change from draw to draw.
  const mesh = Z.Zhuda3D.createPrimitiveMesh('box', { width: 2, height: 2, depth: 0.02 });
  const plane = new Laya.MeshSprite3D(mesh);
  scene.addChild(plane);
  // The plane keeps a material until it has the next one: the stage goes on drawing between calls.
  let shown: any = null;
  const draw = (texture: any, alpha: boolean, scale: number) => {
    const material = Z.createSurfaceMaterial({
      type: 'unlit',
      color: [1, 1, 1, 1],
      textures: { albedo: texture },
      ...(alpha ? { blend: 'alpha' } : {}),
    });
    plane.meshRenderer.sharedMaterial = material;
    shown?.destroy();
    shown = material;
    plane.transform.localScale = new Laya.Vector3(scale, scale, 1);
    Z.ZhudaEngine.flushRenderFrames(3);
    return read();
  };
  /** Before a texture is destroyed: the plane lets go of it. */
  const blank = Z.createSurfaceMaterial({ type: 'unlit', color: [0.5, 0.5, 0.5, 1] });
  const release = () => {
    plane.meshRenderer.sharedMaterial = blank;
    shown?.destroy();
    shown = null;
  };

  const loadStarted = performance.now();
  const transcoder = await Z.loadZhudaBasisTranscoder({ baseUrl: 'libs/basis/' });
  out.transcoderLoadMs = +(performance.now() - loadStarted).toFixed(1);
  // A second call is the same transcoder.
  out.sameTranscoder =
    (await Z.loadZhudaBasisTranscoder({ baseUrl: 'libs/basis/' })) === transcoder;

  const manifest = JSON.parse(new TextDecoder().decode(await bytes('fixtures/manifest.json')));
  const targets = (alpha: boolean) => [
    'auto',
    ...(support.astc ? ['astc-4x4'] : []),
    ...(support.etc2 ? [alpha ? 'etc2-rgba' : 'etc2-rgb'] : []),
    ...(support.s3tc && support.s3tcSrgb ? [alpha ? 'bc3' : 'bc1'] : []),
    'rgba8',
  ];
  out.textures = {};
  for (const entry of manifest.textures) {
    const file = await bytes('fixtures/' + entry.file);
    const pixels = await bytes('fixtures/' + entry.pixels);
    const info = Z.inspectZhudaKtx2(file).info;
    const result: any = (out.textures[entry.name] = { info, targets: {} });
    // The reference: the same pixels, uncompressed, mip levels made by the graphics card.
    const reference = Z.createSurfaceTexture(entry.width, entry.height, pixels, 'color', {
      mipmap: true,
    });
    const referenceFrame = (saved[`${entry.name}-reference`] = draw(reference, entry.alpha, 1));
    const where = covered(referenceFrame);
    result.coveredPixels = where.length;
    const smallReference = draw(reference, entry.alpha, 0.22);
    const smallWhere = covered(smallReference);
    // Smaller still: four texels to a pixel, which is mip level 2.
    const tinyReference = draw(reference, entry.alpha, 0.07);
    const tinyWhere = covered(tinyReference);
    result.referenceTinyMean = meanColor(tinyReference, tinyWhere);
    // A size that is not a multiple of four has no block format: only what the device chooses.
    const fits = entry.width % 4 === 0 && entry.height % 4 === 0;
    if (!fits)
      result.forcedBlockFormat = (() => {
        try {
          Z.createZhudaBasisTexture(transcoder, file, { target: 'etc2-rgb' });
          return 'accepted';
        } catch (error) {
          return String((error as Error).message);
        }
      })();
    for (const name of fits ? targets(entry.alpha) : ['auto']) {
      const from = performance.now();
      const texture = Z.createZhudaBasisTexture(
        transcoder,
        file,
        name === 'auto' ? {} : { target: name },
      );
      const createMs = +(performance.now() - from).toFixed(2);
      const frame = draw(texture, entry.alpha, 1);
      saved[`${entry.name}-${name}`] = frame;
      const small = draw(texture, entry.alpha, 0.22);
      const tiny = draw(texture, entry.alpha, 0.07);
      saved[`${entry.name}-${name}-tiny`] = tiny;
      result.targets[name] = {
        chosen: texture.zhudaBasis.target,
        levels: texture.zhudaBasis.levels,
        bytes: texture.zhudaBasis.bytes,
        format: texture.format,
        mipmap: texture.mipmap,
        gammaSpace: texture.gammaSpace ?? texture._gammaSpace,
        createMs,
        full: compare(frame, referenceFrame, where),
        // Drawn small: a lower mip level is sampled.
        small: compare(small, smallReference, smallWhere),
        tinyMean: meanColor(tiny, tinyWhere),
        tinyPixels: tinyWhere.length,
      };
      release();
      texture.destroy();
    }
    release();
    reference.destroy();
  }

  // A large map against the same picture as a PNG: time to a texture, and bytes on the graphics card.
  if (manifest.large) {
    const large = manifest.large;
    const timing: any = (out.large = { width: large.width, height: large.height });
    let from = performance.now();
    const file = await bytes('fixtures/' + large.file);
    timing.ktx2 = { fileBytes: file.length, fetchMs: +(performance.now() - from).toFixed(1) };
    from = performance.now();
    const texture = Z.createZhudaBasisTexture(transcoder, file);
    timing.ktx2.createMs = +(performance.now() - from).toFixed(1);
    timing.ktx2.target = texture.zhudaBasis.target;
    timing.ktx2.gpuBytes = texture.zhudaBasis.bytes;
    // Enlarged until a texel is about a pixel: level 0, over the whole frame.
    const everywhere = Array.from({ length: W * H }, (_, i) => i * 4);
    const compressedFrame = (saved['large-ktx2'] = draw(texture, false, LARGE_SCALE));
    from = performance.now();
    const image = await Laya.loader.load('fixtures/' + large.png, Laya.Loader.TEXTURE2D);
    Z.ZhudaEngine.flushRenderFrames(1);
    timing.png = {
      fileBytes: large.pngBytes,
      loadMs: +(performance.now() - from).toFixed(1),
      // LayaAir's loader, as a game's own images come in.
      mipmap: image.mipmap === true,
      gpuBytes: Z.zhudaBasisTextureBytes(
        'rgba8',
        large.width,
        large.height,
        image.mipmap === true ? Math.floor(Math.log2(Math.max(large.width, large.height))) + 1 : 1,
      ),
    };
    saved['large-png'] = draw(image, false, LARGE_SCALE);
    // The same pixels uncompressed with mip levels: what the compressed picture is held to.
    const pixels = await bytes('fixtures/' + large.pixels);
    const reference = Z.createSurfaceTexture(large.width, large.height, pixels, 'color', {
      mipmap: true,
    });
    const referenceFrame = (saved['large-reference'] = draw(reference, false, LARGE_SCALE));
    timing.difference = compare(compressedFrame, referenceFrame, everywhere);
    timing.pngDifference = compare(saved['large-png'], referenceFrame, everywhere);
    timing.referenceGpuBytes = Z.zhudaBasisTextureBytes(
      'rgba8',
      large.width,
      large.height,
      Math.floor(Math.log2(Math.max(large.width, large.height))) + 1,
    );
    release();
    reference.destroy();
    release();
    texture.destroy();
  }

  // In a model: a GLB whose texture is a KTX 2 image (KHR_texture_basisu),
  // against the same model with the same pixels as a PNG.
  {
    plane.active = false;
    const provider = new Z.DirectoryAssetProvider({ baseUrl: './fixtures/' });
    const library = new Z.ZhudaModelLibrary({ provider, maxIdle: 0, basisTranscoder: transcoder });
    const bare = new Z.ZhudaModelLibrary({ provider, maxIdle: 0 });
    const codes = (report: any) =>
      report.diagnostics
        .map((d: any) => `${d.severity}:${d.code}`)
        .filter((c: string) => /IMAGE|BASIS/.test(c));
    let current: any = null;
    // Every texture LayaAir's KTX 1 and DDS parsers make from here on.
    const parsed: any[] = [];
    for (const name of ['_parseKTX', '_parseDDS']) {
      const original = Laya.Texture2D[name];
      Laya.Texture2D[name] = function (this: unknown, ...args: unknown[]) {
        const made = original.apply(this, args);
        parsed.push(made);
        return made;
      };
    }
    const show = async (id: string, from: any) => {
      const before = parsed.length;
      current?.dispose();
      current = await from.instantiate(id);
      scene.addChild(current.node);
      Z.ZhudaEngine.flushRenderFrames(3);
      const frame = read();
      // The compressed texture this load made through LayaAir's parsers, if it made one.
      const texture = parsed.length > before ? parsed[parsed.length - 1] : null;
      return {
        frame,
        status: current.compatibility.status,
        report: codes(current.compatibility),
        basis: (texture as any)?.zhudaBasis ?? null,
        format: (texture as any)?.format ?? null,
      };
    };
    const model: any = (out.model = {});
    const reference = await show('model-png.glb', library);
    saved['model-png'] = reference.frame;
    const where = covered(reference.frame);
    model.coveredPixels = where.length;
    const take = (name: string, shown: any) => {
      saved[name] = shown.frame;
      return {
        status: shown.status,
        report: shown.report,
        basis: shown.basis,
        format: shown.format,
        difference: compare(shown.frame, reference.frame, where),
      };
    };
    model.ktx2 = take('model-ktx2', await show('model-ktx2.glb', library));
    // Both images in the file: the KTX 2 one with a transcoder, the fallback (another picture) without.
    model.fallbackWithTranscoder = take(
      'model-fallback',
      await show('model-fallback.glb', library),
    );
    model.fallbackWithout = take('model-fallback-bare', await show('model-fallback.glb', bare));
    // Only a KTX 2 image and no transcoder: refused with a report.
    model.refused = await bare.instantiate('model-ktx2.glb').then(
      (instance: any) => (instance.dispose(), 'accepted'),
      (error: any) => ({ name: error.name, codes: error.report ? codes(error.report) : null }),
    );
    current?.dispose();
    plane.active = true;
  }

  // What cannot be read is refused with the reason.
  const refused = (make: () => unknown) => {
    try {
      make();
      return 'accepted';
    } catch (error) {
      return String((error as Error).message);
    }
  };
  out.refused = {
    notKtx2: refused(() => Z.createZhudaBasisTexture(transcoder, new Uint8Array(80))),
    cut: refused(() =>
      Z.createZhudaBasisTexture(transcoder, new Uint8Array(manifest.refusals.cut)),
    ),
    foreign: refused(() =>
      Z.createZhudaBasisTexture(transcoder, new Uint8Array(manifest.refusals.foreign)),
    ),
  };
  out.rendererErrors = context.renderer.errors.slice();
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
