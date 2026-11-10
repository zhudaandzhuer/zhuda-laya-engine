import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaInstanceGroup } from '../packages/core/runtime3d/Surfaces.ts';
import { destroyLaya342ModelTree } from '../packages/core/runtime3d/Laya342Adapters.ts';
import { ZhudaModelLibrary } from '../packages/core/runtime3d/Assets.ts';
import {
  ZhudaCrowdScheduler,
  ZhudaAnimatorLOD,
  ZhudaRemoteCharacterPresenter,
} from '../packages/core/runtime3d/CrowdPresentation.ts';
import { ZhudaEffectBudget, ZhudaRuntimeProfiler } from '../packages/core/effects/EffectBudget.ts';
import { ZhudaParticleSystem3D } from '../packages/core/particles/ParticleSystem3D.ts';
const tiers = [
  { maxDistance: 10, updateHz: 60, animation: 'full' },
  { maxDistance: Infinity, updateHz: 15, animation: 'low', animationInterval: 4 },
];
const state = { visible: true, distance: 0 };
const emitter = {
  id: 'fx',
  texture: 'neutral',
  maxParticles: 32,
  seed: 42,
  space: 'world',
  blend: 'alpha',
  shape: { type: 'point' },
  rate: 10,
  lifetime: 2,
  speed: 1,
  size: 1,
  direction: { x: 0, y: 1, z: 0 },
  spread: 0,
};

test('instance updates retain one matrix per ID, reject invalid input atomically, borrow geometry/material', () => {
  const previous = globalThis.Laya;
  let matrices = 0,
    destroyed = 0;
  class Matrix {
    elements = new Float32Array(16);
    constructor() {
      matrices++;
    }
  }
  class Node {
    transform = {};
    meshRenderer = {};
    destroy() {
      destroyed++;
    }
  }
  globalThis.Laya = { Matrix4x4: Matrix, MeshSprite3D: Node };
  try {
    const mesh = {},
      material = {},
      g = new ZhudaInstanceGroup({ addChild() {} }, mesh, material),
      m = new Float32Array(16);
    m[0] = m[5] = m[10] = m[15] = 1;
    const node = g.set('a', m),
      matrix = node.transform.worldMatrix;
    for (let i = 0; i < 500; i++) {
      m[12] = i;
      assert.equal(g.set('a', m), node);
      assert.equal(node.transform.worldMatrix, matrix);
    }
    assert.equal(matrices, 1);
    assert.equal(matrix.elements[12], 499);
    m[12] = NaN;
    assert.throws(() => g.set('a', m));
    assert.equal(matrix.elements[12], 499);
    assert.equal(g.remove('a'), true);
    assert.equal(g.remove('a'), false);
    g.dispose();
    g.dispose();
    assert.equal(destroyed, 1);
    assert.throws(() => g.set('b', new Float32Array(16)), /Disposed/);
    assert.deepEqual(mesh, {});
    assert.deepEqual(material, { enableInstancing: true });
  } finally {
    globalThis.Laya = previous;
  }
});

test('particle frequency reduces actual work; catch-up is bounded and time debt is observable', () => {
  const fast = new ZhudaParticleSystem3D(emitter),
    slow = new ZhudaParticleSystem3D(emitter, { frequencyHz: 30, maxSubsteps: 4 });
  fast.play();
  slow.play();
  for (let i = 0; i < 60; i++) {
    fast.update(1 / 60);
    slow.update(1 / 60);
  }
  assert.equal(fast.simulatedSteps, 120);
  assert.equal(slow.simulatedSteps, 30);
  assert.ok(Math.abs(slow.time - fast.time) < 1e-8);
  assert.equal(slow.aliveCount, fast.aliveCount);
  slow.update(2);
  assert.equal(slow.lastSubsteps, 4);
  assert.ok(slow.droppedSeconds > 1.8);
  slow.setSimulation({ frequencyHz: 60, maxSubsteps: 2 });
  slow.update(1);
  assert.equal(slow.lastSubsteps, 2);
  assert.throws(() => slow.setSimulation({ frequencyHz: 0 }));
  slow.clear();
  assert.equal(slow.simulatedSteps, 0);
  assert.equal(slow.droppedSeconds, 0);
});

