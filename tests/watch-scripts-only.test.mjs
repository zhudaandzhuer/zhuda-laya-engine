import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { parseWatchArgs, watchConsumer } from '../packages/compiler/prefab-watch.mjs';
import {
  classifyWatchChange,
  scriptsOnlyObstacle,
  staleManifest,
  stalePayloadReason,
} from '../packages/compiler/consumer-scripts.mjs';
import {
  prefabEvidenceMatches,
  selectPrefabDependencyProof,
} from '../packages/compiler/prefab-dependencies.mjs';
import { initConsumer } from '../packages/compiler/zhuda-init.mjs';
import { collectReflectableClasses } from '../packages/compiler/ast-scanner.mjs';
import { auditConsumerSources } from '../packages/compiler/consumer-guards.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');

function fixture(config = { entry: 'src/Main.ts' }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-watch-kind-'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'src/Main.ts'), 'export {};\n');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture"}\n');
  if (config) fs.writeFileSync(path.join(root, 'zhuda.config.json'), JSON.stringify(config));
  return root;
}

function recorder() {
  const lines = [];
  const add = (line) => lines.push(String(line));
  return { lines, log: { log: add, error: add, warn: add } };
}

/** A watcher on stand-in builders: `calls` lists what ran, in order. */
function standIn({ config, ...options } = {}) {
  const root = fixture(config);
  const calls = [];
  const { lines, log } = recorder();
  const state = { fullFails: false, scriptsFail: false, served: 'fast' };
  const watcher = watchConsumer({
    project: root,
    host: '127.0.0.1',
    port: 0,
    candidate: true,
    // The tests say what changed; file events of their own writes would build behind their back.
    watchFiles: false,
    log,
    build: async () => {
      calls.push('full');
      if (state.fullFails) throw Error('the full build broke');
      return { full: true };
    },
    scripts: async () => {
      calls.push('keep');
      return {
        rebuild: async () => {
          calls.push('scripts');
          if (state.scriptsFail) throw Error('the scripts broke');
          return Buffer.from(state.served);
        },
        dispose: async () => calls.push('dispose'),
      };
    },
    ...options,
  });
  const ran = () => calls.filter((call) => call === 'full' || call === 'scripts');
  return { root, calls, ran, lines, state, watcher };
}

