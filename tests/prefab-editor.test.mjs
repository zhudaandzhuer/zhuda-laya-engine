import { authorizedFetch } from './helpers/editor-request.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildPrefabEditorBundle,
  createPrefabEditorServer,
  parsePrefabEditorArgs,
  scanProjectAssets,
  validatePrefabHierarchy,
  PREFAB_EDITOR_ENGINE_FILES,
  PREFAB_EDITOR_FEATURES,
} from '../packages/compiler/prefab-editor-server.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const valid = () => ({
  _$ver: 1,
  _$id: 'root',
  _$type: 'Sprite',
  name: 'Root',
  width: 320,
  height: 180,
  _$child: [
    {
      _$id: 'title',
      _$type: 'Text',
      name: 'Title',
      x: 12,
      y: 14,
      width: 180,
      height: 32,
      anchorX: 0.5,
      anchorY: 0.5,
      text: 'Prefab',
      fontSize: 24,
    },
  ],
});
const validScene = () => ({
  _$ver: 1,
  _$id: 'scene',
  _$type: 'Scene',
  name: 'Scene',
  width: 1280,
  height: 720,
  _$child: [{ _$id: 'panel', _$type: 'Sprite', name: 'Panel', width: 320, height: 180 }],
});
const makeProject = async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-prefab-editor-'));
  await fs.mkdir(path.join(root, 'assets', 'prefabs'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'assets', 'prefabs', 'fixture.lh'),
    `${JSON.stringify(valid(), null, 2)}\n`,
  );
  return root;
};

test('prefab editor validates hierarchy and rejects traversal', () => {
  assert.doesNotThrow(() => validatePrefabHierarchy(valid()));
  assert.throws(
    () =>
      validatePrefabHierarchy({ ...valid(), _$child: [{ ...valid()._$child[0], anchorX: 1.2 }] }),
    /between 0 and 1/,
  );
  assert.throws(
    () => validatePrefabHierarchy({ ...valid(), _$type: 'MeshSprite3D' }),
    /unsupported/,
  );
  assert.throws(
    () =>
      validatePrefabHierarchy({
        ...valid(),
        _$child: [{ _$id: 'root', _$type: 'Sprite', name: 'same' }],
      }),
    /unique/,
  );
  assert.throws(
    () =>
      validatePrefabHierarchy({
        ...valid(),
        _$child: [
          { _$id: 'a', _$type: 'Sprite', name: 'same' },
          { _$id: 'b', _$type: 'Sprite', name: 'same' },
        ],
      }),
    /unique/,
  );
  const args = parsePrefabEditorArgs(['--project', '/tmp', '--prefab', 'assets/a.lh']);
  assert.equal(args.projectRoot, '/tmp');
  assert.doesNotThrow(() =>
    parsePrefabEditorArgs(['--project', '/tmp', '--prefab', 'assets/scenes/a.ls']),
  );
  assert.throws(
    () => parsePrefabEditorArgs(['--project', '/tmp', '--prefab', '../secret.lh']),
    /project-relative/,
  );
  assert.throws(
    () => parsePrefabEditorArgs(['--project', '/tmp', '--prefab', 'assets/a.json']),
    /\.lh or \.ls/,
  );
  assert.doesNotThrow(() => validatePrefabHierarchy(validScene()));
});

test('prefab editor keeps the 2D feature and library profile isolated', async () => {
  assert.deepEqual([...PREFAB_EDITOR_FEATURES], ['core', '2d', 'ui']);
  assert.deepEqual(
    [...PREFAB_EDITOR_ENGINE_FILES],
    ['laya.core.js', 'laya.webgl_2D.js', 'laya.ui.js'],
  );
  const bundle = await buildPrefabEditorBundle();
  const clientSource = await fs.readFile(
    path.join(repoRoot, 'packages', 'compiler', 'prefab-editor-client.ts'),
    'utf8',
  );
  assert.match(clientSource, /const PREFAB_EDITOR_FEATURES = \['core', '2d', 'ui'\]/);
  assert.match(clientSource, /features: \[\.\.\.PREFAB_EDITOR_FEATURES\]/);
  assert.ok(bundle.length > 100_000);
});

