import test from "node:test";
import assert from "node:assert/strict";
import {
  fixture,
  flush,
  deferred,
  Gain,
  Source,
  Media,
} from "./helpers/audio-fixture.mjs";
import { DirectoryAssetProvider } from "../packages/core/runtime3d/AssetProvider.ts";
import crypto from "node:crypto";

test("stream voices use one mixer, pause with focus, switch only after play, and release over 30 cycles", async () => {
  const f = fixture();
  f.audio.unlockAudio("test");
  for (let i = 0; i < 30; i++) {
    const [a, b] = await Promise.all([
      f.audio.loadStream("long.mp3"),
      f.audio.loadStream("long.mp3"),
    ]);
    assert.deepEqual(a, b);
    assert.equal(a.retainedBytes, 0);
    assert.equal(
      f.audio.playStream({
        id: "music",
        streamId: a.id,
        loop: true,
        peakGain: 0.4,
      }),
      true,
    );
    await flush();
    const m = f.media.at(-1),
      node = f.context.mediaSources.at(-1),
      gain = node.connections[0];
    assert.equal(m.loop, true);
    assert.equal(m.volume, 1);
    assert.equal(gain.gain.value, 0.4);
    assert.equal(gain.connections[0], f.context.gains[1]);
    f.audio.handleFocusOrVisibilityChange(false, false);
    assert.equal(m.paused, true);
    f.audio.handleFocusOrVisibilityChange(true, true);
    await flush();
    assert.equal(m.paused, false);
    f.audio.setMuted(true);
    assert.equal(f.context.gains[0].gain.value, 0);
    f.audio.setMuted(false);
    f.audio.unloadStream(a.id);
    assert.equal(m.src, "");
    assert.equal(node.disconnected, true);
    assert.equal(f.audio.getDiagnostics().activeVoices, 0);
  }
  assert.equal(f.context.decodes, 0);
  assert.deepEqual(f.counts(), { opens: 30, releases: 30 });
  f.audio.dispose();
  assert.equal(f.context.state, "closed");
});

test("stream crossfade preserves old music on async play rejection and accounts overlap", async () => {
  const f = fixture();
  await f.audio.loadStream("music.mp3");
  f.audio.unlockAudio();
  f.audio.playStream({ id: "music", streamId: "music.mp3", loop: true });
  await flush();
  const old = f.media[0];
  const bad = new Media();
  bad.result = Promise.reject(Error("blocked"));
  bad.result.catch(() => {});
  f.audio.options.mediaElementFactory = () => bad;
  f.audio.playStream({
    id: "music",
    streamId: "music.mp3",
    replace: true,
    crossFadeSec: 0.2,
  });
  await flush();
  assert.equal(old.paused, false);
  assert.equal(f.audio.getDiagnostics().activeVoices, 1);
  assert.equal(bad.src, "");
  const good = new Media();
  f.audio.options.mediaElementFactory = () => good;
  f.audio.playStream({
    id: "music",
    streamId: "music.mp3",
    replace: true,
    crossFadeSec: 0.2,
  });
  await flush();
  assert.equal(f.audio.getDiagnostics().activeVoices, 2);
  f.context.sources.at(-1).end();
  assert.equal(f.audio.getDiagnostics().activeVoices, 1);
  assert.equal(old.src, "");
  f.audio.dispose();
});

test("stream cancellation, deadline and late leases cannot reattach after disposal", async () => {
  for (const mode of ["abort", "timeout", "dispose"]) {
    const f = fixture({ sampleTimeoutMs: 10 }),
      d = deferred();
    let released = 0;
    f.provider.openStream = () => d.promise;
    const controller = new AbortController(),
      load = f.audio.loadStream("slow.mp3", { signal: controller.signal });
    const rejected = assert.rejects(load, /cancel|timeout/i);
    if (mode === "abort") controller.abort();
    else if (mode === "dispose") f.audio.dispose();
    await rejected;
    d.resolve({
      id: "slow.mp3",
      url: "https://fixture.test/slow",
      delivery: "native",
      integrity: "transport",
      retainedBytes: 0,
      release() {
        released++;
      },
    });
    await flush();
    assert.equal(released, 1);
    assert.equal(f.audio.getDiagnostics().loadedStreams, 0);
    f.audio.dispose();
  }
});

test("native provider refuses SHA bypass; verified blob checks bytes and revokes its lease", async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const manifest = {
    schemaVersion: 1,
    entries: [
      {
        id: "tone.mp3",
        kind: "audio",
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      },
    ],
  };
  const native = new DirectoryAssetProvider({
    baseUrl: "https://fixture.test/",
    manifest,
    streamMode: "native",
  });
  await assert.rejects(native.openStream("tone.mp3"), /cannot verify/);
  native.dispose();
  const provider = new DirectoryAssetProvider({
    baseUrl: "https://fixture.test/",
    manifest,
    fetch: async () => new Response(bytes),
  });
  const lease = await provider.openStream("tone.mp3");
  assert.equal(lease.retainedBytes, 3);
  assert.equal(lease.integrity, "sha256");
  assert.deepEqual(
    new Uint8Array(await (await fetch(lease.url)).arrayBuffer()),
    bytes,
  );
  lease.release();
  lease.release();
  await assert.rejects(fetch(lease.url));
  provider.dispose();
  const controller = new AbortController();
  controller.abort();
  const p = new DirectoryAssetProvider({ baseUrl: "https://fixture.test/" });
  await assert.rejects(
    p.openStream("x", { signal: controller.signal }),
    /cancel/,
  );
  p.dispose();
});

