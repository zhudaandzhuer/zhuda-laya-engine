export default async ({ page, shot, state, sleep, log }) => {
  const set = (o) => page.evaluate((o) => window.__SCENE__.set(o), o);
  await sleep(500);
  log({ opened: (await state()).state.clips.length });
  const tips = () => page.evaluate(() => ['ear.L.tip', 'ear.R.tip', 'tail.tip', 'head'].map((n) => window.__SCENE__.where(n)));
  for (const [clip, yaw, times] of [['Dance', 0.5, [0.4, 0.9, 1.4]], ['Shake', Math.PI - 0.7, [0.25, 0.5, 0.75]], ['Walk', Math.PI / 2, [0.1, 0.3]], ['Cheer', 0.3, [0.15, 0.3]]]) {
    await set({ clip, fade: 0, yaw, pitch: 0.15 });
    for (const t of times) { await set({ freeze: t }); await sleep(250); await shot(`${clip}-${String(t).replace('.', '_')}`); log({ clip, t, tips: await tips() }); }
  }
  // Playing, not frozen: how far the left ear's tip goes from the head over two seconds of the idle.
  await set({ clip: 'Idle', fade: 0, freeze: null, yaw: 0.5 });
  const gaps = [];
  for (let i = 0; i < 20; i++) { await sleep(100); const [ear, , , head] = await tips(); gaps.push(+Math.hypot(ear[0] - head[0], ear[1] - head[1], ear[2] - head[2]).toFixed(4)); }
  log({ idleEarToHead: gaps, range: +(Math.max(...gaps) - Math.min(...gaps)).toFixed(4), rendererErrors: (await state()).rendererErrors });
};
