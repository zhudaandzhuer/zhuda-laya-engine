// 豬大狩荒 — the monsters, their moves, the quests and the forge. Numbers only; the rules that
// read them are in hunt.ts. The beasts come from the 山海經; models are this repository's own.

export type PartId = 'head' | 'body' | 'legs' | 'tail';

export interface PartDef {
  /** Centre, in metres from the monster's origin along its facing and to its right. */
  forward: number;
  side: number;
  radius: number;
  /** Hitzones: the share of an attack's damage that lands. */
  cut: number;
  blunt: number;
  /** Damage that breaks the part; 0 = cannot break. */
  breakHp: number;
  /** A tail that only cutting damage takes off. */
  severs?: boolean;
}

export interface MoveDef {
  id: string;
  name: string;
  shape: 'cone' | 'circle' | 'sweep' | 'charge';
  range: number;
  arcDeg?: number;
  width?: number;
  /** Metres it steps forward while striking (a bite's lunge). */
  lunge?: number;
  windup: number;
  active: number;
  recover: number;
  damage: number;
  weight: number;
  minDist: number;
  maxDist: number;
  /** Largest angle to the hunter (radians) at which it picks the move. */
  maxOff?: number;
  /** Picked when the hunter is behind it. */
  behind?: boolean;
  rageOnly?: boolean;
  /** How well it follows the hunter during the windup (1 = its turn rate). */
  track?: number;
  /** The model clip the strike plays. */
  clip: string;
}

export interface MonsterDef {
  id: string;
  name: string;
  title: string;
  model: string;
  /** Shown height in metres (the model is scaled to it). */
  height: number;
  /** The model's own height in metres. */
  modelHeight: number;
  hp: number;
  power: number;
  speed: number;
  turnRate: number;
  /** Distance at which it stops closing in. */
  reach: number;
  roarRadius: number;
  stunAt: number;
  tripAt: number;
  parts: Record<PartId, PartDef>;
  moves: MoveDef[];
  drops: { common: string; head: string; tail: string; rare: string };
}

const bite = (o: Partial<MoveDef>): MoveDef => ({ id: 'bite', name: '撲咬', shape: 'cone', range: 4.2, arcDeg: 70, lunge: 1.6, windup: 0.75, active: 0.22, recover: 1.0, damage: 22, weight: 5, minDist: 0, maxDist: 5.5, maxOff: 0.7, clip: 'Attack', ...o });
const sweep = (o: Partial<MoveDef>): MoveDef => ({ id: 'sweep', name: '甩尾', shape: 'sweep', range: 5.2, windup: 0.9, active: 0.3, recover: 1.25, damage: 26, weight: 4, minDist: 0, maxDist: 6, behind: true, track: 0.2, clip: 'Attack', ...o });
const charge = (o: Partial<MoveDef>): MoveDef => ({ id: 'charge', name: '衝撞', shape: 'charge', range: 16, width: 2.6, windup: 1.15, active: 1.0, recover: 1.9, damage: 34, weight: 3, minDist: 7, maxDist: 30, maxOff: 0.5, track: 1.4, clip: 'Move', ...o });
const slam = (o: Partial<MoveDef>): MoveDef => ({ id: 'slam', name: '震地', shape: 'circle', range: 6, windup: 1.35, active: 0.25, recover: 2.1, damage: 40, weight: 4, minDist: 0, maxDist: 7, maxOff: 3.2, rageOnly: true, track: 0.3, clip: 'Attack', ...o });

