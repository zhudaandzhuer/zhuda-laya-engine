import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateSequenceReport, sequenceCli } from '../packages/ci-gate/verify-sequence.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-sequence-gate-'));
const image = path.join(root, 'frame.png');
fs.writeFileSync(image, Buffer.from('deterministic-frame'));
const hash = crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex');
const base = {
  schemaVersion: 1,
  requestedBackend: 'webgpu',
  selectedBackend: 'webgpu',
  fallbackReason: null,
  isFallbackAdapter: false,
  status: 'ready',
  errors: [],
  expectedTimes: [0, 1.5, 3],
  frames: [0, 1.5, 3].map((time) => ({
    time,
    ready: true,
    imagePath: 'frame.png',
    imageSha256: hash,
    referenceSha256: hash,
    metrics: { frameMs: 12 },
  })),
};

test('keyframe sequence gate accepts deterministic WebGPU evidence', () => {
  const result = validateSequenceReport(base, {
    root,
    backend: 'webgpu',
    times: [0, 1.5, 3],
    maxMetrics: { frameMs: 16.67 },
  });
  assert.equal(result.passed, true, result.errors.join('; '));
});

test('keyframe gate rejects fallback, stale order, missing image and budget overrun', () => {
  const bad = structuredClone(base);
  bad.selectedBackend = 'webgl';
  bad.fallbackReason = 'adapter unavailable';
  bad.frames[1].time = 0;
  bad.frames[1].imagePath = 'missing.png';
  bad.frames[2].metrics.frameMs = 20;
  const result = validateSequenceReport(bad, {
    root,
    backend: 'webgpu',
    times: [0, 1.5, 3],
    maxMetrics: { frameMs: 16.67 },
  });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => /selected backend/.test(error)));
  assert.ok(result.errors.some((error) => /strictly increasing/.test(error)));
  assert.ok(result.errors.some((error) => /does not exist/.test(error)));
  assert.ok(result.errors.some((error) => /exceeds/.test(error)));
});

test('keyframe gate rejects tampered evidence and path traversal', () => {
  const bad = structuredClone(base);
  bad.frames[0].imageSha256 = '00'.repeat(32);
  bad.frames[0].imagePath = '../outside.png';
  const result = validateSequenceReport(bad, { root, backend: 'webgpu' });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some((error) => /escapes root/.test(error)));
  assert.ok(result.errors.some((error) => /SHA mismatch/.test(error)));
});

test('gate fails closed on invalid expectations, budgets, diagnostics and symlink escape', () => {
  const valid = { ...base, expectedTimes: [0, 1.5, 3] };
  for (const opts of [
    { times: [0, NaN, 3] },
    { timeTolerance: NaN },
    { timeTolerance: -1 },
    { backend: 'invalid' },
    { maxMetrics: { cpu: NaN } },
  ])
    assert.equal(validateSequenceReport(valid, { root, ...opts }).passed, false);
  for (const mutate of [
    (r) => delete r.expectedTimes,
    (r) => delete r.isFallbackAdapter,
    (r) => delete r.errors,
    (r) => delete r.frames[0].imageSha256,
  ]) {
    const r = structuredClone(valid);
    mutate(r);
    assert.equal(validateSequenceReport(r, { root }).passed, false);
  }
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sequence-outside-'));
  fs.writeFileSync(path.join(outside, 'a.png'), 'outside');
  fs.symlinkSync(path.join(outside, 'a.png'), path.join(root, 'link.png'));
  const bad = structuredClone(valid);
  bad.frames[0].imagePath = 'link.png';
  assert.ok(validateSequenceReport(bad, { root }).errors.some((e) => /symlink escapes/.test(e)));
  fs.rmSync(outside, { recursive: true, force: true });
});

test('sequence compares real PNG frames against separately approved references', async () => {
  const { PNG } = await import('pngjs');
  const { compareSequenceReports } = await import('../packages/ci-gate/verify-sequence.mjs');
  const pixel = new PNG({ width: 2, height: 2 });
  pixel.data.fill(255);
  const bytes = PNG.sync.write(pixel);
  fs.writeFileSync(path.join(root, 'baseline.png'), bytes);
  const baseHash = crypto.createHash('sha256').update(bytes).digest('hex');
  const reference = {
    ...base,
    expectedTimes: [0],
    approval: { reviewedBy: 'authored unit fixture', reviewedAt: '2026-11-05T00:00:00Z' },
    frames: [{ time: 0, ready: true, imagePath: 'baseline.png', imageSha256: baseHash }],
  };
  const actual = structuredClone(reference);
  delete actual.approval;
  assert.equal(compareSequenceReports(actual, reference, { root }).passed, true);
  pixel.data[0] = 0;
  const changed = PNG.sync.write(pixel);
  fs.writeFileSync(path.join(root, 'actual.png'), changed);
  actual.frames[0].imagePath = 'actual.png';
  actual.frames[0].imageSha256 = crypto.createHash('sha256').update(changed).digest('hex');
  const failed = compareSequenceReports(actual, reference, { root });
  assert.equal(failed.passed, false);
  assert.equal(failed.comparisons[0].differentPixels, 1);
  assert.equal(compareSequenceReports(actual, reference, { root, maxDiffPixels: 1 }).passed, true);
  assert.equal(
    compareSequenceReports(actual, { ...reference, approval: undefined }, { root }).passed,
    false,
  );
  assert.equal(compareSequenceReports(actual, reference, { root, maxPixels: 1 }).passed, false);
  assert.equal(compareSequenceReports(actual, reference, null).passed, false);
  assert.equal(
    compareSequenceReports(actual, reference, { root, maxImageBytes: NaN }).passed,
    false,
  );
  assert.equal(compareSequenceReports(actual, reference, { root, maxImageBytes: 8 }).passed, false);
  assert.equal(
    compareSequenceReports(actual, reference, { root, channelTolerance: 256 }).passed,
    false,
  );
  const reportPath = path.join(root, 'actual.json');
  fs.writeFileSync(reportPath, JSON.stringify(actual));
  assert.throws(() => sequenceCli([reportPath, '--max-diff-pixels', '1']), /require --reference/);
});
