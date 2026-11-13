// Scene advice and frame metrics: what a valid scene still gets wrong, and
// numbers for a frame nobody looked at. Pure checks.
import test from 'node:test';
import assert from 'node:assert/strict';
import { ZHUDA_FILM_LINT_RULES, lintZhudaFilmScene } from '../packages/core/film/FilmLint.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';
import { measureZhudaFrame } from '../packages/core/film/FrameMetrics.ts';

const tileMeters = { asphalt: [2, 2], concrete: [3, 3] };
const context = { props: ['container20'], recipes: ['asphalt', 'concrete'] };
// The camera looks toward -X and -Z; the sun comes from the side and ahead.
const good = () => ({
  schemaVersion: 1,
  id: 'good',
  camera: { eye: [16, 3.2, 21], target: [-2, 1.8, 0] },
  look: {
    preset: 'day',
    sun: { azimuthDeg: 160 },
    ambientGround: [0.26, 0.23, 0.2],
    grade: { bloom: 0.2 },
    lightFog: { density: 0.004 },
  },
  materials: { road: { recipe: 'asphalt', size: 1024, variation: 0.5 } },
  nodes: [
    { id: 'ground', type: 'ground', size: [80, 80], material: 'road' },
    { id: 'c1', type: 'prop', prop: 'container20', position: [0, 0, 0] },
  ],
});
const seen = new Set();
const lint = (scene) => {
  assert.deepEqual(validateZhudaFilmScene(scene, context), [], 'the fixture is a valid scene');
  const advice = lintZhudaFilmScene(scene, { tileMeters });
  for (const item of advice) seen.add(item.rule);
  return advice;
};
const rules = (scene) => lint(scene).map((item) => item.rule);
const change = (edit) => {
  const scene = good();
  edit(scene);
  return scene;
};

test('a scene on the quality route gets no advice', () => {
  assert.deepEqual(lint(good()), []);
});

test('the bare look and its missing parts are named with their fix', () => {
  const [plain] = lint(change((s) => (s.look = {})));
  assert.equal(plain.rule, 'look.plain');
  assert.equal(plain.level, 'warn');
  assert.match(plain.fix, /"preset": "day", "grade": \{\}/);
  // No look at all is the day preset: shadows and sky are there, the grade is not.
  const absent = rules(change((s) => delete s.look));
  assert.deepEqual(absent, ['look.no-grade', 'sun.behind-camera']);
  assert.deepEqual(rules(change((s) => (delete s.look.grade, delete s.look.lightFog))), [
    'look.no-grade',
  ]);
  // An atmosphere without a preset: not bare any more, but still no shadows.
  assert.deepEqual(
    rules(
      change((s) => {
        s.look = { atmosphere: {}, grade: {}, ambientGround: [0.2, 0.2, 0.2] };
      }),
    ),
    ['look.no-shadows'],
  );
  // Turned off on purpose: the author's decision, not a trap.
  assert.deepEqual(rules(change((s) => (s.look.shadows = false))), []);
});

test('fog far darker than the sky it meets is a dark band by day, not at night', () => {
  const dark = [0.02, 0.03, 0.05];
  const [band] = lint(change((s) => (s.look.lightFog.color = dark)));
  assert.equal(band.rule, 'lightFog.dark-horizon');
  assert.match(band.fix, /\[0\.64,0\.76,0\.89\]/);
  assert.deepEqual(
    rules(
      change((s) => {
        s.look = { preset: 'night', grade: {}, ambientGround: [0.03, 0.03, 0.04] };
        s.look.lightFog = { density: 0.02, color: dark };
        s.nodes.push({ id: 'spot', type: 'light', kind: 'spot', position: [0, 6, 6] });
        s.nodes.at(-1).target = [0, 0, 0];
        s.nodes.at(-1).castsShadow = true;
      }),
    ),
    [],
  );
});

