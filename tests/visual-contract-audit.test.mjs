import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditVisualPresentationContracts } from '../packages/compiler/visual-contract-audit.mjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtureManifest = 'tests/fixtures/visual-presentation-manifest.json';

test('visual presentation manifest passes the strict contract gate', () => {
  const report = auditVisualPresentationContracts({
    projectRoot,
    manifestPath: fixtureManifest
  });
  assert.equal(report.passed, true, report.issues.join('\n'));
  assert.deepEqual(report.contractIds, ['sample-focus']);
});

test('visual presentation gate rejects a missing manifest', () => {
  const report = auditVisualPresentationContracts({
    projectRoot: '/tmp/zhuda-missing-visual-contract'
  });
  assert.equal(report.passed, false);
  assert.match(report.issues[0], /Missing visual-presentation-manifest/);
});
