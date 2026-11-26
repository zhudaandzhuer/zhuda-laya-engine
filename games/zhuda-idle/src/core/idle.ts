// 豬大掛機傳 — the rules of an idle gacha game, pure and seeded: summons with published rates and
// pity, a team's power against a stage's, earnings while away, levels and stars, daily tasks, the
// seven-day sign-in and a VIP ladder earned by playing. No real money exists in this game: every
// currency comes from play. Tested in test/idle.test.ts.

export type Rarity = 'R' | 'SR' | 'SSR';
export interface HeroDef {
  id: string;
  name: string;
  title: string;
  rarity: Rarity;
  role: '坦' | '攻' | '輔';
}

// The eleven 契師 of 九野 (this repository's own characters and portraits).
export const HEROES: HeroDef[] = [
  { id: 'shen-yan', name: '沈硯', title: '不動如山', rarity: 'SSR', role: '坦' },
  { id: 'ye-shuang', name: '葉霜', title: '月下雙影', rarity: 'SSR', role: '攻' },
  { id: 'xuan-heng', name: '玄珩', title: '山河印', rarity: 'SSR', role: '輔' },
  { id: 'huo-qingtang', name: '霍青棠', title: '破陣一槍', rarity: 'SR', role: '攻' },
  { id: 'lu-xinghe', name: '陸星河', title: '焚天符陣', rarity: 'SR', role: '攻' },
  { id: 'han-jin', name: '韓燼', title: '燼滅', rarity: 'SR', role: '攻' },
  { id: 'meng-yuanzhou', name: '孟遠舟', title: '怒潮', rarity: 'SR', role: '坦' },
  { id: 'bai-zhi', name: '白芷', title: '萬木回春', rarity: 'R', role: '輔' },
  { id: 'yan-wusheng', name: '燕無聲', title: '無聲', rarity: 'R', role: '攻' },
  { id: 'a-heng', name: '阿蘅', title: '千燈', rarity: 'R', role: '輔' },
  { id: 'lin-qingluo', name: '藺青蘿', title: '萬藤', rarity: 'R', role: '坦' },
];
export const hero = (id: string) => HEROES.find((h) => h.id === id)!;

export const ENEMIES = ['zheng', 'kui', 'bifang', 'jiuweihu', 'dijiang', 'jiao', 'taotie', 'qiongqi', 'jiuying', 'kun'];
export const BOSSES = ['xingtian', 'dapeng', 'xuanwu', 'chiyou', 'zhulong'];
export const ENEMY_NAMES: Record<string, string> = { zheng: '猙', kui: '夔', bifang: '畢方', jiuweihu: '九尾狐', dijiang: '帝江', jiao: '蛟', taotie: '饕餮', qiongqi: '窮奇', jiuying: '九嬰', kun: '鯤', xingtian: '刑天', dapeng: '金翅大鵬', xuanwu: '玄武', chiyou: '蚩尤', zhulong: '燭龍' };

/** Published rates, as shown on the summon screen. */
export const RATES: Record<Rarity, number> = { SSR: 0.02, SR: 0.13, R: 0.85 };
/** The SSR chance rises from this pull on, and pull 60 without one is an SSR. */
export const SOFT_PITY = 45;
export const HARD_PITY = 60;
const BASE: Record<Rarity, number> = { R: 100, SR: 190, SSR: 340 };
const SHARDS: Record<Rarity, number> = { R: 10, SR: 30, SSR: 80 };
export const MAX_STARS = 5;
export const TEAM_SIZE = 5;
export const AFK_CAP_MIN = 12 * 60;
export const QUICK_PER_DAY = 3;

export interface OwnedHero {
  level: number;
  stars: number;
  shards: number;
}
export interface Save {
  version: 1;
  seed: number;
  coins: number;
  jade: number;
  tickets: number;
  heroes: Record<string, OwnedHero>;
  team: string[];
  /** The stage being fought (1-based); cleared stages are below it. */
  stage: number;
  pity: number;
  sincePurple: number;
  pulls: number;
  /** When the idle chest last started filling (ms). */
  afkFrom: number;
  /** The day (yyyy-mm-dd) the daily counters belong to. */
  day: string;
  daily: { summons: number; levels: number; clears: number; claims: number; quick: number; claimed: string[] };
  loginDays: number;
  loginClaimed: number;
  vipExp: number;
}

