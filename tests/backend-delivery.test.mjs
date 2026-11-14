import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_BACKEND_RETRY_KEY,
  ZHUDA_FALLBACK_REASONS,
  chooseZhudaBackend,
  loadZhudaBackend,
  probeZhudaBackend,
  retryZhudaBackend,
} from '../packages/core/runtime3d/BackendChoice.ts';
import { prepareRenderer } from '../packages/core/runtime3d/Renderer.ts';
import { webgpuPreparation } from '../packages/compiler/webgpu-loader.mjs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';
import { TopologyResolver } from '../packages/core/TopologyGraph.ts';
import { runDoctorAudit } from '../packages/compiler/zhuda-doctor.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');

const hardware = { secure: true, api: true, adapter: 'hardware' };

test('the decision table: WebGPU with a hardware adapter, WebGL with its reason otherwise', () => {
  const table = [
    [hardware, {}, null, 'webgpu', null],
    [{ ...hardware, adapter: 'software' }, {}, null, 'webgl', 'software-adapter'],
    [{ ...hardware, adapter: 'software' }, { allowSoftware: true }, null, 'webgpu', null],
    [{ ...hardware, adapter: 'none' }, {}, null, 'webgl', 'no-adapter'],
    [{ ...hardware, adapter: 'timeout' }, {}, null, 'webgl', 'adapter-timeout'],
    [{ ...hardware, adapter: 'error' }, {}, null, 'webgl', 'adapter-error'],
    [
      { ...hardware, adapter: 'error', message: 'lost\n  in   space' },
      {},
      null,
      'webgl',
      'adapter-error: lost in space',
    ],
    // No API: whatever the adapter field says is not read.
    [{ secure: true, api: false, adapter: 'hardware' }, {}, null, 'webgl', 'no-webgpu-api'],
    // An insecure page has no API either; the reason is the one a person can act on.
    [{ secure: false, api: false, adapter: 'none' }, {}, null, 'webgl', 'insecure-context'],
    [{ secure: false, api: true, adapter: 'hardware' }, {}, null, 'webgl', 'insecure-context'],
    // WebGL because the game said so is not a fallback.
    [hardware, { prefer: 'webgl' }, null, 'webgl', null],
    [null, { prefer: 'webgl' }, 'boot failed', 'webgl', null],
    // A page loaded again after WebGPU failed to start does not ask the browser.
    [hardware, {}, 'WEBGPU_ADAPTER: none', 'webgl', 'retry: WEBGPU_ADAPTER: none'],
    [null, {}, 'device lost', 'webgl', 'retry: device lost'],
  ];
  for (const [facts, options, retry, backend, fallbackReason] of table)
    assert.deepEqual(
      chooseZhudaBackend(facts, options, retry),
      { backend, fallbackReason },
      JSON.stringify([facts, options, retry]),
    );
  // Every reason starts with one of the published names.
  for (const row of table)
    if (row[4]) assert.ok(ZHUDA_FALLBACK_REASONS.includes(row[4].split(':')[0]), row[4]);
  assert.ok(chooseZhudaBackend(hardware, {}, 'x'.repeat(500)).fallbackReason.length < 180);
  assert.throws(() => chooseZhudaBackend(hardware, { prefer: 'metal' }), /prefer is/);
  assert.throws(() => chooseZhudaBackend(hardware, { allowSoftware: 1 }), /allowSoftware/);
  assert.throws(() => chooseZhudaBackend(null), /what the browser has/);
  assert.throws(() => chooseZhudaBackend({ ...hardware, adapter: 'fast' }), /adapter is/);
});

