// Bot hunters for balance tests and recorded runs: each reads the hunt and returns a stick and
// presses buttons, exactly as a player's hands would (through Hunt.press and the step's input).
import { Hunt, HUNTER_MOVES, partPosition, type HuntInput } from './hunt.ts';

export type Bot = (hunt: Hunt) => HuntInput;

const towards = (fx: number, fz: number, tx: number, tz: number, scale = 1): HuntInput => {
  const dx = tx - fx, dz = tz - fz, d = Math.hypot(dx, dz) || 1;
  return { mx: (dx / d) * scale, mz: (dz / d) * scale };
};

/** Never rolls, never backs off: swings whenever something is in reach. */
export const masher: Bot = (hunt) => {
  const h = hunt.hunter, m = hunt.monster;
  const p = partPosition(m, 'body');
  const d = Math.hypot(p.x - h.x, p.z - h.z);
  if (d < p.r + 1.8) hunt.press('light');
  if (h.hp < 40 && !h.action) hunt.press('potion');
  return towards(h.x, h.z, p.x, p.z);
};

/** Reads the windup: rolls through strikes at the last moment, punishes recoveries, heals when safe. */
export function careful(target: 'head' | 'legs' | 'tail' = 'legs'): Bot {
  let combo = 0;
  return (hunt) => {
    const h = hunt.hunter, m = hunt.monster;
    const aim = partPosition(m, m.state === 'stun' || m.state === 'topple' ? 'head' : target);
    const d = Math.hypot(aim.x - h.x, aim.z - h.z);
    const body = Math.hypot(m.x - h.x, m.z - h.z);
    const open = m.state === 'recover' || m.state === 'stun' || m.state === 'topple' || m.state === 'flinch';
    const move = m.move;
    if ((m.state === 'windup' || m.state === 'roar') && body < (move ? move.range + 2.5 : m.def.roarRadius)) {
      // Roll so that the invulnerable frames (3..17 of 34) cover the strike's first frames.
      const left = m.state === 'roar' ? 0.5 - m.t : m.span - m.t;
      if (left <= 0.13 && left > -0.05 && h.stamina >= HUNTER_MOVES.dodge.stamina) {
        hunt.press('dodge');
        // Sideways to the monster's facing, for a charge; through it otherwise.
        const side = m.yaw + Math.PI / 2;
        return move?.shape === 'charge' ? { mx: Math.sin(side), mz: Math.cos(side) } : towards(h.x, h.z, m.x, m.z);
      }
      // While waiting: stop swinging; a short combo may still finish.
      if (left > 0.75 && d < aim.r + 1.7 && !h.action) hunt.press('light');
      return d > aim.r + 1.4 ? towards(h.x, h.z, aim.x, aim.z, 0.6) : { mx: 0, mz: 0 };
    }
    if (m.state === 'active') return { mx: 0, mz: 0 };
    if (h.hp < 45 && h.potions > 0 && !h.action && (open ? m.span - m.t > 1.7 : body > 9)) hunt.press('potion');
    if (h.hp < 45 && h.potions > 0 && !open && body < 9 && !h.action) return towards(m.x, m.z, h.x, h.z); // back off to drink
    if (d < aim.r + 1.6) {
      const left = open ? m.span - m.t : 0.6;
      if (!h.action) combo = 0;
      // A finisher only when the opening is long enough for it.
      if (m.state === 'topple' || m.state === 'stun' ? left > 1.3 : left > 0.9) {
        if (!h.action && (m.state === 'topple' || m.state === 'stun') && left > 1.4) hunt.press('heavy');
        else hunt.press('light');
        combo += 1;
      } else if (!h.action && m.state === 'roam') hunt.press('light');
      return towards(h.x, h.z, aim.x, aim.z, 0.3);
    }
    return towards(h.x, h.z, aim.x, aim.z);
  };
}

export function run(monster: string, loadout: { attack: number; defense: number; potions: number }, bot: Bot, seed = 1) {
  const hunt = new Hunt(monster, loadout, seed);
  const counts: Record<string, number> = {};
  while (hunt.result === 'running') for (const e of hunt.step(bot(hunt))) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return { hunt, counts, seconds: Math.round(hunt.time), result: hunt.result, faints: hunt.hunter.faints };
}

