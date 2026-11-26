// Sheer tights on a pair of legs under a pleated skirt, as one Spine 4.2 rig drawn through the
// engine's ZhudaSpineCharacter (feature `spine42`). The picture is a photo cut into parts; the rig
// does three things a flat picture cannot:
//
//  - the skirt is one mesh on nine pleat chains with Spine physics (and a slow sway of its own);
//    take hold of it and the chain nearest the finger follows by a two-bone IK while the others
//    swing after it, let go and it falls back by itself;
//  - the tights are a mesh weighted to one `pull_<site>` bone at each of ten tear sites (five a
//    leg); pull a site and the nylon goes with the finger on a spring;
//  - pulled far enough a site tears: its `tear_<site>` and `lip_<site>` slots take a small
//    attachment, then a large one (bare leg where the knit opened, extra nylon at the rolled lip).
//
// This file is the hand that drives the rig: it keeps no clock and no pointer of its own. The game
// gives it points in the rig's canvas (the photo's pixels, `spine.stageToCanvas`) and calls `step`.
// How the rig and its pictures were made is in source/ (rig.py, make_parts.py, make_tights.py, the
// generated photos and their prompts). Route: docs/routes/spine-character.md.
//
// After `sync.mjs … 2d/spine-tights` the files are served at `common/2d/spine-tights/assets/<file>`
// next to the game's index.html. The game's zhuda.config.json needs the feature `spine42`.
import type { ZhudaSpineCharacter } from 'zhuda-laya-engine';

export const TIGHTS_BASE = 'common/2d/spine-tights/assets/';
/** The rig (its atlas and page are found beside it), the plain background behind it, and the tear sites. */
export const TIGHTS_FILES = { rig: 'outfit.json', atlas: 'outfit.atlas', page: 'outfit.png', background: 'bg.png', sites: 'sites.json' } as const;
export const tightsPath = (file: keyof typeof TIGHTS_FILES) => `${TIGHTS_BASE}${TIGHTS_FILES[file]}`;

/** The rig's canvas: the photo's pixels. Everything this module takes and gives is in these. */
export const TIGHTS_CANVAS = { width: 1024, height: 1536 } as const;
/** The background's middle grey, for the page and the engine's clear colour. */
export const TIGHTS_BACKGROUND_CSS = '#a49e9f';
/** The rig's one animation: the pleats sway slowly by themselves, four seconds a cycle (about 13 pixels each way at the hem). */
export const TIGHTS_IDLE = 'idle';
export const SKIRT_CHAINS = 9;

/** A place where the tights can be pulled and torn: its middle on the canvas and the leg's width there. */
export interface TearSite {
  name: string;
  x: number;
  y: number;
  w: number;
}
/** 0 whole, 1 a small hole, 2 a large one. */
export type TearStage = 0 | 1 | 2;

/**
 * Where to put the picture on a stage of `width` x `height`: a tall screen shows the legs large
 * (the grey sides are cut), a wide one the whole picture. Scale and the top-left corner.
 */
export function fitTights(width: number, height: number) {
  const { width: cw, height: ch } = TIGHTS_CANVAS;
  const scale = Math.min(height / (ch * 0.9), width / (cw * 0.8));
  return { scale, x: (width - cw * scale) / 2, y: (height - ch * scale) / 2 + ch * scale * 0.02 };
}

export interface SpineTightsOptions {
  /** How far a site is pulled before it tears, in the leg's widths there (it tears at 1.35 times this). Default 0.8. */
  tearAt?: number;
  /** Called when a site tears or everything is mended. */
  onChange?: () => void;
}

export interface SpineTights {
  /** What the pointer holds now. */
  readonly held: 'skirt' | 'leg' | null;
  /** A pointer went down at (x, y) on the canvas: takes the skirt's pleat or the tear site there. Null: neither. */
  press(x: number, y: number): 'skirt' | 'leg' | null;
  /** The pointer is now at (x, y) on the canvas. */
  drag(x: number, y: number): void;
  release(): void;
  /** Each frame, after `spine.update()`: the IK mixes and the nylon's springs. `delta` in seconds. */
  step(delta: number): void;
  /** Tears a site one stage further (for a game that tears without a drag). The stage it is at now. */
  tear(name: string): TearStage | undefined;
  /** Mends every tear. */
  reset(): void;
  stats(): { held: 'skirt' | 'leg' | null; tears: string[]; mix: number[]; pulls: number[] };
}

