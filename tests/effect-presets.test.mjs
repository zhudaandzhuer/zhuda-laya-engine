import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_EFFECT_SPRITES,
  ZHUDA_EFFECT_SPRITE_SIZES,
  bakeZhudaEffectSprite,
} from '../packages/core/effects/EffectSprites.ts';
import {
  ZHUDA_EFFECT_PRESETS_3D,
  ZHUDA_EFFECT_PRESET_IDS_3D,
  validateZhudaEffectPreset3D,
} from '../packages/core/effects/EffectPresets.ts';
import { scaleZhudaEffect3D } from '../packages/core/effects/Effect3D.ts';
import { ZhudaParticleSystem3D } from '../packages/core/particles/ParticleSystem3D.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';

test('built-in effect sprites are white shapes with their own alpha, the same every time', () => {
  for (const id of Object.keys(ZHUDA_EFFECT_SPRITES)) {
    const a = bakeZhudaEffectSprite(id, 64),
      b = bakeZhudaEffectSprite(id, 64);
    assert.equal(a.length, 64 * 64 * 4);
    assert.deepEqual(a, b, id);
    let opaque = 0,
      corners = 0;
    for (let i = 0; i < a.length; i += 4) {
      assert.equal(a[i] + a[i + 1] + a[i + 2], 765, `${id} is white`);
      if (a[i + 3] > 128) opaque++;
    }
    for (const [x, y] of [
      [0, 0],
      [63, 0],
      [0, 63],
      [63, 63],
    ])
      corners += a[(y * 64 + x) * 4 + 3];
    // Something is there, it does not fill the square, and its corners are clear
    // (a sprite that touched its border would show the quad's edge).
    assert.ok(opaque > 20 && opaque < 64 * 64 * 0.8, `${id}: ${opaque} opaque pixels`);
    assert.equal(corners, 0, `${id}: clear corners`);
  }
  assert.deepEqual([...ZHUDA_EFFECT_SPRITE_SIZES], [32, 64, 128, 256]);
  assert.throws(() => bakeZhudaEffectSprite('soft', 100), /size: use 32, 64, 128, 256/);
  assert.throws(
    () => bakeZhudaEffectSprite('nothing'),
    /Unknown effect sprite nothing; known: soft/,
  );
});

test('every effect preset is a valid 3D effect on built-in sprites and never runs out of particles', () => {
  assert.ok(ZHUDA_EFFECT_PRESET_IDS_3D.length >= 18);
  assert.deepEqual([...ZHUDA_EFFECT_PRESET_IDS_3D], Object.keys(ZHUDA_EFFECT_PRESETS_3D).sort());
  for (const [id, preset] of Object.entries(ZHUDA_EFFECT_PRESETS_3D)) {
    assert.deepEqual(validateZhudaEffectPreset3D(preset), [], id);
    assert.ok(preset.description.length > 20, id);
    let budget = 0;
    for (const emitter of preset.effect.emitters) {
      assert.ok(emitter.texture in ZHUDA_EFFECT_SPRITES, `${id}/${emitter.id}: ${emitter.texture}`);
      budget += emitter.maxParticles;
      // Run well past its settling time: the pool is large enough for its rate and lifetime.
      const system = new ZhudaParticleSystem3D(emitter);
      system.play();
      const steps = Math.round((preset.seconds + 6) * 120);
      let most = 0;
      for (let i = 0; i < steps; i++) {
        system.update(1 / 120);
        most = Math.max(most, system.aliveCount);
      }
      assert.equal(system.droppedParticles, 0, `${id}/${emitter.id} drops none`);
      assert.ok(most > 0, `${id}/${emitter.id} emits`);
      if (preset.kind === 'burst')
        assert.equal(system.aliveCount, 0, `${id}/${emitter.id}: a burst ends`);
    }
    // A phone's budget: no preset holds more than 1000 particles.
    assert.ok(budget <= 1000, `${id}: ${budget} particles at most`);
  }
});

test('a preset is scaled by its lengths and stepped the same from the same seed', () => {
  const fire = ZHUDA_EFFECT_PRESETS_3D.campfire.effect;
  const twice = scaleZhudaEffect3D(fire, 2);
  assert.deepEqual(
    twice.emitters[0].size,
    fire.emitters[0].size.map((n) => n * 2),
  );
  assert.deepEqual(
    twice.emitters[0].speed,
    fire.emitters[0].speed.map((n) => n * 2),
  );
  assert.equal(twice.emitters[0].shape.radius, fire.emitters[0].shape.radius * 2);
  assert.equal(twice.emitters[0].acceleration.y, fire.emitters[0].acceleration.y * 2);
  assert.deepEqual(twice.emitters[0].lifetime, fire.emitters[0].lifetime);
  assert.equal(twice.emitters[0].rate, fire.emitters[0].rate);
  assert.notEqual(scaleZhudaEffect3D(fire, 1), fire);
  assert.throws(() => scaleZhudaEffect3D(fire, 0), /scale: use 0\.05\.\.50/);
  const run = () => {
    const system = new ZhudaParticleSystem3D(fire.emitters[0]);
    system.play();
    for (let i = 0; i < 240; i++) system.update(1 / 120);
    return system.snapshot().map((p) => [p.x, p.y, p.z]);
  };
  assert.deepEqual(run(), run());
});

test('a film scene takes effect nodes: a known preset, a scale, a start, at most 32', () => {
  const scene = (nodes) => ({
    schemaVersion: 1,
    id: 'effect-node-check',
    camera: { eye: [0, 1, 6], target: [0, 1, 0], focalLengthMm: 35 },
    nodes,
  });
  const node = (extra) => ({
    id: 'fx',
    type: 'effect',
    preset: 'campfire',
    position: [0, 0, 0],
    ...extra,
  });
  const issues = (extra) => validateZhudaFilmScene(scene([node(extra)]));
  assert.deepEqual(issues({}), []);
  assert.deepEqual(issues({ yawDeg: 40, scale: 2, startSec: 3.5, seed: 4 }), []);
  assert.match(
    issues({ preset: 'bonfire' })[0],
    /preset: unknown effect bonfire; known: bubbles, campfire/,
  );
  assert.match(issues({ scale: 100 })[0], /scale: use 0\.05\.\.50/);
  assert.match(issues({ startSec: -1 })[0], /startSec: seconds of shot time from 0/);
  assert.match(issues({ seed: 1.5 })[0], /seed: a whole number from 0/);
  assert.match(issues({ colour: 'red' }).join(' '), /nodes\[0\]/);
  const many = Array.from({ length: 33 }, (_, i) => ({ ...node({}), id: 'fx' + i }));
  assert.match(validateZhudaFilmScene(scene(many)).join(' '), /at most 32 effect nodes/);
});
