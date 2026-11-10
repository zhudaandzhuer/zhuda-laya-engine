import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  createPreviewServer,
  liveReloadScript,
  parseWatchArgs,
  watchConsumer,
} from '../packages/compiler/prefab-watch.mjs';

test('prefab watch arguments and reload client are deterministic', () => {
  const args = parseWatchArgs([
    '--project',
    process.cwd(),
    '--host',
    '127.0.0.1',
    '--port',
    '8899',
  ]);
  assert.equal(args.port, 8899);
  assert.equal(args.host, '127.0.0.1');
  assert.throws(
    () => parseWatchArgs(['--project', process.cwd(), '--port', '0']),
    /Invalid --port/,
  );
  assert.match(liveReloadScript(), /EventSource\('\/__zhuda_reload'\)/);
  assert.match(liveReloadScript(), /location\.reload/);
});

test('watcher close drains an in-flight build and never starts queued work after disposal', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-watch-close-'));
  let finish,
    calls = 0;
  const watcher = watchConsumer({
    project: root,
    host: '127.0.0.1',
    port: 0,
    build: () => {
      calls++;
      return new Promise((resolve) => {
        finish = resolve;
      });
    },
    log: { log() {}, error() {}, warn() {} },
  });
  await watcher.preview.listening;
  const active = watcher.rebuild();
  await watcher.rebuild('queued');
  let closed = false;
  const closing = watcher.close().then(() => {
    closed = true;
  });
  await Promise.resolve();
  assert.equal(closed, false);
  finish({ ok: true });
  await active;
  await closing;
  assert.equal(calls, 1);
  assert.equal(await watcher.rebuild('after close'), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test('preview server injects live reload only into generated entry pages', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-watch-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><body>index</body>');
  fs.writeFileSync(path.join(root, 'prefab-preview.html'), '<!doctype html><body>prefab</body>');
  fs.writeFileSync(path.join(root, 'app.js'), "console.log('app')");
  const preview = createPreviewServer({ root, host: '127.0.0.1', port: 0 });
  try {
    await preview.listening;
    const address = preview.server.address();
    const base = `http://127.0.0.1:${address.port}`;
    const index = await (await fetch(`${base}/index.html`)).text();
    const prefab = await (await fetch(`${base}/prefab-preview.html`)).text();
    const app = await (await fetch(`${base}/app.js`)).text();
    assert.match(index, /data-zhuda-live-reload/);
    assert.match(prefab, /__zhuda_reload/);
    assert.doesNotMatch(app, /data-zhuda-live-reload/);
    assert.notEqual((await fetch(`${base}/%2e%2e/%2e%2e/etc/passwd`)).status, 200);
  } finally {
    await preview.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
