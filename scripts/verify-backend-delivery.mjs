// Backend delivery in a real browser (docs/backend-delivery.md):
//
//   - a page for both backends starts WebGPU where the browser has a
//     hardware adapter and WebGL elsewhere, loads the bundle of one backend
//     only, and says why;
//   - a WebGPU bundle that does not load is replaced by WebGL; a WebGPU that
//     loaded and did not start loads the page again on WebGL, once;
//   - compilers that are fetched are fetched once for an origin, checked
//     wherever they come from, and never needed by a page without a cache;
//   - a consumer build with "renderer": "auto" does the same with its
//     libraries;
//   - what each bundle weighs as it travels, and whether `ui` can leave 3D.
//
// Desktop GPU evidence only: hardware WebGPU is required for the WebGPU
// cases (a software adapter is refused by the loader itself).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { chromeFixture } from './lib/chrome-fixture.mjs';
import { buildBrowserSdk } from '../packages/compiler/browser-sdk.mjs';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';
import { runDoctorAudit } from '../packages/compiler/zhuda-doctor.mjs';

const engine = path.resolve(import.meta.dirname, '..');
const root = path.resolve(
  process.env.BACKEND_OUT || path.join(os.tmpdir(), 'zhuda-backend-delivery'),
);
const evidence = path.resolve(process.env.BACKEND_EVIDENCE_DIR || path.join(root, 'evidence'));
// Only what this check makes is removed: the folder may be one a person named.
for (const made of ['sdk', 'sdk-external', 'sdk-lean', 'consumer'])
  fs.rmSync(path.join(root, made), { recursive: true, force: true });
fs.mkdirSync(evidence, { recursive: true });
const report = { cases: [], compilers: [], consumer: [], sizes: {}, withoutUi: {} };

// --- What is served --------------------------------------------------------------
const sdk = path.join(root, 'sdk'),
  external = path.join(root, 'sdk-external'),
  lean = path.join(root, 'sdk-lean');
const inline = await buildBrowserSdk({ engineRoot: engine, outDir: sdk });
await buildBrowserSdk({
  engineRoot: engine,
  outDir: external,
  profiles: ['3d', '3d-webgpu'],
  wasm: 'external',
});

const consumer = path.join(root, 'consumer');
for (const dir of ['src', 'public/assets'])
  fs.mkdirSync(path.join(consumer, dir), { recursive: true });
for (const file of ['Main.ts', 'prefabs.ts'])
  fs.copyFileSync(
    path.join(engine, 'tests/fixtures/webgpu', file),
    path.join(consumer, 'src', file),
  );
fs.writeFileSync(
  path.join(consumer, 'package.json'),
  JSON.stringify({
    name: 'neutral-auto-consumer',
    private: true,
    type: 'module',
    dependencies: { 'zhuda-laya-engine': inline.manifest.version },
  }),
);
fs.writeFileSync(
  path.join(consumer, 'public/assets/panel.lh'),
  JSON.stringify({
    _$id: 'panel',
    _$type: 'Sprite',
    name: 'Root',
    width: 640,
    height: 360,
    _$child: [
      {
        _$id: 'icon',
        _$type: 'Sprite',
        name: 'Icon',
        x: 30,
        y: 30,
        width: 70,
        height: 70,
        _gcmds: [
          {
            _$type: 'DrawRectCmd',
            x: 0,
            y: 0,
            width: 70,
            height: 70,
            fillColor: '#26a6f2',
            percent: false,
          },
        ],
      },
    ],
  }),
);
fs.writeFileSync(
  path.join(consumer, 'public/index.html'),
  '<!doctype html><html><meta charset="utf-8"><style>html,body{margin:0;background:#152030}#game{position:relative;width:640px;height:360px}</style><body><div id="game"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY --></body></html>',
);
const consumerConfig = {
  entry: 'src/Main.ts',
  features: ['core', '2d', '3d', 'ui'],
  renderer: 'auto',
  branding: { mode: 'none' },
};
fs.writeFileSync(path.join(consumer, 'zhuda.config.json'), JSON.stringify(consumerConfig));
const built = await runConsumerBuild({
  projectRoot: consumer,
  engineRoot: engine,
  config: consumerConfig,
});
assert.equal(built.renderer, 'auto');
const doctor = runDoctorAudit({ projectRoot: consumer });
assert.deepEqual(doctor.topologyIssues, [], 'both library orders pass the Doctor');
assert.equal(doctor.htmlBackends.webgpu, built.backends.webgpu.libraries.length);

