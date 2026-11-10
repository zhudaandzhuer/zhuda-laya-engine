import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { TopologyResolver } from '../packages/core/TopologyGraph.ts';
import { prepareRenderer } from '../packages/core/runtime3d/Renderer.ts';

function fixture() {
  let finish;
  const device = new EventTarget();
  device.features = new Set(['depth-clip-control']);
  device.lost = new Promise((r) => (finish = r));
  device.destroyed = 0;
  device.destroy = () => {
    device.destroyed++;
    finish({ reason: 'destroyed', message: 'test' });
  };
  class Engine {
    async _getAdapter() {
      return { info: { vendor: 'fixture' }, features: new Set() };
    }
    async _getGPUdevice() {
      return device;
    }
    getDevice() {
      return device;
    }
  }
  class Compiler {
    async init() {
      this.glslang = {};
      this.naga = {};
    }
  }
  const engine = new Engine();
  engine.objectName = 'WebGPURenderEngine';
  engine._context = { unconfigure() {} };
  const native = {
    WebGPURenderDeviceFactory: class {},
    WebGPURenderEngine: Engine,
    WebGPUShaderCompiler: Compiler,
    LayaGL: { renderEngine: engine },
    Render: { paused: false },
    stage: { renderingEnabled: true },
  };
  return { device, engine, native, Compiler, lose: finish };
}
const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
test.after(() => Object.defineProperty(globalThis, 'navigator', navigatorDescriptor));

test('renderer axis preserves WebGL and produces an exclusive ordered WebGPU dependency graph', () => {
  const gl = TopologyResolver.resolveByFeatures('all');
  assert.equal(gl.orderedFiles.length, 29);
  assert.deepEqual(gl.supportFiles, []);
  for (const features of [['2d', 'ui'], ['3d', 'gltf'], 'all']) {
    const gpu = TopologyResolver.resolveByFeatures(features, 'webgpu');
    assert.ok(gpu.orderedFiles.includes('laya.webgpu_2D.js'));
    assert.ok(!gpu.orderedFiles.some((f) => f.includes('webgl')));
    assert.equal(gpu.supportFiles.length, 2);
    assert.deepEqual(TopologyResolver.auditFileSequence(gpu.orderedFiles), []);
    assert.ok(
      TopologyResolver.auditFileSequence([...gpu.orderedFiles, 'laya.webgl_2D.js']).some(
        (i) => i.type === 'CONFLICTING_MODULE',
      ),
    );
    assert.ok(
      TopologyResolver.auditFileSequence(gpu.orderedFiles.filter((f) => f !== 'nagabind.js')).some(
        (i) => i.requiredFile === 'nagabind.js',
      ),
    );
  }
  assert.throws(() => TopologyResolver.resolveByFeatures(['2d'], 'metal'), /renderer must/);
});
test('pinned upstream WebGPU artifacts retain their documented identity', () => {
  const base = new URL('../vendor/laya-3.4.2/', import.meta.url),
    manifest = JSON.parse(fs.readFileSync(new URL('webgpu-provenance.json', base)));
  for (const file of manifest.files) {
    const bytes = fs.readFileSync(new URL('libs/' + file.file, base));
    assert.equal(bytes.length, file.bytes);
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
});
test('renderer rejects wrong/mixed backends and unavailable WebGPU without pretending fallback passed', () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  assert.throws(
    () => prepareRenderer('webgpu', { WebGPURenderDeviceFactory: class {} }),
    /WEBGPU_UNAVAILABLE/,
  );
  assert.throws(
    () => prepareRenderer('webgpu', { WebGLRenderDeviceFactory: class {} }),
    /RENDERER_MISMATCH/,
  );
  assert.throws(
    () =>
      prepareRenderer(undefined, {
        WebGLRenderDeviceFactory: class {},
        WebGPURenderDeviceFactory: class {},
      }),
    /RENDERER_CONFLICT/,
  );
});
test('WebGPU loss pauses the existing runtime once; disposal removes listeners and releases the device', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: {} } });
  const f = fixture(),
    handle = prepareRenderer('webgpu', f.native);
  let losses = 0;
  handle.attach({
    notifyContextLost() {
      losses++;
    },
  });
  await f.engine._getAdapter();
  await f.engine._getGPUdevice();
  handle.ready();
  assert.equal(handle.diagnostics.status, 'ready');
  assert.equal(handle.diagnostics.adapter.vendor, 'fixture');
  const error = new Event('uncapturederror');
  error.error = { message: 'validation failure' };
  f.device.dispatchEvent(error);
  assert.deepEqual(handle.diagnostics.errors, ['validation failure']);
  f.lose({ reason: 'unknown', message: 'device removed' });
  await Promise.resolve();
  assert.equal(handle.diagnostics.status, 'lost');
  assert.equal(losses, 1);
  assert.equal(f.native.Render.paused, true);
  handle.release('disposed');
  handle.release('disposed');
  assert.equal(f.device.destroyed, 1);
  f.device.dispatchEvent(error);
  assert.equal(handle.diagnostics.errors.length, 1);
});
test('noncooperative late device is destroyed and cannot resume retired initialization', async () => {
  const f = fixture();
  let resolve;
  f.native.WebGPURenderEngine.prototype._getGPUdevice = () => new Promise((r) => (resolve = r));
  const handle = prepareRenderer('webgpu', f.native),
    pending = f.engine._getGPUdevice();
  handle.release('failed');
  resolve(f.device);
  await assert.rejects(pending, /RENDERER_CANCELLED/);
  assert.equal(f.device.destroyed, 1);
});
test('a swallowed upstream shader compiler failure becomes a failed boot', async () => {
  const f = fixture();
  f.Compiler.prototype.init = async function () {
    this.naga = {};
  };
  const handle = prepareRenderer('webgpu', f.native);
  await assert.rejects(new f.Compiler().init(), /WEBGPU_SHADER_COMPILER/);
  handle.release('failed');
});

test('WebGPU consumes between-frame removals before reusing culled render elements', async () => {
  const { installLaya342WebGPUFix } = await import(
    '../packages/core/runtime3d/WebGPU342Adapters.ts'
  );
  class Agent {
    appendRenderElement() {
      return this._canKipCull === native.Stat.loopCount ? 'rebuild' : 'reuse';
    }
  }
  const native = { WebGPUMeshRenderBatchAgent: Agent, Stat: { loopCount: 7 } };
  installLaya342WebGPUFix(native);
  installLaya342WebGPUFix(native);
  const agent = new Agent();
  agent._canKipCull = 6;
  agent._checkCPUCullList = { length: 1 };
  assert.equal(agent.appendRenderElement(), 'rebuild');
  assert.equal(agent._cameraChangeMask, 7);
  assert.equal(agent._dirCullChangeMask, 7);
  assert.equal(agent._spotCullChangeMask, 7);
  agent._checkCPUCullList.length = 0;
  native.Stat.loopCount = 8;
  assert.equal(agent.appendRenderElement(), 'reuse');
});
