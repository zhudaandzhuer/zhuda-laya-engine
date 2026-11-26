// How the pictures in ../preview were taken: the viewer's layered-hosiery preset, driven with a
// real mouse in Chrome on the graphics card. From prefabs/viewer3d, after `npm run build`:
//
//   node ../../games/tools/shot.mjs . --gpu --hook __SCENE__ --size 1280x720 \
//     --query "scene=layered-hosiery&width=1280&height=720" \
//     --script ../3d/layered-hosiery/source/look-book.mjs --out <dir> --name panel
//   node ../../games/tools/shot.mjs . --gpu --hook __SCENE__ --size 800x576 \
//     --query "scene=layered-hosiery&width=800&height=576&hud=0" \
//     --script ../3d/layered-hosiery/source/look-book.mjs --out <dir> --name bench
//
// With the panel it takes the three pictures the bench was last shown with (as worn, both thighs
// torn, the lace top); with `hud=0` every kind, every bottom, and the things done by hand: a tear
// through a tear, a skirt lifted, the seam from behind. Each step waits on what the page's hook
// says, not on a clock, and fails loudly when a drag did not do what it was for.
const TYPES = ['ultra8', 'sheer20', 'semi40', 'opaque80', 'thick120', 'glossy15', 'seam15', 'lacetop', 'garter', 'laceTights', 'micronet', 'fishnet', 'whalenet', 'rib', 'dots'];
const BOTTOMS = ['mini', 'pleated', 'tennis', 'houndstooth', 'midiPleats', 'pencil', 'midi', 'denimShorts', 'rippedShorts', 'woolShorts', 'jeans', 'slacks', 'none'];

export default async ({ page, shot, state, sleep, log }) => {
  const S = (source, arg) => page.evaluate(new Function('arg', `const S = window.__SCENE__; return (${source})(S, arg);`), arg);
  const set = (options) => S('(S, o) => S.set(o)', options);
  const tears = async () => (await state()).state.tears;
  const sum = (list) => list.reduce((a, b) => a + b, 0);
  /** Presses at (x, y), drags by (dx, dy) and holds until `until()` or `seconds` pass; then lets go. */
  const drag = async (x, y, dx, dy, until, seconds = 3) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 24; i++) {
      await page.mouse.move(x + (dx * i) / 24, y + (dy * i) / 24);
      await sleep(16);
    }
    const end = Date.now() + seconds * 1000;
    let done = false;
    while (!(done = await until()) && Date.now() < end) await sleep(50);
    return { done, release: () => page.mouse.up() };
  };
  /** Pulls a thigh until one more tear is counted. */
  const tearAt = async (x, y, dx, dy, what) => {
    const before = sum(await tears());
    const { done, release } = await drag(x, y, dx, dy, async () => sum(await tears()) > before);
    await release();
    if (!done) throw Error(`no tear: ${what} at ${x},${y} by ${dx},${dy}; state ${JSON.stringify((await state()).state)}`);
    await sleep(900); // the hole opens over a quarter of a second, the layer springs back
    log({ tore: what, tears: await tears() });
  };
  const size = page.viewportSize();
  const panel = !new URL(page.url()).searchParams.has('hud');

  if (panel) {
    await sleep(1500);
    await shot('as-worn');
    await tearAt(432, 322, -150, 150, 'left thigh, 20D');
    await tearAt(560, 322, 150, 150, 'right thigh, 20D');
    await shot('torn');
    await set({ type: 'lacetop' });
    await sleep(1200);
    await shot('lace-top');
    return;
  }

  const cx = size.width / 2,
    cy = size.height / 2;
  // Thighs close: every kind, then every bottom.
  await set({ zoom: 0.52, ty: 0.62 });
  for (const type of TYPES) {
    await set({ type, bottom: 'mini' });
    await sleep(700);
    await shot(`type-${type}`);
  }
  await set({ type: 'sheer20', zoom: 1, ty: null });
  for (const bottom of BOTTOMS) {
    await set({ bottom });
    await sleep(900);
    await shot(`bottom-${bottom}`);
  }

  // Jeans torn, then the fishnet under them torn through the same hole.
  await set({ type: 'fishnet', bottom: 'jeans', zoom: 0.52, ty: 0.62 });
  await sleep(900);
  const lx = cx - 0.19 * size.height,
    ly = cy + 0.02 * size.height;
  // This close a pixel covers less of the leg: the drag is longer than with the whole figure in view.
  await tearAt(lx, ly, -240, 250, 'jeans, left thigh');
  await shot('jeans-torn');
  const before = await tears();
  await tearAt(lx, ly, -240, 250, 'through the hole');
  const after = await tears();
  log({ throughTheHole: { before, after, stockingTore: after[0] + after[1] > before[0] + before[1] } });
  await shot('jeans-fishnet-through-hole');

  // Shorts that come with rips: the stocking is pulled through one without tearing the denim.
  await set({ type: 'opaque80', bottom: 'rippedShorts', zoom: 0.52, ty: 0.7 });
  await sleep(900);
  await shot('ripped-shorts');

  // A long skirt lifted by its hem and held.
  await set({ type: 'sheer20', bottom: 'midi', zoom: 1, ty: null });
  await sleep(1200);
  const hemBefore = await S('(S) => S.wearer.hem()');
  const lift = await drag(cx - 0.02 * size.height, cy + 0.14 * size.height, 60, -260, async () => false, 1.6);
  const hemHeld = await S('(S) => S.wearer.hem()');
  await shot('skirt-lifted');
  log({ lift: { held: (await state()).state.held, hemBefore, hemHeld, cloth: (await state()).state.cloth } });
  await lift.release();
  if (!(hemHeld.y > hemBefore.y + 0.02)) throw Error(`the hem did not rise: ${JSON.stringify({ hemBefore, hemHeld })}`);
  await sleep(1200);
  log({ hemAfterRelease: await S('(S) => S.wearer.hem()') });

  // Pressed pleats, the houndstooth check, and the seam and garter that only some angles show.
  await set({ type: 'seam15', bottom: 'none', yaw: Math.PI * 0.95, zoom: 0.8 });
  await sleep(900);
  await shot('seam-from-behind');
  await set({ type: 'garter', bottom: 'none', yaw: 0.35, zoom: 0.52, ty: 0.7 });
  await sleep(900);
  await shot('garter');
  await set({ type: 'laceTights', color: 0x6a6870, bottom: 'woolShorts', yaw: 0, zoom: 0.8, ty: null });
  await sleep(900);
  await shot('lace-tights-shorts');
  await set({ type: 'sheer20', bottom: 'houndstooth', yaw: -0.4, zoom: 0.7 });
  await sleep(1200);
  await shot('houndstooth');
};
