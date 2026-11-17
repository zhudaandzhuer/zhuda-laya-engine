// Issue #8 (docs/plans/records/webgpu-node-bindings): a render drawn without
// a block its shader variant needs. LayaAir-like stand-ins: what the adapters
// read and call, nothing more.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  installLaya342ReflectionProbeFill,
  zhudaReflectionProbeFills,
} from '../packages/core/runtime3d/Laya342Adapters.ts';

/** LayaAir 3.4.2's render-level data as far as these adapters go. */
class Owner {
  constructor(common, added = {}) {
    this._commonUniformMap = common;
    this._additionShaderData = new Map(Object.entries(added));
    this._additionShaderDataKeys = [...this._additionShaderData.keys()];
    this.probeReflection = null;
    this.setterCalls = 0;
    this.applied = 0;
  }
  get additionShaderData() {
    return this._additionShaderData;
  }
  set additionShaderData(value) {
    this.setterCalls++;
    this._additionShaderData = value;
    this._additionShaderDataKeys = [...value.keys()];
  }
  _applyReflection() {
    this.applied++;
  }
}

function probeRuntime() {
  const prepared = [];
  class Element {
    constructor(owner, supportsProbe) {
      this.owner = owner;
      this._subShader = { _owner: { name: 'glTFPBR', _supportReflectionProbe: supportsProbe } };
    }
    _preUpdatePre(context) {
      prepared.push([context, [...this.owner.additionShaderData.keys()]]);
      return 'prepared';
    }
  }
  const sceneProbe = { shaderData: { id: 'scene-probe-data' }, _dataModule: { id: 'scene-probe' } };
  const runtime = {
    ReflectionProbe: { BlockName: 'ReflectionProbe' },
    WebGPURenderElement3D: class extends Element {},
    WebGLRenderElement3D: class extends Element {},
    RenderContext3D: { _instance: { scene: { sceneReflectionProb: sceneProbe } } },
  };
  return { runtime, prepared, sceneProbe };
}

test("a probe-reading render without a probe is given the scene's before it is prepared", () => {
  const { runtime, prepared, sceneProbe } = probeRuntime();
  assert.equal(installLaya342ReflectionProbeFill(runtime), true);
  assert.equal(installLaya342ReflectionProbeFill(runtime), false, 'once');
  for (const Element of [runtime.WebGPURenderElement3D, runtime.WebGLRenderElement3D]) {
    const owner = new Owner(['Sprite3D']);
    const element = new Element(owner, true);
    assert.equal(element._preUpdatePre('ctx'), 'prepared');
    assert.deepEqual(prepared.at(-1), ['ctx', ['ReflectionProbe']], 'filled before LayaAir runs');
    assert.equal(owner.additionShaderData.get('ReflectionProbe'), sceneProbe.shaderData);
    assert.equal(owner.probeReflection, sceneProbe._dataModule);
    assert.deepEqual(
      owner._additionShaderDataKeys,
      ['ReflectionProbe'],
      "through LayaAir's setter",
    );
    assert.equal(owner.applied, 1);
    element._preUpdatePre('ctx');
    assert.equal(owner.setterCalls, 1, 'not again once it has one');
  }
  assert.equal(zhudaReflectionProbeFills(runtime), 2);
});

test('a render with its own probe, or a shader that reads none, is left alone', () => {
  const { runtime } = probeRuntime();
  installLaya342ReflectionProbeFill(runtime);
  const own = { id: 'own-probe' };
  const withProbe = new Owner(['Sprite3D'], { ReflectionProbe: own });
  new runtime.WebGPURenderElement3D(withProbe, true)._preUpdatePre('ctx');
  assert.equal(withProbe.additionShaderData.get('ReflectionProbe'), own);
  const unlit = new Owner(['Sprite3D']);
  new runtime.WebGPURenderElement3D(unlit, false)._preUpdatePre('ctx');
  assert.equal(unlit.additionShaderData.size, 0);
  assert.equal(zhudaReflectionProbeFills(runtime), 0);
  // No scene being drawn (no probe to give): nothing changes, nothing throws.
  runtime.RenderContext3D._instance.scene = null;
  const lone = new Owner(['Sprite3D']);
  new runtime.WebGPURenderElement3D(lone, true)._preUpdatePre('ctx');
  assert.equal(lone.additionShaderData.size, 0);
});
