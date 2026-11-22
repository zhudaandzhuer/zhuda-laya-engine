import test from 'node:test';
import assert from 'node:assert/strict';
import { ZHUDA_EFFECT_SPRITES } from '../packages/core/effects/EffectSprites.ts';
import {
  ZHUDA_EFFECT_PRESETS_2D,
  ZHUDA_EFFECT_PRESET_IDS_2D,
  validateZhudaEffectPreset2D,
} from '../packages/core/effects/EffectPresets2D.ts';
import { ZhudaEffect2D, scaleZhudaEffect2D } from '../packages/core/effects/Effect2D.ts';
import { ZhudaParticleSystem } from '../packages/core/particles/ParticleSystem.ts';

/** A moving emitter's path for presets that emit along it: 600 pixels a second, back and forth. */
const trailX = (step) => 300 * Math.sin(step / 120);

test('every 2D preset is a valid effect on built-in sprites and never runs out of particles', () => {
  assert.ok(
    ZHUDA_EFFECT_PRESET_IDS_2D.length >= 16,
    `${ZHUDA_EFFECT_PRESET_IDS_2D.length} presets`,
  );
  assert.deepEqual([...ZHUDA_EFFECT_PRESET_IDS_2D], Object.keys(ZHUDA_EFFECT_PRESETS_2D).sort());
  for (const [id, preset] of Object.entries(ZHUDA_EFFECT_PRESETS_2D)) {
    assert.deepEqual(validateZhudaEffectPreset2D(preset), [], id);
    assert.ok(preset.description.length > 20, id);
    let budget = 0;
    for (const emitter of preset.effect.emitters) {
      assert.ok(emitter.texture in ZHUDA_EFFECT_SPRITES, `${id}/${emitter.id}: ${emitter.texture}`);
      budget += emitter.maxParticles;
      // Run well past its settling time: the pool is large enough for its rate and lifetime.
      const system = new ZhudaParticleSystem(emitter);
      system.setTransform(0, 0);
      system.play();
      const steps = Math.round((preset.seconds + 6) * 120);
      let most = 0;
      for (let i = 0; i < steps; i++) {
        if (emitter.rateOverDistance) system.setTransform(trailX(i), 0);
        system.update(1 / 120);
        most = Math.max(most, system.aliveCount);
      }
      assert.equal(system.droppedParticles, 0, `${id}/${emitter.id} drops none`);
      assert.ok(most > 0, `${id}/${emitter.id} emits`);
      if (preset.kind === 'burst') {
        assert.equal(system.emitting, false, `${id}/${emitter.id}: a burst stops emitting`);
        assert.equal(system.aliveCount, 0, `${id}/${emitter.id}: a burst ends`);
      }
    }
    // A phone's budget: no preset holds more than 1000 particles.
    assert.ok(budget <= 1000, `${id}: ${budget} particles at most`);
  }
});

test('a burst is over by its own seconds; a loop is still going then', () => {
  for (const [id, preset] of Object.entries(ZHUDA_EFFECT_PRESETS_2D)) {
    const systems = preset.effect.emitters.map((e) => {
      const s = new ZhudaParticleSystem(e);
      s.setTransform(0, 0);
      s.play();
      return s;
    });
    for (let i = 0; i < Math.round(preset.seconds * 120); i++)
      for (const s of systems) s.update(1 / 120);
    const alive = systems.reduce((n, s) => n + s.aliveCount, 0);
    if (preset.kind === 'burst')
      assert.equal(alive, 0, `${id}: nothing left at ${preset.seconds} s`);
    else assert.ok(alive > 0, `${id}: alive at ${preset.seconds} s`);
  }
});

test('a validator names what is wrong with a 2D preset of one own', () => {
  const base = ZHUDA_EFFECT_PRESETS_2D.sparkle;
  const issues = (change) => validateZhudaEffectPreset2D({ ...base, ...change });
  assert.deepEqual(issues({}), []);
  assert.ok(issues({ kind: 'once' }).includes('kind: loop or burst'));
  assert.ok(issues({ seconds: 0 }).includes('seconds: above 0'));
  assert.ok(issues({ sizePixels: [10] }).includes('sizePixels: [width, height] above 0'));
  assert.ok(issues({ origin: [0.5, 2] }).some((m) => m.startsWith('origin:')));
  assert.ok(issues({ effect: { schemaVersion: 1, emitters: [] } }).length);
});

