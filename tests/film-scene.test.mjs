import test from 'node:test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {
  validateZhudaFilmScene,
  parseZhudaFilmScene,
  applyZhudaFilmScenePatch,
  resolveZhudaFilmCamera,
  resolveZhudaFilmLook,
  validateZhudaFilmCameraPath,
  sampleZhudaFilmCameraPath,
} from '../packages/core/film/FilmScene.ts';
import {
  ZhudaFilmSessions,
  ZHUDA_FILM_HOST_CONTEXT,
} from '../packages/mcp-server/film-session.mjs';
import { handleJsonRpcMessage, MCP_TOOLS_MANIFEST } from '../packages/mcp-server/index.mjs';

const context = { props: ['container20', 'pallet'], recipes: ['asphalt', 'painted-steel'] };
const scene = () => ({
  schemaVersion: 1,
  id: 'yard',
  camera: { eye: [10, 5, 12], target: [0, 1, 0] },
  materials: {
    red: { recipe: 'painted-steel', tint: [0.8, 0.2, 0.2, 1] },
    grey: { color: [0.5, 0.5, 0.5] },
  },
  nodes: [
    { id: 'ground', type: 'ground', size: [40, 40], material: 'asphalt' },
    { id: 'c1', type: 'prop', prop: 'container20', position: [0, 0, 0], seed: 1 },
    { id: 'wall', type: 'box', size: [4, 2, 0.3], position: [0, 0, 6], material: 'grey' },
  ],
});

test('a valid film scene passes and every problem has a path', () => {
  assert.deepEqual(validateZhudaFilmScene(scene(), context), []);
  const bad = scene();
  bad.schemaVersion = 2;
  bad.camera = { eye: [1, 1, 1], target: [1, 1, 1], fStop: 0.1 };
  bad.look = { sky: [2, 0, 0], sun: { azimuthDeg: 0, elevationDeg: 120 } };
  bad.nodes.push(
    { id: 'c1', type: 'prop', prop: 'rocket', position: [0, 0, 0] },
    { id: 'Bad Id', type: 'box', size: [1, -1, 1], position: [0, 0, 0], material: 'missing' },
    {
      id: 'evil',
      type: 'box',
      size: [1, 1, 1],
      position: [0, 0, 0],
      material: 'grey',
      onLoad: 'alert(1)',
    },
    { id: 'far', type: 'ground', size: [1e9, 1], material: 'grey' },
  );
  const issues = validateZhudaFilmScene(bad, context);
  for (const fragment of [
    'scene.schemaVersion',
    'scene.camera: eye and target must differ',
    'scene.camera.fStop',
    'scene.look.sky',
    'scene.look.sun.elevationDeg',
    'unknown prop rocket',
    'duplicate c1',
    'scene.nodes[4].id',
    'scene.nodes[4].size: every side must be positive',
    'scene.nodes[4].material',
    'scene.nodes[5].onLoad: unknown field',
    'scene.nodes[6].size',
  ])
    assert.ok(
      issues.some((issue) => issue.includes(fragment)),
      `missing ${fragment} in\n${issues.join('\n')}`,
    );
  assert.throws(() => parseZhudaFilmScene(bad, context), /Invalid film scene/);
  assert.deepEqual(validateZhudaFilmScene(null), ['scene: object required']);
});

test('patches are atomic: the input is untouched and an invalid result throws', () => {
  const original = parseZhudaFilmScene(scene(), context);
  const frozen = JSON.stringify(original);
  const next = applyZhudaFilmScenePatch(
    original,
    {
      camera: { focalLengthMm: 50 },
      look: { sun: { azimuthDeg: 10, elevationDeg: 20 } },
      materials: { grey: null, blue: { color: [0.1, 0.2, 0.9] } },
      remove: ['wall'],
      upsert: [
        { id: 'c1', type: 'prop', prop: 'container20', position: [2, 0, 0], yawDeg: 90 },
        { id: 'p1', type: 'prop', prop: 'pallet', position: [4, 0, 0] },
      ],
    },
    context,
  );
  assert.equal(JSON.stringify(original), frozen, 'input scene unchanged');
  assert.equal(next.camera.focalLengthMm, 50);
  assert.deepEqual(next.camera.eye, [10, 5, 12]);
  assert.deepEqual(
    next.nodes.map((n) => n.id),
    ['ground', 'c1', 'p1'],
  );
  assert.deepEqual(next.nodes[1].position, [2, 0, 0]);
  assert.equal(next.materials.grey, undefined);
  // Removing a material still in use fails as a whole.
  assert.throws(
    () => applyZhudaFilmScenePatch(original, { materials: { grey: null } }, context),
    /must name a scene material|known recipe/,
  );
  assert.throws(
    () => applyZhudaFilmScenePatch(original, { remove: ['nope'] }, context),
    /unknown node nope/,
  );
  assert.throws(
    () => applyZhudaFilmScenePatch(original, { delete: ['c1'] }, context),
    /unknown field/,
  );
  assert.equal(JSON.stringify(original), frozen);
});

