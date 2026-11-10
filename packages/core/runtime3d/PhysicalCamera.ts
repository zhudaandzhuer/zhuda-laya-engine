/** Millimetres for lens/sensor, metres for focus; right-handed native camera. */
export interface PhysicalCameraSpec {
  focalLengthMm: number;
  sensorHeightMm?: number;
  fStop?: number;
  focusDistanceM?: number;
  iso?: number;
  shutterAngle?: number;
  exposureCompensation?: number;
  referenceEV100?: number;
}
export interface PhysicalCameraSettings {
  focalLengthMm: number;
  sensorHeightMm: number;
  fStop: number;
  focusDistanceM: number;
  iso: number;
  shutterAngle: number;
  exposureCompensation: number;
  referenceEV100: number;
}
export function physicalCameraSettings(spec: PhysicalCameraSpec): Readonly<PhysicalCameraSettings> {
  const value = {
    sensorHeightMm: 24,
    fStop: 2.8,
    focusDistanceM: 5,
    iso: 100,
    shutterAngle: 180,
    exposureCompensation: 0,
    referenceEV100: 10,
    ...spec,
  };
  const bounds: Record<keyof PhysicalCameraSettings, readonly [number, number]> = {
    focalLengthMm: [1, 2000],
    sensorHeightMm: [1, 200],
    fStop: [0.1, 128],
    focusDistanceM: [0.01, 1e7],
    iso: [1, 1e7],
    shutterAngle: [0, 360],
    exposureCompensation: [-24, 24],
    referenceEV100: [-24, 32],
  };
  for (const key of Object.keys(bounds) as (keyof PhysicalCameraSettings)[])
    if (!Number.isFinite(value[key]) || value[key] < bounds[key][0] || value[key] > bounds[key][1])
      throw Error('Invalid physical camera ' + key);
  if (value.focusDistanceM <= value.focalLengthMm / 1000)
    throw Error('Focus must lie beyond focal length');
  return Object.freeze(value);
}
export function physicalCameraMetrics(spec: PhysicalCameraSpec, fps: number) {
  const s = physicalCameraSettings(spec);
  if (!Number.isFinite(fps) || fps <= 0 || fps > 1000) throw Error('Invalid camera frame rate');
  const exposureSeconds = s.shutterAngle / 360 / fps;
  const ev100 =
    exposureSeconds === 0
      ? Infinity
      : Math.log2((((s.fStop * s.fStop) / exposureSeconds) * 100) / s.iso);
  return Object.freeze({
    verticalFovDegrees: (2 * Math.atan(s.sensorHeightMm / (2 * s.focalLengthMm)) * 180) / Math.PI,
    apertureRadiusM: s.focalLengthMm / s.fStop / 2000,
    exposureSeconds,
    ev100,
    exposureMultiplier:
      exposureSeconds === 0 ? 0 : Math.pow(2, s.referenceEV100 - ev100 + s.exposureCompensation),
  });
}

