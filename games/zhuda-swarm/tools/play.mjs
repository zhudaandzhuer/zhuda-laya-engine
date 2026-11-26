// A recorded run for games/tools/shot.mjs.
//   bot:   node ../tools/shot.mjs . --query "auto=1&speed=5&seed=5&fresh=1" --script tools/play.mjs --out play-out/bot --name bot
//   hands: node ../tools/shot.mjs . --query "seed=5&fresh=1&speed=3" --script tools/play.mjs --out play-out/hands --name hands
// With ?auto the bot steers and chooses. Without, the script starts from the title with a real click,
// steers with the keys in a circle and clicks an upgrade card each level.
export default async ({ page, shot, state, sleep, log }) => {
  let s = await state();
  const hands = s.screen === 'title';
  if (hands) {
    await sleep(1500);
    await shot('00-title');
    await page.mouse.click(...s.hot.start);
  }
  const marks = [5, 30, 70, 120, 180, 245, 290];
  let n = 1, t0 = Date.now(), key = 0, picked = 0;
  const KEYS = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
  for (;;) {
    s = await state();
    if (s.error) throw Error(s.error);
    if (s.screen === 'result') break;
    if (s.screen === 'choose') {
      if (picked++ === 2) await shot(`${String(n++).padStart(2, '0')}-choose`);
      await page.mouse.click(...s.hot['choice-0']);
      await sleep(150);
      continue;
    }
    if (hands && s.screen === 'play') {
      const k = Math.floor((Date.now() - t0) / 900) % 4;
      if (k !== key) (await page.keyboard.up(KEYS[key]), (key = k));
      await page.keyboard.down(KEYS[key]);
    }
    if (s.run && marks.length && s.run.time >= marks[0]) {
      marks.shift();
      await shot(`${String(n++).padStart(2, '0')}-t${Math.round(s.run.time)}`);
      log({ t: s.run.time, enemies: s.run.enemies, draws: s.draws, level: s.run.level, kit: s.run.weapons });
    }
    if (Date.now() - t0 > 780000) throw Error('too slow');
    await sleep(120);
  }
  await sleep(800);
  await shot(`${String(n++).padStart(2, '0')}-result`);
  s = await state();
  log({ end: s.run, payout: s.payout, maxDraws: s.maxDraws });
  await page.mouse.click(...s.hot.home);
  await sleep(1200);
  await shot(`${String(n++).padStart(2, '0')}-title-after`);
};
