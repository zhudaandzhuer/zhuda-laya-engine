// Spatial samples in IframeSoundAdapter. Node has no OfflineAudioContext, so
// these tests use a context that records the graph and the parameter values
// it is given; left/right balance is then worked out from those values with
// the Web Audio equal-power formula (written again here). The real render in
// Chrome, HRTF included, is verify:spatial-audio.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Context, Gain, flush, fixture } from './helpers/audio-fixture.mjs';
import {
  spatialAzimuth,
  equalPowerGains,
  distanceGain,
  coneGain,
  resolveSpatial,
  fallbackPlacement,
} from '../packages/core/audio/Spatial.ts';

class Param {
  value = 0;
  events = [];
  setValueAtTime(v, t) {
    this.value = v;
    this.events.push(['set', v, t]);
  }
  linearRampToValueAtTime(v, t) {
    this.value = v;
    this.events.push(['linear', v, t]);
  }
  cancelScheduledValues(t) {
    this.events.push(['cancel', t]);
  }
}
class Panner extends Gain {
  panningModel = 'equalpower';
  distanceModel = 'inverse';
  refDistance = 1;
  maxDistance = 10000;
  rolloffFactor = 1;
  coneInnerAngle = 360;
  coneOuterAngle = 360;
  coneOuterGain = 0;
  positionX = new Param();
  positionY = new Param();
  positionZ = new Param();
  orientationX = new Param();
  orientationY = new Param();
  orientationZ = new Param();
}
class StereoPanner extends Gain {
  pan = new Param();
}
const listenerParams = () => ({
  positionX: new Param(),
  positionY: new Param(),
  positionZ: new Param(),
  forwardX: Object.assign(new Param(), { value: 0 }),
  forwardY: Object.assign(new Param(), { value: 0 }),
  forwardZ: Object.assign(new Param(), { value: -1 }),
  upX: Object.assign(new Param(), { value: 0 }),
  upY: Object.assign(new Param(), { value: 1 }),
  upZ: Object.assign(new Param(), { value: 0 }),
});
class SpatialContext extends Context {
  panners = [];
  stereo = [];
  listener = listenerParams();
  createPanner() {
    const p = new Panner();
    this.panners.push(p);
    return p;
  }
  createStereoPanner() {
    const p = new StereoPanner();
    this.stereo.push(p);
    return p;
  }
}
/** A host without PannerNode (some mini-game hosts). */
class FlatContext extends Context {
  stereo = [];
  listener = listenerParams();
  createStereoPanner() {
    const p = new StereoPanner();
    this.stereo.push(p);
    return p;
  }
}
const vec = (x, y, z) => [x.value, y.value, z.value];
/** What a listener hears of a panner, from the values set on both. */
function heard(context, panner) {
  const l = context.listener;
  const listener = {
    position: vec(l.positionX, l.positionY, l.positionZ),
    forward: vec(l.forwardX, l.forwardY, l.forwardZ),
    up: vec(l.upX, l.upY, l.upZ),
  };
  const options = resolveSpatial({
    position: vec(panner.positionX, panner.positionY, panner.positionZ),
    orientation: vec(panner.orientationX, panner.orientationY, panner.orientationZ),
    distanceModel: panner.distanceModel,
    refDistance: panner.refDistance,
    maxDistance: panner.maxDistance,
    rolloffFactor: panner.rolloffFactor,
    coneInnerAngle: panner.coneInnerAngle,
    coneOuterAngle: panner.coneOuterAngle,
    coneOuterGain: panner.coneOuterGain,
  });
  const [left, right] = equalPowerGains(spatialAzimuth(options.position, listener));
  const d = Math.hypot(...options.position.map((v, k) => v - listener.position[k]));
  const g = distanceGain(options, d) * coneGain(options, listener);
  return { left: left * g, right: right * g };
}
async function loaded(context, options = {}) {
  const f = fixture({ audioContextFactory: () => context, ...options });
  await f.audio.loadSample('step.wav');
  f.audio.unlockAudio('pointerdown');
  await flush();
  return f;
}

