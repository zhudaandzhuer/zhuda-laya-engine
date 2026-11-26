// The stick in a game turned 90° on a portrait phone: screen points go through toLocal, the
// stick stays inside bounds(), and a push toward the game's right reads as +x.
import test from 'node:test';
import assert from 'node:assert/strict';
import { El, installDom } from './fake-dom.mjs';

const dom = installDom();
const { createVirtualStick } = await import('../ui/virtual-stick/virtual-stick.ts');

test('toLocal maps screen points; bounds keep the stick inside the turned game', () => {
  const zone = new El(), stick = new El(), knob = new El();
  // A 390×844 portrait screen showing an 844×390 game turned 90° clockwise:
  // game x runs down the screen, game y runs right-to-left.
  const W = 390;
  const s = createVirtualStick({
    zone, stick, knob,
    toLocal: (cx, cy) => ({ x: cy, y: W - cx }),
    bounds: () => ({ width: 844, height: 390 }),
  });
  zone.dispatch('pointerdown', { pointerId: 1, clientX: 300, clientY: 120 }); // game point (120, 90)
  assert.equal(stick.style.left, `${120 - 66}px`);
  assert.equal(stick.style.top, `${90 - 66}px`);
  // moving the finger DOWN the screen is moving toward the game's right
  zone.dispatch('pointermove', { pointerId: 1, clientX: 300, clientY: 120 + 28 });
  assert.equal(s.x, 0.5);
  assert.equal(s.y, 0);
  // moving it LEFT on the screen is moving toward the game's bottom
  zone.dispatch('pointermove', { pointerId: 1, clientX: 300 - 28, clientY: 120 });
  assert.equal(s.x, 0);
  assert.equal(s.y, 0.5);
  dom.window.dispatch('pointerup', { pointerId: 1 });
  assert.equal(s.held, false);
  // kept inside the game's 844-wide area, not the 390-wide window
  zone.dispatch('pointerdown', { pointerId: 2, clientX: 10, clientY: 830 });
  assert.equal(stick.style.left, `${844 - 132 - 8}px`);
  s.dispose();
});

test('without toLocal the stick behaves exactly as before (screen coordinates, window bounds)', () => {
  const zone = new El(), stick = new El(), knob = new El();
  const s = createVirtualStick({ zone, stick, knob });
  zone.dispatch('pointerdown', { pointerId: 3, clientX: 100, clientY: 600 });
  assert.equal(stick.style.left, '34px');
  zone.dispatch('pointermove', { pointerId: 3, clientX: 128, clientY: 600 });
  assert.equal(s.x, 0.5);
  s.dispose();
});
