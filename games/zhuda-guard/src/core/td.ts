// 豬大守關 — a tower defence, pure and seeded, stepped at 30 Hz: beasts walk a mountain road to
// the village gate, towers stand on fixed pads beside it. Three towers, three levels each, twelve
// waves. Tested in test/td.test.ts.

export const STEP = 1 / 30;
export const START_COINS = 220;
export const START_LIVES = 20;

/** The road, as points in metres (x right, z away). The gate is the last. */
export const ROAD: [number, number][] = [[-30, -12], [-14, -12], [-14, 4], [0, 4], [0, -8], [14, -8], [14, 10], [30, 10]];
/** Where towers may stand. */
export const PADS: [number, number][] = [[-20, -7], [-9, -6], [-19, 8], [-7, 9], [5, -2], [-5, -13], [9, 2], [8, -13], [19, 4], [20, -3], [9, 15], [21, 15]];

export type TowerKind = 'arrow' | 'fire' | 'frost';
export interface TowerDef { name: string; text: string; cost: number[]; range: number[]; damage: number[]; every: number[]; splash?: number[]; slow?: number[] }
export const TOWERS: Record<TowerKind, TowerDef> = {
  arrow: { name: '箭樓', text: '射得快，打單體；射不穿厚皮', cost: [70, 90, 150], range: [9, 10, 11.5], damage: [11, 20, 36], every: [0.55, 0.5, 0.45] },
  fire: { name: '火爐', text: '火球炸一片，燒得穿厚皮', cost: [110, 150, 240], range: [8, 8.5, 9.5], damage: [26, 48, 88], every: [1.5, 1.4, 1.25], splash: [3.0, 3.4, 4.0] },
  frost: { name: '冰塔', text: '緩速一小片敵人，傷害低', cost: [60, 90, 150], range: [7.5, 8.5, 9.5], damage: [3, 6, 10], every: [0.8, 0.7, 0.6], slow: [0.4, 0.5, 0.6] },
};
export interface EnemyDef { id: string; name: string; hp: number; speed: number; coins: number; lives: number; height: number; /** Taken off every hit (a hit always does at least 1). */ armor: number }
export const ENEMIES: Record<string, EnemyDef> = {
  zheng: { id: 'zheng', name: '猙', hp: 46, speed: 3.2, coins: 9, lives: 1, height: 1.5, armor: 0 },
  jiuweihu: { id: 'jiuweihu', name: '九尾狐', hp: 30, speed: 5.4, coins: 9, lives: 1, height: 1.4, armor: 0 },
  kui: { id: 'kui', name: '夔', hp: 170, speed: 2.1, coins: 24, lives: 2, height: 2.2, armor: 8 },
  xuanwu: { id: 'xuanwu', name: '玄武', hp: 2400, speed: 1.35, coins: 150, lives: 10, height: 4.2, armor: 16 },
};
/** Each wave: groups of [enemy, count, seconds between, seconds after the wave starts]. Health grows 13 % a wave. */
export const WAVES: [string, number, number, number][][] = [
  [['zheng', 8, 1.3, 0]],
  [['zheng', 10, 1.1, 0], ['jiuweihu', 4, 0.9, 8]],
  [['jiuweihu', 12, 0.7, 0]],
  [['zheng', 12, 0.9, 0], ['kui', 3, 2.5, 4]],
  [['kui', 6, 2.0, 0], ['jiuweihu', 10, 0.6, 6]],
  [['zheng', 24, 0.5, 0], ['kui', 4, 2.4, 6]],
  [['jiuweihu', 26, 0.4, 0]],
  [['kui', 12, 1.3, 0], ['zheng', 16, 0.6, 3]],
  [['xuanwu', 1, 1, 0], ['jiuweihu', 16, 0.6, 5]],
  [['kui', 14, 1.0, 0], ['jiuweihu', 24, 0.4, 4], ['zheng', 20, 0.5, 9]],
  [['kui', 22, 0.8, 0], ['jiuweihu', 30, 0.35, 5]],
  [['xuanwu', 1, 1, 6], ['kui', 18, 0.9, 0], ['jiuweihu', 34, 0.35, 8], ['zheng', 30, 0.4, 14]],
];

