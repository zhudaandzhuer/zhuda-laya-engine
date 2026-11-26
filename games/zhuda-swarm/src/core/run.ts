// 豬大割草 — one run of a horde-survival game, pure and seeded, stepped at 60 Hz: 豬大 walks,
// its weapons fire by themselves, beasts close in from every side, gems fill a level bar and each
// level offers three upgrades. Five minutes; a boss at four. Lengths are in pixels of the field.
// Tested in test/run.test.ts.

export const STEP = 1 / 60;
export const RUN_SECONDS = 300;
export const BOSS_AT = 240;

export type WeaponId = 'blade' | 'talisman' | 'fire' | 'thunder' | 'vine';
export type PassiveId = 'might' | 'haste' | 'area' | 'speed' | 'magnet' | 'vitality';
export const WEAPONS: Record<WeaponId, { name: string; text: string; evolve: PassiveId; evolved: string }> = {
  blade: { name: '柴刀', text: '朝行進方向橫掃', evolve: 'might', evolved: '旋風柴刀' },
  talisman: { name: '符彈', text: '射向最近的敵人', evolve: 'haste', evolved: '焚天符' },
  fire: { name: '環火', text: '火球繞身旋轉', evolve: 'area', evolved: '日輪' },
  thunder: { name: '雷鼓', text: '落雷劈中範圍內的敵人', evolve: 'magnet', evolved: '連環雷' },
  vine: { name: '藤域', text: '腳下的藤蔓持續傷害並緩速', evolve: 'vitality', evolved: '回春藤' },
};
export const PASSIVES: Record<PassiveId, { name: string; text: string }> = {
  might: { name: '蠻力', text: '傷害 +12%' },
  haste: { name: '急性子', text: '冷卻 −8%' },
  area: { name: '大範圍', text: '範圍 +10%' },
  speed: { name: '飛毛腿', text: '移動 +8%' },
  magnet: { name: '吸寶', text: '拾取範圍 +30%' },
  vitality: { name: '厚皮', text: '生命 +20，每秒回 0.4' },
};
export const MAX_LEVEL = 5;
export const SLOTS = 4;

export interface EnemyDef { id: string; hp: number; speed: number; radius: number; damage: number; gem: 0 | 1 | 2; boss?: boolean }
export const ENEMY: Record<string, EnemyDef> = {
  zheng: { id: 'zheng', hp: 8, speed: 58, radius: 22, damage: 4, gem: 0 },
  jiuweihu: { id: 'jiuweihu', hp: 6, speed: 104, radius: 20, damage: 5, gem: 0 },
  kui: { id: 'kui', hp: 42, speed: 44, radius: 30, damage: 10, gem: 1 },
  bifang: { id: 'bifang', hp: 20, speed: 84, radius: 26, damage: 8, gem: 0 },
  qiongqi: { id: 'qiongqi', hp: 70, speed: 96, radius: 28, damage: 12, gem: 1 },
  jiuying: { id: 'jiuying', hp: 150, speed: 58, radius: 30, damage: 14, gem: 1 },
  taotie: { id: 'taotie', hp: 520, speed: 54, radius: 40, damage: 18, gem: 2 },
  xingtian: { id: 'xingtian', hp: 16000, speed: 50, radius: 86, damage: 30, gem: 2, boss: true },
};
/** What comes when: seconds from, enemies a second, and the mix. Health grows 1.4 % a second on top. */
const WAVES: { from: number; rate: number; mix: [string, number][] }[] = [
  { from: 0, rate: 1.3, mix: [['zheng', 1]] },
  { from: 25, rate: 2.6, mix: [['zheng', 3], ['jiuweihu', 1]] },
  { from: 55, rate: 3.6, mix: [['zheng', 2], ['jiuweihu', 2], ['kui', 1]] },
  { from: 90, rate: 6.5, mix: [['jiuweihu', 3], ['kui', 1], ['bifang', 2]] },
  { from: 130, rate: 9.0, mix: [['bifang', 3], ['kui', 1], ['qiongqi', 1], ['zheng', 2]] },
  { from: 175, rate: 12, mix: [['bifang', 2], ['qiongqi', 2], ['jiuying', 1], ['jiuweihu', 3]] },
  { from: 215, rate: 15, mix: [['qiongqi', 2], ['jiuying', 2], ['jiuweihu', 3], ['bifang', 2]] },
  { from: 260, rate: 19, mix: [['qiongqi', 3], ['jiuying', 3], ['jiuweihu', 4]] },
];
const ELITES = [60, 120, 180, 225, 270];
export const MAX_ENEMIES = 420;

