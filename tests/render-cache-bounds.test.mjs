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
