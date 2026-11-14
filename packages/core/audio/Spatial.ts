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
import type { IframeListenerPose, IframeSpatialOptions } from '../../types/zhuda-audio.ts';

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

export const DEFAULT_LISTENER: ResolvedListener = {
  position: [0, 0, 0],
  forward: [0, 0, -1],
  up: [0, 1, 0],
};

const LIMIT = 1e6;
const isVec3 = (value: unknown): value is SpatialVec3 =>
  Array.isArray(value) &&
  value.length === 3 &&
  value.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= LIMIT);
const length = (v: SpatialVec3) => Math.hypot(v[0], v[1], v[2]);
const cross = (a: SpatialVec3, b: SpatialVec3): [number, number, number] => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: SpatialVec3, b: SpatialVec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (v: SpatialVec3): [number, number, number] => {
  const l = length(v);
  return l > 0 ? [v[0] / l, v[1] / l, v[2] / l] : [0, 0, 0];
};
const copy = (v: SpatialVec3): SpatialVec3 => [v[0], v[1], v[2]];

/** A position as three finite numbers, or null. */
export function resolvePosition(value: unknown): SpatialVec3 | null {
  return isVec3(value) ? copy(value) : null;
}

/** The ramp of a move in seconds of audio time (0..1), or null. */
export function resolveRamp(value: unknown): number | null {
  const ramp = value ?? 0;
  return typeof ramp === 'number' && Number.isFinite(ramp) && ramp >= 0 && ramp <= 1 ? ramp : null;
}

/** A listener pose with defaults, or null when it is not one. */
export function resolveListener(pose: IframeListenerPose): ResolvedListener | null {
  if (!pose || typeof pose !== 'object') return null;
  const forward = pose.forward ?? DEFAULT_LISTENER.forward,
    up = pose.up ?? DEFAULT_LISTENER.up;
  if (!isVec3(pose.position) || !isVec3(forward) || !isVec3(up)) return null;
  // Forward and up must be real directions and not along one line.
  if (!(length(forward) > 1e-9) || !(length(up) > 1e-9)) return null;
  if (!(length(cross(unit(forward), unit(up))) > 1e-6)) return null;
  return { position: copy(pose.position), forward: copy(forward), up: copy(up) };
}

/** Spatial options with the Web Audio defaults, or null when one is out of range. */
export function resolveSpatial(options: IframeSpatialOptions): ResolvedSpatial | null {
  if (!options || typeof options !== 'object' || !isVec3(options.position)) return null;
  const o = options,
    orientation = o.orientation ?? [1, 0, 0],
    panningModel = o.panningModel ?? 'HRTF',
    distanceModel = o.distanceModel ?? 'inverse',
    refDistance = o.refDistance ?? 1,
    maxDistance = o.maxDistance ?? 10000,
    rolloffFactor = o.rolloffFactor ?? 1,
    coneInnerAngle = o.coneInnerAngle ?? 360,
    coneOuterAngle = o.coneOuterAngle ?? 360,
    coneOuterGain = o.coneOuterGain ?? 0;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (
    !isVec3(orientation) ||
    (panningModel !== 'HRTF' && panningModel !== 'equalpower') ||
    !['linear', 'inverse', 'exponential'].includes(distanceModel) ||
    !finite(refDistance) ||
    refDistance <= 0 ||
    !finite(maxDistance) ||
    maxDistance <= 0 ||
    (distanceModel === 'linear' && maxDistance <= refDistance) ||
    !finite(rolloffFactor) ||
    rolloffFactor < 0 ||
    // Web Audio rejects a linear rolloff above 1 by clamping; say so instead.
    (distanceModel === 'linear' && rolloffFactor > 1) ||
    !finite(coneInnerAngle) ||
    coneInnerAngle < 0 ||
    coneInnerAngle > 360 ||
    !finite(coneOuterAngle) ||
    coneOuterAngle < coneInnerAngle ||
    coneOuterAngle > 360 ||
    !finite(coneOuterGain) ||
    coneOuterGain < 0 ||
    coneOuterGain > 1
  )
    return null;
  return {
    position: copy(o.position),
    orientation: copy(orientation),
    panningModel,
    distanceModel,
    refDistance,
    maxDistance,
    rolloffFactor,
    coneInnerAngle,
    coneOuterAngle,
    coneOuterGain,
  };
}

/** Azimuth in degrees (0 ahead, +90 to the right, ±180 behind) of a source heard by the listener. */
export function spatialAzimuth(source: SpatialVec3, listener: ResolvedListener): number {
  const toSource = unit([
    source[0] - listener.position[0],
    source[1] - listener.position[1],
    source[2] - listener.position[2],
  ]);
  if (!length(toSource)) return 0;
  const forward = unit(listener.forward),
    right = unit(cross(forward, listener.up)),
    up = cross(right, forward),
    lift = dot(toSource, up),
    projected = unit([
      toSource[0] - lift * up[0],
      toSource[1] - lift * up[1],
      toSource[2] - lift * up[2],
    ]);
  if (!length(projected)) return 0;
  let azimuth = (180 * Math.acos(Math.max(-1, Math.min(1, dot(projected, right))))) / Math.PI;
  if (dot(projected, forward) < 0) azimuth = 360 - azimuth;
  return azimuth >= 0 && azimuth <= 270 ? 90 - azimuth : 450 - azimuth;
}