test('defaults and camera paths are explicit and eased', () => {
  const camera = resolveZhudaFilmCamera({ eye: [0, 0, 10], target: [0, 0, 0] });
  assert.deepEqual(camera, {
    eye: [0, 0, 10],
    target: [0, 0, 0],
    focalLengthMm: 35,
    fStop: 8,
    focusDistanceM: 10,
  });
  assert.equal(resolveZhudaFilmLook().sun.elevationDeg, 40);
  const keys = [
    { time: 0, camera: { eye: [0, 0, 10], target: [0, 0, 0] } },
    { time: 2, camera: { eye: [10, 0, 10], target: [0, 0, 0], focalLengthMm: 85 } },
  ];
  assert.deepEqual(validateZhudaFilmCameraPath(keys), []);
  assert.deepEqual(sampleZhudaFilmCameraPath(keys, -1).eye, [0, 0, 10]);
  assert.deepEqual(sampleZhudaFilmCameraPath(keys, 5).eye, [10, 0, 10]);
  const middle = sampleZhudaFilmCameraPath(keys, 1);
  assert.equal(middle.eye[0], 5);
  assert.equal(middle.focalLengthMm, 60);
  // Ease in: a quarter of the time covers less than a quarter of the move.
  assert.ok(sampleZhudaFilmCameraPath(keys, 0.5).eye[0] < 2.5);
  assert.match(validateZhudaFilmCameraPath([keys[0]]).join(), /2\.\.256 keys/);
  assert.match(validateZhudaFilmCameraPath([{ ...keys[0], time: 1 }, keys[1]]).join(), /must be 0/);
  assert.match(
    validateZhudaFilmCameraPath([keys[0], { ...keys[1], time: 0 }]).join(),
    /must increase/,
  );
});

test('sessions apply changes under revision checks and keep state on failure', () => {
  const sessions = new ZhudaFilmSessions({ maxSessions: 2 });
  const created = sessions.create(scene());
  assert.equal(created.revision, 0);
  assert.throws(
    () => sessions.apply(created.sessionId, undefined, {}),
    /expectedRevision is required/,
  );
  assert.throws(() => sessions.apply(created.sessionId, 3, {}), /Stale revision/);
  assert.throws(
    () =>
      sessions.apply(created.sessionId, 0, {
        upsert: [{ id: 'x', type: 'prop', prop: 'rocket', position: [0, 0, 0] }],
      }),
    /unknown prop rocket/,
  );
  assert.equal(sessions.get(created.sessionId).revision, 0);
  const next = sessions.apply(created.sessionId, 0, { camera: { focalLengthMm: 24 } });
  assert.equal(next.revision, 1);
  // The snapshot is a copy: editing it does not change the session.
  next.scene.nodes.length = 0;
  assert.equal(sessions.get(created.sessionId).scene.nodes.length, 3);
  assert.equal(sessions.replace(created.sessionId, 1, scene()).revision, 2);
  // The least recently used session is evicted at capacity.
  const second = sessions.create(scene());
  sessions.get(created.sessionId);
  sessions.create(scene());
  assert.throws(() => sessions.get(second.sessionId), /Unknown film session/);
  assert.equal(sessions.get(created.sessionId).revision, 2);
  assert.ok(sessions.close(created.sessionId));
  assert.ok(ZHUDA_FILM_HOST_CONTEXT.props.includes('container20'));
  assert.ok(ZHUDA_FILM_HOST_CONTEXT.recipes.includes('asphalt'));
});

