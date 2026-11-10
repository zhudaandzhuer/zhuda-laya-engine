#!/usr/bin/env node
import { cliMain } from '../compiler/cli.mjs';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { PNG } from 'pngjs';
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const inside = (root, file) =>
  file !== root &&
  !path.relative(root, file).startsWith('..' + path.sep) &&
  path.relative(root, file) !== '..' &&
  !path.isAbsolute(path.relative(root, file));

/** Evidence integrity gate. Does not render or certify that supplied pixels represent the scene. */
export function validateSequenceReport(report, options = {}) {
  const errors = [],
    fail = (message) => errors.push(message);
  const result = (frames) => ({
    passed: !errors.length,
    scope: 'evidence-integrity',
    visualComparison: 'not-performed',
    errors,
    frames,
  });
  if (!object(report) || !object(options)) {
    fail('report and options must be objects');
    return result([]);
  }
  const expectedBackend = options.backend ?? report.requestedBackend;
  const times = options.times ?? report.expectedTimes;
  const tolerance = options.timeTolerance ?? 1e-6;
  const budgets = options.maxMetrics ?? {};
  const maxImageBytes = options.maxImageBytes ?? 64 * 1024 * 1024;
  if (!Number.isSafeInteger(maxImageBytes) || maxImageBytes < 1) {
    fail('maxImageBytes must be positive');
    return result([]);
  }
  if (!Number.isFinite(tolerance) || tolerance < 0)
    fail('timeTolerance must be finite and nonnegative');
  if (
    !object(budgets) ||
    Object.entries(budgets).some(([key, n]) => !key || !Number.isFinite(n) || n < 0)
  )
    fail('maxMetrics bounds must be finite and nonnegative');
  if (!['webgl', 'webgpu'].includes(expectedBackend))
    fail('expected backend must be webgl or webgpu');
  if (report.schemaVersion !== 1) fail('schemaVersion must be 1');
  if (!Array.isArray(report.frames) || !report.frames.length) {
    fail('frames must be a non-empty array');
    return result([]);
  }
  if (
    !Array.isArray(times) ||
    times.length !== report.frames.length ||
    times.some((time, i) => !Number.isFinite(time) || time < 0 || (i > 0 && time <= times[i - 1]))
  )
    fail('expectedTimes must be finite, nonnegative, strictly increasing and match frames');
  if (report.requestedBackend !== expectedBackend) fail('requested backend mismatch');
  if (report.selectedBackend !== expectedBackend) fail('selected backend mismatch');
  if (expectedBackend === 'webgpu' && report.fallbackReason !== null)
    fail('WebGPU fallbackReason must explicitly be null');
  if (expectedBackend === 'webgpu' && report.isFallbackAdapter !== false)
    fail('WebGPU hardware adapter evidence is missing or fallback');
  if (report.status !== 'ready') fail('renderer status must be ready');
  if (!Array.isArray(report.errors) || report.errors.length)
    fail('renderer errors must be an empty array');
  let root;
  try {
    root = fs.realpathSync(path.resolve(options.root ?? process.cwd()));
  } catch {
    fail('evidence root is unavailable');
    return result([]);
  }
  let previous = -Infinity;
  const frames = report.frames.map((frame, index) => {
    const prefix = `frame ${index}`;
    if (!object(frame)) {
      fail(`${prefix} must be an object`);
      return frame;
    }
    if (!Number.isFinite(frame.time) || frame.time < 0)
      fail(`${prefix} time must be finite and nonnegative`);
    if (frame.time <= previous) fail(`${prefix} time is not strictly increasing`);
    previous = frame.time;
    if (
      Array.isArray(times) &&
      Number.isFinite(times[index]) &&
      Math.abs(frame.time - times[index]) > tolerance
    )
      fail(`${prefix} differs from expected time`);
    if (frame.ready !== true) fail(`${prefix} is not ready`);
    if (!hash(frame.imageSha256)) fail(`${prefix} image SHA is required`);
    if (
      frame.referenceSha256 !== undefined &&
      (!hash(frame.referenceSha256) || frame.referenceSha256 !== frame.imageSha256)
    )
      fail(`${prefix} reference SHA mismatch`);
    if (typeof frame.imagePath !== 'string' || !frame.imagePath)
      fail(`${prefix} imagePath is required`);
    else
      try {
        const requested = path.resolve(root, frame.imagePath);
        if (!inside(root, requested)) throw Error('imagePath escapes root');
        if (!fs.existsSync(requested)) throw Error('image does not exist');
        const file = fs.realpathSync(requested);
        if (!inside(root, file)) throw Error('imagePath symlink escapes root');
        const stat = fs.statSync(file);
        if (!stat.isFile()) throw Error('image is not a regular file');
        if (stat.size > maxImageBytes) throw Error('image byte budget exceeded');
        const bytes = fs.readFileSync(file);
        if (!bytes.length) throw Error('image is empty');
        if (sha256(bytes) !== frame.imageSha256) throw Error('image SHA mismatch');
      } catch (error) {
        fail(`${prefix} ${error.message}`);
      }
    if (
      frame.metrics !== undefined &&
      (!object(frame.metrics) ||
        Object.values(frame.metrics).some((n) => !Number.isFinite(n) || n < 0))
    )
      fail(`${prefix} metrics must be finite nonnegative numbers`);
    if (object(budgets))
      for (const [key, bound] of Object.entries(budgets)) {
        const n = frame.metrics?.[key];
        if (!Number.isFinite(n) || n < 0 || n > bound)
          fail(`${prefix} metric ${key} exceeds ${bound} or is missing`);
      }
    return { ...frame };
  });
  return result(frames);
}

