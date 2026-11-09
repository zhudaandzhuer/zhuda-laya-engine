import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaVideoSurface } from '../packages/core/VideoSurface.ts';

class FakeVideoNode {
  mode = 'decoder'; source = ''; autoPlay = false; loop = false; muted = true; allowBackground = false;
  readyState = 0; paused = true; ended = false; videoWidth = 1920; videoHeight = 1080; currentTime = 0; parent = null; destroyed = false;
  play() { this.paused = false; }
  pause() { this.paused = true; }
  destroy() { this.destroyed = true; this.parent = null; }
}
class FakeParent {
  children = [];
  addChild(child) { child.parent = this; this.children.push(child); return child; }
}

test('video surface uses a Laya VideoNode in decoder mode and owns disposal', async () => {
  const previous = globalThis.Laya;
  globalThis.Laya = {VideoNode: FakeVideoNode};
  try {
    const parent = new FakeParent();
    const surface = new ZhudaVideoSurface({parent, source: 'video/intro.webm', autoPlay: false, muted: true});
    assert.equal(parent.children.length, 1);
    assert.equal(surface.mode, 'decoder');
    assert.equal(surface.source, 'video/intro.webm');
    surface.play();
    assert.equal(surface.diagnostics().paused, false);
    surface.stop();
    assert.equal(surface.diagnostics().paused, true);
    surface.dispose();
    assert.throws(() => surface.play(), /disposed/);
  } finally {
    globalThis.Laya = previous;
  }
});

test('video surface fails explicitly when vendor VideoNode is unavailable', async () => {
  const previous = globalThis.Laya;
  globalThis.Laya = {};
  try {
    assert.throws(() => new ZhudaVideoSurface({parent: {addChild() {}}}), /VideoNode/);
  } finally {
    globalThis.Laya = previous;
  }
});