test('film tools are listed and answer over JSON-RPC without a browser for data calls', async () => {
  for (const name of [
    'film_scene_create',
    'film_scene_get',
    'film_scene_apply',
    'film_scene_preview',
    'film_scene_review',
    'film_render_job',
    'film_scene_close',
  ])
    assert.ok(
      MCP_TOOLS_MANIFEST.some((tool) => tool.name === name),
      name,
    );
  const call = (id, name, args) =>
    handleJsonRpcMessage({
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: { name, arguments: args },
    });
  const created = await call(1, 'film_scene_create', { scene: scene() });
  const { sessionId, revision } = JSON.parse(created.result.content[0].text);
  assert.equal(revision, 0);
  const applied = await call(2, 'film_scene_apply', {
    sessionId,
    expectedRevision: 0,
    patch: { camera: { fStop: 2.8 } },
  });
  assert.equal(JSON.parse(applied.result.content[0].text).revision, 1);
  const stale = await call(3, 'film_scene_apply', { sessionId, expectedRevision: 0, patch: {} });
  assert.equal(stale.error.code, -32602);
  assert.match(stale.error.message, /Stale revision/);
  const both = await call(4, 'film_scene_apply', {
    sessionId,
    expectedRevision: 1,
    patch: {},
    scene: scene(),
  });
  assert.match(both.error.message, /either patch or scene/);
  const job = await call(5, 'film_render_job', { sessionId, kind: 'still', name: 'x' });
  assert.match(job.error.message, /output directory|--film-output/);
  const closed = await call(6, 'film_scene_close', { sessionId });
  assert.equal(JSON.parse(closed.result.content[0].text).closed, true);
  // Non-film tools keep answering synchronously.
  const sync = handleJsonRpcMessage({
    jsonrpc: '2.0',
    id: 7,
    method: 'tools/call',
    params: { name: 'get_agent_contract' },
  });
  assert.equal(typeof sync.then, 'undefined');
});

