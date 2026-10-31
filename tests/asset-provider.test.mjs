import test from "node:test";
import assert from "node:assert/strict";
import {
  AssetProviderError,
  DirectoryAssetProvider,
  createProviderAssetCache,
  normalizeAssetId,
  validateAssetManifest,
} from "../packages/core/runtime3d/index.ts";

test("asset IDs are portable logical paths", () => {
  assert.equal(normalizeAssetId(" ./vehicles\\s800.glb "), "vehicles/s800.glb");
  assert.throws(() => normalizeAssetId("../secret.dat"), (error) => error.code === "invalid-id");
  assert.throws(() => normalizeAssetId("https://cdn.example/game.dat"), (error) => error.code === "invalid-id");
  assert.throws(() => normalizeAssetId("ui/title.txt?cache=1"), (error) => error.code === "invalid-id");
  assert.throws(() => validateAssetManifest({ schemaVersion: 1, entries: [
    { id: "ui/title.txt" },
    { id: "ui/title.txt" },
  ] }), /Duplicate/);
});

test("directory provider reports progress and verifies a manifest", async () => {
  const source = new TextEncoder().encode("hello asset");
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", source))]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const progress = [];
  const provider = new DirectoryAssetProvider({
    baseUrl: "https://example.test/assets/",
    manifest: {
      schemaVersion: 1,
      entries: [{ id: "ui/title.txt", kind: "text", bytes: source.byteLength, sha256: digest }],
    },
    fetch: async (url, options) => {
      assert.equal(String(url), "https://example.test/assets/ui/title.txt");
      assert.ok(options.signal);
      return new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(source.slice(0, 5));
          controller.enqueue(source.slice(5));
          controller.close();
        },
      }), { status: 200, headers: { "content-length": String(source.byteLength) } });
    },
  });
  const result = await provider.load("./ui\\title.txt", {
    onProgress: (value) => progress.push(value),
  });
  assert.equal(new TextDecoder().decode(result.bytes), "hello asset");
  assert.equal(result.manifest?.kind, "text");
  assert.equal(progress.at(0).phase, "downloading");
  assert.equal(progress.at(-1).phase, "ready");
  provider.dispose();
  await assert.rejects(provider.load("ui/title.txt"), (error) => error.code === "disposed");
});

test("directory provider lazily loads and applies a remote manifest", async () => {
  const source = new TextEncoder().encode("packed later");
  let manifestLoads = 0;
  const provider = new DirectoryAssetProvider({
    baseUrl: "https://example.test/assets/",
    manifestUrl: "manifest.json",
    fetch: async (url) => {
      if (String(url).endsWith("/manifest.json")) {
        manifestLoads++;
        return new Response(JSON.stringify({
          schemaVersion: 1,
          entries: [{ id: "ui/title.txt", kind: "text", bytes: source.byteLength }],
        }), { status: 200 });
      }
      return new Response(source, { status: 200 });
    },
  });
  const result = await provider.load("ui/title.txt");
  assert.equal(result.manifest?.kind, "text");
  assert.equal(manifestLoads, 1);
});

test("directory provider rejects oversized responses and aborts stalled requests", async () => {
  const provider = new DirectoryAssetProvider({
    baseUrl: "https://example.test/assets/",
    maxBytes: 4,
    timeoutMs: 15,
    fetch: async (_url, { signal }) => {
      await new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      });
      throw new Error("unreachable");
    },
  });
  await assert.rejects(provider.load("large.bin"), (error) => error.code === "timeout");
  const oversized = new DirectoryAssetProvider({
    baseUrl: "https://example.test/assets/",
    maxBytes: 4,
    fetch: async () => new Response(new Uint8Array(5), { status: 200 }),
  });
  await assert.rejects(oversized.load("large.bin"), (error) => error.code === "too-large");
});

test("provider cache releases packed decoder leases after decoding", async () => {
  let released = 0;
  const cache = createProviderAssetCache(
    {
      name: "fixture-packed",
      load: async (id) => ({ id, bytes: new Uint8Array([7]), release: () => released++ }),
    },
    (asset) => asset.bytes[0],
    () => {},
  );
  const lease = await cache.acquire("effects/coin.bin");
  assert.equal(lease.value, 7);
  assert.equal(released, 1);
  lease.release();
  cache.dispose();
});