test('a spatial sample goes voice gain -> panner -> channel gain, HRTF by default', async () => {
  const context = new SpatialContext();
  let made = 0;
  const { audio } = await loaded(context, {
    audioContextFactory: () => {
      made++;
      return context;
    },
  });
  assert.equal(
    audio.playSample({ id: 'step', sampleId: 'step.wav', spatial: { position: [3, 0, -2] } }),
    true,
  );
  assert.equal(context.panners.length, 1);
  const panner = context.panners[0],
    source = context.sources.at(-1),
    voiceGain = source.connections[0];
  // gains[0] master, gains[1..3] bgm/sfx/ui.
  const sfx = context.gains[2];
  assert.deepEqual(voiceGain.connections, [panner], 'voice gain feeds the panner');
  assert.deepEqual(panner.connections, [sfx], 'the panner feeds the channel gain');
  assert.equal(panner.panningModel, 'HRTF');
  assert.deepEqual(vec(panner.positionX, panner.positionY, panner.positionZ), [3, 0, -2]);
  assert.equal(panner.refDistance, 1);
  // One context; channel and master gains untouched by the voice.
  assert.equal(made, 1);
  assert.equal(context.gains[0].gain.value, 0.85);
  assert.equal(sfx.gain.value, 0.9);
  const d = audio.getDiagnostics();
  assert.equal(d.spatialVoices, 1);
  assert.equal(d.spatialBackend, 'panner');
  // When the voice ends the panner is disconnected with it.
  source.end();
  assert.equal(panner.disconnected, true);
  assert.equal(audio.getDiagnostics().spatialVoices, 0);
  // A plain sample has no panner.
  audio.playSample({ id: 'plain', sampleId: 'step.wav' });
  assert.equal(context.panners.length, 1);
  assert.deepEqual(context.sources.at(-1).connections[0].connections, [sfx]);
});

test('left and right follow the source and the way the listener faces', async () => {
  const context = new SpatialContext();
  const { audio } = await loaded(context);
  const play = (id, position, more = {}) => {
    assert.equal(
      audio.playSample({ id, sampleId: 'step.wav', spatial: { position, ...more } }),
      true,
    );
    return context.panners.at(-1);
  };
  // Default listener at the origin facing -Z: +X is to its right.
  const right = heard(context, play('r', [2, 0, 0]));
  assert.ok(right.right > 0.99 * Math.hypot(right.left, right.right) && right.left < 1e-9);
  const left = heard(context, play('l', [-2, 0, 0]));
  assert.ok(left.left > left.right * 100);
  const ahead = heard(context, play('a', [0, 0, -2]));
  assert.ok(Math.abs(ahead.left - ahead.right) < 1e-9);
  // Turn the listener to face +X: the source at +X is now ahead, and one at -Z on the left.
  assert.equal(audio.setListener({ position: [0, 0, 0], forward: [1, 0, 0] }), true);
  const l = context.listener;
  assert.deepEqual(vec(l.forwardX, l.forwardY, l.forwardZ), [1, 0, 0]);
  const nowAhead = heard(context, context.panners[0]);
  assert.ok(Math.abs(nowAhead.left - nowAhead.right) < 1e-9);
  const nowLeft = heard(context, context.panners[2]);
  assert.ok(nowLeft.left > nowLeft.right * 100);
  // Walk the listener past the source: it moves from right to left.
  audio.setListener({ position: [0, 0, 0], forward: [0, 0, -1] });
  const passing = play('pass', [1, 0, -5]);
  const balance = [];
  for (const z of [-1, -4, -6, -9]) {
    audio.setListener({ position: [0, 0, z], forward: [0, 0, -1] });
    const h = heard(context, passing);
    balance.push(+(h.right - h.left).toFixed(3));
  }
  // Ahead and right, beside (right), then behind: equal-power folds behind to the front.
  assert.ok(
    balance.every((b) => b > 0),
    `still on the right ${balance}`,
  );
  // Moving the source across to the left side changes the balance's sign.
  assert.equal(audio.setVoicePosition('pass', [-1, 0, -9]), true);
  const h = heard(context, passing);
  assert.ok(h.left > h.right);
  assert.deepEqual(vec(passing.positionX, passing.positionY, passing.positionZ), [-1, 0, -9]);
  assert.equal(audio.setVoicePosition('nobody', [0, 0, 0]), false);
  assert.equal(audio.setVoicePosition('pass', [NaN, 0, 0]), false);
});