test('the film host page draws through Laya only', () => {
  const page = fs.readFileSync(
    new URL('../packages/compiler/film-host-client.ts', import.meta.url),
    'utf8',
  );
  const review = fs.readFileSync(
    new URL('../packages/core/film/FilmReview.ts', import.meta.url),
    'utf8',
  );
  for (const [name, source] of [
    ['film-host-client.ts', page],
    ['FilmReview.ts', review],
  ]) {
    assert.doesNotMatch(
      source,
      /getContext\(|createElement\(['"]canvas|toDataURL|AudioContext/,
      name,
    );
  }
  assert.match(review, /drawToRenderTexture2D/);
  assert.match(review, /new l\.Text\(\)/);
  assert.match(page, /composeZhudaFilmReview/);
});

test('looks resolve presets and overrides; phase 1 scenes keep the plain look', async () => {
  const { resolveZhudaFilmLook, ZHUDA_FILM_LOOK_PRESETS } = await import(
    '../packages/core/film/FilmScene.ts'
  );
  const plain = resolveZhudaFilmLook({ sky: [0.1, 0.2, 0.3] });
  assert.equal(plain.preset, null);
  assert.equal(plain.shadows, false);
  assert.equal(plain.atmosphere, false);
  assert.equal(plain.fog, false);
  assert.deepEqual(plain.sky, [0.1, 0.2, 0.3]);
  const night = resolveZhudaFilmLook({
    preset: 'night',
    sun: { elevationDeg: 20 },
    fog: { start: 5, end: 50 },
  });
  assert.equal(night.sun.elevationDeg, 20);
  assert.equal(night.sun.azimuthDeg, ZHUDA_FILM_LOOK_PRESETS.night.sun.azimuthDeg);
  assert.equal(night.shadows.strength, ZHUDA_FILM_LOOK_PRESETS.night.shadows.strength);
  assert.deepEqual(night.fog, {
    color: ZHUDA_FILM_LOOK_PRESETS.night.fog.color,
    start: 5,
    end: 50,
  });
  const off = resolveZhudaFilmLook({
    preset: 'day',
    shadows: false,
    atmosphere: false,
    fog: false,
  });
  assert.deepEqual([off.shadows, off.atmosphere, off.fog], [false, false, false]);
  // Opting in without a preset uses explicit defaults.
  const custom = resolveZhudaFilmLook({
    shadows: { softness: 'hard' },
    atmosphere: { thickness: 2 },
  });
  assert.equal(custom.shadows.softness, 'hard');
  assert.equal(custom.shadows.distance, 60);
  assert.equal(custom.atmosphere.thickness, 2);
  for (const preset of Object.keys(ZHUDA_FILM_LOOK_PRESETS))
    assert.deepEqual(validateZhudaFilmScene({ ...scene(), look: { preset } }, context), [], preset);
});

test('look, light and emission fields are validated with paths', () => {
  const bad = scene();
  bad.look = {
    preset: 'sunset',
    shadows: { distance: 1, softness: 'blurry', resolution: 3000 },
    atmosphere: { thickness: 9, skyTint: [2, 0, 0] },
    fog: { start: 50, end: 10 },
  };
  bad.materials.lamp = { color: [1, 0, 0], emission: [9, 0, 0] };
  bad.nodes.push(
    { id: 'l1', type: 'light', kind: 'laser', position: [0, 1, 0] },
    {
      id: 'l2',
      type: 'light',
      kind: 'spot',
      position: [0, 1, 0],
      target: [0, 1, 0],
      spotAngleDeg: 200,
    },
    {
      id: 'l3',
      type: 'light',
      kind: 'point',
      position: [0, 1, 0],
      target: [1, 0, 0],
      intensity: 50,
    },
  );
  const issues = validateZhudaFilmScene(bad, context);
  for (const fragment of [
    'scene.look.preset',
    'scene.look.shadows.distance',
    'scene.look.shadows.softness',
    'scene.look.shadows.resolution',
    'scene.look.atmosphere.thickness',
    'scene.look.atmosphere.skyTint',
    'scene.look.fog',
    'scene.materials.lamp.emission',
    'kind: use point or spot',
    'target: must differ from position',
    'spotAngleDeg',
    'target: only spot lights aim',
    'intensity: use 0..20',
  ])
    assert.ok(
      issues.some((issue) => issue.includes(fragment)),
      `missing ${fragment} in\n${issues.join('\n')}`,
    );
  const many = scene();
  for (let i = 0; i < 33; i++)
    many.nodes.push({ id: `l${i}`, type: 'light', kind: 'point', position: [i, 2, 0] });
  assert.ok(validateZhudaFilmScene(many, context).some((issue) => /at most 32 lights/.test(issue)));
  // Nested look objects merge in patches.
  const base = parseZhudaFilmScene(
    { ...scene(), look: { preset: 'night', fog: { start: 10, end: 80 } } },
    context,
  );
  const next = applyZhudaFilmScenePatch(
    base,
    { look: { fog: { end: 120 }, sun: { intensity: 0.3 } } },
    context,
  );
  assert.deepEqual(next.look.fog, { start: 10, end: 120 });
  assert.equal(next.look.sun.intensity, 0.3);
});

test('grade is off unless asked for and validated with paths', async () => {
  const { resolveZhudaFilmLook } = await import('../packages/core/film/FilmScene.ts');
  assert.equal(resolveZhudaFilmLook({ preset: 'night' }).grade, false);
  assert.deepEqual(resolveZhudaFilmLook({ grade: { exposure: 1.6 } }).grade, {
    exposure: 1.6,
    contrast: 1,
    saturation: 1,
    bloom: 0.1,
    ao: 0.5,
    aoRadius: 0.5,
  });
  assert.equal(resolveZhudaFilmLook({ grade: false }).grade, false);
  const issues = validateZhudaFilmScene(
    { ...scene(), look: { grade: { exposure: 99, bloom: -1, glow: 1 } } },
    context,
  );
  for (const fragment of ['grade.exposure', 'grade.bloom', 'grade.glow: unknown field'])
    assert.ok(
      issues.some((issue) => issue.includes(fragment)),
      fragment,
    );
  const base = parseZhudaFilmScene(
    { ...scene(), look: { grade: { exposure: 1.2, bloom: 0.3 } } },
    context,
  );
  const next = applyZhudaFilmScenePatch(base, { look: { grade: { exposure: 2 } } }, context);
  assert.deepEqual(next.look.grade, { exposure: 2, bloom: 0.3 });
});

test('model nodes name logical assets and report every bad field with a path', () => {
  const model = (extra = {}) => ({
    ...scene(),
    nodes: [{ id: 'house', type: 'model', asset: 'city/house.glb', position: [0, 0, 0], ...extra }],
  });
  assert.deepEqual(validateZhudaFilmScene(model(), context), []);
  assert.deepEqual(
    validateZhudaFilmScene(
      model({ lightmap: 'city/house.hdr', lightmapIntensity: 2, scale: 0.5, yawDeg: 90 }),
      { ...context, assets: ['city/house.glb', 'city/house.hdr'] },
    ),
    [],
  );
  const cases = [
    [{ asset: '../house.glb' }, 'nodes[0].asset: use a logical asset id ending in .glb'],
    [{ asset: 'https://example.com/house.glb' }, 'nodes[0].asset: use a logical asset id'],
    [{ asset: '/abs/house.glb' }, 'nodes[0].asset: use a logical asset id'],
    [{ asset: 'city/house.gltf' }, 'nodes[0].asset: use a logical asset id ending in .glb'],
    [{ lightmap: 'city/house.png' }, 'nodes[0].lightmap: use a logical asset id ending in .hdr'],
    [{ lightmapIntensity: 1 }, 'nodes[0].lightmapIntensity: needs a lightmap'],
    [{ lightmap: 'a.hdr', lightmapIntensity: 99 }, 'nodes[0].lightmapIntensity'],
    [{ scale: 0 }, 'nodes[0].scale: use 0.001..1000'],
    [{ url: 'x' }, 'nodes[0].url: unknown field'],
  ];
  for (const [extra, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(model(extra), context).some((issue) => issue.includes(fragment)),
      fragment,
    );
  // A host that lists its assets refuses unknown ids and says what it has.
  const listed = validateZhudaFilmScene(model({ lightmap: 'city/other.hdr' }), {
    ...context,
    assets: ['city/house.glb', 'city/house.hdr'],
  });
  assert.deepEqual(listed, [
    'scene.nodes[0].lightmap: unknown asset city/other.hdr; known: city/house.hdr',
  ]);
  const many = {
    ...scene(),
    nodes: Array.from({ length: 65 }, (_, i) => ({
      id: 'm' + i,
      type: 'model',
      asset: 'a.glb',
      position: [i, 0, 0],
    })),
  };
  assert.ok(validateZhudaFilmScene(many, context).some((issue) => /at most 64 models/.test(issue)));
  // Patches add and remove models like any other node.
  const base = parseZhudaFilmScene(model(), context);
  const next = applyZhudaFilmScenePatch(
    base,
    { upsert: [{ ...base.nodes[0], lightmap: 'city/house.hdr' }] },
    context,
  );
  assert.equal(next.nodes[0].lightmap, 'city/house.hdr');
});

test('the bundled host without an asset directory refuses model nodes', () => {
  const sessions = new ZhudaFilmSessions();
  assert.throws(
    () =>
      sessions.create({
        ...scene(),
        materials: {},
        nodes: [{ id: 'house', type: 'model', asset: 'house.glb', position: [0, 0, 0] }],
      }),
    /unknown asset house\.glb; known: none/,
  );
});

test('reflector nodes are validated with paths, one per scene, hiding only model nodes', () => {
  const wet = (extra = {}) => ({
    ...scene(),
    nodes: [
      ...scene().nodes,
      { id: 'floor', type: 'model', asset: 'floor.glb', position: [0, 0, 0] },
      { id: 'wet', type: 'reflector', position: [0, 0.01, 0], size: [20, 40], ...extra },
    ],
  });
  assert.deepEqual(validateZhudaFilmScene(wet(), context), []);
  assert.deepEqual(
    validateZhudaFilmScene(
      wet({
        strength: 2,
        wetness: 0.6,
        roughness: 0.2,
        ripple: 0.5,
        patternMeters: 4,
        resolution: 2048,
        hides: ['floor'],
      }),
      context,
    ),
    [],
  );
  const cases = [
    [{ size: [0, 40] }, 'nodes[4].size: use [width, depth]'],
    [{ strength: 9 }, 'nodes[4].strength: use 0..4'],
    [{ wetness: -1 }, 'nodes[4].wetness: use 0..1'],
    [{ roughness: 2 }, 'nodes[4].roughness: use 0..1'],
    [{ ripple: 'x' }, 'nodes[4].ripple: use 0..1'],
    [{ patternMeters: 0 }, 'nodes[4].patternMeters: use 0.1..100'],
    [{ resolution: 300 }, 'nodes[4].resolution: use 256, 512, 1024 or 2048'],
    [{ hides: ['c1'] }, 'nodes[4].hides: c1 is not a model node in this scene'],
    [{ hides: 'floor' }, 'nodes[4].hides: list model node ids'],
    [{ blur: 1 }, 'nodes[4].blur: unknown field'],
  ];
  for (const [extra, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(wet(extra), context).some((issue) => issue.includes(fragment)),
      fragment,
    );
  const two = wet();
  two.nodes.push({ id: 'wet2', type: 'reflector', position: [0, 0, 9], size: [2, 2] });
  assert.ok(
    validateZhudaFilmScene(two, context).some((issue) => /one reflector per scene/.test(issue)),
  );
});
