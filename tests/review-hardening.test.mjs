import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createEditorAccess, isAllowedRequestHost } from '../packages/compiler/editor-http.mjs';
import { createPreviewServer } from '../packages/compiler/prefab-watch.mjs';
import { DirectoryAssetProvider } from '../packages/core/runtime3d/AssetProvider.ts';
import { EngineGuard } from '../packages/core/RuntimeGuards.ts';

const request = (headers, url = '/', method = 'GET', port = 8891) => ({
  headers,
  rawHeaders: Object.entries(headers).flat(),
  socket: { localPort: port },
  url,
  method,
});
const response = () => {
  const headers = {};
  return { headers, setHeader: (name, value) => (headers[name] = value) };
};

test('editors refuse a non-loopback bind unless remote access is requested', () => {
  for (const host of ['0.0.0.0', '192.168.1.20', 'devbox.local'])
    assert.throws(
      () => createEditorAccess(host),
      /Refusing to serve the editor on non-loopback host/,
    );
  for (const host of ['127.0.0.1', 'localhost']) {
    const access = createEditorAccess(host);
    assert.equal(access.remote, false);
    assert.equal(access.startQuery, '');
    assert.doesNotThrow(() => access.validate(request({ host: `${host}:8891` }), response()));
  }
});

test('remote editor mode needs the start key or its session cookie for every request', () => {
  const access = createEditorAccess('0.0.0.0', { allowRemote: true });
  assert.equal(access.remote, true);
  assert.match(access.startQuery, /^key=[a-f0-9]{64}$/);
  const host = { host: '192.168.1.20:8891' };
  // The page that carries the API token is no longer handed to anyone who can reach the port.
  assert.throws(() => access.validate(request(host), response()), /Remote editor session required/);
  assert.throws(
    () => access.validate(request(host, '/__project/assets/a.png'), response()),
    /session required/,
  );
  assert.throws(
    () => access.validate(request(host, `/?key=${'a'.repeat(64)}`), response()),
    /session required/,
  );
  assert.throws(
    () =>
      access.validate(
        request({ ...host, cookie: `zhuda_editor_8891=${'b'.repeat(64)}` }),
        response(),
      ),
    /session required/,
  );

  const first = response();
  access.validate(request(host, `/?${access.startQuery}`), first);
  const cookie = String(first.headers['Set-Cookie']);
  assert.match(cookie, /^zhuda_editor_8891=[a-f0-9]{64}; HttpOnly; SameSite=Strict; Path=\/$/);
  const session = cookie.split(';')[0];
  const later = response();
  assert.doesNotThrow(() =>
    access.validate(
      request({ ...host, cookie: `theme=dark; ${session}` }, '/__editor/editor.js'),
      later,
    ),
  );
  assert.equal(later.headers['Set-Cookie'], undefined, 'the cookie is issued once');
  // The API still needs its own capability on top of the session.
  assert.throws(
    () => access.validate(request({ ...host, cookie: session }, '/api/prefab'), response()),
    /Invalid editor capability/,
  );
  assert.doesNotThrow(() =>
    access.validate(
      request({ ...host, cookie: session, 'x-zhuda-editor-token': access.token }, '/api/prefab'),
      response(),
    ),
  );
  // A specific remote bind still pins the Host name.
  const pinned = createEditorAccess('192.168.1.20', { allowRemote: true });
  assert.throws(
    () =>
      pinned.validate(request({ host: 'evil.example:8891' }, `/?${pinned.startQuery}`), response()),
    /Invalid Host/,
  );
});

test('local tool servers validate the Host header', () => {
  assert.equal(isAllowedRequestHost(request({ host: '127.0.0.1:8891' }), '127.0.0.1'), true);
  assert.equal(isAllowedRequestHost(request({ host: 'localhost:8891' }), '127.0.0.1'), true);
  assert.equal(isAllowedRequestHost(request({ host: 'evil.example:8891' }), '127.0.0.1'), false);
  assert.equal(isAllowedRequestHost(request({ host: '127.0.0.1:9999' }), '127.0.0.1'), false);
  assert.equal(isAllowedRequestHost(request({ host: '127.0.0.1:8891/x' }), '127.0.0.1'), false);
  assert.equal(isAllowedRequestHost(request({}), '127.0.0.1'), false);
  assert.equal(isAllowedRequestHost(request({ host: '192.168.1.20:8891' }), '0.0.0.0'), true);
});

const get = (port, urlPath, headers = {}) =>
  new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: urlPath, headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });

