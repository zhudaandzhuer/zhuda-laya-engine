// Generated from TypeScript source; run npm run types:generate.
/**
 * Spatial voices for IframeSoundAdapter.
 *
 * With a PannerNode the browser does the work (HRTF where it has it). Where a
 * host has no PannerNode, the same Web Audio formulas are computed here and
 * applied through one GainNode (distance and cone) and, when the host has it,
 * one StereoPannerNode (equal-power left/right): the voice is still placed,
 * only without HRTF and without elevation.
 *
 * The formulas follow the Web Audio API specification: "Azimuth and
 * Elevation", "Distance Effects", "Sound Cones" and the equal-power panning
 * of a mono input.
 */
import type { IframeListenerPose, IframeSpatialOptions } from '../zhuda-audio.js';
export type SpatialVec3 = readonly [number, number, number];
export interface ResolvedListener {
    position: SpatialVec3;
    forward: SpatialVec3;
    up: SpatialVec3;
}
export interface ResolvedSpatial {
    position: SpatialVec3;
    orientation: SpatialVec3;
    panningModel: 'HRTF' | 'equalpower';
    distanceModel: 'linear' | 'inverse' | 'exponential';
    refDistance: number;
    maxDistance: number;
    rolloffFactor: number;
    coneInnerAngle: number;
    coneOuterAngle: number;
    coneOuterGain: number;
}
export declare const DEFAULT_LISTENER: ResolvedListener;
/** A position as three finite numbers, or null. */
export declare function resolvePosition(value: unknown): SpatialVec3 | null;
/** The ramp of a move in seconds of audio time (0..1), or null. */
export declare function resolveRamp(value: unknown): number | null;
/** A listener pose with defaults, or null when it is not one. */
export declare function resolveListener(pose: IframeListenerPose): ResolvedListener | null;
/** Spatial options with the Web Audio defaults, or null when one is out of range. */
export declare function resolveSpatial(options: IframeSpatialOptions): ResolvedSpatial | null;
/** Azimuth in degrees (0 ahead, +90 to the right, ±180 behind) of a source heard by the listener. */
export declare function spatialAzimuth(source: SpatialVec3, listener: ResolvedListener): number;
/** Equal-power left and right gains of a mono source at this azimuth (front and back fold together). */
export declare function equalPowerGains(azimuth: number): [number, number];
/** The pan (-1 left .. 1 right) a StereoPannerNode needs for the same equal-power gains. */
export declare function stereoPan(azimuth: number): number;
/** Distance gain of the Web Audio distance models. */
export declare function distanceGain(options: ResolvedSpatial, distance: number): number;
/** Cone gain of a directional source as the listener sees it. */
export declare function coneGain(options: ResolvedSpatial, listener: ResolvedListener): number;
/** The fallback's gain and pan for a voice: what a PannerNode with equal-power panning would give. */
export declare function fallbackPlacement(options: ResolvedSpatial, listener: ResolvedListener): {
    gain: number;
    pan: number;
};
/** Sets an AudioParam now, or glides to it over `ramp` seconds. */
export declare function setParam(param: AudioParam, value: number, now: number, ramp: number): void;
/** Places a PannerNode (AudioParams, or the older setPosition/setOrientation). */
export declare function placePanner(panner: PannerNode, position: SpatialVec3, orientation: SpatialVec3, now: number, ramp: number): void;
/** Places the context's AudioListener (AudioParams, or the older setPosition/setOrientation). */
export declare function placeListener(listener: AudioListener | undefined, pose: ResolvedListener, now: number, ramp: number): void;
