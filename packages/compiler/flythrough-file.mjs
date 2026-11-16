/**
 * A fly-through file: a film scene, the camera path to time it along, the
 * poses to picture, a budget and a short recording, all in one JSON file
 * (see docs/flythrough.md). This module reads and checks the file with
 * `file:line` for every problem, and turns a summary or a critic's report
 * into guidance that names the file, the line and what to look at.
 */
import fs from 'node:fs';
import { parseJsonWithLines } from './json-locate.mjs';
import {
  validateZhudaFilmCameraPath,
  validateZhudaFlythroughBudget,
  gateZhudaCriticReport,
} from '../mcp-server/runtime.mjs';

const KEYS = [
  'schemaVersion',
  'scene',
  'cameraPath',
  'durationSec',
  'fps',
  'width',
  'height',
  'poses',
  'warmupFrames',
  'budget',
  'recording',
];

/** The path at the start of an issue (`cameraPath[2].time: ...`). */
const issuePath = (issue) => /^([A-Za-z_][\w.[\]]*)/.exec(issue)?.[1] ?? '';

/**
 * Reads a fly-through file. Returns `{ spec, issues, lineOf }`; each issue
 * is `file:line: message`. `spec` has the defaults filled in.
 */
export function loadFlythroughFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  let parsed;
  try {
    parsed = parseJsonWithLines(text);
  } catch (error) {
    return { spec: undefined, issues: [`${file}: ${error.message}`], lineOf: () => 1 };
  }
  const { data, lineOf } = parsed;
  const raw = [];
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return { spec: undefined, issues: [`${file}:1: a fly-through file is a JSON object`], lineOf };
  for (const key of Object.keys(data))
    if (!KEYS.includes(key)) raw.push(`${key}: not a fly-through field (use ${KEYS.join(', ')})`);
  if (data.schemaVersion !== 1) raw.push('schemaVersion: 1');
  if (!data.scene || typeof data.scene !== 'object') raw.push('scene: a film scene object');
  raw.push(...validateZhudaFilmCameraPath(data.cameraPath));
  raw.push(...validateZhudaFlythroughBudget(data.budget));
  const last = Array.isArray(data.cameraPath) ? data.cameraPath.at(-1)?.time : undefined;
  const spec = {
    scene: data.scene,
    cameraPath: data.cameraPath,
    durationSec: data.durationSec ?? last,
    fps: data.fps ?? 30,
    width: data.width ?? 960,
    height: data.height ?? 540,
    poses: data.poses ?? [],
    warmupFrames: data.warmupFrames,
    budget: data.budget ?? {},
    recording: data.recording === false ? false : { durationSec: 3, fps: 24, ...data.recording },
  };
  if (!(spec.durationSec > 0)) raw.push('durationSec: seconds above 0');
  if (!Number.isInteger(spec.fps) || spec.fps < 1 || spec.fps > 240) raw.push('fps: 1..240');
  for (const key of ['width', 'height'])
    if (!Number.isInteger(spec[key]) || spec[key] < 16 || spec[key] > 3840)
      raw.push(`${key}: 16..3840`);
  if (!Array.isArray(spec.poses) || spec.poses.length > 64)
    raw.push('poses: up to 64 times in seconds');
  else
    spec.poses.forEach((t, i) => {
      if (!(typeof t === 'number' && t >= 0 && t <= spec.durationSec))
        raw.push(`poses[${i}]: a time from 0 to durationSec`);
    });
  if (spec.recording) {
    const r = spec.recording;
    if (!(r.durationSec > 0 && r.durationSec <= 20))
      raw.push('recording.durationSec: 0..20 seconds');
    if (!Number.isInteger(r.fps) || r.fps < 1 || r.fps > 60) raw.push('recording.fps: 1..60');
  }
  const issues = raw.map((issue) => `${file}:${lineOf(issuePath(issue))}: ${issue}`);
  return { spec, issues, lineOf };
}

/** The key of the camera path at or before `time`. */
function keyAt(cameraPath, time) {
  let k = 0;
  while (k + 1 < cameraPath.length && cameraPath[k + 1].time <= time) k++;
  return k;
}

/**
 * Lines that say why a fly-through failed or could not be checked: the
 * budget line exceeded, and for a max limit the slowest frames with the
 * camera key they fall after.
 */
export function flythroughGuidance(summary, spec, file, lineOf) {
  const out = [];
  for (const over of summary.over) {
    out.push(
      `${file}:${lineOf(`budget.${over.limit}`)}: ${over.limit} ${over.limitMs} ms exceeded: ${over.valueMs.toFixed(2)} ms`,
    );
    for (const frame of over.frames.slice(0, 5)) {
      const k = keyAt(spec.cameraPath, frame.time);
      out.push(
        `  frame ${frame.index} at ${frame.time.toFixed(2)} s: ${frame.ms.toFixed(2)} ms, camera after cameraPath[${k}] (${file}:${lineOf(`cameraPath[${k}]`)})`,
      );
    }
  }
  for (const limit of summary.unchecked)
    out.push(
      `${file}:${lineOf(`budget.${limit}`)}: ${limit} not checked: GPU time unavailable (${summary.gpu.reason})`,
    );
  if (summary.over.length)
    out.push(
      'Look at the pictures near those times; lower what the scene draws there (look quality, shadow distance, light fog, model detail), or set the budget of the device the scene is for.',
    );
  return out;
}

/** Reads a critic's report and gates it, with `file:line` for every problem. */
export function gateCriticFile(file, pictures) {
  const text = fs.readFileSync(file, 'utf8');
  let parsed;
  try {
    parsed = parseJsonWithLines(text);
  } catch (error) {
    return { status: 'invalid', lines: [`${file}: ${error.message}`], blocking: [] };
  }
  const gate = gateZhudaCriticReport(parsed.data, pictures);
  const lines =
    gate.status === 'invalid'
      ? gate.issues.map((issue) => `${file}:${parsed.lineOf(issuePath(issue))}: ${issue}`)
      : gate.blocking.map((d) => {
          const i = parsed.data.defects.indexOf(d);
          return `${file}:${parsed.lineOf(`defects[${i}]`)}: ${d.severity} ${d.kind} in ${d.picture}: ${d.where}`;
        });
  return { status: gate.status, lines, blocking: gate.blocking };
}
