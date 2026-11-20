import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaQualityGovernor,
  zhudaQualitySteps,
} from '../packages/core/runtime3d/QualityGovernor.ts';
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
  assert.equal(governor.sample(0), undefined, 'a frame of no time is skipped');
  assert.throws(() => governor.sample(-1), /Invalid frame time/);
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

/** Runs `windows` whole windows of 30 frames of `ms` with a GPU time `gpu`; returns the levels it changed to. */
const windows = (governor, count, ms, gpu) => {
  const changes = [];
  for (let i = 0; i < count * 30; i++) {
    const level = governor.sample(ms, gpu);
    if (level !== undefined) changes.push(level);
  }
  return changes;
};

test('with GPU times it holds a band: down above it, up after calm below it, still inside it', () => {
  // Budget 11.7 ms: the band is 9.8..13.6 ms of GPU time.
  const governor = new ZhudaQualityGovernor({ budgetMs: 11.7, window: 30, start: 2 });
  // Frames held at the display's 16.7 ms, which the CPU rule would read as over budget.
  assert.deepEqual(windows(governor, 40, 16.7, 12), [], 'inside the band nothing changes');
  assert.equal(governor.basis, 'gpu');
  assert.deepEqual(windows(governor, 1, 16.7, 14.5), [1], 'above the band: a level down');
  // 4 s of calm at 0.5 s a window: 7 windows are not enough, the 8th is.
  assert.deepEqual(windows(governor, 7, 16.7, 5), [], 'below it, but not yet calm long enough');
  assert.deepEqual(windows(governor, 1, 16.7, 5), [2], 'after the calm stretch, a level up');
  // Inside the band the calm starts again.
  assert.deepEqual(windows(governor, 4, 16.7, 5), []);
  assert.deepEqual(windows(governor, 1, 16.7, 11), []);
  assert.deepEqual(windows(governor, 4, 16.7, 5), [], 'the calm was reset inside the band');
  // The same frames without GPU times: the CPU rule sees 16.7 ms against 11.7 and steps down.
  const cpu = new ZhudaQualityGovernor({ budgetMs: 11.7, window: 30, start: 2 });
  assert.deepEqual(windows(cpu, 2, 16.7), [1, 0]);
  assert.equal(cpu.basis, 'cpu');
  // A window where under half the frames brought a GPU time is decided on frame times.
  const sparse = new ZhudaQualityGovernor({ budgetMs: 11.7, window: 30, start: 2 });
  let changed;
  for (let i = 0; i < 30; i++)
    changed = sparse.sample(16.7, i % 3 === 0 ? 4 : undefined) ?? changed;
  assert.equal(sparse.basis, 'cpu');
  assert.equal(changed, 1);
});

test('a GPU band holds a level a frame-time rule would leave, and bad GPU times are refused', () => {
  const governor = new ZhudaQualityGovernor({ budgetMs: 16.7, start: 1, calmSeconds: 4 });
  // 15 ms of GPU work: inside 14.0..19.4, so it never tries the level above.
  assert.deepEqual(windows(governor, 120, 16.7, 15), []);
  assert.equal(governor.level, 1);
  // The CPU rule, fed the same frames, keeps trying levels up.
  const cpu = new ZhudaQualityGovernor({ budgetMs: 16.7, start: 1, calmSeconds: 4 });
  assert.ok(windows(cpu, 120, 16.7).length > 0);
  assert.throws(() => governor.sample(16, -1), /Invalid GPU time/);
  assert.throws(() => governor.sample(16, Number.NaN), /Invalid GPU time/);
  assert.equal(governor.sample(16, 900), undefined, 'a GPU hitch is ignored');
  for (const gpuBand of [[1, 1.2], [0.8, 1], [0, 1.1], [0.8, 5], [0.8]])
    assert.throws(() => new ZhudaQualityGovernor({ gpuBand }), /gpuBand/);
  assert.throws(() => new ZhudaQualityGovernor({ warmWindow: 1 }), /warmWindow/);
  assert.throws(() => new ZhudaQualityGovernor({ warmCalmFactor: 0 }), /warmCalmFactor/);
});

