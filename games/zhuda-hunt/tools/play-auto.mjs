// A recorded run for games/tools/shot.mjs: a bot hunts (?auto=…&speed=…), a picture every few
// seconds and at each new state of the monster, until the result screen.
//   node ../tools/shot.mjs . --query "quest=q1&auto=legs&speed=6&seed=3" --script tools/play-auto.mjs --out play-out/q1 --name q1
export default async ({ page, shot, state, sleep }) => {
  const seen = new Set();
  let n = 0, last = 0;
  for (let i = 0; i < 900; i++) {
    const s = await state();
    if (s.error) throw Error(s.error);
    if (s.screen === 'result') break;
    const key = s.hunt ? `${s.hunt.state}${s.hunt.enraged ? '-rage' : ''}` : s.screen;
    if (!seen.has(key) || Date.now() - last > 20000) {
      seen.add(key);
      last = Date.now();
      await shot(`${String(n++).padStart(2, '0')}-${key}`);
    }
    await sleep(400);
  }
  await sleep(1200);
  await shot(`${String(n++).padStart(2, '0')}-result`);
  await page.click('[data-go="hub"]');
  await sleep(1500);
  await shot(`${String(n++).padStart(2, '0')}-hub`);
};