test("sample backend owns no mixer and cancelled/late preparation is disposed", async () => {
  const f = fixture(),
    d = deferred();
  let releases = 0;
  const backend = {
    name: "test-worklet",
    prepare: () => d.promise,
    createVoice() {
      throw Error("not ready");
    },
    dispose() {
      releases++;
    },
  };
  const c = new AbortController(),
    ready = f.audio.prepareSampleBackend(backend, { signal: c.signal });
  await flush();
  c.abort();
  await assert.rejects(ready);
  d.resolve();
  await flush();
  assert.ok(releases >= 1);
  assert.equal(f.audio.getDiagnostics().sampleBackend, "native");
  const node = new Gain(),
    voice = {
      output: node,
      onended: null,
      start() {},
      stop() {},
      disconnect() {
        node.disconnect();
      },
    };
  const good = {
    name: "worklet-contract",
    async prepare({ context, provider }) {
      assert.equal(context, f.context);
      assert.equal(provider, f.provider);
    },
    createVoice() {
      return voice;
    },
    dispose() {},
  };
  await f.audio.prepareSampleBackend(good);
  await f.audio.loadSample("shot.wav");
  f.audio.unlockAudio();
  assert.equal(
    f.audio.playSample({
      id: "shot",
      sampleId: "shot.wav",
      channel: "sfx",
      peakGain: 0.3,
    }),
    true,
  );
  assert.equal(node.connections[0].gain.value, 0.3);
  assert.equal(node.connections[0].connections[0], f.context.gains[2]);
  f.audio.dispose();
  assert.equal(node.disconnected, true);
});

test("stream play timeout and late completion after unload release all media nodes", async () => {
  const d = deferred(),
    m = new Media();
  m.result = d.promise;
  const f = fixture({ sampleTimeoutMs: 10, mediaElementFactory: () => m });
  await f.audio.loadStream("tone.wav");
  f.audio.unlockAudio();
  f.audio.playStream({ id: "timeout", streamId: "tone.wav" });
  await new Promise((r) => setTimeout(r, 25));
  assert.equal(f.audio.getDiagnostics().activeVoices, 0);
  assert.match(f.audio.getDiagnostics().lastError, /timeout/);
  assert.equal(m.src, "");
  d.resolve();
  await flush();
  assert.equal(f.audio.getDiagnostics().activeVoices, 0);
  assert.ok(!f.events.some((e) => e.type === "started"));
  f.audio.dispose();
});

test("backend preparation failure/deadline is explicit and closed backend context cannot silently switch authority", async () => {
  for (const mode of ["error", "timeout"]) {
    const f = fixture({ sampleTimeoutMs: 10 });
    let disposed = 0;
    const b = {
      name: "failure",
      prepare: () =>
        mode === "error"
          ? Promise.reject(Error("unsupported"))
          : new Promise(() => {}),
      createVoice() {
        throw Error("unreachable");
      },
      dispose() {
        disposed++;
      },
    };
    await assert.rejects(
      f.audio.prepareSampleBackend(b),
      mode === "error" ? /unsupported/ : /timeout/,
    );
    assert.equal(disposed, 1);
    f.audio.dispose();
  }
  const f = fixture();
  const backend = {
    name: "owned",
    async prepare() {},
    createVoice() {
      throw Error("unreachable");
    },
    dispose() {},
  };
  await f.audio.prepareSampleBackend(backend);
  await f.audio.loadSample("tone.wav");
  f.audio.unlockAudio();
  f.context.state = "closed";
  assert.equal(
    f.audio.playSample({ id: "closed", sampleId: "tone.wav" }),
    false,
  );
  assert.equal(f.audio.unlockAudio(), false);
  f.audio.dispose();
});

test('encoded stream budget is independent of sample PCM and releases rejected leases', async () => {
  const f = fixture({maxRetainedStreamBytes:3, maxDecodedSampleBytes:192000});
  let released=0;
  f.provider.openStream=async id=>({id,url:'https://fixture.test/'+id,delivery:'verified-blob',integrity:'sha256',retainedBytes:3,release(){released++;}});
  await f.audio.loadSample('short.wav');
  await f.audio.loadStream('first.mp3');
  await assert.rejects(f.audio.loadStream('second.mp3'),/byte bound/);
  assert.equal(f.audio.getDiagnostics().decodedSampleBytes,192000);
  assert.equal(f.audio.getDiagnostics().retainedStreamBytes,3);
  assert.equal(released,1);
  f.audio.unloadStream('first.mp3');
  await f.audio.loadStream('second.mp3');
  f.audio.dispose();
  assert.equal(released,3);
});