const SEG: number[] = [];
let TOTAL = 0;
for (let i = 1; i < ROAD.length; i++) (SEG.push(Math.hypot(ROAD[i][0] - ROAD[i - 1][0], ROAD[i][1] - ROAD[i - 1][1])), (TOTAL += SEG[i - 1]));
export const ROAD_LENGTH = TOTAL;
/** The point `dist` metres along the road and the direction of travel there (radians, 0 = +z). */
export function along(dist: number): { x: number; z: number; yaw: number } {
  let d = Math.max(0, Math.min(TOTAL - 1e-6, dist));
  for (let i = 0; i < SEG.length; i++) {
    if (d <= SEG[i]) {
      const a = ROAD[i], b = ROAD[i + 1], k = d / SEG[i];
      return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    d -= SEG[i];
  }
  return { x: ROAD[ROAD.length - 1][0], z: ROAD[ROAD.length - 1][1], yaw: 0 };
}

export interface Enemy { uid: number; def: EnemyDef; hp: number; maxHp: number; dist: number; slow: number; slowBy: number; x: number; z: number; yaw: number }
export interface Tower { pad: number; kind: TowerKind; level: number; cool: number; aim: number; spent: number }
export interface Shot { kind: TowerKind; x: number; y: number; z: number; target: number; tx: number; tz: number; damage: number; splash: number; slow: number }
export type TdEvent =
  | { type: 'shoot'; kind: TowerKind; pad: number }
  | { type: 'hit'; kind: TowerKind; x: number; z: number; splash: number }
  | { type: 'kill'; x: number; z: number; coins: number; boss: boolean }
  | { type: 'leak'; lives: number }
  | { type: 'wave' | 'cleared' | 'won' | 'lost' };

export class Game {
  time = 0;
  coins = START_COINS;
  lives = START_LIVES;
  /** The wave in progress or about to start (0-based); WAVES.length once all are done. */
  wave = 0;
  state: 'build' | 'wave' | 'won' | 'lost' = 'build';
  readonly enemies: Enemy[] = [];
  readonly towers: Tower[] = [];
  readonly shots: Shot[] = [];
  kills = 0;
  private queue: { at: number; id: string }[] = [];
  private waveTime = 0;
  private uid = 1;
  private events: TdEvent[] = [];

  towerAt(pad: number): Tower | undefined {
    return this.towers.find((t) => t.pad === pad);
  }
  build(pad: number, kind: TowerKind): boolean {
    const cost = TOWERS[kind].cost[0];
    if (pad < 0 || pad >= PADS.length || this.towerAt(pad) || this.coins < cost || this.state === 'won' || this.state === 'lost') return false;
    this.coins -= cost;
    this.towers.push({ pad, kind, level: 0, cool: 0.2, aim: 0, spent: cost });
    return true;
  }
  upgradeCost(pad: number): number | null {
    const t = this.towerAt(pad);
    return t && t.level < 2 ? TOWERS[t.kind].cost[t.level + 1] : null;
  }
  upgrade(pad: number): boolean {
    const t = this.towerAt(pad), cost = this.upgradeCost(pad);
    if (!t || cost === null || this.coins < cost) return false;
    this.coins -= cost;
    t.level += 1;
    t.spent += cost;
    return true;
  }
  /** Sells for 70 % of what was spent. */
  sell(pad: number): number {
    const i = this.towers.findIndex((t) => t.pad === pad);
    if (i < 0) return 0;
    const back = Math.floor(this.towers[i].spent * 0.7);
    this.towers.splice(i, 1);
    this.coins += back;
    return back;
  }
  /** Sends the next wave (only between waves). */
  send(): boolean {
    if (this.state !== 'build' || this.wave >= WAVES.length) return false;
    this.queue = [];
    for (const [id, count, gap, delay] of WAVES[this.wave]) for (let i = 0; i < count; i++) this.queue.push({ at: delay + i * gap, id });
    this.queue.sort((a, b) => a.at - b.at);
    this.waveTime = 0;
    this.state = 'wave';
    this.events.push({ type: 'wave' });
    return true;
  }

  step(): TdEvent[] {
    const out = this.events;
    this.events = [];
    if (this.state !== 'wave') return out;
    this.events = out;
    const dt = STEP;
    this.time += dt;
    this.waveTime += dt;
    while (this.queue.length && this.queue[0].at <= this.waveTime) {
      const def = ENEMIES[this.queue.shift()!.id];
      const hp = Math.round(def.hp * Math.pow(1.13, this.wave));
      const p = along(0);
      this.enemies.push({ uid: this.uid++, def, hp, maxHp: hp, dist: 0, slow: 0, slowBy: 0, x: p.x, z: p.z, yaw: p.yaw });
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.dist += e.def.speed * (e.slow > 0 ? 1 - e.slowBy : 1) * dt;
      e.slow = Math.max(0, e.slow - dt);
      const p = along(e.dist);
      (e.x = p.x), (e.z = p.z), (e.yaw = p.yaw);
      if (e.dist >= ROAD_LENGTH) {
        this.enemies.splice(i, 1);
        this.lives = Math.max(0, this.lives - e.def.lives);
        this.events.push({ type: 'leak', lives: e.def.lives });
        if (this.lives <= 0) {
          this.state = 'lost';
          this.events.push({ type: 'lost' });
          return this.flush();
        }
      }
    }
    for (const t of this.towers) {
      const def = TOWERS[t.kind], [px, pz] = PADS[t.pad], range = def.range[t.level];
      t.cool -= dt;
      // The enemy furthest along the road within range.
      let target: Enemy | undefined;
      for (const e of this.enemies) if (Math.hypot(e.x - px, e.z - pz) <= range && (!target || e.dist > target.dist)) target = e;
      if (!target) continue;
      t.aim = Math.atan2(target.x - px, target.z - pz);
      if (t.cool > 0) continue;
      t.cool = def.every[t.level];
      this.shots.push({ kind: t.kind, x: px, y: 3.2, z: pz, target: target.uid, tx: target.x, tz: target.z, damage: def.damage[t.level], splash: def.splash?.[t.level] ?? 0, slow: def.slow?.[t.level] ?? 0 });
      this.events.push({ type: 'shoot', kind: t.kind, pad: t.pad });
    }
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      const e = this.enemies.find((x) => x.uid === s.target);
      if (e) (s.tx = e.x), (s.tz = e.z);
      const dx = s.tx - s.x, dz = s.tz - s.z, d = Math.hypot(dx, dz), v = (s.kind === 'fire' ? 16 : 30) * dt;
      s.y = Math.max(0.8, s.y - 2.4 * dt);
      if (d > v) {
        s.x += (dx / d) * v;
        s.z += (dz / d) * v;
        continue;
      }
      this.shots.splice(i, 1);
      this.events.push({ type: 'hit', kind: s.kind, x: s.tx, z: s.tz, splash: s.splash });
      // Frost chills everything within 2.2 m of where it lands; fire burns its splash; an arrow hits its mark.
      const radius = s.kind === 'frost' ? 2.2 : s.splash;
      for (const o of [...this.enemies]) {
        const near = Math.hypot(o.x - s.tx, o.z - s.tz);
        if (o.uid !== s.target && near > radius) continue;
        if (o.uid === s.target && !e) continue;
        if (s.slow) (o.slow = 1.6), (o.slowBy = Math.max(o.slowBy * (o.slow > 0 ? 1 : 0), s.slow));
        this.hurt(o, o.uid === s.target ? s.damage : s.damage * 0.6);
      }
    }
    if (!this.queue.length && !this.enemies.length) {
      this.coins += 60 + this.wave * 15;
      this.wave += 1;
      this.shots.length = 0;
      if (this.wave >= WAVES.length) (this.state = 'won'), this.events.push({ type: 'won' });
      else (this.state = 'build'), this.events.push({ type: 'cleared' });
    }
    return this.flush();
  }
  private flush(): TdEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
  private hurt(e: Enemy, damage: number): void {
    if (e.hp <= 0) return;
    e.hp -= Math.max(1, damage - e.def.armor);
    if (e.hp > 0) return;
    this.enemies.splice(this.enemies.indexOf(e), 1);
    this.coins += e.def.coins;
    this.kills += 1;
    this.events.push({ type: 'kill', x: e.x, z: e.z, coins: e.def.coins, boss: e.def.id === 'xuanwu' });
  }
  /** Stars for the result: three with every life kept, two with at least half. */
  stars(): number {
    return this.state !== 'won' ? 0 : this.lives >= START_LIVES ? 3 : this.lives >= START_LIVES / 2 ? 2 : 1;
  }
}