/** Compare actual PNG pixels against a separate, caller-approved reference report. */
export function compareSequenceReports(actual, reference, options = {}) {
  if (!object(options))
    return {
      passed: false,
      scope: 'png-pixel-regression',
      errors: ['options must be an object'],
      comparisons: [],
      approval: null,
    };
  const actualGate = validateSequenceReport(actual, options),
    referenceOptions = {
      ...options,
      root: options.referenceRoot ?? options.root,
      backend: options.backend ?? actual?.requestedBackend,
      times: options.times ?? actual?.expectedTimes,
    };
  const referenceGate = validateSequenceReport(reference, referenceOptions),
    errors = [...actualGate.errors, ...referenceGate.errors.map((e) => 'reference: ' + e)];
  const maxDiffPixels = options.maxDiffPixels ?? 0,
    channelTolerance = options.channelTolerance ?? 2,
    maxPixels = options.maxPixels ?? 16_777_216;
  if (
    !Number.isSafeInteger(maxDiffPixels) ||
    maxDiffPixels < 0 ||
    !Number.isSafeInteger(channelTolerance) ||
    channelTolerance < 0 ||
    channelTolerance > 255 ||
    !Number.isSafeInteger(maxPixels) ||
    maxPixels < 1
  )
    errors.push('Invalid pixel comparison limits');
  if (
    !object(reference?.approval) ||
    typeof reference.approval.reviewedBy !== 'string' ||
    !reference.approval.reviewedBy.trim() ||
    typeof reference.approval.reviewedAt !== 'string' ||
    !Number.isFinite(Date.parse(reference.approval.reviewedAt))
  )
    errors.push(
      'Reference must carry explicit approval.reviewedBy and reviewedAt; capture is not approval',
    );
  const comparisons = [];
  if (!errors.length) {
    const read = (frame, root) => {
      const bytes = fs.readFileSync(path.resolve(root ?? process.cwd(), frame.imagePath));
      if (
        bytes.length < 33 ||
        !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
        bytes.toString('ascii', 12, 16) !== 'IHDR'
      )
        throw Error('Expected a PNG image');
      const width = bytes.readUInt32BE(16),
        height = bytes.readUInt32BE(20);
      if (!width || !height || width * height > maxPixels) throw Error('PNG pixel budget exceeded');
      return PNG.sync.read(bytes, { checkCRC: true });
    };
    for (let i = 0; i < actual.frames.length; i++)
      try {
        const a = read(actual.frames[i], options.root),
          b = read(reference.frames[i], referenceOptions.root);
        if (a.width !== b.width || a.height !== b.height) throw Error('PNG dimensions differ');
        let differentPixels = 0;
        for (let p = 0; p < a.data.length; p += 4)
          if ([0, 1, 2, 3].some((k) => Math.abs(a.data[p + k] - b.data[p + k]) > channelTolerance))
            differentPixels++;
        const passed = differentPixels <= maxDiffPixels;
        comparisons.push({
          time: actual.frames[i].time,
          width: a.width,
          height: a.height,
          differentPixels,
          passed,
        });
        if (!passed) errors.push('frame ' + i + ' exceeds maxDiffPixels: ' + differentPixels);
      } catch (error) {
        errors.push('frame ' + i + ': ' + error.message);
      }
  }
  return {
    passed: !errors.length,
    scope: 'png-pixel-regression',
    errors,
    comparisons,
    approval: reference?.approval ?? null,
  };
}

export function sequenceCli(argv) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      root: { type: 'string' },
      backend: { type: 'string' },
      times: { type: 'string' },
      'time-tolerance': { type: 'string' },
      max: { type: 'string', multiple: true },
      reference: { type: 'string' },
      'max-diff-pixels': { type: 'string' },
      'channel-tolerance': { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help)
    return 'Usage: zhuda-sequence-check <report.json> --times 0,1.5,3 [--root dir] [--backend webgpu] [--time-tolerance 0.001] [--max metric=value] [--reference approved.json --max-diff-pixels 0 --channel-tolerance 2]';
  if (positionals.length !== 1) throw Error('Exactly one report.json is required; use --help');
  const maxMetrics = {};
  for (const item of values.max ?? []) {
    const match = /^([^=]+)=([^=]+)$/.exec(item);
    if (!match) throw Error('Invalid --max metric=value');
    maxMetrics[match[1]] = Number(match[2]);
  }
  const file = path.resolve(positionals[0]);
  const actual = JSON.parse(fs.readFileSync(file, 'utf8'));
  const settings = {
    root: values.root ?? path.dirname(file),
    backend: values.backend,
    times: values.times?.split(',').map((value) => (value.trim() ? Number(value) : NaN)),
    timeTolerance:
      values['time-tolerance'] === undefined ? undefined : Number(values['time-tolerance']),
    maxMetrics,
  };
  if (!values.reference) {
    if (values['max-diff-pixels'] !== undefined || values['channel-tolerance'] !== undefined)
      throw Error('Pixel comparison settings require --reference');
    return validateSequenceReport(actual, settings);
  }
  const referenceFile = path.resolve(values.reference);
  return compareSequenceReports(actual, JSON.parse(fs.readFileSync(referenceFile, 'utf8')), {
    ...settings,
    referenceRoot: path.dirname(referenceFile),
    maxDiffPixels: values['max-diff-pixels'] === undefined ? 0 : Number(values['max-diff-pixels']),
    channelTolerance:
      values['channel-tolerance'] === undefined ? 2 : Number(values['channel-tolerance']),
  });
}
const invoked = cliMain(
  import.meta.url,
  'Usage: zhuda-sequence-check report.json [--backend webgl|webgpu]',
);
if (invoked)
  try {
    const value = sequenceCli(process.argv.slice(2));
    console.log(typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    if (typeof value !== 'string' && !value.passed) process.exitCode = 1;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
