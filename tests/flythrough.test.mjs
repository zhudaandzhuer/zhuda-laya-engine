import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  summarizeZhudaFlythrough,
  validateZhudaFlythroughBudget,
  zhudaCriticBrief,
  validateZhudaCriticReport,
  gateZhudaCriticReport,
  ZHUDA_CRITIC_DEFECTS,
} from '../packages/core/film/FlythroughReport.ts';
import { parseJsonWithLines } from '../packages/compiler/json-locate.mjs';
import {
  loadFlythroughFile,
  flythroughGuidance,
  gateCriticFile,
} from '../packages/compiler/flythrough-file.mjs';

const fixtures = new URL('./fixtures/flythrough/', import.meta.url);
const frames = (cpu, gpu) =>
  cpu.map((ms, i) => ({ index: i, time: i / 30, cpuMs: ms, ...(gpu ? { gpuMs: gpu[i] } : {}) }));

test('average, p99 and max of CPU and GPU, checked against the budget', () => {
  const cpu = Array.from({ length: 100 }, (_, i) => (i === 40 ? 9 : 1));
  const gpu = Array.from({ length: 100 }, (_, i) => (i === 70 ? 30 : i === 71 ? 20 : 5));
  const summary = summarizeZhudaFlythrough(frames(cpu, gpu), {
    budget: { cpuAverageMs: 2, cpuMaxMs: 10, gpuAverageMs: 11, gpuP99Ms: 25, gpuMaxMs: 16.7 },
  });
  assert.equal(summary.frames, 100);
  assert.deepEqual(
    [summary.cpu.averageMs, summary.cpu.p99Ms, summary.cpu.maxMs, summary.cpu.maxAt.index],
    [1.08, 1, 9, 40],
  );
  assert.equal(summary.gpu.available, true);
  assert.equal(summary.gpu.p99Ms, 20, 'nearest rank: the 99th of 100');
  assert.equal(summary.gpu.maxMs, 30);
  assert.deepEqual(summary.gpu.maxAt, { index: 70, time: 70 / 30 });
  assert.equal(summary.status, 'fail');
  assert.deepEqual(
    summary.over.map((o) => [o.limit, o.frames.map((f) => f.index)]),
    [['gpuMaxMs', [70, 71]]],
    'only the max limit is exceeded, slowest frame first',
  );
  const within = summarizeZhudaFlythrough(frames(cpu, gpu), { budget: { gpuMaxMs: 40 } });
  assert.equal(within.status, 'pass');
});

test('GPU time not measured is unavailable with its reason, never 0, and a GPU limit is not a pass', () => {
  const summary = summarizeZhudaFlythrough(frames([1, 2, 3]), {
    budget: { cpuMaxMs: 5, gpuAverageMs: 11 },
    gpuReason: 'EXT_disjoint_timer_query_webgl2 unavailable.',
  });
  assert.deepEqual(summary.gpu, {
    available: false,
    timed: 0,
    reason: 'EXT_disjoint_timer_query_webgl2 unavailable.',
  });
  assert.deepEqual(summary.unchecked, ['gpuAverageMs']);
  assert.equal(summary.status, 'unavailable');
  assert.equal(
    summarizeZhudaFlythrough(frames([1, 2, 3]), { budget: { cpuMaxMs: 5 } }).status,
    'pass',
  );
  // A CPU limit exceeded still fails when the GPU could not be checked.
  assert.equal(
    summarizeZhudaFlythrough(frames([1, 9]), { budget: { cpuMaxMs: 5, gpuMaxMs: 9 } }).status,
    'fail',
  );
  // Only the frames that brought a GPU time count for the GPU figures.
  const partial = summarizeZhudaFlythrough([
    { index: 0, time: 0, cpuMs: 1 },
    { index: 1, time: 0.1, cpuMs: 1, gpuMs: 4 },
  ]);
  assert.equal(partial.gpu.timed, 1);
  assert.equal(partial.gpu.averageMs, 4);
});

