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
  for (let i = 0; i < 129; i++)
    many.nodes.push({ id: `l${i}`, type: 'light', kind: 'point', position: [i, 2, 0] });
  assert.ok(
    validateZhudaFilmScene(many, context).some((issue) =>
      /at most 128 real-time lights/.test(issue),
    ),
  );
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
    grain: 0,
    vignette: 0,
    fringe: 0,
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

test('a lightmap direction needs a lightmap and an unturned model', () => {
  const model = (extra) => ({
    ...scene(),
    nodes: [{ id: 'street', type: 'model', asset: 'street.glb', position: [0, 0, 0], ...extra }],
  });
  assert.deepEqual(
    validateZhudaFilmScene(
      model({ lightmap: 'street.hdr', lightmapDirection: 'street-dir.hdr' }),
      context,
    ),
    [],
  );
  const cases = [
    [{ lightmapDirection: 'street-dir.hdr' }, 'lightmapDirection: needs a lightmap'],
    [
      { lightmap: 'street.hdr', lightmapDirection: 'street-dir.hdr', yawDeg: 90 },
      'lightmapDirection: directions are in world space; keep yawDeg 0',
    ],
    [
      { lightmap: 'street.hdr', lightmapDirection: 'street-dir.png' },
      'lightmapDirection: use a logical asset id ending in .hdr',
    ],
  ];
  for (const [extra, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(model(extra), context).some((issue) => issue.includes(fragment)),
      fragment,
    );
});

test('lightFog needs grade; fog-only lights are point lights outside the 32 limit', () => {
  const withLook = (look, nodes = []) => ({
    ...scene(),
    look,
    nodes: [...scene().nodes, ...nodes],
  });
  const lamp = (i, extra = {}) => ({
    id: 'l' + i,
    type: 'light',
    kind: 'point',
    position: [i, 3, 0],
    ...extra,
  });
  assert.deepEqual(
    validateZhudaFilmScene(
      withLook({
        grade: {},
        lightFog: { density: 0.02, falloffMeters: 6, color: [0.1, 0.1, 0.2], scatter: 2 },
      }),
      context,
    ),
    [],
  );
  assert.deepEqual(resolveZhudaFilmLook({ grade: {}, lightFog: {} }).lightFog, {
    density: 0.012,
    falloffMeters: 8,
    baseY: 0,
    color: [0.02, 0.03, 0.05],
    scatter: 1,
    shafts: false,
  });
  assert.equal(resolveZhudaFilmLook({ grade: {} }).lightFog, false);
  // Light shafts: off by default, defaults filled in, values checked with paths.
  assert.deepEqual(
    resolveZhudaFilmLook({ grade: {}, lightFog: { shafts: { strength: 3 } } }).lightFog.shafts,
    { strength: 3, anisotropy: 0.6, distance: 60, steps: 40 },
  );
  assert.equal(
    resolveZhudaFilmLook({ grade: {}, lightFog: { shafts: false } }).lightFog.shafts,
    false,
  );
  assert.deepEqual(
    validateZhudaFilmScene(
      withLook({ grade: {}, lightFog: { shafts: { anisotropy: 0.7, distance: 80, steps: 64 } } }),
      context,
    ),
    [],
  );
  const shaftIssues = validateZhudaFilmScene(
    withLook({
      grade: {},
      lightFog: { shafts: { strength: 65, anisotropy: 1, distance: 2, steps: 7.5, glow: 1 } },
    }),
    context,
  );
  for (const key of ['strength', 'anisotropy', 'distance', 'steps', 'glow'])
    assert.ok(
      shaftIssues.some((issue) => issue.includes(`look.lightFog.shafts.${key}`)),
      key + ': ' + shaftIssues.join(' | '),
    );
  // Spot lights do not shine into the fog and do not count against its lights.
  assert.deepEqual(
    validateZhudaFilmScene(
      withLook({ grade: {}, lightFog: {} }, [
        ...Array.from({ length: 100 }, (_, i) => lamp(i, { fogOnly: true })),
        ...Array.from({ length: 100 }, (_, i) => ({
          id: 'spot' + i,
          type: 'light',
          kind: 'spot',
          position: [i, 3, 0],
          target: [i, 0, 0],
        })),
      ]),
      context,
    ),
    [],
  );
  const cases = [
    [{ lightFog: {} }, 'lightFog: needs grade'],
    [{ grade: {}, lightFog: { density: 3 } }, 'lightFog.density'],
    [{ grade: {}, lightFog: { falloffMeters: 0 } }, 'lightFog.falloffMeters'],
    [{ grade: {}, lightFog: { haze: 1 } }, 'lightFog.haze: unknown field'],
  ];
  for (const [look, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(withLook(look), context).some((issue) => issue.includes(fragment)),
      fragment,
    );
  // 96 fog-only lights and 32 lit ones are fine; 129 lights in all are not.
  const fogOnly = Array.from({ length: 96 }, (_, i) => lamp(i, { fogOnly: true }));
  const lit = Array.from({ length: 32 }, (_, i) => lamp(200 + i));
  assert.deepEqual(
    validateZhudaFilmScene(withLook({ grade: {}, lightFog: {} }, [...fogOnly, ...lit]), context),
    [],
  );
  assert.ok(
    validateZhudaFilmScene(
      withLook({}, [...fogOnly, ...lit, lamp(999, { fogOnly: true })]),
      context,
    ).some((issue) => /at most 128 point lights/.test(issue)),
  );
  // More than Laya's default of 32 real-time lights is a valid scene; the
  // runtime must have been booted for them (checked when the scene is mounted).
  assert.deepEqual(validateZhudaFilmScene(withLook({}, [...lit, lamp(998)]), context), []);
  assert.ok(
    validateZhudaFilmScene(
      withLook({}, [
        {
          id: 's',
          type: 'light',
          kind: 'spot',
          position: [0, 3, 0],
          target: [0, 0, 0],
          fogOnly: true,
        },
      ]),
      context,
    ).some((issue) => issue.includes('fogOnly: point lights only')),
  );
  const base = parseZhudaFilmScene(
    withLook({ grade: {}, lightFog: { density: 0.02, scatter: 2 } }),
    context,
  );
  assert.deepEqual(
    applyZhudaFilmScenePatch(base, { look: { lightFog: { density: 0.05 } } }, context).look
      .lightFog,
    { density: 0.05, scatter: 2 },
  );
});

test('motion sampling is linear, turns the short way and holds its ends', async () => {
  const { sampleZhudaFilmMotion } = await import('../packages/core/film/FilmScene.ts');
  const keys = [
    { time: 0, position: [0, 0, 0], yawDeg: 350 },
    { time: 2, position: [4, 0, -2], yawDeg: 10 },
    { time: 3, position: [4, 1, -2] },
  ];
  assert.deepEqual(sampleZhudaFilmMotion(keys, 0), { position: [0, 0, 0], yawDeg: 350 });
  const mid = sampleZhudaFilmMotion(keys, 1);
  assert.deepEqual(mid.position, [2, 0, -1]);
  assert.equal(mid.yawDeg, 360, 'from 350 to 10 goes through 360, not back through 180');
  assert.deepEqual(sampleZhudaFilmMotion(keys, 2.5), { position: [4, 0.5, -2], yawDeg: 10 });
  assert.deepEqual(sampleZhudaFilmMotion(keys, 99), { position: [4, 1, -2], yawDeg: 10 });
  // Without yaw on the keys the node's own yaw is kept.
  const plain = [
    { time: 0, position: [0, 0, 0] },
    { time: 1, position: [1, 0, 0] },
  ];
  assert.equal(sampleZhudaFilmMotion(plain, 0.5, 90).yawDeg, 90);
});

test('animation, motion and follows are validated with paths', () => {
  const model = (extra) => ({
    id: 'pig',
    type: 'model',
    asset: 'pig.glb',
    position: [0, 0, 0],
    ...extra,
  });
  const lamp = (extra) => ({
    id: 'lamp',
    type: 'light',
    kind: 'point',
    position: [0, 1, 0],
    ...extra,
  });
  const of = (...nodes) => ({ ...scene(), nodes: [...scene().nodes, ...nodes] });
  const keys = [
    { time: 0, position: [0, 0, 0] },
    { time: 2, position: [3, 0, 0], yawDeg: 90 },
  ];
  assert.deepEqual(
    validateZhudaFilmScene(
      of(
        model({
          animation: { clip: 'Walk', loop: true, speed: 1.2, offsetSec: 0.3 },
          motion: keys,
        }),
        lamp({ follows: { node: 'pig', offset: [0, 0.4, 0.5] } }),
      ),
      context,
    ),
    [],
  );
  const cases = [
    [of(model({ animation: {} })), 'animation.clip: clip name required'],
    [of(model({ animation: { clip: 'Walk', speed: 99 } })), 'animation.speed: use 0..8'],
    [of(model({ animation: { clip: 'Walk', loop: 'yes' } })), 'animation.loop: true or false'],
    [of(model({ animation: { clip: 'Walk', blend: 1 } })), 'animation.blend: unknown field'],
    [of(model({ motion: [keys[0]] })), 'motion: use 2..256 keys'],
    [
      of(model({ motion: [{ time: 1, position: [0, 0, 0] }, keys[1]] })),
      'motion[0].time: start at 0',
    ],
    [
      of(model({ motion: [keys[0], { time: 0, position: [1, 0, 0] }] })),
      'motion[1].time: start at 0 and increase',
    ],
    [of(model({ motion: keys, lightmap: 'pig.hdr' })), 'motion: a lightmapped model cannot move'],
    [of(model({}), lamp({ follows: { node: 'c1' } })), 'follows.node: c1 is not a model node'],
    [
      of(model({}), { ...lamp({ follows: { node: 'pig' } }), kind: 'spot', target: [1, 0, 0] }),
      'follows: point lights only',
    ],
    [of(model({}), lamp({ follows: 'pig' })), 'follows: use { node, offset }'],
  ];
  for (const [value, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(value, context).some((issue) => issue.includes(fragment)),
      fragment,
    );
});

test('look.environment is validated, resolved and merged by patches', () => {
  const withLook = (look) => ({ ...scene(), look });
  assert.deepEqual(
    validateZhudaFilmScene(
      withLook({ environment: { position: [0, 1.5, -40], reflection: 1.5, ambient: 0.8 } }),
      context,
    ),
    [],
  );
  assert.deepEqual(resolveZhudaFilmLook({ environment: { position: [1, 2, 3] } }).environment, {
    position: [1, 2, 3],
    reflection: 1,
    ambient: 1,
  });
  assert.equal(resolveZhudaFilmLook({}).environment, false);
  assert.equal(resolveZhudaFilmLook({ environment: false }).environment, false);
  const cases = [
    [{ environment: {} }, 'environment.position'],
    [{ environment: { position: [0, 0, 0], reflection: 99 } }, 'environment.reflection'],
    [{ environment: { position: [0, 0, 0], ambient: -1 } }, 'environment.ambient'],
    [{ environment: { position: [0, 0, 0], probes: 2 } }, 'environment.probes: unknown field'],
  ];
  for (const [look, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(withLook(look), context).some((issue) => issue.includes(fragment)),
      fragment,
    );
  const base = parseZhudaFilmScene(
    withLook({ environment: { position: [0, 1, 0], reflection: 2 } }),
    context,
  );
  assert.deepEqual(
    applyZhudaFilmScenePatch(base, { look: { environment: { position: [5, 1, 0] } } }, context).look
      .environment,
    { position: [5, 1, 0], reflection: 2 },
  );
});

test('grade grain, vignette and fringe are off by default and validated', () => {
  const resolved = resolveZhudaFilmLook({ grade: { grain: 0.3 } }).grade;
  assert.equal(resolved.grain, 0.3);
  assert.equal(resolved.vignette, 0);
  assert.equal(resolved.fringe, 0);
  const issues = validateZhudaFilmScene(
    { ...scene(), look: { grade: { grain: 2, vignette: -0.1, fringe: 5 } } },
    context,
  );
  for (const key of ['grade.grain', 'grade.vignette', 'grade.fringe'])
    assert.ok(
      issues.some((issue) => issue.includes(key)),
      key,
    );
});

test('look.panorama names a picture asset and replaces the procedural sky', () => {
  const withLook = (look) => ({ ...scene(), look });
  assert.deepEqual(
    validateZhudaFilmScene(
      withLook({ panorama: { asset: 'sky/night.jpg', exposure: 2, rotationDeg: 90 } }),
      context,
    ),
    [],
  );
  assert.deepEqual(resolveZhudaFilmLook({ panorama: { asset: 'sky.png' } }).panorama, {
    asset: 'sky.png',
    exposure: 1,
    rotationDeg: 0,
  });
  assert.equal(resolveZhudaFilmLook({ preset: 'night' }).panorama, false);
  const cases = [
    [
      { panorama: { asset: 'sky.hdr' } },
      'panorama.asset: use a logical asset id ending in .png or .jpg',
    ],
    [{ panorama: { asset: '../sky.png' } }, 'panorama.asset'],
    [{ panorama: { asset: 'sky.png', exposure: 99 } }, 'panorama.exposure'],
    [{ panorama: { asset: 'sky.png', rotationDeg: 999 } }, 'panorama.rotationDeg'],
    [{ panorama: { asset: 'sky.png', tint: [1, 1, 1] } }, 'panorama.tint: unknown field'],
  ];
  for (const [look, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(withLook(look), context).some((issue) => issue.includes(fragment)),
      fragment,
    );
  assert.ok(
    validateZhudaFilmScene(withLook({ panorama: { asset: 'sky.png' } }), {
      ...context,
      assets: ['other.png'],
    }).some((issue) => issue.includes('unknown asset sky.png')),
  );
});

test('shadow cascades and shadow-casting spot lights are validated', () => {
  const spot = (id, extra = {}) => ({
    id,
    type: 'light',
    kind: 'spot',
    position: [0, 4, 0],
    target: [0, 0, 0.5],
    ...extra,
  });
  const of = (look, nodes = []) => ({ ...scene(), look, nodes: [...scene().nodes, ...nodes] });
  assert.deepEqual(
    validateZhudaFilmScene(
      of({ shadows: { cascades: 4 } }, [spot('a', { castsShadow: true }), spot('b')]),
      context,
    ),
    [],
  );
  assert.equal(resolveZhudaFilmLook({ preset: 'day' }).shadows.cascades, 2);
  assert.equal(
    resolveZhudaFilmLook({ preset: 'day', shadows: { cascades: 4 } }).shadows.cascades,
    4,
  );
  const cases = [
    [of({ shadows: { cascades: 3 } }), 'shadows.cascades: use 1, 2 or 4'],
    [
      of({}, [spot('a', { castsShadow: true }), spot('b', { castsShadow: true })]),
      'one spot light may cast shadows',
    ],
    [
      of({}, [{ id: 'p', type: 'light', kind: 'point', position: [0, 3, 0], castsShadow: true }]),
      'castsShadow: spot lights only',
    ],
    [of({}, [spot('a', { castsShadow: 'yes' })]), 'castsShadow: spot lights only'],
  ];
  for (const [value, fragment] of cases)
    assert.ok(
      validateZhudaFilmScene(value, context).some((issue) => issue.includes(fragment)),
      fragment,
    );
});
