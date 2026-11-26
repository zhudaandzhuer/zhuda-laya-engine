// 豬大狩荒 — the hunt's rules: pure, fixed-step (60 Hz), seeded, no rendering.
// The hunter's moves are engine action frame specs (ZhudaActionStateMachine); its buttons arrive
// through the engine's ZhudaInputBuffer. Everything else (the monster's mind, parts, damage,
// stamina, the quest) is the game's own and is tested in test/hunt.test.ts.
import { ZhudaActionStateMachine, ZhudaInputBuffer, validateActionFrameSpec, type ZhudaActionFrameSpec } from 'zhuda-laya-engine';
import { MONSTERS, type MonsterDef, type MoveDef, type PartId } from './data.ts';

export const STEP = 1 / 60;
export const ARENA_RADIUS = 24;
export const QUEST_SECONDS = 600;
export const MAX_FAINTS = 3;

export type HunterAction = 'light1' | 'light2' | 'light3' | 'heavy' | 'dodge' | 'potion';
export type DamageKind = 'cut' | 'blunt';

interface HunterMove {
  spec: ZhudaActionFrameSpec;
  clip: string;
  /** Motion value: damage is mv/100 × attack × hitzone. */
  mv: number;
  kind: DamageKind;
  stamina: number;
  /** Metres the move carries the hunter forward over its startup and active frames. */
  advance: number;
  reach: number;
  arcDeg: number;
}

const F = 60;
const win = (from: number, until: number) => ({ from, until });
/** The hunter's frame data. Attacks are commitments: only the listed windows cancel. */
export const HUNTER_MOVES: Record<HunterAction, HunterMove> = {
  light1: {
    clip: 'Slash1', mv: 18, kind: 'cut', stamina: 0, advance: 0.5, reach: 2.0, arcDeg: 70,
    spec: { id: 'light1', frameRate: F, frameCount: 28, startup: win(0, 8), active: win(8, 13), recovery: win(13, 28),
      cancelWindows: [{ from: 13, until: 28, actions: ['light2', 'heavy'] }, { from: 16, until: 28, actions: ['dodge'] }], events: [{ frame: 8, id: 'hit' }] },
  },
  light2: {
    clip: 'Slash2', mv: 24, kind: 'cut', stamina: 0, advance: 0.6, reach: 2.1, arcDeg: 80,
    spec: { id: 'light2', frameRate: F, frameCount: 32, startup: win(0, 9), active: win(9, 14), recovery: win(14, 32),
      cancelWindows: [{ from: 15, until: 32, actions: ['light3', 'heavy'] }, { from: 18, until: 32, actions: ['dodge'] }], events: [{ frame: 9, id: 'hit' }] },
  },
  light3: {
    clip: 'Kick', mv: 36, kind: 'blunt', stamina: 0, advance: 0.8, reach: 1.8, arcDeg: 55,
    spec: { id: 'light3', frameRate: F, frameCount: 46, startup: win(0, 15), active: win(15, 20), recovery: win(20, 46),
      cancelWindows: [{ from: 34, until: 46, actions: ['dodge'] }], events: [{ frame: 15, id: 'hit' }] },
  },
  heavy: {
    clip: 'Chop', mv: 78, kind: 'cut', stamina: 0, advance: 0.9, reach: 2.3, arcDeg: 45,
    spec: { id: 'heavy', frameRate: F, frameCount: 70, startup: win(0, 30), active: win(30, 36), recovery: win(36, 70),
      cancelWindows: [{ from: 56, until: 70, actions: ['dodge'] }], events: [{ frame: 30, id: 'hit' }] },
  },
  dodge: {
    clip: 'Roll', mv: 0, kind: 'cut', stamina: 25, advance: 4.4, reach: 0, arcDeg: 0,
    spec: { id: 'dodge', frameRate: F, frameCount: 34, startup: win(0, 3), active: win(3, 17), recovery: win(17, 34),
      cancelWindows: [{ from: 28, until: 34, actions: ['light1', 'heavy'] }] },
  },
  potion: {
    clip: 'Raise', mv: 0, kind: 'cut', stamina: 0, advance: 0, reach: 0, arcDeg: 0,
    spec: { id: 'potion', frameRate: F, frameCount: 100, startup: win(0, 62), active: win(62, 64), recovery: win(64, 100), events: [{ frame: 62, id: 'heal' }] },
  },
};
for (const m of Object.values(HUNTER_MOVES)) {
  const issues = validateActionFrameSpec(m.spec);
  if (issues.length) throw Error(`${m.spec.id}: ${issues.join('; ')}`);
}

