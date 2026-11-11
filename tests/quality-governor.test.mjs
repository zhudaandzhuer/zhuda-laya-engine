import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaQualityGovernor } from '../packages/core/runtime3d/QualityGovernor.ts';
import { zhudaLookForQuality } from '../packages/core/film/LookQuality.ts';
import { resolveZhudaFilmLook } from '../packages/core/film/FilmScene.ts';

/** Runs `seconds` of frames at `ms` each; returns the levels it changed to. */
const run = (governor, ms, seconds) => {
  const changes = [];
  for (let t = 0; t < seconds * 1000; t += ms) {
    const level = governor.sample(ms);
    if (level !== undefined) changes.push(level);
  }
  return changes;
};

test('frames over the budget step down at once, one level per window', () => {
  const governor = new ZhudaQualityGovernor({ budgetMs: 16.7, window: 30 });
  assert.equal(governor.level, 3);
  assert.deepEqual(run(governor, 16, 2), [], 'inside the budget nothing changes');
  const changes = run(governor, 30, 3);
  assert.deepEqual(changes, [2, 1, 0]);
  assert.deepEqual(run(governor, 30, 3), [], 'the lowest level stays');
  assert.equal(governor.level, 0);
});

test('after a calm stretch it tries the next level up', () => {
  const governor = new ZhudaQualityGovernor({ start: 1, calmSeconds: 4 });
  assert.deepEqual(run(governor, 10, 3.5), []);
  assert.deepEqual(run(governor, 10, 1), [2]);
  assert.deepEqual(run(governor, 10, 5), [3]);
  assert.deepEqual(run(governor, 10, 20), [], 'the top level stays');
});

test('a level that fails on trial is retried after twice the wait, so it settles', () => {
  const governor = new ZhudaQualityGovernor({ start: 2, calmSeconds: 4, maxCalmSeconds: 16 });
  // Level 3 costs 25 ms on this machine, level 2 costs 12 ms.
  const cost = () => (governor.level === 3 ? 25 : 12);
  const times = [];
  let clock = 0;
  for (let i = 0; i < 20000 && clock < 120000; i++) {
    const ms = cost();
    clock += ms;
    const level = governor.sample(ms);
    if (level === 3) times.push(clock / 1000);
  }
  assert.ok(times.length >= 4 && times.length <= 9, 'it keeps trying, but rarely: ' + times.length);
  const gaps = times.slice(1).map((t, i) => t - times[i]);
  assert.ok(gaps[1] > gaps[0] * 1.5, 'the second wait is about twice the first: ' + gaps);
  assert.ok(gaps.at(-1) <= 18, 'the wait is capped: ' + gaps.at(-1));
  assert.equal(governor.level, 2);
  // Time spent at the level that does not fit is a small share.
  governor.reset(2);
  assert.equal(governor.level, 2);
});

test('a hitch is not the renderer and bad input is refused', () => {
  const governor = new ZhudaQualityGovernor({ window: 4 });
  for (let i = 0; i < 40; i++) assert.equal(governor.sample(900), undefined);
  assert.equal(governor.level, 3);
  assert.throws(() => governor.sample(0), /Invalid frame time/);
  assert.throws(() => governor.sample(Number.NaN), /Invalid frame time/);
  for (const options of [
    { levels: 0 },
    { start: 9 },
    { budgetMs: 0 },
    { window: 1 },
    { overFactor: 0.5 },
    { calmSeconds: 0 },
  ])
    assert.throws(() => new ZhudaQualityGovernor(options), /use|must/);
  assert.throws(() => governor.reset(7), /Invalid level/);
});

test('each quality level of a look drops the costliest parts first', () => {
  const look = resolveZhudaFilmLook({
    preset: 'day',
    shadows: { distance: 90, resolution: 4096, cascades: 4 },
    grade: { ao: 0.8, bloom: 0.3, grain: 0.2, vignette: 0.3 },
    lightFog: { shafts: { steps: 64 } },
  });
  const full = zhudaLookForQuality(look, 3);
  assert.deepEqual(full, look);
  assert.notEqual(full, look, 'a copy');
  const two = zhudaLookForQuality(look, 2);
  assert.equal(two.grade.ao, 0);
  assert.equal(two.grade.bloom, 0.3);
  assert.equal(two.lightFog.shafts.steps, 32);
  assert.equal(two.shadows.resolution, 2048);
  assert.equal(two.shadows.cascades, 4);
  const one = zhudaLookForQuality(look, 1);
  assert.equal(one.lightFog.shafts, false);
  assert.equal(one.grade.grain + one.grade.vignette, 0);
  assert.equal(one.shadows.cascades, 2);
  const zero = zhudaLookForQuality(look, 0);
  assert.equal(zero.grade, false);
  assert.equal(zero.lightFog, false);
  assert.deepEqual(
    [zero.shadows.cascades, zero.shadows.resolution, zero.shadows.distance],
    [1, 1024, 40],
  );
  assert.ok(zero.fog, 'distance fog is free and stays');
  assert.equal(look.grade.ao, 0.8, 'the source look is not changed');
  assert.throws(() => zhudaLookForQuality(look, 4), /0, 1, 2 or 3/);
  // A look without shadows or grade has nothing to drop.
  assert.deepEqual(zhudaLookForQuality(resolveZhudaFilmLook({}), 0).shadows, false);
});
