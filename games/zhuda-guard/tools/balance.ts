// node tools/balance.ts : how the careful builder and three one-idea builders fare, wave by wave.
import { Game, PADS, botBuild, type TowerKind } from '../src/core/td.ts';
const only = (kind: TowerKind) => (g: Game) => {
  for (let pad = 0; pad < PADS.length; pad++) g.build([1, 4, 3, 6, 0, 8, 5, 9, 7, 2, 10, 11][pad], kind);
  for (const t of [...g.towers]) g.upgrade(t.pad);
};
for (const [name, build] of [['careful', botBuild], ['arrow', only('arrow')], ['fire', only('fire')], ['frost', only('frost')]] as const) {
  const g = new Game();
  const row: string[] = [];
  while (g.state === 'build' || g.state === 'wave') {
    if (g.state === 'build') (build(g), row.push(`${g.wave + 1}:${g.lives}/${g.towers.length}t/${g.coins}c`), g.send());
    g.step();
  }
  console.log(name.padEnd(8), g.state, 'wave', g.wave + (g.state === 'won' ? 0 : 1), 'lives', g.lives, 'kills', g.kills, '|', row.join(' '));
}