export interface Loadout {
  attack: number;
  defense: number;
  potions: number;
}

export interface Hunter {
  x: number;
  z: number;
  /** Radians; 0 faces +z, positive turns towards +x. */
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  potions: number;
  action: HunterAction | null;
  /** Seconds left lying on the ground after a heavy hit (invulnerable while down). */
  down: number;
  /** Seconds of invulnerability left after getting up. */
  grace: number;
  moving: boolean;
  faints: number;
}

export type MonsterState = 'roam' | 'windup' | 'active' | 'recover' | 'stun' | 'topple' | 'flinch' | 'roar' | 'dead';

export interface Monster {
  def: MonsterDef;
  x: number;
  z: number;
  yaw: number;
  hp: number;
  state: MonsterState;
  /** Seconds into the current state. */
  t: number;
  /** Length of the current state. */
  span: number;
  move: MoveDef | null;
  /** For a charge: where it started and how far it has run. */
  run: number;
  hitDone: boolean;
  parts: Record<PartId, { hp: number; broken: boolean }>;
  stunBuild: number;
  tripBuild: number;
  enraged: number;
  exhausted: number;
  ragesUsed: number;
  /** Seconds until it picks its next move. */
  think: number;
}

export type HuntEvent =
  | { type: 'hit'; part: PartId; damage: number; weak: boolean; kind: DamageKind; x: number; z: number; mv: number }
  | { type: 'break'; part: PartId }
  | { type: 'stun' | 'topple' | 'enrage' | 'calm' | 'slain' | 'faint' | 'fail' | 'timeout' | 'heal' | 'whiff' }
  | { type: 'telegraph'; move: string }
  | { type: 'strike'; move: string }
  | { type: 'hurt'; damage: number; move: string }
  | { type: 'action'; action: HunterAction };

export interface HuntInput {
  /** Stick, in world axes (x right, z forward), length 0..1. */
  mx: number;
  mz: number;
}

/** Deterministic 32-bit generator (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const turn = (from: number, to: number, max: number) => from + Math.max(-max, Math.min(max, wrap(to - from)));

/** Where a part's centre is in the world, for the monster as it stands now. */
export function partPosition(m: Monster, part: PartId): { x: number; z: number; r: number } {
  const p = m.def.parts[part];
  const s = Math.sin(m.yaw), c = Math.cos(m.yaw);
  return { x: m.x + s * p.forward + c * p.side, z: m.z + c * p.forward - s * p.side, r: p.radius };
}

export class Hunt {
  readonly hunter: Hunter;
  readonly monster: Monster;
  readonly input = new ZhudaInputBuffer({ window: 0.22, capacity: 16 });
  time = 0;
  result: 'running' | 'won' | 'failed' | 'timeout' = 'running';
  private readonly random: () => number;
  private readonly loadout: Loadout;
  private readonly machines = new Map<HunterAction, ZhudaActionStateMachine>();
  private machine: ZhudaActionStateMachine | null = null;
  private dodgeDir = 0;
  private events: HuntEvent[] = [];

  constructor(monsterId: string, loadout: Loadout, seed = 1) {
    const def = MONSTERS[monsterId];
    if (!def) throw Error(`no monster ${monsterId}`);
    this.random = rng(seed);
    this.loadout = loadout;
    for (const [id, move] of Object.entries(HUNTER_MOVES)) this.machines.set(id as HunterAction, new ZhudaActionStateMachine(move.spec));
    this.hunter = { x: 0, z: -10, yaw: 0, hp: 100, maxHp: 100, stamina: 100, potions: loadout.potions, action: null, down: 0, grace: 0, moving: false, faints: 0 };
    this.monster = {
      def, x: 0, z: 6, yaw: Math.PI, hp: def.hp, state: 'roam', t: 0, span: 0, move: null, run: 0, hitDone: false,
      parts: Object.fromEntries(Object.entries(def.parts).map(([k, p]) => [k, { hp: p.breakHp, broken: false }])) as Monster['parts'],
      stunBuild: 0, tripBuild: 0, enraged: 0, exhausted: 0, ragesUsed: 0, think: 1.6,
    };
  }

