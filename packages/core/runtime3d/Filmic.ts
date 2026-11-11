export interface PrefilteredEnvironmentSpec {
  size: number;
  levels: { size: number; offset: number; elements: number }[];
  ambientSH: number[];
}
function requireCapabilities(l: any, names: string[]) {
  for (const name of names)
    if (!l.LayaGL.renderEngine.getCapable(l.RenderCapable[name]))
      throw Error('Filmic rendering requires ' + name);
}
/** Upload an offline convolved GGX mip chain. Offsets are float32 elements, not bytes.
 * Data is scene-linear RGBA in WebGL cube face order +X,-X,+Y,-Y,+Z,-Z.
 * Mip roughness follows Laya's r*(2-r) lookup. No LDR fallback is silently substituted. */
export function createPrefilteredEnvironment(
  spec: PrefilteredEnvironmentSpec,
  pixels: Float32Array,
) {
  if (
    !Number.isInteger(spec.size) ||
    spec.size < 1 ||
    spec.size & (spec.size - 1) ||
    spec.ambientSH.length !== 27 ||
    !spec.ambientSH.every(Number.isFinite)
  )
    throw Error('Invalid environment descriptor');
  if (spec.levels.length !== Math.log2(spec.size) + 1) throw Error('Incomplete GGX mip chain');
  let offset = 0;
  for (const [i, level] of spec.levels.entries()) {
    const size = Math.max(1, spec.size >> i),
      elements = size * size * 4 * 6;
    if (level.size !== size || level.offset !== offset || level.elements !== elements)
      throw Error('Invalid environment mip layout');
    offset += elements;
  }
  if (offset !== pixels.length || !pixels.every((v) => Number.isFinite(v) && v >= 0))
    throw Error('Invalid environment pixels');
  const l = (globalThis as any).Laya;
  requireCapabilities(l, ['TextureFormat_R32G32B32A32', 'Texture_FloatLinearFiltering']);
  const texture = new l.TextureCube(spec.size, l.TextureFormat.R32G32B32A32, true, false);
  texture.filterMode = l.FilterMode.Trilinear;
  // Laya's pixel upload order is +Z,-Z,+X,-X,+Y,-Y, unlike WebGL/DDS.
  const faces = (level: { size: number; offset: number }) =>
    [4, 5, 0, 1, 2, 3].map((i) =>
      pixels.subarray(
        level.offset + i * level.size * level.size * 4,
        level.offset + (i + 1) * level.size * level.size * 4,
      ),
    );
  texture.setPixelsData(faces(spec.levels[0]), false, false);
  for (let i = 1; i < spec.levels.length; i++) {
    const level = spec.levels[i];
    texture.updateSubPixelsData(faces(level), 0, 0, level.size, level.size, i, false, false, false);
  }
  return {
    texture,
    apply(scene: any) {
      scene.iblTex = texture;
      scene.iblTexRGBD = false;
      scene.ambientMode = l.AmbientMode.SphericalHarmonics;
      scene.ambientSH = new Float32Array(spec.ambientSH);
    },
    dispose() {
      texture.destroy();
    },
  };
}

