// The same still states on the original page (window.__TEAR2D__) and on the module in the viewer (window.__SCENE__).
export default async ({ page, shot, sleep, log }) => {
  const names = ['L_thigh', 'L_lowthigh', 'L_knee', 'L_calf', 'L_shin', 'R_thigh', 'R_lowthigh', 'R_knee', 'R_calf', 'R_shin'];
  const tear = (name) => page.evaluate((n) => (window.__SCENE__ ? window.__SCENE__.set({ tear: n }) : window.__TEAR2D__.api.tear(n)), name);
  const reset = () => page.evaluate(() => (window.__SCENE__ ? window.__SCENE__.set({ reset: true }) : window.__TEAR2D__.api.reset()));
  await sleep(3500); // the original has no signal for its splash
  await shot('as-worn');
  for (const size of [1, 2]) {
    for (const n of names) for (let k = 0; k < size; k++) await tear(n);
    await sleep(500);
    await shot(size === 1 ? 'all-small' : 'all-large');
    await reset();
  }
};
