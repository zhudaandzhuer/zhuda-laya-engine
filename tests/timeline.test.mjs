import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaTimelineSequencer, ZhudaOfflineFrameRecorder, validateTimelineSpec } from '../packages/core/runtime3d/Timeline.ts';

const spec = { schemaVersion: 1, duration: 2, tracks: [
  { id: 'camera-x', target: 'camera', kind: 'number', interpolation: 'linear', keys: [{ time: 0, value: 0 }, { time: 2, value: 10 }] },
  { id: 'cut', target: 'audio', kind: 'event', keys: [{ time: 1, value: 'stinger' }] },
] };

test('timeline samples deterministically and emits events once across fixed updates', () => {
  const values = [], cues = [];
  const timeline = new ZhudaTimelineSequencer(spec, { camera: { set: value => values.push(value) }, audio: { cue: value => cues.push(value) } });
  assert.deepEqual(timeline.sample(1), { camera: 5 });
  timeline.update(.5); timeline.update(.5); timeline.update(1); assert.equal(timeline.currentTime, 2); assert.deepEqual(cues, ['stinger']);
  timeline.reset(); assert.equal(timeline.currentTime, 0); assert.equal(timeline.complete, false); timeline.dispose(); assert.throws(() => timeline.update(.1), /Disposed/);
});

test('timeline validation rejects duplicate tracks, bad keys and event interpolation', () => {
  const errors = validateTimelineSpec({ ...spec, tracks: [{ ...spec.tracks[0], id: 'same' }, { ...spec.tracks[1], id: 'same', interpolation: 'linear', keys: [{ time: 2, value: 'x' }, { time: 1, value: 'y' }] }] });
  assert.ok(errors.some(error => /duplicate/.test(error)));
  assert.ok(errors.some(error => /not increasing/.test(error)));
  assert.ok(errors.some(error => /event interpolation/.test(error)));
});

test('offline frame recorder advances fixed timestamps and validates captures', async () => {
  const advanced = [];
  const recorder = new ZhudaOfflineFrameRecorder({
    durationSeconds: 1,
    fps: 2,
    advance: frame => advanced.push(frame),
    capture: frame => ({ ready: true, imagePath: `frame-${frame.index}.png`, metrics: { frameMs: 4 } }),
  });
  const frames = await recorder.record();
  assert.deepEqual(advanced.map(frame => [frame.index, frame.time, frame.deltaSeconds]), [[0, 0, 0], [1, .5, .5], [2, 1, .5]]);
  assert.equal(frames.length, 3);
  assert.equal(frames[2].capture.imagePath, 'frame-2.png');
  recorder.dispose();
  await assert.rejects(recorder.record(), /Disposed/);
});

test('offline frame recorder stops on cancellation and rejects non-integral duration', async () => {
  assert.throws(() => new ZhudaOfflineFrameRecorder({ durationSeconds: .3, fps: 2, advance() {}, capture: () => ({ ready: true, imagePath: 'x' }) }), /integer/);
  const controller = new AbortController();
  let count = 0;
  const recorder = new ZhudaOfflineFrameRecorder({
    durationSeconds: 2,
    fps: 2,
    signal: controller.signal,
    advance() { if (++count === 2) controller.abort(); },
    capture: () => ({ ready: true, imagePath: 'x' }),
  });
  await assert.rejects(recorder.record(), error => error.name === 'AbortError');
  assert.equal(count, 2);
});
