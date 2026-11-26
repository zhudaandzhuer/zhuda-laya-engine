// systems/circle-merge: circles dropped into a container fall, roll and stack, and two of the same
// tier that touch become one of the next tier (two of the top tier vanish). Pure TypeScript, no
// engine: a game steps it at a fixed rate and draws `bodies`; `step` returns the merges of that
// step. Tiers are the caller's: `radii[tier]` and `points[tier]`. Units are design pixels and
// seconds; y grows downwards and `bounds.floor` is the bottom.
// From the workspace game zhuda-hehele (`src/physics.ts`, 2026-11-18), unchanged apart from this
// header. Route: docs/routes/drop-merge-2d-minigame.md.

export interface Body {
  id: number;
  tier: number; // 0-based index into TIERS
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  angle: number;
  /** Seconds since this body entered the jar (used for the danger-line grace period). */
  age: number;
  dead: boolean;
  /** Strongest impact speed (px/s) since the renderer last read it; drives the squash animation. */
  impact: number;
}

export interface MergeEvent {
  from: number; // tier of the two that merged
  to: number; // new tier, or -1 when two top-tier bodies vanished
  x: number;
  y: number;
  points: number;
}

export interface JarBounds {
  left: number;
  right: number;
  floor: number;
}

export const GRAVITY = 2200; // px/s²
const SUBSTEPS = 6;
const ITERATIONS = 3;
const RESTITUTION = 0.12;
const FRICTION = 0.04;
const AIR_DAMPING = 0.998;

export class World {
  bodies: Body[] = [];
  private nextId = 1;

  bounds: JarBounds;
  radii: readonly number[];
  points: readonly number[];

  constructor(bounds: JarBounds, radii: readonly number[], points: readonly number[]) {
    this.bounds = bounds;
    this.radii = radii;
    this.points = points;
  }

  add(tier: number, x: number, y: number, vx = 0, vy = 0): Body {
    const r = this.radii[tier]!;
    const body: Body = { id: this.nextId++, tier, x, y, vx, vy, r, angle: 0, age: 0, dead: false, impact: 0 };
    this.bodies.push(body);
    return body;
  }

  /** Advances the simulation by dt seconds and returns the merges that happened. */
  step(dt: number): MergeEvent[] {
    const events: MergeEvent[] = [];
    const h = Math.min(dt, 1 / 20) / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const b of this.bodies) {
        b.vy += GRAVITY * h;
        b.vx *= AIR_DAMPING;
        b.vy *= AIR_DAMPING;
        b.x += b.vx * h;
        b.y += b.vy * h;
      }
      for (let it = 0; it < ITERATIONS; it++) {
        this.collidePairs(events);
        this.collideWalls();
      }
      this.removeDead();
    }
    for (const b of this.bodies) {
      b.age += dt;
      b.angle += (b.vx * dt) / b.r; // roll
    }
    return events;
  }

  private collideWalls(): void {
    const { left, right, floor } = this.bounds;
    for (const b of this.bodies) {
      if (b.x - b.r < left) {
        b.x = left + b.r;
        if (b.vx < 0) b.vx = -b.vx * RESTITUTION;
      } else if (b.x + b.r > right) {
        b.x = right - b.r;
        if (b.vx > 0) b.vx = -b.vx * RESTITUTION;
      }
      if (b.y + b.r > floor) {
        b.y = floor - b.r;
        if (b.vy > 0) {
          b.impact = Math.max(b.impact, b.vy);
          b.vy = -b.vy * RESTITUTION;
        }
        b.vx *= 1 - FRICTION;
      }
    }
  }

  private collidePairs(events: MergeEvent[]): void {
    const list = this.bodies;
    const top = this.radii.length - 1;
    for (let i = 0; i < list.length; i++) {
      const a = list[i]!;
      if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]!;
        if (b.dead) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= min * min) continue;
        if (a.tier === b.tier) {
          this.merge(a, b, top, events);
          if (a.dead) break;
          continue;
        }
        const d = Math.sqrt(d2) || 0.0001;
        const nx = dx / d;
        const ny = dy / d;
        const overlap = min - d;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const wa = mb / (ma + mb);
        const wb = ma / (ma + mb);
        a.x -= nx * overlap * wa;
        a.y -= ny * overlap * wa;
        b.x += nx * overlap * wb;
        b.y += ny * overlap * wb;
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          a.impact = Math.max(a.impact, -vn);
          b.impact = Math.max(b.impact, -vn);
          const jn = (-(1 + RESTITUTION) * vn) / (1 / ma + 1 / mb);
          a.vx -= (jn * nx) / ma;
          a.vy -= (jn * ny) / ma;
          b.vx += (jn * nx) / mb;
          b.vy += (jn * ny) / mb;
          // Tangential friction.
          const tx = -ny;
          const ty = nx;
          const vt = rvx * tx + rvy * ty;
          const jt = (-vt * FRICTION) / (1 / ma + 1 / mb);
          a.vx -= (jt * tx) / ma;
          a.vy -= (jt * ty) / ma;
          b.vx += (jt * tx) / mb;
          b.vy += (jt * ty) / mb;
        }
      }
    }
  }

  private merge(a: Body, b: Body, top: number, events: MergeEvent[]): void {
    a.dead = true;
    b.dead = true;
    const x = (a.x + b.x) / 2;
    const y = (a.y + b.y) / 2;
    if (a.tier >= top) {
      events.push({ from: a.tier, to: -1, x, y, points: this.points[top]! * 2 });
      return;
    }
    const to = a.tier + 1;
    const nb = this.add(to, x, y, (a.vx + b.vx) / 2, Math.min(a.vy, b.vy) * 0.5);
    nb.age = Math.max(a.age, b.age);
    // Keep the new body inside the jar.
    nb.x = Math.min(Math.max(nb.x, this.bounds.left + nb.r), this.bounds.right - nb.r);
    nb.y = Math.min(nb.y, this.bounds.floor - nb.r);
    events.push({ from: a.tier, to, x: nb.x, y: nb.y, points: this.points[to]! });
  }

  private removeDead(): void {
    if (this.bodies.some((b) => b.dead)) this.bodies = this.bodies.filter((b) => !b.dead);
  }

  /** The highest point (smallest y) reached by a settled body older than `grace` seconds. */
  highestSettledTop(grace: number): number {
    let top = Infinity;
    for (const b of this.bodies) {
      if (b.age < grace) continue;
      if (Math.abs(b.vy) > 260) continue;
      top = Math.min(top, b.y - b.r);
    }
    return top;
  }
}