export interface Enemy { uid: number; def: EnemyDef; x: number; y: number; hp: number; maxHp: number; slow: number; flash: number; fireAt: number; vineAt: number }
export interface Shot { x: number; y: number; vx: number; vy: number; life: number; damage: number; pierce: number; radius: number; boom: number; hit: Set<number> }
export interface Drop { kind: 'gem' | 'coin' | 'heart'; tier: 0 | 1 | 2; x: number; y: number; pull: boolean }
export interface Zone { kind: 'slash' | 'thunder' | 'boom'; x: number; y: number; radius: number; angle: number; life: number; span: number }

export type Choice = { kind: 'weapon'; id: WeaponId; level: number } | { kind: 'passive'; id: PassiveId; level: number } | { kind: 'evolve'; id: WeaponId } | { kind: 'heal' };
export type RunEvent =
  | { type: 'kill'; x: number; y: number; boss: boolean }
  | { type: 'hurt'; damage: number }
  | { type: 'levelup' | 'boss' | 'elite' | 'won' | 'dead' | 'pickup' | 'coin' | 'heal' | 'evolve' }
  | { type: 'fire'; weapon: WeaponId };

export interface Meta { might: number; vitality: number; greed: number }
export const META_MAX = 5;
export const metaCost = (level: number) => 40 * (level + 1) * (level + 1);

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CELL = 64;
export class Run {
  time = 0;
  state: 'play' | 'choose' | 'won' | 'dead' = 'play';
  readonly player = { x: 0, y: 0, hp: 100, maxHp: 100, faceX: 1, faceY: 0, grace: 0, level: 1, xp: 0, next: 6, coins: 0, kills: 0 };
  readonly weapons = new Map<WeaponId, { level: number; evolved: boolean; timer: number }>();
  readonly passives = new Map<PassiveId, number>();
  readonly enemies: Enemy[] = [];
  readonly shots: Shot[] = [];
  readonly drops: Drop[] = [];
  readonly zones: Zone[] = [];
  choices: Choice[] = [];
  orbit = 0;
  bossSpawned = false;
  peak = 0;
  private readonly random: () => number;
  private readonly meta: Meta;
  private spawnDebt = 0;
  private elite = 0;
  private uid = 1;
  private events: RunEvent[] = [];
  private readonly grid = new Map<number, Enemy[]>();

  constructor(seed = 1, meta: Meta = { might: 0, vitality: 0, greed: 0 }, start: WeaponId = 'blade') {
    this.random = mulberry(seed);
    this.meta = meta;
    this.player.maxHp = this.player.hp = 100 + meta.vitality * 12;
    this.weapons.set(start, { level: 1, evolved: false, timer: 0.4 });
  }

  // ---- numbers that upgrades change ------------------------------------------------------
  private p(id: PassiveId): number {
    return this.passives.get(id) ?? 0;
  }
  get might(): number {
    return (1 + 0.12 * this.p('might')) * (1 + 0.06 * this.meta.might);
  }
  get haste(): number {
    return Math.pow(0.92, this.p('haste'));
  }
  get area(): number {
    return 1 + 0.1 * this.p('area');
  }
  get speed(): number {
    return 190 * (1 + 0.08 * this.p('speed'));
  }
  get magnet(): number {
    return 96 * (1 + 0.3 * this.p('magnet'));
  }

  step(input: { mx: number; my: number }): RunEvent[] {
    this.events = [];
    if (this.state !== 'play') return this.events;
    const dt = STEP, pl = this.player;
    this.time += dt;
    // The player.
    const len = Math.hypot(input.mx, input.my);
    if (len > 0.15) {
      const k = Math.min(1, len) / len;
      pl.x += input.mx * k * this.speed * dt;
      pl.y += input.my * k * this.speed * dt;
      pl.faceX = input.mx / len;
      pl.faceY = input.my / len;
    }
    pl.grace = Math.max(0, pl.grace - dt);
    if (this.p('vitality')) pl.hp = Math.min(pl.maxHp, pl.hp + 0.4 * this.p('vitality') * dt);
    this.spawn(dt);
    this.moveEnemies(dt);
    this.fireWeapons(dt);
    this.moveShots(dt);
    this.collect(dt);
    for (let i = this.zones.length - 1; i >= 0; i--) if ((this.zones[i].life -= dt) <= 0) this.zones.splice(i, 1);
    this.peak = Math.max(this.peak, this.enemies.length);
    if (this.state === 'play' && this.time >= RUN_SECONDS) (this.state = 'won'), this.events.push({ type: 'won' });
    return this.events;
  }