// The same files at more than one address; `broken` and `tampered` are set by a case.
const mounts = {
  sdk,
  'release-1': external,
  'release-2': external,
  sandboxed: external,
  game: path.join(consumer, 'dist/web'),
};
const requests = [],
  broken = new Set(),
  tampered = new Set();
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  requests.push(pathname);
  const [, mount, ...rest] = pathname.split('/');
  try {
    if (!mounts[mount] || broken.has(pathname)) throw Error('missing');
    let bytes = fs.readFileSync(path.join(mounts[mount], ...rest));
    if (tampered.has(pathname)) bytes = Buffer.concat([bytes, Buffer.from('\n')]);
    const type = {
      '.js': 'application/javascript',
      '.wasm': 'application/wasm',
      '.html': 'text/html',
    };
    res.setHeader('Content-Type', type[path.extname(pathname)] ?? 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'no-store');
    // A page with an origin of its own that it shares with nothing: no storage, no cache.
    if (mount === 'sandboxed' && pathname.endsWith('.html'))
      res.setHeader('Content-Security-Policy', 'sandbox allow-scripts');
    res.end(bytes);
  } catch {
    res.writeHead(404, { 'Access-Control-Allow-Origin': '*' }).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// --- What a page's browser is made to say ----------------------------------------
const browsers = {
  real: '',
  'no-api': `Object.defineProperty(Navigator.prototype,'gpu',{get(){return undefined},configurable:true});`,
  'no-adapter': `navigator.gpu.requestAdapter=async()=>null;`,
  software: `navigator.gpu.requestAdapter=async()=>({info:{vendor:'cpu',architecture:'',isFallbackAdapter:true}});`,
  error: `navigator.gpu.requestAdapter=()=>Promise.reject(new Error('blocked by the check'));`,
  silent: `navigator.gpu.requestAdapter=()=>new Promise(()=>{});`,
  // The loader is answered; the engine, asking next, is not: a WebGPU that loads and does not start.
  'second-fails': `{let n=0;const real=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=(...a)=>++n===1?real(...a):Promise.resolve(null);}`,
  prefers: `window.ZhudaBackendPrefer='webgl';`,
};
const counting = `window.__asked=0;if(navigator.gpu){const real=navigator.gpu.requestAdapter.bind(navigator.gpu);navigator.gpu.requestAdapter=(...a)=>{window.__asked++;return real(...a);};}`;
// The moment the page reports itself ready, from the start of its navigation.
const stopwatch = `(function poll(){const t=window.__ZHUDA_PREFAB_TEST__||window.__ZHUDA_MODEL_TEST__||window.backendTest;let ready=false;try{ready=!!(t&&(t.ready||t.report().ready));}catch(e){}if(ready){window.__readyAt=performance.now();return;}requestAnimationFrame(poll);})();`;
const test =
  '(window.__ZHUDA_PREFAB_TEST__||window.__ZHUDA_MODEL_TEST__)?.report()' +
  '??(window.backendTest?.ready?{ready:true,...window.backendTest.report()}:window.backendTest)';

let b, reader;
const settled = `(${test})?.ready||(${test})?.error||window.__ZHUDA_LOADER_ERROR__||document.documentElement.getAttribute('data-zhuda-loader-error')`;
/** Waits for the page to say it is ready or failed; a page that loads itself again is waited through. */
async function settle() {
  let quiet = 0;
  for (let i = 0; i < 400 && quiet < 3; i++) {
    let done = false;
    try {
      done = !!(await b.evaluate(settled));
    } catch {
      // Between two documents there is nothing to ask.
    }
    quiet = done ? quiet + 1 : 0;
    await new Promise((r) => setTimeout(r, 100));
  }
  if (quiet < 3) throw Error('The page neither started nor failed');
}
/** Opens `url` in a fresh browser whose `navigator.gpu` behaves as `browser` says. */
async function open(url, browser = 'real', { keep = false, mobile } = {}) {
  if (!keep) {
    await b?.close();
    b = await chromeFixture();
    await b.send('Emulation.setDeviceMetricsOverride', {
      width: 1000,
      height: 900,
      deviceScaleFactor: 1,
      mobile: !!mobile,
    });
    await b.send('Page.addScriptToEvaluateOnNewDocument', {
      source: counting + browsers[browser] + stopwatch,
    });
  }
  const from = requests.length;
  await b.send('Page.navigate', { url: base + url });
  await settle();
  const state = await b.evaluate(
    `({report:${test}??{},backend:window.ZhudaBackend??null,asked:window.__asked,readyAt:window.__readyAt,loaderError:window.__ZHUDA_LOADER_ERROR__??document.documentElement.getAttribute('data-zhuda-loader-error'),secure:isSecureContext,origin:self.origin})`,
  );
  return { ...state, requests: requests.slice(from) };
}
/** The share of the canvas that is not its corner's colour: something was drawn. */
async function drawn(file) {
  await b.evaluate(
    '(async()=>{for(let i=0;i<6;i++)await new Promise(requestAnimationFrame);await globalThis.Laya?.LayaGL?.renderEngine?.getDevice?.()?.queue?.onSubmittedWorkDone?.();})()',
  );
  const clip = await b.evaluate(
    '(()=>{const r=document.querySelector("canvas").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,scale:1};})()',
  );
  const image = await b.send('Page.captureScreenshot', { format: 'png', clip });
  fs.writeFileSync(path.join(evidence, file), Buffer.from(image.data, 'base64'));
  // Decoded by a browser of its own: the page under test may be a sandboxed one.
  reader ??= await chromeFixture();
  return reader.evaluate(
    `(async()=>{const i=new Image();i.src='data:image/png;base64,${image.data}';await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const g=c.getContext('2d');g.drawImage(i,0,0);const p=g.getImageData(0,0,c.width,c.height).data;let n=0;for(let k=0;k<p.length;k+=4)if(Math.abs(p[k]-p[0])+Math.abs(p[k+1]-p[1])+Math.abs(p[k+2]-p[2])>36)n++;return Math.round(n/(p.length/4)*1000)/1000;})()`,
  );
}
const scripts = (list, name) => list.filter((p) => p.endsWith(name)).length;

try {
  // --- 1. Each pair of bundles as one page, with WebGPU and without -----------------
  for (const profile of ['2d', '3d', '3d-gltf']) {
    const page = `sdk/example-${profile}-auto.html?cycles=30&dpr=1`;
    const gpuBundle = `zhuda-${profile}-webgpu.js`,
      glBundle = `zhuda-${profile}.js`;
    for (const [browser, backend, reason] of [
      ['real', 'webgpu', null],
      ['no-api', 'webgl', 'no-webgpu-api'],
    ]) {
      const s = await open(page, browser);
      assert.equal(s.loaderError, null);
      assert.ok(!s.report.error, s.report.error);
      assert.equal(s.report.renderer.selected, backend, `${profile} ${browser}`);
      assert.equal(s.report.renderer.fallbackReason, reason);
      assert.equal(s.report.bundle.renderer, backend);
      assert.equal(s.backend.backend, backend);
      assert.equal(s.backend.fallbackReason, reason);
      assert.equal(s.report.renderer.status, 'ready');
      if (backend === 'webgpu') {
        assert.equal(s.report.renderer.nativeEngine, 'WebGPURenderEngine');
        assert.equal(s.report.renderer.adapter.isFallbackAdapter, false);
        assert.deepEqual(s.backend.facts, { secure: true, api: true, adapter: 'hardware' });
        assert.equal(s.report.renderer.compilers.from, 'inline');
      } else assert.notEqual(s.report.renderer.nativeEngine, 'WebGPURenderEngine');
      // The bundle of one backend only was asked for.
      assert.equal(scripts(s.requests, gpuBundle), backend === 'webgpu' ? 1 : 0);
      assert.equal(scripts(s.requests, glBundle), backend === 'webgl' ? 1 : 0);
      assert.equal(scripts(s.requests, 'zhuda-loader.js'), 1);
      if (profile === '3d-gltf') {
        await b.evaluate('__ZHUDA_MODEL_TEST__.cycles(30)');
        assert.equal((await b.evaluate('__ZHUDA_MODEL_TEST__.report()')).completedCycles, 30);
      } else {
        assert.equal(s.report.lifecycleCheck.completedCycles, 30);
        assert.deepEqual(
          s.report.lifecycleCheck.before.counts,
          s.report.lifecycleCheck.after.counts,
        );
      }
      const share = await drawn(`auto-${profile}-${backend}.png`);
      assert.ok(share > 0.02, `${profile} on ${backend} drew a picture (${share})`);
      assert.deepEqual(s.report.renderer.errors, []);
      assert.deepEqual(b.errors, []);
      report.cases.push({
        page: `example-${profile}-auto.html`,
        browser,
        backend,
        fallbackReason: reason,
        nativeEngine: s.report.renderer.nativeEngine,
        probeMs: s.backend.probeMs,
        readyMs: Math.round(s.readyAt),
        drawn: share,
      });
    }
  }

  // --- 2. Every other answer of the browser, on one page ----------------------------
  const page = 'sdk/example-3d-auto.html?dpr=1';
  for (const [browser, reason] of [
    ['no-adapter', 'no-adapter'],
    ['software', 'software-adapter'],
    ['error', 'adapter-error: blocked by the check'],
    ['silent', 'adapter-timeout'],
  ]) {
    const s = await open(page, browser);
    assert.ok(!s.report.error, s.report.error);
    assert.equal(s.report.renderer.selected, 'webgl', browser);
    assert.equal(s.report.renderer.fallbackReason, reason);
    assert.equal(scripts(s.requests, 'zhuda-3d-webgpu.js'), 0);
    assert.deepEqual(b.errors, []);
    report.cases.push({
      page: 'example-3d-auto.html',
      browser,
      backend: 'webgl',
      fallbackReason: reason,
      probeMs: s.backend.probeMs,
    });
  }
  {
    // WebGL because the page said so: not a fallback, and the browser is not asked.
    const s = await open(page + '&prefer=webgl');
    assert.equal(s.report.renderer.selected, 'webgl');
    assert.equal(s.report.renderer.fallbackReason, null);
    assert.equal(s.backend.facts, null);
    assert.equal(s.asked, 0, 'the adapter was not asked for');
    assert.equal(scripts(s.requests, 'zhuda-3d-webgpu.js'), 0);
    report.cases.push({
      page: 'example-3d-auto.html?prefer=webgl',
      browser: 'real',
      backend: 'webgl',
      fallbackReason: null,
    });
  }
  for (const [how, set] of [
    ['missing', broken],
    ['changed', tampered],
  ]) {
    // The WebGPU bundle does not arrive, or is not what its integrity says:
    // nothing of it ran, so the same page takes WebGL.
    set.add('/sdk/zhuda-3d-webgpu.js');
    const s = await open(page);
    set.clear();
    assert.ok(!s.report.error, s.report.error);
    assert.equal(s.report.renderer.selected, 'webgl', how);
    assert.equal(s.report.renderer.fallbackReason, 'bundle-failed: zhuda-3d-webgpu.js');
    assert.equal(scripts(s.requests, 'zhuda-3d-webgpu.js'), 1);
    assert.equal(scripts(s.requests, 'zhuda-3d.js'), 1);
    assert.ok((await drawn(`auto-3d-bundle-${how}.png`)) > 0.02);
    report.cases.push({
      page: 'example-3d-auto.html',
      browser: 'real, WebGPU bundle ' + how,
      backend: 'webgl',
      fallbackReason: s.report.renderer.fallbackReason,
    });
  }
  {
    // WebGPU loads and does not start: the page is loaded again, on WebGL, once.
    const s = await open(page, 'second-fails');
    assert.ok(!s.report.error, s.report.error);
    assert.equal(s.report.renderer.selected, 'webgl');
    // The reason is what the failed start said (here LayaAir's own words for no device).
    assert.match(s.report.renderer.fallbackReason, /^retry: .*WebGPU/);
    assert.equal(scripts(s.requests, 'example-3d-auto.html'), 2, 'loaded twice, not more');
    assert.equal(scripts(s.requests, 'zhuda-3d-webgpu.js'), 1);
    assert.equal(scripts(s.requests, 'zhuda-3d.js'), 1);
    assert.equal(s.backend.facts, null, 'the second load did not ask the browser');
    assert.ok((await drawn('auto-3d-retry.png')) > 0.02);
    report.cases.push({
      page: 'example-3d-auto.html',
      browser: 'real, WebGPU does not start',
      backend: 'webgl',
      fallbackReason: s.report.renderer.fallbackReason,
    });
  }
  {
    // Nothing below WebGL: the page says what did not load.
    broken.add('/sdk/zhuda-3d.js');
    const s = await open(page, 'no-api');
    broken.clear();
    assert.match(s.loaderError, /zhuda-3d\.js did not load/);
    report.cases.push({
      page: 'example-3d-auto.html',
      browser: 'no-api, WebGL bundle missing',
      error: s.loaderError,
    });
  }
  {
    // The one-backend pages are as they were: no loader, no reason.
    const s = await open('sdk/example-3d.html?dpr=1', 'no-api');
    assert.equal(s.report.renderer.selected, 'webgl');
    assert.equal(s.report.renderer.fallbackReason, null);
    assert.equal(s.backend, null);
    assert.equal(scripts(s.requests, 'zhuda-loader.js'), 0);
  }

  // --- 3. Compilers that are fetched: once for an origin ------------------------------
  const wasm = (list) => list.filter((p) => p.endsWith('.wasm')).length;
  {
    const first = await open('release-1/example-3d-auto.html?dpr=1');
    assert.equal(first.report.renderer.selected, 'webgpu');
    assert.equal(first.report.renderer.compilers.from, 'network');
    assert.equal(wasm(first.requests), 2);
    // Another release of the same SDK at another address, in the same browser.
    const second = await open('release-2/example-3d-auto.html?dpr=1', 'real', { keep: true });
    assert.equal(second.report.renderer.selected, 'webgpu');
    assert.equal(second.report.renderer.compilers.from, 'cache');
    assert.equal(wasm(second.requests), 0, 'nothing was downloaded again');
    assert.ok((await drawn('compilers-from-cache.png')) > 0.02);
    // One of the two is not what its name says: it is thrown out and fetched.
    await b.evaluate(
      `(async()=>{const c=await caches.open('zhuda-webgpu-compilers');const k=(await c.keys())[0];await c.put(k,new Response(new Uint8Array([1,2,3])));})()`,
    );
    const third = await open('release-1/example-3d-auto.html?dpr=1', 'real', { keep: true });
    assert.ok(!third.report.error, third.report.error);
    assert.equal(third.report.renderer.compilers.from, 'network');
    assert.equal(wasm(third.requests), 1);
    const kept = await b.evaluate(
      `(async()=>{const c=await caches.open('zhuda-webgpu-compilers');return (await c.keys()).length;})()`,
    );
    assert.equal(kept, 2);
    assert.deepEqual(b.errors, []);
    report.compilers.push(
      {
        page: 'release-1',
        from: 'network',
        fetched: 2,
        compilersMs: first.report.renderer.compilers.ms,
        readyMs: Math.round(first.readyAt),
      },
      {
        page: 'release-2, same browser',
        from: 'cache',
        fetched: 0,
        compilersMs: second.report.renderer.compilers.ms,
        readyMs: Math.round(second.readyAt),
      },
      {
        page: 'release-1, one cache entry wrong',
        from: 'network',
        fetched: 1,
        compilersMs: third.report.renderer.compilers.ms,
      },
    );
    // A page with no storage of its own: fetched every time, and it starts.
    const boxed = await open('sandboxed/example-3d-auto.html?dpr=1');
    assert.ok(!boxed.report.error, boxed.report.error);
    assert.equal(boxed.origin, 'null');
    assert.equal(boxed.report.renderer.selected, 'webgpu');
    assert.equal(boxed.report.renderer.compilers.from, 'network');
    assert.equal(wasm(boxed.requests), 2);
    const again = await open('sandboxed/example-3d-auto.html?dpr=1', 'real', { keep: true });
    assert.equal(again.report.renderer.compilers.from, 'network');
    assert.equal(wasm(again.requests), 2);
    assert.deepEqual(b.errors, []);
    report.compilers.push({
      page: 'sandboxed (no cache)',
      from: 'network',
      fetched: 2,
      compilersMs: boxed.report.renderer.compilers.ms,
    });
    // The bundle that carries its compilers, for the time of both to compare.
    const carried = await open('sdk/example-3d-auto.html?dpr=1');
    assert.equal(carried.report.renderer.compilers.from, 'inline');
    assert.equal(wasm(carried.requests), 0);
    report.compilers.push({
      page: 'sdk (compilers in the bundle)',
      from: 'inline',
      fetched: 0,
      compilersMs: carried.report.renderer.compilers.ms,
      readyMs: Math.round(carried.readyAt),
    });
  }

  // --- 4. A consumer build for both backends ------------------------------------------
  const libs = (list, name) => list.filter((p) => p === '/game/libs/' + name).length;
  for (const [browser, backend, reason] of [
    ['real', 'webgpu', null],
    ['no-api', 'webgl', 'no-webgpu-api'],
    ['prefers', 'webgl', null],
  ]) {
    const s = await open('game/index.html', browser);
    assert.ok(!s.report.error, s.report.error);
    assert.equal(s.report.renderer.selected, backend, 'consumer ' + browser);
    assert.equal(s.report.renderer.fallbackReason, reason);
    // The libraries of one backend only, and the game after them.
    for (const file of built.backends.webgpu.libraries.filter((f) =>
      /webgpu|shader_compiler|nagabind/.test(f),
    ))
      assert.equal(libs(s.requests, file), backend === 'webgpu' ? 1 : 0, file);
    for (const file of built.backends.webgl.libraries.filter((f) => /webgl/.test(f)))
      assert.equal(libs(s.requests, file), backend === 'webgl' ? 1 : 0, file);
    assert.equal(wasm(s.requests), backend === 'webgpu' ? 2 : 0);
    assert.equal(scripts(s.requests, '/game/app.js'), 1);
    if (browser === 'prefers') assert.equal(s.asked, 0);
    const share = await drawn(`consumer-auto-${browser}.png`);
    assert.ok(share > 0.02, `consumer on ${backend} drew a picture (${share})`);
    assert.deepEqual(s.report.renderer.errors, []);
    assert.deepEqual(b.errors, []);
    report.consumer.push({
      browser,
      backend,
      fallbackReason: reason,
      compilers: s.report.renderer.compilers ?? null,
      readyMs: Math.round(s.readyAt),
      drawn: share,
    });
  }
  {
    // The second load of the WebGPU page in one browser: the compilers come from the cache.
    await open('game/index.html');
    const s = await open('game/index.html', 'real', { keep: true });
    assert.equal(s.report.renderer.compilers.from, 'cache');
    assert.equal(wasm(s.requests), 0);
    report.consumer.push({
      browser: 'real, second load',
      backend: 'webgpu',
      compilers: s.report.renderer.compilers,
      readyMs: Math.round(s.readyAt),
    });
  }
  {
    // The game's own start fails on WebGPU and it asks for the page again.
    const s = await open('game/index.html', 'second-fails');
    assert.ok(!s.report.error, s.report.error);
    assert.equal(s.report.renderer.selected, 'webgl');
    assert.match(s.report.renderer.fallbackReason, /^retry: .*WebGPU/);
    assert.equal(scripts(s.requests, '/game/index.html'), 2);
    report.consumer.push({
      browser: 'real, WebGPU does not start',
      backend: 'webgl',
      fallbackReason: s.report.renderer.fallbackReason,
    });
  }
  {
    // A WebGPU library that does not arrive after others ran: half a backend.
    // The page is loaded again and comes up on WebGL.
    broken.add('/game/libs/laya.webgpu_3D.js');
    const s = await open('game/index.html');
    broken.clear();
    assert.ok(!s.report.error, s.report.error);
    assert.equal(s.report.renderer.selected, 'webgl');
    assert.match(
      s.report.renderer.fallbackReason,
      /^retry: ZHUDA_LOADER: libs\/laya\.webgpu_3D\.js did not load/,
    );
    assert.equal(scripts(s.requests, '/game/index.html'), 2);
    assert.ok((await drawn('consumer-auto-half-loaded.png')) > 0.02);
    report.consumer.push({
      browser: 'real, a WebGPU library missing',
      backend: 'webgl',
      fallbackReason: s.report.renderer.fallbackReason,
    });
  }

  // --- 5. What travels ------------------------------------------------------------------
  const weigh = (file) => {
    const bytes = fs.readFileSync(file);
    return {
      bytes: bytes.length,
      gzip: zlib.gzipSync(bytes, { level: 9 }).length,
      brotli: zlib.brotliCompressSync(bytes, {
        params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 9 },
      }).length,
    };
  };
  for (const entry of Object.values(inline.manifest.profiles))
    report.sizes[entry.file] = weigh(path.join(sdk, entry.file));
  report.sizes['zhuda-loader.js'] = weigh(path.join(sdk, 'zhuda-loader.js'));
  for (const file of ['zhuda-3d-webgpu.js', 'shader_compiler_web.wasm', 'nagabind_bg.wasm'])
    report.sizes['fetched compilers: ' + file] = weigh(path.join(external, file));
  // The loader is small enough to be nothing beside either bundle.
  assert.ok(
    report.sizes['zhuda-loader.js'].gzip < 3000,
    JSON.stringify(report.sizes['zhuda-loader.js']),
  );

  // --- 6. 3D without `ui` ----------------------------------------------------------------
  // The same engine with LayaAir's UI library left out, which no profile does:
  // built by hand from the profile's own inputs to see whether it starts.
  {
    const { TopologyResolver } = await import('../packages/compiler/compiler-runtime.mjs');
    const withUi = TopologyResolver.resolveByFeatures(['core', '2d', '3d', 'ui'], 'webgl'),
      without = TopologyResolver.resolveByFeatures(['core', '2d', '3d'], 'webgl');
    assert.deepEqual(
      withUi.orderedFiles.filter((file) => !without.orderedFiles.includes(file)),
      ['laya.ui.js'],
    );
    const bundle = fs.readFileSync(path.join(sdk, 'zhuda-3d.js'), 'utf8');
    const ui = fs.readFileSync(path.join(engine, 'vendor/laya-3.4.2/libs/laya.ui.js'), 'utf8');
    const at = bundle.indexOf(ui);
    assert.ok(at > 0, 'the UI library is in the bundle as it is in the vendor folder');
    fs.mkdirSync(lean, { recursive: true });
    const meta = bundle.lastIndexOf('const meta=');
    const cut = (text) => {
      const without = text.replace(',"ui"', '').replace(',"laya.ui.js"', '');
      assert.equal(without.length, text.length - ',"ui","laya.ui.js"'.length);
      return without;
    };
    fs.writeFileSync(
      path.join(lean, 'zhuda-3d.js'),
      bundle.slice(0, at) + bundle.slice(at + ui.length, meta) + cut(bundle.slice(meta)),
    );
    fs.writeFileSync(
      path.join(lean, 'example-3d.html'),
      fs
        .readFileSync(path.join(sdk, 'example-3d.html'), 'utf8')
        .replace(/ integrity="[^"]+" crossorigin="anonymous"/, ''),
    );
    mounts.lean = lean;
    const s = await open('lean/example-3d.html?cycles=30&dpr=1');
    const share = s.report?.ready ? await drawn('3d-without-ui.png') : 0;
    const full = weigh(path.join(sdk, 'zhuda-3d.js')),
      small = weigh(path.join(lean, 'zhuda-3d.js'));
    report.withoutUi = {
      starts: !!s.report?.ready && !s.report.error,
      error: s.report?.error ?? null,
      cycles: s.report?.lifecycleCheck?.completedCycles ?? 0,
      drawn: share,
      pageErrors: b.errors,
      saves: {
        bytes: full.bytes - small.bytes,
        gzip: full.gzip - small.gzip,
        brotli: full.brotli - small.brotli,
      },
    };
  }
} finally {
  await b?.close();
  await reader?.close();
  server.closeAllConnections();
  await new Promise((r) => server.close(r));
  report.environment = { node: process.version, os: os.platform() + ' ' + os.release() };
  fs.writeFileSync(path.join(evidence, 'report.json'), JSON.stringify(report, null, 2));
}
console.log(JSON.stringify(report, null, 2));
console.log(
  `PASS backend delivery: ${report.cases.length} page cases, ${report.compilers.length} compiler cases, ${report.consumer.length} consumer cases; evidence in ${evidence}`,
);
