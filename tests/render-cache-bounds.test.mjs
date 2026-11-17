// MEM-01 (docs/plans/records/windows-acceptance/plan.md): what LayaAir 3.4.2
// kept after content was destroyed, released by the engine's adapters. The
// real draw and the counts over thousands of cycles are
// scripts/verify-webgpu-churn.mjs; these check each repair on its own.
import test from 'node:test';
import assert from 'node:assert/strict';

const webgpu = () => import('../packages/core/runtime3d/WebGPU342Adapters.ts');
const laya = () => import('../packages/core/runtime3d/Laya342Adapters.ts');

/** The smallest native namespace installLaya342WebGPUFix accepts, plus `extra`. */
function nativeWith(extra) {
  class Agent {
    appendRenderElement() {}
  }
  return { WebGPUMeshRenderBatchAgent: Agent, Stat: { loopCount: 0 }, ...extra };
}

test('a destroyed sprite destroys its own shader data, once, after its own destroy', async () => {
  const { installLaya342WebGPUFix } = await webgpu();
  const order = [];
  class Sprite {
    constructor() {
      this._shaderData = { destroy: () => order.push('data') };
    }
    destroy() {
      order.push('sprite');
    }
  }
  class Text extends Sprite {
    destroy() {
      order.push('text');
      super.destroy();
    }
  }
  installLaya342WebGPUFix(nativeWith({ Sprite }));
  const label = new Text();
  label.destroy();
  label.destroy();
  assert.deepEqual(order, ['text', 'sprite', 'data', 'text', 'sprite']);
  assert.equal(label._shaderData, null);
  const plain = new Sprite();
  plain._shaderData = null; // never drawn: nothing to destroy
  plain.destroy();
});

test('bind groups that stopped being valid leave the cache; valid ones stay', async () => {
  const { installLaya342WebGPUFix } = await webgpu();
  class WebGPUBindGroupCache {
    constructor() {
      this.bindGroupCache = new Map();
    }
    getBindGroup(key, valid) {
      const group = { valid, isValid: () => group.valid };
      this.bindGroupCache.set(key, group);
      return group;
    }
  }
  installLaya342WebGPUFix(nativeWith({ WebGPUBindGroupCache }));
  const cache = new WebGPUBindGroupCache();
  for (let i = 0; i < 255; i++) cache.getBindGroup('k' + i, i % 3 === 0);
  assert.equal(cache.bindGroupCache.size, 255, 'nothing is swept below 256');
  const returned = cache.getBindGroup('fresh', false);
  // 256 reached: the 170 invalid ones go, the 85 valid ones and the one just returned stay.
  assert.equal(cache.bindGroupCache.size, 86);
  assert.equal(cache.bindGroupCache.get('fresh'), returned);
  for (const [key, group] of cache.bindGroupCache) assert.ok(key === 'fresh' || group.isValid());
  // The next sweep waits for twice the size left.
  for (let i = 0; i < 80; i++) cache.getBindGroup('more' + i, false);
  assert.equal(cache.bindGroupCache.size, 166);
});

test('a destroyed material forgets its change flags; others keep theirs', async () => {
  const { installLaya342WebGPUFix } = await webgpu();
  class WebGPUShaderData {
    constructor(id) {
      this._id = id;
    }
    destroy() {}
  }
  const WebGPURenderElement3D = {
    _matChangeFlagMap: new Map([
      [
        'PBR',
        new Map([
          [1, ['f']],
          [2, ['f']],
        ]),
      ],
      [
        'Unlit',
        new Map([
          [1, ['f']],
          [3, ['f']],
        ]),
      ],
    ]),
  };
  installLaya342WebGPUFix(nativeWith({ WebGPUShaderData, WebGPURenderElement3D }));
  new WebGPUShaderData(1).destroy();
  assert.deepEqual([...WebGPURenderElement3D._matChangeFlagMap.get('PBR').keys()], [2]);
  assert.deepEqual([...WebGPURenderElement3D._matChangeFlagMap.get('Unlit').keys()], [3]);
});

