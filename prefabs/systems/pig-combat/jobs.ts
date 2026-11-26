// 豬大三職業的戰鬥規則（來源：zhuda-spacetime-3d src/systems/combat/jobs.ts，0.4.0 收進 prefabs）。純規則：不碰引擎、不碰 DOM。
// The pig's three callings and how each fights. Rules only: no engine, no DOM.
//
// A calling has a round of five plain attacks and a skill, each a clip of the pig's (tools/characters/pig-clips.py).
// The round is the same shape for all three: three blows, a roll backward out of reach, and a heavy blow to end it
// (press, press, press, press, press): the boxer comes forward again with a great kick, the ninja with a great
// cut, and the Taoist stays where it has rolled to and throws an ice charm that freezes what it lands on. The heavy blow is only ever the end of an unbroken round: a press made
// while an attack is going is kept and answered as soon as that attack lets go (its `chainFrom`), and so one blow
// follows another; but if an attack is let end with nothing asked for, the round is over, and the next press
// begins it again from its first blow. (A moment's grace is given after an attack ends, for a press that came a
// hair late.) One press is one attack.
//
// The skill button does the calling's skill, in the same way (it may be pressed in the middle of a round), and
// then the skill must rest a while.
//
// The boxer's blows quicken as they follow one another, and after enough of them its fists catch fire; its skill
// sets them alight at once. The ninja's skill throws a great wave from its sword. The Taoist fights with its
// fists and ends its round with the ice charm; its skill is fire, thunder and the great circle. Every charm is a
// blank paper spent, and the papers come back slowly while it is not casting.

export type JobId = 'none' | 'fist' | 'ninja' | 'taoist';

export interface AttackStep {
  /** The pig's clip, and what the effects should make of it. */
  clip: string;
  effect: 'jab' | 'straight' | 'hook' | 'kick' | 'roll' | 'uppercut' | 'blaze' | 'cut' | 'back-cut' | 'chop' | 'crescent' | 'ice-charm' | 'charm' | 'thunder-charm' | 'great-charm';
  /** Its length at its plain speed, seconds. */
  seconds: number;
  /** When it lands, and from when the next may begin, as shares of its length. */
  hitAt: number;
  chainFrom: number;
  /** Blank charms it spends. */
  papers?: number;
  /** The heavy blow that ends a round (or a skill): the whole body is in it. */
  heavy?: boolean;
  /** Done with the whole body even while the pig is walked by the stick (a kick, a roll, a leap): the legs are the attack's. */
  whole?: boolean;
  /** It carries the pig forward for this long, seconds (at a run when `dash`; backward, still facing the same way, when `back`). */
  advance?: number;
  dash?: boolean;
  back?: boolean;
}

export interface Job {
  id: Exclude<JobId, 'none'>;
  name: string;
  line: string;
  /** The round of plain attacks. */
  steps: readonly AttackStep[];
  /** Its skill: a name, a round of its own (often one attack), and the rest it needs after each, seconds. */
  skillName: string;
  skill: readonly AttackStep[];
  skillRest: number;
}

// How long each lasts, seconds. (The plain blows come about three and a half a second: slower, they are seen.)
const LEFT: AttackStep = { clip: 'Punch1', effect: 'jab', seconds: 0.44, hitAt: 0.46, chainFrom: 0.64, advance: 0.12 };
const RIGHT: AttackStep = { clip: 'Punch2', effect: 'straight', seconds: 0.44, hitAt: 0.46, chainFrom: 0.64, advance: 0.12 };
const HOOK: AttackStep = { clip: 'Punch3', effect: 'hook', seconds: 0.48, hitAt: 0.5, chainFrom: 0.66, advance: 0.12 };
/** The roll backward, out of reach, before the heavy blow. */
const ROLL: AttackStep = { clip: 'Roll', effect: 'roll', seconds: 0.56, hitAt: 0.5, chainFrom: 0.86, whole: true, advance: 0.4, dash: true, back: true };