  // ---- spawning --------------------------------------------------------------------------
  private spawnAt(def: EnemyDef, scale = 1): void {
    const a = this.random() * Math.PI * 2, d = 620 + this.random() * 140;
    const hp = Math.round(def.hp * (1 + this.time * 0.014) * scale);
    this.enemies.push({ uid: this.uid++, def, x: this.player.x + Math.cos(a) * d, y: this.player.y + Math.sin(a) * d * 0.8, hp, maxHp: hp, slow: 0, flash: 0, fireAt: 0, vineAt: 0 });
  }
  private spawn(dt: number): void {
    let wave = WAVES[0];
    for (const w of WAVES) if (this.time >= w.from) wave = w;
    this.spawnDebt += wave.rate * dt;
    while (this.spawnDebt >= 1) {
      this.spawnDebt -= 1;
      if (this.enemies.length >= MAX_ENEMIES) continue;
      let roll = this.random() * wave.mix.reduce((s, m) => s + m[1], 0);
      const pick = wave.mix.find((m) => (roll -= m[1]) <= 0) ?? wave.mix[0];
      this.spawnAt(ENEMY[pick[0]]);
    }
    if (this.elite < ELITES.length && this.time >= ELITES[this.elite]) {
      this.elite += 1;
      this.spawnAt(ENEMY.taotie);
      this.events.push({ type: 'elite' });
    }
    if (!this.bossSpawned && this.time >= BOSS_AT) {
      this.bossSpawned = true;
      this.spawnAt(ENEMY.xingtian);
      this.events.push({ type: 'boss' });
    }
  }

