// 豬大跳跳 — a tile platformer's rules, pure, stepped at 60 Hz. The level's solid tiles live in
// the engine's ZhudaTerrain2D (its `isBlocked` is the collision question); the jump button goes
// through the engine's ZhudaInputBuffer (a press just before landing still jumps). Lengths are
// in tiles, time in seconds. Tested in test/game.test.ts.
import { ZhudaInputBuffer, ZhudaTerrain2D, validateTerrain2D, type Terrain2DSpec } from 'zhuda-laya-engine';
import type { LevelDef } from './levels.ts';

export const STEP = 1 / 60;
export const TILE = 48; // pixels a tile is drawn at (the terrain's tileSize)
export const T = { empty: 0, earth: 1, ledge: 2, spikes: 3 } as const;
const GRAVITY = 46, JUMP = 15.2, RUN = 6.4, ACCEL = 60, FALL_MAX = 22;
const COYOTE = 0.09; // seconds after walking off a ledge in which a jump still counts
const CUT = 0.45; // letting go of jump early keeps this share of the rise
const HALF_W = 0.34, HEIGHT = 0.86;

export interface Walker { x: number; y: number; dir: -1 | 1; alive: boolean }
export type JumpEvent = { type: 'jump' | 'land' | 'coin' | 'stomp' | 'hurt' | 'fall' | 'flag' };

export function levelTerrain(level: LevelDef): Terrain2DSpec {
  const width = level.rows[0].length, height = level.rows.length;
  const tiles = level.rows.flatMap((row) => [...row].map((c) => (c === '#' ? T.earth : c === '=' ? T.ledge : c === '^' ? T.spikes : T.empty)));
  const spec: Terrain2DSpec = {
    schemaVersion: 1, dimension: 2, width, height, tileSize: TILE,
    palette: [{ id: T.earth, color: '#6b4a2e', blocked: true }, { id: T.ledge, color: '#8a9a4a', blocked: true }, { id: T.spikes, color: '#8fc7e8' }],
    layers: [{ id: 'ground', tiles }],
  };
  const issues = validateTerrain2D(spec);
  if (issues.length || level.rows.some((r) => r.length !== width)) throw Error(`level ${level.id}: ${issues.join('; ') || 'rows differ in length'}`);
  return spec;
}

export class Game {
  readonly terrain: ZhudaTerrain2D;
  readonly input = new ZhudaInputBuffer({ window: 0.12, capacity: 8 });
  readonly width: number;
  readonly height: number;
  readonly player = { x: 0, y: 0, vx: 0, vy: 0, grounded: false, face: 1 as -1 | 1, coyote: 0, rising: false };
  readonly coins: { x: number; y: number; taken: boolean }[] = [];
  readonly walkers: Walker[] = [];
  flag = { x: 0, y: 0 };
  time = 0;
  taken = 0;
  state: 'play' | 'won' | 'dead' = 'play';
  readonly level: LevelDef;
  private start = { x: 0, y: 0 };

  constructor(level: LevelDef) {
    this.level = level;
    this.terrain = new ZhudaTerrain2D(levelTerrain(level));
    this.width = this.terrain.width;
    this.height = this.terrain.height;
    level.rows.forEach((row, r) =>
      [...row].forEach((c, col) => {
        // Things stand on the bottom edge of their cell; positions are the middle of the feet.
        if (c === 'P') this.start = { x: col + 0.5, y: r + 1 };
        if (c === 'F') this.flag = { x: col + 0.5, y: r + 1 };
        if (c === 'o') this.coins.push({ x: col + 0.5, y: r + 0.5, taken: false });
        if (c === 'e') this.walkers.push({ x: col + 0.5, y: r + 1, dir: -1, alive: true });
      }),
    );
    Object.assign(this.player, this.start);
  }

  private solid(col: number, row: number): boolean {
    if (col < 0 || col >= this.width) return true; // the level's sides are walls
    if (row < 0 || row >= this.height) return false; // open sky, and a pit below
    return this.terrain.isBlocked(col, row);
  }
  private spikes(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.width && row < this.height && this.terrain.getTile('ground', col, row) === T.spikes;
  }
  /** Whether a box with its feet at (x, y) overlaps a solid tile. */
  private blocked(x: number, y: number): boolean {
    for (let col = Math.floor(x - HALF_W); col <= Math.floor(x + HALF_W - 1e-6); col++)
      for (let row = Math.floor(y - HEIGHT); row <= Math.floor(y - 1e-6); row++) if (this.solid(col, row)) return true;
    return false;
  }