test('a sun behind the camera is turned to the side', () => {
  // The day preset's sun (azimuth 40) travels the way this camera looks.
  const [flat] = lint(change((s) => delete s.look.sun));
  assert.equal(flat.rule, 'sun.behind-camera');
  assert.equal(flat.level, 'tip');
  assert.match(flat.fix, /"azimuthDeg": 161/);
  // Looking straight down, or with the sun overhead, there is nothing to turn.
  assert.deepEqual(
    rules(
      change((s) => {
        delete s.look.sun;
        s.camera = { eye: [0, 30, 0.5], target: [0, 0, 0] };
      }),
    ),
    [],
  );
  assert.deepEqual(rules(change((s) => (s.look.sun = { azimuthDeg: 40, elevationDeg: 80 }))), []);
});

test('flat ambient, unshadowed lamps and unlit emission are tips', () => {
  // The day preset gives ground light; `false` asks for one flat colour.
  assert.deepEqual(rules(change((s) => delete s.look.ambientGround)), []);
  const [ambient] = lint(change((s) => (s.look.ambientGround = false)));
  assert.equal(ambient.rule, 'ambient.flat');
  assert.match(ambient.fix, /"ambientGround": \[0\.46,0\.42,0\.35\]/);
  const night = (lights) =>
    change((s) => {
      s.look = { preset: 'night', grade: {}, ambientGround: [0.03, 0.03, 0.04] };
      s.nodes.push(...lights);
    });
  const point = { id: 'lamp', type: 'light', kind: 'point', position: [0, 4, 4] };
  const spot = { id: 'spot', type: 'light', kind: 'spot', position: [0, 6, 6], target: [0, 0, 0] };
  const [lamps] = lint(night([point]));
  assert.equal(lamps.rule, 'lights.unshadowed');
  assert.equal(lamps.path, 'scene.nodes[2]');
  assert.match(lamps.fix, /set "castsShadow": true on the lamp/);
  assert.deepEqual(rules(night([{ ...point, castsShadow: true }])), []);
  const [spots] = lint(night([point, spot]));
  assert.equal(spots.path, 'scene.nodes[3]');
  assert.match(spots.fix, /set "castsShadow": true on the spot/);
  assert.deepEqual(rules(night([point, { ...spot, castsShadow: true }])), []);
  // A coloured lamp this bright is drawn near-white: say so, and what keeps its colour.
  const [hot] = lint(
    change((s) => (s.materials.neon = { color: [1, 0.1, 0.05], emission: [6, 0.4, 0.1] })),
  );
  assert.equal(hot.rule, 'emission.washes-out');
  assert.equal(hot.level, 'tip');
  assert.match(hot.fix, /\[2,0\.13,0\.03\]/);
  assert.deepEqual(
    rules(change((s) => (s.materials.neon = { color: [1, 0.5, 0.2], emission: [8, 3.6, 1.2] }))),
    [],
  );
  // A lamp that only lights the fog is not a key light.
  assert.deepEqual(
    rules(
      change((s) => {
        s.look = { preset: 'night', grade: {}, ambientGround: [0.03, 0.03, 0.04] };
        s.look.lightFog = { density: 0.02 };
        s.nodes.push({ ...point, fogOnly: true });
      }),
    ),
    [],
  );
  assert.deepEqual(
    rules(
      change((s) => {
        s.look.grade.bloom = 0;
        s.materials.neon = { color: [1, 0.4, 0.2], emission: [6, 2, 1] };
      }),
    ),
    ['emission.no-bloom'],
  );
});