  // ---- enemies ---------------------------------------------------------------------------
  private key(x: number, y: number): number {
    return (Math.floor(x / CELL) + 4096) * 8192 + (Math.floor(y / CELL) + 4096);
  }
  private near(x: number, y: number, radius: number, each: (e: Enemy) => void): void {
    const x0 = Math.floor((x - radius) / CELL), x1 = Math.floor((x + radius) / CELL), y0 = Math.floor((y - radius) / CELL), y1 = Math.floor((y + radius) / CELL);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.grid.get((cx + 4096) * 8192 + (cy + 4096));
        if (cell) for (const e of cell) if (e.hp > 0) each(e);
      }
  }
  private moveEnemies(dt: number): void {
    const pl = this.player;
    this.grid.clear();
    for (const e of this.enemies) {
      const k = this.key(e.x, e.y);
      const cell = this.grid.get(k);
      if (cell) cell.push(e);
      else this.grid.set(k, [e]);
    }
    for (const e of this.enemies) {
      const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) || 1;
      const v = e.def.speed * (e.slow > 0 ? 0.55 : 1) * dt;
      let mx = (dx / d) * v, my = (dy / d) * v;
      // They do not stack: each is pushed off those it overlaps (bosses push, are not pushed).
      if (!e.def.boss)
        this.near(e.x, e.y, e.def.radius + 40, (o) => {
          if (o === e) return;
          const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = (e.def.radius + o.def.radius) * 0.82;
          if (od < min && od > 0.01) (mx += (ox / od) * (min - od) * 0.12), (my += (oy / od) * (min - od) * 0.12);
        });
      e.x += mx;
      e.y += my;
      e.slow = Math.max(0, e.slow - dt);
      e.flash = Math.max(0, e.flash - dt);
      if (d < e.def.radius + 20 && pl.grace <= 0) {
        pl.hp -= e.def.damage;
        pl.grace = 0.55;
        this.events.push({ type: 'hurt', damage: e.def.damage });
        if (pl.hp <= 0) {
          pl.hp = 0;
          this.state = 'dead';
          this.events.push({ type: 'dead' });
          return;
        }
      }
      // One that falls far behind is brought back round in front (the field has no walls).
      if (d > 1100 && !e.def.boss) {
        const a = this.random() * Math.PI * 2;
        e.x = pl.x + Math.cos(a) * 680;
        e.y = pl.y + Math.sin(a) * 560;
      }
    }
  }
  private damage(e: Enemy, amount: number): void {
    if (e.hp <= 0) return;
    e.hp -= amount * this.might;
    e.flash = 0.1;
    if (e.hp > 0) return;
    this.player.kills += 1;
    this.events.push({ type: 'kill', x: e.x, y: e.y, boss: !!e.def.boss });
    this.drops.push({ kind: 'gem', tier: e.def.gem, x: e.x, y: e.y, pull: false });
    const r = this.random();
    if (r < 0.03 + 0.012 * this.meta.greed) this.drops.push({ kind: 'coin', tier: 0, x: e.x + 14, y: e.y, pull: false });
    else if (r > 0.992) this.drops.push({ kind: 'heart', tier: 0, x: e.x - 14, y: e.y, pull: false });
    if (e.def.id === 'taotie' || e.def.boss) for (let i = 0; i < (e.def.boss ? 30 : 6); i++) this.drops.push({ kind: i % 3 ? 'gem' : 'coin', tier: 1, x: e.x + (this.random() - 0.5) * 120, y: e.y + (this.random() - 0.5) * 120, pull: false });
  }
  private sweepDead(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].hp <= 0) this.enemies.splice(i, 1);
  }

  // ---- weapons ---------------------------------------------------------------------------
  private fireWeapons(dt: number): void {
    const pl = this.player;
    this.orbit += dt * (this.weapons.get('fire')?.evolved ? 3.6 : 2.4);
    for (const [id, w] of this.weapons) {
      const L = w.level;
      switch (id) {
        case 'blade': {
          if ((w.timer -= dt) > 0) break;
          w.timer = 1.05 * this.haste;
          const radius = (124 + L * 12) * this.area, dmg = 12 + L * 6;
          // It swings at whatever is nearest; with nothing in reach, the way 豬大 walks.
          let face = Math.atan2(pl.faceY, pl.faceX), nearest = Infinity;
          this.near(pl.x, pl.y, radius + 90, (e) => {
            const d = Math.hypot(e.x - pl.x, e.y - pl.y) - e.def.radius;
            if (d < nearest) (nearest = d), (face = Math.atan2(e.y - pl.y, e.x - pl.x));
          });
          const half = w.evolved ? Math.PI : 1.3;
          this.near(pl.x, pl.y, radius + 90, (e) => {
            const dx = e.x - pl.x, dy = e.y - pl.y, d = Math.hypot(dx, dy);
            if (d > radius + e.def.radius) return;
            const off = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - face), Math.cos(Math.atan2(dy, dx) - face)));
            if (off <= half) this.damage(e, w.evolved ? dmg * 1.5 : dmg);
          });
          this.zones.push({ kind: 'slash', x: pl.x, y: pl.y, radius, angle: face, life: 0.2, span: w.evolved ? 6.28 : 2.6 });
          this.events.push({ type: 'fire', weapon: id });
          break;
        }
        case 'talisman': {
          if ((w.timer -= dt) > 0) break;
          w.timer = 0.95 * this.haste;
          const targets = [...this.enemies].filter((e) => e.hp > 0 && Math.hypot(e.x - pl.x, e.y - pl.y) < 520).sort((a, b) => Math.hypot(a.x - pl.x, a.y - pl.y) - Math.hypot(b.x - pl.x, b.y - pl.y)).slice(0, 1 + Math.floor(L / 2));
          for (const t of targets) {
            const dx = t.x - pl.x, dy = t.y - pl.y, d = Math.hypot(dx, dy) || 1;
            this.shots.push({ x: pl.x, y: pl.y, vx: (dx / d) * 520, vy: (dy / d) * 520, life: 1.3, damage: 13 + L * 5, pierce: 1 + Math.floor(L / 3), radius: 14, boom: w.evolved ? 90 * this.area : 0, hit: new Set() });
          }
          if (targets.length) this.events.push({ type: 'fire', weapon: id });
          break;
        }
        case 'fire': {
          const n = 1 + L, radius = (92 + (w.evolved ? 40 : 0)) * this.area, dmg = 7 + L * 3 + (w.evolved ? 10 : 0);
          for (let i = 0; i < n; i++) {
            const a = this.orbit + (i / n) * Math.PI * 2, ox = pl.x + Math.cos(a) * radius, oy = pl.y + Math.sin(a) * radius;
            this.near(ox, oy, 34 + 44, (e) => {
              if (this.time >= e.fireAt && Math.hypot(e.x - ox, e.y - oy) < 30 + e.def.radius) (e.fireAt = this.time + 0.45), this.damage(e, dmg);
            });
          }
          break;
        }
        case 'thunder': {
          if ((w.timer -= dt) > 0) break;
          w.timer = 1.7 * this.haste;
          const radius = (64 + L * 8) * this.area, dmg = 20 + L * 9;
          const pool = this.enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - pl.x, e.y - pl.y) < 460);
          for (let s = 0; s < (w.evolved ? 3 : 1 + Math.floor(L / 4)) && pool.length; s++) {
            const t = pool[Math.floor(this.random() * pool.length)];
            this.near(t.x, t.y, radius + 90, (e) => Math.hypot(e.x - t.x, e.y - t.y) < radius + e.def.radius && this.damage(e, dmg));
            this.zones.push({ kind: 'thunder', x: t.x, y: t.y, radius, angle: 0, life: 0.3, span: 0 });
          }
          if (pool.length) this.events.push({ type: 'fire', weapon: id });
          break;
        }
        case 'vine': {
          const radius = (96 + L * 12) * this.area, dmg = 4 + L * 2;
          this.near(pl.x, pl.y, radius + 90, (e) => {
            if (Math.hypot(e.x - pl.x, e.y - pl.y) > radius + e.def.radius) return;
            e.slow = 0.3;
            if (this.time >= e.vineAt) {
              e.vineAt = this.time + 0.5;
              this.damage(e, dmg);
              if (w.evolved && e.hp <= 0) pl.hp = Math.min(pl.maxHp, pl.hp + 0.6);
            }
          });
          break;
        }
      }
    }
    this.sweepDead();
  }
  private moveShots(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      let gone = s.life <= 0;
      if (!gone)
        this.near(s.x, s.y, s.radius + 90, (e) => {
          if (gone || s.hit.has(e.uid) || Math.hypot(e.x - s.x, e.y - s.y) > s.radius + e.def.radius) return;
          s.hit.add(e.uid);
          this.damage(e, s.damage);
          if (s.boom) {
            this.near(s.x, s.y, s.boom + 90, (o) => o !== e && Math.hypot(o.x - s.x, o.y - s.y) < s.boom + o.def.radius && this.damage(o, s.damage * 0.7));
            this.zones.push({ kind: 'boom', x: s.x, y: s.y, radius: s.boom, angle: 0, life: 0.25, span: 0 });
          }
          if (--s.pierce <= 0) gone = true;
        });
      if (gone) this.shots.splice(i, 1);
    }
    this.sweepDead();
  }

  // ---- drops and levels ------------------------------------------------------------------
  private collect(dt: number): void {
    const pl = this.player, reach = this.magnet;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      const dx = pl.x - d.x, dy = pl.y - d.y, dist = Math.hypot(dx, dy) || 1;
      if (dist < reach) d.pull = true;
      if (d.pull) (d.x += (dx / dist) * 560 * dt), (d.y += (dy / dist) * 560 * dt);
      if (dist < 26) {
        this.drops.splice(i, 1);
        if (d.kind === 'gem') (pl.xp += [1, 4, 12][d.tier]), this.events.push({ type: 'pickup' });
        else if (d.kind === 'coin') (pl.coins += 1), this.events.push({ type: 'coin' });
        else (pl.hp = Math.min(pl.maxHp, pl.hp + 30)), this.events.push({ type: 'heal' });
      } else if (dist > 1500) this.drops.splice(i, 1);
    }
    if (this.drops.length > 500) this.drops.splice(0, this.drops.length - 500);
    if (pl.xp >= pl.next && this.state === 'play') {
      pl.xp -= pl.next;
      pl.level += 1;
      pl.next = Math.round(5 + pl.level * 2.4 + pl.level * pl.level * 0.12);
      this.choices = this.rollChoices();
      this.state = 'choose';
      this.events.push({ type: 'levelup' });
    }
  }
  private rollChoices(): Choice[] {
    const pool: Choice[] = [];
    for (const [id, w] of this.weapons) {
      if (w.level < MAX_LEVEL) pool.push({ kind: 'weapon', id, level: w.level + 1 });
      else if (!w.evolved && this.p(WEAPONS[id].evolve) > 0) pool.push({ kind: 'evolve', id });
    }
    if (this.weapons.size < SLOTS) for (const id of Object.keys(WEAPONS) as WeaponId[]) if (!this.weapons.has(id)) pool.push({ kind: 'weapon', id, level: 1 });
    for (const id of Object.keys(PASSIVES) as PassiveId[]) {
      const have = this.p(id);
      if (have ? have < MAX_LEVEL : this.passives.size < SLOTS) pool.push({ kind: 'passive', id, level: have + 1 });
    }
    // An evolution on offer is always shown; the rest are drawn without repeats.
    const out: Choice[] = pool.filter((c) => c.kind === 'evolve').slice(0, 1);
    const rest = pool.filter((c) => c.kind !== 'evolve');
    while (out.length < 3 && rest.length) out.push(rest.splice(Math.floor(this.random() * rest.length), 1)[0]);
    while (out.length < 3) out.push({ kind: 'heal' });
    return out;
  }
  choose(index: number): void {
    if (this.state !== 'choose') return;
    const c = this.choices[index] ?? this.choices[0];
    if (c.kind === 'weapon') {
      const w = this.weapons.get(c.id);
      if (w) w.level = c.level;
      else this.weapons.set(c.id, { level: 1, evolved: false, timer: 0.3 });
    } else if (c.kind === 'passive') {
      this.passives.set(c.id, c.level);
      if (c.id === 'vitality') (this.player.maxHp += 20), (this.player.hp += 20);
    } else if (c.kind === 'evolve') {
      this.weapons.get(c.id)!.evolved = true;
      this.events.push({ type: 'evolve' });
    } else this.player.hp = Math.min(this.player.maxHp, this.player.hp + 40);
    this.choices = [];
    this.state = 'play';
  }

  /** Coins the run pays out: those picked up, a share of the kills, and a prize for lasting. */
  payout(): number {
    return this.player.coins * 3 + Math.floor(this.player.kills / 25) + (this.state === 'won' ? 60 : Math.floor(this.time / 10));
  }
}

