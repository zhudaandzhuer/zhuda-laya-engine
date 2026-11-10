import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaWebViewSurface } from '../packages/core/WebViewSurface.ts';

class FakeSprite {
  parent = null;
  visible = true;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;
  destroyed = false;
  pos(x, y) {
    this.x = x;
    this.y = y;
  }
  size(width, height) {
    this.width = width;
    this.height = height;
  }
  destroy() {
    this.destroyed = true;
    this.parent = null;
  }
}
class FakeParent {
  addChild(child) {
    child.parent = this;
    return child;
  }
}

test('WebView surface keeps a platform adapter aligned to a Laya anchor', () => {
  const previous = globalThis.Laya;
  const calls = [];
  globalThis.Laya = { Sprite: FakeSprite };
  try {
    const adapter = {
      mount(options) {
        calls.push(['mount', options]);
      },
      update(options) {
        calls.push(['update', options]);
      },
      dispose() {
        calls.push(['dispose']);
      },
    };
    const surface = new ZhudaWebViewSurface({
      parent: new FakeParent(),
      adapter,
      url: 'https://example.test',
      frame: { x: 12, y: 20, width: 320, height: 180, rotation: 8, scaleX: 0.5 },
    });
    assert.equal(surface.anchor.x, 12);
    assert.equal(surface.anchor.width, 320);
    assert.equal(surface.anchor.rotation, 8);
    surface.setFrame({ x: 24, y: 30, width: 640, height: 360 });
    surface.setVisible(false);
    assert.equal(calls.at(-1)[1].visible, false);
    assert.equal(surface.diagnostics().attached, true);
    surface.dispose();
    assert.deepEqual(calls.at(-1), ['dispose']);
    assert.throws(() => surface.setUrl('x'), /disposed/);
  } finally {
    globalThis.Laya = previous;
  }
});
