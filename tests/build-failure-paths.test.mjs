import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  runZhudaBuild,
  resolveEngineRoot,
  resolveWorkbenchOutput,
  sameDirectory,
} from '../packages/compiler/zhuda-build.mjs';

const repo = path.resolve(import.meta.dirname, '..');

async function project(config, files = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-build-fail-'));
  await fs.writeFile(
    path.join(root, 'zhuda.config.json'),
    typeof config === 'string' ? config : JSON.stringify(config),
  );
  for (const [name, text] of Object.entries(files)) {
    await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
    await fs.writeFile(path.join(root, name), text);
  }
  return root;
}

async function assertNoOutput(root) {
  const entries = (await fs.readdir(root)).sort();
  assert.ok(!entries.includes('dist'), `no build output in ${entries.join(', ')}`);
  assert.ok(!entries.includes('src'), 'no generated registry before the gate passes');
}

test('engine root resolution is relative to the consumer project', () => {
  assert.equal(resolveEngineRoot('/a/game', '../sdk'), path.resolve('/a/sdk'));
  assert.equal(resolveEngineRoot('/a/game', undefined, '/b/engine'), path.resolve('/b/engine'));
});

test('malformed configuration fails before any output is created', async () => {
  const root = await project('{ "entry": ');
  try {
    await assert.rejects(runZhudaBuild({ projectRoot: root }), SyntaxError);
    await assertNoOutput(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a demo-asset build rejects --candidate before scanning or writing', async () => {
  const root = await project({ engineRoot: repo, demoAssets: true, entry: 'src/Main.ts' });
  try {
    await assert.rejects(
      runZhudaBuild({ projectRoot: root, candidate: true }),
      /--candidate requires an independent consumer project/,
    );
    await assertNoOutput(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a configured visual contract that fails blocks the build before bundling', async () => {
  const root = await project(
    {
      engineRoot: repo,
      demoAssets: true,
      entry: 'src/Main.ts',
      visualContract: 'visual-contract.json',
    },
    { 'visual-contract.json': JSON.stringify({ schemaVersion: 1, contracts: [{}] }) },
  );
  try {
    await assert.rejects(runZhudaBuild({ projectRoot: root }), /視覺演出契約閘門失敗/);
    await assertNoOutput(root);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('a project reached through a link is the directory it leads to', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-build-link-'));
  try {
    const real = path.join(root, 'engine');
    const other = path.join(root, 'other');
    const link = path.join(root, 'link');
    await fs.mkdir(real);
    await fs.mkdir(other);
    await fs.symlink(real, link, 'junction');
    assert.equal(sameDirectory(real, link), true);
    assert.equal(sameDirectory(link, real), true);
    assert.equal(sameDirectory(real, path.join(link, '.')), true);
    assert.equal(sameDirectory(real, other), false);
    assert.equal(sameDirectory(link, other), false);
    // Paths that do not exist are compared as written.
    assert.equal(sameDirectory(path.join(root, 'gone'), path.join(root, 'gone')), true);
    assert.equal(sameDirectory(path.join(root, 'gone'), real), false);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('the workbench output is a directory of its own inside the project', () => {
  const root = path.resolve('/a/engine');
  assert.equal(resolveWorkbenchOutput(root), path.join(root, 'dist', 'web'));
  assert.equal(resolveWorkbenchOutput(root, 'dist'), path.join(root, 'dist'));
  assert.equal(resolveWorkbenchOutput(root, 'out/web'), path.join(root, 'out', 'web'));
  for (const outDir of [
    '.',
    '..',
    '../elsewhere',
    'dist/../..',
    path.resolve('/somewhere/else'),
    'src',
    'src/generated',
    'packages',
    'node_modules/.cache',
  ])
    assert.throws(
      () => resolveWorkbenchOutput(root, outDir),
      /zhuda\.config\.json: outDir .* must be a directory of its own inside the project/,
      outDir,
    );
});

test('an output directory outside the project stops the build before anything is written', async () => {
  const root = await project({
    engineRoot: repo,
    demoAssets: true,
    entry: 'src/Main.ts',
    outDir: '../zhuda-build-escape',
  });
  const escape = path.join(path.dirname(root), 'zhuda-build-escape');
  try {
    await assert.rejects(runZhudaBuild({ projectRoot: root }), /outDir "\.\.\/zhuda-build-escape"/);
    await assertNoOutput(root);
    await assert.rejects(fs.stat(escape), { code: 'ENOENT' });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(escape, { recursive: true, force: true });
  }
});