export function rng(save: Save): number {
  save.seed = (save.seed + 0x6d2b79f5) >>> 0;
  let t = save.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const dayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

export function newSave(now: number, seed = 20261125): Save {
  // A new player starts with three R heroes: enough to fight, not enough to be content.
  const heroes: Save['heroes'] = {};
  for (const id of ['bai-zhi', 'yan-wusheng', 'lin-qingluo']) heroes[id] = { level: 1, stars: 0, shards: 0 };
  return {
    version: 1, seed, coins: 500, jade: 300, tickets: 0, heroes, team: Object.keys(heroes), stage: 1, pity: 0, sincePurple: 0, pulls: 0,
    afkFrom: now, day: dayKey(now), daily: { summons: 0, levels: 0, clears: 0, claims: 0, quick: 0, claimed: [] }, loginDays: 1, loginClaimed: 0, vipExp: 0,
  };
}

/** Starts a new day when the date has changed: daily counters reset and the sign-in advances. */
export function rollDay(save: Save, now: number): boolean {
  const key = dayKey(now);
  if (key === save.day) return false;
  save.day = key;
  save.daily = { summons: 0, levels: 0, clears: 0, claims: 0, quick: 0, claimed: [] };
  save.loginDays += 1;
  return true;
}

// ---- power -------------------------------------------------------------------------------------
export function heroPower(id: string, own: OwnedHero): number {
  return Math.round(BASE[hero(id).rarity] * Math.pow(1.08, own.level - 1) * (1 + 0.25 * own.stars));
}
export function teamPower(save: Save): number {
  return save.team.reduce((sum, id) => sum + (save.heroes[id] ? heroPower(id, save.heroes[id]) : 0), 0);
}
export const isBoss = (stage: number) => stage % 10 === 0;
export function stagePower(stage: number): number {
  return Math.round(260 * Math.pow(1.16, stage - 1) * (isBoss(stage) ? 1.5 : 1));
}
export function stageEnemy(stage: number): string {
  return isBoss(stage) ? BOSSES[(stage / 10 - 1) % BOSSES.length] : ENEMIES[(stage - 1) % ENEMIES.length];
}
/** The strongest five owned heroes, strongest first. */
export function bestTeam(save: Save): string[] {
  return Object.keys(save.heroes).sort((a, b) => heroPower(b, save.heroes[b]) - heroPower(a, save.heroes[a]) || a.localeCompare(b)).slice(0, TEAM_SIZE);
}

// ---- battle ------------------------------------------------------------------------------------
export interface Battle {
  stage: number;
  win: boolean;
  /** Blows in order, for the screen: who struck (a hero id or 'enemy'), for how much, what is left of each side (0..1). */
  blows: { by: string; damage: number; crit: boolean; team: number; enemy: number }[];
  rewards?: { coins: number; jade: number; tickets: number };
}

/** Fights the current stage. Power decides it; within 15 % either way the dice have a say. */
export function fight(save: Save): Battle {
  const stage = save.stage;
  const mine = teamPower(save), theirs = stagePower(stage);
  const ratio = mine / theirs;
  const win = ratio >= 1.15 || (ratio > 0.85 && rng(save) < (ratio - 0.85) / 0.3);
  // The exchange shown is fitted to the outcome: the loser reaches zero on the last blow.
  const blows: Battle['blows'] = [];
  const rounds = 6 + Math.floor(rng(save) * 4);
  let team = 1, enemy = 1;
  const order = save.team.filter((id) => save.heroes[id]);
  for (let i = 0; i < rounds; i++) {
    const last = i >= rounds - 2;
    const heroTurn = i % 2 === 0;
    const crit = rng(save) < 0.2;
    if (heroTurn) {
      const share = win ? (last ? enemy : enemy * (0.25 + rng(save) * 0.25)) : enemy * (0.05 + rng(save) * 0.12);
      enemy = Math.max(0, enemy - share);
      const by = order[(i / 2) % order.length] ?? 'enemy';
      blows.push({ by, damage: Math.max(1, Math.round(theirs * share * (crit ? 1.6 : 1))), crit, team, enemy });
      if (win && enemy <= 0) break;
    } else {
      const share = win ? team * (0.05 + rng(save) * 0.15) : last ? team : team * (0.25 + rng(save) * 0.25);
      team = Math.max(0, team - share);
      blows.push({ by: 'enemy', damage: Math.max(1, Math.round(mine * share)), crit, team, enemy });
      if (!win && team <= 0) break;
    }
  }
  if (win && enemy > 0) blows.push({ by: order[0] ?? 'enemy', damage: Math.round(theirs * enemy), crit: true, team, enemy: 0 });
  if (!win && team > 0) blows.push({ by: 'enemy', damage: Math.round(mine * team), crit: true, team: 0, enemy });
  const battle: Battle = { stage, win, blows };
  if (win) {
    const rewards = { coins: Math.round(120 * Math.pow(1.12, stage)), jade: isBoss(stage) ? 150 : 20, tickets: stage % 5 === 0 ? 1 : 0 };
    save.coins += rewards.coins;
    save.jade += rewards.jade;
    save.tickets += rewards.tickets;
    save.stage += 1;
    save.daily.clears += 1;
    save.vipExp += isBoss(stage) ? 10 : 2;
    battle.rewards = rewards;
  }
  return battle;
}

// ---- idle earnings -----------------------------------------------------------------------------
export const VIP_STEPS = [0, 30, 80, 160, 300, 500, 800, 1200, 1800, 2600, 3600];
export function vipLevel(save: Save): number {
  let level = 0;
  while (level + 1 < VIP_STEPS.length && save.vipExp >= VIP_STEPS[level + 1]) level += 1;
  return level;
}
/** Coins a minute away earns at the stage reached, with the VIP bonus (5 % a level). */
export function afkRate(save: Save): number {
  return Math.round(12 * Math.pow(1.12, save.stage - 1) * (1 + 0.05 * vipLevel(save)));
}
export function afkMinutes(save: Save, now: number): number {
  return Math.max(0, Math.min(AFK_CAP_MIN, (now - save.afkFrom) / 60000));
}
export function afkPending(save: Save, now: number): number {
  return Math.floor(afkMinutes(save, now) * afkRate(save));
}
export function claimAfk(save: Save, now: number): number {
  const coins = afkPending(save, now);
  if (coins <= 0) return 0;
  save.coins += coins;
  save.afkFrom = now;
  save.daily.claims += 1;
  return coins;
}
export const QUICK_COST = 50;
/** Two hours of earnings at once, for jade, three times a day. */
export function quickAfk(save: Save): number {
  if (save.daily.quick >= QUICK_PER_DAY || save.jade < QUICK_COST) return 0;
  save.jade -= QUICK_COST;
  save.daily.quick += 1;
  const coins = afkRate(save) * 120;
  save.coins += coins;
  return coins;
}

// ---- growth ------------------------------------------------------------------------------------
export const levelCost = (level: number) => Math.round(40 * Math.pow(1.1, level - 1));
export const maxLevel = (save: Save) => 20 + save.stage * 2;
export function levelUp(save: Save, id: string): boolean {
  const own = save.heroes[id];
  if (!own || own.level >= maxLevel(save)) return false;
  const cost = levelCost(own.level);
  if (save.coins < cost) return false;
  save.coins -= cost;
  own.level += 1;
  save.daily.levels += 1;
  return true;
}
/** Spends coins on the team, always the cheapest level first, until nothing is affordable. */
export function levelAll(save: Save): number {
  let n = 0;
  for (;;) {
    const next = save.team.filter((id) => save.heroes[id] && save.heroes[id].level < maxLevel(save)).sort((a, b) => levelCost(save.heroes[a].level) - levelCost(save.heroes[b].level))[0];
    if (!next || !levelUp(save, next)) return n;
    n += 1;
  }
}
export const starCost = (stars: number) => 20 * (stars + 1);
export function starUp(save: Save, id: string): boolean {
  const own = save.heroes[id];
  if (!own || own.stars >= MAX_STARS || own.shards < starCost(own.stars)) return false;
  own.shards -= starCost(own.stars);
  own.stars += 1;
  return true;
}

// ---- summons -----------------------------------------------------------------------------------
export interface Pull {
  id: string;
  rarity: Rarity;
  isNew: boolean;
  shards: number;
}
/** The SSR chance on the next pull, given how many have gone by without one. */
export function ssrChance(pity: number): number {
  if (pity + 1 >= HARD_PITY) return 1;
  if (pity + 1 < SOFT_PITY) return RATES.SSR;
  return RATES.SSR + ((1 - RATES.SSR) * (pity + 1 - SOFT_PITY + 1)) / (HARD_PITY - SOFT_PITY + 1);
}
function pullOne(save: Save, guaranteePurple: boolean): Pull {
  const roll = rng(save);
  const pSSR = ssrChance(save.pity);
  let rarity: Rarity = roll < pSSR ? 'SSR' : roll < pSSR + RATES.SR ? 'SR' : 'R';
  if (rarity === 'R' && guaranteePurple) rarity = 'SR';
  save.pity = rarity === 'SSR' ? 0 : save.pity + 1;
  save.sincePurple = rarity === 'R' ? save.sincePurple + 1 : 0;
  save.pulls += 1;
  const pool = HEROES.filter((h) => h.rarity === rarity);
  const def = pool[Math.floor(rng(save) * pool.length)];
  const own = save.heroes[def.id];
  if (own) {
    own.shards += SHARDS[rarity];
    return { id: def.id, rarity, isNew: false, shards: SHARDS[rarity] };
  }
  save.heroes[def.id] = { level: 1, stars: 0, shards: 0 };
  return { id: def.id, rarity, isNew: true, shards: 0 };
}
export const PULL_JADE = 100;
/** What `count` pulls cost: tickets first, jade for the rest; null when the player has not enough. */
export function summonCost(save: Save, count: number): { tickets: number; jade: number } | null {
  const tickets = Math.min(save.tickets, count);
  const jade = (count - tickets) * PULL_JADE;
  return jade > save.jade ? null : { tickets, jade };
}
/** One pull or ten; every tenth pull without an SR or better is at least an SR. */
export function summon(save: Save, count: 1 | 10): Pull[] | null {
  const cost = summonCost(save, count);
  if (!cost) return null;
  save.tickets -= cost.tickets;
  save.jade -= cost.jade;
  const out: Pull[] = [];
  for (let i = 0; i < count; i++) out.push(pullOne(save, save.sincePurple >= 9));
  save.daily.summons += count;
  save.vipExp += count;
  return out;
}

// ---- tasks, sign-in ----------------------------------------------------------------------------
export interface TaskDef {
  id: string;
  text: string;
  need: number;
  progress: (s: Save) => number;
  jade: number;
}
export const TASKS: TaskDef[] = [
  { id: 'clear', text: '通過 5 關', need: 5, progress: (s) => s.daily.clears, jade: 60 },
  { id: 'level', text: '升級 20 次', need: 20, progress: (s) => s.daily.levels, jade: 40 },
  { id: 'summon', text: '召喚 10 次', need: 10, progress: (s) => s.daily.summons, jade: 80 },
  { id: 'afk', text: '領取掛機獎勵 2 次', need: 2, progress: (s) => s.daily.claims, jade: 40 },
];
export function claimTask(save: Save, id: string): boolean {
  const t = TASKS.find((x) => x.id === id);
  if (!t || save.daily.claimed.includes(id) || t.progress(save) < t.need) return false;
  save.daily.claimed.push(id);
  save.jade += t.jade;
  return true;
}
/** Seven days of sign-in gifts; the first is the ten pulls the title promises. */
export const LOGIN: { tickets?: number; jade?: number; coins?: number; text: string }[] = [
  { tickets: 10, text: '召喚券 ×10' },
  { jade: 300, text: '靈玉 ×300' },
  { tickets: 5, text: '召喚券 ×5' },
  { coins: 20000, text: '金幣 ×20000' },
  { jade: 500, text: '靈玉 ×500' },
  { tickets: 10, text: '召喚券 ×10' },
  { tickets: 20, jade: 1000, text: '召喚券 ×20、靈玉 ×1000' },
];
export function claimLogin(save: Save): boolean {
  if (save.loginClaimed >= Math.min(save.loginDays, LOGIN.length)) return false;
  const gift = LOGIN[save.loginClaimed];
  save.tickets += gift.tickets ?? 0;
  save.jade += gift.jade ?? 0;
  save.coins += gift.coins ?? 0;
  save.loginClaimed += 1;
  return true;
}

/** Which tabs have something to collect (the red dots). */
export function dots(save: Save, now: number): Record<'battle' | 'heroes' | 'summon' | 'tasks' | 'gifts', boolean> {
  const canLevel = save.team.some((id) => save.heroes[id] && save.heroes[id].level < maxLevel(save) && save.coins >= levelCost(save.heroes[id].level));
  const canStar = Object.values(save.heroes).some((o) => o.stars < MAX_STARS && o.shards >= starCost(o.stars));
  const better = bestTeam(save).join() !== [...save.team].sort((a, b) => heroPower(b, save.heroes[b]) - heroPower(a, save.heroes[a]) || a.localeCompare(b)).join();
  return {
    battle: afkMinutes(save, now) >= 10,
    heroes: canLevel || canStar || better,
    summon: !!summonCost(save, 10),
    tasks: TASKS.some((t) => !save.daily.claimed.includes(t.id) && t.progress(save) >= t.need),
    gifts: save.loginClaimed < Math.min(save.loginDays, LOGIN.length),
  };
}

export function loadSave(storage: Pick<Storage, 'getItem'> | undefined, now: number): Save {
  try {
    const raw = storage?.getItem('zhuda-idle/save');
    const s = raw ? (JSON.parse(raw) as Save) : null;
    if (s && s.version === 1 && s.heroes && s.team) return s;
  } catch {
    /* a broken save starts over */
  }
  return newSave(now);
}
