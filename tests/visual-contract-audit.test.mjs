import test from 'node:test';
import assert from 'node:assert/strict';
import { auditVisualPresentationContracts } from '../packages/compiler/visual-contract-audit.mjs';

test('visual presentation manifest passes the strict contract gate', () => {
  const report = auditVisualPresentationContracts({
    projectRoot: '/Users/yaowei/Desktop/天堂老虎機'
  });
  assert.equal(report.passed, true, report.issues.join('\n'));
  assert.deepEqual(report.contractIds, ['win-focus']);
});

test('visual presentation gate rejects a missing manifest', () => {
  const report = auditVisualPresentationContracts({
    projectRoot: '/tmp/zhuda-missing-visual-contract'
  });
  assert.equal(report.passed, false);
  assert.match(report.issues[0], /Missing visual-presentation-manifest/);
});