export interface FilmicOptions {
  exposure?: number;
  contrast?: number;
  saturation?: number;
  ao?: boolean;
  aoIntensity?: number;
  aoRadius?: number;
  bloom?: boolean;
  bloomIntensity?: number;
  temporalAA?: boolean;
  /**
   * Borrowed effects inserted after ambient occlusion and before bloom, in
   * linear HDR: for example `ZhudaLightFog.effect`. They read the camera depth
   * texture, which the pipeline switches on. The caller disposes them after
   * the pipeline.
   */
  sceneEffects?: readonly any[];
  /**
   * Borrowed effects added last, after tone mapping, in display space: for
   * example `ZhudaLensFinish.effect`. The caller disposes them after the
   * pipeline.
   */
  finishEffects?: readonly any[];
}
/** Owns the camera's HDR, AO, restrained bloom and ACES chain. Caller chooses quality. */
export class ZhudaFilmicPipeline {
  readonly post: any;
  readonly grade: any;
  readonly ao: any;
  readonly bloom: any;
  private previous: any;
  private previousHDR: boolean;
  private disposed = false;
  private camera: any;
  private ownsTAA = false;
  private previousMSAA: boolean;
  private previousDepth: number;
  constructor(camera: any, options: FilmicOptions = {}) {
    this.camera = camera;
    const l = (globalThis as any).Laya;
    for (const k of [
      'exposure',
      'contrast',
      'saturation',
      'aoIntensity',
      'aoRadius',
      'bloomIntensity',
    ] as const)
      if (options[k] !== undefined && (!Number.isFinite(options[k]) || (options[k] as number) < 0))
        throw Error('Invalid filmic option ' + k);
    if (camera.postProcess) throw Error('Camera already owns a postprocess chain');
    requireCapabilities(l, ['RenderTextureFormat_R16G16B16A16']);
    this.previous = camera.postProcess;
    this.previousHDR = camera.enableHDR;
    this.previousMSAA = camera.msaa;
    this.previousDepth = camera.depthTextureMode;
    const post = (this.post = new l.PostProcess());
    this.ao = new l.ScalableAO();
    this.ao.intensity = options.aoIntensity ?? 0.65;
    this.ao.radius = options.aoRadius ?? 0.7;
    this.ao.aoQuality = l.AOQUALITY.High;
    this.ao.active = options.ao !== false;
    this.bloom = new l.BloomEffect();
    this.bloom.intensity = options.bloomIntensity ?? 0.12;
    this.bloom.threshold = 1.2;
    this.bloom.diffusion = 4;
    this.bloom.active = options.bloom !== false;
    this.grade = new l.ColorGradEffect();
    this.grade.toneMapping = l.ToneMappingType.ACES;
    this.grade.enableColorAdjust = true;
    this.grade.postExposure = options.exposure ?? 1;
    this.grade.contrast = options.contrast ?? 1.04;
    this.grade.saturation = options.saturation ?? 0.96;
    post.addEffect(this.ao);
    for (const effect of options.sceneEffects ?? []) post.addEffect(effect);
    if (options.sceneEffects?.length) camera.depthTextureMode |= l.DepthTextureMode.Depth;
    post.addEffect(this.bloom);
    post.addEffect(this.grade);
    for (const effect of options.finishEffects ?? []) post.addEffect(effect);
    camera.enableHDR = true;
    camera.postProcess = post;
    if (options.temporalAA) {
      this.ownsTAA = true;
      camera.taa = true;
      camera.taaSettings.quality = l.TemporalAAQuality.High;
    }
  }
  /** Update the existing ACES grading exposure multiplier. */
  setExposure(value: number) {
    if (this.disposed) throw Error('Disposed filmic pipeline');
    if (!Number.isFinite(value) || value < 0 || value > 1048576)
      throw Error('Invalid filmic exposure');
    this.grade.postExposure = value;
  }
  /** Call on camera cuts, teleports and timeline seeks, not on ordinary movement. */
  resetHistory() {
    if (this.disposed) throw Error('Disposed filmic pipeline');
    if (this.ownsTAA) this.camera.taaSettings.resetHistory();
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.ownsTAA) this.camera.taa = false;
    if (this.camera.postProcess === this.post) {
      this.camera.postProcess = this.previous;
      this.camera.enableHDR = this.previousHDR;
      this.camera.msaa = this.previousMSAA;
      this.camera.depthTextureMode = this.previousDepth;
    }
    this.post.clearEffect();
    // LayaAir 3.4.2 release() detaches effects but does not free their LUT,
    // materials or shader data. This version-pinned adapter owns those objects.
    this.post._context.command.clear();
    const owned = new Set([
      this.grade._lutBuilderMat,
      this.grade._lutTex,
      this.grade._lutShaderData,
      this.ao._shaderData,
      this.bloom._shaderData,
      this.bloom._compositeShaderData,
      this.post._compositeShaderData,
    ]);
    for (const resource of owned)
      if (resource && !resource.destroyed) {
        if ('lock' in resource) resource.lock = false;
        resource.destroy();
      }
    this.post._context.camera = null;
  }
}