  /** `move` is -1, 0 or 1; `jumpHeld` whether the button is down; a new press goes through `input.push('jump', time)`. */
  step(move: number, jumpHeld: boolean): JumpEvent[] {
    const events: JumpEvent[] = [];
    if (this.state !== 'play') return events;
    const p = this.player, dt = STEP;
    this.time += dt;
    // Run: towards the wanted speed.
    const want = Math.sign(move) * RUN;
    p.vx += Math.max(-ACCEL * dt, Math.min(ACCEL * dt, want - p.vx));
    if (move) p.face = move > 0 ? 1 : -1;
    // Jump: buffered press, coyote time, a short hop when the button is let go on the way up.
    p.coyote = p.grounded ? COYOTE : Math.max(0, p.coyote - dt);
    if (p.coyote > 0 && this.input.consume('jump', this.time)) {
      p.vy = -JUMP;
      p.coyote = 0;
      p.grounded = false;
      p.rising = true;
      events.push({ type: 'jump' });
    }
    if (p.rising && !jumpHeld && p.vy < 0) (p.vy *= CUT), (p.rising = false);
    if (p.vy >= 0) p.rising = false;
    p.vy = Math.min(FALL_MAX, p.vy + GRAVITY * dt);
    // Move one axis at a time, stopping at solid tiles.
    const nx = p.x + p.vx * dt;
    if (this.blocked(nx, p.y)) p.vx = 0;
    else p.x = nx;
    const ny = p.y + p.vy * dt;
    const was = p.grounded;
    if (this.blocked(p.x, ny)) {
      if (p.vy > 0) {
        p.y = Math.floor(ny); // feet on the top of the tile below
        p.grounded = true;
        if (!was) events.push({ type: 'land' });
      } else p.y = Math.floor(ny - HEIGHT) + 1 + HEIGHT; // head against a ceiling
      p.vy = 0;
    } else {
      p.y = ny;
      p.grounded = false;
    }
    // Coins.
    for (const c of this.coins)
      if (!c.taken && Math.abs(c.x - p.x) < 0.6 && c.y > p.y - HEIGHT - 0.3 && c.y < p.y + 0.3) (c.taken = true), this.taken++, events.push({ type: 'coin' });
    // Walkers: they turn at walls and at edges; landing on one from above stomps it.
    for (const w of this.walkers) {
      if (!w.alive) continue;
      const ahead = w.x + w.dir * 0.5, col = Math.floor(ahead), row = Math.floor(w.y - 0.5);
      if (this.solid(col, row) || !this.solid(col, row + 1) || this.spikes(col, row)) w.dir = -w.dir as -1 | 1;
      else w.x += w.dir * 1.6 * dt;
      if (Math.abs(w.x - p.x) < 0.72 && p.y > w.y - 0.8 && p.y - HEIGHT < w.y) {
        if (p.vy > 2 && p.y < w.y - 0.25) {
          w.alive = false;
          p.vy = -JUMP * 0.62;
          events.push({ type: 'stomp' });
        } else return this.die(events, 'hurt');
      }
    }
    // Spikes under the feet, a fall out of the level, the flag.
    if (this.spikes(Math.floor(p.x), Math.floor(p.y - 0.2))) return this.die(events, 'hurt');
    if (p.y > this.height + 2) return this.die(events, 'fall');
    if (Math.abs(p.x - this.flag.x) < 0.7 && Math.abs(p.y - this.flag.y) < 1.2) (this.state = 'won'), events.push({ type: 'flag' });
    return events;
  }
  private die(events: JumpEvent[], type: 'hurt' | 'fall'): JumpEvent[] {
    this.state = 'dead';
    events.push({ type });
    return events;
  }
  /** Whether the bot is holding the jump button through the jump it began (its own note). */
  botHeld = true;
  /** A copy that can be played ahead without touching this game (the level's tiles are shared: play never changes them). */
  fork(): Game {
    const f = new Game(this.level);
    Object.assign(f.player, this.player);
    f.coins.forEach((c, i) => (c.taken = this.coins[i].taken));
    f.walkers.forEach((w, i) => Object.assign(w, this.walkers[i]));
    f.time = this.time;
    f.taken = this.taken;
    f.state = this.state;
    return f;
  }
  /** Three stars for every coin, two for most, one for the flag. */
  stars(): number {
    return this.state !== 'won' ? 0 : this.taken === this.coins.length ? 3 : this.taken >= this.coins.length * 0.6 ? 2 : 1;
  }
}

type Act = { move: number; jump: boolean; held: boolean };
/** The simple rule: run right; jump at a wall, a pit, spikes or a walker just ahead. */
function naive(g: Game): Act {
  const p = g.player, t = g.terrain;
  const solid = (c: number, r: number) => c >= 0 && c < g.width && r >= 0 && r < g.height && t.isBlocked(c, r);
  const col = Math.floor(p.x), row = Math.floor(p.y - 0.5);
  let jump = false;
  if (p.grounded) {
    const c = col + 1;
    const pit = !solid(c, row + 1) && !solid(c, row + 2) && p.x - col > 0.35;
    const spike = c < g.width && t.getTile('ground', c, row) === T.spikes && p.x - col > 0.2;
    jump = solid(c, row) || pit || spike || g.walkers.some((w) => w.alive && Math.abs(w.y - p.y) < 0.6 && w.x - p.x > 0.3 && w.x - p.x < 1.5);
  }
  return { move: 1, jump, held: true };
}
/**
 * A player for tests and recorded runs: it tries each thing it could do now (run, jump high, hop,
 * wait) on a copy of the game, lets the simple rule play the next second and a half, and does
 * whichever is still alive furthest on. It takes no detours for coins.
 */
export function bot(g: Game): Act {
  if (!g.player.grounded) return { move: 1, jump: false, held: g.botHeld };
  const options: Act[] = [{ move: 1, jump: false, held: true }, { move: 1, jump: true, held: true }, { move: 1, jump: true, held: false }, { move: 0, jump: false, held: true }];
  let best = options[0], bestScore = -Infinity;
  for (const first of options) {
    const f = g.fork();
    let act = first;
    for (let i = 0; i < 90 && f.state === 'play'; i++) {
      if (act.jump) f.input.push('jump', f.time);
      f.step(act.move, i < 30 ? first.held : true);
      act = naive(f);
    }
    const score = (f.state === 'dead' ? -1000 + f.time * 10 : 0) + f.player.x + (f.state === 'won' ? 100 : 0) - (first.move ? 0 : 0.5);
    if (score > bestScore) (bestScore = score), (best = first);
  }
  g.botHeld = best.held;
  return best;
}
export function playOut(g: Game, play: (g: Game) => Act, seconds = 120): Game {
  while (g.state === 'play' && g.time < seconds) {
    const a = play(g);
    if (a.jump) g.input.push('jump', g.time);
    g.step(a.move, a.held);
  }
  return g;
}
