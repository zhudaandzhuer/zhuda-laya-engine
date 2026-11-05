import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers/audio-fixture.mjs";

test("24-voice FIFO keeps BGM, waits for retirement and never exceeds physical capacity", async () => {
  const f = fixture({ maxActiveVoices: 24, voiceOverflow: "fifo" });
  await f.audio.loadSample("a.wav");
  f.audio.unlockAudio();
  const play = (id, extra = {}) =>
    f.audio.playSample({ id, sampleId: "a.wav", loop: true, ...extra });
  play("music", { channel: "bgm" });
  for (let i = 0; i < 23; i++) play("sfx" + i);
  assert.equal(f.audio.getDiagnostics().activeVoices, 24);
  const sources = f.context.sources.length;
  assert.equal(play("important"), true);
  assert.equal(f.context.sources.length, sources);
  assert.equal(f.audio.getDiagnostics().pendingAdmissions, 1);
  assert.equal(f.events.find((e) => e.type === "retiring").id, "sfx0");
  const victim = f.context.sources[2];
  assert.equal(victim.stopped.at(-1), 10.005);
  victim.end();
  assert.equal(f.audio.getDiagnostics().activeVoices, 24);
  assert.equal(f.audio.getDiagnostics().pendingAdmissions, 0);
  assert.equal(f.events.at(-1).id, "important");
  assert.equal(f.events.at(-1).type, "started");
  for (let i = 0; i < 40; i++) {
    assert.equal(play("burst" + i), true);
    const retiring = f.context.sources.find(
      (s) => s.stopped.length && !s.disconnected,
    );
    retiring.end();
    assert.equal(f.audio.getDiagnostics().activeVoices, 24);
  }
  assert.ok(!f.events.some((e) => e.type === "retiring" && e.id === "music"));
  f.audio.dispose();
  assert.equal(f.audio.getDiagnostics().activeVoices, 0);
});

test("priority rejects lower incoming voices, protects marked voices and clears queued retirement on stop", async () => {
  const f = fixture({ maxActiveVoices: 2, voiceOverflow: "priority" });
  await f.audio.loadSample("a.wav");
  f.audio.unlockAudio();
  const play = (id, priority, extra = {}) =>
    f.audio.playSample({
      id,
      sampleId: "a.wav",
      priority,
      loop: true,
      ...extra,
    });
  play("protected", 0, { protected: true });
  play("award", 10);
  assert.equal(play("weak", 1), false);
  assert.equal(f.events.at(-1).reason, "voice-capacity");
  assert.equal(play("big-award", 20), true);
  assert.equal(f.audio.getDiagnostics().pendingAdmissions, 1);
  f.audio.stop("big-award");
  f.context.sources.at(-1).end();
  assert.equal(f.audio.getDiagnostics().activeVoices, 1);
  assert.equal(f.audio.getDiagnostics().pendingAdmissions, 0);
  f.audio.dispose();
});