test('asking the browser never rejects and never waits longer than it is told', async () => {
  const timers = { setTimeout, clearTimeout };
  const ask = (navigator, extra = {}) =>
    probeZhudaBackend({ isSecureContext: true, navigator, ...timers, ...extra }, 100);
  assert.deepEqual(await ask({}), {
    facts: { secure: true, api: false, adapter: 'none' },
    adapter: null,
  });
  assert.deepEqual(
    (await ask({ gpu: { requestAdapter: async () => null } }, { isSecureContext: false })).facts,
    { secure: false, api: true, adapter: 'none' },
  );
  assert.equal((await ask({ gpu: { requestAdapter: async () => null } })).facts.adapter, 'none');
  assert.deepEqual(
    await ask({
      gpu: {
        requestAdapter: async () => ({ info: { vendor: 'apple', architecture: 'metal-3' } }),
      },
    }),
    {
      facts: hardware,
      adapter: { vendor: 'apple', architecture: 'metal-3', isFallbackAdapter: false },
    },
  );
  // Both places a browser has said "this adapter draws on the CPU".
  for (const found of [{ info: { isFallbackAdapter: true } }, { isFallbackAdapter: true }])
    assert.equal(
      (await ask({ gpu: { requestAdapter: async () => found } })).facts.adapter,
      'software',
    );
  const thrown = await ask({
    gpu: {
      requestAdapter() {
        throw Error('blocked by policy');
      },
    },
  });
  assert.deepEqual(thrown.facts, { ...hardware, adapter: 'error', message: 'blocked by policy' });
  const started = Date.now();
  const never = await ask({ gpu: { requestAdapter: () => new Promise(() => {}) } });
  assert.equal(never.facts.adapter, 'timeout');
  assert.ok(Date.now() - started < 2000);
  await assert.rejects(probeZhudaBackend({}, 5), /timeoutMs/);
});

/** A page: scripts "load" when their address is not in `missing`, in the order they were added. */
function page({ gpu, missing = [], stored = {}, storage = true } = {}) {
  const added = [];
  const env = {
    isSecureContext: true,
    navigator: gpu === undefined ? {} : { gpu },
    setTimeout,
    clearTimeout,
    performance: { now: () => 0 },
    location: {
      reloads: 0,
      reload() {
        this.reloads++;
      },
    },
    document: {
      createElement: (tag) => ({ tag }),
      head: {
        appendChild(node) {
          added.push(node);
          if (node.tag !== 'script') return;
          queueMicrotask(() => {
            if (missing.includes(node.src)) node.onerror();
            else {
              env.ran.push(node.src);
              node.onload();
            }
          });
        },
      },
    },
    ran: [],
    added,
  };
  if (storage)
    env.sessionStorage = {
      getItem: (key) => stored[key] ?? null,
      setItem: (key, value) => (stored[key] = value),
      removeItem: (key) => delete stored[key],
    };
  else
    Object.defineProperty(env, 'sessionStorage', {
      get() {
        throw Error('SecurityError');
      },
    });
  env.stored = stored;
  return env;
}
const real = { requestAdapter: async () => ({ info: { vendor: 'x', architecture: 'y' } }) };
const lists = {
  webgpu: [{ src: 'gpu.js', integrity: 'sha384-gpu' }],
  webgl: [{ src: 'gl.js', integrity: 'sha384-gl' }],
};

