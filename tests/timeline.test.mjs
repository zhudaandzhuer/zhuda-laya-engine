import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaTimelineSequencer, validateTimelineSpec } from '../packages/core/runtime3d/Timeline.ts';

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