/** A real mirrored scene camera for a horizontal surface. Objects on excludedLayer
 * must include the reflecting surface to prevent feedback. The scene should not
 * contain visible geometry below the plane: arbitrary oblique clipping is not provided. */
export class ZhudaPlanarReflection {
  readonly camera: any;
  readonly texture: any;
  constructor(
    scene: any,
    options: {
      width: number;
      height: number;
      planeY?: number;
      excludedLayer: number;
      near?: number;
      far?: number;
      /**
       * Draw only what lies above the plane (an oblique near plane). Water
       * needs it: its bed and the sunk part of stones are below the mirror
       * and would otherwise cover the mirrored view.
       */
      clipBelowPlane?: boolean;
      /**
       * Leave the mirrored camera out of the engine's frame loop: the owner
       * draws it with `draw()` when it wants (default false: the loop draws it).
       */
      manual?: boolean;
      /**
       * Whether `draw()` also redraws the shadow maps for the mirrored view
       * (default true). Without it the mirror uses the shadow maps of the
       * main view, which saves a full shadow pass per frame.
       */
      shadows?: boolean;
    },
  ) {
    const l = (globalThis as any).Laya;
    if (
      ![options.width, options.height].every((v) => Number.isInteger(v) && v > 0 && v <= 8192) ||
      !Number.isInteger(options.excludedLayer) ||
      options.excludedLayer < 0 ||
      options.excludedLayer > 30 ||
      !Number.isFinite(options.planeY ?? 0)
    )
      throw Error('Invalid planar reflection options');
    const near = options.near ?? 0.08,
      far = options.far ?? 1500;
    if (!Number.isFinite(near) || !Number.isFinite(far) || near <= 0 || far <= near)
      throw Error('Invalid reflection clipping range');
    requireCapabilities(l, ['RenderTextureFormat_R16G16B16A16']);
    this.planeY = options.planeY ?? 0;
    this.clip = options.clipBelowPlane ? { near, far } : undefined;
    this.texture = new l.RenderTexture(
      options.width,
      options.height,
      l.RenderTargetFormat.R16G16B16A16,
      l.RenderTargetFormat.DEPTH_16,
      false,
      1,
    );
    this.camera = new l.Camera(options.width / options.height, near, far);
    this.camera.name = 'zhuda-planar-reflection';
    this.camera.enableHDR = true;
    this.camera.renderTarget = this.texture;
    this.camera.renderingOrder = -100;
    this.camera.cullingMask = ~(1 << options.excludedLayer);
    if (options.manual) this.camera.enableRender = false;
    this.shadows = options.shadows ?? true;
    this.scene = scene;
    scene.addChild(this.camera);
  }
  private planeY: number;
  private readonly shadows: boolean;
  private readonly scene: any;
  private clip?: { near: number; far: number };
  private disposed = false;
  update(eye: readonly number[], target: readonly number[], fieldOfView: number, aspect?: number) {
    if (this.disposed) throw Error('Disposed reflection');
    if (
      eye.length !== 3 ||
      target.length !== 3 ||
      ![...eye, ...target, fieldOfView].every(Number.isFinite) ||
      fieldOfView <= 0 ||
      fieldOfView >= 179
    )
      throw Error('Invalid reflection pose');
    if (Math.hypot(...eye.map((v, i) => v - target[i])) < 1e-9)
      throw Error('Reflection eye and target must differ');
    const l = (globalThis as any).Laya;
    if (aspect !== undefined) {
      if (!Number.isFinite(aspect) || aspect <= 0) throw Error('Invalid reflection aspect');
      this.camera.aspectRatio = aspect;
    }
    this.camera.fieldOfView = fieldOfView;
    this.camera.transform.position = new l.Vector3(eye[0], 2 * this.planeY - eye[1], eye[2]);
    const vertical = Math.hypot(eye[0] - target[0], eye[2] - target[2]) < 1e-9;
    this.camera.transform.lookAt(
      new l.Vector3(target[0], 2 * this.planeY - target[1], target[2]),
      // A plain +Y up: with a flipped up Laya 3.4.2 draws no geometry from this
      // camera. The returned matrix is this camera's own, so projected sampling
      // stays exact either way.
      vertical ? new l.Vector3(0, 0, 1) : new l.Vector3(0, 1, 0),
      false,
    );
    if (this.clip) {
      // Lengyel's oblique near plane: the frustum's near plane becomes the
      // mirror plane, seen from the mirrored eye below it.
      const sub = (a: readonly number[], b: readonly number[]) => a.map((v, i) => v - b[i]);
      const dot = (a: readonly number[], b: readonly number[]) =>
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      const cross = (a: readonly number[], b: readonly number[]) => [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
      ];
      const unit = (v: number[]) => v.map((n) => n / Math.hypot(v[0], v[1], v[2]));
      const from = [eye[0], 2 * this.planeY - eye[1], eye[2]],
        to = [target[0], 2 * this.planeY - target[1], target[2]];
      const forward = unit(sub(to, from));
      const side = unit(cross(forward, vertical ? [0, 0, 1] : [0, 1, 0])),
        up = cross(side, forward);
      // The plane in camera space (x right, y up, z toward the viewer), normal away from the camera.
      const normal = [side[1], up[1], -forward[1]];
      const offset = this.planeY - from[1] + 0.02;
      const plane = [
        ...normal,
        -dot(normal, [side[1] * offset, up[1] * offset, -forward[1] * offset]),
      ];
      const projection = new l.Matrix4x4();
      l.Matrix4x4.createPerspective(
        (fieldOfView * Math.PI) / 180,
        this.camera.aspectRatio,
        this.clip.near,
        this.clip.far,
        projection,
      );
      const m = projection.elements;
      const q = [
        (Math.sign(plane[0]) + m[8]) / m[0],
        (Math.sign(plane[1]) + m[9]) / m[5],
        -1,
        (1 + m[10]) / m[14],
      ];
      // Laya's projection maps depth to 0..1, so the near plane is the third
      // row itself: it becomes the mirror plane, scaled so that the far
      // plane still passes through the far corner q of the frustum.
      const scale = 1 / (plane[0] * q[0] + plane[1] * q[1] + plane[2] * q[2] + plane[3] * q[3]);
      // Only when the camera really is below the plane; otherwise keep the plain frustum.
      if (plane[3] < 0 && Number.isFinite(scale)) {
        m[2] = plane[0] * scale;
        m[6] = plane[1] * scale;
        m[10] = plane[2] * scale;
        m[14] = plane[3] * scale;
      }
      this.camera.projectionMatrix = projection;
    }
    const e = this.camera.projectionViewMatrix.elements;
    return Array.from({ length: 4 }, (_, i) => [
      e[i * 4],
      e[i * 4 + 1],
      e[i * 4 + 2],
      e[i * 4 + 3],
    ]);
  }
  /** Draws the mirrored view now (captures, or a `manual` mirror in a game loop). */
  draw(): void {
    if (this.disposed) throw Error('Disposed reflection');
    const l = (globalThis as any).Laya;
    const before = l.Stat.enableShadow;
    if (!this.shadows) l.Stat.enableShadow = false;
    try {
      l.Camera.drawRenderTextureByScene(this.camera, this.scene, this.texture);
    } finally {
      l.Stat.enableShadow = before;
      this.camera.renderTarget = this.texture;
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.camera.renderTarget = null;
    this.camera.destroy(true);
    this.texture.destroy();
  }
}
