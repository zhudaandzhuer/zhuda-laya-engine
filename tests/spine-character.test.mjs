// ZhudaSpineCharacter: the LayaAir settings a hand-driven Spine 4.2 rig needs, the art-canvas
// conversions (with the skeleton offset LayaAir applies), bones, IK and attachments, refusals by
// name, disposal. A fake Laya and a fake spine-core skeleton; the real draw is the consumer's
// (docs/routes/spine-character.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZhudaSpineCharacter,
  zhudaSpineToCanvas,
  zhudaSpineFromCanvas,
  ZHUDA_SPINE_PHYSICS_UPDATE,
} from '../packages/core/SpineCharacter.ts';

// The bounds zhuda-spine2D writes for a 1024 x 1536 canvas with its origin at the bottom middle.
const BOUNDS = { x: -512, y: 0, width: 1024, height: 1536 };

class FakeBone {
  constructor(name, parent, x, y, length = 0) {
    Object.assign(this, { parent, x, y, data: { name, x, y, length } });
  }
  // Root at the skeleton's (sx, sy), children unrotated: world = parent world + local.
  world() {
    const p = this.parent ? this.parent.world() : { x: this.skeleton.x, y: this.skeleton.y };
    return { x: p.x + this.x, y: p.y + this.y };
  }
  localToWorld(v) {
    const w = this.world();
    v.x += w.x;
    v.y += w.y;
    return v;
  }
  worldToLocal(v) {
    const w = this.world();
    v.x -= w.x;
    v.y -= w.y;
    return v;
  }
}
function fakeSkeleton() {
  const sk = { x: -33.3, y: -30, data: { ...BOUNDS }, attachments: {}, set: [] };
  const root = new FakeBone('root', null, 0, 0);
  const pull = new FakeBone('pull_knee', root, -80, 760);
  const tip = new FakeBone('pleat4_3', root, 0, 1100, 150);
  for (const b of [root, pull, tip]) b.skeleton = sk;
  sk.bones = [root, pull, tip];
  sk.slots = [{ data: { name: 'tear_knee' } }];
  sk.ikConstraints = [{ data: { name: 'grab4_ik' }, mix: 0 }];
  sk.physicsConstraints = [{}, {}];
  sk.findBone = (n) => sk.bones.find((b) => b.data.name === n) ?? null;
  sk.findSlot = (n) => sk.slots.find((s) => s.data.name === n) ?? null;
  sk.findIkConstraint = (n) => sk.ikConstraints.find((c) => c.data.name === n) ?? null;
  sk.getAttachmentByName = (slot, name) =>
    slot === 'tear_knee' && /^tear_knee_(small|large)$/.test(name) ? { name } : null;
  sk.setAttachment = (slot, name) => sk.set.push([slot, name]);
  return sk;
}
class FakeRenderer {
  useFastRender = true;
  enableCache = true;
  physicsUpdate = 0;
  premultipliedAlpha = true;
  played = null;
  skeleton = fakeSkeleton();
  set templet(t) {
    this._templet = t;
    this.premultipliedAlpha = true; // LayaAir assumes premultiplied when a templet is applied
  }
  get templet() {
    return this._templet;
  }
  setPremultipliedAlpha(v) {
    this.premultipliedAlpha = v;
  }
  play(name, loop) {
    this.played = [name, loop];
  }
  getSkeleton() {
    return this.skeleton;
  }
}
class FakeSprite {
  parent = null;
  destroyed = false;
  scale = 0.5;
  addComponent(Type) {
    this.renderer = new Type();
    return this.renderer;
  }
  globalToLocal(p) {
    return { x: p.x / this.scale, y: p.y / this.scale };
  }
  destroy() {
    this.destroyed = true;
  }
}
class FakeParent {
  children = [];
  addChild(c) {
    c.parent = this;
    this.children.push(c);
    return c;
  }
}
const withLaya = (fn) => {
  const previous = globalThis.Laya;
  globalThis.Laya = {
    Sprite: FakeSprite,
    Spine2DRenderNode: FakeRenderer,
    Point: class {
      constructor(x, y) {
        Object.assign(this, { x, y });
      }
    },
  };
  try {
    return fn();
  } finally {
    globalThis.Laya = previous;
  }
};
// LayaAir's own guess said true for a pma:false atlas: the class must not take it.
const templet = { checkPremultipliedAlpha: () => true };

test('canvas and skeleton space convert both ways for a zhuda-spine2D rig', () => {
  assert.deepEqual(zhudaSpineFromCanvas(BOUNDS, 512, 1536), [0, 0]);
  assert.deepEqual(zhudaSpineFromCanvas(BOUNDS, 0, 0), [-512, 1536]);
  assert.deepEqual(zhudaSpineToCanvas(BOUNDS, -512, 1536), [0, 0]);
  for (const [x, y] of [
    [100, 200],
    [900.5, 1400.25],
  ]) {
    const [sx, sy] = zhudaSpineFromCanvas(BOUNDS, x, y);
    assert.deepEqual(zhudaSpineToCanvas(BOUNDS, sx, sy), [x, y]);
  }
});

