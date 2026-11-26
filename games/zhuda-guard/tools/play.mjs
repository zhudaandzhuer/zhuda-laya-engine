// Recorded runs for games/tools/shot.mjs.
//   bot:   node ../tools/shot.mjs . --size 960x540 --query "auto=1&speed=6" --script tools/play.mjs --out play-out/bot --name bot
//   hands: node ../tools/shot.mjs . --size 960x540 --query "speed=4" --script tools/play.mjs --out play-out/hands --name hands
// Without ?auto the script clicks the title, clicks pads and menu buttons to build and upgrade, and sends three waves.
export default async ({ page, shot, state, sleep, log }) => {
  let s = await state();
  if (s.screen === 'title') {
    await sleep(800);
    await shot('00-title');
    await page.click('[data-go]');
    await sleep(600);
    const build = async (pad, what) => {
      await page.click(`.pad[data-pad="${pad}"]`);
      await sleep(200);
      if (pad === 1 && what === 'build:arrow') await shot('01-menu');
      await page.click(`#menu [data-do="${what}"]`);
      await sleep(200);
    };
    await build(1, 'build:arrow');
    await build(4, 'build:arrow');
    await build(3, 'build:frost');
    s = await state();
    log({ built: s.game.towers, coins: s.game.coins });
    if (s.game.towers !== '1:arrow1 4:arrow1 3:frost1') throw Error(`towers ${s.game.towers}`);
    for (let w = 0; w < 3; w++) {
      await page.click('#send');
      for (let i = 0; i < 600; i++) {
        s = await state();
        if (s.error) throw Error(s.error);
        if (s.game.state !== 'wave' && i > 3) break;
        if (i === 30) await shot(`0${w + 2}-wave${w + 1}`);
        await sleep(250);
      }
      log({ wave: w + 1, lives: s.game.lives, coins: s.game.coins, kills: s.game.kills, draws: s.draws, triangles: s.triangles });
      if (w === 0) await build(1, 'up');
      if (w === 1) await build(6, 'build:fire');
    }
    s = await state();
    log({ end: s.game });
    return;
  }
  let n = 0, last = -1;
  for (let i = 0; i < 3000; i++) {
    s = await state();
    if (s.error) throw Error(s.error);
    if (s.screen === 'result') break;
    if (s.game && s.game.wave !== last && s.game.state === 'wave' && s.game.enemies > 3) {
      last = s.game.wave;
      if ([0, 3, 6, 8, 10, 11].includes(last)) (await sleep(1500), await shot(`${String(n++).padStart(2, '0')}-wave${last + 1}`));
      log({ wave: last + 1, lives: s.game.lives, towers: s.game.towers, draws: s.draws, triangles: s.triangles, enemies: s.game.enemies, shown: s.game.shown });
    }
    await sleep(300);
  }
  await sleep(600);
  await shot(`${String(n++).padStart(2, '0')}-result`);
  s = await state();
  log({ end: s.game, stars: s.stars, maxDraws: s.maxDraws });
};