test('effect minima precede extras; infeasible warnings demand explicit fallback within both budgets', () => {
  const budget = new ZhudaEffectBudget({ maxParticles: 10, maxCoverage: 1 });
  const requests = [
    { id: 'cosmetic', particles: 20, coverage: 2, priority: 100 },
    {
      id: 'warning',
      particles: 10,
      coverage: 1,
      priority: 1,
      minimumScale: 0.5,
      fallbackId: 'ring',
    },
  ];
  let r = budget.allocate(requests);
  assert.equal(r[1].particleLimit, 5);
  assert.equal(r[0].particleLimit, 5);
  assert.equal(r[1].fallbackRequired, false);
  budget.quality = 0.2;
  r = budget.allocate(requests);
  assert.equal(r[1].mode, 'fallback');
  assert.equal(r[1].fallbackId, 'ring');
  assert.equal(r[1].particleLimit, 0);
  assert.ok(r.reduce((n, x) => n + x.particleLimit, 0) <= 2);
  assert.throws(() => budget.allocate([{ ...requests[1], minimumScale: 2 }]));
  r = budget.allocate([{ ...requests[1], visible: false }]);
  assert.equal(r[0].mode, 'culled');
  assert.equal(r[0].fallbackRequired, false);
});

test('scheduler bounds shared work, serves overdue peers, suppresses hidden actors and uses hysteresis', () => {
  const s = new ZhudaCrowdScheduler({ tiers, maxUpdatesPerFrame: 2, hysteresis: 1 }),
    calls = [],
    modes = [];
  for (let i = 0; i < 6; i++)
    s.register(
      String(i),
      { update: (dt) => calls.push([i, dt]), setTier: (t) => modes.push([i, t?.animation]) },
      state,
    );
  for (let i = 0; i < 3; i++) assert.equal(s.update(1 / 60).updated, 2);
  assert.equal(new Set(calls.map((x) => x[0])).size, 6);
  s.setState('0', { visible: true, distance: 10.5 });
  assert.equal(modes.length, 6);
  s.setState('0', { visible: true, distance: 12 });
  assert.deepEqual(modes.at(-1), [0, 'low']);
  s.setState('0', { visible: false, distance: 12 });
  const n = calls.filter((x) => x[0] === 0).length;
  for (let i = 0; i < 10; i++) s.update(0.1);
  assert.equal(calls.filter((x) => x[0] === 0).length, n);
  s.setState('0', state);
  s.update(5);
  assert.ok(calls.every((x) => x[1] <= 0.25));
  assert.ok(s.update(0).droppedSeconds > 0);
  s.remove('0');
  s.dispose();
  assert.throws(() => s.update(1 / 60), /Disposed/);
});

test('native animation LOD changes manager mode without manual ticks and restores explicit settings', () => {
  const a = { speed: 1.5, updateMode: 1, lowUpdateDelty: 3 };
  const lod = new ZhudaAnimatorLOD(a, { updateMode: 1, lowUpdateInterval: 3 });
  assert.throws(() => new ZhudaAnimatorLOD(a), /owner/);
  lod.set('low', 4);
  assert.equal(a.lowUpdateDelty, 4);
  assert.equal(a.updateMode, 1);
  lod.set('paused');
  assert.equal(a.speed, 0);
  lod.set('full');
  assert.equal(a.speed, 1.5);
  assert.equal(a.updateMode, 0);
  lod.dispose();
  lod.dispose();
  assert.deepEqual(a, { speed: 1.5, updateMode: 1, lowUpdateDelty: 3 });
  assert.throws(() => lod.set('full'));
});

