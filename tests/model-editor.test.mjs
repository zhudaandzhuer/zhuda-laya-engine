import { authorizedFetch } from './helpers/editor-request.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildModelEditorBundle, createModelEditorServer, parseModelEditorArgs } from '../packages/compiler/model-editor.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('model editor parses a project-relative model asset and rejects traversal', async () => {
  const project = await fsp.mkdtemp(path.join(os.tmpdir(), 'zhuda-model-editor-'));
  try {
    await fsp.mkdir(path.join(project, 'assets', 'models'), { recursive: true });
    await fsp.copyFile(path.join(repoRoot, 'examples', 'model-inspector', 'asset.gltf'), path.join(project, 'assets', 'models', 'probe.gltf'));
    const args = parseModelEditorArgs(['--project', project, '--asset', 'assets/models/probe.gltf']);
    assert.equal(args.asset, 'assets/models/probe.gltf');
    assert.throws(() => parseModelEditorArgs(['--project', project, '--asset', 'assets/../secret.glb']), /project-relative|inside assets/i);
  } finally {
    await fsp.rm(project, { recursive: true, force: true });
  }
});

test('model editor serves real 3D libraries, asset inventory and public client bundle', async () => {
  const project = await fsp.mkdtemp(path.join(os.tmpdir(), 'zhuda-model-editor-server-'));
  let editor;
  try {
    await fsp.mkdir(path.join(project, 'assets', 'models'), { recursive: true });
    await fsp.copyFile(path.join(repoRoot, 'examples', 'model-inspector', 'asset.gltf'), path.join(project, 'assets', 'models', 'probe.gltf'));
    editor = await createModelEditorServer({ projectRoot: project, asset: 'assets/models/probe.gltf', host: '127.0.0.1', port: 0, engineRoot: repoRoot });
    const address = await editor.listening;
    const base = `http://127.0.0.1:${address.port}`;
    const page = await (await authorizedFetch(editor, `${base}/?asset=assets/models/probe.gltf`)).text();
    assert.match(page, /laya\.d3\.js/);
    assert.match(page, /laya\.gltf\.js/);
    assert.match(page, /__ZHUDA_MODEL_ASSET__/);
    const assets = await (await authorizedFetch(editor, `${base}/api/assets`)).json();
    assert.equal(assets.entries.length, 1);
    assert.equal(assets.entries[0].kind, 'model');
    const bundle = await (await authorizedFetch(editor, `${base}/__editor/model.js`)).text();
    assert.match(bundle, /ZhudaModelLibrary/);
    assert.match(bundle, /ZhudaAssetShowcase/);
  } finally {
    await editor?.close();
    await fsp.rm(project, { recursive: true, force: true });
  }
});

test('model editor bundle compiles against the public engine entry', async () => {
  const bundle = await buildModelEditorBundle({ engineRoot: repoRoot });
  assert.ok(bundle.length > 100_000);
  assert.match(bundle, /ZhudaModelInspector/);
  assert.doesNotMatch(bundle, /from ['"]three['"]/i);
});

test('the legacy prefab-editor command dispatches GLB/glTF assets to the 3D editor', async () => {
  const project = await fsp.mkdtemp(path.join(os.tmpdir(), 'zhuda-model-editor-dispatch-'));
  let child;
  let stdout = '';
  let stderr = '';
  try {
    await fsp.mkdir(path.join(project, 'assets', 'models'), { recursive: true });
    await fsp.copyFile(path.join(repoRoot, 'examples', 'model-inspector', 'asset.gltf'), path.join(project, 'assets', 'models', 'probe.gltf'));
    const probe = net.createServer();
    await new Promise((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
    const port = probe.address().port;
    await new Promise((resolve, reject) => { probe.close(error => error ? reject(error) : resolve()); });
    child = spawn(process.execPath, [
      path.join(repoRoot, 'packages', 'compiler', 'prefab-editor.mjs'),
      '--project', project,
      '--prefab', 'assets/models/probe.gltf',
      '--port', String(port),
    ], { cwd: repoRoot, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', value => { stdout += value; });
    child.stderr.on('data', value => { stderr += value; });
    let timeoutId;
    await Promise.race([
      new Promise((resolve, reject) => {
        const onData = () => {
          if (stdout.includes('editing assets/models/probe.gltf')) { child.stdout.off('data', onData); resolve(); }
        };
        child.stdout.on('data', onData);
        if (child.exitCode !== null) reject(new Error(`editor exited before listening (${child.exitCode}): ${stderr}`));
        child.once('error', reject);
        child.once('exit', code => reject(new Error(`editor exited before listening (${code}): ${stderr}`)));
      }),
      new Promise((_, reject) => { timeoutId = setTimeout(() => reject(new Error(`editor dispatch timed out: ${stderr}`)), 10_000); }),
    ]).finally(() => clearTimeout(timeoutId));
    assert.match(stdout, /editing assets\/models\/probe\.gltf/);
  } finally {
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await Promise.race([once(child, 'exit'), new Promise(resolve => { const timer = setTimeout(resolve, 1000); timer.unref(); })]);
    }
    await fsp.rm(project, { recursive: true, force: true });
  }
});

