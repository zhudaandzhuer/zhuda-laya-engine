import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  validateZhudaWind,
  zhudaMarkFoliage,
  zhudaPatchFoliageInclude,
  zhudaPatchFoliagePass,
  zhudaWindOffset,
  ZHUDA_KEEP_COVERAGE_DEFINE,
  ZHUDA_WIND_DEFINE,
} from '../packages/core/runtime3d/Foliage.ts';

/** An include's text as LayaAir 3.4.2 registers it (from the vendored build). */
function vendorInclude(file, name) {
  const source = fs.readFileSync(
    new URL(`../vendor/laya-3.4.2/libs/${file}`, import.meta.url),
    'utf8',
  );
  const head = `addInclude("${name}",`;
  const at = source.indexOf(head);
  assert.ok(at >= 0, name + ' is in ' + file);
  const quote = source[at + head.length];
  const start = at + head.length + 1;
  const end = source.indexOf(quote + ')', start);
  return Function(`return ${quote}${source.slice(start, end)}${quote}`)();
}

test('the wind leaves a plant still at its base and bends it more the higher, toward where it blows', () => {
  const base = [5, 0.4, -3];
  const wind = { direction: [0, 1], strength: 1 };
  for (const t of [0, 1.7, 9.3]) {
    assert.deepEqual(
      zhudaWindOffset([5.3, 0.4, -3.1], base, t, wind),
      [0, 0, 0],
      'nothing at the base',
    );
    const low = zhudaWindOffset([5, 3.4, -3], base, t, wind);
    const high = zhudaWindOffset([5, 12.4, -3], base, t, wind);
    // A stem bends with the square of the height: 4 times as far at twice the height.
    assert.ok(Math.abs(high[2] / low[2] - 16) < 1e-9, `${high[2]} / ${low[2]}`);
    assert.equal(high[0], 0, 'only along the wind');
    assert.equal(high[1], 0, 'a branch moves sideways only');
    // Within the gusts: 16 cm at 10 m at most 1.4 times.
    assert.ok(Math.abs(zhudaWindOffset([5, 10.4, -3], base, t, wind)[2]) <= 0.16 * 1.4 + 1e-9);
  }
  // It moves with time; strength 0 is still; strength scales it.
  assert.notDeepEqual(
    zhudaWindOffset([5, 8, -3], base, 0, wind),
    zhudaWindOffset([5, 8, -3], base, 1, wind),
  );
  assert.deepEqual(zhudaWindOffset([5, 8, -3], base, 2, { strength: 0 }, true), [0, 0, 0]);
  const one = zhudaWindOffset([5, 8, -3], base, 2, wind)[2],
    two = zhudaWindOffset([5, 8, -3], base, 2, { ...wind, strength: 2 })[2];
  assert.ok(Math.abs(two - 2 * one) < 1e-12);
  // Two trees in different places are not in step.
  assert.notEqual(
    zhudaWindOffset([5, 8, -3], base, 2, wind)[2],
    zhudaWindOffset([25, 8, 7], [25, 0.4, 7], 2, wind)[2],
  );
});

test('leaves also flutter, a few centimetres, not near the ground', () => {
  const base = [0, 0, 0];
  const wind = { direction: [1, 0], strength: 1 };
  const branch = zhudaWindOffset([0.2, 6, 0.1], base, 3.3, wind);
  const leaf = zhudaWindOffset([0.2, 6, 0.1], base, 3.3, wind, true);
  const flutter = leaf.map((v, i) => v - branch[i]);
  assert.ok(Math.hypot(...flutter) > 0.001, 'a leaf moves on its own: ' + flutter);
  assert.ok(Math.hypot(...flutter) < 0.05, 'by centimetres');
  let most = 0;
  for (let t = 0; t < 5; t += 0.05) {
    const near = zhudaWindOffset([0.2, 0.25, 0.1], base, t, wind, true);
    most = Math.max(most, Math.abs(near[1]));
  }
  assert.equal(most, 0, 'a leaf by the ground does not flutter');
});

test('wind options are validated', () => {
  assert.deepEqual(validateZhudaWind({}), []);
  assert.deepEqual(validateZhudaWind({ direction: [1, 0.35], strength: 2 }), []);
  const issues = validateZhudaWind({ direction: [0, 0], strength: 3 }).join(' | ');
  assert.ok(issues.includes('direction') && issues.includes('strength'), issues);
});

