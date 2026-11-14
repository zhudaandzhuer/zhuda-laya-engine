// Real-draw fixture for scripts/verify-physical-surfaces.mjs: how many
// textures a physical surface carries (`physicalSurfaceTextureLimit`).
// A scene with every light and shadow the engine has: a sun, a spot light
// and a point light that cast shadows, six more point lights, and light from
// the sky. In it a ball with every feature and as many textures as the limit
// allows, and a square with a baked lightmap with as many as that allows.
// With `?control` in the address the page goes past the limit by hand, one
// texture at a time, until the ball is no longer drawn.
// Runtime functions come from the browser SDK global (Zhuda).
const Z = (globalThis as any).Zhuda;
const Laya = (globalThis as any).Laya;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__BUDGET__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));
const CONTROL = location.search.includes('control');

const W = 960,
  H = 540;

// What LayaAir says about shaders and pipelines (it logs and draws on).
const logged: string[] = [];
for (const level of ['warn', 'error'] as const) {
  const original = console[level];
  console[level] = (...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (/shader|pipeline|sampler|texture image units/i.test(text)) logged.push(text.slice(0, 300));
    original.apply(console, args);
  };
}

// WebGPU: the samplers of every pipeline layout, bind group by bind group.
const groupSamplers = new Map<object, number>();
const pipelines: number[][] = [];
const Device = (globalThis as any).GPUDevice;
if (Device) {
  const createGroup = Device.prototype.createBindGroupLayout;
  Device.prototype.createBindGroupLayout = function (descriptor: any) {
    const layout = createGroup.call(this, descriptor);
    groupSamplers.set(layout, [...descriptor.entries].filter((entry: any) => entry.sampler).length);
    return layout;
  };
  const createPipeline = Device.prototype.createPipelineLayout;
  Device.prototype.createPipelineLayout = function (descriptor: any) {
    pipelines.push(
      [...descriptor.bindGroupLayouts].map((layout: object) => groupSamplers.get(layout) ?? 0),
    );
    return createPipeline.call(this, descriptor);
  };
}
// WebGL: every linked program, for the samplers it really uses.
const programs: [any, any][] = [];
for (const Context of [
  (globalThis as any).WebGL2RenderingContext,
  (globalThis as any).WebGLRenderingContext,
]) {
  if (!Context) continue;
  const link = Context.prototype.linkProgram;
  Context.prototype.linkProgram = function (program: any) {
    link.call(this, program);
    programs.push([this, program]);
  };
}

/** The glTF shader's uniform and define of each texture slot (LayaAir's names). */
const SLOTS: Record<string, [string, string]> = {
  albedo: ['u_BaseColorTexture', 'BASECOLORMAP'],
  normal: ['u_NormalTexture', 'NORMALMAP'],
  metallicRoughness: ['u_MetallicRoughnessTexture', 'METALLICROUGHNESSMAP'],
  occlusion: ['u_OcclusionTexture', 'OCCLUSIONMAP'],
  emission: ['u_EmissionTexture', 'EMISSIONMAP'],
  specular: ['u_SpecularFactorTexture', 'SPECULARFACTORMAP'],
  specularColor: ['u_SpecularColorTexture', 'SPECULARCOLORMAP'],
  clearCoat: ['u_ClearCoatTexture', 'CLEARCOATMAP'],
  clearCoatRoughness: ['u_ClearCoatRoughnessTexture', 'CLEARCOAT_ROUGHNESSMAP'],
  clearCoatNormal: ['u_ClearCoatNormalTexture', 'CLEARCOAT_NORMAL'],
  anisotropy: ['u_AnisotropyTexture', 'ANISOTROPYMAP'],
  sheenColor: ['u_SheenColorTexture', 'SHEENCOLORMAP'],
  sheenRoughness: ['u_SheenRoughnessTexture', 'SHEEN_ROUGHNESSMAP'],
  iridescence: ['u_IridescenceTexture', 'IRIDESCENCEMAP'],
  iridescenceThickness: ['u_IridescenceThicknessTexture', 'IRIDESCENCE_THICKNESSMAP'],
  transmission: ['u_TransmissionTexture', 'TRANSMISSIONMAP'],
  thickness: ['u_VolumeThicknessTexture', 'THICKNESSMAP'],
};
const COLOUR_SLOTS = ['albedo', 'emission', 'sheenColor', 'specularColor'];

