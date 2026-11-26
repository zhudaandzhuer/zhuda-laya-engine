// Recorded runs for games/tools/shot.mjs.
//   hands: node ../tools/shot.mjs . --query "fresh=1&seed=7" --size 540x960 --script tools/play.mjs --out play-out/hands --name hands
//          (clicks level 1, makes a refused drag, then real drags of the hinted move until the level ends)
//   bot:   node ../tools/shot.mjs . --query "level=4&seed=3&auto=1&fresh=1" --size 540x960 --script tools/play.mjs --out play-out/bot --name bot
export default async ({ page, shot, state, sleep, log }) => {
  let s = await state();
  const settle = async () => {
    for (let i = 0; i < 80; i++) {
      await sleep(120);
      s = await state();
      if (s.error) throw Error(s.error);
      if (s.screen === 'result' || (s.game && !s.game.busy)) return;
    }
    throw Error('the board never settled');
  };
  const drag = async (a, b) => {
    const [ax, ay] = s.cells[a], [bx, by] = s.cells[b];
    await page.mouse.move(ax, ay);
    await page.mouse.down();
    await page.mouse.move((ax + bx) / 2, (ay + by) / 2, { steps: 3 });
    await page.mouse.move(bx, by, { steps: 3 });
    await page.mouse.up();
  };
  if (s.screen === 'title') {
    await sleep(400);
    await shot('00-title');
    await page.mouse.click(...s.hot['level-0']);
    await settle();
    await shot('01-board');
    // A drag that lines nothing up comes back and costs nothing: find one by trying pairs that are not the hint.
    const before = s.game.movesLeft;
    const hint = s.game.hint;
    const dull = [0, 1, 2, 3, 8, 9].find((i) => i !== hint[0] && i + 1 !== hint[1]);
    await drag(dull, dull + 1);
    await settle();
    log({ refusedDrag: [dull, dull + 1], refused: s.game.refused, movesLeft: s.game.movesLeft, before });
    for (let n = 0; n < 40 && s.screen === 'play'; n++) {
      const [a, b] = s.game.hint;
      const moves = s.game.moves;
      if (n % 2) await drag(a, b);
      else (await page.mouse.click(...s.cells[a]), await sleep(80), await page.mouse.click(...s.cells[b]));
      await sleep(200);
      if (n === 1) await shot('02-mid-move');
      await settle();
      if (s.screen === 'play' && s.game.moves !== moves + 1) throw Error(`move ${n} (${a}→${b}) was not taken`);
      if (n === 5) await shot('03-playing');
    }
    await sleep(500);
    await shot('04-result');
    log({ end: s.game, best: s.best });
    if (s.screen !== 'result') throw Error('the level did not end');
    return;
  }
  for (let i = 0, n = 0; i < 400; i++) {
    s = await state();
    if (s.error) throw Error(s.error);
    if (s.screen === 'result') break;
    if (i % 14 === 6 && n < 4) await shot(`0${n++}-score${s.game.score}`);
    await sleep(250);
  }
  await sleep(500);
  await shot('09-result');
  log({ end: s.game, best: s.best });
  if (s.screen !== 'result') throw Error('the bot did not finish');
};
