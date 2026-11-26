// Recorded runs for games/tools/shot.mjs.
//   keys: node ../tools/shot.mjs . --query "fresh=1" --size 540x960 --timeout 120000 --script tools/play.mjs --out play-out/keys --name keys
//         (clicks the first song, presses real keys at the times the page publishes, pauses with Esc half way,
//          checks the song's time stood still, resumes, plays to the end)
//   bot:  node ../tools/shot.mjs . --query "song=2&hard=1&auto=1&fresh=1" --size 540x960 --timeout 120000 --script tools/play.mjs --out play-out/bot --name bot
const KEYS = ['d', 'f', 'j', 'k'];
export default async ({ page, shot, state, sleep, log }) => {
  let s = await state();
  if (s.screen !== 'title') {
    for (let i = 0, n = 0; i < 400; i++) {
      s = await state();
      if (s.error) throw Error(s.error);
      if (s.screen === 'result') break;
      if (i % 20 === 10 && n < 3) await shot(`0${n++}-t${Math.round(s.game.time)}`);
      await sleep(250);
    }
    await sleep(400);
    await shot('09-result');
    log({ end: s.game, mixMs: s.mixMs });
    if (s.screen !== 'result' || s.game.rank !== 'S' || s.game.bestCombo !== s.game.notes) throw Error('exact taps did not rank S with a full combo');
    return;
  }
  for (let i = 0; i < 100 && s.songsReady < 2; i++) (await sleep(200), (s = await state()));
  log({ mixMs: s.mixMs, songsReady: s.songsReady });
  await shot('00-title');
  await page.mouse.click(...s.hot['song-0-0']);
  await sleep(300);
  // Page clock → this process's clock.
  const sync = async () => {
    const a = Date.now(), p = await page.evaluate(() => performance.now()), b = Date.now();
    return (a + b) / 2 - p;
  };
  // Presses each remaining note at the time the page says it is due, looking again shortly before:
  // the page moves its clock onto the audio clock once the song sounds.
  const done = new Set();
  let shots = 0;
  const pressAll = async (skew, stopAfter = Infinity) => {
    for (;;) {
      s = await state();
      if (s.error) throw Error(s.error);
      const left = s.schedule.filter((n) => !done.has(n[2]));
      if (s.screen !== 'play' || !left.length || done.size >= stopAfter) return;
      const group = left.filter((n) => n[1] === left[0][1]);
      const wait = left[0][1] + skew - Date.now();
      if (wait > 120) {
        await sleep(wait - 80);
        continue;
      }
      if (wait > 0) await sleep(wait);
      await Promise.all(group.map((n) => page.keyboard.press(KEYS[n[0]])));
      for (const n of group) done.add(n[2]);
      if (done.size >= 12 && !shots++) await shot('01-playing');
    }
  };
  s = await state();
  const notes = s.game.notes;
  let skew = await sync();
  await pressAll(skew, Math.floor(notes / 2));
  const played = done.size;
  await page.keyboard.press('Escape');
  await sleep(200);
  const p1 = (await state()).game;
  await sleep(700);
  const p2 = (await state()).game;
  await shot('02-paused');
  log({ pausedAfter: played, paused: p2.paused, timeStill: p1.time === p2.time, at: p2.time, clockBeforePause: p2.clock });
  if (!p2.paused || p1.time !== p2.time) throw Error('Esc did not pause the song');
  s = await state();
  await page.mouse.click(...s.hot.resume);
  await sleep(150);
  skew = await sync();
  await pressAll(skew);
  for (let i = 0; i < 60 && s.screen !== 'result'; i++) (await sleep(250), (s = await state()));
  await sleep(400);
  await shot('03-result');
  log({ end: s.game });
  const c = s.game.counts;
  if (s.screen !== 'result') throw Error('the song did not end');
  // The song really sounded through the engine's audio owner, and its clock and the page's stayed together.
  if (!(s.game.clock.samples > 100)) throw Error(`the audio clock was not read: ${JSON.stringify(s.game.clock)}`);
  if (c.miss > s.game.notes * 0.2 || s.game.accuracy < 0.6) throw Error(`real key presses at the published times were judged badly: ${JSON.stringify(c)}`);
};