/** Takes the rig in hand. `spine` is a ZhudaSpineCharacter made from the rig with the animation TIGHTS_IDLE. */
export function createSpineTights(spine: ZhudaSpineCharacter, sites: TearSite[], options: SpineTightsOptions = {}): SpineTights {
  const tearAt = options.tearAt ?? 0.8;
  const chains = Array.from({ length: SKIRT_CHAINS }, (_, i) => ({ tip: `pleat${i}_3`, grab: `grab${i}`, ik: `grab${i}_ik`, mix: 0 }));
  const pulls = sites.map((site) => ({ site, bone: `pull_${site.name}`, stage: 0 as TearStage, offset: [0, 0], velocity: [0, 0], target: [0, 0] }));
  type Pull = (typeof pulls)[number];
  for (const p of pulls) if (!spine.skeleton.findBone(p.bone)) throw Error(`spine-tights: the rig has no bone ${p.bone}`);
  for (const c of chains) if (!spine.skeleton.findBone(c.tip) || !spine.skeleton.findBone(c.grab)) throw Error(`spine-tights: the rig has no chain ${c.tip}`);

  type Held = { kind: 'skirt'; chain: number; start: number[]; tip: number[] } | { kind: 'leg'; pull: Pull; start: number[] };
  let held: Held | null = null;

  const skirtHit = (x: number, y: number) => {
    // Within the skirt's fan: below the waistband, above the hem (as the chain tips are now).
    if (y < 100) return -1;
    let best = -1,
      bestD = Infinity;
    chains.forEach((c, i) => {
      const [tipX, tipY] = spine.boneTipCanvas(c.tip);
      if (y > tipY + 30) return;
      const d = Math.abs(x - tipX) + 0.3 * Math.abs(y - tipY);
      if (d < bestD) (bestD = d), (best = i);
    });
    return bestD < 120 ? best : -1;
  };
  const tear = (p: Pull) => {
    p.stage = Math.min(2, p.stage + 1) as TearStage;
    const size = p.stage === 1 ? 'small' : 'large';
    // The bare leg where it opened, and its rolled lip.
    for (const kind of ['tear', 'lip']) spine.setAttachment(`${kind}_${p.site.name}`, `${kind}_${p.site.name}_${size}`);
    p.target = [0, 0];
    held = null;
    options.onChange?.();
  };

  return {
    get held() {
      return held?.kind ?? null;
    },
    press(x, y) {
      if (held) return held.kind;
      const chain = skirtHit(x, y);
      if (chain >= 0) {
        const c = chains[chain];
        // The grab bone starts at the chain's tip.
        const tip = spine.boneTipCanvas(c.tip);
        held = { kind: 'skirt', chain, start: [x, y], tip };
        spine.moveBoneTo(c.grab, tip[0], tip[1]);
        return 'skirt';
      }
      let best: Pull | null = null,
        bestD = Infinity;
      for (const p of pulls) {
        const d = Math.hypot(x - p.site.x, (y - p.site.y) * 0.6);
        if (d < bestD && d < p.site.w * 0.9) (bestD = d), (best = p);
      }
      if (!best) return null;
      held = { kind: 'leg', pull: best, start: [x, y] };
      return 'leg';
    },
    drag(x, y) {
      if (!held) return;
      const dx = x - held.start[0],
        dy = y - held.start[1];
      if (held.kind === 'skirt') {
        const c = chains[held.chain];
        // Lifted hems go up and out; held lower than its rest the cloth does not stretch past it.
        const lift = Math.max(-40, -dy) * 1.25;
        spine.moveBoneTo(c.grab, held.tip[0] + dx * 1.1, held.tip[1] - lift);
        return;
      }
      const p = held.pull,
        w = p.site.w;
      // The nylon follows the finger, giving way less the farther it goes.
      const len = Math.hypot(dx, dy);
      const give = len > 0 ? (Math.min(len, w * 0.8) * (1 - 0.3 * Math.min(1, len / (w * tearAt)))) / len : 0;
      p.target = [dx * give, dy * give];
      if (len > w * tearAt * 1.35) tear(p);
    },
    release() {
      if (held?.kind === 'leg') held.pull.target = [0, 0];
      held = null;
    },
    step(delta) {
      const dt = Math.min(delta, 0.04);
      chains.forEach((c, i) => {
        const want = held?.kind === 'skirt' && held.chain === i ? 1 : 0;
        // Let go, the IK fades over a fifth of a second and the physics carries the swing.
        c.mix += (want - c.mix) * Math.min(1, dt * (want ? 18 : 5));
        spine.setIkMix(c.ik, c.mix);
      });
      for (const p of pulls) {
        const holding = held?.kind === 'leg' && held.pull === p;
        const stiffness = holding ? 900 : 260,
          damping = holding ? 60 : 15;
        const steps = Math.max(1, Math.ceil(dt * 240));
        for (let s = 0; s < steps; s++) {
          const h = dt / steps;
          for (let k = 0; k < 2; k++) {
            p.velocity[k] += ((p.target[k] - p.offset[k]) * stiffness - p.velocity[k] * damping) * h;
            p.offset[k] += p.velocity[k] * h;
          }
        }
        spine.nudgeBone(p.bone, p.offset[0], p.offset[1]);
      }
    },
    tear(name) {
      const p = pulls.find((q) => q.site.name === name);
      if (p) tear(p);
      return p?.stage;
    },
    reset() {
      for (const p of pulls) {
        p.stage = 0;
        for (const kind of ['tear', 'lip']) spine.setAttachment(`${kind}_${p.site.name}`, null);
      }
      options.onChange?.();
    },
    stats: () => ({
      held: held?.kind ?? null,
      tears: pulls.filter((p) => p.stage).map((p) => `${p.site.name}:${p.stage}`),
      mix: chains.map((c) => +c.mix.toFixed(2)),
      pulls: pulls.map((p) => +Math.hypot(p.offset[0], p.offset[1]).toFixed(1)),
    }),
  };
}
