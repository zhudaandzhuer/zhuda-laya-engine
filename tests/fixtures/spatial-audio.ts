// Real Web Audio fixture for scripts/verify-spatial-audio.mjs: spatial samples
// through the browser SDK's IframeSoundAdapter, rendered by Chrome's own
// OfflineAudioContext (PannerNode with HRTF or equal power, and the gain
// fallback of a host without PannerNode). Left and right are measured on the
// rendered channels.
const Z = (globalThis as any).Zhuda;
const out: any = { ready: false, errors: [] as string[] };
(globalThis as any).__SPATIAL__ = out;
addEventListener('error', (event) => out.errors.push(String(event.message)));
addEventListener('unhandledrejection', (event) => out.errors.push(String(event.reason)));

const RATE = 48000,
  SECONDS = 0.6;

/** A mono 16-bit WAV of steady noise (the same every run): broadband, as footsteps are. */
function noiseWav(seconds: number): Uint8Array {
  const frames = Math.round(RATE * seconds),
    bytes = new Uint8Array(44 + frames * 2),
    view = new DataView(bytes.buffer);
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + frames * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RATE, true);
  view.setUint32(28, RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, frames * 2, true);
  let seed = 12345;
  for (let i = 0; i < frames; i++) {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    view.setInt16(44 + i * 2, Math.round(((seed / 4294967296) * 2 - 1) * 12000), true);
  }
  return bytes;
}
const sample = noiseWav(1);
const provider = {
  name: 'spatial-fixture',
  async load(id: string) {
    return { id, bytes: sample.slice() };
  },
};

/** An OfflineAudioContext the adapter takes for a live one: it reports running. */
class OfflineAsLive extends OfflineAudioContext {
  get state() {
    return 'running' as AudioContextState;
  }
  resume() {
    return Promise.resolve();
  }
  suspend() {
    return Promise.resolve();
  }
}

interface Case {
  /** No PannerNode: the adapter's gain fallback. */
  noPanner?: boolean;
  listener?: any;
  play: any;
  /** At half time: move the voice, or the listener. */
  moveTo?: [number, number, number];
  listenerLater?: any;
}

/** Root mean square of a channel between two times, in seconds. */
const rms = (data: Float32Array, from: number, to: number) => {
  let sum = 0;
  const a = Math.round(from * RATE),
    b = Math.round(to * RATE);
  for (let i = a; i < b; i++) sum += data[i] * data[i];
  return Math.sqrt(sum / (b - a));
};

async function render(c: Case) {
  const context = new OfflineAsLive({
    numberOfChannels: 2,
    length: Math.round(RATE * SECONDS),
    sampleRate: RATE,
  });
  if (c.noPanner) Object.defineProperty(context, 'createPanner', { value: undefined });
  let made = 0;
  const audio = new Z.IframeSoundAdapter({
    sampleProvider: provider,
    audioContextFactory: () => {
      made++;
      return context;
    },
  });
  await audio.loadSample('noise.wav');
  if (c.listener && !audio.setListener(c.listener)) throw Error('listener refused');
  if (!audio.unlockAudio('fixture')) throw Error('not unlocked');
  if (!audio.playSample({ id: 'voice', sampleId: 'noise.wav', loop: true, ...c.play }))
    throw Error('play refused: ' + JSON.stringify(c.play));
  const diagnostics = audio.getDiagnostics();
  if (c.moveTo || c.listenerLater) {
    // The base class's own suspend: the render stops there for the move.
    OfflineAudioContext.prototype.suspend.call(context, SECONDS / 2).then(() => {
      if (c.moveTo && !audio.setVoicePosition('voice', c.moveTo)) out.errors.push('move refused');
      if (c.listenerLater && !audio.setListener(c.listenerLater))
        out.errors.push('listener move refused');
      return OfflineAudioContext.prototype.resume.call(context);
    });
  }
  const buffer: AudioBuffer = await OfflineAudioContext.prototype.startRendering.call(context);
  const left = buffer.getChannelData(0),
    right = buffer.getChannelData(1);
  const measure = (from: number, to: number) => {
    const l = rms(left, from, to),
      r = rms(right, from, to);
    return { left: +l.toFixed(5), right: +r.toFixed(5), balance: +((r - l) / (r + l)).toFixed(4) };
  };
  audio.dispose();
  return {
    contexts: made,
    spatialBackend: diagnostics.spatialBackend,
    spatialVoices: diagnostics.spatialVoices,
    whole: measure(0.05, SECONDS - 0.02),
    first: measure(0.05, SECONDS / 2 - 0.02),
    second: measure(SECONDS / 2 + 0.05, SECONDS - 0.02),
  };
}

const spatial = (position: number[], more: any = {}) => ({ spatial: { position, ...more } });
async function main() {
  const r: any = {};
  for (const model of ['HRTF', 'equalpower']) {
    const m = { panningModel: model };
    r[model] = {
      right: await render({ play: spatial([2, 0, 0], m) }),
      left: await render({ play: spatial([-2, 0, 0], m) }),
      ahead: await render({ play: spatial([0, 0, -2], m) }),
      // Facing +X, the source at +X is ahead and one at -Z is on the left.
      turnedAhead: await render({
        listener: { position: [0, 0, 0], forward: [1, 0, 0] },
        play: spatial([2, 0, 0], m),
      }),
      turnedLeft: await render({
        listener: { position: [0, 0, 0], forward: [1, 0, 0] },
        play: spatial([0, 0, -2], m),
      }),
      // Moved across from right to left half way through.
      moved: await render({ play: spatial([2, 0, -1], m), moveTo: [-2, 0, -1] }),
      // The listener turns round half way through.
      turning: await render({
        play: spatial([2, 0, -1], m),
        listenerLater: { position: [0, 0, 0], forward: [0, 0, 1] },
      }),
    };
  }
  const flat = { panningModel: 'equalpower' };
  r.distance = {
    one: await render({ play: spatial([0, 0, -1], flat) }),
    four: await render({ play: spatial([0, 0, -4], flat) }),
    linearHalf: await render({
      play: spatial([0, 0, -6], {
        ...flat,
        distanceModel: 'linear',
        refDistance: 2,
        maxDistance: 10,
      }),
    }),
    coneAway: await render({
      play: spatial([0, 0, -1], {
        ...flat,
        orientation: [0, 0, -1],
        coneInnerAngle: 60,
        coneOuterAngle: 120,
        coneOuterGain: 0.2,
      }),
    }),
  };
  // The same places through the gain fallback and through a real equal-power PannerNode.
  r.fallback = [];
  for (const [position, more] of [
    [[2, 0, 0], {}],
    [[-3, 0, -4], {}],
    [[1.5, 0.5, -2], { refDistance: 0.5, rolloffFactor: 1.5 }],
    [[0, 0, 5], {}],
    [[3, 0, -1], { distanceModel: 'exponential', rolloffFactor: 0.8 }],
  ] as [number[], any][]) {
    const panner = await render({ play: spatial(position, { ...flat, ...more }) }),
      fallback = await render({ noPanner: true, play: spatial(position, { ...flat, ...more }) });
    r.fallback.push({ position, more, panner, fallback });
  }
  r.fallbackMoved = await render({
    noPanner: true,
    play: spatial([2, 0, -1], flat),
    moveTo: [-2, 0, -1],
  });
  r.plain = await render({ play: {} });
  out.spatial = r;
  out.sampleRate = RATE;
  out.ready = true;
}
main().catch((error) => {
  out.error = String(error?.stack || error);
});