test("the patches apply to LayaAir 3.4.2's own shader text and leave a changed upstream alone", () => {
  for (const [file, name, marker] of [
    ['laya.d3.js', 'Sprite3DVertex.glsl', 'vec3 zhudaWindMove('],
    [
      'laya.d3.js',
      'ShadingVertex.glsl',
      'params.positionWS=zhudaWindMove(params.positionWS,worldMat);',
    ],
    ['laya.d3.js', 'DepthVertex.glsl', 'positionWS=zhudaWindMove(positionWS,getWorldMatrix());'],
    ['laya.gltf.js', 'glTFMetallicRoughness.glsl', 'if(zhudaAlpha<inputs.alphaTest){discard;}'],
  ]) {
    const text = vendorInclude(file, name);
    const made = zhudaPatchFoliageInclude(name, text);
    assert.equal(made.reason, undefined, name);
    assert.ok(made.text.includes(marker), name);
    // Every addition is behind its define: without them the code is LayaAir's.
    const added = made.text.length - text.length;
    assert.ok(added > 0);
    assert.ok(
      made.text.includes(`#ifdef ${ZHUDA_WIND_DEFINE}`) ||
        made.text.includes(`defined(${ZHUDA_KEEP_COVERAGE_DEFINE})`),
      name,
    );
    const changed = zhudaPatchFoliageInclude(
      name,
      text.replace(/positionWS|return worldMat;\}|alphaTest/g, 'x'),
    );
    assert.ok(changed.reason, name + ': a changed upstream is reported');
  }
  assert.deepEqual(zhudaPatchFoliageInclude('Lighting.glsl', 'void f(){}'), { text: 'void f(){}' });
  // The glTF shader's shadow and depth programs read the alpha themselves.
  const gltf = fs.readFileSync(
    new URL('../vendor/laya-3.4.2/libs/laya.gltf.js', import.meta.url),
    'utf8',
  );
  const reads = gltf.split('alpha*=texture2D(u_BaseColorTexture,baseColorUV).a;').length - 1;
  assert.ok(reads >= 2, 'shadow and depth-normal programs: ' + reads);
  const pass = zhudaPatchFoliagePass(
    'void main(){float alpha=1.0;alpha*=texture2D(u_BaseColorTexture,baseColorUV).a;\n#endif\n}',
  );
  assert.equal(pass.reads, 1);
  assert.ok(
    pass.text.includes(`#ifdef ${ZHUDA_KEEP_COVERAGE_DEFINE}`) &&
      pass.text.includes('alpha=zhudaAlpha;'),
  );
  assert.deepEqual(zhudaPatchFoliagePass('void main(){}'), { text: 'void main(){}', reads: 0 });
});

test('marking puts the defines on the materials under a node, cut-out ones keep coverage, and takes off only its own', () => {
  const defines = new Map();
  const runtime = {
    BaseRender: 'renderer',
    Shader3D: {
      getDefineByName: (name) =>
        defines.has(name) ? defines.get(name) : defines.set(name, { name }).get(name),
    },
  };
  const material = (alphaTest, start = []) => {
    const set = new Set(start);
    return {
      alphaTest,
      shaderData: {
        addDefine: (d) => set.add(d),
        removeDefine: (d) => set.delete(d),
        hasDefine: (d) => set.has(d),
      },
      set,
    };
  };
  const wind = runtime.Shader3D.getDefineByName(ZHUDA_WIND_DEFINE);
  const leaves = material(true),
    bark = material(false),
    already = material(true, [wind]);
  const node = (materials, children = []) => ({
    getComponent: (type) =>
      type === 'renderer' && materials ? { sharedMaterials: materials } : null,
    numChildren: children.length,
    getChildAt: (i) => children[i],
  });
  // The same leaves on two copies: one material, marked once.
  const tree = node(null, [node([bark, leaves]), node([leaves, already])]);
  const mark = zhudaMarkFoliage(tree, {}, runtime);
  assert.equal(mark.materials, 3);
  const keep = runtime.Shader3D.getDefineByName(ZHUDA_KEEP_COVERAGE_DEFINE);
  assert.deepEqual([...leaves.set], [wind, keep]);
  assert.deepEqual([...bark.set], [wind], 'bark moves, a solid material has no coverage to keep');
  assert.deepEqual([...already.set], [wind, keep]);
  mark.dispose();
  assert.deepEqual([...leaves.set], []);
  assert.deepEqual([...bark.set], []);
  assert.deepEqual([...already.set], [wind], 'what was there before stays');
  // Coverage only, no wind.
  const only = zhudaMarkFoliage(node([leaves]), { wind: false }, runtime);
  assert.deepEqual([...leaves.set], [keep]);
  only.dispose();
});