// ---- a player for tests and recorded runs -------------------------------------------------------
/** Pads in the order a careful player fills them, and what goes on each. */
const PLAN: [number, TowerKind][] = [[1, 'arrow'], [4, 'arrow'], [3, 'frost'], [6, 'fire'], [0, 'arrow'], [8, 'fire'], [5, 'frost'], [9, 'arrow'], [7, 'fire'], [2, 'arrow'], [10, 'fire'], [11, 'frost']];
/** Between waves, while coins last: five towers, then all to the second level, then eight, then all to the third, then the rest. */
export function botBuild(g: Game): void {
  for (;;) {
    const next = PLAN.find(([pad]) => !g.towerAt(pad));
    const below = (level: number) => g.towers.filter((t) => t.level < level).sort((x, y) => TOWERS[x.kind].cost[x.level + 1] - TOWERS[y.kind].cost[y.level + 1])[0];
    const n = g.towers.length;
    const up = n < 5 ? undefined : below(1) ?? (n < 8 ? undefined : below(2));
    if (up) {
      if (!g.upgrade(up.pad)) return;
    } else if (next) {
      if (!g.build(next[0], next[1])) return;
    } else return;
  }
}
export function playOut(build: (g: Game) => void): Game {
  const g = new Game();
  while (g.state === 'build' || g.state === 'wave') {
    if (g.state === 'build') (build(g), g.send());
    g.step();
  }
  return g;
}
