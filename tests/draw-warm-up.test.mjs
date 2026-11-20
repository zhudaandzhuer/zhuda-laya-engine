// The warm-up that draws a scene before it is shown (record draw-warm-up). The real draws are checked by
// verify:shader-warm-up (mode draw: the first frame after it compiles nothing); these are the rules, on a
// LayaAir stand-in.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_WARM_UP_DIRECTIONS,
  ZHUDA_WARM_UP_VIEW_LIMIT,
  zhudaWarmUpByDrawing,
  zhudaWarmUpViews,
} from '../packages/core/runtime3d/DrawWarmUp.ts';

class Vector3 {
  constructor(x = 0, y = 0, z = 0) {
    Object.assign(this, { x, y, z });
  }
  clone() {
    return new Vector3(this.x, this.y, this.z);
  }
}
class Quaternion {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    Object.assign(this, { x, y, z, w });
  }
  clone() {
    return new Quaternion(this.x, this.y, this.z, this.w);
  }
}
/** A camera that remembers where it was when each frame was drawn. */
function stand() {
  const camera = {
    fieldOfView: 60,
    transform: {
      _position: new Vector3(1, 2, 3),
      _rotation: new Quaternion(0.1, 0.2, 0.3, 0.9),
      get position() {
        return this._position;
      },
      set position(value) {
        this._position = value.clone();
      },
      get rotation() {
        return this._rotation;
      },
      set rotation(value) {
        this._rotation = value.clone();
      },
      lookAt(target) {
        this.target = { x: target.x, y: target.y, z: target.z };
        this._rotation = new Quaternion(9, 9, 9, 9);
      },
    },
  };
  const drawn = [];
  let clock = 0;
  const options = {
    camera,
    draw: () => {
      clock += 4;
      drawn.push({
        at: { ...camera.transform.position },
        target: camera.transform.target,
        fov: camera.fieldOfView,
      });
    },
    wait: async () => {
      drawn.push('wait');
    },
    now: () => clock,
  };
  return { camera, drawn, options, runtime: { Vector3 } };
}

test('views are each eye in turn, every way round and down from it, with targets along those ways', () => {
  const views = zhudaWarmUpViews([
    [0, 2, 0],
    [5, 2, 10],
  ]);
  assert.equal(views.length, 2 * ZHUDA_WARM_UP_DIRECTIONS.length);
  assert.deepEqual(
    views.map((view) => view.index),
    views.map((_, i) => i),
  );
  assert.deepEqual(views[0].eye, [0, 2, 0]);
  assert.deepEqual(views[5].eye, [5, 2, 10]);
  // the first way is ahead (+z), a little down; the last of an eye is steeply down
  assert.ok(
    views[0].target[2] > 9 && views[0].target[1] < 2 && Math.abs(views[0].target[0]) < 1e-9,
  );
  assert.ok(views[1].target[0] > 9, 'the second way is turned to +x');
  assert.ok(views[4].target[1] < -7, 'and one looks down');
});

test('it draws every view with the camera there and wide, and puts the camera back as it was', async () => {
  const { camera, drawn, options, runtime } = stand();
  const seen = [];
  const report = await zhudaWarmUpByDrawing(
    {
      ...options,
      eyes: [
        [0, 2, 0],
        [0, 2, 50],
      ],
      budgetMs: 1000,
      beforeView: (view) => seen.push([view.index, camera.transform.position.z]),
    },
    runtime,
  );
  const frames = drawn.filter((item) => item !== 'wait');
  assert.equal(report.views, 10);
  assert.equal(frames.length, 10);
  assert.ok(
    frames.every((frame) => frame.fov === 90),
    'with a wide field of view',
  );
  assert.deepEqual(frames[0].at, { x: 0, y: 2, z: 0 });
  assert.deepEqual(frames[9].at, { x: 0, y: 2, z: 50 });
  assert.deepEqual(
    seen.slice(0, 2),
    [
      [0, 0],
      [1, 0],
    ],
    'the game is asked before each view, with the camera already there',
  );
  assert.deepEqual(camera.transform.position, new Vector3(1, 2, 3));
  assert.deepEqual(camera.transform.rotation, new Quaternion(0.1, 0.2, 0.3, 0.9));
  assert.equal(camera.fieldOfView, 60);
  assert.equal(report.ms, 40);
  assert.equal(report.longestMs, 4);
  assert.equal(report.slowest.index, 0);
});

test('it lets frames through between slices of its budget, a view at least a slice', async () => {
  const { drawn, options, runtime } = stand();
  const progress = [];
  const report = await zhudaWarmUpByDrawing(
    {
      ...options,
      eyes: [[0, 2, 0]],
      budgetMs: 8,
      onProgress: (done, total) => progress.push([done, total]),
    },
    runtime,
  );
  // each view takes 4 ms: two to a slice of 8
  assert.deepEqual(drawn.map((item) => (item === 'wait' ? 'w' : 'v')).join(''), 'vvwvvwv');
  assert.equal(report.slices, 3);
  assert.deepEqual(progress, [
    [2, 5],
    [4, 5],
    [5, 5],
  ]);
});

test('cancelled, it stops between views and still puts the camera back', async () => {
  const { camera, options, runtime } = stand();
  const controller = new AbortController();
  const failed = await zhudaWarmUpByDrawing(
    {
      ...options,
      eyes: [[0, 2, 0]],
      budgetMs: 4,
      signal: controller.signal,
      wait: async () => controller.abort(new Error('left')),
    },
    runtime,
  ).then(
    () => 'resolved',
    (error) => error.message,
  );
  assert.equal(failed, 'left');
  assert.deepEqual(camera.transform.position, new Vector3(1, 2, 3));
  assert.equal(camera.fieldOfView, 60);
});

test('a draw that throws puts the camera back too', async () => {
  const { camera, options, runtime } = stand();
  await assert.rejects(
    zhudaWarmUpByDrawing(
      {
        ...options,
        eyes: [[0, 2, 0]],
        draw: () => {
          throw new Error('lost context');
        },
      },
      runtime,
    ),
    /lost context/,
  );
  assert.deepEqual(camera.transform.position, new Vector3(1, 2, 3));
  assert.equal(camera.fieldOfView, 60);
});

test('it refuses what it cannot draw from', async () => {
  const { options, runtime } = stand();
  const bad = (over) => zhudaWarmUpByDrawing({ ...options, eyes: [[0, 2, 0]], ...over }, runtime);
  await assert.rejects(bad({ eyes: [] }), /eyes/);
  await assert.rejects(bad({ eyes: [[0, Number.NaN, 0]] }), /eyes/);
  await assert.rejects(bad({ directions: [{ yaw: 0, pitch: 2 }] }), /pitch/);
  await assert.rejects(bad({ fieldOfView: 180 }), /fieldOfView/);
  await assert.rejects(bad({ budgetMs: 0 }), /budgetMs/);
  await assert.rejects(bad({ camera: {} }), /Camera/);
  await assert.rejects(zhudaWarmUpByDrawing({ ...options, eyes: [[0, 2, 0]] }, {}), /not loaded/);
  const many = Array.from({ length: ZHUDA_WARM_UP_VIEW_LIMIT }, (_, i) => [i, 2, 0]);
  await assert.rejects(bad({ eyes: many }), /at most/);
});
