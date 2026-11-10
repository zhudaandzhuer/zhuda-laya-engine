import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';
import { publishConsumerOutput } from '../packages/compiler/consumer-publication.mjs';
import { watchConsumer } from '../packages/compiler/prefab-watch.mjs';
import { initConsumer } from '../packages/compiler/zhuda-init.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');
const snapshot = (root) =>
  Object.fromEntries(
    [
      'web/index.html',
      'web/app.js',
      'web/payload-manifest.json',
      'consumer-build.json',
      'game.zip',
    ].map((file) => [
      file,
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(root, 'dist', file)))
        .digest('hex'),
    ]),
  );

test('compile, evidence and package failures retain the complete last good output over HTTP', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-last-good-'));
  let watcher;
  try {
    initConsumer({ target: root, name: 'last-good', engine: '1.3.0' });
    const source = fs.readFileSync(path.join(root, 'src/Main.ts'), 'utf8');
    const htmlFile = path.join(root, 'public/index.html');
    fs.writeFileSync(htmlFile, fs.readFileSync(htmlFile, 'utf8').replace('last-good', 'ACCEPTED'));
    const options = { projectRoot: root, engineRoot, config: { features: ['core', '3d'] } };
    await runConsumerBuild(options);
    const accepted = snapshot(root);
    const fingerprint = JSON.parse(
      fs.readFileSync(path.join(root, 'dist/web/payload-manifest.json')),
    ).fingerprint;
    const claimed = {
      passed: true,
      provenance: { id: 'fixture' },
      selection: { id: 'fixture' },
      fingerprint,
    };
    for (const evidence of [
      { ...claimed, schemaVersion: 1 },
      {
        ...claimed,
        schemaVersion: 2,
        environment: {
          passed: true,
          requested: {
            viewport: { width: 640, height: 360 },
            canvas: { width: 640, height: 360 },
            dpr: 2,
            renderDpr: 2,
          },
          measured: {
            viewport: { width: 640, height: 360 },
            dpr: 1,
            canvas: { css: { width: 640, height: 360 }, backing: { width: 640, height: 360 } },
            stage: { width: 640, height: 360, scaleX: 1, scaleY: 1 },
          },
        },
      },
    ]) {
      fs.writeFileSync(path.join(root, 'invalid-environment.json'), JSON.stringify(evidence));
      await assert.rejects(
        runConsumerBuild({
          ...options,
          config: { ...options.config, prefabEvidence: ['invalid-environment.json'] },
        }),
        /stale prefab evidence/,
      );
      assert.deepEqual(snapshot(root), accepted);
    }
    fs.writeFileSync(path.join(root, 'dist/keep.txt'), 'unrelated artifact');
    for (const failure of ['compile', 'missing-evidence', 'stale-evidence', 'package']) {
      fs.writeFileSync(htmlFile, fs.readFileSync(htmlFile, 'utf8').replace('ACCEPTED', 'REJECTED'));
      fs.writeFileSync(
        path.join(root, 'src/Main.ts'),
        failure === 'compile' ? source + '\nconst broken = ;' : source,
      );
      fs.writeFileSync(
        path.join(root, 'stale.json'),
        JSON.stringify({
          schemaVersion: 1,
          passed: true,
          provenance: {},
          selection: { id: 'fixture' },
          fingerprint: 'stale',
        }),
      );
      const config = {
        ...options.config,
        ...(failure === 'package' ? { maxPackageBytes: 1 } : {}),
        ...(failure.endsWith('evidence')
          ? { prefabEvidence: [failure.startsWith('missing') ? 'missing.json' : 'stale.json'] }
          : {}),
      };
      // The watcher uses the real builder; failure is observed from its existing HTTP preview.
      watcher = watchConsumer({
        project: root,
        host: '127.0.0.1',
        port: 0,
        build: () => runConsumerBuild({ ...options, config }),
        log: { log() {}, error() {}, warn() {} },
      });
      await watcher.preview.listening;
      const url = `http://127.0.0.1:${watcher.preview.server.address().port}/`;
      assert.equal(await watcher.rebuild(failure), null);
      const response = await fetch(url);
      assert.equal(response.status, 200);
      const body = await response.text();
      assert.match(body, /ACCEPTED/);
      assert.doesNotMatch(body, /REJECTED/);
      assert.deepEqual(snapshot(root), accepted, failure);
      await watcher.close();
      watcher = null;
      assert.deepEqual(
        fs.readdirSync(path.join(root, 'dist')).filter((name) => name.startsWith('.zhuda')),
        [],
      );
    }
    fs.writeFileSync(path.join(root, 'src/Main.ts'), source);
    await runConsumerBuild(options);
    assert.match(fs.readFileSync(path.join(root, 'dist/web/index.html'), 'utf8'), /REJECTED/);
    assert.notDeepEqual(snapshot(root), accepted);
    assert.equal(fs.readFileSync(path.join(root, 'dist/keep.txt'), 'utf8'), 'unrelated artifact');
    const build = JSON.parse(fs.readFileSync(path.join(root, 'dist/consumer-build.json')));
    assert.equal(build.output, path.join(root, 'dist/web'));
    assert.doesNotMatch(JSON.stringify(build), /\.zhuda-build-/);
  } finally {
    await watcher?.close();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('publication rolls back all artifacts after a mid-publish rename failure', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-publish-'));
  const staging = path.join(root, 'staging');
  fs.mkdirSync(path.join(staging, 'web'), { recursive: true });
  fs.mkdirSync(path.join(root, 'web'));
  for (const file of ['web/index.html', 'game.zip', 'consumer-build.json']) {
    fs.writeFileSync(path.join(root, file), 'old');
    fs.writeFileSync(path.join(staging, file), 'new');
  }
  const rename = fs.renameSync;
  const mocked = t.mock.method(fs, 'renameSync', (src, dst) => {
    if (src === path.join(staging, 'consumer-build.json'))
      throw Error('injected publication failure');
    return rename(src, dst);
  });
  try {
    assert.throws(
      () => publishConsumerOutput({ staging, output: path.join(root, 'web') }),
      /injected/,
    );
    for (const file of ['web/index.html', 'game.zip', 'consumer-build.json'])
      assert.equal(fs.readFileSync(path.join(root, file), 'utf8'), 'old');
  } finally {
    mocked.mock.restore();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('competing consumer builds cannot publish mixed generations', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-build-lock-'));
  try {
    initConsumer({ target: root, name: 'build-lock', engine: '1.3.0' });
    const options = { projectRoot: root, engineRoot };
    const first = runConsumerBuild(options);
    await assert.rejects(runConsumerBuild(options), /already owns/);
    await first;
    assert.ok(fs.existsSync(path.join(root, 'dist/game.zip')));
    assert.equal(fs.existsSync(path.join(root, 'dist/.zhuda-consumer-build.lock')), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('asset allowlist isolates a package from new sibling games, including public/assets', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-asset-include-'));
  try {
    initConsumer({ target: root, name: 'asset-selection', engine: '1.3.0' });
    for (const file of [
      'assets/game-a/live.txt',
      'assets/game-a/source/design.txt',
      'assets/shared.txt',
      'assets/game-b/other.txt',
      'public/assets/game-b/overlay.txt',
    ]) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), file);
    }
    const options = {
      projectRoot: root,
      engineRoot,
      config: { assetInclude: ['game-a', 'shared.txt'], assetExclude: ['game-a/source'] },
    };
    await runConsumerBuild(options);
    const first = snapshot(root);
    fs.mkdirSync(path.join(root, 'assets/new-game'));
    fs.writeFileSync(path.join(root, 'assets/new-game/file.txt'), 'new content');
    await runConsumerBuild(options);
    assert.deepEqual(snapshot(root), first);
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dist/web/payload-manifest.json')));
    assert.deepEqual(
      manifest.files
        .filter((file) => file.path.startsWith('assets/'))
        .map((file) => file.path)
        .sort(),
      ['assets/game-a/live.txt', 'assets/shared.txt'],
    );
    for (const invalid of [['../escape'], ['/absolute'], ['game-a/*'], ['missing'], 'game-a'])
      await assert.rejects(
        runConsumerBuild({ ...options, config: { assetInclude: invalid } }),
        /assetInclude/,
      );
    assert.deepEqual(snapshot(root), first);
    await runConsumerBuild({ ...options, config: { assetInclude: [] } });
    const none = JSON.parse(fs.readFileSync(path.join(root, 'dist/web/payload-manifest.json')));
    assert.equal(
      none.files.some((file) => file.path.startsWith('assets/')),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
