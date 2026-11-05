import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

function fail(errors, message) { errors.push(message); }

/**
 * Validate consumer supplied keyframe evidence without pretending to render it.
 * Images are checked by SHA when both the actual path and reference hash exist;
 * visual comparison remains a consumer/device responsibility.
 */
export function validateSequenceReport(report, options = {}) {
  const errors = [];
  const expectedBackend = options.backend ?? report?.requestedBackend;
  const expectedTimes = options.times ?? report?.expectedTimes;
  const tolerance = options.timeTolerance ?? 1e-6;
  const root = options.root ? path.resolve(options.root) : process.cwd();
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return { passed: false, errors: ['report must be an object'], frames: [] };
  }
  if (report.schemaVersion !== 1) fail(errors, 'schemaVersion must be 1');
  if (!Array.isArray(report.frames) || report.frames.length === 0) {
    fail(errors, 'frames must be a non-empty array');
    return { passed: false, errors, frames: [] };
  }
  if (!['webgl', 'webgpu'].includes(report.requestedBackend)) fail(errors, 'requestedBackend must be webgl or webgpu');
  if (!['webgl', 'webgpu'].includes(report.selectedBackend)) fail(errors, 'selectedBackend must be webgl or webgpu');
  if (expectedBackend && report.requestedBackend !== expectedBackend) fail(errors, `requested backend mismatch: ${report.requestedBackend}`);
  if (expectedBackend && report.selectedBackend !== expectedBackend) fail(errors, `selected backend mismatch: ${report.selectedBackend}`);
  if (expectedBackend === 'webgpu' && report.fallbackReason != null) fail(errors, 'WebGPU report cannot have a fallback reason');
  if (expectedBackend === 'webgpu' && report.isFallbackAdapter === true) fail(errors, 'software/fallback WebGPU adapter is not accepted');
  if (report.status !== 'ready') fail(errors, `renderer status must be ready: ${report.status ?? 'missing'}`);
  if (Array.isArray(report.errors) && report.errors.length) fail(errors, `renderer errors present: ${report.errors.join('; ')}`);
  if (expectedTimes !== undefined) {
    if (!Array.isArray(expectedTimes) || expectedTimes.length !== report.frames.length) fail(errors, 'expectedTimes length must match frames');
  }
  let previous = -Infinity;
  const frames = report.frames.map((frame, index) => {
    if (!frame || typeof frame !== 'object') { fail(errors, `frame ${index} must be an object`); return frame; }
    if (!Number.isFinite(frame.time)) fail(errors, `frame ${index} time must be finite`);
    else {
      if (frame.time <= previous) fail(errors, `frame ${index} time is not strictly increasing`);
      previous = frame.time;
      if (Array.isArray(expectedTimes) && Number.isFinite(expectedTimes[index]) && Math.abs(frame.time - expectedTimes[index]) > tolerance)
        fail(errors, `frame ${index} time ${frame.time} differs from expected ${expectedTimes[index]}`);
    }
    if (frame.ready !== true) fail(errors, `frame ${index} is not ready`);
    if (typeof frame.imagePath !== 'string' || !frame.imagePath) fail(errors, `frame ${index} imagePath is required`);
    else {
      const image = path.resolve(root, frame.imagePath);
      if (image !== root && !image.startsWith(root + path.sep)) fail(errors, `frame ${index} imagePath escapes root`);
      else if (!fs.existsSync(image)) fail(errors, `frame ${index} image does not exist: ${frame.imagePath}`);
      else if (frame.imageSha256 !== undefined) {
        const actual = sha256(fs.readFileSync(image));
        if (actual !== frame.imageSha256) fail(errors, `frame ${index} image SHA mismatch`);
      }
    }
    if (frame.referenceSha256 !== undefined && frame.imageSha256 !== frame.referenceSha256)
      fail(errors, `frame ${index} reference SHA mismatch`);
    if (frame.metrics !== undefined && (!frame.metrics || typeof frame.metrics !== 'object' || Array.isArray(frame.metrics))) fail(errors, `frame ${index} metrics must be an object`);
    for (const [key, bound] of Object.entries(options.maxMetrics ?? {})) {
      const value = frame.metrics?.[key];
      if (!Number.isFinite(value) || value > bound) fail(errors, `frame ${index} metric ${key} exceeds ${bound}`);
    }
    return { ...frame, imagePath: frame.imagePath };
  });
  return { passed: errors.length === 0, errors, frames };
}

function parseList(value) { return value.split(',').filter(Boolean).map(Number); }

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node packages/ci-gate/verify-sequence.mjs <report.json> [--root dir] [--backend webgpu] [--times 0,1.5,3] [--time-tolerance 0.001] [--max metric=value]');
    process.exit(0);
  }
  const file = args.find(value => !value.startsWith('--'));
  if (!file) throw Error('Usage: node packages/ci-gate/verify-sequence.mjs <report.json> [--root dir] [--backend webgpu] [--times 0,1.5,3] [--time-tolerance 0.001] [--max key=value]');
  const get = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
  const max = {};
  for (let i = 0; i < args.length; i++) {
    const value = args[i].startsWith('--max=') ? args[i].slice(6) : args[i] === '--max' ? args[++i] : undefined;
    if (value) { const [key, n] = value.split('='); max[key] = Number(n); }
  }
  const result = validateSequenceReport(JSON.parse(fs.readFileSync(file, 'utf8')), {
    root: get('--root'), backend: get('--backend'), times: get('--times') ? parseList(get('--times')) : undefined,
    timeTolerance: get('--time-tolerance') ? Number(get('--time-tolerance')) : undefined, maxMetrics: max,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}
