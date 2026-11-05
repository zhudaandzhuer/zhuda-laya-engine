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

test('timeline interpolation keeps finite endpoints finite across opposite magnitudes', () => {
  const timeline = new ZhudaTimelineSequencer({schemaVersion:1,duration:1,tracks:[
    {id:'number',target:'number',kind:'number',keys:[{time:0,value:-1e308},{time:1,value:1e308}]},
    {id:'vector',target:'vector',kind:'vector',keys:[{time:0,value:[1e308,-1e308]},{time:1,value:[-1e308,1e308]}]},
  ]},{number:{set(){}},vector:{set(){}}});
  assert.deepEqual(timeline.sample(.5),{number:0,vector:[0,0]});
  timeline.dispose();
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

test('timeline rejects malformed vectors/NaN and samples step keys at their exact boundary', () => {
  for(const bad of [null, {tracks:{}}, {schemaVersion:1,duration:1,tracks:[{id:'v',target:'v',kind:'vector',keys:[{time:0,value:[1]},{time:1,value:[1,2]}]}]}, {schemaVersion:1,duration:1,tracks:[{id:'n',target:'n',kind:'number',keys:[{time:0,value:NaN}]}]}]) assert.ok(validateTimelineSpec(bad).length);
  const authored={schemaVersion:1,duration:2,tracks:[{id:'s',target:'s',kind:'boolean',keys:[{time:0,value:false},{time:1,value:true},{time:2,value:false}]}]};
  const t=new ZhudaTimelineSequencer(authored,{s:{set(){}}});
  assert.deepEqual(t.sample(1),{s:true}); authored.tracks[0].keys[1].value=false; assert.deepEqual(t.sample(1),{s:true});
  assert.throws(()=>t.spec.tracks.push(authored.tracks[0])); assert.throws(()=>t.spec.tracks[0].keys.pop()); t.dispose();
});
test('offline recorder deadlines/disposal interrupt stuck callbacks without advancing', async () => {
  let capture=0;
  const r=new ZhudaOfflineFrameRecorder({durationSeconds:1,fps:1,stepTimeoutMs:10,advance:()=>new Promise(()=>{}),capture(){capture++;return {ready:true,imagePath:'x'};}});
  await assert.rejects(r.record(),e=>e.name==='TimeoutError');assert.equal(capture,0);
  const r2=new ZhudaOfflineFrameRecorder({durationSeconds:1,fps:1,advance:()=>new Promise(()=>{}),capture(){throw Error('unreachable');}});
  const work=r2.record();r2.dispose();await assert.rejects(work,e=>e.name==='AbortError');
});
