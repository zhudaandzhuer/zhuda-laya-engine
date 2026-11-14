// What the MCP server tells an agent about shadows from lamps matches what the
// engine does: the film validator's limit, ZhudaPointShadow's limit, the
// quality route document and the route's data. No browser; the shadows
// themselves are drawn by verify:film-point-shadow and verify:film-animation.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { getQualityRoute } from '../packages/mcp-server/quality-route.mjs';
import { API_GUARDRAILS } from '../packages/mcp-server/corpus.mjs';
import { FILM_TOOLS_MANIFEST } from '../packages/mcp-server/film-tools.mjs';
import { ZHUDA_FILM_LIMITS } from '../packages/mcp-server/runtime.mjs';
import { ZHUDA_POINT_SHADOW_MAX_LIGHTS } from '../packages/core/runtime3d/PointShadow.ts';

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const page = fs
  .readFileSync(new URL('../docs/quality-route.md', import.meta.url), 'utf8')
  .replace(/\s+/g, ' ');
const guardrail = API_GUARDRAILS.find((entry) => entry.id === 'GUARD_SCENE_QUALITY_ROUTE');
const createTool = FILM_TOOLS_MANIFEST.find((tool) => tool.name === 'film_scene_create');

/**
 * What a text says wrongly about shadows from point lights, given how many
 * may cast: that they are not built at all, or a smaller "up to" count.
 */
function staleShadowClaims(text, casting) {
  const problems = [];
  for (const [, notBuilt] of text.matchAll(/not built(?: yet)?:([^.]*)/gi))
    if (/point-light shadows|shadows from point lights/i.test(notBuilt))
      problems.push('lists point-light shadows as not built');
  for (const [, count] of text.matchAll(
    /(?:up to|at most) (\w+) (?:shadow-casting )?point lights/gi,
  ))
    if (count !== WORDS[casting] && count !== String(casting))
      problems.push(`says up to ${count} point lights cast`);
  return problems;
}

test('the validator, ZhudaPointShadow, get_quality_route and the document agree on the count', () => {
  const casting = ZHUDA_FILM_LIMITS.pointShadows;
  assert.equal(casting, ZHUDA_POINT_SHADOW_MAX_LIGHTS);
  assert.equal(casting, 8);
  const { limits, notYet } = getQualityRoute();
  assert.equal(limits.shadowCastingPointLights, casting);
  assert.equal(limits.shadowCastingSpots, 1);
  assert.ok(
    page.includes(
      `one shadow-casting spot light and ${WORDS[casting]} shadow-casting point lights`,
    ),
  );
  assert.ok(page.includes(`Up to ${WORDS[casting]} point lights and one spot light per scene`));
  assert.ok(
    notYet.some((line) => line.startsWith(`Shadows from more than ${WORDS[casting]} point lights`)),
  );
});

test('the guardrail says lamps cast shadows, how, and what is still not built', () => {
  const casting = WORDS[ZHUDA_FILM_LIMITS.pointShadows];
  assert.deepEqual(staleShadowClaims(guardrail.reason, ZHUDA_FILM_LIMITS.pointShadows), []);
  assert.ok(
    guardrail.reason.includes(`up to ${casting} point lights and one spot light per scene`),
  );
  assert.ok(guardrail.reason.includes('a lamp that follows a model casts'));
  assert.ok(guardrail.reason.includes(`shadows from more than ${casting} point lights`));
  // The API it points to: the game class and the film fields that exist.
  for (const part of [
    'new ZhudaPointShadow(',
    'shadow.render(',
    'castsShadow: true',
    'follows: { node }',
  ])
    assert.ok(guardrail.zhudaCanonicalApi.includes(part), part);
  // Its evidence sentence is the document's: desktop WebGL and WebGPU.
  assert.ok(
    page.includes('the same checks on desktop WebGPU through `npm run verify:film-webgpu`'),
  );
  assert.ok(guardrail.reason.includes('Drawn on desktop WebGL and WebGPU'));
  assert.match(
    getQualityRoute().evidence.rule,
    /desktop WebGPU through npm run verify:film-webgpu/,
  );
  // An agent asking about lamps finds it.
  for (const words of ['point light', 'lamp', '燈'])
    assert.ok(guardrail.topic.includes(words), words);
});

test('no MCP text gives a smaller count or calls point-light shadows unbuilt', () => {
  const casting = ZHUDA_FILM_LIMITS.pointShadows;
  const texts = {
    guardrails: JSON.stringify(API_GUARDRAILS),
    route: JSON.stringify(getQualityRoute()),
    filmTools: JSON.stringify(FILM_TOOLS_MANIFEST),
  };
  for (const [name, text] of Object.entries(texts))
    assert.deepEqual(staleShadowClaims(text, casting), [], name);
  assert.ok(
    createTool.description.includes(`up to ${WORDS[casting]} point lights with castsShadow`),
  );
});

test('the stale statements this replaced are caught', () => {
  const casting = ZHUDA_FILM_LIMITS.pointShadows;
  assert.deepEqual(
    staleShadowClaims(
      'Desktop WebGL evidence only; not built yet: real-time GI, reflections on walls, point-light shadows. See docs/quality-route.md.',
      casting,
    ),
    ['lists point-light shadows as not built'],
  );
  assert.deepEqual(
    staleShadowClaims(
      'light point/spot, one spot light and up to four point lights with castsShadow',
      casting,
    ),
    ['says up to four point lights cast'],
  );
  assert.deepEqual(
    staleShadowClaims('Not built yet: shadows from more than eight point lights.', casting),
    [],
  );
});