  /** A button press, by action id; the buffer keeps it for 0.22 s so an early press still comes out. */
  press(action: 'light' | 'heavy' | 'dodge' | 'potion'): void {
    this.input.push(action, this.time);
  }

  /** The current move's state machine (for the view: phase and progress). */
  get current(): ZhudaActionStateMachine | null {
    return this.machine;
  }

  /** Advances one fixed step and returns what happened in it. */
  step(input: HuntInput): HuntEvent[] {
    this.events = [];
    if (this.result !== 'running') return this.events;
    this.time += STEP;
    this.stepHunter(input);
    this.stepMonster();
    if (this.result === 'running' && this.time >= QUEST_SECONDS) (this.result = 'timeout'), this.events.push({ type: 'timeout' });
    return this.events;
  }

  private begin(action: HunterAction, input: HuntInput): void {
    const h = this.hunter;
    const move = HUNTER_MOVES[action];
    h.stamina -= move.stamina;
    h.action = action;
    this.machine = this.machines.get(action)!;
    this.machine.play(true);
    const stick = Math.hypot(input.mx, input.mz);
    if (action === 'dodge') this.dodgeDir = stick > 0.2 ? Math.atan2(input.mx, input.mz) : h.yaw;
    else if (stick > 0.2) h.yaw = Math.atan2(input.mx, input.mz); // attacks may be aimed as they start, then they commit
    this.events.push({ type: 'action', action });
  }

  /** Which action a buffered button would start right now, if any. */
  private wanted(input: HuntInput): HunterAction | null {
    const h = this.hunter;
    const can = (a: HunterAction) => !this.machine || this.machine.canCancelInto(a);
    const t = this.time;
    if (h.stamina >= HUNTER_MOVES.dodge.stamina && can('dodge') && this.input.consume('dodge', t)) return 'dodge';
    if (can('heavy') && this.input.consume('heavy', t)) return 'heavy';
    const next: HunterAction = h.action === 'light1' ? 'light2' : h.action === 'light2' ? 'light3' : 'light1';
    if (can(next) && this.input.consume('light', t)) return next;
    if (!this.machine && h.potions > 0 && h.hp < h.maxHp && this.input.consume('potion', t)) return 'potion';
    void input;
    return null;
  }

  private stepHunter(input: HuntInput): void {
    const h = this.hunter;
    h.grace = Math.max(0, h.grace - STEP);
    if (h.down > 0) {
      h.down -= STEP;
      if (h.down <= 0) h.grace = 0.8;
      return;
    }
    const start = this.wanted(input);
    if (start) this.begin(start, input);
    h.moving = false;
    if (this.machine && h.action) {
      const move = HUNTER_MOVES[h.action];
      const before = this.machine.frame;
      const fired = this.machine.advance(STEP);
      // Forward travel is spread over startup and active frames (the roll: over its active frames).
      const from = h.action === 'dodge' ? move.spec.active.from : 0;
      const until = move.spec.active.until;
      const share = Math.max(0, Math.min(until, this.machine.frame) - Math.max(from, before)) / (until - from);
      const dir = h.action === 'dodge' ? this.dodgeDir : h.yaw;
      this.moveHunter(Math.sin(dir) * move.advance * share, Math.cos(dir) * move.advance * share);
      for (const e of fired) {
        if (e.id === 'hit') this.hunterStrike(move);
        if (e.id === 'heal') {
          h.potions -= 1;
          h.hp = Math.min(h.maxHp, h.hp + 45);
          this.events.push({ type: 'heal' });
        }
      }
      if (this.machine.isComplete) (this.machine = null), (h.action = null);
    } else {
      const stick = Math.min(1, Math.hypot(input.mx, input.mz));
      if (stick > 0.15) {
        h.yaw = turn(h.yaw, Math.atan2(input.mx, input.mz), 12 * STEP);
        const speed = 5.2 * stick;
        this.moveHunter(Math.sin(h.yaw) * speed * STEP, Math.cos(h.yaw) * speed * STEP);
        h.moving = true;
      }
      h.stamina = Math.min(100, h.stamina + 24 * STEP);
    }
  }

