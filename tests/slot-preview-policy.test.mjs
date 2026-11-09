import test from 'node:test';
import assert from 'node:assert/strict';
import { resolvePreviewResourcePolicy, shouldReleaseHiddenPreview } from '../examples/slot-symbol-prefab/src/preview-resource-policy.ts';

test('slot preview releases hidden large modes by default and can retain them explicitly', () => {
  assert.equal(resolvePreviewResourcePolicy(''), 'release');
  assert.equal(resolvePreviewResourcePolicy('?resources=release'), 'release');
  assert.equal(resolvePreviewResourcePolicy('?resources=retain'), 'retain');
  assert.equal(shouldReleaseHiddenPreview('release', 'model', 'prefab'), true);
  assert.equal(shouldReleaseHiddenPreview('release', 'scene', 'model'), true);
  assert.equal(shouldReleaseHiddenPreview('release', 'prefab', 'model'), false);
  assert.equal(shouldReleaseHiddenPreview('retain', 'model', 'prefab'), false);
});
