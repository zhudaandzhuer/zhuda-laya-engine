// GFX-03 (docs/plans/records/windows-acceptance/plan.md): a point-filtered
// WebGL texture must not carry anisotropic filtering, which Direct3D 11
// applies over the point setting.
import test from 'node:test';
import assert from 'node:assert/strict';
import { installLaya342PointFilterFix } from '../packages/core/runtime3d/Laya342Adapters.ts';

const FilterMode = { Point: 0, Bilinear: 1, Trilinear: 2 };

/** LayaAir 3.4.2's WebGL texture as far as filtering goes: what it sends is kept in `sent`. */
function runtime() {
  class Base {}
  class WebGLInternalTex extends Base {
    constructor() {
      super();
      this.sent = [];
      this.resource = {};
      this.filterMode = FilterMode.Bilinear;
      this.anisoLevel = 4;
    }
    get filterMode() {
      return this._filterMode;
    }
    set filterMode(value) {
      if (this._filterMode !== value && this.resource) {
        this.sent.push(['filter', value]);
        this._filterMode = value;
      }
    }
    get anisoLevel() {
      return this._anisoLevel;
    }
    set anisoLevel(value) {
      this.sent.push(['aniso', value]);
      this._anisoLevel = value;
    }
  }
  return { FilterMode, WebGLInternalTex };
}

test('a point-filtered texture is sent anisotropy 1, others what was asked', () => {
  const laya = runtime();
  assert.equal(installLaya342PointFilterFix(laya), true);
  assert.equal(installLaya342PointFilterFix(laya), false, 'once');
  const texture = new laya.WebGLInternalTex();
  assert.deepEqual(texture.sent.at(-1), ['aniso', 4], 'LayaAir’s default stands for bilinear');
  texture.filterMode = FilterMode.Point;
  assert.deepEqual(texture.sent.slice(-2), [
    ['filter', FilterMode.Point],
    ['aniso', 1],
  ]);
  assert.equal(texture.anisoLevel, 4, 'what was asked is reported');
  texture.anisoLevel = 8;
  assert.deepEqual(texture.sent.at(-1), ['aniso', 1], 'asked while point: still 1');
  texture.filterMode = FilterMode.Trilinear;
  assert.deepEqual(texture.sent.at(-1), ['aniso', 8], 'back to what was asked');
  assert.equal(texture.anisoLevel, 8);
});

test('a texture made before the fix keeps its level when it leaves point', () => {
  const laya = runtime();
  const early = new laya.WebGLInternalTex();
  early.anisoLevel = 2;
  installLaya342PointFilterFix(laya);
  early.filterMode = FilterMode.Point;
  assert.deepEqual(early.sent.at(-1), ['aniso', 1]);
  early.filterMode = FilterMode.Bilinear;
  assert.deepEqual(early.sent.at(-1), ['aniso', 2]);
});

test('WebGPU (no WebGL texture class) is left alone', () => {
  assert.equal(installLaya342PointFilterFix({ FilterMode }), false);
});