export const MONSTERS: Record<string, MonsterDef> = {
  taotie: {
    id: 'taotie', name: '饕餮', title: '貪食之獸', model: 'taotie.glb', height: 3.4, modelHeight: 3.03,
    hp: 2400, power: 0.8, speed: 3.0, turnRate: 1.9, reach: 3.4, roarRadius: 8, stunAt: 150, tripAt: 260,
    parts: {
      head: { forward: 2.5, side: 0, radius: 1.0, cut: 1.0, blunt: 1.1, breakHp: 320 },
      body: { forward: 0, side: 0, radius: 1.7, cut: 0.55, blunt: 0.5, breakHp: 0 },
      legs: { forward: 1.2, side: 0, radius: 1.5, cut: 0.7, blunt: 0.65, breakHp: 380 },
      tail: { forward: -2.6, side: 0, radius: 0.9, cut: 0.85, blunt: 0.6, breakHp: 280, severs: true },
    },
    moves: [bite({}), sweep({}), charge({}), slam({})],
    drops: { common: '饕餮厚皮', head: '饕餮巨齒', tail: '饕餮尾', rare: '貪食之玉' },
  },
  qiongqi: {
    id: 'qiongqi', name: '窮奇', title: '翼虎', model: 'qiongqi.glb', height: 3.0, modelHeight: 1.99,
    hp: 3600, power: 1.3, speed: 4.2, turnRate: 2.6, reach: 3.6, roarRadius: 9, stunAt: 210, tripAt: 340,
    parts: {
      head: { forward: 2.7, side: 0, radius: 0.95, cut: 0.95, blunt: 1.05, breakHp: 420 },
      body: { forward: 0, side: 0, radius: 1.8, cut: 0.5, blunt: 0.5, breakHp: 0 },
      legs: { forward: 1.3, side: 0, radius: 1.5, cut: 0.65, blunt: 0.6, breakHp: 460 },
      tail: { forward: -2.9, side: 0, radius: 0.9, cut: 0.9, blunt: 0.55, breakHp: 360, severs: true },
    },
    moves: [
      bite({ windup: 0.62, damage: 24, range: 4.6, lunge: 2.4 }),
      sweep({ windup: 0.75, range: 5.6 }),
      charge({ name: '撲翼突進', windup: 0.95, range: 19, active: 0.85, damage: 36, weight: 4 }),
      slam({ name: '翼壓', range: 6.6, windup: 1.2 }),
      // Two bites in a row: the second comes when the first is dodged too early.
      bite({ id: 'bite2', name: '連咬', windup: 1.05, active: 0.2, recover: 0.7, damage: 28, weight: 3, range: 4.8, lunge: 2.6 }),
    ],
    drops: { common: '窮奇毛皮', head: '窮奇牙', tail: '窮奇尾', rare: '風虎之玉' },
  },
  xingtian: {
    id: 'xingtian', name: '刑天', title: '無首戰神', model: 'xingtian.glb', height: 8.5, modelHeight: 21.5,
    hp: 7200, power: 1.65, speed: 2.6, turnRate: 1.5, reach: 4.6, roarRadius: 11, stunAt: 320, tripAt: 420,
    parts: {
      // 刑天 has no head: its face is on its chest. The "head" is that face, reached when it is down or bends to strike.
      head: { forward: 1.6, side: 0, radius: 1.2, cut: 1.0, blunt: 1.0, breakHp: 620 },
      body: { forward: 0, side: 0, radius: 1.9, cut: 0.45, blunt: 0.45, breakHp: 0 },
      legs: { forward: 0.4, side: 0, radius: 2.3, cut: 0.75, blunt: 0.7, breakHp: 560 },
      tail: { forward: 2.8, side: 2.2, radius: 1.3, cut: 0.8, blunt: 0.6, breakHp: 480 }, // the axe arm
    },
    moves: [
      bite({ id: 'axe', name: '斧劈', shape: 'cone', range: 7.5, arcDeg: 50, lunge: 1.0, windup: 1.1, active: 0.3, recover: 1.5, damage: 34, weight: 5, maxDist: 9, clip: 'Attack' }),
      sweep({ id: 'shield', name: '盾掃', range: 6.5, windup: 0.95, damage: 28, clip: 'Skill' }),
      charge({ name: '踏陣', range: 15, width: 4, windup: 1.3, active: 1.2, recover: 2.2, damage: 38 }),
      slam({ name: '裂地', range: 8.5, windup: 1.5, recover: 2.4, damage: 44, clip: 'Skill' }),
      slam({ id: 'stomp', name: '踐踏', range: 5, windup: 0.9, recover: 1.3, damage: 26, rageOnly: false, weight: 3, maxDist: 5.5, clip: 'Attack' }),
    ],
    drops: { common: '戰神殘甲', head: '胸面之瞳', tail: '干戚碎片', rare: '不屈之魂' },
  },
};

export interface QuestDef {
  id: string;
  stars: number;
  name: string;
  monster: string;
  arena: string;
  text: string;
  coins: number;
  /** Quest ids that must be cleared first. */
  needs?: string;
}

export const QUESTS: QuestDef[] = [
  { id: 'q1', stars: 1, name: '竹原的貪食者', monster: 'taotie', arena: 'plain', text: '饕餮闖進了竹原，把存糧吃了個精光。在它吃到村子之前，把它討伐掉。', coins: 600 },
  { id: 'q2', stars: 2, name: '風裡的翼虎', monster: 'qiongqi', arena: 'dusk', text: '黃昏時山口有翼虎出沒。它比饕餮快得多，別貪刀。', coins: 1100, needs: 'q1' },
  { id: 'q3', stars: 3, name: '常羊山的無首者', monster: 'xingtian', arena: 'ash', text: '刑天以乳為目、以臍為口，操干戚而舞。腳是它的破綻。', coins: 2000, needs: 'q2' },
];