test('the loader loads one backend, in order, and records what it did', async () => {
  const env = page({ gpu: real });
  const calls = [];
  const record = await loadZhudaBackend(
    {
      webgpu: ['libs/core.js', 'libs/gpu.js'],
      webgl: ['libs/core.js', 'libs/gl.js'],
      after: [() => calls.push([...env.ran]), 'app.js'],
    },
    env,
  );
  assert.deepEqual(env.ran, ['libs/core.js', 'libs/gpu.js', 'app.js']);
  assert.deepEqual(calls, [['libs/core.js', 'libs/gpu.js']], 'a function runs in its place');
  assert.equal(record.backend, 'webgpu');
  assert.equal(record.fallbackReason, null);
  assert.deepEqual(record.facts, hardware);
  assert.equal(env.ZhudaBackend, record);
  assert.ok(Object.isFrozen(record));
  // The later scripts are announced to the browser at once, so they download together.
  assert.deepEqual(
    env.added.filter((node) => node.tag === 'link').map((node) => [node.rel, node.as, node.href]),
    [
      ['preload', 'script', 'app.js'],
      ['preload', 'script', 'libs/gpu.js'],
    ],
  );
  // A script of the local build carries no integrity and asks for no CORS.
  assert.equal(env.added.find((node) => node.src === 'libs/gpu.js').crossOrigin, undefined);
  await assert.rejects(loadZhudaBackend(lists, env), /ZHUDA_DUPLICATE_RUNTIME/);

  const none = page({});
  const fallback = await loadZhudaBackend(lists, none);
  assert.deepEqual(none.ran, ['gl.js']);
  assert.equal(fallback.fallbackReason, 'no-webgpu-api');
  const script = none.added.find((node) => node.tag === 'script');
  assert.deepEqual(
    [script.integrity, script.crossOrigin, script.async],
    ['sha384-gl', 'anonymous', false],
  );

  // A game whose settings say WebGL: the browser is not asked.
  let asked = 0;
  const preferred = page({ gpu: { requestAdapter: async () => (asked++, {}) } });
  const quiet = await loadZhudaBackend({ ...lists, prefer: 'webgl' }, preferred);
  assert.deepEqual(
    [asked, quiet.backend, quiet.fallbackReason, quiet.facts],
    [0, 'webgl', null, null],
  );

  for (const bad of [
    {},
    { webgpu: [], webgl: ['a.js'] },
    { webgpu: ['a.js'], webgl: [{}] },
    { ...lists, after: [1] },
    { ...lists, timeoutMs: 1 },
    { ...lists, prefer: 'both' },
  ])
    await assert.rejects(loadZhudaBackend(bad, page({ gpu: real })), /Invalid/);
  await assert.rejects(loadZhudaBackend(lists, { ...page({}), Laya: {} }), /ZHUDA_DUPLICATE/);
});

test('a WebGPU bundle that does not load: WebGL in its place, or the page again', async () => {
  // Nothing of WebGPU ran: the same realm takes WebGL.
  const env = page({ gpu: real, missing: ['gpu.js'] });
  const record = await loadZhudaBackend(lists, env);
  assert.deepEqual(env.ran, ['gl.js']);
  assert.equal(record.backend, 'webgl');
  assert.equal(record.fallbackReason, 'bundle-failed: gpu.js');
  assert.equal(retryZhudaBackend('again', env), false, 'nothing to fall back to from WebGL');

  // A WebGL bundle that does not load is an error: there is nothing below it.
  await assert.rejects(
    loadZhudaBackend(lists, page({ missing: ['gl.js'] })),
    /gl\.js did not load/,
  );

  // Half a WebGPU backend ran: the realm cannot take WebGL; the page is loaded again.
  const half = page({ gpu: real, missing: ['libs/gpu.js'] });
  const error = await loadZhudaBackend(
    { webgpu: ['libs/core.js', 'libs/gpu.js'], webgl: ['libs/core.js', 'libs/gl.js'] },
    half,
  ).catch((e) => e);
  assert.equal(error.code, 'ZHUDA_LOADER_PARTIAL');
  assert.deepEqual(half.ran, ['libs/core.js']);
  assert.equal(half.ZhudaBackend, undefined);
  assert.equal(retryZhudaBackend(error.message, half), true);
  assert.equal(half.location.reloads, 1);
  // The next load of that page: WebGL, with the reason, once.
  const again = page({ gpu: real, stored: half.stored });
  const second = await loadZhudaBackend(lists, again);
  assert.deepEqual(again.ran, ['gl.js']);
  assert.match(second.fallbackReason, /^retry: ZHUDA_LOADER: libs\/gpu\.js did not load/);
  assert.equal(second.facts, null, 'the browser is not asked again');
  assert.equal(again.stored[ZHUDA_BACKEND_RETRY_KEY], undefined, 'the reason is used once');
  const third = await loadZhudaBackend(lists, page({ gpu: real, stored: again.stored }));
  assert.equal(third.backend, 'webgpu');
});

