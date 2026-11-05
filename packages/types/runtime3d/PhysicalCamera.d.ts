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
export declare function physicalCameraSettings(spec: PhysicalCameraSpec): Readonly<PhysicalCameraSettings>;
export declare function physicalCameraMetrics(spec: PhysicalCameraSpec, fps: number): Readonly<{
    verticalFovDegrees: number;
    apertureRadiusM: number;
    exposureSeconds: number;
    ev100: number;
    exposureMultiplier: number;
}>;
/** Owns lens/projection settings, borrows camera pose. Vertical sensor fit. */
export declare class ZhudaPhysicalCameraRig {
    readonly camera: Laya.Camera;
    private settings;
    private readonly previous;
    private disposed;
    private restoreSample;
    constructor(camera: Laya.Camera, spec: PhysicalCameraSpec);
    private check;
    get spec(): Readonly<PhysicalCameraSettings>;
    configure(patch: Partial<PhysicalCameraSettings>): void;
    apply(aspect: number): void;
    applyExposure(pipeline: {
        setExposure(value: number): void;
    }, fps: number): void;
    /** Temporary aperture and subpixel offsets; always call the returned restore. */
    sample(lensX: number, lensY: number, jitterX: number, jitterY: number, width: number, height: number): () => void;
    dispose(): void;
}
