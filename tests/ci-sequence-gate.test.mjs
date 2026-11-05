import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { validateSequenceReport } from '../packages/ci-gate/verify-sequence.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-sequence-gate-'));
const image = path.join(root, 'frame.png');
fs.writeFileSync(image, Buffer.from('deterministic-frame'));
const hash = crypto.createHash('sha256').update(fs.readFileSync(image)).digest('hex');
const base = {
  schemaVersion: 1, requestedBackend: 'webgpu', selectedBackend: 'webgpu',
  fallbackReason: null, isFallbackAdapter: false, status: 'ready', errors: [],
  frames: [0, 1.5, 3].map(time => ({ time, ready: true, imagePath: 'frame.png', imageSha256: hash, referenceSha256: hash, metrics: { frameMs: 12 } })),
};

test('keyframe sequence gate accepts deterministic WebGPU evidence', () => {
  const result = validateSequenceReport(base, { root, backend: 'webgpu', times: [0, 1.5, 3], maxMetrics: { frameMs: 16.67 } });
  assert.equal(result.passed, true, result.errors.join('; '));
});

test('keyframe gate rejects fallback, stale order, missing image and budget overrun', () => {
  const bad = structuredClone(base);
  bad.selectedBackend = 'webgl'; bad.fallbackReason = 'adapter unavailable'; bad.frames[1].time = 0;
  bad.frames[1].imagePath = 'missing.png'; bad.frames[2].metrics.frameMs = 20;
  const result = validateSequenceReport(bad, { root, backend: 'webgpu', times: [0, 1.5, 3], maxMetrics: { frameMs: 16.67 } });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some(error => /selected backend/.test(error)));
  assert.ok(result.errors.some(error => /strictly increasing/.test(error)));
  assert.ok(result.errors.some(error => /does not exist/.test(error)));
  assert.ok(result.errors.some(error => /exceeds/.test(error)));
});

test('keyframe gate rejects tampered evidence and path traversal', () => {
  const bad = structuredClone(base);
  bad.frames[0].imageSha256 = '00'.repeat(32); bad.frames[0].imagePath = '../outside.png';
  const result = validateSequenceReport(bad, { root, backend: 'webgpu' });
  assert.equal(result.passed, false);
  assert.ok(result.errors.some(error => /escapes root/.test(error)));
  assert.ok(result.errors.some(error => /SHA mismatch/.test(error)));
});
