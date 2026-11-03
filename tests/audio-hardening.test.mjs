import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { IframeSoundAdapter } from '../packages/core/IframeSoundAdapter.ts';

class FakeParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }
  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'ramp', value, time });
  }
}

class FakeGain {
  constructor() {
    this.gain = new FakeParam();
    this.connections = [];
  }
  connect(node) {
    this.connections.push(node);
    return node;
  }
}

class FakeOscillator {
  constructor() {
    this.type = 'sine';
    this.frequency = new FakeParam();
    this.connections = [];
    this.onended = null;
    this.started = [];
    this.stopped = [];
  }
  connect(node) {
    this.connections.push(node);
    return node;
  }
  start(time = 0) {
    this.started.push(time);
  }
  stop(time = 0) {
    this.stopped.push(time);
  }
}

class FakeBufferSource {
  connect(node) {
    this.destination = node;
    return node;
  }
  start() {
    this.started = true;
  }
}

class FakeAudioContext {
  constructor({ state = 'running', rejectResume = false } = {}) {
    this.state = state;
    this.currentTime = 10;
    this.destination = { kind: 'destination' };
    this.gains = [];
    this.oscillators = [];
    this.closed = 0;
    this.rejectResume = rejectResume;
  }
  createGain() {
    const gain = new FakeGain();
    this.gains.push(gain);
    return gain;
  }
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createBuffer() {
    return { getChannelData: () => new Float32Array(1) };
  }
  createBufferSource() {
    return new FakeBufferSource();
  }
  resume() {
    if (this.rejectResume) return Promise.reject(new Error('resume blocked by policy'));
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close() {
    this.closed++;
    this.state = 'closed';
    return Promise.resolve();
  }
}

class FakeEventTarget {
  constructor() {
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    this.listeners.set(type, list.filter((candidate) => candidate !== listener));
  }
  dispatch(type, event = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener({ type, ...event });
    }
  }
}

function installFakeDom(origin = 'https://game.example') {
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const windowTarget = new FakeEventTarget();
  const documentTarget = new FakeEventTarget();
  const fakeWindow = Object.assign(windowTarget, {
    self: windowTarget,
    top: windowTarget,
    location: { origin },
    parent: windowTarget
  });
  const fakeDocument = Object.assign(documentTarget, {
    visibilityState: 'visible',
    body: { dataset: {} }
  });
  globalThis.window = fakeWindow;
  globalThis.document = fakeDocument;
  return {
    window: fakeWindow,
    document: fakeDocument,
    restore() {
      if (previousWindow === undefined) delete globalThis.window;
      else globalThis.window = previousWindow;
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
    }
  };
}

test('audio mixer queues once, applies volume in the mixer, and exposes stoppable voices', () => {
  const context = new FakeAudioContext();
  const adapter = new IframeSoundAdapter({ audioContextFactory: () => context });

  assert.equal(adapter.scheduleTone({ id: 'queued', startFreq: 440, durationSec: 0.2, peakGain: 0.5 }), true);
  assert.equal(adapter.scheduleTone({ id: 'queued', startFreq: 440, durationSec: 0.2, peakGain: 0.5 }), false);
  assert.equal(adapter.getDiagnostics().pendingQueue, 1);
  assert.equal(adapter.unlockAudio('test'), true);
  assert.equal(adapter.getDiagnostics().pendingQueue, 0);
  assert.equal(adapter.getDiagnostics().playedEventsCount, 1);
  assert.equal(adapter.getDiagnostics().activeVoices, 1);

  assert.equal(adapter.setChannelVolume('sfx', 0.25), true);
  assert.equal(adapter.setChannelVolume('master', 0.4), true);
  assert.equal(adapter.scheduleTone({ id: 'mixed', channel: 'sfx', startFreq: 500, durationSec: 0.2, peakGain: 0.6 }), true);
  const voiceGain = context.gains.at(-1);
  assert.equal(voiceGain.gain.events[0].value, 0.6, 'voice gain must not include master/channel volume');
  assert.equal(context.gains[2].gain.value, 0.25, 'channel gain owns sfx volume');
  assert.equal(context.gains[0].gain.value, 0.4, 'master gain owns master volume');
  assert.equal(adapter.stop('mixed'), true);
  assert.equal(adapter.getDiagnostics().activeVoices, 1, 'the queued voice remains until its scheduled end');
  assert.equal(adapter.stopAll(), 1);
  assert.equal(adapter.getDiagnostics().activeVoices, 0);
  adapter.dispose();
  assert.equal(context.closed, 1);
});