/** Equal-power left and right gains of a mono source at this azimuth (front and back fold together). */
export function equalPowerGains(azimuth: number): [number, number] {
  let a = Math.max(-180, Math.min(180, azimuth));
  if (a < -90) a = -180 - a;
  else if (a > 90) a = 180 - a;
  const x = (a + 90) / 180;
  return [Math.cos((x * Math.PI) / 2), Math.sin((x * Math.PI) / 2)];
}

/** The pan (-1 left .. 1 right) a StereoPannerNode needs for the same equal-power gains. */
export function stereoPan(azimuth: number): number {
  let a = Math.max(-180, Math.min(180, azimuth));
  if (a < -90) a = -180 - a;
  else if (a > 90) a = 180 - a;
  return a / 90;
}

/** Distance gain of the Web Audio distance models. */
export function distanceGain(options: ResolvedSpatial, distance: number): number {
  const { refDistance: ref, maxDistance: max, rolloffFactor: rolloff } = options;
  if (options.distanceModel === 'linear') {
    const d = Math.max(ref, Math.min(max, distance));
    return 1 - (Math.min(1, rolloff) * (d - ref)) / (max - ref);
  }
  const d = Math.max(ref, distance);
  if (options.distanceModel === 'exponential') return Math.pow(d / ref, -rolloff);
  return ref / (ref + rolloff * (d - ref));
}

/** Cone gain of a directional source as the listener sees it. */
export function coneGain(options: ResolvedSpatial, listener: ResolvedListener): number {
  const facing = unit(options.orientation);
  if (!length(facing) || (options.coneInnerAngle === 360 && options.coneOuterAngle === 360))
    return 1;
  const toListener = unit([
    listener.position[0] - options.position[0],
    listener.position[1] - options.position[1],
    listener.position[2] - options.position[2],
  ]);
  if (!length(toListener)) return 1;
  const angle = Math.abs(
      (180 * Math.acos(Math.max(-1, Math.min(1, dot(toListener, facing))))) / Math.PI,
    ),
    inner = options.coneInnerAngle / 2,
    outer = options.coneOuterAngle / 2;
  if (angle <= inner) return 1;
  if (angle >= outer) return options.coneOuterGain;
  const x = (angle - inner) / (outer - inner);
  return 1 - x + options.coneOuterGain * x;
}

/** The fallback's gain and pan for a voice: what a PannerNode with equal-power panning would give. */
export function fallbackPlacement(options: ResolvedSpatial, listener: ResolvedListener) {
  const offset: SpatialVec3 = [
    options.position[0] - listener.position[0],
    options.position[1] - listener.position[1],
    options.position[2] - listener.position[2],
  ];
  return {
    gain: distanceGain(options, length(offset)) * coneGain(options, listener),
    pan: stereoPan(spatialAzimuth(options.position, listener)),
  };
}

type Param = AudioParam | undefined;
/** Sets an AudioParam now, or glides to it over `ramp` seconds. */
export function setParam(param: AudioParam, value: number, now: number, ramp: number): void {
  if (ramp > 0) {
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + ramp);
  } else param.setValueAtTime(value, now);
}
const setTriple = (
  params: [Param, Param, Param],
  legacy: ((x: number, y: number, z: number) => void) | undefined,
  value: SpatialVec3,
  now: number,
  ramp: number,
) => {
  if (params[0] && params[1] && params[2])
    params.forEach((param, k) => setParam(param as AudioParam, value[k], now, ramp));
  else legacy?.(value[0], value[1], value[2]);
};

/** Places a PannerNode (AudioParams, or the older setPosition/setOrientation). */
export function placePanner(
  panner: PannerNode,
  position: SpatialVec3,
  orientation: SpatialVec3,
  now: number,
  ramp: number,
): void {
  const legacy = panner as unknown as {
    setPosition?: (x: number, y: number, z: number) => void;
    setOrientation?: (x: number, y: number, z: number) => void;
  };
  setTriple(
    [panner.positionX, panner.positionY, panner.positionZ],
    legacy.setPosition?.bind(panner),
    position,
    now,
    ramp,
  );
  setTriple(
    [panner.orientationX, panner.orientationY, panner.orientationZ],
    legacy.setOrientation?.bind(panner),
    orientation,
    now,
    ramp,
  );
}

/** Places the context's AudioListener (AudioParams, or the older setPosition/setOrientation). */
export function placeListener(
  listener: AudioListener | undefined,
  pose: ResolvedListener,
  now: number,
  ramp: number,
): void {
  if (!listener) return;
  const l = listener as unknown as {
    positionX?: AudioParam;
    positionY?: AudioParam;
    positionZ?: AudioParam;
    forwardX?: AudioParam;
    forwardY?: AudioParam;
    forwardZ?: AudioParam;
    upX?: AudioParam;
    upY?: AudioParam;
    upZ?: AudioParam;
    setPosition?: (x: number, y: number, z: number) => void;
    setOrientation?: (x: number, y: number, z: number, ux: number, uy: number, uz: number) => void;
  };
  setTriple(
    [l.positionX, l.positionY, l.positionZ],
    l.setPosition?.bind(listener),
    pose.position,
    now,
    ramp,
  );
  if (l.forwardX && l.forwardY && l.forwardZ && l.upX && l.upY && l.upZ) {
    setTriple([l.forwardX, l.forwardY, l.forwardZ], undefined, pose.forward, now, ramp);
    setTriple([l.upX, l.upY, l.upZ], undefined, pose.up, now, ramp);
  } else
    l.setOrientation?.call(
      listener,
      pose.forward[0],
      pose.forward[1],
      pose.forward[2],
      pose.up[0],
      pose.up[1],
      pose.up[2],
    );
}
