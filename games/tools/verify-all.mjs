// Runs `npm run verify` (build, types, doctor, tests) in every games/zhuda-* project against the
// engine in this checkout, and prints one line each. Build the engine first (`npm ci` at the root does).
//   npm run verify:games                           every game
//   node games/tools/verify-all.mjs zhuda-jump     only these
// Exit code 1 if any project fails.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const games = join(dirname(fileURLToPath(import.meta.url)), '..');
let bad = 0;
const asked = process.argv.slice(2);
for (const name of asked.length ? asked : readdirSync(games).filter((n) => n.startsWith('zhuda-')).sort()) {
  const dir = join(games, name);
  // A game depends on the engine checkout it sits in (`file:../..`) and on TypeScript: one small install.
  if (!existsSync(join(dir, 'node_modules'))) {
    const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: dir, encoding: 'utf8' });
    if (install.status !== 0) {
      console.log(`${name.padEnd(20)} FAIL npm install: ${String(install.stderr).split('\n').find((l) => /ERR!/.test(l)) ?? 'see npm output'}`);
      bad++;
      continue;
    }
  }
  const started = Date.now();
  const run = spawnSync('npm', ['run', 'verify'], { cwd: dir, encoding: 'utf8' });
  const out = `${run.stdout}\n${run.stderr}`;
  const pass = /ℹ pass (\d+)/.exec(out)?.[1] ?? '?', fail = /ℹ fail (\d+)/.exec(out)?.[1] ?? '?';
  const ok = run.status === 0;
  if (!ok) bad++;
  console.log(`${name.padEnd(20)} ${ok ? 'ok  ' : 'FAIL'} tests ${pass} pass / ${fail} fail  ${Math.round((Date.now() - started) / 1000)} s`);
  if (!ok) console.log(out.split('\n').filter((l) => /error|✖|阻斷/i.test(l)).slice(0, 8).join('\n'));
}
process.exit(bad ? 1 : 0);
