// node tools/bots.ts : a table of every quest against every bot, over eight seeds.
import { careful, masher, run } from '../src/core/bots.ts';
{
  const gear = { taotie: [100, 0], qiongqi: [132, 25], xingtian: [168, 55] } as Record<string, number[]>;
  for (const [monster, [attack, defense]] of Object.entries(gear)) {
    for (const [name, make] of [['masher', () => masher], ['careful-legs', () => careful('legs')], ['careful-head', () => careful('head')]] as const) {
      const rows = Array.from({ length: 8 }, (_, s) => run(monster, { attack, defense, potions: 5 }, make(), s + 1));
      const wins = rows.filter((r) => r.result === 'won');
      console.log(monster.padEnd(9), name.padEnd(13), `wins ${wins.length}/8`, `avg ${Math.round(wins.reduce((s, r) => s + r.seconds, 0) / Math.max(1, wins.length))}s`,
        `faints ${rows.map((r) => r.faints).join('')}`, `hurt ${Math.round(rows.reduce((s, r) => s + (r.counts.hurt ?? 0), 0) / 8)}`, `breaks ${(rows.reduce((s, r) => s + (r.counts.break ?? 0), 0) / 8).toFixed(1)}`);
    }
  }
}
