import test from "node:test";
import assert from "node:assert/strict";
import { ZhudaModelDecoderRegistry } from "../packages/core/runtime3d/index.ts";

const descriptor = { format: "meshopt", name: "fixture-meshopt", version: "1.0.0", integritySha256: "ab".repeat(32) };

test("decoder registry pins adapters and releases payloads exactly once", async () => {
  let released = 0;
  let disposed = 0;
  const registry = new ZhudaModelDecoderRegistry({ timeoutMs: 50, maxInputBytes: 4 });
  const unregister = registry.register({ descriptor, async decode({ assetId }) { return { assetId, format: "meshopt", data: new Uint8Array([1, 2]), byteLength: 2, release: () => released++ }; }, dispose: () => disposed++ });
  assert.equal(registry.has("meshopt"), true);
  const payload = await registry.decode("meshopt", "scene/model.glb", new Uint8Array([1, 2]));
  payload.release(); payload.release(); assert.equal(released, 1);
  unregister(); assert.equal(disposed, 1); assert.equal(registry.has("meshopt"), false);
  registry.dispose();
});

test("decoder registry bounds input and rejects unregistered formats", async () => {
  const registry = new ZhudaModelDecoderRegistry({ maxInputBytes: 2 });
  await assert.rejects(registry.decode("draco", "model.glb", new Uint8Array([1])), error => error.code === "unsupported");
  assert.throws(() => registry.register({ descriptor: { ...descriptor, integritySha256: "bad" }, decode: async () => { throw Error("unreachable"); } }), error => error.code === "invalid-adapter");
  registry.register({ descriptor, decode: async ({ assetId }) => ({ assetId, format: "meshopt", data: null, byteLength: 0, release() {} }) });
  await assert.rejects(registry.decode("meshopt", "large", new Uint8Array([1, 2, 3])), error => error.code === "invalid-input");
  registry.dispose();
});

test("decoder registry releases a late result after timeout and reports cancellation", async () => {
  let released = 0;
  const registry = new ZhudaModelDecoderRegistry({ timeoutMs: 10 });
  registry.register({ descriptor, decode: async ({ signal, assetId }) => {
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(signal.aborted, true);
    return { assetId, format: "meshopt", data: new Uint8Array(), byteLength: 0, release: () => released++ };
  } });
  await assert.rejects(registry.decode("meshopt", "late", new Uint8Array()), error => error.code === "timeout");
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(released, 1);
  registry.dispose();
});