async function until(condition, what) {
  const deadline = Date.now() + 5000;
  while (!condition()) {
    if (Date.now() > deadline) throw Error(`Timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** The page's side of the watcher: the events it is sent. */
function listen(port) {
  const events = [];
  const request = http.get({ host: '127.0.0.1', port, path: '/__zhuda_reload' }, (response) => {
    let rest = '';
    response.setEncoding('utf8');
    response.on('data', (chunk) => {
      const blocks = (rest + chunk).split('\n\n');
      rest = blocks.pop();
      for (const block of blocks) {
        const name = /^event: (.+)$/m.exec(block)?.[1];
        if (name) events.push({ name, data: JSON.parse(/^data: (.+)$/m.exec(block)[1]) });
      }
    });
  });
  request.on('error', () => {});
  return { events, close: () => request.destroy() };
}

test('only a file inside src/ is a script change', () => {
  for (const file of ['src/Main.ts', 'src/ui/kit.ts', 'src\\ui\\kit.ts', 'src/data/levels.json'])
    assert.equal(classifyWatchChange(file), 'scripts', file);
  for (const file of [
    'src',
    '',
    undefined,
    null,
    'assets/hero.glb',
    'public/index.html',
    'zhuda.config.json',
    'package.json',
    'srcx/Main.ts',
    'tools/src/Main.ts',
    'src/../assets/hero.glb',
  ])
    assert.equal(classifyWatchChange(file), 'full', String(file));
  assert.equal(parseWatchArgs(['--project', process.cwd()]).fullBuilds, false);
  assert.equal(parseWatchArgs(['--project', process.cwd(), '--full-builds']).fullBuilds, true);
});

test('what keeps a project on the full build is named', () => {
  const projectRoot = path.join(os.tmpdir(), 'zhuda-consumer');
  const base = { projectRoot, engineRoot, candidate: true, config: { entry: 'src/Main.ts' } };
  assert.equal(scriptsOnlyObstacle(base), null);
  assert.match(scriptsOnlyObstacle({ ...base, candidate: false }), /--candidate/);
  assert.match(scriptsOnlyObstacle({ ...base, config: null }), /zhuda\.config\.json/);
  assert.match(scriptsOnlyObstacle({ ...base, projectRoot: engineRoot }), /not a consumer/);
  assert.match(scriptsOnlyObstacle({ ...base, config: { demoAssets: true } }), /not a consumer/);
  for (const key of ['prefabPreview', 'prefabChecks', 'prefabEvidence'])
    assert.match(scriptsOnlyObstacle({ ...base, config: { [key]: [] } }), new RegExp(key));
  // A page input kept among the scripts.
  for (const [config, key] of [
    [{ htmlTemplate: 'src/page/index.html' }, /"htmlTemplate" is inside src/],
    [{ publicDir: 'src/public' }, /"publicDir" is inside src/],
    [{ branding: { mode: 'custom', logo: 'src/logo.svg' } }, /"branding\.logo" is inside src/],
  ])
    assert.match(scriptsOnlyObstacle({ ...base, config }), key);
  for (const config of [
    { htmlTemplate: 'public/index.html', publicDir: 'public' },
    { branding: { mode: 'custom', logo: 'art/logo.svg' } },
    { htmlTemplate: 'srcpages/index.html' },
  ])
    assert.equal(scriptsOnlyObstacle({ ...base, config }), null);
});

test('a stale manifest names no build and stands behind no evidence', () => {
  const manifest = {
    renderer: 'webgl',
    fingerprint: 'f'.repeat(64),
    prefabDependencies: {
      schemaVersion: 1,
      components: { hero: { id: 'hero', bundle: 'prefab-component-1.js', files: [] } },
    },
    files: [
      { path: 'app.js', bytes: 3, sha256: 'old' },
      { path: 'index.html', bytes: 5, sha256: 'page' },
    ],
    totalBytes: 8,
  };
  const app = Buffer.from('rebuilt');
  const stale = staleManifest(manifest, { 'app.js': app });
  assert.equal(stale.fingerprint, null);
  assert.equal(stale.prefabDependencies, undefined);
  assert.deepEqual(stale.stale.files, ['app.js']);
  assert.equal(stale.stale.fullBuildFingerprint, manifest.fingerprint);
  assert.deepEqual(stale.files, [
    { path: 'app.js', bytes: app.length, sha256: sha(app) },
    { path: 'index.html', bytes: 5, sha256: 'page' },
  ]);
  assert.equal(stale.totalBytes, app.length + 5);
  assert.equal(stale.renderer, 'webgl');
  // The manifest of the full build is not touched.
  assert.equal(manifest.fingerprint, 'f'.repeat(64));
  assert.equal(staleManifest(null, { 'app.js': app }), null);

  assert.equal(stalePayloadReason(manifest), null);
  assert.match(stalePayloadReason(stale), /scripts alone/);
  // What a browser report taken from it would record matches no release.
  const report = { selection: { id: 'hero' }, componentId: 'hero' };
  const url = 'http://127.0.0.1:8890/prefab-preview.html?id=hero';
  assert.equal(selectPrefabDependencyProof(stale, report, [], url), null);
  assert.equal(
    prefabEvidenceMatches({ ...report, fingerprint: stale.fingerprint }, manifest.fingerprint, {}),
    false,
  );
});

test('what the kept bundle remembers of each source follows every edit', () => {
  const root = fixture();
  const src = path.join(root, 'src');
  const classCache = new Map();
  const guardCache = new Map();
  const classes = () => collectReflectableClasses(src, classCache).map((found) => found.className);
  const codes = () => {
    const kept = auditConsumerSources(root, {}, guardCache);
    assert.deepEqual(kept, auditConsumerSources(root, {}), 'the same report as with nothing kept');
    return kept.issues.map((issue) => issue.code);
  };
  try {
    assert.deepEqual(classes(), []);
    assert.ok(codes().includes('PUBLIC_SDK_IMPORT_MISSING'));
    const main = "import { ZhudaEngine } from 'zhuda-laya-engine';\nvoid ZhudaEngine.boot;\n";
    fs.writeFileSync(path.join(src, 'Main.ts'), main);
    assert.equal(codes().includes('PUBLIC_SDK_IMPORT_MISSING'), false);
    // The same edit twice over: asked again with nothing changed, the answer is the kept one.
    assert.equal(codes().includes('PUBLIC_SDK_IMPORT_MISSING'), false);

    fs.writeFileSync(path.join(src, 'Spin.ts'), 'export class Spin extends Laya.Script {}\n');
    assert.deepEqual(classes(), ['Spin']);
    fs.writeFileSync(
      path.join(src, 'Spin.ts'),
      'export class Spin extends Laya.Script {}\nexport class Turn extends Laya.Script {}\n',
    );
    assert.deepEqual(classes(), ['Spin', 'Turn']);
    fs.writeFileSync(path.join(src, 'Spin.ts'), 'export class Turn extends Laya.Script {}\n');
    assert.deepEqual(classes(), ['Turn']);

    fs.writeFileSync(path.join(src, 'Main.ts'), main + "import * as THREE from 'three';\n");
    assert.ok(codes().includes('EXTERNAL_RENDERER_IMPORT'));
    fs.writeFileSync(path.join(src, 'Main.ts'), main + 'declare const Laya: any;\n');
    assert.deepEqual(
      codes().filter((code) => /RENDERER|UNTYPED/.test(code)),
      ['UNTYPED_LAYA'],
    );
    fs.writeFileSync(path.join(src, 'Main.ts'), main);
    fs.rmSync(path.join(src, 'Spin.ts'));
    assert.deepEqual(classes(), []);
    assert.deepEqual(
      codes().filter((code) => /RENDERER|UNTYPED/.test(code)),
      [],
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a save under src/ alone is answered from the scripts once a full build stands', async () => {
  const { root, calls, ran, lines, state, watcher } = standIn();
  await watcher.preview.listening;
  const base = `http://127.0.0.1:${watcher.preview.server.address().port}`;
  try {
    // Until a full build has succeeded there is nothing for a script bundle to sit on.
    state.fullFails = true;
    assert.equal(await watcher.rebuild('initial build'), null);
    assert.equal(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), null);
    assert.deepEqual(ran(), ['full', 'full']);
    state.fullFails = false;
    assert.deepEqual(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), { full: true });
    assert.match(lines.at(-2), /a save that changes only src\/ rebuilds app\.js alone/);
    assert.match(lines.at(-1), /^\[Zhuda Watch\] rebuilt after src\/Main\.ts in \d+ ms, full$/);

    const fast = await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    assert.deepEqual(fast, { scriptsOnly: true, served: ['app.js'] });
    assert.deepEqual(ran(), ['full', 'full', 'full', 'scripts']);
    assert.match(
      lines.at(-1),
      /^\[Zhuda Watch\] rebuilt after src\/Main\.ts in \d+ ms, scripts only$/,
    );
    assert.equal(await (await fetch(`${base}/app.js`)).text(), 'fast');
    assert.equal(fs.existsSync(path.join(root, 'dist')), false, 'nothing is written');

    // One path outside src/ among the changes is enough for the full build.
    for (const changed of [
      ['src/Main.ts', 'public/index.html'],
      ['assets/hero.glb'],
      ['zhuda.config.json'],
      ['package.json'],
      ['src'],
      [],
    ]) {
      const before = ran().length;
      assert.deepEqual(await watcher.rebuild('change', changed), { full: true });
      assert.equal(ran().at(-1), 'full', changed.join());
      assert.equal(ran().length, before + 1);
      // A full build is on disk again: nothing is answered from memory.
      assert.equal((await fetch(`${base}/app.js`)).status, 404);
      await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
      assert.equal(ran().at(-1), 'scripts');
    }

    // A full build that failed leaves the directory behind its inputs: full builds until one works.
    state.fullFails = true;
    assert.equal(await watcher.rebuild('assets/hero.glb', ['assets/hero.glb']), null);
    assert.equal(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), null);
    assert.deepEqual(ran().slice(-2), ['full', 'full']);
    // What the page had keeps being answered.
    assert.equal(await (await fetch(`${base}/app.js`)).text(), 'fast');
    state.fullFails = false;
    await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    assert.deepEqual(ran().slice(-2), ['full', 'scripts']);

    // The configuration changed and no event said so: the libraries and the entry may differ.
    const keptBefore = calls.filter((call) => call === 'keep').length;
    fs.writeFileSync(
      path.join(root, 'zhuda.config.json'),
      JSON.stringify({ entry: 'src/Main.ts', features: ['core', '2d', 'ui'] }),
    );
    assert.deepEqual(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), { full: true });
    assert.equal(ran().at(-1), 'full');
    await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    assert.equal(ran().at(-1), 'scripts');
    // The bundle kept for the old configuration was let go and one made for the new.
    assert.ok(calls.includes('dispose'));
    assert.equal(calls.filter((call) => call === 'keep').length, keptBefore + 1);
    // The same for package.json.
    fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture","version":"2.0.0"}\n');
    await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    assert.equal(ran().at(-1), 'full');
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.match(lines.at(-1), /^\[Zhuda Watch\] rebuilt after/);
  assert.equal(calls.at(-1), 'dispose');
});