export const JOBS: Record<Exclude<JobId, 'none'>, Job> = {
  fist: {
    id: 'fist',
    name: '豬拳者',
    line: '揮拳如風，快至巔峰起火也',
    // three blows, a roll back, and forward again with a great kick
    steps: [LEFT, RIGHT, HOOK, ROLL, { clip: 'Kick', effect: 'kick', seconds: 0.72, hitAt: 0.5, chainFrom: 0.86, heavy: true, whole: true, advance: 0.26, dash: true }],
    skillName: '爆氣',
    skill: [{ clip: 'Punch4', effect: 'blaze', seconds: 0.62, hitAt: 0.46, chainFrom: 0.8, heavy: true, whole: true }],
    skillRest: 6,
  },
  ninja: {
    id: 'ninja',
    name: '豬忍者',
    line: '手持忍太刀，揮刀斬棘',
    // three cuts, a roll back, and forward again with a great cut
    steps: [
      { clip: 'Slash1', effect: 'cut', seconds: 0.46, hitAt: 0.5, chainFrom: 0.66, advance: 0.12 },
      { clip: 'Slash2', effect: 'back-cut', seconds: 0.46, hitAt: 0.5, chainFrom: 0.66, advance: 0.12 },
      { clip: 'Slash1', effect: 'cut', seconds: 0.5, hitAt: 0.5, chainFrom: 0.66, advance: 0.12 },
      ROLL,
      { clip: 'Chop', effect: 'chop', seconds: 0.78, hitAt: 0.62, chainFrom: 0.88, heavy: true, whole: true, advance: 0.3, dash: true },
    ],
    skillName: '月牙斬',
    skill: [{ clip: 'Slash2', effect: 'crescent', seconds: 0.56, hitAt: 0.5, chainFrom: 0.72, heavy: true }],
    skillRest: 4,
  },
  taoist: {
    id: 'taoist',
    name: '豬道者',
    line: '消耗空白符紙，施展法術',
    // three blows, a roll back, and from where it stands an ice charm thrown ahead
    steps: [LEFT, RIGHT, HOOK, ROLL, { clip: 'Charm1', effect: 'ice-charm', seconds: 0.72, hitAt: 0.66, chainFrom: 0.86, heavy: true, papers: 1 }],
    skillName: '符法',
    skill: [
      { clip: 'Charm1', effect: 'charm', seconds: 0.66, hitAt: 0.66, chainFrom: 0.8, heavy: true, papers: 1 },
      { clip: 'Charm1', effect: 'thunder-charm', seconds: 0.66, hitAt: 0.66, chainFrom: 0.8, heavy: true, papers: 1 },
      { clip: 'Charm2', effect: 'great-charm', seconds: 0.8, hitAt: 0.62, chainFrom: 0.84, heavy: true, whole: true, papers: 2 },
    ],
    skillRest: 0.3,
  },
};

/** The order the calling button goes round. */
export const JOB_ORDER: readonly JobId[] = ['none', 'fist', 'ninja', 'taoist'];
/** Every clip an attack plays, once each. */
export const ATTACK_CLIPS: readonly string[] = [...new Set(Object.values(JOBS).flatMap((job) => [...job.steps, ...job.skill].map((step) => step.clip)))];

export const COMBAT = {
  /** The grace after an attack ends in which a press still goes on with the round; any later, the round begins again. */
  roundKeeps: 0.15,
  /** The boxer: each blow that lands adds one heat; a blow is this much quicker a heat, to at most `quickest`. */
  quicker: 0.04,
  quickest: 1.25,
  mostHeat: 10,
  /** At this heat its fists are alight; the heat is lost when it has not struck for `heatKeeps` seconds. */
  ablazeAt: 5,
  heatKeeps: 1.3,
  /** After its skill the boxer's fire does not go out for this long, whether it strikes or not. */
  furySeconds: 6,
  /** The Taoist: how many blank charms it carries, and how long one takes to come back when it is not casting. */
  papers: 9,
  paperSeconds: 2.5,
};