test('100 remote actors interpolate together; late teleport, loss, reconnect, AOI removal never rewind authority', () => {
  const p = new ZhudaRemoteCharacterPresenter({
    epoch: 'a',
    tiers,
    maxUpdatesPerFrame: 100,
    interpolate: (a, b, t) => a + (b - a) * t,
    maxExtrapolation: 0.1,
    staleAfterSeconds: 0.3,
  });
  const seen = new Map();
  for (let i = 0; i < 100; i++) {
    p.register(String(i), { present: (v, m, s) => seen.set(String(i), { v, m, s }) }, state);
    for (let q = 0; q < 2; q++)
      p.push(String(i), { epoch: 'a', sequence: q, time: q * 0.1, value: q });
  }
  p.update(1 / 60, 0.05);
  assert.equal(seen.size, 100);
  assert.ok([...seen.values()].every((s) => s.v === 0.5 && s.m === 'interpolated'));
  assert.equal(p.push('0', { epoch: 'a', sequence: 0, time: 0, value: 99 }, true), false);
  p.update(1, 0.8);
  assert.equal(seen.get('0').v, 2);
  assert.equal(seen.get('0').s, true);
  assert.equal(p.push('0', { epoch: 'a', sequence: 2, time: 0.9, value: 40 }, true), true);
  p.update(0.1, 0.95);
  assert.equal(seen.get('0').v, 40);
  p.reset('b');
  assert.equal(p.push('0', { epoch: 'a', sequence: 3, time: 1, value: 99 }), false);
  assert.equal(p.push('0', { epoch: 'b', sequence: 0, time: 0, value: 5 }), true);
  p.update(0.1, 0);
  assert.equal(seen.get('0').v, 5);
  p.remove('0');
  assert.equal(p.push('0', { epoch: 'b', sequence: 1, time: 1, value: 10 }), false);
  p.dispose();
});

test('profiler long window preserves chronology, percentiles, sources and immutable raw export', () => {
  const p = new ZhudaRuntimeProfiler({ capacity: 1000 });
  assert.equal(p.report().measured, false);
  for (let i = 1; i <= 1200; i++) {
    p.beginFrame();
    p.endFrame(i, i / 2, { heapBytes: i * 10 });
  }
  const r = p.report();
  assert.equal(r.droppedSamples, 200);
  assert.equal(r.samples[0].frameMs, 201);
  assert.equal(r.samples.at(-1).frameMs, 1200);
  assert.deepEqual(r.frame, { p50: 700, p95: 1150, p99: 1190 });
  assert.match(r.sources.draw, /unavailable/);
  r.samples[0].frameMs = 0;
  assert.equal(JSON.parse(p.exportJSON({ fixture: 'long' })).samples[0].frameMs, 201);
  p.dispose();
});

test('GPU queries are asynchronous, discard disjoint data, avoid competing timers and release on disposal', () => {
  let active = null,
    disjoint = false,
    ready = false,
    deleted = 0;
  const gl = {
    TRIANGLES: 4,
    TIME: 1,
    DISJOINT: 2,
    CURRENT_QUERY: 3,
    QUERY_RESULT: 4,
    QUERY_RESULT_AVAILABLE: 5,
    getExtension: () => ({ TIME_ELAPSED_EXT: 1, GPU_DISJOINT_EXT: 2 }),
    getParameter: () => disjoint,
    isContextLost: () => false,
    getQuery: () => active,
    createQuery: () => ({}),
    beginQuery: (t, q) => {
      active = q;
    },
    endQuery: () => {
      active = null;
    },
    deleteQuery: () => deleted++,
    getQueryParameter: (q, k) => (k === 5 ? ready : 2000000),
  };
  const p = new ZhudaRuntimeProfiler();
  assert.equal(p.enableGpuTiming(gl), true);
  p.beginFrame();
  p.endFrame(16, 1);
  assert.equal(p.report().gpuTimeMs, null);
  ready = true;
  assert.equal(p.report().gpuTimeMs, 2);
  p.beginFrame();
  p.endFrame(16, 1);
  disjoint = true;
  assert.equal(p.report().samples[1].gpuMs, undefined);
  disjoint = false;
  active = { foreign: true };
  p.beginFrame();
  p.endFrame(16, 1);
  assert.equal(active.foreign, true);
  active = null;
  p.beginFrame();
  p.dispose();
  assert.equal(deleted, 3);
  assert.equal(active, null);
});

