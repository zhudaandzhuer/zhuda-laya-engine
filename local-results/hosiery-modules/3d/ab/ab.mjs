// The same steps on the original bench (window.__GAME__) and on the library module in the viewer (window.__SCENE__).
export default async ({ page, shot, sleep, log }) => {
  const stats = () => page.evaluate(() => (window.__SCENE__ ? window.__SCENE__.state() : window.__GAME__.api.stats()));
  const wear = (id) => page.evaluate((id) => (window.__SCENE__ ? window.__SCENE__.set({ bottom: id }) : window.__GAME__.api.wear(id)), id);
  const dress = (id) => page.evaluate((id) => (window.__SCENE__ ? window.__SCENE__.set({ type: id }) : window.__GAME__.api.dress(id)), id);
  const sum = (l) => l.reduce((a, b) => a + b, 0);
  const tearAt = async (x, y, dx, dy) => {
    const before = sum((await stats()).tears);
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) { await page.mouse.move(x + (dx * i) / 24, y + (dy * i) / 24); await sleep(16); }
    const end = Date.now() + 3000;
    while (sum((await stats()).tears) <= before && Date.now() < end) await sleep(50);
    await page.mouse.up();
    await sleep(900);
  };
  const sample = async (label) => {
    await sleep(1500);
    const a = await stats(), t0 = Date.now();
    await sleep(3000);
    const b = await stats(), dt = (Date.now() - t0) / 1000, frames = b.frames - a.frames;
    log({ label, fps: +(frames / dt).toFixed(1), clothMs: +((b.clothMs * b.frames - a.clothMs * a.frames) / frames).toFixed(2), pullMs: +((b.pullMs * b.frames - a.pullMs * a.frames) / frames).toFixed(3) });
  };
  await sleep(1500);
  await shot('as-worn');
  await sample('mini skirt');
  await tearAt(432, 322, -150, 150);
  await tearAt(560, 322, 150, 150);
  await shot('torn');
  log({ tears: (await stats()).tears });
  await dress('lacetop');
  await sleep(1200);
  await shot('lace-top');
  await wear('none'); await sample('no bottom');
  await wear('jeans'); await sample('jeans');
  await shot('jeans');
  await wear('midi'); await sample('midi skirt');
  await shot('midi');
  await dress('fishnet'); await wear('rippedShorts'); await sleep(1200);
  await shot('fishnet-ripped-shorts');
  log({ renderer: (await stats()).renderer ?? (await page.evaluate(() => 'gpu' in navigator)) });
};