export interface GearDef {
  id: string;
  kind: 'weapon' | 'armor';
  name: string;
  attack?: number;
  defense?: number;
  coins: number;
  needs: Record<string, number>;
  from?: string;
}

export const GEAR: GearDef[] = [
  { id: 'w0', kind: 'weapon', name: '鐵柴刀', attack: 100, coins: 0, needs: {} },
  { id: 'w1', kind: 'weapon', name: '貪齒刀', attack: 132, coins: 400, needs: { 饕餮厚皮: 3, 饕餮巨齒: 1 }, from: 'w0' },
  { id: 'w2', kind: 'weapon', name: '風虎牙刀', attack: 168, coins: 900, needs: { 窮奇毛皮: 3, 窮奇牙: 2, 饕餮尾: 1 }, from: 'w1' },
  { id: 'w3', kind: 'weapon', name: '干戚．斷嶽', attack: 215, coins: 1800, needs: { 戰神殘甲: 4, 干戚碎片: 1, 窮奇尾: 1 }, from: 'w2' },
  { id: 'a0', kind: 'armor', name: '布衣', defense: 0, coins: 0, needs: {} },
  { id: 'a1', kind: 'armor', name: '厚皮甲', defense: 25, coins: 350, needs: { 饕餮厚皮: 4 }, from: 'a0' },
  { id: 'a2', kind: 'armor', name: '翼虎披', defense: 55, coins: 800, needs: { 窮奇毛皮: 4, 饕餮巨齒: 1 }, from: 'a1' },
  { id: 'a3', kind: 'armor', name: '戰神甲', defense: 90, coins: 1600, needs: { 戰神殘甲: 5, 窮奇牙: 1 }, from: 'a2' },
];

export interface Save {
  version: 1;
  coins: number;
  items: Record<string, number>;
  weapon: string;
  armor: string;
  owned: string[];
  cleared: Record<string, { best: number; times: number }>;
}

export const newSave = (): Save => ({ version: 1, coins: 0, items: {}, weapon: 'w0', armor: 'a0', owned: ['w0', 'a0'], cleared: {} });

export function loadSave(storage: Pick<Storage, 'getItem'> | undefined): Save {
  try {
    const raw = storage?.getItem('zhuda-hunt/save');
    const s = raw ? (JSON.parse(raw) as Save) : null;
    if (s && s.version === 1 && Array.isArray(s.owned)) return s;
  } catch {
    /* a broken save starts over */
  }
  return newSave();
}

export const gear = (id: string) => GEAR.find((g) => g.id === id)!;

export function loadoutOf(save: Save) {
  return { attack: gear(save.weapon).attack ?? 100, defense: gear(save.armor).defense ?? 0, potions: 5 };
}

/** Why a piece cannot be forged, or '' when it can. */
export function forgeBlock(save: Save, g: GearDef): string {
  if (save.owned.includes(g.id)) return '已持有';
  if (g.from && !save.owned.includes(g.from)) return `需要先有${gear(g.from).name}`;
  if (save.coins < g.coins) return '金幣不足';
  for (const [item, n] of Object.entries(g.needs)) if ((save.items[item] ?? 0) < n) return `缺 ${item}`;
  return '';
}

export function forge(save: Save, id: string): boolean {
  const g = gear(id);
  if (forgeBlock(save, g)) return false;
  save.coins -= g.coins;
  for (const [item, n] of Object.entries(g.needs)) save.items[item] -= n;
  save.owned.push(g.id);
  if (g.kind === 'weapon') save.weapon = g.id;
  else save.armor = g.id;
  return true;
}

export function questOpen(save: Save, q: QuestDef): boolean {
  return !q.needs || !!save.cleared[q.needs];
}

export function grant(save: Save, q: QuestDef, loot: Record<string, number>, seconds: number): void {
  save.coins += q.coins;
  for (const [item, n] of Object.entries(loot)) save.items[item] = (save.items[item] ?? 0) + n;
  const c = (save.cleared[q.id] ??= { best: seconds, times: 0 });
  c.best = Math.min(c.best, seconds);
  c.times += 1;
}