test('a crown is shaded darker inside and underneath, on its cut-out leaves only, once', async () => {
  const { shadeCrownGlb, zhudaCrownLight, zhudaFitCrown } = await import(
    '../packages/compiler/model-crown.mjs'
  );
  const { readGlb, writeGlb } = await import('../packages/compiler/model-lod.mjs');
  // Leaves on a sphere of radius 3 round (0, 6, 0) and at its middle; a trunk of two points.
  const leaves = [];
  for (let i = 0; i < 200; i++) {
    const a = (i * 2.399963) % (2 * Math.PI),
      y = 1 - (2 * (i + 0.5)) / 200,
      r = Math.sqrt(1 - y * y);
    leaves.push(3 * r * Math.cos(a), 6 + 3 * y, 3 * r * Math.sin(a));
  }
  leaves.push(0, 6, 0);
  const trunk = [0, 0, 0, 0, 4, 0, 0.2, 0, 0];
  const positions = Buffer.from(new Float32Array([...leaves, ...trunk]).buffer);
  const leafBytes = leaves.length * 4;
  const json = {
    asset: { version: '2.0' },
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0 }, material: 0, mode: 0 },
          { attributes: { POSITION: 1 }, material: 1, mode: 0 },
        ],
      },
    ],
    materials: [{ name: 'leaves', alphaMode: 'MASK' }, { name: 'bark' }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: leaves.length / 3, type: 'VEC3' },
      { bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: leafBytes },
      { buffer: 0, byteOffset: leafBytes, byteLength: trunk.length * 4 },
    ],
    buffers: [{ byteLength: positions.length }],
  };
  const { glb, report } = shadeCrownGlb(writeGlb(json, positions));
  assert.equal(report.primitives, 1);
  assert.equal(report.vertices, leaves.length / 3);
  const shaded = readGlb(glb);
  const [leafPrimitive, barkPrimitive] = shaded.json.meshes[0].primitives;
  assert.equal(barkPrimitive.attributes.COLOR_0, undefined, 'the bark is not shaded');
  const colour = shaded.json.accessors[leafPrimitive.attributes.COLOR_0];
  assert.deepEqual(
    [colour.componentType, colour.normalized, colour.type, colour.count],
    [5121, true, 'VEC4', leaves.length / 3],
  );
  const view = shaded.json.bufferViews[colour.bufferView];
  const value = (i) => shaded.bin[(view.byteOffset || 0) + i * 4] / 255;
  const middle = value(leaves.length / 3 - 1),
    top = value(0),
    bottom = value(199);
  assert.ok(middle < 0.5, 'deep in the crown is dark: ' + middle);
  assert.ok(top > 0.95, 'the top of the crown is lit: ' + top);
  assert.ok(bottom < top && bottom > middle, 'the underside is between: ' + bottom);
  // Running it again changes nothing: the leaves have their colour.
  assert.ok(shadeCrownGlb(glb).glb.equals(glb));
  // The pure parts.
  const crown = zhudaFitCrown(new Float32Array(leaves));
  assert.ok(
    Math.abs(crown.centre[1] - 6) < 0.05 && crown.radii.every((r) => Math.abs(r - 3) < 0.1),
    JSON.stringify(crown),
  );
  const exact = { centre: [0, 6, 0], radii: [3, 3, 3] };
  assert.equal(zhudaCrownLight([0, 9, 0], exact, { floor: 0.45, under: 0.75 }), 1);
  assert.ok(Math.abs(zhudaCrownLight([0, 6, 0], exact) - 0.45 * (0.75 + 0.25 * 0.5)) < 1e-9);
});