test('a 2D effect is scaled by its lengths and stepped the same from the same seed', () => {
  const fire = ZHUDA_EFFECT_PRESETS_2D.campfire.effect;
  const twice = scaleZhudaEffect2D(fire, 2);
  assert.deepEqual(
    twice.emitters[0].size,
    fire.emitters[0].size.map((n) => n * 2),
  );
  assert.deepEqual(
    twice.emitters[0].speed,
    fire.emitters[0].speed.map((n) => n * 2),
  );
  assert.equal(twice.emitters[0].shape.width, fire.emitters[0].shape.width * 2);
  assert.equal(twice.emitters[0].acceleration.y, fire.emitters[0].acceleration.y * 2);
  assert.equal(twice.emitters[0].turbulence.strength, fire.emitters[0].turbulence.strength * 2);
  assert.deepEqual(twice.emitters[0].lifetime, fire.emitters[0].lifetime);
  assert.equal(twice.emitters[0].rate, fire.emitters[0].rate);
  const trail = ZHUDA_EFFECT_PRESETS_2D['sparkle-trail'].effect;
  assert.equal(
    scaleZhudaEffect2D(trail, 2).emitters[0].rateOverDistance,
    trail.emitters[0].rateOverDistance / 2,
  );
  const bounded = {
    schemaVersion: 1,
    emitters: [
      {
        ...fire.emitters[0],
        collision: { planes: [{ normal: { x: 0, y: -1 }, offset: -40 }], radius: 3 },
      },
    ],
  };
  const scaledPlane = scaleZhudaEffect2D(bounded, 3).emitters[0].collision;
  assert.equal(scaledPlane.planes[0].offset, -120);
  assert.equal(scaledPlane.radius, 9);
  assert.notEqual(scaleZhudaEffect2D(fire, 1), fire);
  assert.deepEqual(scaleZhudaEffect2D(fire, 1), fire);
  assert.throws(() => scaleZhudaEffect2D(fire, 0), /scale: use 0\.05\.\.50/);
  const run = () => {
    const system = new ZhudaParticleSystem(fire.emitters[0]);
    system.play();
    for (let i = 0; i < 240; i++) system.update(1 / 120);
    return system.snapshot().map((p) => [p.x, p.y, p.size]);
  };
  assert.deepEqual(run(), run());
});

/** A Laya stand-in: sprites that record what they draw, textures that record their release. */
function fakeLaya() {
  const made = { sprites: [], textures: [], bitmaps: [] };
  class Sprite {
    children = [];
    graphics = {
      calls: [],
      clear() {
        this.calls.length = 0;
      },
      drawTriangles(...args) {
        this.calls.push(args);
      },
    };
    constructor() {
      made.sprites.push(this);
    }
    addChild(child) {
      this.children.push(child);
      child.parent = this;
    }
    destroy(children) {
      this.destroyed = true;
      if (children) for (const c of this.children) c.destroy?.(true);
    }
  }
  class Texture2D {
    constructor(width, height, format, mipmap, canRead, srgb, premultiplied) {
      Object.assign(this, { width, height, format, mipmap, canRead, srgb, premultiplied });
      made.bitmaps.push(this);
    }
    setPixelsData(pixels, premultiply, invertY) {
      this.pixels = pixels;
      this.uploadFlags = [premultiply, invertY];
    }
    destroy() {
      this.destroyed = true;
    }
  }
  class Texture {
    constructor(bitmap) {
      this.bitmap = bitmap;
      made.textures.push(this);
    }
    destroy() {
      this.destroyed = true;
    }
  }
  return { Laya: { Sprite, Texture, Texture2D, TextureFormat: { R8G8B8A8: 1 } }, made };
}