const lenses = new WeakSet<Laya.Camera>();
/** Owns lens/projection settings, borrows camera pose. Vertical sensor fit. */
export class ZhudaPhysicalCameraRig {
  readonly camera: Laya.Camera;
  private settings: Readonly<PhysicalCameraSettings>;
  private readonly previous: {
    fov: number;
    aspect: number;
    projection: Laya.Matrix4x4;
    custom: boolean;
  };
  private disposed = false;
  private restoreSample: (() => void) | null = null;
  constructor(camera: Laya.Camera, spec: PhysicalCameraSpec) {
    this.settings = physicalCameraSettings(spec);
    if (camera.destroyed || camera.orthographic || lenses.has(camera))
      throw Error('Physical camera requires an unowned perspective camera');
    this.camera = camera;
    // The getter resolves auto-aspect (0) to today's viewport. Preserve the mode
    // so disposing this rig does not accidentally disable future resize updates.
    this.previous = {
      fov: camera.fieldOfView,
      aspect: (camera as unknown as { _aspectRatio: number })._aspectRatio ?? camera.aspectRatio,
      projection: camera.projectionMatrix.clone(),
      custom: (camera as unknown as { _useUserProjectionMatrix: boolean })._useUserProjectionMatrix,
    };
    lenses.add(camera);
  }
  private check() {
    if (this.disposed || this.camera.destroyed) throw Error('Disposed physical camera');
  }
  get spec(): Readonly<PhysicalCameraSettings> {
    return this.settings;
  }
  configure(patch: Partial<PhysicalCameraSettings>) {
    this.check();
    if (this.restoreSample) throw Error('Restore active lens sample first');
    this.settings = physicalCameraSettings({ ...this.settings, ...patch });
  }
  apply(aspect: number) {
    this.check();
    if (this.restoreSample) throw Error('Restore active lens sample first');
    if (!Number.isFinite(aspect) || aspect <= 0) throw Error('Invalid camera aspect');
    this.camera.resetProjectionMatrix();
    this.camera.aspectRatio = aspect;
    this.camera.fieldOfView = physicalCameraMetrics(this.settings, 24).verticalFovDegrees;
  }
  applyExposure(pipeline: { setExposure(value: number): void }, fps: number) {
    this.check();
    pipeline.setExposure(physicalCameraMetrics(this.settings, fps).exposureMultiplier);
  }
  /** Temporary aperture and subpixel offsets; always call the returned restore. */
  sample(
    lensX: number,
    lensY: number,
    jitterX: number,
    jitterY: number,
    width: number,
    height: number,
  ): () => void {
    this.check();
    if (this.restoreSample) throw Error('Restore active lens sample first');
    if (
      ![lensX, lensY, jitterX, jitterY, width, height].every(Number.isFinite) ||
      Math.hypot(lensX, lensY) > 1.000001 ||
      Math.abs(jitterX) > 0.5 ||
      Math.abs(jitterY) > 0.5 ||
      width < 1 ||
      height < 1
    )
      throw Error('Invalid lens sample');
    const l = (globalThis as unknown as { Laya: typeof Laya }).Laya,
      camera = this.camera;
    const position = camera.transform.position.clone(),
      projection = camera.projectionMatrix.clone();
    const custom = (camera as unknown as { _useUserProjectionMatrix: boolean })
      ._useUserProjectionMatrix;
    const matrix = camera.transform.worldMatrix.elements,
      radius = physicalCameraMetrics(this.settings, 24).apertureRadiusM;
    for (const start of [0, 4, 8])
      if (Math.abs(Math.hypot(matrix[start], matrix[start + 1], matrix[start + 2]) - 1) > 1e-4)
        throw Error('Physical camera requires unit world scale');
    const x = lensX * radius,
      y = lensY * radius,
      shifted = projection.clone();
    // Move the aperture, then shift the frustum so the focus plane stays fixed.
    shifted.elements[8] -=
      (projection.elements[0] * x) / this.settings.focusDistanceM + (2 * jitterX) / width;
    shifted.elements[9] -=
      (projection.elements[5] * y) / this.settings.focusDistanceM + (2 * jitterY) / height;
    camera.transform.position = new l.Vector3(
      position.x + matrix[0] * x + matrix[4] * y,
      position.y + matrix[1] * x + matrix[5] * y,
      position.z + matrix[2] * x + matrix[6] * y,
    );
    camera.projectionMatrix = shifted;
    let restored = false;
    return (this.restoreSample = () => {
      if (restored) return;
      restored = true;
      this.restoreSample = null;
      if (camera.destroyed) return;
      camera.transform.position = position;
      if (custom) camera.projectionMatrix = projection;
      else camera.resetProjectionMatrix();
    });
  }
  dispose() {
    if (this.disposed) return;
    this.restoreSample?.();
    this.disposed = true;
    lenses.delete(this.camera);
    if (this.camera.destroyed) return;
    this.camera.fieldOfView = this.previous.fov;
    this.camera.aspectRatio = this.previous.aspect;
    if (this.previous.custom) this.camera.projectionMatrix = this.previous.projection;
    else this.camera.resetProjectionMatrix();
  }
}
