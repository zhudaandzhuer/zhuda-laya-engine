// Recorded runs for games/tools/shot.mjs.
//   keys: node ../tools/shot.mjs . --query "fresh=1" --script tools/play.mjs --out play-out/keys --name keys
//         (clicks the first level on the title, runs right and jumps with real key presses, checks that it moved and rose)
//   bot:  node ../tools/shot.mjs . --query "level=3&auto=1&fresh=1" --script tools/play.mjs --out play-out/bot --name bot
export default async ({ page, shot, state, sleep, log }) => {
  let s = await state();
  if (s.screen === 'title') {
    await sleep(500);
    await shot('00-title');
    await page.mouse.click(...s.hot['level-0']);
    await sleep(700);
    const before = (await state()).game;
    await page.keyboard.down('ArrowRight');
    await sleep(500);
    await page.keyboard.down('Space');
    let top = before.y;
    for (let i = 0; i < 12; i++) (await sleep(40), (top = Math.min(top, (await state()).game.y)));
    await page.keyboard.up('Space');
    await shot('01-jumping');
    await sleep(900);
    await page.keyboard.up('ArrowRight');
    const after = (await state()).game;
    log({ before, top, after });
    if (!(after.x > before.x + 2)) throw Error('the arrow key did not move 豬大');
    if (!(top < before.y - 0.8)) throw Error('the space key did not make it jump');
    await shot('02-after');
    return;
  }
  for (let i = 0, n = 0; i < 600; i++) {
    s = await state();
    if (s.error) throw Error(s.error);
    if (s.screen === 'result') break;
    if (i % 12 === 5 && n < 6) await shot(`${String(n++).padStart(2, '0')}-x${Math.round(s.game.x)}`);
    await sleep(250);
  }
  await sleep(500);
  await shot('09-result');
  s = await state();
  log({ end: s.game, best: s.best });
  if (s.game.state !== 'won') throw Error(`the bot did not finish: ${s.game.state} at x ${s.game.x}`);
};