test('a watcher told to stop after a scripts-only rebuild says the directory is behind', async () => {
  const { root, lines, watcher } = standIn();
  await watcher.preview.listening;
  await watcher.rebuild('initial build');
  await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
  await watcher.close();
  fs.rmSync(root, { recursive: true, force: true });
  assert.match(lines.at(-1), /stopped: dist\/candidate\/web on disk is the last full build/);
});

test('a release watcher, --full-builds, a prefab preview and a missing configuration keep the full build', async () => {
  for (const [options, reason] of [
    [{ candidate: false }, /without --candidate/],
    [{ fullBuilds: true }, /--full-builds was given/],
    [{ config: { entry: 'src/Main.ts', prefabPreview: 'src/prefabs.ts' } }, /"prefabPreview"/],
    [{ config: null }, /zhuda\.config\.json is missing/],
  ]) {
    const { root, ran, calls, lines, watcher } = standIn(options);
    await watcher.preview.listening;
    try {
      assert.deepEqual(await watcher.rebuild('initial build'), { full: true });
      assert.deepEqual(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), { full: true });
      assert.deepEqual(ran(), ['full', 'full']);
      assert.equal(calls.includes('keep'), false);
      assert.match(lines[0], /^\[Zhuda Watch\] every change runs the full build: /);
      assert.match(lines[0], reason);
      // Said once, not at every build.
      assert.equal(lines.filter((line) => line.includes('every change runs')).length, 1);
      assert.match(lines.at(-1), /rebuilt after src\/Main\.ts in \d+ ms, full$/);
    } finally {
      await watcher.close();
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test('a script bundle that cannot be kept falls back to the full build', async () => {
  const { root, ran, lines, watcher } = standIn({
    scripts: async () => {
      throw Error('no bundler here');
    },
  });
  await watcher.preview.listening;
  try {
    await watcher.rebuild('initial build');
    assert.deepEqual(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), { full: true });
    assert.deepEqual(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), { full: true });
    assert.deepEqual(ran(), ['full', 'full', 'full']);
    const said = lines.filter((line) => line.includes('could not be kept (no bundler here)'));
    assert.equal(said.length, 1);
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a failed scripts-only rebuild reaches the page and leaves what it had', async () => {
  const { root, ran, lines, state, watcher } = standIn();
  await watcher.preview.listening;
  const port = watcher.preview.server.address().port;
  const page = listen(port);
  try {
    await until(() => page.events.some((event) => event.name === 'ready'), 'the event stream');
    await watcher.rebuild('initial build');
    await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    state.scriptsFail = true;
    state.served = 'never served';
    assert.equal(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), null);
    assert.match(
      lines.at(-1),
      /^\[Zhuda Watch\] build failed after src\/Main\.ts in \d+ ms, scripts only: Error: the scripts broke/,
    );
    await until(() => page.events.some((event) => event.name === 'error'), 'the error event');
    assert.equal(page.events.at(-1).data, 'the scripts broke');
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/app.js`)).text(), 'fast');
    // The next save is tried from the scripts again, and reloads the page when it works.
    state.scriptsFail = false;
    state.served = 'mended';
    await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    assert.deepEqual(ran(), ['full', 'scripts', 'scripts', 'scripts']);
    await until(() => page.events.at(-1).name === 'reload', 'the reload event');
    assert.equal(page.events.at(-1).data.kind, 'scripts only');
    assert.equal(await (await fetch(`http://127.0.0.1:${port}/app.js`)).text(), 'mended');
    assert.deepEqual(
      page.events.filter((event) => event.name !== 'status').map((event) => event.name),
      ['ready', 'reload', 'reload', 'error', 'reload'],
    );
  } finally {
    page.close();
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('changes that arrive during a build decide the next one, and file events are gathered', async () => {
  const { root, ran, lines, watcher } = standIn();
  await watcher.preview.listening;
  try {
    await watcher.rebuild('initial build');
    // Two saves close together are one build, named after the last with the count of the rest.
    watcher.note('src/Main.ts');
    watcher.note('src/ui/kit.ts');
    await until(() => ran().length === 2, 'the gathered build');
    assert.deepEqual(ran(), ['full', 'scripts']);
    await until(() => lines.at(-1).includes('rebuilt after'), 'its log line');
    assert.match(
      lines.at(-1),
      /rebuilt after src\/ui\/kit\.ts and 1 more in \d+ ms, scripts only$/,
    );
    // An asset saved while a scripts-only rebuild runs: that rebuild finishes, a full build follows.
    const first = watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    assert.equal(await watcher.rebuild('assets/hero.glb', ['assets/hero.glb']), undefined);
    await first;
    await until(() => ran().length === 4, 'the queued build');
    assert.deepEqual(ran(), ['full', 'scripts', 'scripts', 'full']);
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('file events of the watched directories are sorted the same way', async () => {
  const root = fixture();
  fs.mkdirSync(path.join(root, 'public'));
  fs.writeFileSync(path.join(root, 'public/index.html'), '<!doctype html>');
  const ran = [];
  const { lines, log } = recorder();
  const watcher = watchConsumer({
    project: root,
    host: '127.0.0.1',
    port: 0,
    candidate: true,
    log,
    build: async () => ran.push('full'),
    scripts: async () => ({
      rebuild: async () => {
        ran.push('scripts');
        return Buffer.from('fast');
      },
      dispose: async () => {},
    }),
  });
  await watcher.preview.listening;
  try {
    await watcher.rebuild('initial build');
    // Events of the fixture's own creation may still arrive: let them pass first.
    await new Promise((resolve) => setTimeout(resolve, 400));
    let seen = ran.length;
    fs.writeFileSync(path.join(root, 'src/Main.ts'), 'export const saved = 1;\n');
    await until(() => ran.length > seen, 'the build after a script was saved');
    assert.deepEqual(ran.slice(seen), ['scripts']);
    await until(() => /rebuilt after src\/Main\.ts/.test(lines.at(-1)), 'its log line');
    assert.match(lines.at(-1), /rebuilt after src\/Main\.ts in \d+ ms, scripts only$/);
    await new Promise((resolve) => setTimeout(resolve, 400));
    seen = ran.length;
    fs.writeFileSync(path.join(root, 'public/index.html'), '<!doctype html><title>saved</title>');
    await until(() => ran.length > seen, 'the build after a page was saved');
    assert.deepEqual(ran.slice(seen), ['full']);
  } finally {
    await watcher.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a real consumer: the scripts-only bundle is the full build’s app.js, served from memory only', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-watch-real-'));
  const { lines, log } = recorder();
  let watcher, page;
  try {
    initConsumer({ target: root, name: 'watch-real', engine: '1.3.0' });
    const main = path.join(root, 'src/Main.ts');
    const source = fs.readFileSync(main, 'utf8');
    const candidate = path.join(root, 'dist/candidate');
    const onDisk = () =>
      Object.fromEntries(
        [
          'web/app.js',
          'web/index.html',
          'web/payload-manifest.json',
          'game.zip',
          'consumer-build.json',
        ].map((file) => [file, sha(fs.readFileSync(path.join(candidate, file)))]),
      );
    watcher = watchConsumer({
      project: root,
      host: '127.0.0.1',
      port: 0,
      candidate: true,
      watchFiles: false,
      log,
    });
    await watcher.preview.listening;
    const port = watcher.preview.server.address().port;
    const get = (file) => fetch(`http://127.0.0.1:${port}/${file}`);
    page = listen(port);
    await until(() => page.events.some((event) => event.name === 'ready'), 'the event stream');

    assert.equal((await watcher.rebuild('initial build')).mode, 'candidate');
    assert.match(lines.at(-1), /rebuilt after initial build in \d+ ms, full$/);
    const built = onDisk();
    const fullManifest = JSON.parse(
      fs.readFileSync(path.join(candidate, 'web/payload-manifest.json')),
    );
    assert.match(fullManifest.fingerprint, /^[0-9a-f]{64}$/);
    assert.deepEqual(await (await get('payload-manifest.json')).json(), fullManifest);

    // A script is edited: the page gets the new bundle, the directory keeps the full build.
    fs.writeFileSync(main, source + '\nconsole.log("WATCH_MARKER_ONE");\n');
    const fast = await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    assert.deepEqual(fast, { scriptsOnly: true, served: ['app.js'] });
    assert.match(lines.at(-1), /rebuilt after src\/Main\.ts in \d+ ms, scripts only$/);
    const served = Buffer.from(await (await get('app.js')).arrayBuffer());
    assert.ok(served.includes('WATCH_MARKER_ONE'), 'the edit is in the served bundle');
    assert.deepEqual(onDisk(), built);
    assert.equal(
      fs.readFileSync(path.join(candidate, 'web/app.js')).includes('WATCH_MARKER'),
      false,
    );
    assert.deepEqual(
      fs.readdirSync(candidate).filter((name) => name.startsWith('.zhuda')),
      [],
    );

    // While it does, the manifest it serves is of no build.
    const stale = await (await get('payload-manifest.json')).json();
    assert.equal(stale.fingerprint, null);
    assert.equal(stale.stale.fullBuildFingerprint, fullManifest.fingerprint);
    assert.deepEqual(stale.stale.files, ['app.js']);
    assert.deepEqual(
      stale.files.find((file) => file.path === 'app.js'),
      { path: 'app.js', bytes: served.length, sha256: sha(served) },
    );
    assert.match(stalePayloadReason(stale), /scripts alone/);

    // A new component class is registered by the scripts-only bundle too.
    const extra = path.join(root, 'src/Extra.ts');
    fs.writeFileSync(extra, 'export class ExtraScript extends Laya.Script {}\n');
    await watcher.rebuild('src/Extra.ts', ['src/Extra.ts']);
    assert.match(lines.at(-1), /scripts only$/);
    const withExtra = await (await get('app.js')).text();
    assert.ok(withExtra.includes('zhuda://ExtraScript'), 'the new class is registered');
    fs.rmSync(extra);
    await watcher.rebuild('src/Extra.ts', ['src/Extra.ts']);
    const again = Buffer.from(await (await get('app.js')).arrayBuffer());
    assert.equal(again.includes('ExtraScript'), false);
    assert.equal(sha(again), sha(served));

    // What the full build refuses, the scripts-only rebuild refuses: a source gate, then a
    // script that does not compile. The page is told, and keeps what it had.
    for (const [broken, expected] of [
      [source + '\nimport "three";\n', /\[EXTERNAL_RENDERER_IMPORT\]/],
      [source + '\nconst broken = ;\n', /Build failed with 1 error/],
    ]) {
      fs.writeFileSync(main, broken);
      assert.equal(await watcher.rebuild('src/Main.ts', ['src/Main.ts']), null);
      assert.match(lines.at(-1), /build failed after src\/Main\.ts in \d+ ms, scripts only: /);
      await until(() => page.events.at(-1).name === 'error', 'the error event');
      assert.match(page.events.at(-1).data, expected);
      assert.equal(sha(Buffer.from(await (await get('app.js')).arrayBuffer())), sha(served));
      assert.deepEqual(onDisk(), built);
    }

    // The next full build writes, byte for byte, what was being served for the same sources.
    fs.writeFileSync(main, source + '\nconsole.log("WATCH_MARKER_ONE");\n');
    await watcher.rebuild('src/Main.ts', ['src/Main.ts']);
    fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'assets/note.txt'), 'an asset');
    assert.equal((await watcher.rebuild('assets/note.txt', ['assets/note.txt'])).mode, 'candidate');
    assert.match(lines.at(-1), /rebuilt after assets\/note\.txt in \d+ ms, full$/);
    assert.equal(sha(fs.readFileSync(path.join(candidate, 'web/app.js'))), sha(served));
    assert.notDeepEqual(onDisk(), built);
    const fresh = await (await get('payload-manifest.json')).json();
    assert.deepEqual(
      fresh,
      JSON.parse(fs.readFileSync(path.join(candidate, 'web/payload-manifest.json'))),
    );
    assert.match(fresh.fingerprint, /^[0-9a-f]{64}$/);
    assert.notEqual(fresh.fingerprint, fullManifest.fingerprint);
    assert.equal(fresh.stale, undefined);
    assert.equal(
      sha(Buffer.from(await (await get('app.js')).arrayBuffer())),
      sha(fs.readFileSync(path.join(candidate, 'web/app.js'))),
    );
    assert.equal(fs.existsSync(path.join(root, 'dist/web')), false, 'no release was written');
  } finally {
    page?.close();
    await watcher?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