test('asset inventory is rooted at assets and supports selecting another static definition', async () => {
  const project = await makeProject();
  await fs.mkdir(path.join(project, 'assets', 'scenes', 'nested'), { recursive: true });
  const scene = path.join(project, 'assets', 'scenes', 'nested', 'fixture.ls');
  await fs.writeFile(scene, `${JSON.stringify(validScene(), null, 2)}\n`);
  await fs.writeFile(
    path.join(project, 'assets', 'scenes', 'nested', 'icon.png'),
    Buffer.from([137, 80, 78, 71]),
  );
  try {
    const entries = await scanProjectAssets(project);
    assert.deepEqual(
      entries.map((entry) => entry.path),
      [
        'assets/prefabs/fixture.lh',
        'assets/scenes/nested/fixture.ls',
        'assets/scenes/nested/icon.png',
      ],
    );
    assert.equal(entries.find((entry) => entry.path.endsWith('.ls')).kind, 'scene');
    assert.equal(entries.find((entry) => entry.path.endsWith('.png')).kind, 'image');
    const editor = await createPrefabEditorServer({
      projectRoot: project,
      prefab: 'assets/prefabs/fixture.lh',
      port: 0,
      bundle: await buildPrefabEditorBundle(),
    });
    try {
      const address = await editor.listening;
      const base = `http://127.0.0.1:${address.port}`;
      let response = await authorizedFetch(editor, `${base}/api/assets`);
      assert.equal(response.status, 200);
      const inventory = await response.json();
      assert.equal(inventory.root, 'assets');
      assert.equal(inventory.entries.length, 3);
      response = await authorizedFetch(
        editor,
        `${base}/api/prefab?prefab=${encodeURIComponent('assets/scenes/nested/fixture.ls')}`,
      );
      assert.equal(response.status, 200);
      assert.equal((await response.json()).path, 'assets/scenes/nested/fixture.ls');
      response = await authorizedFetch(
        editor,
        `${base}/api/prefab?prefab=${encodeURIComponent('../secret.lh')}`,
      );
      assert.equal(response.status, 400);
    } finally {
      await editor.close();
    }
  } finally {
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('prefab editor API performs revision-checked atomic saves and backups', async () => {
  const project = await makeProject();
  const bundle = await buildPrefabEditorBundle();
  const editor = await createPrefabEditorServer({
    projectRoot: project,
    prefab: 'assets/prefabs/fixture.lh',
    port: 0,
    bundle,
  });
  try {
    const address = await editor.listening;
    const base = `http://127.0.0.1:${address.port}`;
    let response = await authorizedFetch(editor, `${base}/api/prefab`);
    assert.equal(response.status, 200);
    const loaded = await response.json();
    const changed = structuredClone(loaded.prefab);
    changed._$child[0].x = 44;
    response = await authorizedFetch(editor, `${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: 'stale', prefab: changed }),
    });
    assert.equal(response.status, 409);
    const before = await fs.readFile(path.join(project, 'assets', 'prefabs', 'fixture.lh'), 'utf8');
    assert.match(before, /"x": 12/);
    response = await authorizedFetch(editor, `${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: loaded.revision, prefab: changed }),
    });
    assert.equal(response.status, 200);
    const saved = await response.json();
    assert.equal(saved.saved, true);
    assert.equal(
      (
        await fs.readFile(path.join(project, 'assets', 'prefabs', 'fixture.lh.bak'), 'utf8')
      ).includes('"x": 12'),
      true,
    );
    assert.equal(
      (await fs.readFile(path.join(project, 'assets', 'prefabs', 'fixture.lh'), 'utf8')).includes(
        '"x": 44',
      ),
      true,
    );
    const invalid = {
      ...changed,
      _$child: [
        { _$id: 'bad', _$type: 'Sprite', name: 'dup' },
        { _$id: 'bad2', _$type: 'Sprite', name: 'dup' },
      ],
    };
    response = await authorizedFetch(editor, `${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: saved.revision, prefab: invalid }),
    });
    assert.equal(response.status, 400);
    assert.equal(
      (await fs.readFile(path.join(project, 'assets', 'prefabs', 'fixture.lh'), 'utf8')).includes(
        '"x": 44',
      ),
      true,
    );
  } finally {
    await editor.close();
    await fs.rm(project, { recursive: true, force: true });
  }
});

test('scene editor loads and saves the same hierarchy contract as a prefab', async () => {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-scene-editor-'));
  await fs.mkdir(path.join(project, 'assets', 'scenes'), { recursive: true });
  const file = path.join(project, 'assets', 'scenes', 'fixture.ls');
  await fs.writeFile(file, `${JSON.stringify(validScene(), null, 2)}\n`);
  const editor = await createPrefabEditorServer({
    projectRoot: project,
    prefab: 'assets/scenes/fixture.ls',
    port: 0,
    bundle: await buildPrefabEditorBundle(),
  });
  try {
    const address = await editor.listening;
    const base = `http://127.0.0.1:${address.port}`;
    const response = await authorizedFetch(editor, `${base}/api/prefab`);
    assert.equal(response.status, 200);
    const loaded = await response.json();
    assert.equal(loaded.path, 'assets/scenes/fixture.ls');
    assert.equal(loaded.prefab._$type, 'Scene');
    const changed = structuredClone(loaded.prefab);
    changed._$child[0].x = 64;
    const saved = await authorizedFetch(editor, `${base}/api/save`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ baseRevision: loaded.revision, prefab: changed }),
    });
    assert.equal(saved.status, 200);
    assert.match(await fs.readFile(file, 'utf8'), /"x": 64/);
    assert.match(await fs.readFile(`${file}.bak`, 'utf8'), /"name": "Panel"/);
  } finally {
    await editor.close();
    await fs.rm(project, { recursive: true, force: true });
  }
});