async function main() {
  const renderer = (globalThis as any).ZhudaBundle.renderer === 'webgpu' ? 'webgpu' : 'webgl';
  out.renderer = renderer;
  out.control = CONTROL;
  const context = await Z.ZhudaEngine.boot({
    renderer,
    container: document.querySelector('#view'),
    width: W,
    height: H,
    dprCap: 1,
    features: [...(globalThis as any).ZhudaBundle.features],
    preserveDrawingBuffer: true,
  });
  let gl: WebGLRenderingContext | null = null,
    copy: CanvasRenderingContext2D | null = null;
  if (renderer === 'webgl')
    gl = context.canvas.getContext('webgl2') || context.canvas.getContext('webgl');
  else {
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    copy = canvas.getContext('2d', { willReadFrequently: true });
  }
  /** The frame, top row first on both backends. */
  const read = () => {
    if (gl) {
      const raw = new Uint8Array(W * H * 4);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, raw);
      const pixels = new Uint8Array(W * H * 4);
      for (let y = 0; y < H; y++)
        pixels.set(raw.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      return pixels;
    }
    copy!.drawImage(context.canvas, 0, 0, W, H);
    return new Uint8Array(copy!.getImageData(0, 0, W, H).data.buffer);
  };
  context.runtime.start(() => {});
  // The browser SDK's boot splash lies over the canvas for about two seconds.
  while (!(globalThis as any).__ZHUDA_SPLASH__?.completed) await new Promise(requestAnimationFrame);
  await new Promise((resolve) => setTimeout(resolve, 600));
  const round = (v: number, digits = 2) => +v.toFixed(digits);
  const vector = (x: number, y: number, z: number) => new Laya.Vector3(x, y, z);

  // --- The scene: every light and shadow the engine has. ---
  const scene = Z.Zhuda3D.createScene3D(context.rootScene);
  const camera = Z.Zhuda3D.createCamera(scene, {
    position: [0, 1.5, 5],
    clearColor: [0, 0, 0, 1],
  });
  camera.fieldOfView = 45;
  camera.transform.lookAt(vector(0, 0, 0), vector(0, 1, 0));
  Z.applyZhudaHemisphereAmbient(scene, [0.55, 0.6, 0.7], [0.25, 0.22, 0.2]);
  const sun = Z.Zhuda3D.createDirectionalLight(scene, { color: [1, 1, 1, 1], intensity: 1.5 });
  sun.node.transform.rotationEuler = vector(-50, -30, 0);
  sun.light.shadowMode = Laya.ShadowMode.SoftLow;
  sun.light.shadowDistance = 20;
  sun.light.shadowResolution = 1024;
  const light = (Component: any, at: number[]) => {
    const node = new Laya.Sprite3D();
    scene.addChild(node);
    node.transform.position = vector(at[0], at[1], at[2]);
    return { node, light: node.addComponent(Component) };
  };
  const spot = light(Laya.SpotLightCom, [0.5, 4, 1]);
  spot.light.range = 12;
  spot.light.spotAngle = 60;
  spot.light.intensity = 2;
  spot.light.shadowMode = Laya.ShadowMode.SoftLow;
  spot.node.transform.rotationEuler = vector(-90, 0, 0);
  const lamp = light(Laya.PointLightCom, [1.8, 2, 1.5]);
  lamp.light.range = 10;
  lamp.light.intensity = 1.5;
  const pointShadow = new Z.ZhudaPointShadow(scene, {});
  for (let i = 0; i < 6; i++) {
    const more = light(Laya.PointLightCom, [i - 2.5, 1.2, 2]);
    more.light.range = 5;
    more.light.intensity = 0.3;
  }
  const owned: any[] = [];
  const make = (spec: any) => {
    const material = Z.createSurfaceMaterial(spec);
    owned.push(material);
    return material;
  };
  const place = (mesh: any, material: any, at: number[]) => {
    const node = new Laya.MeshSprite3D(mesh);
    node.meshRenderer.sharedMaterial = material;
    node.meshRenderer.receiveShadow = true;
    node.transform.position = vector(at[0], at[1], at[2]);
    scene.addChild(node);
    return node;
  };
  place(
    Laya.PrimitiveMesh.createPlane(8, 8, 1, 1),
    make({ type: 'pbr', color: [0.2, 0.6, 0.25, 1], roughness: 0.7 }),
    [0, -1, 0],
  );
  // Something that casts the shadows the surfaces under test receive. They
  // cast none themselves: a shadow is drawn by another pass, and would move
  // the pixels a surface that is not drawn leaves alone.
  const caster = place(
    Laya.PrimitiveMesh.createBox(0.5, 0.5, 0.5),
    make({ type: 'pbr', color: [0.8, 0.3, 0.2, 1] }),
    [-0.9, 1.5, 0.9],
  );
  caster.meshRenderer.castShadow = true;
  pointShadow.render([1.8, 2, 1.5], 10);

  // Light and dark squares in every channel, alpha included.
  const patch = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 64; x++)
      patch.set(
        (Math.floor(x / 8) + Math.floor(y / 8)) % 2 ? [230, 230, 230, 255] : [25, 25, 25, 40],
        (y * 64 + x) * 4,
      );
  const patchColour = Z.createSurfaceTexture(64, 64, patch, 'color'),
    patchData = Z.createSurfaceTexture(64, 64, patch, 'data');
  owned.push(patchColour, patchData);
  const textures = (slots: string[]) =>
    Object.fromEntries(
      slots.map((slot) => [slot, COLOUR_SLOTS.includes(slot) ? patchColour : patchData]),
    );

  const everyFeature = {
    type: 'physical',
    color: [0.8, 0.8, 0.8, 1],
    roughness: 0.4,
    metallic: 0.3,
    clearCoat: 0.8,
    clearCoatRoughness: 0.3,
    anisotropy: 0.7,
    sheen: { color: [1, 1, 1], roughness: 0.5 },
    iridescence: { thicknessRange: [100, 600] },
    transmission: {
      factor: 0.5,
      volume: { thickness: 0.3, attenuationColor: [0.3, 0.85, 0.5], attenuationDistance: 0.3 },
    },
  };
  // LayaAir's glTF shader does not read a lightmap on a surface with a thin
  // film: without iridescence here, so that the lightmap's samplers are bound.
  const { iridescence: _film, ...underLightmap } = everyFeature;
  Z.configureSurfacePasses(camera, [Z.surfaceMaterialPasses(everyFeature)], 1);

  const ball = place(Laya.PrimitiveMesh.createSphere(1, 48, 48), make(everyFeature), [0, 0, 0]);
  // A square facing the camera with a second set of texture coordinates, for a lightmap.
  const corners: number[] = [];
  for (const [x, y] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ])
    corners.push(x, y, 0, 0, 0, 1, (x + 1) / 2, (y + 1) / 2, (x + 1) / 2, (y + 1) / 2);
  const squareMesh = Laya.PrimitiveMesh._createMesh(
    Laya.VertexMesh.getVertexDeclaration('POSITION,NORMAL,UV,UV1'),
    new Float32Array(corners),
    // LayaAir's front faces turn clockwise as seen from in front.
    new Uint16Array([0, 2, 1, 0, 3, 2]),
  );
  const flat = (value: number[]) => ({
    width: 4,
    height: 4,
    rgb: new Float32Array(48).map((_, i) => value[i % 3]),
  });
  const baked = Z.createZhudaLightmap(flat([0.9, 0.7, 0.4])),
    bakedWithDirection = Z.createZhudaLightmap(flat([0.9, 0.7, 0.4]), 1, flat([0.5, 0.5, 1]));
  scene.lightmaps = [baked.lightmap, bakedWithDirection.lightmap];
  const lightmapped = (index: number) => {
    const node = place(squareMesh, make(underLightmap), [0, 0, 0]);
    node.meshRenderer.lightmapScaleOffset = new Laya.Vector4(1, 1, 0, 0);
    node.meshRenderer.lightmapIndex = index;
    node.meshRenderer.setLightmapIndex?.(index);
    return node;
  };
  const squares = { lightmap: lightmapped(0), directional: lightmapped(1) };
  const subjects = [ball, squares.lightmap, squares.directional];
  const only = (shown: any) => {
    for (const node of subjects) node.active = node === shown;
  };
  const frame = () => {
    Z.ZhudaEngine.flushRenderFrames(3);
    return read();
  };
  /** The middle of the picture, where the surface under test stands. */
  const middle: number[] = [];
  for (let y = H / 2 - 40; y < H / 2 + 40; y++)
    for (let x = W / 2 - 40; x < W / 2 + 40; x++) middle.push((y * W + x) * 4);
  const apart = (a: Uint8Array, b: Uint8Array) => {
    let sum = 0;
    for (const i of middle) for (let c = 0; c < 3; c++) sum += Math.abs(a[i + c] - b[i + c]);
    return round(sum / middle.length / 3);
  };
  const brightness = (p: Uint8Array) =>
    round(middle.reduce((sum, i) => sum + p[i] + p[i + 1] + p[i + 2], 0) / middle.length / 3);
  only(null);
  const empty = frame();
  /**
   * Draws `node` with `material` and says whether it is there: the middle of
   * the picture is not what the scene shows without it, and is not blank.
   */
  const draw = (node: any, material: any) => {
    only(node);
    node.meshRenderer.sharedMaterial = material;
    const pixels = frame();
    const fromEmpty = apart(pixels, empty);
    return { pixels, fromEmpty, drawn: fromEmpty > 2 && brightness(pixels) > 5 };
  };
  /** Samplers of what was compiled since `mark`: the pipeline (WebGPU) or program (WebGL) with the most. */
  const mark = () => ({ pipelines: pipelines.length, programs: programs.length });
  const samplersSince = (from: { pipelines: number; programs: number }) => {
    if (renderer === 'webgpu') {
      const sets = pipelines
        .slice(from.pipelines)
        .sort((a, b) => b.reduce((sum, n) => sum + n, 0) - a.reduce((sum, n) => sum + n, 0))[0] ?? [
        0,
      ];
      return { total: sets.reduce((sum, n) => sum + n, 0), sets };
    }
    let best: string[] = [];
    for (const [g, program] of programs.slice(from.programs)) {
      if (!g.getProgramParameter(program, g.LINK_STATUS)) continue;
      const names: string[] = [];
      let physical = false;
      for (let i = 0; i < g.getProgramParameter(program, g.ACTIVE_UNIFORMS); i++) {
        const uniform = g.getActiveUniform(program, i);
        if (uniform.name === 'u_BaseColorFactor') physical = true;
        // sampler2D, samplerCube, sampler2DShadow, sampler3D, sampler2DArray, samplerCubeShadow, sampler2DArrayShadow
        if ([0x8b5e, 0x8b60, 0x8b62, 0x8b5f, 0x8dc1, 0x8dc5, 0x8dc4].includes(uniform.type))
          names.push(uniform.name);
      }
      if (physical && names.length > best.length) best = names;
    }
    return { total: best.length, names: best.sort() };
  };
  const limit = Z.physicalSurfaceTextureLimit();
  const atLimit = {
    ...everyFeature,
    textures: textures([
      'albedo',
      'metallicRoughness',
      'clearCoat',
      'sheenColor',
      'iridescence',
      'transmission',
    ]),
  };
  const r: any = { limit, maxTextureUnits: null as number | null };
  if (gl) r.maxTextureUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);
  const device = Laya.LayaGL?.renderEngine?.getDevice?.();
  if (device?.limits) r.maxSamplersPerStage = device.limits.maxSamplersPerShaderStage;

  if (!CONTROL) {
    // --- At the limit: every feature and six textures. ---
    let from = mark();
    const plain = draw(ball, make(everyFeature));
    r.plain = { drawn: plain.drawn, fromEmpty: plain.fromEmpty, samplers: samplersSince(from) };
    from = mark();
    r.atLimitProblems = Z.validatePhysicalSurfaceSpec(atLimit);
    const full = draw(ball, make(atLimit));
    r.atLimit = {
      textures: Object.keys(atLimit.textures).length,
      drawn: full.drawn,
      fromEmpty: full.fromEmpty,
      // The six pictures show on it.
      fromPlain: apart(full.pixels, plain.pixels),
      samplers: samplersSince(from),
    };
    r.pastLimit = Z.validatePhysicalSurfaceSpec({
      ...atLimit,
      textures: { ...atLimit.textures, occlusion: patchData },
    });

    // --- Under a lightmap: one texture fewer, two with a direction picture. ---
    r.lightmap = {};
    for (const [name, use, slots] of [
      ['lightmap', { lightmap: true }, ['albedo', 'metallicRoughness', 'clearCoat', 'sheenColor']],
      ['directional', { lightmap: 'directional' }, ['albedo', 'metallicRoughness', 'clearCoat']],
    ] as const) {
      const most = Z.physicalSurfaceTextureLimit(use);
      const spec = { ...underLightmap, textures: textures([...slots, 'transmission']) };
      const node = (squares as any)[name];
      const unlit = draw(node, make(underLightmap));
      from = mark();
      const lit = draw(node, make(spec));
      r.lightmap[name] = {
        limit: most,
        textures: Object.keys(spec.textures).length,
        problems: Z.validatePhysicalSurfaceSpec(spec, use),
        oneMore: Z.validatePhysicalSurfaceSpec(
          { ...spec, textures: { ...spec.textures, occlusion: patchData } },
          use,
        ),
        drawn: lit.drawn,
        fromEmpty: lit.fromEmpty,
        fromPlain: apart(lit.pixels, unlit.pixels),
        samplers: samplersSince(from),
      };
    }
    // The lightmap lights the square: without it the same square is another colour.
    const square = squares.lightmap;
    const withLightmap = draw(square, make(underLightmap));
    square.meshRenderer.lightmapIndex = -1;
    square.meshRenderer.setLightmapIndex?.(-1);
    r.lightmap.changesTheSquare = apart(
      withLightmap.pixels,
      draw(square, make(underLightmap)).pixels,
    );
    square.meshRenderer.lightmapIndex = 0;
    square.meshRenderer.setLightmapIndex?.(0);

    const views: Record<string, () => void> = {
      'budget-at-limit': () => draw(ball, make(atLimit)),
      'budget-lightmap': () =>
        draw(
          squares.lightmap,
          make({
            ...underLightmap,
            textures: textures([
              'albedo',
              'metallicRoughness',
              'clearCoat',
              'sheenColor',
              'transmission',
            ]),
          }),
        ),
    };
    out.views = Object.keys(views);
    out.show = (name: string) => {
      views[name]();
      Z.ZhudaEngine.flushRenderFrames(3);
      return name;
    };
  } else {
    // --- Past the limit by hand, one texture more at a time. ---
    const material = make(atLimit);
    const before = draw(ball, material);
    r.control = { drawn: { [limit]: before.drawn } as Record<number, boolean> };
    // In an order in which each one is read by the shader as soon as it is
    // set (a normal texture needs tangents, an emission texture its colour).
    const more = [
      'occlusion',
      'clearCoatRoughness',
      'sheenRoughness',
      'iridescenceThickness',
      'thickness',
      'specular',
      'specularColor',
      'clearCoatNormal',
      'anisotropy',
    ];
    let count = limit;
    for (const slot of more) {
      const [uniform, define] = SLOTS[slot];
      material.setTexture(uniform, COLOUR_SLOTS.includes(slot) ? patchColour : patchData);
      material.setDefine(Laya.Shader3D.getDefineByName(define), true);
      count++;
      const from = mark();
      const result = draw(ball, material);
      // WebGPU reports a refused pipeline a moment later.
      await new Promise((resolve) => setTimeout(resolve, 300));
      r.control.drawn[count] = result.drawn;
      if (!result.drawn) {
        r.control.firstNotDrawn = count;
        r.control.samplers = samplersSince(from);
        break;
      }
    }
    r.control.logged = logged.slice(0, 2);
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  out.budget = r;
  out.logged = logged.slice(0, 6);
  out.backend = {
    selected: context.renderer.selected,
    nativeEngine: context.renderer.nativeEngine,
  };
  out.rendererErrors = context.renderer.errors.slice(0, 3).map((e: unknown) => String(e));
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