test('bad frames and budgets are refused', () => {
  assert.throws(() => summarizeZhudaFlythrough([]), /no frames/);
  assert.throws(() => summarizeZhudaFlythrough(frames([Number.NaN])), /finite/);
  assert.throws(() => summarizeZhudaFlythrough(frames([1], [-1])), /finite/);
  assert.deepEqual(validateZhudaFlythroughBudget({ gpuMaxMs: 16.7 }), []);
  assert.match(validateZhudaFlythroughBudget({ gpuMs: 3 })[0], /^budget\.gpuMs: not a limit/);
  assert.match(validateZhudaFlythroughBudget({ cpuMaxMs: 0 })[0], /^budget\.cpuMaxMs/);
  assert.match(validateZhudaFlythroughBudget([])[0], /^budget/);
  assert.throws(() => summarizeZhudaFlythrough(frames([1]), { budget: { x: 1 } }), /not a limit/);
});

test('the critic brief names only pictures, the kinds, the severities and the format', () => {
  const brief = zhudaCriticBrief(['pose-0-0.00s.png', 'pose-1-2.00s.png'], {
    recording: 'recording.mp4',
  });
  for (const word of [
    'pose-0-0.00s.png',
    'recording.mp4',
    ...ZHUDA_CRITIC_DEFECTS,
    'minor',
    'critical',
  ])
    assert.ok(brief.includes(word), word);
  // Nothing about the scene's file, budget or intended look reaches the critic.
  assert.ok(!/\.json|budget|preset|intended/i.test(brief));
  assert.throws(() => zhudaCriticBrief([]), /no pictures/);
});

test('a critic report is validated and gated: minor only proposes, above minor blocks', () => {
  const minor = JSON.parse(fs.readFileSync(new URL('critic-minor.json', fixtures), 'utf8'));
  const major = JSON.parse(fs.readFileSync(new URL('critic-major.json', fixtures), 'utf8'));
  assert.deepEqual(validateZhudaCriticReport(minor), []);
  assert.equal(gateZhudaCriticReport(minor).status, 'minor-only');
  const blocked = gateZhudaCriticReport(major);
  assert.equal(blocked.status, 'blocked');
  assert.deepEqual(
    blocked.blocking.map((d) => d.kind),
    ['banding'],
  );
  // Every picture handed over must have been reviewed.
  assert.match(
    validateZhudaCriticReport(minor, ['pose-0-0.00s.png', 'pose-9.png']).join(),
    /not reviewed: pose-9\.png/,
  );
  const unranked = { ...major, defects: [...major.defects].reverse() };
  assert.match(validateZhudaCriticReport(unranked).join(), /most severe first/);
  const wrong = {
    ...minor,
    defects: [{ kind: 'ugly', severity: 'bad', picture: 'x.png', where: '' }],
  };
  const issues = validateZhudaCriticReport(wrong);
  assert.equal(issues.length, 4);
  assert.equal(gateZhudaCriticReport(wrong).status, 'invalid');
  assert.equal(gateZhudaCriticReport(null).status, 'invalid');
});

test('JSON paths map to the lines they start on', () => {
  const { data, lineOf } = parseJsonWithLines(
    '{\n  "a": [\n    1,\n    { "b": 2 }\n  ],\n  "c": "x"\n}',
  );
  assert.deepEqual(data, { a: [1, { b: 2 }], c: 'x' });
  assert.deepEqual(
    [lineOf('a'), lineOf('a[0]'), lineOf('a[1].b'), lineOf('c'), lineOf('a[1].z')],
    [2, 3, 4, 6, 4],
  );
  assert.throws(() => parseJsonWithLines('{\n "a": 1,\n}'), /line 3/);
  assert.throws(() => parseJsonWithLines('[1] 2'), /Text after/);
});

