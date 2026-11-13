// Generated from TypeScript source; run npm run types:generate.
/**
 * Three effects of a camera that a game needs while it runs, as post-process
 * effects for `ZhudaFilmicPipeline` (`sceneEffects`, after reflections and
 * fog, before bloom and the grade):
 *
 * - `ZhudaAutoExposure`: the frame's brightness, read on the GPU and followed
 *   over time, steers how bright the picture is drawn: eyes that get used to
 *   a dark alley and to a noon square.
 * - `ZhudaDepthOfField`: what is nearer or farther than the focus distance is
 *   blurred by as much as a lens of that focal length and aperture would.
 * - `ZhudaMotionBlur`: what the camera's own movement smears during the time
 *   the shutter is open. Things that move by themselves are not blurred.
 *
 * A film still or video gets depth of field and motion blur by drawing many
 * samples (`ZhudaFilmRenderer`), which is exact; these are the one-frame
 * approximations for a picture that is drawn once.
 */
export interface ZhudaAutoExposureOptions {
    /**
     * The brightness the picture is brought to, as the scene value of a middle
     * grey before the grade, 0.01..4 (default 0.18).
     */
    key?: number;
    /** The least the picture is multiplied by, 0.01..64 (default 0.25): how far a bright scene is dimmed. */
    min?: number;
    /** The most it is multiplied by, 0.01..64 (default 4): how far a dark scene is lifted. */
    max?: number;
    /**
     * How fast the eye gets used to a new brightness, per second, 0..60
     * (default 1.5); 0 follows the frame at once (a still).
     */
    speed?: number;
    /** How much of the correction is applied, 0..1 (default 1). */
    strength?: number;
}
export declare function validateZhudaAutoExposure(options: ZhudaAutoExposureOptions): string[];
export declare function resolveZhudaAutoExposure(options?: ZhudaAutoExposureOptions): Required<ZhudaAutoExposureOptions>;
/** How far the adapted brightness moves toward the metered one in `seconds` at `speed` per second. */
export declare function zhudaExposureRate(speed: number, seconds: number): number;
export declare class ZhudaAutoExposure {
    /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, last. */
    readonly effect: any;
    private options;
    private readonly meter;
    private readonly adapt;
    private readonly apply;
    /** Two pictures of one texel: what the eye was used to, and is used to now. */
    private readonly used;
    private current;
    private seconds;
    private disposed;
    constructor(options?: ZhudaAutoExposureOptions);
    private write;
    /** Changes the settings in place; the brightness the eye is used to is kept. */
    setExposure(options: ZhudaAutoExposureOptions): void;
    /** The time the next frame stands for, in seconds (default 1/60): how far the eye adapts in it. */
    setFrameSeconds(seconds: number): void;
    dispose(): void;
}
export interface ZhudaDepthOfFieldOptions {
    /** Distance in metres that is sharp, 0.05..100000. */
    focusDistanceM: number;
    /** Aperture as an f-number, 0.5..64 (default 2.8): smaller blurs more. */
    fStop?: number;
    /** Focal length in millimetres, 4..1200 (default 50). */
    focalLengthMm?: number;
    /** Height of the sensor in millimetres, 1..100 (default 24, full frame). */
    sensorHeightMm?: number;
    /** The largest blur radius drawn, as a share of the frame's height, 0.001..0.05 (default 0.02). */
    maxRadius?: number;
}
export declare function validateZhudaDepthOfField(options: ZhudaDepthOfFieldOptions): string[];
export declare function resolveZhudaDepthOfField(options: ZhudaDepthOfFieldOptions): Required<ZhudaDepthOfFieldOptions>;
/**
 * Radius of the blur disc of something infinitely far, as a share of the
 * frame's height: the thin-lens circle of confusion f² / (N (S − f)), halved,
 * over the sensor's height. Something at depth D has this times (D − S) / D.
 */
export declare function zhudaDofRadiusAtInfinity(options: Required<ZhudaDepthOfFieldOptions>): number;
export declare class ZhudaDepthOfField {
    /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, after fog. */
    readonly effect: any;
    private options;
    private readonly prepare;
    private readonly gather;
    private readonly compose;
    private aspect;
    private disposed;
    constructor(options: ZhudaDepthOfFieldOptions);
    private write;
    /** Changes focus, aperture and the rest in place (pulling focus while the game runs). */
    setLens(options: Partial<ZhudaDepthOfFieldOptions>): void;
    dispose(): void;
}
export interface ZhudaMotionBlurOptions {
    /**
     * Share of the time between two frames the shutter is open, 0..1 (default
     * 0.5, a 180-degree shutter).
     */
    shutter?: number;
    /** The longest smear drawn, as a share of the frame, 0.001..0.2 (default 0.04). */
    maxLength?: number;
}
export declare function validateZhudaMotionBlur(options: ZhudaMotionBlurOptions): string[];
export declare function resolveZhudaMotionBlur(options?: ZhudaMotionBlurOptions): Required<ZhudaMotionBlurOptions>;
/** The camera as the shader takes it: where it is and its three axes, the two across scaled to the frame. */
export declare function zhudaCameraBasis(eye: readonly number[], target: readonly number[], fieldOfViewDeg: number, aspect: number): {
    eye: number[];
    forward: number[];
    right: number[];
    up: number[];
    tan: number;
};
export declare class ZhudaMotionBlur {
    /** The Laya post-process effect; give it to `ZhudaFilmicPipeline` in `sceneEffects`, after depth of field. */
    readonly effect: any;
    private options;
    private readonly material;
    private before;
    private disposed;
    constructor(options?: ZhudaMotionBlurOptions);
    /** Changes the shutter and the longest smear in place. */
    setBlur(options: ZhudaMotionBlurOptions): void;
    private shape;
    /**
     * Call once a frame with the camera, before the frame is drawn. The smear
     * runs from where the camera was at the call before to where it is now.
     */
    update(eye: readonly number[], target: readonly number[], fieldOfViewDeg: number, aspect: number): void;
    /** After a cut or a teleport: the next frame is not smeared from the old place. */
    resetHistory(): void;
    dispose(): void;
}
