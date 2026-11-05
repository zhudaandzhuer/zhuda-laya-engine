import test from "node:test";
import assert from "node:assert/strict";
import { fixture, Context, deferred, flush } from "./helpers/audio-fixture.mjs";
class Offline extends Context {
  static instances = [];
  job = deferred();
  constructor(channels, frames, rate) {
    super();
    this.channels = channels;
    this.frames = frames;
    this.rate = rate;
    Offline.instances.push(this);
  }
  startRendering() {
    return this.job.promise;
  }
  finish() {
    this.job.resolve({
      getChannelData: () => new Float32Array(this.frames).fill(1.25),
    });
  }
}
const options = {
  durationSec: 1,
  sampleRate: 8000,
  channels: 1,
  cues: [
    {
      id: "bgm",
      sampleId: "a",
      atSec: 0,
      durationSec: 1,
      channel: "bgm",
      loop: true,
      fadeInSec: 0.2,
      fadeOutSec: 0.2,
    },
  ],
};
test("offline mix borrows samples/gains, bounds overlap, exports unclipped float WAV and never starts live voices", async () => {
  globalThis.OfflineAudioContext = Offline;
  const f = fixture({ maxActiveVoices: 1 });
  await f.audio.loadSample("a");
  f.audio.setChannelVolume("master", 0.5);
  f.audio.setChannelVolume("bgm", 0.25);
  const work = f.audio.renderOffline(options),
    context = Offline.instances.at(-1);
  assert.equal(context.gains[0].gain.value, 0.5);
  assert.equal(context.gains[1].gain.value, 0.25);
  assert.equal(context.sources.length, 1);
  assert.equal(f.context.sources.length, 0);
  assert.deepEqual(context.sources[0].started, [0, 0]);
  assert.equal(context.sources[0].loop, true);
  context.finish();
  const result = await work;
  assert.equal(result.peak, 1.25);
  assert.equal(result.overRangeSamples, 8000);
  assert.equal(new DataView(result.wav.buffer).getFloat32(44, true), 1.25);
  assert.ok(context.gains.every((g) => g.disconnected));
  await assert.rejects(
    f.audio.renderOffline({
      ...options,
      cues: [...options.cues, { ...options.cues[0], id: "second" }],
    }),
    /capacity/,
  );
  await assert.rejects(
    f.audio.renderOffline({ ...options, maxOutputBytes: 1 }),
    /budget/,
  );
  await assert.rejects(
    f.audio.renderOffline({
      ...options,
      cues: [options.cues[0], options.cues[0]],
    }),
    /Duplicate/,
  );
  f.audio.dispose();
});
test("offline timeout/disposal hold admission until uncancellable native render drains", async () => {
  globalThis.OfflineAudioContext = Offline;
  const f = fixture();
  await f.audio.loadSample("a");
  const work = f.audio.renderOffline({ ...options, timeoutMs: 5 }),
    context = Offline.instances.at(-1);
  await assert.rejects(work, (e) => e.name === "TimeoutError");
  await assert.rejects(f.audio.renderOffline(options), /busy/);
  assert.ok(context.gains.every((g) => !g.disconnected));
  context.finish();
  await flush();
  assert.ok(context.gains.every((g) => g.disconnected));
  const next = f.audio.renderOffline(options),
    second = Offline.instances.at(-1);
  f.audio.dispose();
  await assert.rejects(next, (e) => e.name === "AbortError");
  second.finish();
  await flush();
  assert.ok(second.gains.every((g) => g.disconnected));
});
