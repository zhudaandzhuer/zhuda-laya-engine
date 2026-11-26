import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Game, STEP, T, bot, levelTerrain, playOut } from '../src/core/game.ts';
import { LEVELS } from '../src/core/levels.ts';

const idle = () => ({ move: 0, jump: false, held: false });
const run = () => ({ move: 1, jump: false, held: false });
const settle = (g: Game) => {
  for (let i = 0; i < 30; i++) g.step(0, false);
  return g;
};

test('every level is a valid engine terrain with a start, a flag and solid ground under both', () => {
  for (const level of LEVELS) {
    const spec = levelTerrain(level);
    assert.equal(spec.layers[0].tiles.length, spec.width * spec.height);
    const g = settle(new Game(level));
    assert.ok(g.player.grounded && g.state === 'play', level.id);
    assert.ok(g.terrain.isBlocked(Math.floor(g.flag.x), Math.floor(g.flag.y)), `${level.id}: the flag stands on ground`);
    assert.ok(g.coins.length >= 10 && g.walkers.length >= 3);
  }
});

test('the rise of a jump depends on how long the button is held; standing still nothing happens', () => {
  const peak = (heldSteps: number) => {
    const g = settle(new Game(LEVELS[0]));
    const floor = g.player.y;
    g.input.push('jump', g.time);
    let top = floor;
    for (let i = 0; i < 80; i++) (g.step(0, i < heldSteps), (top = Math.min(top, g.player.y)));
    return floor - top;
  };
  const full = peak(80), tap = peak(3);
  assert.ok(full > 2.3 && full < 2.7, `full ${full}`);
  assert.ok(tap > 0.5 && tap < full * 0.6, `tap ${tap}`);
  const g = playOut(new Game(LEVELS[0]), idle, 5);
  assert.equal(g.state, 'play');
});

test('a press just before landing still jumps (the buffer), and just after leaving a ledge too (coyote time)', () => {
  const g = settle(new Game(LEVELS[0]));
  g.input.push('jump', g.time);
  let jumps = 0, pressed = false;
  for (let i = 0; i < 120; i++) {
    // On the way down, five steps before the ground: too early for a plain "grounded" test.
    if (!pressed && g.player.vy > 0 && g.player.y > 8 - 0.9) ((pressed = true), g.input.push('jump', g.time));
    for (const e of g.step(0, true)) if (e.type === 'jump') jumps++;
  }
  assert.ok(pressed);
  assert.equal(jumps, 2);
  // Coyote: walk off the step at column 19..20 (one tile high) and press two steps after leaving it.
  const c = settle(new Game(LEVELS[0]));
  c.player.x = 20.2;
  c.player.y = 7;
  settle(c);
  let left = -1, jumped = false;
  for (let i = 0; i < 60 && !jumped; i++) {
    if (left < 0 && !c.player.grounded) left = i;
    if (left >= 0 && i === left + 2) c.input.push('jump', c.time);
    jumped = c.step(1, true).some((e) => e.type === 'jump');
  }
  assert.ok(left >= 0 && jumped);
});

test('running without jumping ends at the first walker, pit or spikes; walls stop a run', () => {
  for (const level of LEVELS) {
    const g = playOut(new Game(level), run, 30);
    assert.equal(g.state, 'dead', level.id);
    assert.ok(g.player.x < 30);
  }
  const g = settle(new Game(LEVELS[0]));
  for (let i = 0; i < 200; i++) g.step(-1, false);
  assert.ok(g.player.x > 0.3 && g.player.x < 0.4 && g.state === 'play');
});

test('landing on a walker stomps it; walking into it does not', () => {
  const g = settle(new Game(LEVELS[0]));
  const w = g.walkers[0];
  g.player.x = w.x;
  g.player.y = w.y - 1.2;
  g.player.vy = 6;
  g.player.grounded = false;
  let stomped = false;
  for (let i = 0; i < 30 && !stomped && g.state === 'play'; i++) stomped = g.step(0, false).some((e) => e.type === 'stomp');
  assert.ok(stomped && !w.alive && g.state === 'play' && g.player.vy < 0);
  const h = settle(new Game(LEVELS[0]));
  h.player.x = h.walkers[0].x - 0.9;
  let hurt = false;
  for (let i = 0; i < 60 && !hurt; i++) hurt = h.step(1, false).some((e) => e.type === 'hurt');
  assert.ok(hurt && h.state === 'dead');
});

test('a player who looks ahead finishes every level; the same play is the same result', () => {
  for (const level of LEVELS) {
    const a = playOut(new Game(level), bot), b = playOut(new Game(level), bot);
    assert.equal(a.state, 'won', `${level.id}: stopped at x ${a.player.x.toFixed(1)} of ${a.width}`);
    assert.ok(a.time > 8 && a.time < 40 && a.stars() >= 1);
    assert.equal(a.time, b.time);
    assert.equal(a.taken, b.taken);
    assert.ok(Math.abs(a.time / STEP - Math.round(a.time / STEP)) < 1e-6);
  }
  assert.equal(T.spikes, 3);
});
