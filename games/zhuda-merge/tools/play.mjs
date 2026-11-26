// A recorded session for games/tools/shot.mjs: real taps and real drags on the canvas, at the
// places the game reports for its cells (window.__GAME__.cells), played by the rules' own bot
// (re-implemented here from the reported state: serve, merge towards an order, tap a source).
//   node ../tools/shot.mjs . --size 540x960 --query "fresh=1" --script tools/play.mjs --out play-out/first --name first
export default async ({ page, shot, state, sleep, log }) => {
  const drag = async (a, b) => {
    await page.mouse.move(a[0], a[1]);
    await page.mouse.down();
    await page.mouse.move((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, { steps: 3 });
    await page.mouse.move(b[0], b[1], { steps: 3 });
    await page.mouse.up();
  };
  const next = (s) => {
    const st = s.state, cells = st.cells;
    const has = (w, skip = new Set()) => cells.findIndex((c, i) => !skip.has(i) && c && c.kind === 'item' && c.chain === w.chain && c.tier === w.tier);
    for (let o = 0; o < st.orders.length; o++) {
      const used = new Set();
      if (st.orders[o].wants.every((w) => { const i = has(w, used); used.add(i); return i >= 0; })) return { serve: o };
    }
    const goals = st.orders.flatMap((o) => o.wants).filter((w) => has(w) < 0);
    const first = new Map();
    for (let i = 0; i < cells.length; i++) {
      const c = cells[i];
      if (!c || c.kind !== 'item' || !goals.some((g) => g.chain === c.chain && g.tier > c.tier)) continue;
      const k = c.chain + c.tier;
      if (first.has(k)) return { drag: [i, first.get(k)] };
      first.set(k, i);
    }
    if (cells.filter((c) => !c).length < 6) {
      const junk = cells.findIndex((c) => c && c.kind === 'item' && !goals.some((g) => g.chain === c.chain && g.tier >= c.tier));
      if (junk >= 0) return { sell: junk };
    }
    if (st.energy < 1) return { wait: true };
    const goal = goals.sort((a, b) => a.tier - b.tier)[0];
    return goal ? { tap: cells.findIndex((c) => c && c.kind === 'source' && c.chain === goal.chain) } : { wait: true };
  };
  await sleep(600);
  await shot('01-new');
  const counts = { tap: 0, drag: 0, serve: 0, sell: 0 };
  let shots = 2, lastLevel = 1;
  for (let i = 0; i < 700; i++) {
    const s = await state();
    if (s.error) throw Error(s.error);
    const m = next(s);
    if (m.wait) break;
    if (m.serve !== undefined) (await page.mouse.click(...s.hot[`serve-${m.serve}`]), counts.serve++);
    else if (m.drag) (await drag(s.cells[m.drag[0]], s.cells[m.drag[1]]), counts.drag++);
    else if (m.sell !== undefined) (await drag(s.cells[m.sell], s.bin), counts.sell++);
    else (await page.mouse.click(...s.cells[m.tap]), counts.tap++);
    await sleep(m.tap !== undefined ? 230 : 120);
    const after = await state();
    if (m.drag && after.last !== `merge:${m.drag[0]}>${m.drag[1]}`) throw Error(`drag ${m.drag} did not merge: ${after.last}`);
    if (i === 14 || i === 60 || after.state.level !== lastLevel) {
      lastLevel = after.state.level;
      await sleep(300);
      await shot(`${String(shots++).padStart(2, '0')}-move${i}-lv${after.state.level}`);
    }
    if (after.state.level >= 3 && counts.serve >= 14) break;
  }
  let s = await state();
  log({ counts, level: s.state.level, served: s.state.served, merges: s.state.merges, energy: s.state.energy, coins: s.state.coins });
  await page.mouse.click(...s.hot.hint);
  await sleep(300);
  await shot(`${String(shots++).padStart(2, '0')}-hint`);
  await page.evaluate(() => window.__skip(20));
  await sleep(1300);
  s = await state();
  log({ afterTwentyMinutes: s.state.energy });
  await shot(`${String(shots++).padStart(2, '0')}-later`);
};
