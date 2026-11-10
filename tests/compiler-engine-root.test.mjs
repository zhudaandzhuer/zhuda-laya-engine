import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveEngineRoot } from '../packages/compiler/zhuda-build.mjs';

test('consumer engineRoot resolves relative to the consumer project', () => {
  const project = '/tmp/consumer-game';
  assert.equal(
    resolveEngineRoot(project, 'node_modules/zhuda-laya-engine'),
    path.resolve(project, 'node_modules/zhuda-laya-engine'),
  );
  assert.equal(resolveEngineRoot(project, '/opt/zhuda-laya-engine'), '/opt/zhuda-laya-engine');
});
