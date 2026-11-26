// Runs one scenario N times under detplay.mjs (the virtual clock beside this file) and says whether
// every run gave the same files: the answer to "is this test repeatable, or did it pass by luck".
//
//   [detplay's environment: HOOK, READY, VIEWPORT, BLOCK, PRELOAD, …] [KEEP=all]
//     node prefabs/tools/detrepeat.mjs <times> <dist/web dir> <scenario.json> "<query>" <out dir>
//
// Each run goes to <out dir>/run-01, run-02, … and is compared with the first:
//   every screenshot (*.png)                      by its pixels (a hash of the decoded picture; where two differ, how many pixels)
//   every stage report a "probe" step wrote       by its bytes (*.stage.json: the Laya node tree with every rectangle)
//   the log detplay prints                        what each "js" step returned, each click's point, each shot's tick and state, the errors
// The report is printed and written to <out dir>/repeat.json. Exit code 1 if a run failed or differed from the first.
// Only the first run's files, and those of a run that failed or differed, are kept, unless KEEP=all.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';

const [timesArg, root, scenario, query = '', out = 'repeat-out'] = process.argv.slice(2);
const times = Number(timesArg);
if (!Number.isInteger(times) || times < 2 || !root || !scenario) {
  console.error('usage: node detrepeat.mjs <times, 2 or more> <dist/web dir> <scenario.json> "<query>" <out dir>');
  process.exit(2);
}
const detplay = path.join(path.dirname(fileURLToPath(import.meta.url)), 'detplay.mjs');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const runDir = (n) => path.join(out, `run-${String(n).padStart(2, '0')}`);

/** What one run left: every picture by its pixels, every stage report and the log by their bytes. */
function readRun(dir, log) {
  const files = {};
  for (const name of fs.readdirSync(dir).sort()) {
    const bytes = fs.readFileSync(path.join(dir, name));
    if (name.endsWith('.png')) {
      const png = PNG.sync.read(bytes);
      files[name] = { kind: 'shot', size: [png.width, png.height], sha256: sha(Buffer.concat([Buffer.from(`${png.width}x${png.height}:`), png.data])) };
    } else if (name.endsWith('.stage.json')) files[name] = { kind: 'probe', sha256: sha(bytes) };
  }
  files['(log)'] = { kind: 'log', sha256: sha(log) };
  return files;
}

/** How two files that should be the same differ, in a few words or numbers. */
function difference(name, firstDir, dir, firstLog, log) {
  if (name === '(log)') {
    let i = 0;
    while (i < firstLog.length && firstLog[i] === log[i]) i++;
    return { at: i, first: firstLog.slice(Math.max(0, i - 40), i + 80), here: log.slice(Math.max(0, i - 40), i + 80) };
  }
  const a = fs.readFileSync(path.join(firstDir, name)), b = fs.readFileSync(path.join(dir, name));
  if (name.endsWith('.png')) {
    const pa = PNG.sync.read(a), pb = PNG.sync.read(b);
    if (pa.width !== pb.width || pa.height !== pb.height) return { size: [pb.width, pb.height], firstSize: [pa.width, pa.height] };
    let pixels = 0, maxDelta = 0;
    for (let i = 0; i < pa.data.length; i += 4) {
      const d = Math.max(Math.abs(pa.data[i] - pb.data[i]), Math.abs(pa.data[i + 1] - pb.data[i + 1]), Math.abs(pa.data[i + 2] - pb.data[i + 2]), Math.abs(pa.data[i + 3] - pb.data[i + 3]));
      if (d) pixels++;
      if (d > maxDelta) maxDelta = d;
    }
    return { pixels, maxDelta };
  }
  const la = a.toString('utf8').split('\n'), lb = b.toString('utf8').split('\n');
  const line = la.findIndex((text, i) => text !== lb[i]);
  return { line: line + 1, first: (la[line] ?? '').trim().slice(0, 160), here: (lb[line] ?? '').trim().slice(0, 160) };
}

const started = Date.now();
fs.mkdirSync(out, { recursive: true });
const report = { scenario, query, times, viewport: process.env.VIEWPORT || '1280x720', stepMs: Number(process.env.STEP_MS || 1000 / 60), failed: [], files: {}, different: [], identical: false, seconds: 0 };
let first, firstLog;
for (let n = 1; n <= times; n++) {
  const dir = runDir(n);
  fs.rmSync(dir, { recursive: true, force: true });
  const run = spawnSync(process.execPath, [detplay, root, scenario, query, dir], { env: { ...process.env, LOG_CHARS: process.env.LOG_CHARS || '1000000' }, encoding: 'utf8', maxBuffer: 1 << 28 });
  const log = run.stdout ?? '';
  let keep = n === 1 || process.env.KEEP === 'all';
  if (run.status !== 0) {
    report.failed.push({ run: n, status: run.status, message: (run.stderr || String(run.error ?? '')).trim().split('\n').find((l) => /FAILED|Error/.test(l))?.slice(0, 600) ?? 'no message' });
    keep = true;
  }
  if (!fs.existsSync(dir)) continue;
  const files = readRun(dir, log);
  if (n === 1) {
    first = files;
    firstLog = log;
    for (const [name, file] of Object.entries(files)) report.files[name] = { ...file, same: 1 };
  } else
    for (const name of new Set([...Object.keys(first), ...Object.keys(files)])) {
      if (first[name] && files[name]?.sha256 === first[name].sha256) report.files[name].same++;
      else {
        report.different.push({ run: n, file: name, ...(first[name] && files[name] ? difference(name, runDir(1), dir, firstLog, log) : { missing: files[name] ? 'in the first run' : 'in this run' }) });
        keep = true;
      }
    }
  fs.writeFileSync(path.join(dir, 'log.json'), log);
  if (!keep) fs.rmSync(dir, { recursive: true, force: true });
  process.stderr.write(`run ${n} of ${times}: ${run.status === 0 ? 'ok' : 'FAILED'}${n > 1 ? `, ${report.different.filter((d) => d.run === n).length} files differ from the first` : ''}\n`);
}
report.identical = report.failed.length === 0 && report.different.length === 0 && !!first;
report.seconds = Math.round((Date.now() - started) / 1000);
fs.writeFileSync(path.join(out, 'repeat.json'), JSON.stringify(report, null, 1) + '\n');
console.log(JSON.stringify(report, null, 1));
process.exit(report.identical ? 0 : 1);