test('provider models share parsing, release byte leases, run 30 cycles and reject external dependencies', async () => {
  const previous = globalThis.Laya;
  let loads = 0,
    bytesReleased = 0,
    resources = 0,
    destroyed = 0,
    nodes = 0;
  class Resource {
    constructor() {
      resources++;
    }
    async _parse() {}
    _addReference() {}
    _removeReference() {}
    create() {
      const make = () => {
        nodes++;
        return {
          numChildren: 0,
          clone: make,
          destroy() {
            nodes--;
          },
        };
      };
      return make();
    }
    destroy() {
      assert.equal(this.destroyed, undefined);
      this.destroyed = true;
      destroyed++;
    }
  }
  globalThis.Laya = { glTFResource: Resource };
  let payload = { asset: { version: '2.0' } };
  const provider = {
    name: 'fixture',
    async load(id) {
      loads++;
      assert.equal(id, 'actor.glb');
      return {
        id,
        bytes: new TextEncoder().encode(JSON.stringify(payload)),
        release() {
          bytesReleased++;
        },
      };
    },
  };
  try {
    const library = new ZhudaModelLibrary({ provider, maxIdle: 0 });
    for (let i = 0; i < 30; i++) {
      const [a, b] = await Promise.all([
        library.instantiate('actor.glb'),
        library.instantiate('actor.glb'),
      ]);
      assert.equal(library.report().references, 2);
      a.dispose();
      b.dispose();
      assert.equal(library.report().entries, 0);
    }
    assert.equal(loads, 30);
    assert.equal(resources, 30);
    assert.equal(destroyed, 30);
    assert.equal(bytesReleased, 30);
    assert.equal(nodes, 0);
    payload = { asset: { version: '2.0' }, images: [{ uri: 'secret.png' }] };
    await assert.rejects(library.instantiate('actor.glb'), /embedded/);
    assert.equal(resources, 30);
    assert.equal(bytesReleased, 31);
    library.dispose();
  } finally {
    globalThis.Laya = previous;
  }
});

test('model deadline and caller cancellation are isolated; late parse/provider completion cannot leak', async () => {
  const previous = globalThis.Laya;
  let resolveLoad,
    resolveParse,
    bytesReleased = 0,
    destroyed = 0;
  class Resource {
    async _parse() {
      await new Promise((r) => {
        resolveParse = r;
      });
    }
    _addReference() {}
    _removeReference() {}
    create() {
      const make = () => ({ numChildren: 0, clone: make, destroy() {} });
      return make();
    }
    destroy() {
      this.destroyed = true;
      destroyed++;
    }
  }
  globalThis.Laya = { glTFResource: Resource };
  const provider = {
    name: 'late',
    load: () =>
      new Promise((r) => {
        resolveLoad = () =>
          r({
            id: 'actor',
            bytes: new TextEncoder().encode('{"asset":{"version":"2.0"}}'),
            release() {
              bytesReleased++;
            },
          });
      }),
  };
  try {
    const library = new ZhudaModelLibrary({ provider, maxIdle: 0, timeoutMs: 50 });
    const a = library.instantiate('actor', { timeoutMs: 5 });
    await assert.rejects(a, (e) => e.name === 'TimeoutError');
    resolveLoad();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(bytesReleased, 1);
    assert.equal(destroyed, 0);
    const c = new AbortController();
    const b = library.instantiate('actor', { signal: c.signal }),
      d = library.instantiate('actor', { timeoutMs: 1000 });
    resolveLoad();
    await new Promise((r) => setTimeout(r, 0));
    c.abort();
    await assert.rejects(b, (e) => e.name === 'AbortError');
    resolveParse();
    const instance = await d;
    instance.dispose();
    assert.equal(destroyed, 1);
    assert.equal(bytesReleased, 2);
    const late = library.instantiate('actor', { timeoutMs: 5 });
    resolveLoad();
    await assert.rejects(late, (e) => e.name === 'TimeoutError');
    resolveParse();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(destroyed, 2);
    assert.equal(bytesReleased, 3);
    assert.equal(library.report().entries, 0);
    library.dispose();
  } finally {
    globalThis.Laya = previous;
  }
});