test('a fly-through file: defaults, and every problem with its file and line', () => {
  const good = loadFlythroughFile(fileURLToPath(new URL('yard.json', fixtures)));
  assert.deepEqual(good.issues, []);
  assert.equal(good.spec.durationSec, 6);
  assert.equal(good.spec.fps, 30);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-flythrough-test-'));
  const file = path.join(dir, 'bad.json');
  fs.writeFileSync(
    file,
    JSON.stringify(
      {
        schemaVersion: 1,
        scene: {},
        cameraPath: [
          { time: 0, camera: { eye: [0, 1, 5], target: [0, 1, 0] } },
          { time: 0, camera: { eye: [0, 1, 5], target: [0, 1, 0] } },
        ],
        poses: [9],
        budget: { gpuMax: 3 },
        extra: true,
      },
      null,
      2,
    ),
  );
  const bad = loadFlythroughFile(file);
  const text = bad.issues.join('\n');
  assert.match(
    text,
    new RegExp(
      `${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:\\d+: extra: not a fly-through field`,
    ),
  );
  const secondTime = fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .findIndex(
      (line, i, all) => /"time": 0/.test(line) && all.slice(0, i).some((l) => /"time": 0/.test(l)),
    );
  assert.match(text, new RegExp(`:${secondTime + 1}: cameraPath\\[1\\]\\.time: must increase`));
  assert.match(text, /:\d+: budget\.gpuMax: not a limit/);
  assert.match(text, /durationSec: seconds above 0/);
  assert.match(text, /:\d+: poses\[0\]: a time from 0 to durationSec/);
  fs.writeFileSync(file, '{\n  "schemaVersion": 1,\n');
  assert.match(loadFlythroughFile(file).issues[0], /bad\.json: .*line 3/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('guidance names the budget line, the slowest frames and the camera key they follow', () => {
  const { spec, lineOf } = loadFlythroughFile(fileURLToPath(new URL('over-budget.json', fixtures)));
  const summary = summarizeZhudaFlythrough(
    frames(
      Array.from({ length: 30 }, () => 0.4),
      Array.from({ length: 30 }, (_, i) => (i === 20 ? 9 : 3)),
    ),
    { budget: spec.budget },
  );
  const lines = flythroughGuidance(summary, spec, 'over-budget.json', lineOf);
  assert.match(lines[0], /^over-budget\.json:\d+: cpuMaxMs 0\.01 ms exceeded: 0\.40 ms$/);
  assert.ok(
    lines.some((l) =>
      /frame 20 at 0\.67 s: 9\.00 ms, camera after cameraPath\[0\] \(over-budget\.json:\d+\)/.test(
        l,
      ),
    ),
  );
  assert.match(lines.at(-1), /lower what the scene draws/);
  const blind = summarizeZhudaFlythrough(frames([0.4]), {
    budget: { gpuMaxMs: 16.7 },
    gpuReason: 'no timer',
  });
  assert.match(
    flythroughGuidance(blind, spec, 'f.json', lineOf)[0],
    /^f\.json:\d+: gpuMaxMs not checked: GPU time unavailable \(no timer\)$/,
  );
});

test('the critic file gate gives file and line for a blocking defect and for a bad report', () => {
  const blocked = gateCriticFile(fileURLToPath(new URL('critic-major.json', fixtures)));
  assert.equal(blocked.status, 'blocked');
  assert.match(
    blocked.lines[0],
    /critic-major\.json:\d+: major banding in pose-0-0\.00s\.png: sky above/,
  );
  assert.equal(
    gateCriticFile(fileURLToPath(new URL('critic-minor.json', fixtures))).status,
    'minor-only',
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-critic-test-'));
  const file = path.join(dir, 'bad.json');
  fs.writeFileSync(
    file,
    '{\n  "schemaVersion": 1,\n  "critic": "x",\n  "pictures": ["a.png"],\n  "defects": [\n    { "kind": "banding", "severity": "huge", "picture": "a.png", "where": "sky" }\n  ]\n}\n',
  );
  const invalid = gateCriticFile(file, ['a.png']);
  assert.equal(invalid.status, 'invalid');
  assert.match(invalid.lines[0], /bad\.json:6: defects\[0\]\.severity/);
  fs.rmSync(dir, { recursive: true, force: true });
});
