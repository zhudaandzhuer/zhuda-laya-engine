// The shadow caster's normal bias, kept off faces that look away from the
// light (installLaya342ShadowBias). Pure checks of the patch and of the
// vendored line it replaces; the drawn evidence is in the task's record.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  installLaya342ShadowBias,
  zhudaPatchShadowBias,
} from '../packages/core/runtime3d/Laya342Adapters.ts';

const UPSTREAM =
  'float invNdotL=1.0-clamp(dot(-lightDirection,normalWS),0.0,1.0);float scale=invNdotL*u_ShadowBias.y;';

/** The pull along the normal as the two versions of the line compute it. */
const pull = (facing, fixed) => {
  const invNdotL = 1 - Math.min(1, Math.max(0, facing));
  const t = Math.min(1, Math.max(0, (facing + 0.25) / 0.25));
  return invNdotL * (fixed ? t * t * (3 - 2 * t) : 1);
};

test('the vendored caster code still holds the line the patch replaces', () => {
  const vendor = fs.readFileSync(
    path.join(import.meta.dirname, '../vendor/laya-3.4.2/libs/laya.d3.js'),
    'utf8',
  );
  assert.ok(
    vendor.includes(UPSTREAM),
    'DepthVertex.glsl changed: the shadow bias patch no longer applies',
  );
  assert.equal(vendor.split(UPSTREAM).length, 2, 'once');
});

test('the patch keeps the pull where a face meets the light and drops it where it looks away', () => {
  const upstream = `vec3 applyShadowBias(vec3 positionWS,vec3 normalWS,vec3 lightDirection){${UPSTREAM}positionWS+=-lightDirection*u_ShadowBias.xxx;positionWS+=normalWS*vec3(scale);return positionWS;}`;
  const patched = zhudaPatchShadowBias(upstream);
  assert.notEqual(patched, upstream);
  assert.ok(!patched.includes(UPSTREAM));
  assert.match(patched, /smoothstep\(-0\.25,0\.0,zhudaFacing\)/);
  // The rest of the function is untouched, and patching twice changes nothing more.
  assert.ok(patched.endsWith('positionWS+=normalWS*vec3(scale);return positionWS;}'));
  assert.equal(zhudaPatchShadowBias(patched), patched);
  assert.equal(zhudaPatchShadowBias('void other(){}'), 'void other(){}');
  // Faces turned to the light are pulled exactly as before.
  for (const facing of [0, 0.2, 0.66, 1]) assert.equal(pull(facing, true), pull(facing, false));
  // A face along the light keeps the full pull; one that looks away has none.
  assert.equal(pull(0, true), 1);
  assert.equal(pull(-0.25, true), 0);
  assert.equal(pull(-0.66, true), 0, 'the underside of a road at ten in the morning');
  assert.equal(pull(-0.66, false), 1, 'which upstream pulls the full distance toward the sun');
  // And it fades between the two without a step.
  let before = 1;
  for (let facing = 0; facing >= -0.25; facing -= 0.01) {
    const now = pull(facing, true);
    assert.ok(now <= before + 1e-12 && before - now < 0.12, 'at ' + facing);
    before = now;
  }
});

test('the patch is put on the include as LayaAir registers it, once', () => {
  const seen = [];
  const runtime = {
    Shader3D: {
      addInclude(name, text) {
        seen.push([name, text]);
      },
    },
  };
  assert.equal(installLaya342ShadowBias(runtime), true);
  const wrapped = runtime.Shader3D.addInclude;
  assert.equal(installLaya342ShadowBias(runtime), true);
  assert.equal(runtime.Shader3D.addInclude, wrapped, 'a second install does not wrap again');
  runtime.Shader3D.addInclude('DepthVertex.glsl', `a;${UPSTREAM}b;`);
  runtime.Shader3D.addInclude('Lighting.glsl', `a;${UPSTREAM}b;`);
  assert.ok(seen[0][1].includes('zhudaFacing') && !seen[0][1].includes(UPSTREAM));
  assert.equal(seen[1][1], `a;${UPSTREAM}b;`, 'other includes are left alone');
  assert.equal(installLaya342ShadowBias({}), false);
  assert.equal(installLaya342ShadowBias(null), false);
});
