/**
 * Which lamps' shadows to draw this frame. A point light's shadow is six
 * pictures of the scene (`ZhudaPointShadow.render`), and nothing draws them
 * again by itself: a lamp that moved, or a lamp something moved under,
 * keeps its old shadow. Drawing all of eight lamps every frame is 48
 * pictures a frame.
 *
 * The schedule keeps, for each lamp, where it is and whether its pictures
 * are out of date, and draws at most so many lamps a frame, the one that
 * has waited longest first. A lamp is out of date when it is placed for the
 * first time, when it moves or its reach changes, when the game says
 * something moved near it (`touch`), and, for a lamp marked `moving`,
 * always: those are drawn in turn, so eight of them each get new pictures
 * every eighth frame at one lamp a frame.
 *
 * It has no clock and draws nothing itself: `update()` is one frame, and
 * `draw` is `ZhudaPointShadow.render` or anything with its arguments.
 * Needs no runtime.
 */

export interface ZhudaPointShadowLamp {
  position: readonly [number, number, number];
  /** How far the lamp's light reaches, in scene units. */
  range: number;
  /**
   * Things move in this lamp's light all the time (a street with walkers):
   * its pictures are out of date every frame, and it takes its turn with the
   * other such lamps (default false).
   */
  moving?: boolean;
}

export interface ZhudaPointShadowScheduleOptions {
  /** Lamps drawn in one `update()` at most, 1..8 (default 1). */
  perFrame?: number;
  /**
   * How far a lamp may move, in scene units, before its pictures count as
   * out of date, 0..10 (default 0.01).
   */
  tolerance?: number;
}

/** Lists what is wrong with the options; empty when they are valid. */
export function validateZhudaPointShadowSchedule(
  options: ZhudaPointShadowScheduleOptions,
): string[] {
  const issues: string[] = [];
  const o = (options ?? {}) as Record<string, unknown>;
  if (
    o.perFrame !== undefined &&
    !(Number.isInteger(o.perFrame) && (o.perFrame as number) >= 1 && (o.perFrame as number) <= 8)
  )
    issues.push('perFrame: use a whole number 1..8');
  if (
    o.tolerance !== undefined &&
    !(
      typeof o.tolerance === 'number' &&
      Number.isFinite(o.tolerance) &&
      o.tolerance >= 0 &&
      o.tolerance <= 10
    )
  )
    issues.push('tolerance: use 0..10');
  return issues;
}

interface Entry {
  position: [number, number, number];
  range: number;
  moving: boolean;
  /** Out of date since this frame (the one waiting longest is drawn first); -1 when up to date. */
  since: number;
  /** The frame it was last drawn in; -1 when never. */
  drawn: number;
}

export class ZhudaPointShadowSchedule {
  private readonly entries = new Map<number, Entry>();
  private readonly perFrame: number;
  private readonly tolerance: number;
  private frame = 0;
  private readonly draw: (position: readonly number[], range: number, light: number) => void;
  private readonly clear: ((light: number) => void) | undefined;

  /**
   * `draw(position, range, light)` draws the six pictures of a lamp;
   * `clear(light)`, when given, is told that a lamp was taken away.
   */
  constructor(
    draw: (position: readonly number[], range: number, light: number) => void,
    options: ZhudaPointShadowScheduleOptions = {},
    clear?: (light: number) => void,
  ) {
    if (typeof draw !== 'function') throw Error('A draw function is required');
    const issues = validateZhudaPointShadowSchedule(options);
    if (issues.length) throw Error('Invalid point shadow schedule: ' + issues.join('; '));
    this.draw = draw;
    this.clear = clear;
    this.perFrame = options.perFrame ?? 1;
    this.tolerance = options.tolerance ?? 0.01;
  }

  /**
   * Where lamp `light` is and how far it reaches. Its pictures count as out
   * of date when it is new, or moved by more than the tolerance, or reaches
   * another distance.
   */
  set(light: number, lamp: ZhudaPointShadowLamp): void {
    if (!Number.isInteger(light) || light < 0)
      throw Error('Invalid lamp: a whole number 0 or above');
    const p = lamp?.position;
    if (
      !Array.isArray(p) ||
      p.length !== 3 ||
      !p.every(Number.isFinite) ||
      !(typeof lamp.range === 'number' && Number.isFinite(lamp.range) && lamp.range > 0)
    )
      throw Error('Invalid lamp: a position and a range above 0 are required');
    const entry = this.entries.get(light);
    if (!entry) {
      this.entries.set(light, {
        position: [p[0], p[1], p[2]],
        range: lamp.range,
        moving: !!lamp.moving,
        since: this.frame,
        drawn: -1,
      });
      return;
    }
    const moved =
      Math.hypot(p[0] - entry.position[0], p[1] - entry.position[1], p[2] - entry.position[2]) >
        this.tolerance || lamp.range !== entry.range;
    entry.moving = !!lamp.moving;
    if (moved) {
      entry.position = [p[0], p[1], p[2]];
      entry.range = lamp.range;
      if (entry.since < 0) entry.since = this.frame;
    }
  }

  /** Something that casts a shadow moved near lamp `light` (or near every lamp, without one). */
  touch(light?: number): void {
    for (const [index, entry] of this.entries)
      if ((light === undefined || light === index) && entry.since < 0) entry.since = this.frame;
  }

  /** Lamp `light` is gone: it is not drawn again, and `clear` is told. */
  remove(light: number): void {
    if (this.entries.delete(light)) this.clear?.(light);
  }

  /** The lamps whose pictures are out of date, the one waiting longest first. */
  pending(): number[] {
    return [...this.entries]
      .filter(([, entry]) => entry.since >= 0 || entry.moving)
      .sort(
        ([a, x], [b, y]) =>
          // A lamp never drawn before any other; then the longest wait; of two
          // that waited as long, the one told to be out of date before the one
          // that only takes its turn; then the lowest number.
          (x.drawn < 0 ? -1 : 0) - (y.drawn < 0 ? -1 : 0) ||
          wait(x) - wait(y) ||
          (x.since >= 0 ? 0 : 1) - (y.since >= 0 ? 0 : 1) ||
          a - b,
      )
      .map(([index]) => index);
  }

  /**
   * One frame: draws up to `perFrame` of the lamps that are out of date and
   * returns which. Call it once a frame, after lamps and casters have moved.
   */
  update(): number[] {
    const drawn = this.pending().slice(0, this.perFrame);
    for (const light of drawn) {
      const entry = this.entries.get(light)!;
      this.draw(entry.position, entry.range, light);
      entry.since = -1;
      entry.drawn = this.frame;
    }
    this.frame++;
    return drawn;
  }

  /** Draws every lamp that is out of date now, whatever `perFrame` says (a cut, a loaded level). */
  flush(): number[] {
    const drawn = this.pending();
    for (const light of drawn) {
      const entry = this.entries.get(light)!;
      this.draw(entry.position, entry.range, light);
      entry.since = -1;
      entry.drawn = this.frame;
    }
    return drawn;
  }
}

/** When a lamp has been waiting since: a moving lamp that is up to date waits since it was last drawn. */
function wait(entry: Entry): number {
  return entry.since >= 0 ? entry.since : entry.drawn;
}