test('a WebGPU that loaded and did not start: the page again on WebGL, without a loop', async () => {
  const env = page({ gpu: real });
  await loadZhudaBackend(lists, env);
  assert.equal(retryZhudaBackend('WEBGPU_SHADER_COMPILER: HTTP 404', env), true);
  assert.equal(env.stored[ZHUDA_BACKEND_RETRY_KEY], 'WEBGPU_SHADER_COMPILER: HTTP 404');
  assert.equal(env.location.reloads, 1);
  const next = page({ gpu: real, stored: env.stored });
  const record = await loadZhudaBackend(lists, next);
  assert.equal(record.fallbackReason, 'retry: WEBGPU_SHADER_COMPILER: HTTP 404');
  assert.equal(retryZhudaBackend('still broken', next), false);
  assert.equal(next.location.reloads, 0);

  // A frame without session storage: nothing to carry the reason in, so no reload.
  const sandboxed = page({ gpu: real, storage: false });
  assert.equal((await loadZhudaBackend(lists, sandboxed)).backend, 'webgpu');
  assert.equal(retryZhudaBackend('boot failed', sandboxed), false);
  assert.equal(sandboxed.location.reloads, 0);
  // A page that never used the loader.
  assert.equal(retryZhudaBackend('x', page({})), false);
});

test("the renderer's report carries the loader's reason, on WebGL only", () => {
  const before = Object.getOwnPropertyDescriptor(globalThis, 'ZhudaBackend');
  const native = { WebGLRenderDeviceFactory: {} };
  try {
    assert.equal(prepareRenderer('webgl', native).diagnostics.fallbackReason, null);
    Object.defineProperty(globalThis, 'ZhudaBackend', {
      value: { backend: 'webgl', fallbackReason: 'no-adapter' },
      configurable: true,
    });
    assert.equal(prepareRenderer('webgl', native).diagnostics.fallbackReason, 'no-adapter');
    // A record that names the other backend is not this realm's.
    Object.defineProperty(globalThis, 'ZhudaBackend', {
      value: { backend: 'webgpu', fallbackReason: 'no-adapter' },
      configurable: true,
    });
    assert.equal(prepareRenderer('webgl', native).diagnostics.fallbackReason, null);
    Object.defineProperty(globalThis, 'ZhudaBackend', {
      value: { backend: 'webgl', fallbackReason: 42 },
      configurable: true,
    });
    assert.equal(prepareRenderer('webgl', native).diagnostics.fallbackReason, null);
  } finally {
    if (before) Object.defineProperty(globalThis, 'ZhudaBackend', before);
    else delete globalThis.ZhudaBackend;
  }
});

// --- The WebGPU compilers: fetched once for an origin ---------------------------
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const compilerBytes = {
  'shader_compiler_web.wasm': Buffer.from('glsl to spir-v'),
  'nagabind_bg.wasm': Buffer.from('spir-v to wgsl'),
};
const external = Object.entries(compilerBytes).map(([file, bytes]) => ({
  file,
  sha256: sha256(bytes),
}));

