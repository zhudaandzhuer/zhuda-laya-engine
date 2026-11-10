import test from 'node:test';
import assert from 'node:assert/strict';
import {
  physicalCameraMetrics,
  ZhudaPhysicalCameraRig,
} from '../packages/core/runtime3d/PhysicalCamera.ts';
import { ZhudaCinematicCapture } from '../packages/core/runtime3d/CinematicCapture.ts';
const tick = () => new Promise((r) => setImmediate(r));
class Vector {
  constructor(x = 0, y = 0, z = 0) {
    Object.assign(this, { x, y, z });
  }
  clone() {
    return new Vector(this.x, this.y, this.z);
  }
}
class Matrix {
  constructor(elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) {
    this.elements = [...elements];
  }
  clone() {
    return new Matrix(this.elements);
  }
}
function fixture() {
  const world = new Matrix(),
    projection = new Matrix([2, 0, 0, 0, 0, 3, 0, 0, 0, 0, -1, -1, 0, 0, -0.2, 0]);
  const scene = {
    parent: {},
    destroyed: false,
    _renderByEditor: false,
    _time: 10,
    _update() {
      throw Error('Simulation must not tick');
    },
    _shaderValues: { setNumber() {} },
    recaculateCullCamera() {},
  };
  const camera = {
    scene,
    fieldOfView: 60,
    _aspectRatio: 0,
    aspectRatio: 2,
    projectionMatrix: projection,
    transform: { position: new Vector(), worldMatrix: world },
    resetProjectionMatrix() {
      this.projectionMatrix = projection.clone();
    },
  };
  let reads = 0,
    draws = 0,
    releases = 0,
    finish;
  const Laya = {
    Vector3: Vector,
    Shader3D: { propertyNameToID: () => 1 },
    Stat: { loopCount: 1 },
    RenderTargetFormat: {},
    RenderTexture: class {
      getDataAsync(x, y, w, h, bytes) {
        reads++;
        return new Promise((r) => {
          finish = () => {
            bytes.fill(255);
            r(bytes);
          };
        });
      }
      destroy() {
        releases++;
      }
    },
    LayaGL: { renderEngine: { startFrame() {}, endFrame() {} } },
    Camera: {
      drawRenderTextureByScene() {
        draws++;
      },
    },
  };
  globalThis.Laya = Laya;
  const runtime = { paused: true },
    lens = new ZhudaPhysicalCameraRig(camera, {
      focalLengthMm: 50,
      focusDistanceM: 5,
    });
  return {
    scene,
    camera,
    runtime,
    lens,
    Laya,
    stats: () => ({ reads, draws, releases }),
    finish: () => finish(),
  };
}
test('physical lens math, exact focus-plane projection and restoration', () => {
  const metrics = physicalCameraMetrics(
    {
      focalLengthMm: 50,
      sensorHeightMm: 24,
      fStop: 2,
      shutterAngle: 180,
      iso: 100,
    },
    24,
  );
  assert.ok(Math.abs(metrics.verticalFovDegrees - 26.99146656) < 1e-7);
  assert.equal(metrics.apertureRadiusM, 0.0125);
  assert.equal(metrics.exposureSeconds, 1 / 48);
  assert.ok(Math.abs(metrics.ev100 - Math.log2(192)) < 1e-10);
  for (const value of [
    { focalLengthMm: 0 },
    { focalLengthMm: 50, focusDistanceM: 0.01 },
    { focalLengthMm: 50, shutterAngle: NaN },
  ])
    assert.throws(() => physicalCameraMetrics(value, 24));
  const f = fixture(),
    project = (depth) => {
      const m = f.camera.projectionMatrix.elements,
        p = f.camera.transform.position;
      return [(-p.x * m[0] - depth * m[8]) / depth, (-p.y * m[5] - depth * m[9]) / depth];
    };
  const baseline = project(5),
    restore = f.lens.sample(0.6, 0.8, 0, 0, 640, 360);
  for (const [i, v] of project(5).entries()) assert.ok(Math.abs(v - baseline[i]) < 1e-12);
  assert.notDeepEqual(project(2), baseline);
  assert.throws(() => f.lens.sample(0, 0, 0, 0, 640, 360), /Restore/);
  assert.throws(() => new ZhudaPhysicalCameraRig(f.camera, { focalLengthMm: 50 }), /unowned/);
  restore();
  assert.deepEqual(f.camera.transform.position, new Vector());
  f.lens.sample(1, 0, 0, 0, 640, 360);
  f.lens.dispose();
  assert.deepEqual(f.camera.transform.position, new Vector());
  assert.equal(f.camera.fieldOfView, 60);
  assert.equal(f.camera.aspectRatio, 0, 'Restore native automatic aspect mode');
  restore();
});
test('capture cancellation rejects promptly but quarantines native readback and target until drained', async () => {
  const f = fixture(),
    original = f.scene._update,
    capture = new ZhudaCinematicCapture(f.scene, f.lens, f.runtime, {
      width: 4,
      height: 4,
      timeoutMs: 10,
    });
  const work = capture.renderFrame({ index: 0, fps: 24, sample() {} });
  await assert.rejects(work, (e) => e.name === 'TimeoutError');
  await assert.rejects(capture.renderFrame({ index: 0, fps: 24, sample() {} }), /draining/);
  assert.equal(f.stats().releases, 0);
  capture.dispose();
  capture.dispose();
  assert.equal(f.scene._update, original);
  assert.throws(
    () =>
      new ZhudaCinematicCapture(f.scene, f.lens, f.runtime, {
        width: 4,
        height: 4,
      }),
    /unowned/,
  );
  assert.equal(f.stats().releases, 0);
  f.finish();
  await tick();
  assert.equal(f.stats().releases, 1);
  const next = new ZhudaCinematicCapture(f.scene, f.lens, f.runtime, {
    width: 4,
    height: 4,
  });
  next.dispose();
  assert.equal(f.stats().releases, 2);
  f.lens.dispose();
});
test('capture uses exact shutter times, releases draw state on failure, and rejects live/TAA capture', async () => {
  const f = fixture();
  f.runtime.paused = false;
  assert.throws(
    () =>
      new ZhudaCinematicCapture(f.scene, f.lens, f.runtime, {
        width: 2,
        height: 2,
      }),
    /paused/,
  );
  f.runtime.paused = true;
  const capture = new ZhudaCinematicCapture(f.scene, f.lens, f.runtime, {
    width: 2,
    height: 2,
  });
  f.camera.taa = true;
  await assert.rejects(capture.renderFrame({ index: 0, fps: 24, sample() {} }), /temporal/);
  f.camera.taa = false;
  const times = [];
  f.Laya.RenderTexture.prototype.getDataAsync = async (x, y, w, h, bytes) => {
    bytes.fill(128);
    return bytes;
  };
  const frame = await capture.renderFrame({
    index: 12,
    fps: 24,
    samples: 2,
    sample: (t) => times.push(t),
  });
  assert.deepEqual(times, [0.5 + 0.25 / 48, 0.5 + 0.75 / 48]);
  assert.equal(frame.time, 0.5);
  assert.equal(frame.rgba[0], 128);
  assert.equal(frame.rgba[3], 255);
  f.camera.renderTarget = { original: true };
  f.Laya.Camera.drawRenderTextureByScene = (camera) => {
    camera.renderTarget = { wrong: true };
    throw Error('shader failed');
  };
  await assert.rejects(capture.renderFrame({ index: 0, fps: 24, sample() {} }), /shader failed/);
  assert.deepEqual(f.camera.renderTarget, { original: true });
  assert.deepEqual(f.camera.transform.position, new Vector());
  capture.dispose();
  f.lens.dispose();
});
