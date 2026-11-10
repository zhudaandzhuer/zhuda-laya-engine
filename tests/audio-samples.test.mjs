import test from 'node:test';
import assert from 'node:assert/strict';
import { IframeSoundAdapter } from '../packages/core/IframeSoundAdapter.ts';

class Param {
  value = 1;
  events = [];
  setValueAtTime(value, time) {
    this.value = value;
    this.events.push(['set', value, time]);
  }
  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push(['linear', value, time]);
  }
  cancelScheduledValues(time) {
    this.events.push(['cancel', time]);
  }
}
class Gain {
  gain = new Param();
  connections = [];
  disconnected = false;
  connect(node) {
    this.connections.push(node);
  }
  disconnect() {
    this.disconnected = true;
  }
}
class Source {
  buffer = null;
  onended = null;
  started = [];
  stopped = [];
  connections = [];
  disconnected = false;
  connect(node) {
    this.connections.push(node);
  }
  disconnect() {
    this.disconnected = true;
  }
  start(...args) {
    this.started = args;
  }
  stop(time) {
    this.stopped.push(time);
  }
  end() {
    this.onended?.();
  }
}
const pcm = () => ({ duration: 2, numberOfChannels: 1, sampleRate: 24000, length: 48000 });
class Context {
  state = 'running';
  currentTime = 10;
  destination = {};
  gains = [];
  sources = [];
  decodes = 0;
  closed = 0;
  createGain() {
    const g = new Gain();
    this.gains.push(g);
    return g;
  }
  createBufferSource() {
    const s = new Source();
    this.sources.push(s);
    return s;
  }
  createBuffer() {
    return pcm();
  }
  async decodeAudioData() {
    this.decodes++;
    return pcm();
  }
  async resume() {
    this.state = 'running';
  }
  async suspend() {
    this.state = 'suspended';
  }
  async close() {
    this.closed++;
    this.state = 'closed';
  }
}
function fixture(options = {}) {
  const context = new Context();
  let loads = 0,
    releases = 0,
    providerDisposed = 0;
  const provider = {
    name: 'samples',
    async load(id) {
      loads++;
      return {
        id,
        bytes: new Uint8Array([1, 2, 3]),
        release() {
          releases++;
        },
      };
    },
    dispose() {
      providerDisposed++;
    },
  };
  const audio = new IframeSoundAdapter({
    sampleProvider: provider,
    audioContextFactory: () => context,
    ...options,
  });
  return { audio, context, provider, counts: () => ({ loads, releases, providerDisposed }) };
}
test('samples share decode/cache, queue once, mix gain once, loop and release over 30 cycles', async () => {
  const f = fixture();
  const { audio, context } = f;
  for (let i = 0; i < 30; i++) {
    const [a, b] = await Promise.all([
      audio.loadSample('audio/test.wav'),
      audio.loadSample('audio/test.wav'),
    ]);
    assert.deepEqual(a, b);
    assert.equal(a.decodedBytes, 192000);
    assert.equal(context.decodes, i + 1);
    assert.equal(audio.getDiagnostics().loadedSamples, 1);
    assert.equal(
      audio.playSample({
        id: 'bgm',
        sampleId: a.id,
        channel: 'bgm',
        loop: true,
        offsetSec: 0.25,
        loopStartSec: 0.1,
        loopEndSec: 1.9,
        peakGain: 0.3,
      }),
      true,
    );
    assert.equal(audio.playSample({ id: 'bgm', sampleId: a.id }), false);
    if (i === 0) {
      assert.equal(audio.getDiagnostics().pendingQueue, 1);
      audio.unlockAudio('fixture');
    }
    const source = context.sources.at(-1),
      gain = context.gains.at(-1);
    assert.deepEqual(source.started, [10, 0.25]);
    assert.equal(source.loop, true);
    assert.equal(gain.gain.events[0][1], 0.3);
    assert.equal(gain.connections[0], context.gains[1]);
    assert.equal(audio.unloadSample(a.id), true);
    assert.equal(source.disconnected, true);
    assert.equal(gain.disconnected, true);
    assert.equal(audio.getDiagnostics().activeVoices, 0);
    assert.equal(audio.getDiagnostics().decodedSampleBytes, 0);
  }
  assert.deepEqual(f.counts(), { loads: 30, releases: 30, providerDisposed: 0 });
  audio.dispose();
  assert.equal(context.closed, 1);
  assert.equal(f.counts().providerDisposed, 0);
});
test('sample fades/replacement keep old BGM on capacity failure and count overlapping voices', async () => {
  const { audio, context } = fixture({ maxActiveVoices: 2 });
  await audio.loadSample('a.wav');
  audio.unlockAudio('fixture');
  assert.equal(audio.playSample({ id: 'bgm', sampleId: 'a.wav', loop: true }), true);
  const old = context.sources.at(-1);
  assert.equal(
    audio.playSample({
      id: 'bgm',
      sampleId: 'a.wav',
      loop: true,
      replace: true,
      crossFadeSec: 0.2,
    }),
    true,
  );
  assert.equal(audio.getDiagnostics().activeVoices, 2);
  assert.deepEqual(old.stopped, [10.2]);
  assert.deepEqual(context.gains.at(-1).gain.events, [
    ['set', 0, 10],
    ['linear', 1, 10.2],
  ]);
  assert.equal(audio.playSample({ id: 'bgm', sampleId: 'a.wav', replace: true }), false);
  assert.equal(audio.getDiagnostics().activeVoices, 2);
  old.end();
  assert.equal(audio.getDiagnostics().activeVoices, 1);
  assert.equal(old.disconnected, true);
  assert.equal(audio.stop('bgm', 0.3), true);
  context.sources.at(-1).end();
  assert.equal(audio.getDiagnostics().activeVoices, 0);
  assert.equal(
    audio.playSample({
      id: 'shot',
      sampleId: 'a.wav',
      offsetSec: 0.5,
      durationSec: 1,
      fadeInSec: 0.2,
      fadeOutSec: 0.3,
    }),
    true,
  );
  assert.deepEqual(context.sources.at(-1).stopped, [11]);
  assert.deepEqual(context.gains.at(-1).gain.events, [
    ['set', 0, 10],
    ['linear', 1, 10.2],
    ['set', 1, 10.7],
    ['linear', 0, 11],
  ]);
  audio.dispose();
});
test('sample loading handles decode failure, bounds and retry without leaked leases', async () => {
  const f = fixture({ maxSamples: 1, maxDecodedSampleBytes: 200000 });
  f.context.decodeAudioData = async () => {
    throw Error('bad codec');
  };
  await assert.rejects(f.audio.loadSample('bad.mp3'), /bad codec/);
  assert.equal(f.counts().releases, 1);
  assert.equal(f.audio.getDiagnostics().loadedSamples, 0);
  f.context.decodeAudioData = async () => pcm();
  await f.audio.loadSample('good.wav');
  await assert.rejects(f.audio.loadSample('extra.wav'), /capacity/);
  for (const options of [
    { offsetSec: 2 },
    { loopStartSec: 1, loopEndSec: 0.5 },
    { peakGain: NaN },
    { fadeOutSec: 1, loop: true },
    { crossFadeSec: 1 },
    { durationSec: -1 },
  ])
    assert.equal(f.audio.playSample({ id: 'bad', sampleId: 'good.wav', ...options }), false);
  f.audio.dispose();
  const small = fixture({ maxDecodedSampleBytes: 1 });
  await assert.rejects(small.audio.loadSample('large.wav'), /PCM bound/);
  small.audio.dispose();
});
test('independent cancellation preserves another decode caller; timeout and dispose discard late success', async () => {
  const f = fixture({ sampleTimeoutMs: 50 });
  let finish;
  f.context.decodeAudioData = () =>
    new Promise((resolve) => {
      finish = () => resolve(pcm());
    });
  const first = new AbortController();
  const a = f.audio.loadSample('a.wav', { signal: first.signal });
  const b = f.audio.loadSample('a.wav');
  await new Promise((r) => setImmediate(r));
  first.abort();
  await assert.rejects(a, /cancelled/i);
  finish();
  await b;
  assert.equal(f.audio.getDiagnostics().loadedSamples, 1);
  f.audio.unloadSample('a.wav');
  const late = f.audio.loadSample('late.wav');
  await new Promise((r) => setImmediate(r));
  await assert.rejects(late, /timeout/);
  finish();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.audio.getDiagnostics().loadedSamples, 0);
  const dying = f.audio.loadSample('dying.wav');
  await new Promise((r) => setImmediate(r));
  f.audio.dispose();
  await assert.rejects(dying, /cancelled/i);
  finish();
  await new Promise((r) => setImmediate(r));
  assert.equal(f.audio.getDiagnostics().loadedSamples, 0);
  assert.equal(f.audio.getDiagnostics().pendingSampleLoads, 0);
  assert.equal(f.counts().loads, f.counts().releases);
});
test('unload and stopAll clear queued samples; focus suspends the one context', async () => {
  const { audio, context } = fixture();
  await audio.loadSample('a.wav');
  audio.playSample({ id: 'queued', sampleId: 'a.wav' });
  assert.equal(audio.stopAll('sfx'), 1);
  audio.playSample({ id: 'queued', sampleId: 'a.wav' });
  audio.unloadSample('a.wav');
  audio.unlockAudio('fixture');
  assert.equal(audio.getDiagnostics().playedEventsCount, 0);
  await audio.loadSample('a.wav');
  audio.playSample({ id: 'loop', sampleId: 'a.wav', loop: true });
  audio.handleFocusOrVisibilityChange(false, false);
  assert.equal(context.state, 'suspended');
  assert.equal(audio.playSample({ id: 'hidden', sampleId: 'a.wav' }), false);
  audio.handleFocusOrVisibilityChange(true, true);
  assert.equal(context.state, 'running');
  audio.dispose();
});