test('ZhudaEffect2D owns its sprites and pictures, draws in the preset order and seeks exactly', () => {
  const { Laya, made } = fakeLaya();
  const previous = globalThis.Laya;
  globalThis.Laya = Laya;
  try {
    const parent = new Laya.Sprite();
    const fx = new ZhudaEffect2D(parent, 'explosion', { x: 200, y: 150, seed: 3 });
    // One container under the parent, one sprite per emitter under it, in order.
    assert.deepEqual(parent.children, [fx.node]);
    assert.deepEqual(
      fx.node.children.map((c) => c.name),
      ['flash', 'fire', 'debris', 'smoke'].map((id) => `Particles:${id}`),
    );
    // One picture per sprite the preset uses: premultiplied white, sRGB as Laya's own 2D pictures.
    assert.equal(made.textures.length, 3);
    for (const bitmap of made.bitmaps) {
      assert.equal(bitmap.width, 64);
      assert.equal(bitmap.premultiplied, true);
      assert.equal(bitmap.srgb, true);
      for (let i = 0; i < bitmap.pixels.length; i += 4)
        assert.equal(bitmap.pixels[i], bitmap.pixels[i + 3]);
    }
    assert.equal(
      fx.effect.emitters[0].seed,
      ZHUDA_EFFECT_PRESETS_2D.explosion.effect.emitters[0].seed + 3 * 7919,
    );
    const state = () => {
      fx.render();
      return fx.node.children.map((c) => c.graphics.calls.map((call) => [...call[3]]));
    };
    fx.seek(0.3);
    const first = state();
    assert.ok(fx.aliveCount > 0);
    assert.ok(
      first.some((calls) => calls.length),
      'something is drawn',
    );
    fx.seek(1.1);
    assert.notDeepEqual(state(), first);
    fx.seek(0.3);
    assert.deepEqual(state(), first, 'the same time is the same picture');
    assert.ok(Math.abs(fx.seconds - 0.3) < 1e-9);
    // A burst is over by its seconds, and a negative time is before it began.
    fx.seek(ZHUDA_EFFECT_PRESETS_2D.explosion.seconds);
    assert.equal(fx.aliveCount, 0);
    assert.equal(fx.emitting, false);
    fx.seek(-1);
    assert.equal(fx.aliveCount, 0);
    // update runs on from where it is; a stopped loop drains.
    const torch = new ZhudaEffect2D(parent, 'torch', { scale: 0.5 });
    for (let i = 0; i < 60; i++) torch.update(1 / 60);
    assert.ok(torch.aliveCount > 0 && Math.abs(torch.seconds - 1) < 1e-6);
    torch.stop();
    assert.equal(torch.emitting, false);
    for (let i = 0; i < 120; i++) torch.update(1 / 60);
    assert.equal(torch.aliveCount, 0);
    // A trail emits along the way it is moved.
    const trail = new ZhudaEffect2D(parent, 'sparkle-trail');
    trail.update(0.5);
    const still = trail.aliveCount;
    for (let i = 1; i <= 30; i++) {
      trail.setPosition(i * 20, 0);
      trail.update(1 / 60);
    }
    assert.ok(trail.aliveCount > still + 40, `${still} still, ${trail.aliveCount} moving`);
    // Release: its own sprites and pictures, never the parent.
    for (const effect of [fx, torch, trail]) effect.dispose();
    fx.dispose();
    assert.equal(parent.destroyed, undefined);
    assert.ok(made.sprites.filter((s) => s !== parent).every((s) => s.destroyed));
    assert.ok(made.textures.every((t) => t.destroyed) && made.bitmaps.every((b) => b.destroyed));
    fx.seek(0.5);
    fx.render();
    assert.equal(fx.aliveCount, 0);
  } finally {
    globalThis.Laya = previous;
  }
});

test('ZhudaEffect2D refuses what it cannot play before it makes anything', () => {
  const { Laya, made } = fakeLaya();
  const previous = globalThis.Laya;
  try {
    globalThis.Laya = undefined;
    assert.throws(() => new ZhudaEffect2D({ addChild() {} }, 'sparkle'), /Laya must be booted/);
    globalThis.Laya = Laya;
    const parent = new Laya.Sprite();
    assert.throws(
      () => new ZhudaEffect2D(parent, 'nothing'),
      /Unknown 2D effect preset nothing; known: bubbles/,
    );
    assert.throws(() => new ZhudaEffect2D(parent, 'sparkle', { seed: -1 }), /seed/);
    assert.throws(() => new ZhudaEffect2D(parent, 'sparkle', { spriteSize: 100 }), /sprite size/);
    assert.throws(() => new ZhudaEffect2D(parent, 'sparkle', { scale: 99 }), /scale/);
    assert.throws(() => new ZhudaEffect2D(parent, 'sparkle', { x: NaN }), /position/);
    assert.throws(() => new ZhudaEffect2D({}, 'sparkle'), /parent is a Laya Sprite/);
    const odd = structuredClone(ZHUDA_EFFECT_PRESETS_2D.sparkle);
    odd.effect.emitters[0].texture = 'my-texture';
    assert.throws(() => new ZhudaEffect2D(parent, odd), /not a built-in sprite/);
    assert.equal(parent.children.length, 0);
    assert.equal(made.textures.length, 0);
  } finally {
    globalThis.Laya = previous;
  }
});
