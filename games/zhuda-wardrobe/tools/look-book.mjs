// A script for games/tools/shot.mjs: the six looks a person is asked to judge (LOCAL-REQUESTS B1),
// each walking, running and held in the three poses no clip reaches, from the front, the side and
// the back. Real clicks on the page's own buttons; one picture of the stage per pose and side.
//   node ../tools/shot.mjs . --gpu --dpr 2 --size 1280x720 --query "look=_._._._._._._._" --script tools/look-book.mjs --out <dir> --name look-book --timeout 300000
// The pictures are JPEGs of the stage only (the panel is not in them). On a graphics card they
// are what a player sees; in software they are not (see shot.mjs).
import { join } from 'node:path';

const LOOKS = [
  ['1-bare', '_._._._._._._._', '什麼都不穿'],
  ['2-tee-trousers', 'hair-bob.tee.trousers.shoes._._._._', '短髮、短袖、長褲、布鞋'],
  ['3-shirt-skirt', 'hair-bob.shirt.skirt.ankle-boots._._._._', '短髮、長袖、及膝裙、短靴'],
  ['4-sun-dress', 'hair-long._._._.sun-dress._._._', '長髮、無袖長洋裝'],
  ['5-tank-shorts-hat-pack', 'hair-bob.tank.shorts._._._.pack.straw-hat', '短髮、背心、短褲、斗笠、背包'],
  ['6-robe', '_._._._.robe._._._', '長袍'],
];
const VIEWS = [['front', 0], ['side', 90], ['back', 180]];
const POSES = [['walk', 'clip-Walk'], ['run', 'clip-Run'], ['arms', 'hold-arms'], ['crouch', 'hold-crouch'], ['kick', 'hold-kick']];

export default async ({ page, state, sleep, log }) => {
  const out = process.argv[process.argv.indexOf('--out') + 1];
  const base = page.url().split('?')[0];
  for (const [id, code, name] of LOOKS)
    for (const [view, yaw] of VIEWS) {
      await page.goto(`${base}?look=${code}&yaw=${yaw}`);
      await page.waitForFunction(() => window.__GAME__?.ready || window.__GAME__?.error, null, { timeout: 240000, polling: 250 });
      const stage = page.locator('#game');
      for (const [pose, hot] of POSES) {
        await page.click(`[data-hot="${hot}"]`);
        await sleep(pose === 'walk' || pose === 'run' ? 900 : 500);
        const file = `${id}-${pose}-${view}.jpg`;
        await stage.screenshot({ path: join(out, file), type: 'jpeg', quality: 90 });
        const s = await state();
        log({ picture: file, name, look: s.look, clip: s.clip, yaw: s.yaw, triangles: s.triangles, draws: s.draws, error: s.error ?? null });
      }
    }
};