export interface CombatState {
  job: JobId;
  /** The attack of the round being done, or -1; and the next to do. `skill` when what is being done is the skill. */
  step: number;
  next: number;
  skill: boolean;
  /** The next of the skill's own round, and how long until the skill may be done again. */
  skillNext: number;
  skillRest: number;
  /** Seconds into the attack at its plain speed (so `time / seconds` is how far through it is), and its speed. */
  time: number;
  speed: number;
  landed: boolean;
  /** A press waiting for the attack to let go: of the attack button, or of the skill's. */
  queued: boolean;
  queuedSkill: boolean;
  /** Seconds since an attack last ended (or began, while one goes). */
  idle: number;
  heat: number;
  /** Seconds left of the boxer's skill, in which its heat is not lost. */
  fury: number;
  papers: number;
  paperClock: number;
}

export type CombatEvent =
  | { type: 'start'; step: AttackStep; index: number; speed: number; skill: boolean }
  | { type: 'hit'; step: AttackStep; index: number; ablaze: boolean; heat: number; skill: boolean }
  | { type: 'end' }
  | { type: 'ablaze' }
  | { type: 'cool' };

export function newCombat(job: JobId = 'none'): CombatState {
  return { job, step: -1, next: 0, skill: false, skillNext: 0, skillRest: 0, time: 0, speed: 1, landed: false, queued: false, queuedSkill: false, idle: 99, heat: 0, fury: 0, papers: COMBAT.papers, paperClock: 0 };
}

/** Takes up another calling (or none): whatever it was doing stops, and its charms are kept. */
export function switchJob(state: CombatState, job: JobId): CombatState {
  return { ...newCombat(job), papers: state.papers, paperClock: state.paperClock };
}

export function isAblaze(state: CombatState): boolean {
  return state.job === 'fist' && state.heat >= COMBAT.ablazeAt;
}

/** How far through its attack it is, 0..1; 0 when it is not attacking. */
export function progress(state: CombatState): number {
  if (state.job === 'none' || state.step < 0) return 0;
  return Math.min(1, state.time / current(state)!.seconds);
}

/** The attack being done, or null. */
export function current(state: CombatState): AttackStep | null {
  if (state.job === 'none' || state.step < 0) return null;
  const job = JOBS[state.job];
  return (state.skill ? job.skill : job.steps)[state.step];
}

function begin(state: CombatState, skill: boolean, events: CombatEvent[]): CombatState {
  const job = JOBS[state.job as Exclude<JobId, 'none'>];
  const round = skill ? job.skill : job.steps;
  const index = (skill ? state.skillNext : state.next) % round.length;
  const step = round[index];
  const speed = state.job === 'fist' && !skill ? Math.min(COMBAT.quickest, 1 + COMBAT.quicker * state.heat) : 1;
  events.push({ type: 'start', step, index, speed, skill });
  return {
    ...state, step: index, skill, time: 0, speed, landed: false, queued: false, queuedSkill: false, idle: 0, papers: state.papers - (step.papers ?? 0),
    next: skill ? state.next : (index + 1) % round.length,
    skillNext: skill ? (index + 1) % round.length : state.skillNext,
    skillRest: skill ? job.skillRest : state.skillRest,
  };
}

/** Which of the skill's round can be done with the charms there are: the next, or failing that a cheaper one; -1 for none. */
function affordable(state: CombatState): number {
  const round = JOBS[state.job as Exclude<JobId, 'none'>].skill;
  if ((round[state.skillNext % round.length].papers ?? 0) <= state.papers) return state.skillNext % round.length;
  return round.findIndex((step) => (step.papers ?? 0) <= state.papers);
}

type Pressed = { state: CombatState; events: CombatEvent[]; refused?: 'no-job' | 'no-paper' | 'resting' };

/**
 * The attack button. With no calling nothing happens. Otherwise the next plain attack begins at once, or is
 * kept until the one going lets go.
 */
