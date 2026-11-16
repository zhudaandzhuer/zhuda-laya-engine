#!/usr/bin/env node
// Fly-through benchmark: a film scene drawn along a camera path frame by
// frame on the film host's backend (WebGL, or WebGPU with
// ZHUDA_FILM_RENDERER=webgpu), each frame's CPU time and, where the browser
// gives one, GPU time; average, p99 and max checked against the file's
// budget; pictures at fixed poses, a short recording and the brief for a
// critic that sees only those pictures, all beside report.json.
//
//   node scripts/verify-flythrough.mjs [file.json] [--out DIR] [--no-recording]
//
// Exit 0: within budget. 1: over budget, a WebGL error, or a bad file, with
// file:line guidance. 2: a limit could not be checked (GPU time unavailable),
// never a pass. Default file: tests/fixtures/flythrough/yard.json.
// Desktop evidence only; the numbers are this machine's.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ZhudaFilmHost } from '../packages/mcp-server/film-host.mjs';
import { loadFlythroughFile, flythroughGuidance } from '../packages/compiler/flythrough-file.mjs';
import { summarizeZhudaFlythrough, zhudaCriticBrief } from '../packages/mcp-server/runtime.mjs';

const args = process.argv.slice(2);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
const file = path.resolve(
  positional[0] ?? path.join(import.meta.dirname, '../tests/fixtures/flythrough/yard.json'),
);
const renderer = process.env.ZHUDA_FILM_RENDERER === 'webgpu' ? 'webgpu' : 'webgl';
const { spec, issues, lineOf } = loadFlythroughFile(file);
if (issues.length) {
  console.error(`FAIL fly-through file\n${issues.join('\n')}`);
  process.exit(1);
}
const out = path.resolve(
  option('--out') ??
    path.join(os.tmpdir(), 'zhuda-flythrough', `${path.basename(file, '.json')}-${renderer}`),
);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const host = new ZhudaFilmHost({ outputDir: out, renderer });
let run, recording, glErrors;
try {
  await host.ready();
  run = await host.flythrough(spec.scene, {
    cameraPath: spec.cameraPath,
    durationSec: spec.durationSec,
    fps: spec.fps,
    width: spec.width,
    height: spec.height,
    poses: spec.poses,
    warmupFrames: spec.warmupFrames,
  });
  if (spec.recording && !args.includes('--no-recording')) {
    const r = spec.recording;
    try {
      const video = await host.video(spec.scene, {
        name: 'recording',
        cameraPath: spec.cameraPath,
        fps: r.fps,
        durationSec: r.durationSec,
        width: r.width ?? 640,
        height: r.height ?? 360,
        samples: 1,
      });
      recording = { file: path.basename(video.path), frames: video.frames, fps: r.fps };
    } catch (error) {
      recording = { unavailable: String(error.message || error).slice(0, 500) };
    }
  }
  glErrors = host.takeGlErrors();
} finally {
  await host.close();
}

const poses = run.pictures.map((p, i) => {
  const name = `pose-${i}-${p.time.toFixed(2)}s.png`;
  fs.writeFileSync(path.join(out, name), p.png);
  return { time: p.time, file: name };
});
const summary = summarizeZhudaFlythrough(run.frames, {
  budget: spec.budget,
  gpuReason: run.gpuTiming.reason,
});
if (poses.length)
  fs.writeFileSync(
    path.join(out, 'critic-brief.md'),
    zhudaCriticBrief(
      poses.map((p) => p.file),
      recording?.file ? { recording: recording.file } : {},
    ) + '\n',
  );
const report = {
  schemaVersion: 1,
  file,
  renderer,
  gpu: run.gpu,
  size: [spec.width, spec.height],
  fps: spec.fps,
  gpuTiming: run.gpuTiming,
  summary,
  glErrors,
  poses,
  recording: recording ?? null,
  frames: run.frames,
};
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');

const ms = (v) => (v === undefined ? 'n/a' : v.toFixed(2));
const gpuLine = summary.gpu.available
  ? `GPU average ${ms(summary.gpu.averageMs)} p99 ${ms(summary.gpu.p99Ms)} max ${ms(summary.gpu.maxMs)} ms (${summary.gpu.timed} of ${summary.frames} frames)`
  : `GPU time unavailable: ${summary.gpu.reason}`;
const lines = [
  `${summary.frames} frames on ${renderer} (${run.gpu}), ${spec.width}x${spec.height}`,
  `CPU average ${ms(summary.cpu.averageMs)} p99 ${ms(summary.cpu.p99Ms)} max ${ms(summary.cpu.maxMs)} ms`,
  gpuLine,
  ...flythroughGuidance(summary, spec, file, lineOf),
  ...(glErrors.length ? [`WebGL errors while drawing: ${glErrors.slice(0, 3).join('; ')}`] : []),
  `Report, poses${recording?.file ? ', recording' : ''} and critic brief: ${out}`,
];
const status = glErrors.length ? 'fail' : summary.status;
console.log(`${status.toUpperCase()} fly-through ${path.basename(file)}\n${lines.join('\n')}`);
process.exit(status === 'pass' ? 0 : status === 'fail' ? 1 : 2);
