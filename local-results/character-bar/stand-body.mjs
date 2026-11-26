// The same moments of the same clips, for whichever file the page was opened with.
export default async ({ page, shot, state, sleep, log }) => {
  const set = (o) => page.evaluate((o) => window.__SCENE__.set(o), o);
  await sleep(600);
  log({ opened: (await state()).state });
  await set({ yaw: 0.6, pitch: 0.12 });
  for (const [clip, times] of [['Walk', [0.1, 0.35, 0.6, 0.85]], ['Run', [0.1, 0.3, 0.5]], ['Greet', [0.5, 1.0]], ['Idle', [0.8, 2.4]]]) {
    await set({ clip, fade: 0 });
    for (const t of times) { await set({ freeze: t }); await sleep(250); await shot(`${clip}-${String(t).replace('.', '_')}`); }
  }
  // From behind and the side: the hair and the back of the robe.
  await set({ clip: 'Run', fade: 0 }); await set({ yaw: Math.PI - 0.5, freeze: 0.3 }); await sleep(250); await shot('Run-back-0_3');
  await set({ clip: 'Walk', fade: 0 }); await set({ yaw: Math.PI / 2, freeze: 0.6 }); await sleep(250); await shot('Walk-side-0_6');
  // A cross-fade in seconds, playing: where the left hand is every 60 ms across it.
  await set({ clip: 'Idle', fade: 0, freeze: null, yaw: 0.6 }); await sleep(700);
  await set({ clip: 'Walk', fade: 0.18 });
  const path = [];
  for (let i = 0; i < 8; i++) { path.push(await page.evaluate(() => window.__SCENE__.where('handL'))); await sleep(60); }
  log({ crossFade: path });
  log({ end: (await state()).state.clip, errors: (await state()).rendererErrors });
};
