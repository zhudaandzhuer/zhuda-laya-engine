import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrefabDependencies,
  selectPrefabDependencyProof,
  prefabEvidenceMatches,
} from '../packages/compiler/prefab-dependencies.mjs';

const components = {
  leaf: { entry: 'src/leaf.ts', assets: ['leaf.png'] },
  parent: { entry: 'src/parent.ts', dependsOn: ['leaf'] },
  other: { entry: 'src/other.ts', assets: [] },
};
const bundles = {
  leaf: 'prefab-component-leaf.js',
  parent: 'prefab-component-parent.js',
  other: 'prefab-component-other.js',
};
const payload = [
  ...Object.values(bundles),
  'prefab-preview.js',
  'prefab-preview.html',
  'libs/laya.js',
  'assets/leaf.png',
  'assets/unrelated.png',
  'fonts/font.woff',
  'app.js',
].map((path) => ({ path, sha256: path + '-hash' }));

test('component change invalidates parents, preserves unrelated components; renderer/font/SDK dependencies invalidate', () => {
  const before = buildPrefabDependencies(payload, components, bundles);
  const change = (file) =>
    buildPrefabDependencies(
      payload.map((p) => (p.path === file ? { ...p, sha256: 'changed' } : p)),
      components,
      bundles,
    );
  for (const file of ['prefab-component-leaf.js', 'assets/leaf.png']) {
    const after = change(file);
    assert.notEqual(after.components.leaf.fingerprint, before.components.leaf.fingerprint);
    assert.notEqual(after.components.parent.fingerprint, before.components.parent.fingerprint);
    assert.equal(after.components.other.fingerprint, before.components.other.fingerprint);
  }
  for (const file of ['libs/laya.js', 'fonts/font.woff', 'prefab-preview.html'])
    for (const id of Object.keys(components))
      assert.notEqual(change(file).components[id].fingerprint, before.components[id].fingerprint);
  assert.deepEqual(change('app.js'), before);
  const unknown = { ...components, other: { entry: 'src/other.ts' } };
  assert.notEqual(
    buildPrefabDependencies(payload, unknown, bundles).components.other.fingerprint,
    buildPrefabDependencies(
      payload.map((p) => (p.path === 'assets/unrelated.png' ? { ...p, sha256: 'changed' } : p)),
      unknown,
      bundles,
    ).components.other.fingerprint,
  );
  assert.throws(
    () =>
      buildPrefabDependencies(
        payload,
        { a: { entry: 'a.ts', dependsOn: ['missing'] } },
        { a: 'x' },
      ),
    /unknown child/,
  );
  assert.throws(
    () =>
      buildPrefabDependencies(payload, { leaf: { entry: 'a.ts', dependsOn: ['leaf'] } }, bundles),
    /cycle/,
  );
});

test('scoped proof requires matching component, loaded bundle and verified sources; unknown requests keep whole payload', () => {
  const graph = buildPrefabDependencies(payload, components, bundles),
    manifest = { prefabDependencies: graph };
  const report = {
    componentId: 'leaf',
    selection: { id: 'leaf' },
    provenance: { sources: { 'leaf.png': 'assets/leaf.png-hash' } },
  };
  const url = 'http://localhost/prefab-preview.html?id=leaf';
  const requests = [
    'http://localhost/prefab-preview.html',
    'http://localhost/prefab-component-leaf.js',
    'http://localhost/assets/leaf.png',
  ];
  const proof = selectPrefabDependencyProof(manifest, report, requests, url);
  assert.equal(proof.fingerprint, graph.components.leaf.fingerprint);
  for (const extra of ['http://localhost/assets/unrelated.png', 'https://cdn.invalid/asset.png'])
    assert.equal(selectPrefabDependencyProof(manifest, report, [...requests, extra], url), null);
  assert.equal(
    selectPrefabDependencyProof(manifest, { ...report, componentId: null }, requests, url),
    null,
  );
  assert.equal(
    selectPrefabDependencyProof(
      manifest,
      { ...report, provenance: { sources: { 'leaf.png': 'wrong' } } },
      requests,
      url,
    ),
    null,
  );
  const evidence = { selection: report.selection, dependencyProof: proof, fingerprint: 'old' };
  assert.equal(prefabEvidenceMatches(evidence, 'new', graph), true);
  assert.equal(prefabEvidenceMatches({ ...evidence, dependencyProof: null }, 'new', graph), false);
});
