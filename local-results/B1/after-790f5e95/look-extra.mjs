// Three more looks for the check after 790f5e95: the top of a skirt's waistband and the front of the crop tee in view.
import { join } from 'node:path';
const LOOKS = [
  ['x1-crop-tee-skirt', 'hair-bob.crop-tee.skirt.shoes._._._._'],
  ['x2-skirt-only', '_._.skirt._._._._._'],
  ['x3-crop-tee-long-skirt', '_.crop-tee.long-skirt._._._._._'],
];
export default async ({ page, state, sleep, log }) => {
  const out = process.argv[process.argv.indexOf('--out') + 1];
  const base = page.url().split('?')[0];
  for (const [id, code] of LOOKS)
    for (const [view, yaw] of [['front', 0], ['side', 90], ['back', 180]]) {
      await page.goto(`${base}?look=${code}&yaw=${yaw}`);
      await page.waitForFunction(() => window.__GAME__?.ready || window.__GAME__?.error, null, { timeout: 240000, polling: 250 });
      for (const [pose, hot] of [['walk', 'clip-Walk'], ['arms', 'hold-arms']]) {
        await page.click(`[data-hot="${hot}"]`);
        await sleep(pose === 'walk' ? 900 : 500);
        const file = `${id}-${pose}-${view}.png`;
        await page.locator('#game').screenshot({ path: join(out, file) });
        const s = await state();
        log({ picture: file, look: s.look, clip: s.clip, yaw: s.yaw, triangles: s.triangles, draws: s.draws, error: s.error ?? null });
      }
    }
};
