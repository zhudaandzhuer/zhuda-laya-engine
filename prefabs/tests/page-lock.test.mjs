// ui/page-lock: the viewport keeps every key but the zoom ones, which are locked; pinch and
// double tap are blocked; a touch tap asks for fullscreen (not on an iPhone, not with a mouse,
// not while the game says wait), and it gives up after the browser refuses twice; an iPhone
// browser gets the one-time swipe-up layer (the production rules), WeChat does not.
import test from 'node:test';
import assert from 'node:assert/strict';

function target() {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    removeEventListener(type, fn) { listeners[type] = (listeners[type] || []).filter((f) => f !== fn); },
    fire(type, event = {}) {
      let prevented = false;
      const e = { cancelable: true, ...event, preventDefault() { prevented = true; } };
      for (const fn of listeners[type] || []) fn(e);
      return prevented;
    },
  };
}
function style() {
  const props = {};
  return { touchAction: '', overflow: '', position: '', left: '', top: '', transform: '', zIndex: '', pointerEvents: '', setProperty: (k, v) => (props[k] = v), getPropertyValue: (k) => props[k] ?? '', props };
}
function element(tag = 'div') {
  return {
    tag, id: '', className: '', textContent: '', style: style(), children: [], parent: null, rectTop: 0, rectHeight: 0, attrs: {},
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, hasAttribute(k) { return k in this.attrs; },
    appendChild(c) { c.parent = this; this.children.push(c); return c; },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; },
    getBoundingClientRect() { return { top: this.rectTop, height: this.rectHeight }; },
  };
}
function installPage({ viewport = 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no', refuse = false, height = 844 } = {}) {
  const meta = { attrs: { name: 'viewport', content: viewport }, getAttribute(k) { return this.attrs[k] ?? null; }, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  const root = Object.assign(element('html'), { asked: [], requestFullscreen(opts) { this.asked.push(opts); return refuse ? Promise.reject(Error('no')) : Promise.resolve().then(() => (doc.fullscreenElement = root)); } });
  const body = element('body');
  const head = element('head');
  const scroller = { scrollTop: 0, scrollHeight: height, clientHeight: height };
  const doc = Object.assign(target(), {
    documentElement: root, body, head, scrollingElement: scroller,
    fullscreenElement: null,
    fullscreenEnabled: true,
    querySelector: (sel) => (sel === 'meta[name="viewport"]' ? meta : null),
    createElement: (tag) => element(tag),
  });
  const win = Object.assign(target(), { innerHeight: height, scrollY: 0 });
  const frames = [];
  Object.assign(globalThis, {
    document: doc, window: win,
    getComputedStyle: (el) => ({ position: el.style.position || el.cssPosition || 'static' }),
    requestAnimationFrame: (fn) => frames.push(fn),
  });
  const layer = () => body.children.find((c) => c.id === 'cp-swipe-up');
  // the layer is 200dvh: the page can scroll one screen
  const grow = () => { const l = layer(); if (l) { l.rectHeight = height * 2; scroller.scrollHeight = height * 2; } };
  const scrollTo = (y) => { scroller.scrollTop = y; const l = layer(); if (l) l.rectTop = -y; win.fire('scroll'); };
  return { doc, win, root, meta, body, scroller, frames, layer, grow, scrollTo };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const { lockPage, lockedViewportContent, swipeUpThreshold } = await import('../ui/page-lock/page-lock.ts');

test('viewport: zoom keys locked, other keys kept, nothing duplicated', () => {
  assert.equal(
    lockedViewportContent('width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no'),
    'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no, minimum-scale=1, maximum-scale=1',
  );
  assert.equal(lockedViewportContent('initial-scale=2, maximum-scale=5, user-scalable=yes'), 'initial-scale=1, maximum-scale=1, user-scalable=no, width=device-width, minimum-scale=1');
  assert.equal(lockedViewportContent(''), 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, user-scalable=no');
});

test('pinch and double tap are blocked; dispose puts everything back', () => {
  const { doc, win, root, meta } = installPage();
  const lock = lockPage({ device: { ios: true, touch: true } });
  assert.match(meta.attrs.content, /maximum-scale=1/);
  assert.equal(root.style.touchAction, 'none');
  assert.equal(doc.body.style.touchAction, 'none');
  assert.equal(root.style.props['overscroll-behavior'], 'none');
  assert.equal(doc.fire('gesturestart'), true);
  assert.equal(win.fire('gesturechange'), true);
  assert.equal(doc.fire('touchmove', { touches: [{}, {}] }), true);
  assert.equal(doc.fire('touchmove', { touches: [{}] }), false, 'one finger (the stick) is left alone');
  assert.equal(win.fire('wheel', { ctrlKey: true }), true);
  assert.equal(win.fire('wheel', { ctrlKey: false }), false);
  assert.equal(lock.state().canFullscreen, false, 'no page fullscreen on an iPhone');
  lock.dispose();
  assert.equal(meta.attrs.content, 'width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no');
  assert.equal(root.style.touchAction, '');
  assert.equal(doc.fire('gesturestart'), false);
});

test('a touch tap asks for fullscreen (navigationUI hide); a mouse click or a "wait" does not', async () => {
  const { doc, root } = installPage();
  let fighting = true;
  const lock = lockPage({ device: { ios: false, touch: true }, fullscreenWhen: () => !fighting });
  assert.equal(lock.state().canFullscreen, true);
  doc.fire('pointerup', { pointerType: 'mouse' });
  doc.fire('pointerup', { pointerType: 'touch' });
  assert.equal(root.asked.length, 0);
  fighting = false;
  doc.fire('pointerup', { pointerType: 'touch' });
  assert.deepEqual(root.asked, [{ navigationUI: 'hide' }]);
  await flush();
  assert.equal(lock.state().fullscreen, true);
  doc.fire('pointerup', { pointerType: 'touch' });
  assert.equal(root.asked.length, 1, 'already fullscreen');
  // the player leaves fullscreen: the next tap asks again
  doc.fullscreenElement = null;
  doc.fire('pointerup', { pointerType: 'touch' });
  assert.equal(root.asked.length, 2);
  lock.dispose();
});

test('a browser that refuses is asked at most twice', async () => {
  const { doc, root } = installPage({ refuse: true });
  const lock = lockPage({ device: { ios: false, touch: true } });
  for (let i = 0; i < 4; i++) {
    doc.fire('pointerup', { pointerType: 'touch' });
    await flush();
  }
  assert.equal(root.asked.length, 2);
  assert.equal(lock.state().failures, 2);
  lock.dispose();
});

test('fullscreen: false only locks zoom', () => {
  const { doc, root } = installPage();
  const lock = lockPage({ device: { ios: false, touch: true }, fullscreen: false });
  doc.fire('pointerup', { pointerType: 'touch' });
  assert.equal(root.asked.length, 0);
  assert.equal(lock.state().canFullscreen, false);
  lock.dispose();
});

test('swipe-up threshold: rule min(80, max(24, max/4)); too little room means none', () => {
  assert.equal(swipeUpThreshold(0), Infinity);
  assert.equal(swipeUpThreshold(23), Infinity);
  assert.equal(swipeUpThreshold(24), 24);
  assert.equal(swipeUpThreshold(100), 25);
  assert.equal(swipeUpThreshold(400), 80);
  assert.equal(swipeUpThreshold(844), 80);
});

test('iPhone browser: the layer waits for a real scroll past the threshold, then gets out of the way', () => {
  const page = installPage();
  const game = element('div');
  let done = 0;
  const lock = lockPage({ device: { ios: true, touch: true, iphoneBrowser: true }, iosSwipeUp: { game, label: '往上滑', onDone: () => done++ } });
  page.grow();
  const layer = page.layer();
  assert.ok(layer, 'layer added');
  assert.equal(layer.style.zIndex, '50');
  assert.equal(page.root.style.touchAction, 'pan-y', 'the page must scroll, still no zoom');
  assert.equal(page.body.style.touchAction, 'pan-y');
  assert.ok(page.root.hasAttribute('data-cp-swipe-up'), 'page overflow opened by attribute + !important rule (the engine resets body inline styles)');
  assert.equal(game.style.position, 'fixed', 'a game that is not fixed is pinned');
  assert.equal(lock.state().swipeUp, 'active');
  page.frames.forEach((f) => f());
  assert.equal(lock.state().swipeUp, 'active', 'room to scroll: keeps waiting');
  page.scrollTo(79);
  assert.equal(lock.state().swipeUp, 'active');
  page.scrollTo(80);
  assert.equal(lock.state().swipeUp, 'done');
  assert.equal(done, 1);
  assert.equal(layer.style.zIndex, '-1');
  assert.equal(layer.style.pointerEvents, 'none');
  assert.ok(page.layer(), 'stays in the page so the scroll that hid the bars stays possible');
  assert.equal(page.root.style.touchAction, 'pan-y');
  assert.equal(page.doc.fire('gesturestart'), true, 'pinch still blocked');
  lock.dispose();
  assert.equal(page.layer(), undefined);
  assert.ok(!page.root.hasAttribute('data-cp-swipe-up'));
  assert.equal(game.style.position, '');
});

test('a fixed game is left alone; the text turns with the game, the arrow does not', () => {
  const page = installPage();
  const game = Object.assign(element('div'), { cssPosition: 'fixed' });
  let deg = 90;
  const lock = lockPage({ device: { ios: true, touch: true, iphoneBrowser: true }, iosSwipeUp: { game, label: 'x', labelTurn: () => deg } });
  assert.equal(game.style.position, '', 'already fixed by its CSS: not pinned inline');
  assert.equal(game.style.left, '');
  const box = page.layer().children[0].children[0];
  const arrow = box.children[0];
  assert.equal(box.style.transform, 'rotate(90deg)');
  assert.equal(arrow.style.transform, 'rotate(-90deg)');
  deg = 0;
  page.win.fire('orientationchange');
  assert.equal(box.style.transform, '');
  lock.dispose();
});

test('no room to scroll: the layer is dropped on the next frame', () => {
  const page = installPage();
  const lock = lockPage({ device: { ios: true, touch: true, iphoneBrowser: true }, iosSwipeUp: { game: element('div') } });
  page.frames.forEach((f) => f());
  assert.equal(lock.state().swipeUp, 'done');
  lock.dispose();
});

test('WeChat on iPhone (not an iPhone browser): no layer, the page keeps touch-action none', () => {
  const page = installPage();
  const lock = lockPage({ device: { ios: true, touch: true, iphoneBrowser: false }, iosSwipeUp: { game: element('div') } });
  assert.equal(page.layer(), undefined);
  assert.equal(page.root.style.touchAction, 'none');
  assert.equal(lock.state().swipeUp, 'off');
  lock.dispose();
});