test('surfaces in the ground plane and coarse ground textures are caught', () => {
  const wet = (y) =>
    change((s) =>
      s.nodes.push({ id: 'wet', type: 'reflector', position: [0, y, 0], size: [9, 9] }),
    );
  const [plane] = lint(wet(0));
  assert.equal(plane.rule, 'surface.in-ground-plane');
  assert.equal(plane.level, 'warn');
  assert.match(plane.fix, /\[0, 0\.01, 0\]/);
  assert.deepEqual(rules(wet(0.01)), []);

  const [named] = lint(change((s) => (s.materials.road.size = 256)));
  assert.equal(named.rule, 'texture.density');
  assert.equal(named.path, 'scene.materials.road.size');
  assert.match(named.message, /128 pixels per metre/);
  assert.match(named.fix, /"size": 512/);
  const [bare] = lint(change((s) => (s.nodes[0].material = 'concrete')));
  assert.equal(bare.path, 'scene.nodes[0].material');
  assert.match(bare.fix, /"recipe": "concrete", "size": 1024/);
  // From high above the texels are not seen; without tile sizes nothing is judged.
  assert.deepEqual(
    rules(change((s) => ((s.materials.road.size = 256), (s.camera.eye = [16, 20, 21])))),
    [],
  );
  const coarse = change((s) => (s.materials.road.size = 256));
  assert.deepEqual(lintZhudaFilmScene(coarse), []);
  // Forty identical tiles across the ground read as a grid; a little variation hides it.
  const [grid] = lint(change((s) => delete s.materials.road.variation));
  assert.equal(grid.rule, 'texture.repeats');
  assert.equal(grid.path, 'scene.materials.road.variation');
  assert.match(grid.message, /repeats 40 times/);
  assert.match(grid.fix, /"variation": 0\.5/);
  assert.deepEqual(
    rules(change((s) => ((s.nodes[0].size = [20, 20]), delete s.materials.road.variation))),
    [],
  );
});

test('warnings come before tips and every rule is listed', () => {
  const advice = lint(
    change((s) => {
      s.look.ambientGround = false;
      s.look.lightFog.color = [0.02, 0.03, 0.05];
    }),
  );
  assert.deepEqual(
    advice.map((item) => item.level),
    ['warn', 'tip'],
  );
  for (const rule of seen) assert.ok(rule in ZHUDA_FILM_LINT_RULES, rule);
  assert.deepEqual([...seen].sort(), Object.keys(ZHUDA_FILM_LINT_RULES).sort());
});

const frame = (width, height, pixel) => {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) rgba.set([...pixel(x, y), 255], (y * width + x) * 4);
  return measureZhudaFrame(rgba, width, height);
};
const grey = (value) => [value, value, value];

test('frame metrics flag frames that lost their detail', () => {
  const mid = frame(16, 16, () => grey(128));
  assert.equal(mid.meanLuminance, 0.502);
  assert.deepEqual(mid.flags, ['low-contrast']);
  assert.deepEqual(frame(16, 16, () => grey(255)).flags, ['burnt-out', 'low-contrast']);
  assert.deepEqual(frame(16, 16, () => grey(0)).flags, ['underexposed', 'crushed', 'low-contrast']);
  const ramp = frame(64, 4, (x) => grey(x * 4));
  assert.deepEqual(ramp.flags, []);
  assert.deepEqual(ramp.luminance, { p05: 0.047, p50: 0.486, p95: 0.941 });
});

test('frame metrics tell a hard edge from an anti-aliased one', () => {
  const hard = frame(64, 64, (x) => grey(x < 32 ? 40 : 220));
  assert.equal(hard.hardEdgeShare, 1);
  assert.deepEqual(hard.flags, ['hard-edges']);
  // The same edge with one in-between pixel on each side.
  const smooth = frame(64, 64, (x) => grey(x < 31 ? 40 : x === 31 ? 60 : x === 32 ? 140 : 220));
  assert.equal(smooth.hardEdgeShare, 0);
  assert.deepEqual(smooth.flags, []);
});

test('frame metrics name the hues a frame holds', () => {
  const metrics = frame(40, 10, (x) => (x < 4 ? [10, 230, 20] : x < 6 ? [240, 120, 10] : grey(90)));
  assert.deepEqual(metrics.vivid, [
    { hue: 'orange', share: 0.05 },
    { hue: 'green', share: 0.1 },
  ]);
  assert.throws(() => measureZhudaFrame(new Uint8Array(15), 2, 2), /Frame metrics/);
});
