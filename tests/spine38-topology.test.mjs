import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { TopologyResolver } from '../packages/core/TopologyGraph.ts';
import { runConsumerBuild } from '../packages/compiler/consumer-build.mjs';

const engineRoot = path.resolve(import.meta.dirname, '..');

test('TopologyResolver emits an isolated Spine 3.8 topology', () => {
  const result = TopologyResolver.resolveByFeatures(['core', '2d', 'ui', 'spine38']);
  assert.deepEqual(result.orderedFiles, [
    'laya.core.js',
    'laya.webgl_2D.js',
    'laya.ui.js',
    'spine-core-3.8.js',
    'laya.spine.js',
  ]);
  assert.deepEqual(TopologyResolver.auditFileSequence(result.orderedFiles), []);
  assert.equal(result.orderedFiles.includes('spine-core-4.2.js'), false);
});

test('Spine 3.8 and 4.2 are rejected as one-realm conflicts', () => {
  assert.throws(
    () => TopologyResolver.resolveByFeatures(['core', '2d', 'spine38', 'spine42']),
    /互斥衝突/,
  );
  const issues = TopologyResolver.auditFileSequence([
    'laya.core.js',
    'laya.webgl_2D.js',
    'spine-core-3.8.js',
    'spine-core-4.2.js',
    'laya.spine.js',
  ]);
  assert.ok(issues.some((issue) => issue.type === 'CONFLICTING_MODULE'));
});

test('consumer compiler keeps Spine 3.8 library ordering and version alignment', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'zhuda-spine38-consumer-'));
  try {
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'public/index.html'), '<div id="game"></div><!-- ZHUDA_LIBS --><!-- ZHUDA_ENTRY -->');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({
      name: 'spine38-consumer-fixture',
      private: true,
      type: 'module',
      dependencies: { 'zhuda-laya-engine': '1.14.0' },
    }));
    fs.writeFileSync(path.join(root, 'src/Main.ts'), 'import { ZhudaEngine } from "zhuda-laya-engine"; void ZhudaEngine.boot({features:["core","2d","ui","spine38"]});');
    const result = await runConsumerBuild({
      projectRoot: root,
      engineRoot,
      config: { features: ['core', '2d', 'ui', 'spine38'], assetsDir: false },
    });
    assert.deepEqual(result.orderedLibraries, [
      'laya.core.js',
      'laya.webgl_2D.js',
      'laya.ui.js',
      'spine-core-3.8.js',
      'laya.spine.js',
    ]);
    const html = fs.readFileSync(path.join(root, 'dist/web/index.html'), 'utf8');
    assert.match(html, /spine-core-3\.8\.js/);
    assert.doesNotMatch(html, /spine-core-4\.2\.js/);
    assert.match(html, /SpineConst\.VERSION="3\.8"/);
    assert.match(html, /SpineConst\.NEED_SLOT=false/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