test('preview server survives malformed URLs and rejects foreign hosts', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-watch-'));
  fs.writeFileSync(path.join(root, 'index.html'), '<html><body>ok</body></html>');
  const preview = createPreviewServer({ root, port: 0, reload: false });
  const { port } = await preview.listening;
  t.after(async () => {
    await preview.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
  assert.equal((await get(port, '/')).status, 200);
  assert.equal((await get(port, '/%E0%A4%A')).status, 400, 'a malformed escape is a client error');
  assert.equal((await get(port, '/..%2f..%2fetc%2fhostname')).status, 400);
  assert.equal((await get(port, '/')).status, 200, 'the server is still running');
  assert.equal((await get(port, '/', { Host: `evil.example:${port}` })).status, 403);
  assert.equal((await get(port, '/', { Host: `localhost:${port}` })).status, 200);
});

test('a rejected download is cancelled instead of streaming on in the background', async () => {
  let pulled = 0,
    cancelled = false,
    aborted = false;
  const fetch = async (_url, init) => {
    init.signal.addEventListener('abort', () => (aborted = true));
    return new Response(
      new ReadableStream({
        pull(controller) {
          if (++pulled > 50) return controller.close();
          controller.enqueue(new Uint8Array(1024));
        },
        cancel() {
          cancelled = true;
        },
      }),
      { status: 200 },
    );
  };
  const provider = new DirectoryAssetProvider({
    baseUrl: 'https://cdn.example/a/',
    fetch,
    maxBytes: 2048,
  });
  await assert.rejects(provider.load('big.bin'), (error) => error.code === 'too-large');
  assert.equal(aborted, true, 'the request signal is aborted');
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.ok(pulled < 10, `download stopped early (pulled ${pulled} chunks)`);
  void cancelled;

  // Success leaves the request alone.
  let okAborted = false;
  const ok = new DirectoryAssetProvider({
    baseUrl: 'https://cdn.example/a/',
    fetch: async (_url, init) => {
      init.signal.addEventListener('abort', () => (okAborted = true));
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
    },
  });
  assert.deepEqual([...(await ok.load('small.bin')).bytes], [1, 2, 3]);
  assert.equal(okAborted, false);
});

test('a manifest can be enforced as an allowlist', async () => {
  const manifest = {
    schemaVersion: 1,
    entries: [
      {
        id: 'known.txt',
        bytes: 5,
        sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
      },
    ],
  };
  const fetch = async (url) =>
    new Response(
      new TextEncoder().encode(String(url).endsWith('known.txt') ? 'hello' : 'anything'),
    );
  const options = { baseUrl: 'https://cdn.example/a/', fetch, manifest };
  // Default keeps the previous behaviour.
  assert.equal((await new DirectoryAssetProvider(options).load('extra.txt')).manifest, undefined);
  const strict = new DirectoryAssetProvider({ ...options, unlisted: 'reject' });
  assert.equal((await strict.load('known.txt')).manifest.id, 'known.txt');
  await assert.rejects(
    strict.load('extra.txt'),
    (error) => error.code === 'integrity' && /not listed in the manifest/.test(error.message),
  );
  assert.throws(
    () => new DirectoryAssetProvider({ ...options, unlisted: 'warn' }),
    /Invalid unlisted policy/,
  );
});

test('engine health reports only what is actually loaded', (t) => {
  const saved = globalThis.Laya;
  t.after(() => {
    if (saved === undefined) delete globalThis.Laya;
    else globalThis.Laya = saved;
  });
  delete globalThis.Laya;
  assert.equal(EngineGuard.inspectEngineHealth().engineVersion, 'unknown');
  globalThis.Laya = { version: '3.4.2', Laya3D: {} };
  assert.equal(EngineGuard.inspectEngineHealth().engineVersion, '3.4.2');
  assert.equal(EngineGuard.checkPhysics3D().bulletLoaded, false, '3D core without Bullet');
  globalThis.Laya = { Laya3D: {}, btStatics: { bt: {} } };
  assert.equal(EngineGuard.checkPhysics3D().bulletLoaded, true);
});

test('package manifest ships built entries only and builds once per pack', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const targets = [];
  const walk = (value) =>
    typeof value === 'string' ? targets.push(value) : Object.values(value).forEach(walk);
  walk(pkg.exports['.']);
  walk(pkg.exports['./core']);
  assert.ok(targets.length >= 6);
  for (const target of targets)
    assert.ok(!/\.ts$/.test(target) || /\.d\.ts$/.test(target), `source file exported: ${target}`);
  assert.equal(pkg.scripts.prepack, undefined, 'prepare already builds for pack and publish');
  assert.match(pkg.scripts.prepare, /1>&2$/, 'build output must not pollute npm pack --json');
  assert.doesNotMatch(pkg.scripts.start, /python/);
  assert.match(pkg.dependencies.typescript, /^\d+\.\d+\.\d+$/);
});

test('two remote editors on one host keep separate session cookies', () => {
  const prefab = createEditorAccess('0.0.0.0', { allowRemote: true });
  const model = createEditorAccess('0.0.0.0', { allowRemote: true });
  const issue = (access, port) => {
    const res = response();
    access.validate(
      request({ host: `192.168.1.20:${port}` }, `/?${access.startQuery}`, 'GET', port),
      res,
    );
    return String(res.headers['Set-Cookie']).split(';')[0];
  };
  const prefabCookie = issue(prefab, 8891);
  const modelCookie = issue(model, 8892);
  assert.notEqual(prefabCookie.split('=')[0], modelCookie.split('=')[0]);
  // The browser sends both cookies to both ports; each editor finds its own.
  const both = `${prefabCookie}; ${modelCookie}`;
  for (const [access, port] of [
    [prefab, 8891],
    [model, 8892],
  ])
    assert.doesNotThrow(() =>
      access.validate(
        request({ host: `192.168.1.20:${port}`, cookie: both }, '/__editor/editor.js', 'GET', port),
        response(),
      ),
    );
});
