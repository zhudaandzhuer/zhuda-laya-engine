// 豬大三職業的戰鬥規則（來源：zhuda-spacetime-3d src/systems/combat/targets.ts，0.4.0 收進 prefabs）。純規則：不碰引擎、不碰 DOM。
// What the pig's attacks can strike, and whether they do. Rules only: no engine, no DOM.
//
// A target is a round thing standing somewhere (a training dummy). Each attack reaches in its own way: a blow or
// a cut reaches a little way ahead within an arc; what is thrown (a wave from the sword, the Taoist's bolt) goes
// straight ahead and strikes what is in its way, later the further it is; a charm becomes its spell on the ground
// a few steps ahead and strikes what stands round that place. A struck target sways like a post in the ground.
import type { AttackStep } from './jobs.ts';

export interface Target {
  id: string;
  x: number;
  z: number;
  radius: number;
}

type Effect = AttackStep['effect'];
type Reach =
  | { kind: 'near'; range: number; arcDeg: number; force: number; damage: number }
  /** Thrown straight ahead: how far it goes, how wide it is, how fast; with `also`, a blow near at hand as well. */
  | { kind: 'thrown'; range: number; width: number; speed: number; force: number; damage: number; also?: { range: number; arcDeg: number } }
  /** A spell on the ground `ahead` of the pig, `after` seconds from the throw; `times` strikes, `apart` seconds between. */
  /** With `freeze`, what it strikes is frozen for that long, seconds. */
  | { kind: 'ground'; ahead: number; radius: number; after: number; force: number; damage: number; times?: number; apart?: number; freeze?: number };

/** How each attack reaches. `arcDeg` is the whole arc, half to each side of where the pig faces. */
export const REACH: Record<Effect, Reach> = {
  jab: { kind: 'near', range: 1.35, arcDeg: 80, force: 0.5, damage: 8 },
  straight: { kind: 'near', range: 1.4, arcDeg: 80, force: 0.6, damage: 10 },
  hook: { kind: 'near', range: 1.35, arcDeg: 150, force: 0.75, damage: 12 },
  // the heavy kick, after the leap forward
  kick: { kind: 'near', range: 2.0, arcDeg: 110, force: 1.3, damage: 30 },
  // (tumbling away: it knocks what it rolls against, no more)
  roll: { kind: 'near', range: 0.7, arcDeg: 360, force: 0.3, damage: 3 },
  uppercut: { kind: 'near', range: 1.6, arcDeg: 110, force: 1.1, damage: 26 },
  blaze: { kind: 'near', range: 2.6, arcDeg: 360, force: 1.2, damage: 40 },
  cut: { kind: 'near', range: 1.95, arcDeg: 130, force: 0.7, damage: 14 },
  'back-cut': { kind: 'near', range: 1.95, arcDeg: 150, force: 0.75, damage: 15 },
  chop: { kind: 'thrown', range: 4.5, width: 1.2, speed: 10, force: 1.1, damage: 30, also: { range: 2.2, arcDeg: 150 } },
  crescent: { kind: 'thrown', range: 10, width: 2.2, speed: 14, force: 1.2, damage: 45 },
  'ice-charm': { kind: 'ground', ahead: 3.7, radius: 1.7, after: 0.36, force: 0.5, damage: 22, freeze: 2.4 },
  charm: { kind: 'ground', ahead: 3.7, radius: 1.7, after: 0.36, force: 1, damage: 30 },
  'thunder-charm': { kind: 'ground', ahead: 3.7, radius: 1.5, after: 0.36, force: 1.1, damage: 38 },
  'great-charm': { kind: 'ground', ahead: 3.7, radius: 2.9, after: 0.36, force: 1.1, damage: 26, times: 4, apart: 0.13 },
};

export interface Strike {
  id: string;
  /** Seconds from the attack landing until this target is struck. */
  after: number;
  /** Which way it is pushed (a unit vector on the ground), how hard, and the number that flies off it. */
  pushX: number;
  pushZ: number;
  force: number;
  damage: number;
  /** It is frozen for this long, seconds. */
  freeze?: number;
}

/** What is frozen takes half as much again from the blow that breaks it out. */
export const SHATTER = 1.5;

const forwardOf = (yawDeg: number): [number, number] => [Math.sin((yawDeg * Math.PI) / 180), Math.cos((yawDeg * Math.PI) / 180)];