test('pass keys unused for 600 frames leave the context and the elements', async () => {
  const { installLaya342PassCacheBounds } = await laya();
  const Stat = { loopCount: 0 };
  class WebGLRenderContext3D {
    constructor() {
      this._globalRendercacheInfoMap = new Map();
      this._globalComkeyNameMap = {};
      this._next = 0;
    }
    _getSceneCameraCacheKey(scene, camera) {
      const name = scene + '+' + camera;
      if (this._globalComkeyNameMap[name] === undefined)
        this._globalComkeyNameMap[name] = this._next++;
      this._curRenderGlobalKey = this._globalComkeyNameMap[name];
      if (!this._globalRendercacheInfoMap.has(this._curRenderGlobalKey))
        this._globalRendercacheInfoMap.set(this._curRenderGlobalKey, { made: Stat.loopCount });
    }
  }
  class WebGLRenderElement3D {
    constructor() {
      this._passRenderInfo = new Map();
    }
    _preUpdatePre(context) {
      if (!this._passRenderInfo.has(context._curRenderGlobalKey))
        this._passRenderInfo.set(context._curRenderGlobalKey, {});
    }
  }
  installLaya342PassCacheBounds({ Stat, WebGLRenderContext3D, WebGLRenderElement3D });
  installLaya342PassCacheBounds({ Stat, WebGLRenderContext3D, WebGLRenderElement3D });
  const context = new WebGLRenderContext3D();
  const pooled = new WebGLRenderElement3D(); // drawn by every scene, never destroyed
  // A scene that stays, and one new scene every two frames that is drawn once.
  for (let frame = 0; frame < 3000; frame++) {
    Stat.loopCount = frame;
    context._getSceneCameraCacheKey('kept', 'camera');
    pooled._preUpdatePre(context);
    if (frame % 2 === 0) {
      context._getSceneCameraCacheKey('scene' + frame, 'camera' + frame);
      pooled._preUpdatePre(context);
    }
  }
  // Without the bound: 1501 keys in each. With it: at most the last 600..900 frames' scenes.
  const kept = context._globalComkeyNameMap['kept+camera'];
  assert.ok(context._globalRendercacheInfoMap.has(kept), 'a pass in use is never dropped');
  assert.ok(
    context._globalRendercacheInfoMap.size <= 452,
    `${context._globalRendercacheInfoMap.size}`,
  );
  assert.ok(Object.keys(context._globalComkeyNameMap).length <= 452);
  assert.ok(pooled._passRenderInfo.size <= context._globalRendercacheInfoMap.size + 17);
  // A dropped pass drawn again is made again, as LayaAir would.
  Stat.loopCount = 3000;
  context._getSceneCameraCacheKey('scene0', 'camera0');
  assert.equal(context._globalRendercacheInfoMap.get(context._curRenderGlobalKey).made, 3000);
});

test('a batch mark that holds nothing is freed at the next sweep; one in use stays', async () => {
  const { installLaya342WebGPUFix } = await webgpu();
  const destroyed = [];
  const piece = (name) => ({ destroy: () => destroyed.push(name) });
  const mark = (elements, name) => ({
    batchRenderList: { length: elements },
    canBatch: elements > 1,
    renderElement: piece(name + ':element'),
    renderGeometry: piece(name + ':geometry'),
    renderNode: piece(name + ':node'),
  });
  const native = nativeWith({});
  installLaya342WebGPUFix(native);
  const agent = new native.WebGPUMeshRenderBatchAgent();
  const empty = mark(0, 'empty'),
    used = mark(2, 'used'),
    single = mark(1, 'single');
  agent._batchOpaqueMarks = new Map([
    [1, { 0: empty, 1024: used }],
    [2, { 0: single }],
  ]);
  native.Stat.loopCount = 10;
  agent.appendRenderElement(); // the first call starts the clock
  native.Stat.loopCount = 40;
  agent.appendRenderElement();
  assert.equal(destroyed.length, 0, 'not before a sweep is due');
  native.Stat.loopCount = 70;
  agent.appendRenderElement();
  assert.deepEqual(destroyed, ['empty:element', 'empty:geometry', 'empty:node']);
  assert.deepEqual(Object.keys(agent._batchOpaqueMarks.get(1)), ['1024']);
  assert.equal(agent._batchOpaqueMarks.get(2).single ?? agent._batchOpaqueMarks.get(2)[0], single);
  assert.equal(empty.batchRenderList.length, 0, 'its list stays for an old record');
  // Emptied later, it goes at the following sweep, and an emptied key with it.
  single.batchRenderList.length = 0;
  single.canBatch = false;
  native.Stat.loopCount = 140;
  agent.appendRenderElement();
  assert.equal(agent._batchOpaqueMarks.has(2), false);
  assert.equal(agent._batchOpaqueMarks.has(1), true);
});