/** A page that runs the text `webgpuPreparation` makes, with its network and its cache. */
function compilerPage({
  resources = external,
  served = compilerBytes,
  cache = new Map(),
  ...rest
}) {
  const fetched = [];
  const urlOf = (request) => (typeof request === 'string' ? request : request.url);
  const sandbox = {
    crypto: globalThis.crypto,
    atob,
    URL,
    Response,
    location: { href: 'https://game.example/play/v2/' },
    document: { currentScript: { src: 'https://cdn.example/sdk/zhuda-3d-webgpu.js' } },
    ShaderCompiler: async ({ wasmBinary }) => ({ glsl: Buffer.from(wasmBinary).toString() }),
    wasm_bindgen: async ({ module_or_path }) => {
      sandbox.wgsl = Buffer.from(module_or_path).toString();
    },
    fetch: async (url, { signal }) => {
      if (signal.aborted) throw signal.reason;
      fetched.push(String(url));
      const bytes = served[String(url).split('/').pop()];
      return bytes
        ? { ok: true, status: 200, arrayBuffer: async () => Uint8Array.from(bytes).buffer }
        : { ok: false, status: 404 };
    },
    caches: {
      open: async (name) => {
        assert.equal(name, 'zhuda-webgpu-compilers');
        return {
          match: async (request) =>
            cache.has(urlOf(request))
              ? { arrayBuffer: async () => Uint8Array.from(cache.get(urlOf(request))).buffer }
              : undefined,
          put: async (request, response) =>
            void cache.set(urlOf(request), Buffer.from(await response.arrayBuffer())),
          delete: async (request) => cache.delete(urlOf(request)),
          keys: async () => [...cache.keys()].map((url) => ({ url })),
        };
      },
    },
    ...rest,
  };
  for (const [name, value] of Object.entries(sandbox))
    if (value === undefined) delete sandbox[name];
  vm.runInNewContext(
    webgpuPreparation({ shader: 'ShaderCompiler', naga: 'wasm_bindgen', resources }),
    sandbox,
  );
  return {
    sandbox,
    fetched,
    cache,
    prepare: (signal = new AbortController().signal) => sandbox.__ZHUDA_WEBGPU_PREPARE__(signal),
  };
}

test('fetched compilers are kept by their hash and checked wherever they come from', async () => {
  const first = compilerPage({});
  const made = await first.prepare();
  assert.equal(made.from, 'network');
  assert.equal(made.glslang.glsl, 'glsl to spir-v');
  assert.equal(first.sandbox.wgsl, 'spir-v to wgsl');
  assert.deepEqual(first.fetched, [
    'https://cdn.example/sdk/shader_compiler_web.wasm',
    'https://cdn.example/sdk/nagabind_bg.wasm',
  ]);
  assert.deepEqual(
    [...first.cache.keys()].sort(),
    external.map((r) => 'https://game.example/.zhuda-webgpu-compilers/' + r.sha256).sort(),
  );

  // The same origin, another release at another address: nothing is downloaded.
  const second = compilerPage({
    cache: first.cache,
    served: {},
    location: { href: 'https://game.example/play/v3/' },
  });
  assert.equal((await second.prepare()).from, 'cache');
  assert.deepEqual(second.fetched, []);
  assert.equal(second.sandbox.wgsl, 'spir-v to wgsl');

  // An entry that is not what its name says is deleted and fetched; an entry
  // of other compilers goes.
  const [glsl] = [...first.cache.keys()].filter((url) => url.endsWith(external[0].sha256));
  first.cache.set(glsl, Buffer.from('tampered'));
  first.cache.set('https://game.example/.zhuda-webgpu-compilers/old', Buffer.from('old'));
  const third = compilerPage({ cache: first.cache });
  assert.equal((await third.prepare()).from, 'network');
  assert.deepEqual(third.fetched, ['https://cdn.example/sdk/shader_compiler_web.wasm']);
  assert.equal(first.cache.get(glsl).toString(), 'glsl to spir-v');
  assert.equal(first.cache.size, 2);
});

