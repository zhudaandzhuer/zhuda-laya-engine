import test from 'node:test';
import assert from 'node:assert/strict';
import { El, installDom } from './fake-dom.mjs';

installDom();
const { createHoldInput, padDirection } = await import('../input/hold-input.ts');

/** An element that remembers captured pointers, like a browser does. */
function capturing() {
  const el = new El('button');
  el.captured = new Set();
  el.setPointerCapture = (id) => el.captured.add(id);
  el.hasPointerCapture = (id) => el.captured.has(id);
  el.releasePointerCapture = (id) => {
    el.captured.delete(id);
    el.dispatch('lostpointercapture', { pointerId: id });
  };
  return el;
}

function recorder() {
  const log = [];
  const input = createHoldInput({
    begin: (role, d) => log.push(['begin', role, d.node.id, d.event?.pointerId ?? null]),
    end: (role, cancelled, d) => log.push(['end', role, cancelled, d.node.id, d.event?.pointerId ?? null]),
  });
  return { input, log };
}

test('hold input: one source owns a role from press to release; other fingers are ignored', () => {
  const { input, log } = recorder();
  const strike = capturing(), canvas = capturing();
  strike.id = 'strike';
  canvas.id = 'canvas';
  input.bind(strike, 'attack');
  input.bind(canvas, 'attack');
  let prevented = 0;
  strike.dispatch('pointerdown', { pointerId: 2, button: 0, preventDefault: () => prevented++ });
  assert.equal(input.held('attack'), true);
  assert.equal(prevented, 1);
  assert.ok(strike.captured.has(2), 'captures the finger');
  // another finger on the same role, even on another element, does nothing
  canvas.dispatch('pointerdown', { pointerId: 3, button: 0 });
  canvas.dispatch('pointerup', { pointerId: 3 });
  assert.equal(input.held('attack'), true);
  // the owning finger lets go
  strike.dispatch('pointerup', { pointerId: 2 });
  assert.equal(input.held('attack'), false);
  // the capture ending afterwards is not a second release
  strike.dispatch('lostpointercapture', { pointerId: 2 });
  assert.deepEqual(log, [
    ['begin', 'attack', 'strike', 2],
    ['end', 'attack', false, 'strike', 2],
  ]);
});

test('hold input: cancel, secondary buttons, accept() and moves', () => {
  const { input, log } = recorder();
  const pad = capturing();
  pad.id = 'pad';
  const moves = [];
  let open = false;
  input.bind(pad, 'move', { accept: () => !open, move: (e) => moves.push(e.clientX) });
  pad.dispatch('pointerdown', { pointerId: 1, button: 2 });
  assert.equal(input.held('move'), false, 'right button ignored');
  open = true;
  pad.dispatch('pointerdown', { pointerId: 1, button: 0 });
  assert.equal(input.held('move'), false, 'accept() refused');
  open = false;
  pad.dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 10 });
  pad.dispatch('pointermove', { pointerId: 1, clientX: 40 });
  pad.dispatch('pointermove', { pointerId: 9, clientX: 99 });
  assert.deepEqual(moves, [40], 'only the holding finger moves the pad');
  pad.dispatch('pointercancel', { pointerId: 1 });
  assert.equal(input.held('move'), false);
  assert.deepEqual(log.at(-1), ['end', 'move', true, 'pad', 1]);
});

test('hold input: keys share roles with fingers, releaseSource, silent clear and abort', () => {
  const log = [];
  const controller = new AbortController();
  const input = createHoldInput({
    signal: controller.signal,
    begin: (role) => log.push('begin ' + role),
    end: (role, cancelled) => log.push(`end ${role}${cancelled ? ' cancelled' : ''}`),
  });
  const area = capturing(), evade = capturing();
  input.bind(evade, 'evade');
  assert.equal(input.press('attack', 'KeyJ', area), true);
  assert.equal(input.press('attack', 'Enter', area), false, 'already held by J');
  assert.equal(input.press('evade', 'Space', area), true);
  input.release('attack', 'Enter');
  assert.equal(input.held('attack'), true, 'only the holder can release');
  input.releaseSource('KeyJ');
  assert.equal(input.held('attack'), false);
  assert.deepEqual(log, ['begin attack', 'begin evade', 'end attack']);
  // clear drops everything without end(), and hands captured pointers back
  input.releaseSource('Space');
  evade.dispatch('pointerdown', { pointerId: 7, button: 0 });
  input.press('attack', 'KeyJ', area);
  log.length = 0;
  input.clear();
  assert.equal(input.held('evade') || input.held('attack'), false);
  assert.equal(evade.captured.size, 0);
  assert.deepEqual(log, [], 'no release after a clear');
  input.press('attack', 'KeyJ', area);
  controller.abort();
  assert.equal(input.held('attack'), false, 'abort clears');
});

test('pad direction: halves with a dead zone in the middle', () => {
  const pad = new El();
  pad.getBoundingClientRect = () => ({ left: 100, width: 200 });
  assert.equal(padDirection(pad, 120), -1);
  assert.equal(padDirection(pad, 290), 1);
  assert.equal(padDirection(pad, 200), 0);
  assert.equal(padDirection(pad, 212), 0, 'inside 6.5% of centre');
  assert.equal(padDirection(pad, 214), 1);
  assert.equal(padDirection(pad, 230, 0.2), 0, 'custom dead zone');
});