  private moveHunter(dx: number, dz: number): void {
    const h = this.hunter, m = this.monster;
    h.x += dx;
    h.z += dz;
    const r = Math.hypot(h.x, h.z);
    if (r > ARENA_RADIUS) (h.x *= ARENA_RADIUS / r), (h.z *= ARENA_RADIUS / r);
    // The monster's body is solid (not while rolling: a roll may pass under a leg).
    if (m.state !== 'dead' && h.action !== 'dodge') {
      const b = partPosition(m, 'body');
      const d = Math.hypot(h.x - b.x, h.z - b.z), min = b.r * 0.8 + 0.3;
      if (d < min && d > 1e-4) (h.x = b.x + ((h.x - b.x) / d) * min), (h.z = b.z + ((h.z - b.z) / d) * min);
    }
  }

  private hunterStrike(move: HunterMove): void {
    const h = this.hunter, m = this.monster;
    if (m.state === 'dead') return;
    let best: PartId | null = null, bestScore = Infinity;
    for (const id of Object.keys(m.def.parts) as PartId[]) {
      if (id === 'tail' && m.parts.tail.broken && m.def.parts.tail.severs) continue; // a severed tail is gone
      const p = partPosition(m, id);
      const dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz);
      if (d > move.reach + p.r) continue;
      // Inside a part the angle test is dropped: the blade cannot miss what the hunter stands in.
      const off = Math.abs(wrap(Math.atan2(dx, dz) - h.yaw));
      const half = (move.arcDeg * Math.PI) / 180 + Math.asin(Math.min(1, p.r / Math.max(d, p.r)));
      if (d > p.r && off > half) continue;
      const score = d - p.r + (id === 'body' ? 0.35 : 0); // limbs and head win over the trunk behind them
      if (score < bestScore) (bestScore = score), (best = id);
    }
    if (!best) return void this.events.push({ type: 'whiff' });
    const zone = m.def.parts[best];
    const hitzone = (move.kind === 'cut' ? zone.cut : zone.blunt) * (m.parts[best].broken ? 1.15 : 1);
    const down = m.state === 'topple' || m.state === 'stun' ? 1.1 : 1;
    const damage = Math.max(1, Math.round((move.mv / 100) * this.loadout.attack * hitzone * down));
    const at = partPosition(m, best);
    this.events.push({ type: 'hit', part: best, damage, weak: hitzone >= 0.9, kind: move.kind, x: at.x, z: at.z, mv: move.mv });
    this.damageMonster(best, damage, move.kind);
  }

  private damageMonster(part: PartId, damage: number, kind: DamageKind): void {
    const m = this.monster;
    m.hp -= damage;
    const p = m.parts[part];
    const zone = m.def.parts[part];
    if (!p.broken && zone.breakHp > 0 && !(zone.severs && kind !== 'cut')) {
      p.hp -= damage;
      if (p.hp <= 0) {
        p.broken = true;
        this.events.push({ type: 'break', part });
        if (m.hp > 0 && m.state !== 'topple' && m.state !== 'stun') this.setState('flinch', 1.3);
      }
    }
    if (m.hp <= 0) {
      m.hp = 0;
      this.setState('dead', 0);
      this.result = 'won';
      this.events.push({ type: 'slain' });
      return;
    }
    const busy = m.state === 'stun' || m.state === 'topple';
    if (kind === 'blunt' && part === 'head' && !busy) {
      m.stunBuild += damage;
      if (m.stunBuild >= m.def.stunAt) (m.stunBuild = 0), this.setState('stun', 4.2), this.events.push({ type: 'stun' });
    }
    if (part === 'legs' && !busy) {
      m.tripBuild += damage;
      if (m.tripBuild >= m.def.tripAt) (m.tripBuild = 0), this.setState('topple', 3.6), this.events.push({ type: 'topple' });
    }
    // Rage: at 65 % and 30 % of its health, once each.
    const share = m.hp / m.def.hp;
    if (m.enraged <= 0 && ((m.ragesUsed === 0 && share <= 0.65) || (m.ragesUsed === 1 && share <= 0.3))) {
      m.ragesUsed += 1;
      m.enraged = 28;
      m.exhausted = 0;
      this.events.push({ type: 'enrage' });
      if (m.state === 'roam' || m.state === 'recover' || m.state === 'flinch') this.setState('roar', 1.6);
    }
  }

  private setState(state: MonsterState, span: number): void {
    const m = this.monster;
    m.state = state;
    m.t = 0;
    m.span = span;
    if (state !== 'windup' && state !== 'active' && state !== 'recover') m.move = null;
  }

  private stepMonster(): void {
    const m = this.monster, h = this.hunter;
    if (m.state === 'dead') return;
    m.t += STEP;
    if (m.enraged > 0) {
      m.enraged -= STEP;
      if (m.enraged <= 0) (m.exhausted = 9), this.events.push({ type: 'calm' });
    } else if (m.exhausted > 0) m.exhausted -= STEP;
    const pace = m.enraged > 0 ? 1.25 : m.exhausted > 0 ? 0.75 : 1;
    const to = Math.atan2(h.x - m.x, h.z - m.z);
    const dist = Math.hypot(h.x - m.x, h.z - m.z);
    switch (m.state) {
      case 'roam': {
        m.yaw = turn(m.yaw, to, m.def.turnRate * pace * STEP);
        if (dist > m.def.reach) {
          const v = m.def.speed * pace * STEP;
          m.x += Math.sin(m.yaw) * v;
          m.z += Math.cos(m.yaw) * v;
        }
        m.think -= STEP * pace;
        if (m.think <= 0) this.chooseMove(dist, Math.abs(wrap(to - m.yaw)));
        break;
      }
      case 'windup': {
        const move = m.move!;
        // It keeps tracking for the first 60 % of the windup, then commits: that is the dodge cue.
        if (m.t < m.span * 0.6) m.yaw = turn(m.yaw, to, m.def.turnRate * (move.track ?? 1) * STEP);
        if (m.t >= m.span) {
          this.setStateKeep('active', move.active / pace);
          m.run = 0;
          m.hitDone = false;
          this.events.push({ type: 'strike', move: move.id });
        }
        break;
      }
      case 'active': {
        const move = m.move!;
        if (move.shape === 'charge') {
          const v = (move.range / m.span) * STEP;
          m.x += Math.sin(m.yaw) * v;
          m.z += Math.cos(m.yaw) * v;
          m.run += v;
        } else if (move.lunge) {
          const v = (move.lunge / m.span) * STEP;
          m.x += Math.sin(m.yaw) * v;
          m.z += Math.cos(m.yaw) * v;
        }
        if (!m.hitDone && this.moveHits(move)) {
          m.hitDone = true;
          this.hurtHunter(move);
        }
        if (m.t >= m.span) this.setStateKeep('recover', move.recover / (m.enraged > 0 ? 1.15 : 1) + (m.exhausted > 0 ? 0.6 : 0));
        break;
      }
      case 'recover':
      case 'flinch':
      case 'stun':
      case 'topple':
      case 'roar':
        if (m.state === 'roar' && !m.hitDone && m.t > 0.5) {
          m.hitDone = true;
          // The roar staggers a hunter who is close and not rolling through it.
          if (dist < m.def.roarRadius && !this.invulnerable()) this.hurtHunter({ ...ROAR, damage: 6 });
        }
        if (m.t >= m.span) {
          this.setState('roam', 0);
          m.hitDone = false;
          m.think = (0.5 + this.random() * 0.7) * (m.enraged > 0 ? 0.55 : 1) + (m.exhausted > 0 ? 0.8 : 0);
        }
        break;
    }
    const r = Math.hypot(m.x, m.z), lim = ARENA_RADIUS - 2;
    if (r > lim) (m.x *= lim / r), (m.z *= lim / r);
  }

  /** As setState, but keeps the move. */
  private setStateKeep(state: MonsterState, span: number): void {
    const m = this.monster;
    m.state = state;
    m.t = 0;
    m.span = span;
  }

  private chooseMove(dist: number, off: number): void {
    const m = this.monster;
    const options = m.def.moves.filter((mv) => dist >= mv.minDist && dist <= mv.maxDist && (!mv.rageOnly || m.enraged > 0) && (mv.behind ? off > 1.9 : off < (mv.maxOff ?? 1.2)));
    if (!options.length) return void (m.think = 0.25); // keep turning and closing
    let roll = this.random() * options.reduce((s, o) => s + o.weight, 0);
    const move = options.find((o) => (roll -= o.weight) <= 0) ?? options[0];
    m.move = move;
    m.hitDone = false;
    this.setStateKeep('windup', move.windup / (m.enraged > 0 ? 1.2 : 1));
    this.events.push({ type: 'telegraph', move: move.id });
  }

  /** Whether the move's shape covers the hunter this step. */
  private moveHits(move: MoveDef): boolean {
    const m = this.monster, h = this.hunter;
    const dx = h.x - m.x, dz = h.z - m.z, d = Math.hypot(dx, dz);
    const off = Math.abs(wrap(Math.atan2(dx, dz) - m.yaw));
    switch (move.shape) {
      case 'cone':
        return d <= move.range && off <= ((move.arcDeg ?? 60) * Math.PI) / 360;
      case 'circle':
        return d <= move.range;
      case 'sweep':
        // A tail sweep: a ring round the body, the head's side spared.
        return d <= move.range && off > 0.9;
      case 'charge': {
        // The lane already run plus the body's own length ahead.
        const along = dx * Math.sin(m.yaw) + dz * Math.cos(m.yaw);
        const across = Math.abs(dx * Math.cos(m.yaw) - dz * Math.sin(m.yaw));
        return across <= (move.width ?? 2) / 2 + 0.3 && along > -1 && along < m.def.reach + 0.5;
      }
    }
  }

  private invulnerable(): boolean {
    const h = this.hunter;
    if (h.down > 0 || h.grace > 0) return true;
    if (h.action === 'dodge' && this.machine?.active) return true;
    return false;
  }

  private hurtHunter(move: { id: string; damage: number; knock?: boolean }): void {
    const h = this.hunter, m = this.monster;
    if (this.invulnerable()) return;
    const rage = m.enraged > 0 ? 1.2 : 1;
    const damage = Math.max(1, Math.round((move.damage * m.def.power * rage * 100) / (100 + this.loadout.defense)));
    h.hp -= damage;
    this.events.push({ type: 'hurt', damage, move: move.id });
    this.machine?.stop();
    this.machine = null;
    h.action = null;
    this.input.clear();
    if (h.hp <= 0) {
      h.faints += 1;
      this.events.push({ type: 'faint' });
      if (h.faints >= MAX_FAINTS) {
        h.hp = 0;
        this.result = 'failed';
        this.events.push({ type: 'fail' });
        return;
      }
      // Carted back to the arena's edge, healed; the monster keeps its wounds.
      h.hp = h.maxHp;
      h.stamina = 100;
      const away = Math.atan2(h.x - m.x, h.z - m.z);
      h.x = Math.sin(away) * (ARENA_RADIUS - 2);
      h.z = Math.cos(away) * (ARENA_RADIUS - 2);
      h.down = 1.6;
      return;
    }
    h.down = move.knock === false ? 0.45 : 1.1;
    // Thrown back from the monster.
    const away = Math.atan2(h.x - m.x, h.z - m.z);
    this.moveThrown(Math.sin(away) * 2.2, Math.cos(away) * 2.2);
  }

  private moveThrown(dx: number, dz: number): void {
    const h = this.hunter;
    h.x += dx;
    h.z += dz;
    const r = Math.hypot(h.x, h.z);
    if (r > ARENA_RADIUS) (h.x *= ARENA_RADIUS / r), (h.z *= ARENA_RADIUS / r);
  }
}

const ROAR = { id: 'roar', damage: 6, knock: false };

/** What the monster gives at the end, decided by the same seeded generator's continuation. */
export function carve(hunt: Hunt, seed: number): Record<string, number> {
  const r = rng(seed ^ 0x9e3779b9);
  const m = hunt.monster;
  const loot: Record<string, number> = {};
  const add = (id: string, n = 1) => (loot[id] = (loot[id] ?? 0) + n);
  const d = m.def.drops;
  add(d.common, 2 + Math.floor(r() * 2));
  if (m.parts.head.broken) add(d.head, 1 + (r() < 0.4 ? 1 : 0));
  else if (r() < 0.25) add(d.head);
  if (m.parts.tail.broken) add(d.tail);
  if (m.parts.legs.broken) add(d.common);
  const breaks = (Object.values(m.parts).filter((p) => p.broken).length);
  if (r() < 0.05 + breaks * 0.05) add(d.rare);
  return loot;
}
