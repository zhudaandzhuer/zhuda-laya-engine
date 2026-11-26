#!/usr/bin/env node
// The prefab library's own checks, run on this checkout of the engine.
//
//   node scripts/verify-prefab-library.mjs [--library <git URL or checkout>] [--ref <branch or commit>] [--go] [--keep]
//
// The library (zhuda-engine-prefabs) is a repository of its own and pins a released engine, so
// its checks say nothing about an engine change that is not released yet. This takes a copy of
// the library into a temporary folder, points its engine dependency at this checkout, and runs
// its `scripts/verify.mjs`: its types and tests, and both viewers built, on the engine as it is
// here. An engine change that breaks a module is seen before the engine is released.
//
// Build the engine first (`npm ci`, or `npm run build`). `--library` defaults to
// ZHUDA_PREFABS, then to the public repository; a checkout is read at its last commit, not with
// what is uncommitted in it. `--keep` leaves the temporary folder for a look.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const engine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  if (at === -1) return undefined;
  if (!args[at + 1]) throw Error(`${name} needs a value`);
  return args[at + 1];
};
const library =
  option('--library') ||
  process.env.ZHUDA_PREFABS ||
  'https://github.com/zhudaandzhuer/zhuda-engine-prefabs.git';
const ref = option('--ref');

function run(command, argv, cwd) {
  const done = spawnSync(command, argv, { cwd, encoding: 'utf8' });
  if (done.status !== 0)
    throw Error(
      `${command} ${argv.join(' ')}: ${String(done.stderr || done.stdout || done.error)
        .trim()
        .split('\n')
        .slice(-6)
        .join('\n')}`,
    );
  return done.stdout;
}

if (!fs.existsSync(path.join(engine, 'dist', 'sdk')))
  throw Error('The engine is not built here: run `npm ci` or `npm run build` first.');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-prefab-library-'));
let failed = false;
try {
  const source = fs.existsSync(library) ? path.resolve(library) : library;
  run('git', ['clone', '--quiet', ...(ref ? [] : ['--depth', '1']), source, work]);
  if (ref) run('git', ['checkout', '--quiet', ref], work);
  const commit = run('git', ['rev-parse', '--short', 'HEAD'], work).trim();

  // The library's dependencies are installed without the engine, and the engine is then this
  // checkout, linked where the pinned one would be. The package files keep their pin: a consumer
  // build refuses an engine that is not pinned to a commit, and the viewers are consumers.
  const manifests = ['package.json', 'viewer2d/package.json', 'viewer3d/package.json'].map(
    (file) => {
      const at = path.join(work, file);
      const text = fs.readFileSync(at, 'utf8');
      const data = JSON.parse(text);
      let named = 0;
      for (const group of ['dependencies', 'devDependencies'])
        if (data[group]?.['zhuda-laya-engine']) {
          delete data[group]['zhuda-laya-engine'];
          named++;
        }
      if (!named) throw Error(`${file} of the library names no zhuda-laya-engine dependency`);
      fs.writeFileSync(at, JSON.stringify(data, null, 2) + '\n');
      return { at, text };
    },
  );
  run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], work);
  for (const { at, text } of manifests) fs.writeFileSync(at, text);
  const installed = path.join(work, 'node_modules', 'zhuda-laya-engine');
  fs.rmSync(installed, { recursive: true, force: true });
  fs.symlinkSync(engine, installed, 'junction');
  // The engine's commands, as npm would have linked them.
  const bins = JSON.parse(fs.readFileSync(path.join(engine, 'package.json'), 'utf8')).bin || {};
  fs.mkdirSync(path.join(work, 'node_modules', '.bin'), { recursive: true });
  for (const [name, target] of Object.entries(bins)) {
    const at = path.join(work, 'node_modules', '.bin', name);
    fs.rmSync(at, { force: true });
    fs.symlinkSync(path.join(installed, target), at);
  }

  const engineVersion = JSON.parse(
    fs.readFileSync(path.join(engine, 'package.json'), 'utf8'),
  ).version;
  const libraryVersion = JSON.parse(
    fs.readFileSync(path.join(work, 'package.json'), 'utf8'),
  ).version;
  console.log(
    `prefab library ${libraryVersion} (${commit}) on engine ${engineVersion} (this checkout)`,
  );
  const checks = spawnSync(
    'node',
    ['scripts/verify.mjs', ...(args.includes('--go') ? ['--go'] : [])],
    {
      cwd: work,
      stdio: 'inherit',
    },
  );
  failed = checks.status !== 0;
} finally {
  if (args.includes('--keep')) console.log(`kept: ${work}`);
  else fs.rmSync(work, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
