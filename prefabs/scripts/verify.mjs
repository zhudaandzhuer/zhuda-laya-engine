// Runs the prefab library's own checks against the engine in this checkout, and prints one line each:
//   the library      npm run verify   (type check, unit tests)
//   viewer2d, viewer3d   npm run verify   (sync the copies, build, type check, Doctor, tests)
// Build the engine first (`npm ci` at the root does).  --go also runs `go vet` and `go test` in server/.
//   npm run verify:prefabs          node prefabs/scripts/verify.mjs --go
// Exit code 1 if any part fails.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const lib = join(dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const line = (name, ok, note, started) => console.log(`${name.padEnd(20)} ${ok ? 'ok  ' : 'FAIL'} ${note}  ${Math.round((Date.now() - started) / 1000)} s`);
for (const [name, dir] of [['prefabs', lib], ['viewer2d', join(lib, 'viewer2d')], ['viewer3d', join(lib, 'viewer3d')]]) {
  const started = Date.now();
  // Each depends on the engine checkout it sits in (a `file:` link) and on TypeScript: one small install.
  if (!existsSync(join(dir, 'node_modules'))) {
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' });
    if (install.status !== 0) {
      line(name, false, `npm install: ${String(install.stderr).split('\n').find((l) => /ERR!|error/.test(l)) ?? 'see npm output'}`, started);
      bad++;
      continue;
    }
  }
  const run = spawnSync('npm', ['run', 'verify'], { cwd: dir, encoding: 'utf8' });
  const out = `${run.stdout}\n${run.stderr}`;
  const pass = /ℹ pass (\d+)/.exec(out)?.[1] ?? '?', fail = /ℹ fail (\d+)/.exec(out)?.[1] ?? '?';
  if (run.status !== 0) bad++;
  line(name, run.status === 0, `tests ${pass} pass / ${fail} fail`, started);
  if (run.status !== 0) console.log(out.split('\n').filter((l) => /error|✖|阻斷|differs|missing/i.test(l)).slice(0, 10).join('\n'));
}
if (process.argv.includes('--go')) {
  const started = Date.now();
  const steps = [['vet', './...'], ['test', './...']].map((args) => spawnSync('go', args, { cwd: join(lib, 'server'), encoding: 'utf8' }));
  const ok = steps.every((s) => s.status === 0);
  if (!ok) bad++;
  const packages = (steps[1].stdout.match(/^ok\s/gm) ?? []).length;
  line('server (Go)', ok, steps[0].error ? 'go is not installed' : `${packages} packages ok`, started);
  if (!ok) console.log(steps.map((s) => `${s.stdout}\n${s.stderr}`).join('\n').split('\n').filter((l) => /FAIL|panic|cannot|undefined/.test(l)).slice(0, 10).join('\n'));
}
process.exit(bad ? 1 : 0);
