// A recorded first session for games/tools/shot.mjs: real clicks on the canvas at the places the
// game reports for its controls (window.__GAME__.hot), from a new save to the first wall.
//   node ../tools/shot.mjs . --size 540x960 --query "fresh=1&fast=1" --script tools/play.mjs --out play-out/first --name first
export default async ({ page, shot, state, sleep, log }) => {
  const click = async (name, pause = 500) => {
    const s = await state();
    const p = s.hot[name];
    if (!p) throw Error(`no control ${name} on ${s.screen}: ${Object.keys(s.hot)}`);
    await page.mouse.click(p[0], p[1]);
    await sleep(pause);
  };
  const until = async (test, what, ms = 60000) => {
    const t0 = Date.now();
    for (;;) {
      const s = await state();
      if (s.error) throw Error(s.error);
      if (test(s)) return s;
      if (Date.now() - t0 > ms) throw Error(`timed out waiting for ${what}`);
      await sleep(200);
    }
  };
  await shot('01-new-save');
  await click('tab-gifts');
  await click('login', 900);
  await shot('02-sign-in');
  let s = await state();
  log({ step: 'login', tickets: s.save.tickets });
  if (s.save.tickets !== 10) throw Error('the first sign-in did not give ten tickets');
  await click('tab-summon');
  await shot('03-summon');
  await click('pull-10', 300);
  await until((x) => x.hot['reveal-ok'], 'the reveal to finish');
  await sleep(600);
  await shot('04-ten-pull');
  s = await state();
  log({ step: 'pull', pulls: s.lastPulls.map((p) => `${p.rarity}:${p.id}${p.isNew ? '*' : ''}`), heroes: Object.keys(s.save.heroes).length });
  await click('reveal-ok');
  await click('tab-heroes');
  await click('best-team');
  await click('level-all', 900);
  await shot('05-heroes');
  s = await state();
  const first = Object.keys(s.hot).find((k) => k.startsWith('hero-'));
  await click(first);
  await shot('06-hero-detail');
  await click('back');
  await click('tab-battle');
  await click('fight', 300);
  await sleep(700);
  await shot('07-fighting');
  await until((x) => x.lastBattle && x.hot.fight, 'the first battle');
  await click('auto', 300);
  // Auto-push until it stops at the wall.
  await until((x) => x.hot.fight && x.lastBattle && (!x.lastBattle.win || x.power < x.stagePower * 0.85), 'the wall', 240000);
  await sleep(1500);
  await shot('08-wall');
  s = await state();
  log({ step: 'wall', stage: s.save.stage, power: s.power, stagePower: s.stagePower });
  await page.evaluate(() => window.__skip(3));
  await sleep(1300);
  await shot('09-three-hours-later');
  await click('claim', 900);
  await click('tab-tasks');
  s = await state();
  for (const k of Object.keys(s.hot).filter((k) => k.startsWith('task-'))) await click(k, 400);
  await shot('10-tasks');
  await click('tab-heroes');
  await click('level-all', 600);
  await click('tab-battle');
  await click('fight', 300);
  await until((x) => x.lastBattle && x.hot.fight && x.save.stage > s.save.stage, 'a win after idling', 60000).catch(() => {});
  await sleep(800);
  await shot('11-after-idling');
  const end = await state();
  log({ step: 'end', stage: end.save.stage, vip: end.save.vipExp, coins: end.save.coins, effects: end.effects, sound: end.sound?.lastError ?? null });
};