/** What an attack strikes, done from (x, z) facing `yawDeg` (0 faces +z). Ablaze, the boxer strikes half as hard again. */
export function struck(effect: Effect, from: { x: number; z: number; yawDeg: number }, targets: readonly Target[], ablaze = false, ahead?: number): Strike[] {
  const reach = REACH[effect];
  const [fx, fz] = forwardOf(from.yawDeg);
  const damage = Math.round(reach.damage * (ablaze ? 1.5 : 1));
  const out: Strike[] = [];
  const near = (range: number, arcDeg: number, target: Target): Strike | null => {
    const dx = target.x - from.x,
      dz = target.z - from.z;
    const away = Math.hypot(dx, dz);
    if (away - target.radius > range) return null;
    // Within the arc: measured to its nearer edge, so a target close beside the pig is not missed by a hair.
    const ahead = away > 1e-6 ? (dx * fx + dz * fz) / away : 1;
    const slack = away > 1e-6 ? Math.asin(Math.min(1, target.radius / away)) : Math.PI;
    if (Math.acos(Math.max(-1, Math.min(1, ahead))) - slack > ((arcDeg / 2) * Math.PI) / 180) return null;
    return { id: target.id, after: 0, pushX: away > 1e-6 ? dx / away : fx, pushZ: away > 1e-6 ? dz / away : fz, force: reach.force, damage };
  };
  for (const target of targets) {
    if (reach.kind === 'near') {
      const hit = near(reach.range, reach.arcDeg, target);
      if (hit) out.push(hit);
    } else if (reach.kind === 'thrown') {
      const close = reach.also ? near(reach.also.range, reach.also.arcDeg, target) : null;
      if (close) {
        out.push(close);
        continue;
      }
      const dx = target.x - from.x,
        dz = target.z - from.z;
      const along = dx * fx + dz * fz,
        aside = Math.abs(dx * fz - dz * fx);
      if (along > 0 && along - target.radius <= reach.range && aside <= reach.width / 2 + target.radius)
        out.push({ id: target.id, after: Math.max(0, along - target.radius) / reach.speed, pushX: fx, pushZ: fz, force: reach.force, damage });
    } else {
      const cx = from.x + fx * (ahead ?? reach.ahead),
        cz = from.z + fz * (ahead ?? reach.ahead);
      const dx = target.x - cx,
        dz = target.z - cz;
      const away = Math.hypot(dx, dz);
      if (away - target.radius > reach.radius) continue;
      for (let i = 0; i < (reach.times ?? 1); i++)
        out.push({ id: target.id, after: reach.after + i * (reach.apart ?? 0), pushX: away > 1e-6 ? dx / away : fx, pushZ: away > 1e-6 ? dz / away : fz, force: reach.force, damage, ...(reach.freeze ? { freeze: reach.freeze } : {}) });
    }
  }
  return out;
}

/**
 * How far ahead a charm should land: on the nearest target that is before the pig (within a narrow arc and
 * `furthest` metres, not nearer than `nearest`), or the spell's own distance when there is none.
 */
export function landAhead(effect: Effect, from: { x: number; z: number; yawDeg: number }, targets: readonly Target[], nearest = 1.6, furthest = 7): number {
  const reach = REACH[effect];
  if (reach.kind !== 'ground') return 0;
  const [fx, fz] = forwardOf(from.yawDeg);
  let best = Infinity;
  for (const target of targets) {
    const dx = target.x - from.x,
      dz = target.z - from.z;
    const along = dx * fx + dz * fz,
      aside = Math.abs(dx * fz - dz * fx);
    if (along > 0 && along <= furthest && aside <= target.radius + 0.6 && along < best) best = along;
  }
  return best === Infinity ? reach.ahead : Math.max(nearest, best);
}

/** How far ahead an attack looks for something to turn toward as it begins. */
export function aimRange(effect: Effect): number {
  const reach = REACH[effect];
  return reach.kind === 'near' ? reach.range + 1.2 : reach.kind === 'thrown' ? reach.range : 7;
}

/**
 * The way the pig should face to strike: toward the nearest target within `range` that is not behind it (within
 * `arcDeg` of where it faces), or as it faces when there is none. A spell is aimed so that it falls on the target.
 */
export function aimAt(from: { x: number; z: number; yawDeg: number }, targets: readonly Target[], range: number, arcDeg = 200): number {
  const [fx, fz] = forwardOf(from.yawDeg);
  let best: Target | null = null,
    least = Infinity;
  for (const target of targets) {
    const dx = target.x - from.x,
      dz = target.z - from.z;
    const away = Math.hypot(dx, dz);
    if (away - target.radius > range || away < 1e-6) continue;
    if (Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / away))) > ((arcDeg / 2) * Math.PI) / 180) continue;
    if (away < least) (least = away), (best = target);
  }
  return best ? (Math.atan2(best.x - from.x, best.z - from.z) * 180) / Math.PI : from.yawDeg;
}

/** A struck post: how far it leans (radians) each way, and how fast that is changing. */
export interface Sway {
  x: number;
  z: number;
  vx: number;
  vz: number;
}
export const SWAY = { stiffness: 190, damping: 9, kick: 7.5, most: 0.55 };

export function push(sway: Sway, pushX: number, pushZ: number, force: number): Sway {
  return { ...sway, vx: sway.vx + pushX * SWAY.kick * force, vz: sway.vz + pushZ * SWAY.kick * force };
}

/** The post springs back upright, rocking less each time. */
export function stepSway(sway: Sway, dt: number): Sway {
  let { x, z, vx, vz } = sway;
  for (let left = Math.min(dt, 0.1); left > 1e-9; left -= 1 / 240) {
    const h = Math.min(left, 1 / 240);
    vx += (-SWAY.stiffness * x - SWAY.damping * vx) * h;
    vz += (-SWAY.stiffness * z - SWAY.damping * vz) * h;
    x += vx * h;
    z += vz * h;
    const lean = Math.hypot(x, z);
    if (lean > SWAY.most) (x *= SWAY.most / lean), (z *= SWAY.most / lean);
  }
  return { x, z, vx, vz };
}

/** Blows that follow one another within `COMBO.keeps` seconds are counted together. */
export const COMBO = { keeps: 1.6 };
export function countCombo(combo: { count: number; since: number }, struckNow: number, dt: number): { count: number; since: number } {
  if (struckNow > 0) return { count: combo.count + struckNow, since: 0 };
  const since = combo.since + dt;
  return since > COMBO.keeps ? { count: 0, since } : { count: combo.count, since };
}
