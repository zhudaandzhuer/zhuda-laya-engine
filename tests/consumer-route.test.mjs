import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { auditConsumerSources } from '../packages/compiler/consumer-guards.mjs';
import { initConsumer, parseInitArgs } from '../packages/compiler/zhuda-init.mjs';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';

test('consumer starter creates a pinned public-SDK route', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-init-'));
  try {
    const target = path.join(root, 'my-game');
    const result = initConsumer({
      target,
      name: 'my-game',
      engine: 'github:zhudaandzhuer/zhuda-laya-engine#0127bd214752383b785193e6d940f61d0a89b5c8',
    });
    assert.equal(result.name, 'my-game');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(target, 'package.json'))).dependencies[
        'zhuda-laya-engine'
      ],
      'github:zhudaandzhuer/zhuda-laya-engine#0127bd214752383b785193e6d940f61d0a89b5c8',
    );
    assert.match(fs.readFileSync(path.join(target, 'public/index.html'), 'utf8'), /ZHUDA_LIBS/);
    assert.match(fs.readFileSync(path.join(target, 'public/index.html'), 'utf8'), /ZHUDA_ENTRY/);
    assert.match(fs.readFileSync(path.join(target, 'src/Main.ts'), 'utf8'), /ZhudaEngine\.boot/);
    assert.equal(auditConsumerSources(target).passed, true);
    const report = await runConsumerBuild({
      projectRoot: target,
      engineRoot: path.resolve(import.meta.dirname, '..'),
      config: JSON.parse(fs.readFileSync(path.join(target, 'zhuda.config.json'), 'utf8')),
    });
    assert.equal(report.route.level, 'engine-backed-static');
    assert.equal(report.route.browserWebGL, 'required');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('consumer guards reject counterfeit renderer paths with actionable codes', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-counterfeit-'));
  try {
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ dependencies: { 'zhuda-laya-engine': 'latest' } }),
    );
    fs.writeFileSync(
      path.join(root, 'public/index.html'),
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script><div id="game"></div>',
    );
    fs.writeFileSync(
      path.join(root, 'src/Main.ts'),
      `import * as THREE from "three";
class ZhudaEngine { static boot() {} }
const renderer = new THREE.WebGLRenderer();
`,
    );
    const report = auditConsumerSources(root);
    assert.equal(report.passed, false);
    const codes = new Set(report.issues.map((issue) => issue.code));
    for (const code of [
      'ENGINE_DEPENDENCY_UNPINNED',
      'EXTERNAL_RENDERER_IMPORT',
      'FAKE_ENGINE_FACADE',
      'EXTERNAL_RENDERER_USAGE',
      'CONSUMER_MARKERS_MISSING',
      'PUBLIC_SDK_IMPORT_MISSING',
      'ENGINE_BOOT_MISSING',
    ]) {
      assert.ok(codes.has(code), `expected ${code}, got ${JSON.stringify([...codes])}`);
    }
    assert.ok(report.issues.every((issue) => Number.isInteger(issue.line) && issue.line > 0));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('init argument parser keeps the consumer target and explicit engine spec', () => {
  const parsed = parseInitArgs(['./game', '--name', 'Neon Bay', '--engine', '1.3.0']);
  assert.equal(parsed.name, 'neon-bay');
  assert.equal(parsed.engine, '1.3.0');
  assert.equal(parsed.target, path.resolve(process.cwd(), 'game'));
  assert.throws(() => parseInitArgs(['./game', '--engine']), /--engine requires/);
});

test('2D scaffold uses the same isolated definitions and complete declaration checking', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-2d-init-'));
  try {
    const parsed = parseInitArgs([root, '--engine', '1.10.0', '--template', '2d']);
    initConsumer(parsed);
    const config = JSON.parse(fs.readFileSync(path.join(root, 'zhuda.config.json')));
    assert.deepEqual(config.features, ['core', '2d', 'ui']);
    assert.equal(config.prefabPreview, 'src/prefabs.ts');
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(root, 'tsconfig.json'))).compilerOptions.skipLibCheck,
      false,
    );
    assert.equal(auditConsumerSources(root).passed, true);
    const report = await runConsumerBuild({ projectRoot: root, config });
    assert.equal(report.route.level, 'engine-backed-static');
    assert.throws(
      () => parseInitArgs([root, '--engine', '1.10.0', '--template', 'slot']),
      /template/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