export function pressAttack(state: CombatState): Pressed {
  if (state.job === 'none') return { state, events: [], refused: 'no-job' };
  if (state.step >= 0) return { state: { ...state, queued: true }, events: [] };
  const events: CombatEvent[] = [];
  const short = lacksPapers(state);
  return { state: begin(short ? { ...state, next: 0 } : state, false, events), events, ...(short ? { refused: 'no-paper' as const } : {}) };
}

/** Whether the round's next attack needs charms there are not (the Taoist's fire charm): the round begins again instead. */
function lacksPapers(state: CombatState): boolean {
  const round = JOBS[state.job as Exclude<JobId, 'none'>].steps;
  return (round[state.next % round.length].papers ?? 0) > state.papers;
}

/**
 * The skill button. Refused while the skill rests, and for a Taoist without the charms a spell needs (short of
 * the great spell's, the plain spell is done instead). Otherwise it begins at once, or as soon as the attack
 * going lets go: it comes before a kept press of the attack button.
 */
export function pressSkill(state: CombatState): Pressed {
  if (state.job === 'none') return { state, events: [], refused: 'no-job' };
  if (state.skillRest > 0 && !(state.step >= 0 && state.skill && JOBS[state.job].skill.length > 1)) return { state, events: [], refused: 'resting' };
  const can = affordable(state);
  if (can < 0) return { state, events: [], refused: 'no-paper' };
  state = { ...state, skillNext: can };
  if (state.step >= 0) return { state: { ...state, queuedSkill: true }, events: [] };
  const events: CombatEvent[] = [];
  return { state: begin(state, true, events), events };
}

/** Time passes: the attack goes on, lands, lets a kept press through, ends; heat cools, the skill rests, charms come back. */
export function stepCombat(state: CombatState, dt: number): { state: CombatState; events: CombatEvent[] } {
  const events: CombatEvent[] = [];
  if (!(dt > 0) || state.job === 'none') return { state, events };
  let next = { ...state, skillRest: Math.max(0, state.skillRest - dt), fury: Math.max(0, state.fury - dt) };
  const step = current(next);
  if (step) {
    next.time += dt * next.speed;
    next.idle = 0;
    const through = next.time / step.seconds;
    if (!next.landed && through >= step.hitAt) {
      next.landed = true;
      const was = isAblaze(next);
      // A plain blow adds a heat; the boxer's skill brings it to its height at once.
      if (next.job === 'fist' && step.effect !== 'roll') next.heat = step.effect === 'blaze' ? COMBAT.mostHeat : Math.min(COMBAT.mostHeat, next.heat + 1);
      if (step.effect === 'blaze') next.fury = COMBAT.furySeconds;
      events.push({ type: 'hit', step, index: next.step, ablaze: isAblaze(next), heat: next.heat, skill: next.skill });
      if (!was && isAblaze(next)) events.push({ type: 'ablaze' });
    }
    if ((next.queued || next.queuedSkill) && through >= step.chainFrom) {
      if (next.queuedSkill && affordable(next) >= 0) next = begin({ ...next, step: -1, skillNext: affordable(next) }, true, events);
      else if (next.queued) next = begin({ ...next, step: -1, next: lacksPapers(next) ? 0 : next.next }, false, events);
      else next.queuedSkill = false;
    } else if (through >= 1) {
      next.step = -1;
      next.time = 0;
      events.push({ type: 'end' });
    }
  } else {
    next.idle += dt;
    if (next.idle > COMBAT.roundKeeps) next.next = next.skillNext = 0;
    if (next.heat > 0 && next.idle > COMBAT.heatKeeps && next.fury <= 0) {
      next.heat = 0;
      events.push({ type: 'cool' });
    }
    if (next.papers < COMBAT.papers) {
      next.paperClock += dt;
      if (next.paperClock >= COMBAT.paperSeconds) {
        next.paperClock = 0;
        next.papers++;
      }
    }
  }
  return { state: next, events };
}