test('a page without a cache, or with compilers in its script, starts as before', async () => {
  for (const page of [
    { caches: undefined },
    {
      caches: {
        open: async () => {
          throw new DOMException('denied', 'SecurityError');
        },
      },
    },
    // A frame with an address no cache key can be made from.
    { location: { href: 'about:srcdoc' } },
  ]) {
    const made = compilerPage(page);
    assert.equal((await made.prepare()).from, 'network');
    assert.equal(made.fetched.length, 2);
    assert.equal(made.cache.size, 0);
  }
  const inline = compilerPage({
    resources: external.map((r) => ({
      ...r,
      base64: compilerBytes[r.file].toString('base64'),
    })),
    caches: {
      open: async () => {
        throw Error('not asked for');
      },
    },
  });
  assert.equal((await inline.prepare()).from, 'inline');
  assert.deepEqual(inline.fetched, []);
});

test('wrong, missing or cancelled compilers fail the start and leave nothing in the cache', async () => {
  const wrong = compilerPage({
    served: { ...compilerBytes, 'nagabind_bg.wasm': Buffer.from('something else') },
  });
  await assert.rejects(wrong.prepare(), /WEBGPU_SHADER_COMPILER: integrity mismatch nagabind_bg/);
  assert.ok(![...wrong.cache.values()].some((bytes) => bytes.toString() === 'something else'));
  const missing = compilerPage({ served: {} });
  await assert.rejects(missing.prepare(), /WEBGPU_SHADER_COMPILER: .* HTTP 404/);
  assert.equal(missing.cache.size, 0);
  const cancelled = new AbortController();
  cancelled.abort(new Error('boot cancelled'));
  const never = compilerPage({});
  await assert.rejects(never.prepare(cancelled.signal), /boot cancelled/);
  assert.deepEqual(never.fetched, []);
  // Cancelled while the bytes were on their way: the compilers are not started.
  const late = new AbortController();
  const slow = compilerPage({
    ShaderCompiler: async () => assert.fail('started after the cancellation'),
  });
  const original = slow.sandbox.fetch;
  slow.sandbox.fetch = async (...args) => {
    const response = await original(...args);
    late.abort(new Error('left the page'));
    return response;
  };
  await assert.rejects(slow.prepare(late.signal), /left the page/);
});

