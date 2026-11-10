import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { createPrefabEditorServer } from '../packages/compiler/prefab-editor-server.mjs';
import { createModelEditorServer } from '../packages/compiler/model-editor.mjs';
import { authorizedFetch } from './helpers/editor-request.mjs';

function raw(port, route, headers = {}, body) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path: route, method: body === undefined ? 'GET' : 'POST', headers, agent: false }, response => {
      let bytes = '';
      response.on('data', chunk => { bytes += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: bytes, headers: response.headers }));
    });
    request.on('error', reject);
    request.end(body);
  });
}

for (const [kind, create, selection] of [
  ['prefab', createPrefabEditorServer, { prefab: 'assets/a.lh' }],
  ['model', createModelEditorServer, { asset: 'assets/model.gltf' }],
]) {
  test(`${kind} editor rejects rebinding, foreign requests and private assets`, async () => {
    const project = await fs.mkdtemp(path.join(os.tmpdir(), 'zhuda-editor-security-'));
    let editor, second;
    try {
      await fs.mkdir(path.join(project, 'assets'));
      await fs.mkdir(path.join(project, '.git'));
      await fs.writeFile(path.join(project, '.env'), 'DUMMY_SECRET=fixture');
      await fs.writeFile(path.join(project, '.git/config'), 'dummy config');
      await fs.writeFile(path.join(project, 'assets/.hidden'), 'dummy hidden');
      await fs.writeFile(path.join(project, 'assets/a.lh'), JSON.stringify({ _$id: 'root', _$type: 'Sprite', name: 'Root', width: 100, height: 100 }));
      await fs.writeFile(path.join(project, 'assets/model.gltf'), '{}');
      await fs.symlink(path.join(project, '.env'), path.join(project, 'assets/leak.txt'));
      await fs.symlink(path.join(project, 'assets/.hidden'), path.join(project, 'assets/alias.txt'));
      editor = await create({ projectRoot: project, ...selection, port: 0, bundle: '/* transport fixture */' });
      const { port } = await editor.listening;
      const base = `http://127.0.0.1:${port}`;
      const host = `127.0.0.1:${port}`;
      for (const headers of [{ Host: `evil.invalid:${port}` }, { Host: host, Origin: 'https://evil.invalid' }, { Host: host, Origin: 'null' }, { Host: host, 'Sec-Fetch-Site': 'cross-site' }, { Host: 'localhost:1' }]) {
        const result = await raw(port, '/', headers);
        assert.equal(result.status, 403);
        assert.ok(!result.body.includes(editor.token));
      }
      for (const target of ['.env', '.git/config', 'assets/.hidden', 'assets/%2ehidden', 'assets/leak.txt', 'assets/alias.txt', 'assets/a.lh.bak', 'assets/%2e%2e/.env']) {
        const result = await raw(port, '/__project/' + target);
        assert.ok([403, 404].includes(result.status), `${target}: ${result.status}`);
        assert.ok(!result.body.includes('DUMMY_SECRET'));
      }
      const publicAsset = await raw(port, '/__project/assets/model.gltf');
      assert.equal(publicAsset.status, 200);
      assert.equal(publicAsset.headers['x-content-type-options'], 'nosniff');
      assert.equal((await raw(port, '/api/assets')).status, 403);
      await fs.unlink(path.join(project, 'assets/leak.txt'));
      const inventory = JSON.parse((await raw(port, '/api/assets', { 'X-Zhuda-Editor-Token': editor.token })).body);
      assert.ok(inventory.entries.every(entry => !entry.path.includes('.hidden')));
      const page = await raw(port, '/');
      assert.ok(page.body.includes(editor.token));
      assert.equal(page.headers['referrer-policy'], 'no-referrer');
      second = await create({ projectRoot: project, ...selection, port: 0, bundle: '/* transport fixture */' });
      const otherPort = (await second.listening).port;
      assert.notEqual(second.token, editor.token);
      assert.equal((await raw(otherPort, '/api/assets', { 'X-Zhuda-Editor-Token': editor.token })).status, 403);
      if (kind === 'prefab') {
        const current = JSON.parse((await raw(port, '/api/prefab', { 'X-Zhuda-Editor-Token': editor.token })).body);
        const original = await fs.readFile(path.join(project, 'assets/a.lh'), 'utf8');
        const body = JSON.stringify({ baseRevision: current.revision, prefab: { ...current.prefab, x: 73 } });
        const valid = { Host: host, Origin: base, 'Content-Type': 'application/json', 'X-Zhuda-Editor-Token': editor.token };
        for (const [headers, expected] of [
          [{ ...valid, Origin: 'https://evil.invalid' }, 403],
          [{ ...valid, Origin: undefined }, 403],
          [{ ...valid, 'Content-Type': 'text/plain' }, 415],
          [{ ...valid, 'X-Zhuda-Editor-Token': 'bad' }, 403],
        ]) {
          const clean = Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined));
          assert.equal((await raw(port, '/api/save', clean, body)).status, expected);
          assert.equal(await fs.readFile(path.join(project, 'assets/a.lh'), 'utf8'), original);
        }
        assert.equal((await raw(port, '/api/save', valid, body)).status, 200);
        assert.equal(JSON.parse(await fs.readFile(path.join(project, 'assets/a.lh'), 'utf8')).x, 73);
      }
    } finally {
      await second?.close();
      await editor?.close();
      await fs.rm(project, { recursive: true, force: true });
    }
  });
}