test('warming up behind a start screen reaches the level that fits in a shorter span', () => {
  // From the top, on a machine where level 3 costs 30 ms and level 1 12 ms.
  const reach = (warm) => {
    const governor = new ZhudaQualityGovernor({ budgetMs: 16.7 });
    if (warm) governor.warm();
    const cost = () => [8, 12, 22, 30][governor.level];
    let clock = 0;
    while (governor.level !== 1 && clock < 20000) {
      const ms = cost();
      clock += ms;
      governor.sample(ms);
    }
    return clock;
  };
  const cold = reach(false),
    warm = reach(true);
  assert.ok(warm < cold / 2, `level 1 after ${warm} ms warming, ${cold} ms cold`);
  // And it tries the level above sooner: 1 s of calm instead of 4.
  const governor = new ZhudaQualityGovernor({ start: 1 });
  governor.warm();
  const up = [];
  for (let i = 0; i < 100; i++) up.push(governor.sample(12));
  assert.equal(up.indexOf(2), 83, 'after 84 frames of 12 ms, the first window past 1 s');
  // Play starts: back to the usual window from a fresh one.
  const playing = new ZhudaQualityGovernor({ window: 30 });
  playing.warm();
  assert.equal(playing.warmingUp, true);
  for (let i = 0; i < 11; i++) playing.sample(40);
  playing.warm(false);
  assert.equal(playing.warmingUp, false);
  for (let i = 0; i < 29; i++) assert.equal(playing.sample(40), undefined);
  assert.equal(playing.sample(40), 2);
});

test('a ladder with detail rungs: pixels to the middle size, then detail, then the rest', () => {
  const name = (s) => `${s.look}@${s.renderScale}/${s.detail}`;
  // Without details every rung keeps its distances: the ladder is as it was.
  assert.deepEqual(zhudaQualitySteps().map(name), [
    '0@0.5/1',
    '0@0.7/1',
    '1@0.5/1',
    '1@0.7/1',
    '2@0.7/1',
    '3@0.7/1',
    '3@0.85/1',
    '3@1/1',
  ]);
  const steps = zhudaQualitySteps({ details: [0.7, 0.4] });
  // A governor over frames that never fit walks it from the top in this order.
  const governor = new ZhudaQualityGovernor({ levels: steps.length, window: 30 });
  const walked = [name(steps[governor.level])];
  for (let i = 0; i < 30 * steps.length; i++) {
    const level = governor.sample(40);
    if (level !== undefined) walked.push(name(steps[level]));
  }
  assert.deepEqual(walked, [
    '3@1/1',
    '3@0.85/1',
    '3@0.85/0.7',
    '3@0.85/0.4',
    '3@0.7/0.4',
    '2@0.7/0.4',
    '1@0.7/0.4',
    '1@0.5/0.4',
    '0@0.7/0.4',
    '0@0.5/0.4',
  ]);
  // A ladder can cut distances before any pixel goes, or after every one.
  assert.deepEqual(
    zhudaQualitySteps({ details: [0.6], detailAt: 1, lowest: false })
      .reverse()
      .map(name),
    ['3@1/1', '3@1/0.6', '3@0.85/0.6', '3@0.7/0.6', '2@0.7/0.6', '1@0.7/0.6', '0@0.7/0.6'],
  );
  assert.deepEqual(
    zhudaQualitySteps({ details: [0.6], detailAt: 0.7, lowest: false })
      .reverse()
      .map(name),
    ['3@1/1', '3@0.85/1', '3@0.7/1', '3@0.7/0.6', '2@0.7/0.6', '1@0.7/0.6', '0@0.7/0.6'],
  );
  for (const bad of [
    { details: [1] },
    { details: [0.3] },
    { details: [0.5, 0.7] },
    { details: [0.6, 0.6] },
    { details: [0.6], detailAt: 0.9 },
  ])
    assert.throws(() => zhudaQualitySteps(bad), /Quality steps/);
});

test('the three frame-rate tiers: bands, the tier of a rate, the budget that holds one', async () => {
  const { ZHUDA_FRAME_TIERS, zhudaFrameTier, zhudaTierBudgetMs } = await import(
    '../packages/core/runtime3d/QualityGovernor.ts'
  );
  assert.deepEqual(ZHUDA_FRAME_TIERS, {
    low: { minFps: 60 },
    high: { minFps: 45, belowFps: 60 },
    extreme: { minFps: 10, belowFps: 45 },
  });
  // A 60 Hz screen paces at 59.7: that is the low tier.
  assert.equal(zhudaFrameTier(120), 'low');
  assert.equal(zhudaFrameTier(59.7), 'low');
  assert.equal(zhudaFrameTier(58.9), 'high');
  assert.equal(zhudaFrameTier(44.6), 'high');
  assert.equal(zhudaFrameTier(43.9), 'extreme');
  assert.equal(zhudaFrameTier(9.2), 'extreme');
  assert.equal(zhudaFrameTier(8.9), null);
  // Without the allowance the bounds are exact.
  assert.equal(zhudaFrameTier(59.7, 0), 'high');
  assert.equal(zhudaFrameTier(60, 0), 'low');
  assert.equal(zhudaFrameTier(9.9, 0), null);
  for (const bad of [-1, NaN, Infinity]) assert.throws(() => zhudaFrameTier(bad), /Frame tier/);
  assert.throws(() => zhudaFrameTier(50, 9), /Frame tier/);
  assert.equal(+zhudaTierBudgetMs('low').toFixed(2), 16.67);
  assert.equal(+zhudaTierBudgetMs('high').toFixed(2), 22.22);
  assert.equal(zhudaTierBudgetMs('extreme'), 100);
  assert.throws(() => zhudaTierBudgetMs('medium'), /Frame tier/);
});

