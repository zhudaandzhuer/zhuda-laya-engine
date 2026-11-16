import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaQualityMemory,
  ZHUDA_QUALITY_MEMORY_VERSION,
} from '../packages/core/runtime3d/QualityMemory.ts';

/** A storage like `localStorage`, with a switch that makes every call throw. */
function memoryStorage() {
  const items = new Map();
  const storage = {
    broken: false,
    items,
    getItem(key) {
      if (storage.broken) throw Error('SecurityError');
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      if (storage.broken) throw Error('QuotaExceededError');
      items.set(key, String(value));
    },
    removeItem(key) {
      if (storage.broken) throw Error('SecurityError');
      items.delete(key);
    },
  };
  return storage;
}

test('a kept level is the next start, under the key the game names', () => {
  const storage = memoryStorage();
  const memory = new ZhudaQualityMemory({ key: 'reef', storage, levels: 9 });
  assert.equal(memory.read(), undefined, 'nothing kept yet');
  assert.equal(memory.startLevel(8), 8, 'the default');
  assert.equal(memory.write({ level: 4, renderScale: 0.85, detail: 0.7 }), true);
  assert.deepEqual(memory.read(), { level: 4, levels: 9, renderScale: 0.85, detail: 0.7 });
  const next = new ZhudaQualityMemory({ key: 'reef', storage, levels: 9 });
  assert.equal(next.startLevel(8), 4);
  assert.deepEqual(
    [...storage.items.keys()],
    [`zhuda-quality-v${ZHUDA_QUALITY_MEMORY_VERSION}:reef`],
  );
  // Another game's key is its own.
  assert.equal(new ZhudaQualityMemory({ key: 'cave', storage, levels: 9 }).startLevel(8), 8);
});

test('storage that throws, is missing, empty, corrupt, of another version or ladder: the default', () => {
  const storage = memoryStorage();
  const memory = new ZhudaQualityMemory({ key: 'reef', storage, levels: 9 });
  memory.write({ level: 2 });
  storage.broken = true;
  assert.equal(memory.read(), undefined);
  assert.equal(memory.startLevel(8), 8);
  assert.equal(memory.write({ level: 3 }), false, 'a refused write says so');
  assert.equal(memory.beginLoad(), false);
  assert.equal(memory.endLoad(), false);
  storage.broken = false;
  const none = new ZhudaQualityMemory({ key: 'reef', storage: null, levels: 9 });
  assert.equal(none.startLevel(8), 8);
  assert.equal(none.write({ level: 1 }), false);
  const key = `zhuda-quality-v${ZHUDA_QUALITY_MEMORY_VERSION}:reef`;
  for (const text of [
    '',
    '{',
    'null',
    '[]',
    '{"v":2,"level":3,"levels":9}',
    '{"v":1,"level":3,"levels":7}',
    '{"v":1,"level":9,"levels":9}',
    '{"v":1,"level":-1,"levels":9}',
    '{"v":1,"level":2.5,"levels":9}',
  ]) {
    storage.items.set(key, text);
    assert.equal(memory.read(), undefined, text);
    assert.equal(memory.startLevel(8), 8, text);
  }
  // Out-of-range extras are dropped, the level is kept.
  storage.items.set(key, '{"v":1,"level":3,"levels":9,"renderScale":7,"detail":0.1}');
  assert.deepEqual(memory.read(), { level: 3, levels: 9 });
  // An older format lived under another key and is never read.
  storage.items.clear();
  storage.items.set('zhuda-quality-v0:reef', '{"level":1}');
  assert.equal(memory.startLevel(8), 8);
});

test('a load that never reached its first frame starts the next visit a level lower, and lower again', () => {
  const storage = memoryStorage();
  const visit = () => new ZhudaQualityMemory({ key: 'reef', storage, levels: 5 });
  // First visit: no record, the top; the load finishes.
  let memory = visit();
  assert.equal(memory.startLevel(4), 4);
  memory.beginLoad();
  assert.equal(memory.loadUnfinished, true);
  memory.endLoad();
  assert.equal(memory.loadUnfinished, false);
  memory.write({ level: 4 });
  // Second visit: the load ends the tab (no endLoad).
  memory = visit();
  assert.equal(memory.startLevel(4), 4);
  memory.beginLoad();
  // Third visit: one lower, and that lower level is kept.
  memory = visit();
  assert.equal(memory.startLevel(4), 3);
  assert.equal(memory.read().level, 3);
  memory.beginLoad();
  // It fails again: lower again; at 0 it stays.
  memory = visit();
  assert.equal(memory.startLevel(4), 2);
  memory.beginLoad();
  memory.endLoad();
  memory = visit();
  assert.equal(memory.startLevel(4), 2, 'a finished load does not lower');
  storage.items.set(
    `zhuda-quality-v${ZHUDA_QUALITY_MEMORY_VERSION}:reef`,
    '{"v":1,"level":0,"levels":5}',
  );
  memory.beginLoad();
  assert.equal(visit().startLevel(4), 0);
  memory.clear();
  assert.equal(storage.items.size, 0);
});

test('bad options and records are refused', () => {
  const storage = memoryStorage();
  for (const options of [
    { key: '', storage, levels: 3 },
    { key: 'a b', storage, levels: 3 },
    { key: 'x'.repeat(65), storage, levels: 3 },
    { key: 'ok', storage, levels: 0 },
    { key: 'ok', storage, levels: 1.5 },
    { key: 'ok', storage: {}, levels: 3 },
  ])
    assert.throws(() => new ZhudaQualityMemory(options), /Quality memory/);
  const memory = new ZhudaQualityMemory({ key: 'ok', storage, levels: 3 });
  assert.throws(() => memory.write({ level: 3 }), /level/);
  assert.throws(() => memory.write({ level: 1, renderScale: 0.2 }), /renderScale/);
  assert.throws(() => memory.write({ level: 1, detail: 2 }), /detail/);
  assert.throws(() => memory.startLevel(3), /fallback/);
});