test("WebGL batch marks of destroyed renders and their geometry's instance buffers are let go", async () => {
  const { installLaya342WebGLBatchMarkSweep } = await laya();
  const destroyed = [];
  const destroyable = (name) => ({ destroy: () => destroyed.push(name) });
  class Agent {
    constructor() {
      this._batchOpaqueMarks = [];
      this._updateCountMark = 0;
    }
    _opaqueInstanceBatch() {
      this._updateCountMark++;
    }
  }
  class InstanceElement {
    static getInstanceBufferState(geometry) {
      let state = InstanceElement._instanceBufferStateMap.get(geometry._id);
      if (!state)
        InstanceElement._instanceBufferStateMap.set(
          geometry._id,
          (state = {
            state: destroyable(`state ${geometry._id}`),
            worldInstanceVB: destroyable(`vb ${geometry._id}`),
          }),
        );
      return state;
    }
  }
  InstanceElement._instanceBufferStateMap = new Map();
  // LayaAir's timer: what is asked for the next frame runs when the frame starts.
  const nextFrame = [];
  const runtime = {
    WebGLMeshRenderBatchAgent: Agent,
    WebGLInstanceRenderElement3D: InstanceElement,
    timer: { frameOnce: (delay, caller, method) => nextFrame.push([delay, method]) },
  };
  assert.equal(installLaya342WebGLBatchMarkSweep({}), false, 'nothing to patch');
  assert.equal(installLaya342WebGLBatchMarkSweep(runtime), true);
  assert.equal(installLaya342WebGLBatchMarkSweep(runtime), false, 'once');

  const goneGeometry = { _id: 1, drawParams: [] };
  const liveGeometry = { _id: 2, drawParams: [] };
  InstanceElement.getInstanceBufferState(goneGeometry);
  InstanceElement.getInstanceBufferState(liveGeometry);
  const element = (name, owner, geometry) => ({
    owner,
    geometry,
    destroy: () => destroyed.push(name),
  });
  const goneOwner = { renderelements: null };
  const liveOwner = { renderelements: [] };
  const agent = new Agent();
  const mark = (updateMark, elements) => ({
    updateMark,
    batched: true,
    _curBindElementIndex: 1,
    _cacheRenderElement: elements,
  });
  agent._batchOpaqueMarks[10] = { 0: mark(5, [element('gone', goneOwner, goneGeometry)]) };
  agent._batchOpaqueMarks[11] = { 0: mark(5, [element('live', liveOwner, liveGeometry)]) };
  agent._batchOpaqueMarks[12] = { 0: mark(-1, []) };
  agent._batchOpaqueMarks[13] = { 0: mark(29, [element('recent', goneOwner, goneGeometry)]) };
  const kept13 = agent._batchOpaqueMarks[13][0];
  agent._updateCountMark = 30; // the sweep runs before the pass that would be the 31st
  delete goneGeometry.drawParams; // LayaAir's destroy
  agent._opaqueInstanceBatch([]);
  assert.equal(agent._batchOpaqueMarks[10], undefined, 'drew only destroyed renders: let go');
  assert.ok(destroyed.includes('gone'));
  assert.ok(agent._batchOpaqueMarks[11], 'a live render keeps its mark');
  assert.equal(
    agent._batchOpaqueMarks[12][0].updateMark,
    30,
    'a mark never drawn starts its count',
  );
  assert.equal(agent._batchOpaqueMarks[13][0], kept13, 'drawn in the last passes: kept');
  assert.deepEqual(kept13._cacheRenderElement.length, 1);
  assert.deepEqual(
    [...InstanceElement._instanceBufferStateMap.keys()],
    [2],
    "the destroyed geometry's instance buffers are gone",
  );
  // Out of the table at once; destroyed when the next frame starts, not in the middle of this one.
  assert.ok(!destroyed.includes('state 1') && !destroyed.includes('vb 1'));
  assert.equal(nextFrame.length, 1);
  assert.equal(nextFrame[0][0], 1);
  nextFrame.shift()[1]();
  assert.ok(destroyed.includes('state 1') && destroyed.includes('vb 1'));
  assert.ok(!destroyed.includes('state 2'));

  // Not drawn for 600 passes: let go even with its render alive.
  agent._updateCountMark = 630;
  agent._opaqueInstanceBatch([]);
  assert.equal(agent._batchOpaqueMarks[11], undefined, 'stale: let go');
  assert.ok(destroyed.includes('live'));
  assert.equal(agent._batchOpaqueMarks[13], undefined, 'idle past the recent passes: let go');
});