test('the ladder keeps the HDR chain one rung longer, unless asked not to', () => {
  const name = (s) => `${s.look}@${s.renderScale}`;
  assert.deepEqual(zhudaQualitySteps({ effectsAtLowest: false }).map(name), [
    '0@0.5',
    '0@0.7',
    '1@0.7',
    '2@0.7',
    '3@0.7',
    '3@0.85',
    '3@1',
  ]);
  // Without a lowest size there is no such rung either.
  assert.deepEqual(zhudaQualitySteps({ lowest: false }).map(name), [
    '0@0.7',
    '1@0.7',
    '2@0.7',
    '3@0.7',
    '3@0.85',
    '3@1',
  ]);
  // Each rung down is the same look drawn smaller, or a lower look.
  const steps = zhudaQualitySteps();
  for (let i = 1; i < steps.length; i++) {
    const below = steps[i - 1],
      above = steps[i];
    assert.ok(
      below.look < above.look ||
        (below.look === above.look && below.renderScale < above.renderScale),
      `${name(below)} is under ${name(above)}`,
    );
  }
});

test('a frame of many draws gets advice; one of few gets none', async () => {
  const { zhudaFrameLoadAdvice, ZHUDA_DRAW_ADVICE_FROM } = await import(
    '../packages/core/runtime3d/QualityGovernor.ts'
  );
  assert.equal(ZHUDA_DRAW_ADVICE_FROM, 500);
  assert.deepEqual(zhudaFrameLoadAdvice({ drawCalls: 300, renderTargets: 50 }), []);
  assert.deepEqual(zhudaFrameLoadAdvice({ drawCalls: 500 }), []);
  const said = zhudaFrameLoadAdvice({ drawCalls: 1148 });
  assert.equal(said.length, 1);
  assert.match(said[0], /^1148 draws a frame \(over 500\)/);
  assert.match(said[0], /ZhudaInstancedMesh/);
  assert.equal(zhudaFrameLoadAdvice({ drawCalls: 1148 }, { from: 2000 }).length, 0);
  assert.equal(zhudaFrameLoadAdvice({ drawCalls: 120 }, { from: 100 }).length, 1);
  assert.throws(() => zhudaFrameLoadAdvice({ drawCalls: -1 }), /Frame load/);
  assert.throws(() => zhudaFrameLoadAdvice({ drawCalls: 10 }, { from: 0 }), /Frame load/);
});

test('the profiler counts the render targets a WebGL frame goes to', async () => {
  const { ZhudaRuntimeProfiler } = await import('../packages/core/effects/EffectBudget.ts');
  const bound = [];
  const gl = {
    TRIANGLES: 4,
    READ_FRAMEBUFFER: 0x8ca8,
    FRAMEBUFFER: 0x8d40,
    drawArrays() {},
    drawElements() {},
    bindFramebuffer(target, framebuffer) {
      bound.push(framebuffer);
    },
  };
  const original = gl.bindFramebuffer;
  const profiler = new ZhudaRuntimeProfiler();
  profiler.attach(gl);
  const a = {},
    b = {};
  profiler.beginFrame();
  gl.bindFramebuffer(gl.FRAMEBUFFER, a);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  // The same target again is not another pass; the source of a copy is not one either.
  gl.bindFramebuffer(gl.FRAMEBUFFER, a);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, b);
  gl.bindFramebuffer(gl.FRAMEBUFFER, b);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const sample = profiler.endFrame(10, 5);
  assert.equal(sample.renderTargets, 3);
  assert.equal(sample.drawCalls, 1);
  assert.equal(bound.length, 5, 'every bind still reaches the context');
  profiler.beginFrame();
  assert.equal(profiler.endFrame(1, 1).renderTargets, 0, 'counted a frame at a time');
  profiler.dispose();
  assert.equal(gl.bindFramebuffer, original, 'the context has its own function back');
});
