import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('generated engine index contains a mandatory responsive Zhuda splash', () => {
  const html = fs.readFileSync(path.join(root, 'dist/web/index.html'), 'utf8');
  assert.match(html, /id="zhudaLogoSplash"/);
  assert.match(html, /assets\/branding\/layaair-tribute-mark\.svg/);
  assert.match(html, /zhuda-splash-logo-in/);
  assert.match(html, /safe-area-inset-top/);
  assert.match(html, /orientation: landscape/);
  assert.match(html, /__ZHUDA_SPLASH__/);
  assert.equal(
    fs.existsSync(path.join(root, 'dist/web/assets/branding/layaair-tribute-mark.svg')),
    true,
  );
});

// A fake page for runBrandSplash: class lists, one load listener and manual timers.
function fakePage(readyState) {
  const classes = (set = new Set()) => ({
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    has: (c) => set.has(c),
  });
  const splash = {
    classList: classes(),
    removed: false,
    remove() {
      this.removed = true;
    },
  };
  const timers = [];
  let onLoad = null;
  const page = {
    document: {
      readyState,
      getElementById: () => splash,
      documentElement: { classList: classes() },
    },
    window: {
      setTimeout: (fn, ms) => timers.push({ fn, ms }),
      addEventListener: (type, fn) => {
        if (type === 'load') onLoad = fn;
      },
    },
    splash,
    runTimer(ms) {
      const i = timers.findIndex((t) => t.ms === ms);
      timers.splice(i, 1)[0].fn();
    },
    load() {
      onLoad();
    },
  };
  return page;
}
// The page stays installed as the global document/window until the test ends:
// the splash's timers and load listener read them later.
async function runIn(t, page, mode) {
  const { runBrandSplash } = await import('../packages/compiler/branding.mjs');
  Object.assign(globalThis, { document: page.document, window: page.window });
  t.after(() => {
    delete globalThis.document;
    delete globalThis.window;
  });
  runBrandSplash(mode);
  return page.window.__ZHUDA_SPLASH__;
}

test('the splash holds past its intro until the page has loaded, and its bar loops meanwhile', async (t) => {
  const page = fakePage('loading');
  const state = await runIn(t, page, 'engine');
  page.runTimer(2180);
  assert.equal(state.completed, false);
  assert.equal(page.splash.classList.has('is-waiting'), true);
  page.load();
  assert.equal(state.completed, true);
  assert.equal(page.splash.classList.has('is-waiting'), false);
  assert.equal(page.splash.classList.has('is-complete'), true);
});

test('a page that loads during the intro still shows the whole intro', async (t) => {
  const page = fakePage('interactive');
  const state = await runIn(t, page, 'engine');
  page.load();
  assert.equal(state.completed, false);
  page.runTimer(2180);
  assert.equal(state.completed, true);
  assert.equal(page.splash.classList.has('is-waiting'), false);
});

// verify-procedural-draw screenshotted the page as soon as `completed` was set
// and caught the splash half-faded over its panels (fixed 2026-11-16). A
// picture of the page waits until the node is gone; a canvas read does not.
test('completed means the splash is leaving: it fades, then the node is removed', async (t) => {
  const { brandSplashCss } = await import('../packages/compiler/branding.mjs');
  const page = fakePage('complete');
  const state = await runIn(t, page, 'engine');
  page.runTimer(2180);
  assert.equal(state.completed, true);
  assert.equal(page.splash.classList.has('is-complete'), true);
  assert.equal(page.splash.removed, false, 'still in the page while it fades');
  page.runTimer(460);
  assert.equal(page.splash.removed, true);
  const fade = Number(
    brandSplashCss.match(
      /#zhudaLogoSplash\.is-complete \{ animation: zhuda-splash-exit (\d+)ms/,
    )?.[1],
  );
  assert.ok(fade > 0 && fade < 460, `the ${fade} ms fade ends before the node is removed`);
});

test('mode none completes at once', async (t) => {
  const state = await runIn(t, fakePage('loading'), 'none');
  assert.equal(state.completed, true);
});
