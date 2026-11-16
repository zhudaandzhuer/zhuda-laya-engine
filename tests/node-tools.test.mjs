import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { resolveNpmCli, runNpm } from '../scripts/lib/node-tools.mjs';

// A stand-in for npm's CLI at the path npm's own has: it prints what it was
// given, or fails when asked to.
function fakeNpm(root) {
  const cli = path.join(root, 'node_modules/npm/bin/npm-cli.js');
  fs.mkdirSync(path.dirname(cli), { recursive: true });
  fs.writeFileSync(
    cli,
    `const args = process.argv.slice(2);
if (args[0] === 'fail') { process.stderr.write('broken on purpose'); process.exit(3); }
if (args[0] === 'sleep') setTimeout(() => {}, 60000);
else process.stdout.write(JSON.stringify({ args, cwd: process.cwd() }));
`,
  );
  return cli;
}

test('runNpm hands every argument to npm unchanged, in a folder with spaces, CJK, & # %', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda npm 測試 & #% '));
  try {
    const npmCli = fakeNpm(root);
    const cwd = path.join(root, 'work dir 中文 & #%');
    fs.mkdirSync(cwd);
    const args = ['pack', 'a b', '中文', '&', '#', '%PATH%', '"quoted"', '^caret', '$HOME'];
    const out = JSON.parse(runNpm(args, { cwd, npmCli }));
    assert.deepEqual(out.args, args);
    assert.equal(fs.realpathSync(out.cwd), fs.realpathSync(cwd));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('runNpm reports a failing npm with its exit code, folder and standard error', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-npm-fail-'));
  try {
    const npmCli = fakeNpm(root);
    assert.throws(
      () => runNpm(['fail'], { cwd: root, npmCli }),
      (error) =>
        error.status === 3 &&
        error.cwd === root &&
        /npm fail \(in .*\): exit 3\nbroken on purpose/.test(error.message),
    );
    assert.throws(
      () => runNpm(['sleep'], { cwd: root, npmCli, timeout: 300 }),
      (error) => error.timedOut === true && /timed out after 300 ms/.test(error.message),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('resolveNpmCli takes only npm’s own CLI and refuses a wrong explicit path', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-npm-resolve-'));
  try {
    const cli = fakeNpm(root);
    assert.equal(resolveNpmCli({ explicit: cli }), cli);
    assert.throws(
      () => resolveNpmCli({ explicit: path.join(root, 'missing/npm/bin/npm-cli.js') }),
      /ZHUDA_NPM_CLI is not npm's CLI script/,
    );
    assert.throws(() => resolveNpmCli({ explicit: process.execPath }), /ZHUDA_NPM_CLI/);
    // pnpm's or yarn's npm_execpath is passed over for the CLI beside Node.
    const pnpm = path.join(root, 'pnpm.cjs');
    fs.writeFileSync(pnpm, '');
    const node = path.join(root, 'node.exe');
    assert.equal(resolveNpmCli({ explicit: '', execpath: pnpm, nodePath: node }), cli);
    assert.equal(
      resolveNpmCli({ explicit: '', execpath: cli, nodePath: path.join(root, 'x/node') }),
      cli,
    );
    assert.equal(
      resolveNpmCli({ explicit: '', execpath: '', nodePath: path.join(root, 'x/y/node') }),
      undefined,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('runNpm runs the real npm', () => {
  assert.match(runNpm(['--version']).trim(), /^\d+\.\d+\.\d+/);
});