test('model cache builds one off-scene template and shares clips until the last lease releases', async () => {
  const previous = globalThis.Laya;
  let created = 0,
    cloned = 0,
    destroyed = 0,
    refs = 0;
  const clip = {
    get referenceCount() {
      return refs;
    },
    destroyed: false,
    destroy() {
      this.destroyed = true;
      destroyed++;
    },
  };
  const animator = {
    controllerLayerCount: 1,
    getControllerLayer() {
      return { states: [{ clip }] };
    },
  };
  const make = () => {
    refs++;
    return {
      numChildren: 0,
      getComponent: () => animator,
      clone() {
        cloned++;
        return make();
      },
      destroy() {
        refs--;
      },
    };
  };
  class Resource {
    async _parse() {}
    create() {
      created++;
      return make();
    }
    _addReference() {}
    _removeReference() {}
    destroy() {
      this.destroyed = true;
    }
  }
  globalThis.Laya = { glTFResource: Resource, Animator: class {} };
  try {
    const library = new ZhudaModelLibrary({
      maxIdle: 0,
      provider: {
        name: 'embedded',
        async load() {
          return { id: 'model', bytes: new TextEncoder().encode('{"asset":{"version":"2.0"}}') };
        },
      },
    });
    const a = await library.instantiate('model'),
      b = await library.instantiate('model');
    assert.equal(created, 1);
    assert.equal(cloned, 2);
    assert.equal(refs, 3);
    a.dispose();
    assert.equal(clip.destroyed, false);
    b.dispose();
    assert.equal(refs, 0);
    assert.equal(destroyed, 1);
    library.dispose();
  } finally {
    globalThis.Laya = previous;
  }
});

test('model release completes only owned native teardown before destroying shared resources', () => {
  const queue = new Set(),
    events = [];
  const foreign = {};
  queue.add(foreign);
  const component = {
    _driver: { _toDestroys: queue },
    _status: 2,
    _destroy(second) {
      assert.equal(second, true);
      events.push('component');
    },
  };
  const node = {
    _components: [component],
    numChildren: 0,
    destroy() {
      events.push('node');
      component._status = 4;
      queue.add(component);
    },
  };
  destroyLaya342ModelTree(node, {});
  assert.deepEqual(events, ['node', 'component']);
  assert.equal(queue.has(foreign), true);
  assert.equal(queue.has(component), false);
});

test('model clones preserve non-first default animation states authored by glTF', async () => {
  const previous = globalThis.Laya;
  const make = (selected) => {
    const states = [{ name: 'idle' }, { name: 'run' }],
      layer = {
        states,
        defaultState: states.find((s) => s.name === selected),
        getAnimatorState: (name) => states.find((s) => s.name === name),
      };
    return {
      numChildren: 0,
      layer,
      getComponent: () => ({ controllerLayerCount: 1, getControllerLayer: () => layer }),
      clone: () => make('idle'),
      destroy() {},
    };
  };
  class Resource {
    async _parse() {}
    create() {
      return make('run');
    }
    _addReference() {}
    _removeReference() {}
    destroy() {
      this.destroyed = true;
    }
  }
  globalThis.Laya = { glTFResource: Resource, Animator: class {} };
  try {
    const library = new ZhudaModelLibrary({
      maxIdle: 0,
      provider: {
        name: 'embedded',
        async load() {
          return { id: 'model', bytes: new TextEncoder().encode('{"asset":{"version":"2.0"}}') };
        },
      },
    });
    const actor = await library.instantiate('model');
    assert.equal(actor.node.layer.defaultState.name, 'run');
    actor.dispose();
    library.dispose();
  } finally {
    globalThis.Laya = previous;
  }
});