test('audio mixer rejects malformed input and does not claim unlock after resume failure', async () => {
  const context = new FakeAudioContext({ state: 'suspended', rejectResume: true });
  const adapter = new IframeSoundAdapter({ audioContextFactory: () => context });
  for (const value of [NaN, Infinity, -1]) {
    assert.equal(adapter.scheduleTone({ id: `bad-${String(value)}`, startFreq: value, durationSec: 0.1 }), false);
  }
  assert.equal(adapter.setChannelVolume('sfx', NaN), false);
  assert.equal(adapter.setChannelVolume('sfx', -0.1), false);
  assert.equal(adapter.setChannelVolume('sfx', 1.1), false);
  assert.equal(adapter.unlockAudio('blocked'), false);
  await new Promise((resolve) => setImmediate(resolve));
  const diagnostics = adapter.getDiagnostics();
  assert.equal(diagnostics.unlockedByGesture, false);
  assert.match(diagnostics.lastError, /resume blocked/);
  adapter.dispose();
});

test('postMessage bridge requires an allowed origin and acknowledges using that origin', () => {
  const dom = installFakeDom();
  try {
    const context = new FakeAudioContext();
    const adapter = new IframeSoundAdapter({
      audioContextFactory: () => context,
      allowedParentOrigins: ['https://parent.example']
    });
    const replies = [];
    const source = { postMessage(message, targetOrigin) { replies.push({ message, targetOrigin }); } };

    dom.window.dispatch('message', {
      origin: 'https://evil.example',
      source,
      data: { type: 'zhuda:audio:mute' }
    });
    assert.equal(adapter.isMuted(), false);
    assert.equal(replies.length, 0);

    dom.window.dispatch('message', {
      origin: 'https://parent.example',
      source,
      data: { type: 'zhuda:audio:setVolume', channel: 'sfx', volume: 0.3 }
    });
    assert.equal(adapter.getChannelVolume('sfx'), 0.3);
    assert.equal(replies.length, 1);
    assert.equal(replies[0].targetOrigin, 'https://parent.example');
    adapter.dispose();
  } finally {
    dom.restore();
  }
});

test('dispose removes voices and bridge/listeners, while blur silences the shared master', () => {
  const dom = installFakeDom();
  try {
    const context = new FakeAudioContext();
    const adapter = new IframeSoundAdapter({ audioContextFactory: () => context });
    adapter.unlockAudio('test');
    assert.equal(adapter.scheduleTone({ id: 'active', startFreq: 440, durationSec: 1, peakGain: 0.4 }), true);
    adapter.handleFocusOrVisibilityChange(false, false);
    assert.equal(context.gains[0].gain.value, 0);
    assert.equal(adapter.scheduleTone({ id: 'blocked', startFreq: 440, durationSec: 0.1 }), false);
    adapter.dispose();
    assert.equal(adapter.getDiagnostics().activeVoices, 0);
    assert.equal(context.closed, 1);
    assert.equal(adapter.getDiagnostics().postMessageBridgeActive, false);
  } finally {
    dom.restore();
  }
});

test('stale queue entries are dropped and a closed context cannot play without a new unlock', () => {
  let now = 0;
  const first = new FakeAudioContext();
  const second = new FakeAudioContext();
  const contexts = [first, second];
  const adapter = new IframeSoundAdapter({
    audioContextFactory: () => contexts.shift() ?? null,
    now: () => now
  });
  assert.equal(adapter.scheduleTone({ id: 'stale', startFreq: 440, durationSec: 0.1 }), true);
  now = 501;
  assert.equal(adapter.unlockAudio('test'), true);
  assert.equal(adapter.getDiagnostics().droppedQueue, 1);

  assert.equal(adapter.scheduleTone({ id: 'before-close', startFreq: 440, durationSec: 0.1 }), true);
  first.state = 'closed';
  assert.equal(adapter.scheduleTone({ id: 'after-close', startFreq: 440, durationSec: 0.1 }), false);
  assert.equal(adapter.getDiagnostics().unlockedByGesture, false);
  assert.equal(adapter.unlockAudio('replacement'), true);
  assert.equal(adapter.getDiagnostics().contextState, 'running');
  adapter.dispose();
});

test('showcase audio delegates every event and owns no second WebAudio graph', () => {
  const source = fs.readFileSync(path.resolve('src/audio/MinesweeperAudio.ts'), 'utf8');
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\bAudioContext\b/);
  assert.doesNotMatch(code, /createOscillator|createBufferSource|\.destination/);
  assert.doesNotMatch(code, /Math\.random/);
});
