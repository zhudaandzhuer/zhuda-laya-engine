// How the pictures in ../preview were taken: the 2D viewer's spine-tights preset, driven with a
// real mouse in Chrome on the graphics card. From prefabs/viewer2d, after `npm run build`:
//
//   node ../../games/tools/shot.mjs . --gpu --hook __SCENE__ --size 600x900 \
//     --query "scene=spine-tights" --script ../2d/spine-tights/source/look-book.mjs --out <dir> --name look-book
//
// Every step reads the page's hook for what happened and fails loudly when a drag did not do
// what it was for: a tear by pulling (small, then large), the skirt lifted by its hem and let
// go, and the double tap that mends everything.
export default async ({ page, shot, state, sleep, log }) => {
  const S = (source, arg) => page.evaluate(new Function('arg', `const S = window.__SCENE__; return (${source})(S, arg);`), arg);
  const stats = async () => (await state()).state;
  const sites = await S('(S) => S.sites');
  const pageOf = (x, y) => S('(S, p) => S.toPage(p[0], p[1])', [x, y]);
  const scale = (await pageOf(100, 0))[0] - (await pageOf(0, 0))[0]; // page pixels to a hundred canvas pixels
  const site = (name) => sites.find((s) => s.name === name);
  /** Presses a point of the canvas and drags by (dx, dy) canvas pixels in `steps` moves; the mouse stays down. */
  const pressAndDrag = async (x, y, dx, dy, steps = 24) => {
    const [px, py] = await pageOf(x, y);
    await page.mouse.move(px, py);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(px + ((dx * i) / steps) * (scale / 100), py + ((dy * i) / steps) * (scale / 100));
      await sleep(16);
    }
  };
  const tearByPulling = async (name, dx, dy) => {
    const s = site(name),
      before = (await stats()).tears;
    await pressAndDrag(s.x, s.y, dx, dy);
    await page.mouse.up();
    const after = (await stats()).tears;
    if (after.join() === before.join()) throw Error(`no tear at ${name}: ${JSON.stringify(await stats())}`);
    log({ pulled: name, tears: after });
    await sleep(700);
  };

  await sleep(1200);
  await shot('as-worn');

  // A pull that stops short stretches the nylon and lets it spring back whole.
  const knee = site('R_knee');
  await pressAndDrag(knee.x, knee.y, 60, 40, 12);
  await sleep(250);
  const stretched = await stats();
  await shot('stretched');
  await page.mouse.up();
  if (stretched.held !== 'leg' || !(Math.max(...stretched.pulls) > 20) || stretched.tears.length) throw Error(`the nylon did not stretch: ${JSON.stringify(stretched)}`);
  await sleep(900);
  const sprung = await stats();
  log({ stretch: { held: stretched.held, farthestPull: Math.max(...stretched.pulls), afterRelease: Math.max(...sprung.pulls), tears: sprung.tears } });
  if (!(Math.max(...sprung.pulls) < 1.5)) throw Error(`the nylon did not spring back: ${JSON.stringify(sprung)}`);

  // Tears: the left knee twice (a small hole, then a large one), the right calf once.
  await tearByPulling('L_knee', -150, 120);
  await tearByPulling('L_knee', -150, 120);
  await tearByPulling('R_calf', 150, 110);
  await shot('torn');
  const torn = (await stats()).tears;
  if (torn.join() !== 'L_knee:2,R_calf:1') throw Error(`tears are ${torn}`);

  // The skirt sways by itself (the rig's idle: four seconds a cycle), so its hem has no one resting
  // place: its range over one cycle is what "back" means.
  const idle = [];
  for (let i = 0; i < 18; i++) {
    await sleep(250);
    idle.push(await S('(S) => S.hem(4)'));
  }
  const range = { x: [Math.min(...idle.map((p) => p[0])), Math.max(...idle.map((p) => p[0]))], y: [Math.min(...idle.map((p) => p[1])), Math.max(...idle.map((p) => p[1]))] };
  const within = (p, slack = 4) => p[0] > range.x[0] - slack && p[0] < range.x[1] + slack && p[1] > range.y[0] - slack && p[1] < range.y[1] + slack;
  // The middle pleat's hem taken up and to the side, held, let go.
  const before = await S('(S) => [0, 4, 8].map((c) => S.hem(c))');
  const [hx, hy] = before[1];
  await pressAndDrag(hx, hy - 25, 40, -230, 30);
  await sleep(700);
  const lifted = await S('(S) => [0, 4, 8].map((c) => S.hem(c))');
  const during = await stats();
  await shot('skirt-lifted');
  await page.mouse.up();
  log({ lift: { held: during.held, mix: during.mix, idleRange: { x: range.x.map(Math.round), y: range.y.map(Math.round) }, middleHemBefore: before[1].map(Math.round), middleHemHeld: lifted[1].map(Math.round), sideHemsMoved: [0, 2].map((k) => Math.round(Math.hypot(lifted[k][0] - before[k][0], lifted[k][1] - before[k][1]))) } });
  if (during.held !== 'skirt' || !(before[1][1] - lifted[1][1] > 120)) throw Error(`the hem did not rise: ${JSON.stringify({ before: before[1], lifted: lifted[1], during })}`);
  // Let go: sampled every tenth of a second; it is back once it is inside the idle's range and stays there.
  const swing = [];
  for (let i = 0; i < 30; i++) {
    await sleep(100);
    swing.push(await S('(S) => S.hem(4)'));
  }
  const lastOutside = swing.findLastIndex((p) => !within(p));
  log({ release: { backWithinSeconds: +((lastOutside + 2) * 0.1).toFixed(1), firstSecond: swing.slice(0, 10).map((p) => p.map(Math.round)), mix: (await stats()).mix } });
  await shot('skirt-settled');
  if (lastOutside > 14) throw Error(`the hem was still outside its idle range ${JSON.stringify(range)} after ${(lastOutside + 1) / 10} s: ${JSON.stringify(swing.map((p) => p.map(Math.round)))}`);

  // Two taps on the background mend everything.
  const [bx, by] = await pageOf(120, 1300);
  await page.mouse.click(bx, by);
  await sleep(120);
  await page.mouse.click(bx, by);
  await sleep(400);
  const mended = (await stats()).tears;
  log({ doubleTap: { tears: mended } });
  if (mended.length) throw Error(`still torn after a double tap: ${mended}`);
  await shot('mended');

  // Every site at its small hole and at its large one (set through the hook, no drag).
  for (const size of [1, 2]) {
    for (const s of sites) for (let k = 0; k < size; k++) await S('(S, name) => S.set({ tear: name })', s.name);
    await sleep(400);
    await shot(size === 1 ? 'all-small' : 'all-large');
    log({ allTorn: (await stats()).tears });
    await S('(S) => S.set({ reset: true })');
  }
  log({ spine: (await stats()).spine, renderer: (await stats()).renderer, inputError: (await stats()).inputError ?? null });
};
