import type {
  IframeOfflineMixOptions,
  IframeOfflineMix,
  IframeOfflineCue,
} from '../../types/zhuda-audio.ts';
import type { IframeAudioChannel } from '../../types/zhuda-2d-ui.ts';

export interface OfflineMixSnapshot {
  samples: ReadonlyMap<string, AudioBuffer>;
  volumes: Readonly<Record<IframeAudioChannel, number>>;
  maxVoices: number;
}
/** Internal export graph. The calling mixer owns samples, policy and all gains. */
export async function renderOfflineMix(
  snapshot: OfflineMixSnapshot,
  options: IframeOfflineMixOptions,
  signal: AbortSignal,
): Promise<IframeOfflineMix> {
  const rate = options.sampleRate ?? 48000,
    channels = options.channels ?? 2,
    limit = options.maxOutputBytes ?? 256 * 1024 * 1024;
  const frames = Math.round(options.durationSec * rate);
  if (
    !Number.isInteger(rate) ||
    rate < 8000 ||
    rate > 192000 ||
    ![1, 2].includes(channels) ||
    !Number.isFinite(options.durationSec) ||
    options.durationSec <= 0 ||
    !Number.isSafeInteger(frames) ||
    frames < 1 ||
    Math.abs(frames - options.durationSec * rate) > 1e-6 ||
    !Number.isSafeInteger(limit) ||
    limit <= 0 ||
    frames * channels * 8 + 44 > limit ||
    frames * channels * 4 + 36 > 0xffffffff
  )
    throw Error('Invalid offline audio duration or PCM budget');
  if (!Array.isArray(options.cues) || options.cues.length > 100000)
    throw Error('Invalid offline audio cues');
  const ids = new Set<string>(),
    events: { time: number; delta: number }[] = [];
  const cues = options.cues.map((cue: IframeOfflineCue) => {
    if (!cue || typeof cue.id !== 'string' || !cue.id || ids.has(cue.id))
      throw Error('Duplicate or missing offline audio event id');
    ids.add(cue.id);
    const buffer = snapshot.samples.get(cue.sampleId);
    if (!buffer) throw Error('Offline sample is not loaded: ' + cue.sampleId);
    const c = {
      ...cue,
      channel: cue.channel ?? 'sfx',
      offsetSec: cue.offsetSec ?? 0,
      loopStartSec: cue.loopStartSec ?? 0,
      loopEndSec: cue.loopEndSec ?? buffer.duration,
      peakGain: cue.peakGain ?? 1,
      fadeInSec: cue.fadeInSec ?? 0,
      fadeOutSec: cue.fadeOutSec ?? 0,
    };
    if (
      !['master', 'bgm', 'sfx', 'ui'].includes(c.channel) ||
      ![
        c.atSec,
        c.durationSec,
        c.offsetSec,
        c.loopStartSec,
        c.loopEndSec,
        c.peakGain,
        c.fadeInSec,
        c.fadeOutSec,
      ].every(Number.isFinite) ||
      c.atSec < 0 ||
      c.durationSec <= 0 ||
      c.atSec + c.durationSec > options.durationSec + 1e-9 ||
      c.offsetSec < 0 ||
      c.offsetSec >= buffer.duration ||
      c.loopStartSec < 0 ||
      c.loopEndSec > buffer.duration ||
      c.loopEndSec <= c.loopStartSec ||
      c.peakGain < 0 ||
      c.peakGain > 4 ||
      c.fadeInSec < 0 ||
      c.fadeOutSec < 0 ||
      c.fadeInSec + c.fadeOutSec > c.durationSec ||
      (!c.loop && c.offsetSec + c.durationSec > buffer.duration + 1 / rate)
    )
      throw Error('Invalid offline audio cue: ' + c.id);
    events.push({ time: c.atSec, delta: 1 }, { time: c.atSec + c.durationSec, delta: -1 });
    return { cue: c, buffer };
  });
  let voices = 0;
  for (const event of events.sort((a, b) => a.time - b.time || a.delta - b.delta))
    if ((voices += event.delta) > snapshot.maxVoices)
      throw Error('Offline audio voice capacity exceeded');
  if (signal.aborted) throw signal.reason;
  if (typeof globalThis.OfflineAudioContext !== 'function')
    throw Error('OfflineAudioContext unavailable');
  const context = new OfflineAudioContext(channels, frames, rate),
    nodes: AudioNode[] = [],
    sources: AudioBufferSourceNode[] = [];
  try {
    const master = context.createGain();
    master.gain.value = snapshot.volumes.master;
    master.connect(context.destination);
    nodes.push(master);
    const buses = new Map<IframeAudioChannel, GainNode>([['master', master]]);
    for (const channel of ['bgm', 'sfx', 'ui'] as const) {
      const gain = context.createGain();
      gain.gain.value = snapshot.volumes[channel];
      gain.connect(master);
      buses.set(channel, gain);
      nodes.push(gain);
    }
    for (const { cue: c, buffer } of cues) {
      const source = context.createBufferSource(),
        gain = context.createGain();
      sources.push(source);
      nodes.push(source, gain);
      source.buffer = buffer;
      source.loop = c.loop ?? false;
      source.loopStart = c.loopStartSec;
      source.loopEnd = c.loopEndSec;
      gain.gain.setValueAtTime(c.fadeInSec ? 0 : c.peakGain, c.atSec);
      if (c.fadeInSec) gain.gain.linearRampToValueAtTime(c.peakGain, c.atSec + c.fadeInSec);
      if (c.fadeOutSec) {
        gain.gain.setValueAtTime(c.peakGain, c.atSec + c.durationSec - c.fadeOutSec);
        gain.gain.linearRampToValueAtTime(0, c.atSec + c.durationSec);
      }
      source.connect(gain);
      gain.connect(buses.get(c.channel)!);
      source.start(c.atSec, c.offsetSec);
      source.stop(c.atSec + c.durationSec);
    }
    // OfflineAudioContext cannot cancel native rendering. Keep this promise and
    // its graph alive until it drains; the owner separately bounds caller wait.
    const rendered = await context.startRendering();
    if (signal.aborted) throw signal.reason;
    const wav = new Uint8Array(44 + frames * channels * 4),
      view = new DataView(wav.buffer),
      write = (offset: number, text: string) => {
        for (let i = 0; i < text.length; i++) wav[offset + i] = text.charCodeAt(i);
      };
    write(0, 'RIFF');
    view.setUint32(4, wav.length - 8, true);
    write(8, 'WAVE');
    write(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 3, true);
    view.setUint16(22, channels, true);
    view.setUint32(24, rate, true);
    view.setUint32(28, rate * channels * 4, true);
    view.setUint16(32, channels * 4, true);
    view.setUint16(34, 32, true);
    write(36, 'data');
    view.setUint32(40, wav.length - 44, true);
    const data = Array.from({ length: channels }, (_, i) => rendered.getChannelData(i));
    let peak = 0,
      overRangeSamples = 0;
    for (let i = 0; i < frames; i++)
      for (let c = 0; c < channels; c++) {
        const value = data[c][i];
        if (!Number.isFinite(value)) throw Error('Nonfinite offline sample');
        peak = Math.max(peak, Math.abs(value));
        if (Math.abs(value) > 1) overRangeSamples++;
        view.setFloat32(44 + (i * channels + c) * 4, value, true);
      }
    return {
      sampleRate: rate,
      channels,
      frames,
      durationSec: frames / rate,
      format: 'wav-f32',
      peak,
      overRangeSamples,
      wav,
    };
  } finally {
    for (const source of sources) {
      try {
        source.stop();
      } catch {}
    }
    for (const node of nodes) node.disconnect();
  }
}
