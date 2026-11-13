// The quality route as data, its document, its example scenes and the advice
// the film tools attach to their replies. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  QUALITY_ROUTE_SCENES,
  STARTER_TILE_METERS,
  getQualityRoute,
} from '../packages/mcp-server/quality-route.mjs';
import { API_GUARDRAILS, GOLDEN_EXAMPLES } from '../packages/mcp-server/corpus.mjs';
import { executeFilmTool, FILM_TOOLS_MANIFEST } from '../packages/mcp-server/film-tools.mjs';
import { lintZhudaFilmScene, validateZhudaFilmScene } from '../packages/mcp-server/runtime.mjs';
import { REQUIRED_AGENT_FILES, getAgentContract } from '../packages/compiler/agent-contract.mjs';

const root = new URL('..', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
const reply = async (name, args) => JSON.parse((await executeFilmTool(name, args)).at(-1).text);

test('the route is complete, ordered data and the document names every part of it', () => {
  const route = getQualityRoute();
  const ids = route.steps.map((step) => step.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], 'pick-the-surface');
  assert.equal(ids.at(-1), 'final-evidence');
  for (const step of route.steps)
    for (const field of ['do', 'api', 'why', 'check']) assert.ok(step[field].length > 20, step.id);
  const page = read(route.document);
  ids.forEach((id, index) => assert.ok(page.includes(`### ${index + 1}. \`${id}\``), id));
  for (const rule of Object.keys(route.adviceRules))
    assert.ok(page.includes('`' + rule + '`'), rule);
  for (const flag of route.metricsFlags) assert.ok(page.includes('`' + flag + '`'), flag);
  for (const command of route.evidence.commands) assert.ok(page.includes(command), command);
  // Limits quoted in the document are the ones the validator enforces.
  assert.deepEqual(route.limits.materialBakeSizes, [128, 256, 512, 1024, 2048]);
  assert.equal(route.limits.realTimeLights, 128);
  assert.ok(page.includes('128 real-time lights'));
  // What is not built is said in both places, never implied to exist.
  assert.ok(route.notYet.some((line) => /global illumination/.test(line)));
  assert.ok(page.includes('## Not built yet'));
});

test('the route is required reading and reachable from every entry document', () => {
  assert.ok(REQUIRED_AGENT_FILES.includes('docs/quality-route.md'));
  assert.equal(getAgentContract(new URL('.', root).pathname).qualityRoute, 'docs/quality-route.md');
  for (const file of [
    'AGENTS.md',
    'README.md',
    'docs/consumer-route.md',
    'docs/3d-integration.md',
    'docs/agent-development.md',
    'docs/film-scenes.md',
  ])
    assert.ok(read(file).includes('quality-route.md'), file);
});

test('the example scenes are valid, get no advice and are served as golden examples', () => {
  const context = {
    props: ['container20', 'jersey-barrier', 'pallet'],
    recipes: Object.keys(STARTER_TILE_METERS),
  };
  for (const [name, scene] of Object.entries(QUALITY_ROUTE_SCENES)) {
    assert.deepEqual(validateZhudaFilmScene(scene, context), [], name);
    assert.deepEqual(lintZhudaFilmScene(scene, { tileMeters: STARTER_TILE_METERS }), [], name);
  }
  assert.deepEqual(getQualityRoute().examples, Object.keys(QUALITY_ROUTE_SCENES));
  const day = GOLDEN_EXAMPLES['film-scene-day'].code;
  // The first line is a comment on how to use it; the rest is the scene.
  assert.deepEqual(JSON.parse(day.slice(day.indexOf('\n') + 1)), QUALITY_ROUTE_SCENES['day-yard']);
  assert.match(GOLDEN_EXAMPLES['film-scene-night-wet'].code, /"type": "reflector"/);
  // The game example is on the route too: physically based, one look, a frame budget.
  const game = GOLDEN_EXAMPLES['scene-look-game'].code;
  for (const part of ["type: 'pbr'", 'new ZhudaSceneLook(', 'ZhudaQualityGovernor', 'postProcess'])
    assert.ok(game.includes(part), part);
  assert.ok(!game.includes('shininess'));
  assert.equal(API_GUARDRAILS[0].id, 'GUARD_SCENE_QUALITY_ROUTE');
});

test('film tools hand back advice with every scene they accept', async () => {
  assert.ok(FILM_TOOLS_MANIFEST.some((tool) => tool.name === 'film_scene_lint'));
  const bare = {
    schemaVersion: 1,
    id: 'bare',
    camera: { eye: [0, 30, 0.5], target: [0, 0, 0] },
    nodes: [{ id: 'ground', type: 'ground', size: [20, 20], material: 'asphalt' }],
  };
  const created = await reply('film_scene_create', { scene: bare });
  // No look at all: the day preset, so only the grade is missing.
  assert.deepEqual(
    created.advice.map((item) => item.rule),
    ['look.no-grade'],
  );
  assert.match(created.advice[0].fix, /"grade": \{\}/);
  const fixed = await reply('film_scene_apply', {
    sessionId: created.sessionId,
    expectedRevision: 0,
    patch: { look: { preset: 'day', grade: {} } },
  });
  assert.deepEqual(fixed.advice, []);
  assert.deepEqual((await reply('film_scene_get', { sessionId: created.sessionId })).advice, []);
  // Advice without a session, for a scene that is only being considered.
  const considered = await reply('film_scene_lint', { scene: QUALITY_ROUTE_SCENES['night-wet'] });
  assert.deepEqual(considered.advice, []);
  assert.deepEqual((await reply('film_scene_lint', { sessionId: created.sessionId })).advice, []);
  await assert.rejects(executeFilmTool('film_scene_lint', {}), /either sessionId or scene/);
  await assert.rejects(
    executeFilmTool('film_scene_lint', { scene: { ...bare, nodes: 'none' } }),
    /Invalid film scene/,
  );
  await executeFilmTool('film_scene_close', { sessionId: created.sessionId });
});
