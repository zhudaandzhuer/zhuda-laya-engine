import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditPrefabLifecycle,
  requestedPrefabCycles,
} from '../packages/compiler/prefab-lifecycle.mjs';

test('lifecycle gate rejects early ready, partial cycles, leaks, changed resources and wrong selection', () => {
  const url = 'http://localhost/prefab-preview.html?id=tree&node=Body&state=idle&cycles=30';
  const report = {
    ready: true,
    selection: { id: 'tree', node: 'Body', state: 'idle' },
    provenance: { id: 'tree', state: 'idle' },
    lifecycle: [],
  };
  assert.equal(auditPrefabLifecycle(report, url).passed, false);
  report.lifecycle = Array.from({ length: 30 }, () => ({
    instances: 0,
    references: 0,
    pending: 0,
  }));
  report.lifecycleCheck = {
    requestedCycles: 30,
    completedCycles: 30,
    status: 'complete',
    before: { mesh: 4 },
    after: { mesh: 4 },
  };
  assert.equal(auditPrefabLifecycle(report, url).passed, true);
  for (const mutate of [
    (r) => (r.lifecycleCheck.completedCycles = 29),
    (r) => (r.lifecycleCheck.status = 'running'),
    (r) => (r.lifecycle[15].references = 1),
    (r) => (r.lifecycle[2].shared3D = { references: 1, pending: 0 }),
    (r) => r.lifecycleCheck.after.mesh++,
    (r) => (r.selection.state = 'wrong'),
    (r) => (r.provenance.id = 'other'),
  ]) {
    const changed = structuredClone(report);
    mutate(changed);
    assert.equal(auditPrefabLifecycle(changed, url).passed, false);
  }
  assert.throws(() => requestedPrefabCycles('http://localhost/?cycles=NaN'), /Invalid/);
  assert.throws(() => requestedPrefabCycles('http://localhost/?cycles=101'), /Invalid/);
});
