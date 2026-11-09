import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertZhudaRealmAvailable,
  inspectLayaRealm,
  markZhudaLayaRealm,
  ZHUDA_LAYA_REALM_MARKER,
} from '../packages/core/RealmGuards.ts';

test('realm guard allows an unloaded or uninitialized Laya namespace', () => {
  const unloaded = {};
  assert.equal(inspectLayaRealm(unloaded).owner, 'none');
  assert.equal(assertZhudaRealmAvailable(unloaded).owner, 'none');

  const loaded = { Laya: { stage: null, Browser: { mainCanvas: { source: null } } } };
  assert.equal(inspectLayaRealm(loaded).owner, 'uninitialized');
  assert.equal(assertZhudaRealmAvailable(loaded).owner, 'uninitialized');
});

test('realm guard rejects an initialized foreign Laya realm with iframe guidance', () => {
  const foreign = { Laya: { stage: {}, Browser: { mainCanvas: { source: {} } } } };
  const report = inspectLayaRealm(foreign);
  assert.equal(report.owner, 'foreign');
  assert.throws(() => assertZhudaRealmAvailable(foreign), /ZHUDA_FOREIGN_LAYA_REALM/);
  assert.throws(() => assertZhudaRealmAvailable(foreign), /ZhudaRuntimeHost|iframe/);
});

test('a marked realm can be reused after a Zhuda context is disposed', () => {
  const realm = { Laya: { stage: {}, Browser: { mainCanvas: { source: {} } } } };
  markZhudaLayaRealm(realm);
  assert.equal(realm[ZHUDA_LAYA_REALM_MARKER], 'zhuda');
  assert.equal(assertZhudaRealmAvailable(realm).owner, 'zhuda');
});
