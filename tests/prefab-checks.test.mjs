import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePrefabChecks } from '../packages/compiler/prefab-checks.mjs';

const base = {
  prefabChecks: [
    {
      id: 'hero',
      baseline: 'references/hero.png',
      output: 'evidence/hero.json',
      browserTimeoutMs: 60000,
    },
  ],
};

test('prefab checks allow a bounded browser readiness timeout', () => {
  assert.equal(validatePrefabChecks(base, '/tmp/consumer')[0].browserTimeoutMs, 60000);
  for (const browserTimeoutMs of [4999, 180001, 1.5, '60000']) {
    assert.throws(
      () =>
        validatePrefabChecks(
          { prefabChecks: [{ ...base.prefabChecks[0], browserTimeoutMs }] },
          '/tmp/consumer',
        ),
      /browserTimeoutMs/,
    );
  }
});

test('prefab checks reject unknown timeout fields instead of silently ignoring them', () => {
  assert.throws(
    () =>
      validatePrefabChecks(
        { prefabChecks: [{ ...base.prefabChecks[0], timeoutMs: 60000 }] },
        '/tmp/consumer',
      ),
    /unknown field/,
  );
});
