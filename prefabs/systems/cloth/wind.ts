// The wind a cloth feels: a main wind that swells and slackens, with gusts that veer to either side and lift a
// little. Numbers only: no engine, no clock of its own, no random number. The same seconds give the same wind.
//
// As the MagicCloth plugin's wind zone has it (main strength, turbulence, frequency), with each cloth taking
// its own share (its preset's `windInfluence`) and its own place in the gusts, so that two skirts side by side
// do not move as one.

export interface WindZone {
  /** The way the main wind blows on the ground (x, z); any length. */
  direction: readonly [number, number];
  /** Metres a second when it blows its hardest. */
  main: number;
  /** How much the gusts veer and vary: 0 is a steady wind, 1 a lively one, up to 2. */
  turbulence: number;
  /** How fast it changes: 1 is a swell every seven seconds or so. */
  frequency: number;
}

/** A town's wind (zhuda-spacetime-3d: down the river, as the trees have it). */
export const TOWN_WIND: WindZone = { direction: [0.9, 0.15], main: 2.6, turbulence: 1, frequency: 1 };

const TAU = Math.PI * 2;

/**
 * The air's velocity (x, y, z in metres a second) at `seconds`, for a cloth that feels `influence` of it.
 * `place` sets where in the gusts this cloth is (any number; a different one for each cloth).
 */
export function windAt(zone: WindZone, seconds: number, influence = 1, place = 0): [number, number, number] {
  const length = Math.hypot(zone.direction[0], zone.direction[1]) || 1;
  const dx = zone.direction[0] / length,
    dz = zone.direction[1] / length;
  const t = seconds * zone.frequency + place * 1.7;
  // A slow swell between a lull and full strength, with a quicker flutter on it.
  const swell = 0.5 + 0.5 * Math.sin(TAU * (t / 7.3) + 0.6 * Math.sin(TAU * (t / 3.1)));
  const flutter = 0.5 + 0.5 * Math.sin(TAU * (t / 1.37) + place);
  const strength = zone.main * influence * (0.25 + 0.75 * swell) * (1 - 0.3 * zone.turbulence * flutter);
  // The gusts veer to either side of the main wind, and lift and press a little.
  const veer = zone.turbulence * 0.5 * (Math.sin(TAU * (t / 4.9) + place * 2.3) + 0.5 * Math.sin(TAU * (t / 1.9)));
  const cos = Math.cos(veer),
    sin = Math.sin(veer);
  const lift = zone.turbulence * 0.18 * Math.sin(TAU * (t / 2.6) + place);
  return [(dx * cos - dz * sin) * strength, lift * strength, (dx * sin + dz * cos) * strength];
}
