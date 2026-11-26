// Measures draw calls against tokens on screen (a bot's run at ?speed=6), for the batching note in README.
export default async ({ state, sleep, log }) => {
  const rows = [];
  for (let i = 0; i < 400; i++) {
    const s = await state();
    if (s.screen === 'result' || !s.run) break;
    rows.push([Math.round(s.run.time), s.run.enemies, s.draws, s.fx, s.zones, s.run.weapons]);
    await sleep(250);
  }
  const at = (lo, hi) => rows.filter((r) => r[1] >= lo && r[1] < hi).map((r) => r[2]);
  const mean = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y) / a.length) : null);
  log({ rows: rows.filter((_, i) => i % 6 === 0) });
  log({ draws: { under50: mean(at(0, 50)), to150: mean(at(50, 150)), to300: mean(at(150, 300)), over300: mean(at(300, 999)) }, samples: rows.length, max: Math.max(...rows.map((r) => r[2])) });
};