// --- A consumer build for both backends ------------------------------------------
test('"renderer": "auto" ships both backends\' libraries and one loader call in their place', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-auto-consumer-'));
  try {
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'public/index.html'),
      '<div id="game"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->',
    );
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'auto-consumer-fixture',
        private: true,
        type: 'module',
        dependencies: { 'zhuda-laya-engine': '1.17.0' },
      }),
    );
    fs.writeFileSync(
      path.join(root, 'src/Main.ts'),
      'import { ZhudaEngine } from "zhuda-laya-engine"; void ZhudaEngine.boot({features:["core","2d","3d","spine42"]});',
    );
    const features = ['core', '2d', '3d', 'spine42'];
    const result = await runConsumerBuild({
      projectRoot: root,
      engineRoot,
      config: { features, renderer: 'auto', assetsDir: false, branding: { mode: 'none' } },
    });
    const web = path.join(root, 'dist/web');
    const gl = TopologyResolver.resolveByFeatures(features, 'webgl'),
      gpu = TopologyResolver.resolveByFeatures(features, 'webgpu');
    assert.equal(result.renderer, 'auto');
    assert.deepEqual(result.orderedLibraries, gl.orderedFiles);
    assert.deepEqual(result.backends, {
      webgl: { libraries: gl.orderedFiles },
      webgpu: { libraries: gpu.orderedFiles, supportFiles: gpu.supportFiles },
    });
    const manifest = JSON.parse(fs.readFileSync(path.join(web, 'payload-manifest.json'), 'utf8'));
    assert.equal(manifest.renderer, 'auto');
    assert.deepEqual(manifest.backends, result.backends);
    // Every library of both backends, the compilers, and the loader are in the payload.
    for (const file of new Set([
      ...gl.orderedFiles,
      ...gpu.orderedFiles,
      ...gpu.supportFiles,
      'zhuda-loader.js',
    ]))
      assert.ok(fs.existsSync(path.join(web, 'libs', file)), file);
    assert.ok(gpu.supportFiles.some((file) => file.endsWith('.wasm')));
    assert.ok(fs.existsSync(path.join(web, 'zhuda-notices/WEBGPU-LICENSES.txt')));

    // The page: the loader, one call, and no library or game script of its own.
    const html = fs.readFileSync(path.join(web, 'index.html'), 'utf8');
    assert.deepEqual(
      [...html.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]),
      ['libs/zhuda-loader.js'],
    );
    const call = /<script>(ZhudaLoader\.load\(.*?)<\/script>/s.exec(html)[1];
    const loaded = [];
    let options;
    const page = {
      ZhudaBackendPrefer: 'webgl',
      Laya: { SpineConst: {} },
      ZhudaLoader: {
        load: (given) => ((options = given), Promise.reject(Error('half a backend'))),
        retry: (reason) => (loaded.push(reason), true),
      },
    };
    page.window = page.globalThis = page;
    vm.runInNewContext(call, page);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(options.prefer, 'webgl', "the game's own setting reaches the loader");
    assert.deepEqual(
      [...options.webgl],
      gl.orderedFiles.map((file) => 'libs/' + file),
    );
    assert.deepEqual(
      [...options.webgpu],
      gpu.orderedFiles.map((file) => 'libs/' + file),
    );
    // After the libraries: the Spine version is set, then the game runs.
    assert.equal(options.after.length, 2);
    options.after[0]();
    assert.equal(page.Laya.SpineConst.VERSION, '4.2');
    assert.equal(options.after[1], 'app.js');
    assert.deepEqual(loaded, ['half a backend'], 'a backend loaded by halves is retried on WebGL');

    // The Doctor reads both orders out of the loader call, and says which is wrong.
    const audit = runDoctorAudit({ projectRoot: root });
    assert.deepEqual(audit.htmlBackends, {
      webgl: gl.orderedFiles.length,
      webgpu: gpu.orderedFiles.length,
    });
    assert.equal(audit.htmlScriptCount, gl.orderedFiles.length);
    assert.deepEqual(audit.topologyIssues, []);
    const reversed = [...gpu.orderedFiles].reverse().map((file) => 'libs/' + file);
    fs.writeFileSync(
      path.join(web, 'index.html'),
      html.replace(/webgpu:\[[^\]]*\]/, 'webgpu:' + JSON.stringify(reversed)),
    );
    const broken = runDoctorAudit({ projectRoot: root });
    assert.equal(broken.passed, false);
    assert.ok(
      broken.topologyIssues.some((issue) => /webgpu/.test(issue.moduleFile + issue.requiredFile)),
      JSON.stringify(broken.topologyIssues[0]),
    );
    fs.writeFileSync(path.join(web, 'index.html'), html);

    // One backend still builds as it did: tags in the page, no loader.
    const plain = await runConsumerBuild({
      projectRoot: root,
      engineRoot,
      config: {
        features,
        renderer: 'webgl',
        assetsDir: false,
        outDir: 'dist/plain',
        branding: { mode: 'none' },
      },
    });
    assert.equal(plain.renderer, 'webgl');
    assert.equal(plain.backends, undefined);
    const plainHtml = fs.readFileSync(path.join(root, 'dist/plain/index.html'), 'utf8');
    assert.deepEqual(
      [...plainHtml.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]),
      [...gl.orderedFiles.map((file) => 'libs/' + file), 'app.js'],
    );
    assert.match(plainHtml, /SpineConst\.VERSION="4\.2"/);
    assert.equal(fs.existsSync(path.join(root, 'dist/plain/libs/zhuda-loader.js')), false);
    await assert.rejects(
      runConsumerBuild({
        projectRoot: root,
        engineRoot,
        config: { features, renderer: 'automatic', assetsDir: false, outDir: 'dist/bad' },
      }),
      /RENDERER_TOPOLOGY/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