test('distance falls as the model says; a cone turns a source away', async () => {
  const context = new SpatialContext();
  const { audio } = await loaded(context);
  audio.playSample({ id: 'near', sampleId: 'step.wav', spatial: { position: [0, 0, -1] } });
  audio.playSample({ id: 'far', sampleId: 'step.wav', spatial: { position: [0, 0, -4] } });
  const near = heard(context, context.panners[0]),
    far = heard(context, context.panners[1]);
  assert.ok(Math.abs(far.left / near.left - 0.25) < 1e-9, 'inverse: a quarter at four times');
  audio.playSample({
    id: 'linear',
    sampleId: 'step.wav',
    spatial: { position: [0, 0, -6], distanceModel: 'linear', refDistance: 2, maxDistance: 10 },
  });
  const linear = context.panners[2];
  assert.equal(linear.distanceModel, 'linear');
  assert.ok(Math.abs(heard(context, linear).left / Math.SQRT1_2 - 0.5) < 1e-9);
  // A speaker facing away (+Z) from the listener (at the origin, the source at -Z).
  audio.playSample({
    id: 'cone',
    sampleId: 'step.wav',
    spatial: {
      position: [0, 0, -1],
      orientation: [0, 0, -1],
      coneInnerAngle: 60,
      coneOuterAngle: 120,
      coneOuterGain: 0.2,
    },
  });
  const cone = context.panners[3];
  assert.deepEqual(vec(cone.orientationX, cone.orientationY, cone.orientationZ), [0, 0, -1]);
  assert.ok(
    Math.abs(heard(context, cone).left / heard(context, context.panners[0]).left - 0.2) < 1e-9,
  );
});

test('without PannerNode the same placement is a distance gain and a stereo pan', async () => {
  const context = new FlatContext();
  const { audio } = await loaded(context);
  assert.equal(
    audio.playSample({ id: 'step', sampleId: 'step.wav', spatial: { position: [4, 0, 0] } }),
    true,
  );
  const source = context.sources.at(-1),
    voiceGain = source.connections[0],
    distance = voiceGain.connections[0],
    pan = context.stereo[0],
    sfx = context.gains[2];
  assert.ok(distance instanceof Gain && distance !== sfx);
  assert.deepEqual(distance.connections, [pan]);
  assert.deepEqual(pan.connections, [sfx]);
  assert.ok(Math.abs(distance.gain.value - 0.25) < 1e-12, 'inverse distance at 4 m');
  assert.equal(pan.pan.value, 1, 'all the way right');
  assert.equal(audio.getDiagnostics().spatialBackend, 'gain');
  // The listener turns round: the same source is now on the left.
  audio.setListener({ position: [0, 0, 0], forward: [0, 0, 1] });
  assert.equal(pan.pan.value, -1);
  // It walks up to it: the gain rises to one.
  audio.setListener({ position: [3.5, 0, 0], forward: [0, 0, 1], rampSec: 0.1 });
  assert.equal(distance.gain.value, 1);
  assert.ok(
    distance.gain.events.some(([kind]) => kind === 'linear'),
    'glides with rampSec',
  );
  // Moving the voice moves its pan.
  audio.setVoicePosition('step', [3.5, 0, 5]);
  assert.ok(Math.abs(pan.pan.value) < 1e-9, 'straight ahead');
  source.end();
  assert.equal(distance.disconnected && pan.disconnected, true);
  // No StereoPannerNode either: distance only.
  const bare = new Context();
  bare.listener = listenerParams();
  const { audio: plain } = await loaded(bare);
  plain.playSample({ id: 'x', sampleId: 'step.wav', spatial: { position: [0, 0, -2] } });
  const only = bare.sources.at(-1).connections[0].connections[0];
  assert.ok(Math.abs(only.gain.value - 0.5) < 1e-12);
  assert.deepEqual(only.connections, [bare.gains[2]]);
});

test('the gain fallback matches what the panner formula gives', () => {
  const listener = { position: [1, 0, 2], forward: [0.3, 0, -1], up: [0, 1, 0] };
  for (const position of [
    [5, 0, 0],
    [-3, 1, -4],
    [1, 0, 9],
    [2, -2, 2],
  ]) {
    const options = resolveSpatial({ position, refDistance: 1.5, rolloffFactor: 0.7 });
    const placement = fallbackPlacement(options, listener);
    const [l, r] = equalPowerGains(spatialAzimuth(position, listener));
    const x = (placement.pan + 1) / 2;
    assert.ok(Math.abs(Math.cos((x * Math.PI) / 2) - l) < 1e-12);
    assert.ok(Math.abs(Math.sin((x * Math.PI) / 2) - r) < 1e-12);
  }
});