export function choiceText(c: Choice): { title: string; text: string; tag: string } {
  if (c.kind === 'weapon') return { title: WEAPONS[c.id].name, text: WEAPONS[c.id].text, tag: c.level === 1 ? '新武器' : `Lv.${c.level}` };
  if (c.kind === 'passive') return { title: PASSIVES[c.id].name, text: PASSIVES[c.id].text, tag: c.level === 1 ? '新能力' : `Lv.${c.level}` };
  if (c.kind === 'evolve') return { title: WEAPONS[c.id].evolved, text: `${WEAPONS[c.id].name}進化`, tag: '進化' };
  return { title: '烤地瓜', text: '回復 40 生命', tag: '補給' };
}

// ---- a bot, for tests and recorded runs ----------------------------------------------------
/** Walks away from the press of enemies, towards gems when there is room, and picks upgrades by a fixed taste. */
export function bot(run: Run): { mx: number; my: number } {
  const pl = run.player;
  let ax = 0, ay = 0, danger = 0;
  for (const e of run.enemies) {
    const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) - e.def.radius;
    if (d > 260) continue;
    const w = 1 / Math.max(20, d) ** 2;
    ax += (dx / (d + e.def.radius || 1)) * w * (e.def.boss ? 6 : 1);
    ay += (dy / (d + e.def.radius || 1)) * w * (e.def.boss ? 6 : 1);
    if (d < 110) danger += 1;
  }
  let gx = 0, gy = 0, best = Infinity;
  for (const d of run.drops) {
    const dist = Math.hypot(d.x - pl.x, d.y - pl.y);
    if (dist < best && dist < 420) (best = dist), (gx = (d.x - pl.x) / (dist || 1)), (gy = (d.y - pl.y) / (dist || 1));
  }
  const al = Math.hypot(ax, ay);
  if (danger >= 2 || !isFinite(best)) return al > 0 ? { mx: ax / al, my: ay / al } : { mx: 0, my: 0 };
  const k = al > 0 ? 0.6 : 0;
  return { mx: gx + (al ? (ax / al) * k : 0), my: gy + (al ? (ay / al) * k : 0) };
}
const TASTE = ['evolve', 'fire', 'vine', 'blade', 'might', 'area', 'thunder', 'vitality', 'haste', 'talisman', 'magnet', 'speed', 'heal'];
export function botChoose(run: Run): number {
  const rank = (c: Choice) => TASTE.indexOf(c.kind === 'evolve' || c.kind === 'heal' ? c.kind : c.id);
  let best = 0;
  run.choices.forEach((c, i) => rank(c) < rank(run.choices[best]) && (best = i));
  return best;
}
export function play(seed: number, steer: (run: Run) => { mx: number; my: number }, pick: (run: Run) => number, meta?: Meta): Run {
  const run = new Run(seed, meta);
  while (run.state === 'play' || run.state === 'choose') {
    if (run.state === 'choose') run.choose(pick(run));
    else run.step(steer(run));
  }
  return run;
}
