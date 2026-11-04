import test from "node:test";
import assert from "node:assert/strict";
import { ZhudaPrefabLibrary, inspectPrefabInstance } from "../packages/core/prefabs/PrefabLibrary.ts";

class Sprite {
  children = [];
  name = "";
  destroyed = false;
  get numChildren() { return this.children.length; }
  getChildAt(i) { return this.children[i]; }
  addChild(node) { this.children.push(node); node.parent = this; return node; }
  destroy() { this.destroyed = true; }
}
const definition = { id: "panel", asset: "panel.lh", states: { short: {}, long: { value: { text: "123,456,789" } } } };
const data = { _$id: "panel", _$type: "Sprite", width: 240, height: 100,
  _$child: [{ _$id: "value", _$type: "Text", name: "value", text: "123", width: 200, height: 40 }] };
const bytes = () => new TextEncoder().encode(JSON.stringify(data));

test("prefab instances share source leases, preserve source data, expose provenance and release for 30 cycles", async () => {
  const previous = globalThis.Laya;
  globalThis.Laya = { Sprite, Text: Sprite };
  try {
    const provider = { name: "fixture", async load(id) { return { id, bytes: bytes() }; } };
    const library = new ZhudaPrefabLibrary({ provider, definitions: [definition] });
    for (let i = 0; i < 30; i++) {
      const a = await library.instantiate("panel", { state: "long" });
      const b = await library.instantiate("panel", { state: "short" });
      assert.equal(a.find("value").text, "123,456,789");
      assert.equal(b.find("value").text, "123");
      assert.equal(library.report().entries, 1);
      assert.equal(inspectPrefabInstance(new Sprite()), null);
      assert.match(inspectPrefabInstance(a.root).sources["panel.lh"], /^[a-f0-9]{64}$/);
      assert.throws(() => a.find("missing"), /node path/);
      a.dispose(); b.dispose();
      assert.equal(inspectPrefabInstance(a.root), null);
      assert.equal(library.report().references, 0);
      assert.equal(library.report().entries, 0);
    }
    await assert.rejects(library.instantiate("missing"), /Unknown prefab/);
    await assert.rejects(library.instantiate("panel", { state: "missing" }), /state/);
    library.dispose();
    await assert.rejects(library.instantiate("panel"), /Disposed/);
  } finally { globalThis.Laya = previous; }
});

test("prefab timeout, cancellation, late completion, disposal and malformed data release leases", async () => {
  const previous = globalThis.Laya;
  globalThis.Laya = { Sprite, Text: Sprite };
  try {
    let complete;
    const provider = { name: "late", load: id => new Promise(resolve => { complete = () => resolve({ id, bytes: bytes() }); }) };
    const library = new ZhudaPrefabLibrary({ provider, definitions: [definition], timeoutMs: 20 });
    await assert.rejects(library.instantiate("panel"), /cancelled/i);
    complete();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(library.report().instances, 0);
    const controller = new AbortController();
    const pending = library.instantiate("panel", { signal: controller.signal });
    controller.abort();
    await assert.rejects(pending, /cancelled/i);
    complete();
    const disposing = library.instantiate("panel");
    library.dispose();
    await assert.rejects(disposing, /cancelled/i);
    complete();
    const broken = new ZhudaPrefabLibrary({ provider: { name: "bad", async load(id) {
      return { id, bytes: new TextEncoder().encode("{") };
    } }, definitions: [definition] });
    await assert.rejects(broken.instantiate("panel"), /JSON/);
    assert.equal(broken.report().references, 0);
    broken.dispose();
  } finally { globalThis.Laya = previous; }
});

test("prefab DrawTextureCmd resolves declared logical texture IDs before hydration", async () => {
  const previous = globalThis.Laya;
  class Graphics {
    calls = [];
    clear() {}
    drawTexture(...args) { this.calls.push(args); }
  }
  class TextureSprite extends Sprite {
    graphics = new Graphics();
  }
  const hierarchy = {
    _$id: "capsule", _$type: "Sprite", width: 96, height: 28,
    _gcmds: [
      { _$type: "DrawTextureCmd", textureId: "ui/pill.png", x: 0, y: 0, width: 14, height: 28 },
      { _$type: "DrawTextureCmd", textureId: "ui/pill.png", x: 14, y: 0, width: 68, height: 28 },
      { _$type: "DrawTextureCmd", textureId: "ui/pill.png", x: 82, y: 0, width: 14, height: 28 },
    ],
  };
  globalThis.Laya = {
    Sprite: TextureSprite, Text: TextureSprite, Loader: { IMAGE: "image" },
    loader: {
      load: async () => ({}),
      getRes: url => ({ url }),
      clearRes: () => {},
    },
  };
  try {
    const provider = {
      name: "texture-fixture",
      async load(id) {
        return { id, bytes: new TextEncoder().encode(id === "panel.lh" ? JSON.stringify(hierarchy) : "png") };
      },
    };
    const library = new ZhudaPrefabLibrary({
      provider,
      definitions: [{ id: "capsule", asset: "panel.lh", textures: ["ui/pill.png"], states: { idle: {} } }],
    });
    const instance = await library.instantiate("capsule");
    assert.equal(instance.root.graphics.calls.length, 3);
    assert.match(instance.root.graphics.calls[0][0].url, /^blob:/);
    instance.dispose();
    library.dispose();
  } finally { globalThis.Laya = previous; }
});
