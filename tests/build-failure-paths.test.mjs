import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runZhudaBuild, resolveEngineRoot } from '../packages/compiler/zhuda-build.mjs';

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
