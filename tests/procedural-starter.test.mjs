import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_STARTER_TEXTURES,
  ZHUDA_STARTER_PROPS,
  ZHUDA_STARTER_SOUNDS,
} from '../packages/demo/ProceduralStarter.ts';
import {
  validateZhudaTextureRecipe,
  bakeZhudaTextureSet,
  fingerprintZhudaTextureSet,
  ZhudaPropRegistry,
  mergeZhudaPlacedProps,
  validateZhudaSynthRecipe,
  renderZhudaSynthWav,
  createZhudaRandom,
} from '../packages/core/procedural/index.ts';

test('starter texture recipes validate, bake and differ from one another', () => {
  const prints = new Set();
  for (const [key, recipe] of Object.entries(ZHUDA_STARTER_TEXTURES)) {
    assert.equal(recipe.id, key);
    assert.deepEqual(validateZhudaTextureRecipe(recipe), [], key);
    const set = bakeZhudaTextureSet(recipe, { size: 32 });
    assert.equal(set.albedo.length, 32 * 32 * 4);
    prints.add(fingerprintZhudaTextureSet(set));
  }
  assert.equal(prints.size, Object.keys(ZHUDA_STARTER_TEXTURES).length);
});

test('starter props fit their real-world sizes and a yard merges into one mesh per material', () => {
  const props = new ZhudaPropRegistry();
  for (const definition of ZHUDA_STARTER_PROPS) props.register(definition);
  assert.deepEqual(props.ids(), ['container20', 'jersey-barrier', 'pallet']);
  assert.deepEqual(props.sizeOf('container20'), [6.058, 2.591, 2.438]);
  for (const id of props.ids()) {
    const build = props.build(id, { seed: 1 });
    assert.ok(build.colliders.length >= 1 && build.colliders.every((c) => c.surface));
    for (const part of build.parts)
      assert.ok(Object.hasOwn(ZHUDA_STARTER_TEXTURES, part.material), `${id}/${part.name} uses a starter texture`);
  }
  const random = createZhudaRandom(4207),
    placed = [];
  for (let row = 0; row < 4; row++)
    for (let column = 0; column < 6; column++)
      placed.push(
        props.place('container20', {
          position: [column * 6.5, 0, row * 3],
          yawDeg: random.pick([0, 180]),
          seed: random.int(0, 9999),
        }),
      );
  for (let i = 0; i < 10; i++)
    placed.push(props.place('pallet', { position: [random.range(-20, -5), 0, random.range(0, 12)], yawDeg: random.range(0, 360) }));
  const batches = mergeZhudaPlacedProps(placed);
  assert.deepEqual(
    batches.map((batch) => [batch.material, batch.meshes.length]),
    [
      ['galvanized-steel', 1],
      ['painted-steel', 1],
      ['wood-planks', 1],
    ],
  );
  // 34 props with 92 source parts become three draws.
  assert.equal(placed.reduce((sum, prop) => sum + prop.parts.length, 0), 92);
  assert.ok(placed.flatMap((prop) => prop.colliders).length >= 34);
});

test('starter sounds validate and render to WAV', () => {
  for (const [key, recipe] of Object.entries(ZHUDA_STARTER_SOUNDS)) {
    assert.equal(recipe.id, key);
    assert.deepEqual(validateZhudaSynthRecipe(recipe), [], key);
    const wav = renderZhudaSynthWav(recipe);
    assert.equal(String.fromCharCode(...wav.subarray(0, 4)), 'RIFF');
    assert.ok(wav.length > 44 + 1000);
  }
});