test('the renderer is set up as a hand-driven rig needs (physics, slow path, straight alpha)', () =>
  withLaya(() => {
    const parent = new FakeParent();
    const c = new ZhudaSpineCharacter({ parent, templet, animation: 'idle' });
    assert.equal(parent.children[0], c.node);
    assert.equal(c.renderer.physicsUpdate, ZHUDA_SPINE_PHYSICS_UPDATE);
    assert.equal(c.renderer.useFastRender, false);
    assert.equal(c.renderer.enableCache, false);
    assert.equal(c.renderer.premultipliedAlpha, false);
    assert.deepEqual(c.renderer.played, ['idle', true]);
    assert.deepEqual(c.bounds, BOUNDS);
    // LayaAir flips these back later; update() puts them right again.
    c.renderer.premultipliedAlpha = true;
    c.renderer.physicsUpdate = 0;
    c.renderer.useFastRender = true;
    c.update();
    assert.deepEqual(
      [c.renderer.premultipliedAlpha, c.renderer.physicsUpdate, c.renderer.useFastRender],
      [false, 2, false],
    );
    const d = c.diagnostics();
    assert.deepEqual(d.skeletonOffset, [-33.3, -30]);
    assert.equal(d.physicsConstraints, 2);
    const off = new ZhudaSpineCharacter({
      parent,
      templet,
      physics: false,
      premultipliedAlpha: true,
    });
    assert.equal(off.renderer.physicsUpdate, 0);
    assert.equal(off.renderer.premultipliedAlpha, true);
  }));

test('bones are read and placed on the art canvas, with the skeleton offset LayaAir applies taken out', () =>
  withLaya(() => {
    const c = new ZhudaSpineCharacter({ parent: new FakeParent(), templet });
    // pleat4_3 starts at skeleton (0, 1100): canvas (512, 436); its tip 150 further along x.
    assert.deepEqual(
      c.boneCanvas('pleat4_3').map((v) => +v.toFixed(6)),
      [512, 436],
    );
    assert.deepEqual(
      c.boneTipCanvas('pleat4_3').map((v) => +v.toFixed(6)),
      [662, 436],
    );
    c.moveBoneTo('pull_knee', 400, 700);
    assert.deepEqual(
      c.boneCanvas('pull_knee').map((v) => +v.toFixed(6)),
      [400, 700],
    );
    c.nudgeBone('pull_knee', -20, 10);
    // From setup (-80, 760): 20 px left, 10 px down on the canvas (y up in the skeleton).
    assert.deepEqual(
      [c.skeleton.findBone('pull_knee').x, c.skeleton.findBone('pull_knee').y],
      [-100, 750],
    );
    assert.deepEqual(c.stageToCanvas(100, 50), [200, 100]);
  }));

test('IK mixes and attachments are set by name; unknown names and bad numbers are refused', () =>
  withLaya(() => {
    const c = new ZhudaSpineCharacter({ parent: new FakeParent(), templet });
    c.setIkMix('grab4_ik', 1.7);
    assert.equal(c.skeleton.ikConstraints[0].mix, 1);
    c.setAttachment('tear_knee', 'tear_knee_small');
    c.setAttachment('tear_knee', null);
    assert.deepEqual(c.skeleton.set, [
      ['tear_knee', 'tear_knee_small'],
      ['tear_knee', null],
    ]);
    assert.throws(
      () => c.setAttachment('tear_knee', 'tear_knee_huge'),
      /no attachment "tear_knee_huge"/,
    );
    assert.throws(() => c.setAttachment('lip_knee', null), /no slot "lip_knee"/);
    assert.throws(() => c.setIkMix('grab9_ik', 1), /no IK constraint "grab9_ik"/);
    assert.throws(() => c.boneCanvas('nope'), /no bone "nope"/);
    assert.throws(() => c.moveBoneTo('pull_knee', NaN, 0), /finite/);
  }));

test('it is refused without Laya Spine, a parent or a templet, and disposes once', () => {
  assert.throws(() => new ZhudaSpineCharacter({ parent: new FakeParent(), templet }), /spine42/);
  withLaya(() => {
    assert.throws(() => new ZhudaSpineCharacter({ parent: null, templet }), /parent/);
    assert.throws(
      () => new ZhudaSpineCharacter({ parent: new FakeParent(), templet: null }),
      /templet/,
    );
    const c = new ZhudaSpineCharacter({ parent: new FakeParent(), templet });
    c.dispose();
    c.dispose();
    assert.equal(c.node.destroyed, true);
    assert.throws(() => c.boneCanvas('root'), /disposed/);
    c.update();
  });
});
