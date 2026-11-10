import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { initConsumer } from '../packages/compiler/zhuda-init.mjs';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';
import { acceptConsumer, validatePrefabChecks } from '../packages/compiler/consumer-accept.mjs';
import { requestedPrefabEnvironment } from '../packages/compiler/prefab-environment.mjs';
const engineRoot = path.resolve(import.meta.dirname, '..');
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
const snapshot = (root) =>
  Object.fromEntries(
    ['web/app.js', 'web/payload-manifest.json', 'consumer-build.json', 'game.zip'].map((file) => [
      file,
      sha(fs.readFileSync(path.join(root, 'dist', file))),
    ]),
  );

test('candidate workflow leaves release intact; capture/failure/source race cannot publish; exact checked candidate publishes', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-accept-'));
  try {
    initConsumer({ target: root, name: 'accept-fixture', engine: '1.4.1' });
    fs.writeFileSync(path.join(root, 'src/prefabs.ts'), 'export const definitions=[];');
    const config = { features: ['core', '3d'], prefabPreview: 'src/prefabs.ts' };
    await runConsumerBuild({ projectRoot: root, engineRoot, config });
    const previous = snapshot(root);
    config.prefabChecks = [
      {
        id: 'fixture',
        state: 'idle',
        width: 320,
        height: 180,
        dpr: 1,
        baseline: 'refs/fixture.png',
        output: 'evidence/fixture.json',
      },
    ];
    fs.writeFileSync(path.join(root, 'zhuda.config.json'), JSON.stringify(config));
    const candidate = await runConsumerBuild({
      projectRoot: root,
      engineRoot,
      config,
      mode: 'candidate',
    });
    assert.equal(candidate.mode, 'candidate');
    assert.deepEqual(snapshot(root), previous);
    assert.match(candidate.output, /dist[\\/]candidate[\\/]web$/);
    await assert.rejects(runConsumerBuild({ projectRoot: root, engineRoot, config }), /ENOENT/);
    await assert.rejects(
      acceptConsumer({ projectRoot: root, engineRoot, check: async () => ({ passed: false }) }),
      /comparison failed/,
    );
    assert.deepEqual(snapshot(root), previous);
    assert.equal(
      (
        await acceptConsumer({
          projectRoot: root,
          engineRoot,
          capture: true,
          check: async () => ({ passed: false }),
        })
      ).published,
      false,
    );
    assert.deepEqual(snapshot(root), previous);
    // Unit-only report fixture exercises publication guards, never claimed as real browser evidence.
    const checker = async ({ url, baseline, output }) => {
      const manifest = await (await fetch(new URL('payload-manifest.json', url))).json();
      const requested = requestedPrefabEnvironment(url);
      const measured = {
        viewport: requested.viewport,
        dpr: 1,
        canvas: { css: requested.canvas, backing: requested.canvas },
        stage: { ...requested.canvas, scaleX: 1, scaleY: 1 },
      };
      for (const file of [baseline, output + '.png']) {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, 'unit-only');
      }
      const report = {
        schemaVersion: 2,
        passed: true,
        selection: { id: 'fixture', state: 'idle', node: '' },
        provenance: { id: 'fixture', state: 'idle' },
        url,
        fingerprint: manifest.fingerprint,
        comparison: { passed: true, differentPixels: 0 },
        environment: { requested, measured, passed: true },
        actual: path.basename(output) + '.png',
        actualSha256: sha('unit-only'),
        baseline: path.relative(path.dirname(output), baseline),
        baselineSha256: sha('unit-only'),
      };
      fs.writeFileSync(output, JSON.stringify(report));
      return report;
    };
    const sourceFile = path.join(root, 'src/Main.ts'),
      source = fs.readFileSync(sourceFile, 'utf8');
    await assert.rejects(
      acceptConsumer({
        projectRoot: root,
        engineRoot,
        check: async (args) => {
          const report = await checker(args);
          fs.appendFileSync(sourceFile, "\nconsole.log('changed during comparison');");
          return report;
        },
      }),
      /Candidate changed/,
    );
    assert.deepEqual(snapshot(root), previous);
    fs.writeFileSync(sourceFile, source);
    const accepted = await acceptConsumer({ projectRoot: root, engineRoot, check: checker });
    assert.equal(accepted.published, true);
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(root, 'dist/web/payload-manifest.json'))).fingerprint,
      accepted.release.fingerprint,
    );
    const reportFile = path.join(root, 'evidence/fixture.json'),
      report = JSON.parse(fs.readFileSync(reportFile));
    report.selection.state = 'wrong';
    report.provenance.state = 'wrong';
    delete report.url;
    fs.writeFileSync(reportFile, JSON.stringify(report));
    await assert.rejects(
      runConsumerBuild({ projectRoot: root, engineRoot, config }),
      /configured selection/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('configured checks reject ambiguous paths and invalid requests with location', () => {
  const valid = { id: 'fixture', baseline: 'refs/a.png', output: 'evidence/a.json' };
  for (const check of [
    { ...valid, output: '../escape.json' },
    { ...valid, cycles: 101 },
    { ...valid, maxDiffPixels: -1 },
    { ...valid, unknown: true },
  ])
    assert.throws(() => validatePrefabChecks({ prefabChecks: [check] }, process.cwd()));
  assert.throws(
    () => validatePrefabChecks({ prefabChecks: [valid, valid] }, process.cwd()),
    /prefabChecks\[1\]/,
  );
});

test('real emitted component bundles isolate unrelated app edits and propagate leaf imports to parents', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-component-build-'));
  try {
    initConsumer({ target: root, name: 'components', engine: '1.4.1' });
    fs.writeFileSync(
      path.join(root, 'src/leaf.ts'),
      "export const color=[1,0,0,1];export const definitions=[{id:'leaf',color}];",
    );
    fs.writeFileSync(
      path.join(root, 'src/parent.ts'),
      "import {color} from './leaf';export const definitions=[{id:'parent',color}];",
    );
    fs.writeFileSync(
      path.join(root, 'src/other.ts'),
      "export const definitions=[{id:'other',color:[0,1,0,1]}];",
    );
    const config = {
      features: ['core', '3d'],
      prefabPreview: 'src/leaf.ts',
      prefabComponents: {
        leaf: { entry: 'src/leaf.ts', assets: [] },
        parent: { entry: 'src/parent.ts', dependsOn: ['leaf'], assets: [] },
        other: { entry: 'src/other.ts', assets: [] },
      },
    };
    const build = async () => {
      await runConsumerBuild({ projectRoot: root, engineRoot, config, mode: 'candidate' });
      return JSON.parse(
        fs.readFileSync(path.join(root, 'dist/candidate/web/payload-manifest.json')),
      );
    };
    const a = await build();
    fs.appendFileSync(path.join(root, 'src/Main.ts'), "\nconsole.log('unrelated gameplay');");
    const b = await build();
    assert.notEqual(a.fingerprint, b.fingerprint);
    assert.deepEqual(a.prefabDependencies, b.prefabDependencies);
    fs.writeFileSync(
      path.join(root, 'src/leaf.ts'),
      fs.readFileSync(path.join(root, 'src/leaf.ts'), 'utf8').replace('[1,0,0,1]', '[0,0,1,1]'),
    );
    const c = await build();
    for (const id of ['leaf', 'parent'])
      assert.notEqual(
        c.prefabDependencies.components[id].fingerprint,
        b.prefabDependencies.components[id].fingerprint,
      );
    assert.equal(
      c.prefabDependencies.components.other.fingerprint,
      b.prefabDependencies.components.other.fingerprint,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