test('an old host without position AudioParams is placed through setPosition', async () => {
  const context = new Context();
  const calls = [];
  context.listener = {
    setPosition: (...a) => calls.push(['listener', ...a]),
    setOrientation: (...a) => calls.push(['orient', ...a]),
  };
  context.createPanner = () => {
    const p = new Gain();
    p.setPosition = (...a) => calls.push(['panner', ...a]);
    p.setOrientation = (...a) => calls.push(['facing', ...a]);
    return p;
  };
  const { audio } = await loaded(context);
  assert.deepEqual(calls.slice(0, 2), [
    ['listener', 0, 0, 0],
    ['orient', 0, 0, -1, 0, 1, 0],
  ]);
  audio.playSample({ id: 's', sampleId: 'step.wav', spatial: { position: [1, 2, 3] } });
  assert.deepEqual(calls.slice(2), [
    ['panner', 1, 2, 3],
    ['facing', 1, 0, 0],
  ]);
  audio.setListener({ position: [4, 5, 6] });
  assert.deepEqual(calls.at(-2), ['listener', 4, 5, 6]);
});

test('a listener set before the context exists is applied when it is made', async () => {
  const context = new SpatialContext();
  const f = fixture({ audioContextFactory: () => context });
  assert.equal(f.audio.setListener({ position: [1, 2, 3], forward: [1, 0, 0] }), true);
  await f.audio.loadSample('step.wav');
  const l = context.listener;
  assert.deepEqual(vec(l.positionX, l.positionY, l.positionZ), [1, 2, 3]);
  assert.deepEqual(vec(l.forwardX, l.forwardY, l.forwardZ), [1, 0, 0]);
});

test('bad spatial options and poses are refused', async () => {
  const context = new SpatialContext();
  const { audio } = await loaded(context);
  const play = (spatial) => audio.playSample({ id: 'bad', sampleId: 'step.wav', spatial });
  for (const spatial of [
    {},
    { position: [0, 0] },
    { position: [0, NaN, 0] },
    { position: [0, 0, 1e7] },
    { position: [0, 0, 0], refDistance: 0 },
    { position: [0, 0, 0], maxDistance: -1 },
    { position: [0, 0, 0], rolloffFactor: -1 },
    { position: [0, 0, 0], distanceModel: 'linear', rolloffFactor: 2 },
    { position: [0, 0, 0], distanceModel: 'linear', refDistance: 5, maxDistance: 5 },
    { position: [0, 0, 0], distanceModel: 'cubic' },
    { position: [0, 0, 0], panningModel: 'binaural' },
    { position: [0, 0, 0], coneInnerAngle: 400 },
    { position: [0, 0, 0], coneInnerAngle: 90, coneOuterAngle: 60 },
    { position: [0, 0, 0], coneOuterGain: 2 },
    { position: [0, 0, 0], orientation: [1, 0] },
  ])
    assert.equal(play(spatial), false, JSON.stringify(spatial));
  assert.equal(context.panners.length, 0, 'nothing was made for a refused voice');
  for (const pose of [
    null,
    {},
    { position: [0, 0, 0], forward: [0, 0, 0] },
    { position: [0, 0, 0], forward: [0, 1, 0] },
    { position: [0, 0, 0], up: [0, 0, -2] },
    { position: [0, 0, 0], rampSec: 2 },
    { position: [Infinity, 0, 0] },
  ])
    assert.equal(audio.setListener(pose), false, JSON.stringify(pose));
  audio.dispose();
  assert.equal(audio.setListener({ position: [0, 0, 0] }), false);
  assert.equal(audio.setVoicePosition('x', [0, 0, 0]), false);
});

test('queued before unlock, a spatial voice starts placed; dispose disconnects it', async () => {
  const context = new SpatialContext();
  context.state = 'suspended';
  const f = fixture({ audioContextFactory: () => context });
  await f.audio.loadSample('step.wav');
  assert.equal(
    f.audio.playSample({ id: 'q', sampleId: 'step.wav', spatial: { position: [0, 0, -3] } }),
    true,
  );
  assert.equal(context.panners.length, 0, 'queued, not started');
  f.audio.unlockAudio('pointerdown');
  await flush();
  assert.equal(context.panners.length, 1);
  const panner = context.panners[0];
  assert.deepEqual(vec(panner.positionX, panner.positionY, panner.positionZ), [0, 0, -3]);
  f.audio.dispose();
  assert.equal(panner.disconnected, true);
});
