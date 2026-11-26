#!/usr/bin/env node
/**
 * Measure the edit loop of `zhuda-laya-watch`: how long the watcher takes to start, and how long
 * from saving one source file until the page is told to reload.
 *
 *   node scripts/measure-watch.mjs --project games/zhuda-match [--saves 9] [--file src/Main.ts]
 *        [--port 18931] [--release] [--full-builds]
 *
 * The file is written back with the bytes it already has, so the project does not change (its
 * modification time does). Each time is taken from just before the write to the `reload` event on
 * the watcher's own event stream, so it includes the watcher's debounce and nothing of a browser.
 * `--release` watches without `--candidate`; `--full-builds` passes the same flag to the watcher.
 */
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const value = (name, fallback) => {
  const index = argv.indexOf(name);
  return index === -1 ? fallback : argv[index + 1];
};
const project = path.resolve(value('--project', process.cwd()));
const saves = Number(value('--saves', '9'));
const port = Number(value('--port', '18931'));
const file = path.resolve(project, value('--file', 'src/Main.ts'));
const quietMs = Number(value('--quiet', '500'));
if (!Number.isInteger(saves) || saves < 1) throw Error('Invalid --saves');
if (!fs.existsSync(file)) throw Error(`No such file: ${file}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const round = (number) => Math.round(number * 10) / 10;

const watcherArgs = [
  path.join(root, 'packages/compiler/prefab-watch.mjs'),
  '--project',
  project,
  '--port',
  String(port),
];
if (!argv.includes('--release')) watcherArgs.push('--candidate');
if (argv.includes('--full-builds')) watcherArgs.push('--full-builds');

const lines = [];
let onLine = () => {};
const started = performance.now();
const child = spawn(process.execPath, watcherArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
for (const stream of [child.stdout, child.stderr]) {
  let rest = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    const parts = (rest + chunk).split('\n');
    rest = parts.pop();
    for (const line of parts) {
      lines.push(line);
      onLine(line);
    }
  });
}
const stop = () => {
  if (child.exitCode === null) child.kill('SIGTERM');
};
process.on('exit', stop);

try {
  const startMs = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('The watcher did not start in 120 s')), 120_000);
    child.once('exit', (code) => reject(Error(`The watcher exited with ${code}`)));
    onLine = (line) => {
      if (line.includes('[Zhuda Watch] http://')) {
        clearTimeout(timer);
        resolve(performance.now() - started);
      }
    };
  });
  if (lines.some((line) => line.includes('build failed')))
    throw Error(`The first build failed:\n${lines.join('\n')}`);

  // The page's side: one client on the watcher's event stream.
  let onEvent = () => {};
  const request = http.get({ host: '127.0.0.1', port, path: '/__zhuda_reload' }, (response) => {
    let rest = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      const blocks = (rest + chunk).split('\n\n');
      rest = blocks.pop();
      for (const block of blocks) {
        const name = /^event: (.+)$/m.exec(block)?.[1];
        const data = /^data: (.+)$/m.exec(block)?.[1];
        if (name) onEvent(name, data);
      }
    });
  });
  await new Promise((resolve, reject) => {
    request.once('error', reject);
    onEvent = (name) => name === 'ready' && resolve();
  });

  // Wait until the watcher is quiet: late file events of the first build must not count.
  let last = performance.now();
  onEvent = () => {
    last = performance.now();
  };
  while (performance.now() - last < quietMs) await sleep(50);

  const bytes = fs.readFileSync(file);
  const times = [];
  const kinds = [];
  for (let index = 0; index < saves; index++) {
    const seen = lines.length;
    const outcome = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('No reload within 60 s of a save')), 60_000);
      onEvent = (name, data) => {
        if (name !== 'reload' && name !== 'error') return;
        clearTimeout(timer);
        if (name === 'error') reject(Error(`The build failed: ${data}`));
        else resolve(performance.now());
      };
    });
    const before = performance.now();
    fs.writeFileSync(file, bytes);
    times.push((await outcome) - before);
    // A second reload after this one would be a queued build: let it pass before the next save.
    last = performance.now();
    onEvent = () => {
      last = performance.now();
    };
    while (performance.now() - last < quietMs) await sleep(50);
    const logged = lines
      .slice(seen)
      .map((line) => /rebuilt after .* in ([\d.]+) ms, (.+)$/.exec(line))
      .filter(Boolean);
    kinds.push(
      logged.length ? logged.map((match) => `${match[2]} ${match[1]} ms`).join(' + ') : '',
    );
  }
  request.destroy();
  console.log(
    JSON.stringify(
      {
        project: path.relative(root, project).split(path.sep).join('/'),
        file: path.relative(project, file).split(path.sep).join('/'),
        mode: argv.includes('--release') ? 'release' : 'candidate',
        fullBuildsOnly: argv.includes('--full-builds'),
        node: process.version,
        // Other work on the machine shows here; a run under load is not a measurement.
        loadAverage: os.loadavg().map(round),
        startMs: round(startMs),
        saves,
        saveToReloadMs: {
          median: round(median(times)),
          min: round(Math.min(...times)),
          max: round(Math.max(...times)),
          all: times.map(round),
        },
        watcherLog: kinds,
      },
      null,
      2,
    ),
  );
} finally {
  stop();
}
