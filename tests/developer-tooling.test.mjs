import test from 'node:test';
import assert from 'node:assert/strict';
import {
  reportZhudaWebGLShaderErrors,
  zhudaShaderErrorExcerpt,
} from '../packages/core/runtime3d/ShaderErrors.ts';
import { prepareRenderer } from '../packages/core/runtime3d/Renderer.ts';
import {
  ZhudaDebugDraw,
  validateZhudaDebugDraw,
  zhudaArrowLines,
  zhudaAxesLines,
  zhudaBoxLines,
  zhudaCircleLines,
  zhudaConeLines,
  zhudaFrustumLines,
  zhudaGridLines,
  zhudaSkeletonLines,
  zhudaSphereLines,
} from '../packages/core/runtime3d/DebugDraw.ts';
import { hideZhudaStats, showZhudaStats } from '../packages/core/runtime3d/DebugStats.ts';
import {
  ZhudaTransformGizmo,
  validateZhudaTransformGizmo,
  zhudaAlongAxis,
  zhudaAngleRound,
  zhudaAxisTurn,
  zhudaGizmoHit,
  zhudaPointerRay,
  zhudaRayAxis,
  zhudaRayPlane,
  zhudaTurnAfter,
} from '../packages/core/runtime3d/TransformGizmo.ts';
import { ZhudaRuntimeProfiler } from '../packages/core/effects/EffectBudget.ts';

const near = (a, b, tolerance = 1e-6) => Math.abs(a - b) <= tolerance;
const close = (a, b, tolerance = 1e-6, what = '') =>
  assert.ok(
    a.length === b.length && a.every((v, i) => near(v, b[i], tolerance)),
    `${what} ${JSON.stringify(a)} is not ${JSON.stringify(b)}`,
  );
const segments = (flat) =>
  Array.from({ length: flat.length / 6 }, (_, i) => [
    flat.slice(i * 6, i * 6 + 3),
    flat.slice(i * 6 + 3, i * 6 + 6),
  ]);
const length = ([a, b]) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// --- A shader that does not compile ----------------------------------------------
const SOURCE = [
  '#version 300 es',
  'precision highp float;',
  'out vec4 color;',
  'void main(){',
  'color = vec4(missing, 1.0);',
  '}',
].join('\n');

test('a failed compile is its log and the source lines it points at, on either backend', () => {
  // WebGL: `ERROR: 0:<line>:`.
  assert.equal(
    zhudaShaderErrorExcerpt("ERROR: 0:5: 'missing' : undeclared identifier\n", SOURCE, 'fragment'),
    "Shader compile failed (fragment): ERROR: 0:5: 'missing' : undeclared identifier\n" +
      '3: out vec4 color;\n4: void main(){\n5: color = vec4(missing, 1.0);\n6: }',
  );
  // glslang, on WebGPU: `ERROR: :<line>:`. The same lines.
  const gpu = zhudaShaderErrorExcerpt(
    "ERROR: :5: 'missing' : undeclared identifier \nERROR: 1 compilation errors.  No code generated.",
    SOURCE,
    'fragment',
  );
  assert.match(gpu, /No code generated\.\n3: out vec4 color;\n4: void main\(\)\{\n5: color/);
  // The first line of a file has no lines before it; the last has none after.
  assert.match(
    zhudaShaderErrorExcerpt('ERROR: 0:1: bad version', SOURCE, 'vertex'),
    /bad version\n1: #version 300 es\n2: precision highp float;$/,
  );
  assert.match(
    zhudaShaderErrorExcerpt('ERROR: 0:6: x', SOURCE, 'vertex'),
    /\n4: void main\(\)\{\n5: .*\n6: \}$/,
  );
  // A log that names no line, or a line the source does not have: the log alone.
  for (const log of [
    'Link failed for no stated reason',
    'ERROR: 0:99: beyond the end',
    'ERROR: 0:0: nowhere',
  ])
    assert.equal(
      zhudaShaderErrorExcerpt(log, SOURCE, 'vertex'),
      `Shader compile failed (vertex): ${log}`,
    );
  assert.equal(
    zhudaShaderErrorExcerpt(undefined, undefined, 'vertex'),
    'Shader compile failed (vertex): ',
  );
  // A line that is very long is cut, not left out.
  const long = zhudaShaderErrorExcerpt('ERROR: 0:1: x', 'a'.repeat(1000), 'vertex');
  assert.equal(long.split('\n')[1].length, '1: '.length + 240);
});

/** A WebGL context whose shaders fail when their source says so. */
function fakeGl() {
  class Context {
    VERTEX_SHADER = 1;
    FRAGMENT_SHADER = 2;
    COMPILE_STATUS = 3;
    LINK_STATUS = 4;
    SHADER_TYPE = 5;
    lost = false;
    asked = 0;
    createShader(type) {
      return { type };
    }
    shaderSource(shader, source) {
      shader.source = source;
    }
    compileShader(shader) {
      shader.compiled = true;
    }
    getShaderParameter(shader, name) {
      this.asked++;
      return name === this.SHADER_TYPE ? shader.type : !shader.source.includes('missing');
    }
    getShaderInfoLog() {
      return "ERROR: 0:5: 'missing' : undeclared identifier";
    }
    linkProgram(program) {
      program.linked = true;
    }
    getProgramParameter(program) {
      return !program.bad;
    }
    getProgramInfoLog(program) {
      return program.log ?? '';
    }
    isContextLost() {
      return this.lost;
    }
  }
  return new Context();
}

test('WebGL compile and link failures are recorded, and the context is left as it was', () => {
  const gl = fakeGl();
  const errors = [];
  const restore = reportZhudaWebGLShaderErrors(gl, errors, 3);
  const good = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(good, 'void main(){}');
  gl.compileShader(good);
  assert.equal(good.compiled, true, 'the context still compiles');
  assert.deepEqual(errors, []);
  const bad = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(bad, SOURCE);
  gl.compileShader(bad);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^Shader compile failed \(fragment\): ERROR: 0:5:/);
  assert.match(errors[0], /\n5: color = vec4\(missing, 1\.0\);/);
  const vertex = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertex, SOURCE);
  gl.compileShader(vertex);
  assert.match(errors[1], /^Shader compile failed \(vertex\)/);
  // A program: only a link log that says something is kept.
  gl.linkProgram({});
  gl.linkProgram({ bad: true, log: '' });
  assert.equal(errors.length, 2);
  const program = { bad: true, log: 'varying v_Uv not written by the vertex shader' };
  gl.linkProgram(program);
  assert.equal(program.linked, true);
  assert.equal(errors[2], 'Shader link failed: varying v_Uv not written by the vertex shader');
  // The list is bounded.
  gl.compileShader(bad);
  assert.equal(errors.length, 3);
  // A lost context is not asked anything.
  const quiet = [];
  const lost = fakeGl();
  reportZhudaWebGLShaderErrors(lost, quiet);
  lost.lost = true;
  const shader = lost.createShader(1);
  lost.shaderSource(shader, SOURCE);
  lost.compileShader(shader);
  assert.deepEqual([quiet, lost.asked], [[], 0]);
  // Taken off again: the context's own methods, from its class.
  restore();
  for (const name of ['shaderSource', 'compileShader', 'linkProgram'])
    assert.equal(Object.hasOwn(gl, name), false, name);
  gl.compileShader(bad);
  assert.equal(errors.length, 3);
  assert.throws(() => reportZhudaWebGLShaderErrors({}, []), /WebGL context/);
});

test('the WebGL renderer reports shader failures from the moment it is ready, until it is released', () => {
  const gl = fakeGl();
  const native = {
    WebGLRenderDeviceFactory: class {},
    LayaGL: { renderEngine: { _context: gl, objectName: 'WebGLEngine' } },
  };
  const handle = prepareRenderer('webgl', native);
  handle.ready();
  const shader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(shader, SOURCE);
  gl.compileShader(shader);
  assert.equal(handle.diagnostics.errors.length, 1);
  assert.match(handle.diagnostics.errors[0], /\n5: color = vec4\(missing, 1\.0\);/);
  handle.release('disposed');
  assert.equal(Object.hasOwn(gl, 'compileShader'), false);
});

// --- Lines -------------------------------------------------------------------------
test('helper lines are where the arithmetic says', () => {
  // Axes of a node moved to (1, 2, 3) and twice as wide in x.
  const moved = [2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 2, 3, 1];
  assert.deepEqual(
    zhudaAxesLines(moved, 0.5),
    [1, 2, 3, 2, 2, 3, 1, 2, 3, 1, 2.5, 3, 1, 2, 3, 1, 2, 3.5],
  );
  assert.deepEqual(zhudaAxesLines(null, 1).slice(0, 6), [0, 0, 0, 1, 0, 0]);

  const grid = segments(zhudaGridLines(4, 2, 1));
  assert.equal(grid.length, 6);
  assert.ok(grid.every((s) => near(length(s), 4) && s[0][1] === 1 && s[1][1] === 1));
  assert.deepEqual(grid[0], [
    [-2, 1, -2],
    [-2, 1, 2],
  ]);
  assert.throws(() => zhudaGridLines(0), /Invalid debug grid/);
  assert.throws(() => zhudaGridLines(1, 1.5), /Invalid debug grid/);

  const box = segments(zhudaBoxLines([0, 0, 0], [1, 2, 3]));
  assert.equal(box.length, 12);
  assert.deepEqual(box.map(length).sort(), [1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]);
  // In a node's space the box goes with the node.
  assert.deepEqual(zhudaBoxLines([0, 0, 0], [1, 1, 1], moved).slice(0, 6), [1, 2, 3, 3, 2, 3]);

  const circle = segments(zhudaCircleLines([1, 1, 1], [0, 1, 0], 2, 16));
  assert.equal(circle.length, 16);
  for (const [a, b] of circle) {
    assert.ok(
      near(Math.hypot(a[0] - 1, a[2] - 1), 2) && near(a[1], 1),
      'on the circle, in its plane',
    );
    void b;
  }
  close(circle[15][1], circle[0][0], 1e-9, 'closed');
  assert.equal(zhudaSphereLines([0, 0, 0], 1, 8).length, 3 * 8 * 6);

  // A spot of 90° across reaching 2: its end is a circle of radius 2, two along.
  const cone = segments(zhudaConeLines([0, 5, 0], [0, -1, 0], 2, 90, 8));
  assert.equal(cone.length, 8 + 4);
  for (const [a] of cone.slice(0, 8)) assert.ok(near(a[1], 3) && near(Math.hypot(a[0], a[2]), 2));
  for (const [a, b] of cone.slice(8)) {
    assert.deepEqual(a, [0, 5, 0]);
    assert.ok(near(length([a, b]), Math.hypot(2, 2)));
  }

  const arrow = segments(zhudaArrowLines([0, 0, 0], [0, 0, -3], 2));
  assert.deepEqual(arrow[0], [
    [0, 0, 0],
    [0, 0, -2],
  ]);
  assert.equal(arrow.length, 5);
  assert.ok(
    arrow.slice(1).every(([a]) => a[2] === -2),
    'the barbs leave the tip',
  );

  const bones = [
    { position: [0, 0, 0], parent: -1 },
    { position: [0, 1, 0], parent: 0 },
    { position: [0, 2, 0], parent: 1 },
    { position: [9, 9, 9], parent: 7 },
    { position: [5, 5, 5], parent: 4 },
  ];
  assert.deepEqual(zhudaSkeletonLines(bones), [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 2, 0]);
});

test("a camera's frustum is its near and far rectangles, the same on both backends", () => {
  // 90° up and down, twice as wide as high, looking down -Z from the origin.
  const lines = segments(
    zhudaFrustumLines({ matrix: IDENTITY, fieldOfView: 90, aspect: 2, near: 1, far: 10 }),
  );
  assert.equal(lines.length, 12);
  const corners = lines.flat();
  const at = (z) => corners.filter((p) => near(p[2], z));
  for (const p of at(-1)) assert.ok(near(Math.abs(p[0]), 2) && near(Math.abs(p[1]), 1), 'near');
  for (const p of at(-10)) assert.ok(near(Math.abs(p[0]), 20) && near(Math.abs(p[1]), 10), 'far');
  assert.equal(at(-1).length, 12);
  // An orthographic camera 4 high: the same rectangle near and far.
  const flat = segments(
    zhudaFrustumLines({
      matrix: IDENTITY,
      fieldOfView: 60,
      aspect: 1.5,
      near: 0.5,
      far: 8,
      orthographic: true,
      orthographicVerticalSize: 4,
    }),
  ).flat();
  assert.ok(flat.every((p) => near(Math.abs(p[0]), 3) && near(Math.abs(p[1]), 2)));
  // A camera turned to look along +X from (0, 5, 0).
  const turned = [0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 5, 0, 1];
  const ahead = segments(
    zhudaFrustumLines({ matrix: turned, fieldOfView: 90, aspect: 1, near: 1, far: 2 }),
  ).flat();
  assert.ok(ahead.every((p) => p[0] < -0.99 || p[0] > 0.99));
  assert.ok(ahead.every((p) => Math.abs(p[0]) >= 1 - 1e-9 && p[1] >= 3 - 1e-9 && p[1] <= 7 + 1e-9));
  for (const bad of [
    { near: 0, far: 1, aspect: 1 },
    { near: 2, far: 1, aspect: 1 },
    { near: 1, far: 2, aspect: 0 },
  ])
    assert.throws(
      () => zhudaFrustumLines({ matrix: IDENTITY, fieldOfView: 60, ...bad }),
      /Invalid debug frustum/,
    );
});

/** As much of LayaAir as the helpers touch. */
function fakeLaya() {
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      Object.assign(this, { x, y, z });
    }
    setValue(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  class Quaternion {
    constructor(x = 0, y = 0, z = 0, w = 1) {
      Object.assign(this, { x, y, z, w });
    }
  }
  class Color {
    constructor(r, g, b, a) {
      Object.assign(this, { r, g, b, a });
    }
  }
  const sprites = [];
  class PixelLineSprite3D {
    constructor(max, name) {
      this.maxLineCount = max;
      this.name = name;
      this.drawn = [];
      this.destroyed = false;
      this._render = {
        sharedMaterial: {
          destroy() {
            this.destroyed = true;
          },
        },
      };
      sprites.push(this);
    }
    get lineCount() {
      return this.drawn.length;
    }
    addLine(a, b, c) {
      if (this.drawn.length >= this.maxLineCount) throw Error('over the line sprite');
      this.drawn.push({ from: [a.x, a.y, a.z], to: [b.x, b.y, b.z], color: [c.r, c.g, c.b] });
    }
    clear() {
      this.drawn = [];
    }
    destroy() {
      this.destroyed = true;
    }
  }
  class BaseRender {}
  class SkinnedMeshRenderer {}
  class DirectionLightCom {}
  class PointLightCom {}
  class SpotLightCom {}
  return {
    Vector3,
    Quaternion,
    Color,
    PixelLineSprite3D,
    BaseRender,
    SkinnedMeshRenderer,
    DirectionLightCom,
    PointLightCom,
    SpotLightCom,
    RenderState: { DEPTHTEST_ALWAYS: 'always' },
    sprites,
  };
}
/** A node at a place, with what hangs under it and what is on it. */
function node(l, position = [0, 0, 0], { children = [], components = [] } = {}) {
  const made = {
    transform: {
      worldMatrix: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ...position, 1] },
      position: new l.Vector3(...position),
      rotation: new l.Quaternion(),
      localScale: new l.Vector3(1, 1, 1),
    },
    numChildren: children.length,
    getChildAt: (i) => children[i],
    getComponent: (type) => components.find((c) => c instanceof type),
  };
  for (const child of children) child.parent = made;
  for (const component of components) component.owner = made;
  return made;
}
function withLaya(run) {
  const before = globalThis.Laya;
  const l = (globalThis.Laya = fakeLaya());
  try {
    return run(l);
  } finally {
    globalThis.Laya = before;
  }
}

test('helpers follow what they show, keep their colours and are taken away one by one', () =>
  withLaya((l) => {
    const scene = { children: [], addChild: (child) => scene.children.push(child) };
    assert.throws(() => new ZhudaDebugDraw({}), /Scene3D is required/);
    assert.throws(() => new ZhudaDebugDraw(scene, { maxLines: 8 }), /maxLines/);
    assert.deepEqual(validateZhudaDebugDraw({ onTop: 1, maxLines: 1e6 }).length, 2);
    const draw = new ZhudaDebugDraw(scene);
    const sprite = l.sprites[0];
    assert.equal(scene.children[0], sprite);
    const material = sprite._render.sharedMaterial;
    assert.deepEqual(Object.keys(material), ['destroy'], 'behind things unless asked otherwise');

    const thing = node(l, [1, 0, 0]);
    const axes = draw.axes(thing, 2);
    draw.update();
    assert.deepEqual(
      sprite.drawn.map((line) => line.to),
      [
        [3, 0, 0],
        [1, 2, 0],
        [1, 0, 2],
      ],
    );
    // Red x, green y, blue z: the strongest channel of each.
    assert.deepEqual(
      sprite.drawn.map((line) => line.color.indexOf(Math.max(...line.color))),
      [0, 1, 2],
    );
    // The node moves; the next update draws it where it is.
    thing.transform.worldMatrix.elements[13] = 5;
    draw.update();
    assert.deepEqual(sprite.drawn[0], {
      from: [1, 5, 0],
      to: [3, 5, 0],
      color: sprite.drawn[0].color,
    });

    const box = draw.box([0, 0, 0], [1, 1, 1], [1, 1, 0]);
    const grid = draw.grid({ size: 2, divisions: 1 });
    draw.update();
    assert.equal(draw.lineCount, 3 + 12 + 4);
    assert.deepEqual(sprite.drawn[3].color, [1, 1, 0]);
    axes.remove();
    box.remove();
    draw.update();
    assert.equal(draw.lineCount, 4);
    grid.remove();

    // What a node draws: the box round its renderers' bounds, in the world.
    const bounds = (min, max) =>
      Object.assign(new l.BaseRender(), {
        bounds: { getMin: () => new l.Vector3(...min), getMax: () => new l.Vector3(...max) },
      });
    const model = node(l, [0, 0, 0], {
      components: [bounds([0, 0, 0], [1, 1, 1])],
      children: [node(l, [0, 0, 0], { components: [bounds([2, -1, 0], [3, 0.5, 4])] }), node(l)],
    });
    const round = draw.bounds(model);
    draw.update();
    assert.equal(draw.lineCount, 12);
    const xs = sprite.drawn.flatMap((line) => [line.from, line.to]);
    assert.deepEqual(
      [0, 1, 2].map((i) => [Math.min(...xs.map((p) => p[i])), Math.max(...xs.map((p) => p[i]))]),
      [
        [0, 3],
        [-1, 1],
        [0, 4],
      ],
    );
    round.remove();
    draw.bounds(node(l));
    draw.update();
    assert.equal(draw.lineCount, 0, 'a node that draws nothing shows nothing');
    draw.clear();

    // Lights: an arrow, a reach, a cone, each in the light's colour.
    const sun = Object.assign(new l.DirectionLightCom(), { color: { r: 1, g: 0.5, b: 0 } });
    const lamp = Object.assign(new l.PointLightCom(), { range: 3, color: { r: 0, g: 1, b: 0 } });
    const spot = Object.assign(new l.SpotLightCom(), {
      range: 4,
      spotAngle: 60,
      color: { r: 0, g: 0, b: 1 },
    });
    draw.light(node(l, [0, 9, 0], { components: [sun] }));
    draw.update();
    assert.equal(draw.lineCount, 25, 'five arrows');
    assert.deepEqual(sprite.drawn[0].color, [1, 0.5, 0]);
    // A node without a turn shines down its own -Z.
    assert.deepEqual(
      [sprite.drawn[0].from, sprite.drawn[0].to],
      [
        [0, 9, 0],
        [0, 9, -1.5],
      ],
    );
    draw.clear();
    draw.light(lamp.owner ?? node(l, [1, 1, 1], { components: [lamp] }));
    draw.update();
    assert.equal(draw.lineCount, 96);
    assert.ok(sprite.drawn.every((line) => near(Math.hypot(...line.from.map((v) => v - 1)), 3)));
    draw.clear();
    node(l, [0, 0, 0], { components: [spot] });
    draw.light(spot, [1, 1, 1]);
    draw.update();
    assert.equal(draw.lineCount, 36);
    assert.deepEqual(sprite.drawn[0].color, [1, 1, 1], 'a colour of its own');
    assert.throws(() => draw.light(node(l)), /a light is required/);
    draw.clear();

    // A camera, and the bones of a skinned mesh.
    draw.camera({
      transform: thing.transform,
      nearPlane: 0.1,
      farPlane: 50,
      fieldOfView: 60,
      aspectRatio: 1.6,
    });
    draw.update();
    assert.equal(draw.lineCount, 12);
    assert.throws(() => draw.camera(thing), /a camera is required/);
    draw.clear();
    const hip = node(l, [0, 1, 0]),
      knee = node(l, [0, 0.5, 0]),
      foot = node(l, [0, 0, 0.1]);
    knee.parent = hip;
    foot.parent = knee;
    const skinned = node(l, [0, 0, 0], {
      components: [Object.assign(new l.SkinnedMeshRenderer(), { bones: [hip, knee, foot] })],
    });
    draw.skeleton(skinned);
    draw.update();
    assert.deepEqual(
      sprite.drawn.map((line) => [line.from, line.to]),
      [
        [
          [0, 1, 0],
          [0, 0.5, 0],
        ],
        [
          [0, 0.5, 0],
          [0, 0, 0.1],
        ],
      ],
    );
    draw.clear();

    // Lines of one's own, with a colour for each.
    draw.lines(
      () => [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1],
      [
        [1, 0, 0],
        [0, 1, 0],
      ],
    );
    draw.update();
    assert.deepEqual(
      sprite.drawn.map((line) => line.color),
      [
        [1, 0, 0],
        [0, 1, 0],
        [1, 0, 0],
      ],
    );
    assert.throws(() => draw.lines([]), /a function is required/);

    draw.dispose();
    assert.equal(sprite.destroyed, true);
    assert.equal(material.destroyed, true, 'the material LayaAir made for the sprite goes too');
    assert.equal(draw.lineCount, 0);
    draw.update();
    assert.throws(() => draw.axes(), /Disposed debug draw/);
  }));

test('a helper sheet grows its line sprite, stops at its limit and says what was left out', () =>
  withLaya((l) => {
    const scene = { addChild() {} };
    const draw = new ZhudaDebugDraw(scene, { maxLines: 300, onTop: true });
    const sprite = l.sprites[0];
    assert.equal(sprite.maxLineCount, 256);
    const { destroy, ...onTop } = sprite._render.sharedMaterial;
    assert.deepEqual(onTop, { depthTest: 'always', depthWrite: false, renderQueue: 4500 });
    void destroy;
    draw.grid({ size: 10, divisions: 199 });
    draw.update();
    assert.equal(draw.lineCount, 300);
    assert.equal(sprite.maxLineCount, 300);
    assert.equal(draw.dropped, 400 - 300);
    draw.clear();
    draw.update();
    assert.deepEqual([draw.lineCount, draw.dropped], [0, 0]);
    // A scene destroyed first has taken the sprite with it.
    sprite.destroyed = true;
    sprite.destroy = () => assert.fail('destroyed twice');
    draw.dispose();
  }));

test("the statistics panel is LayaAir's, shown and hidden", () => {
  const before = globalThis.Laya;
  try {
    globalThis.Laya = undefined;
    assert.throws(() => showZhudaStats(), /needs LayaAir/);
    hideZhudaStats();
    const calls = [];
    globalThis.Laya = {
      Stat: { show: (x, y) => calls.push(['show', x, y]), hide: () => calls.push(['hide']) },
    };
    const panel = showZhudaStats({ x: 12, y: 30 });
    showZhudaStats();
    panel.hide();
    assert.deepEqual(calls, [['show', 12, 30], ['show', 0, 0], ['hide']]);
    assert.throws(() => showZhudaStats({ x: -1 }), /x and y/);
  } finally {
    globalThis.Laya = before;
  }
});

// --- The profiler on WebGPU ---------------------------------------------------------
/** The WebGPU classes a profiler wraps, and a device that answers. */
function fakeGpu({ timestamps = true } = {}) {
  const log = [];
  class GPURenderPassEncoder {
    setPipeline(pipeline) {
      this.pipeline = pipeline;
    }
    draw(...args) {
      log.push(['draw', ...args]);
    }
    drawIndexed(...args) {
      log.push(['drawIndexed', ...args]);
    }
    drawIndirect() {
      log.push(['drawIndirect']);
    }
    drawIndexedIndirect() {
      log.push(['drawIndexedIndirect']);
    }
  }
  class GPUCommandEncoder {
    beginRenderPass(descriptor) {
      log.push(['pass', descriptor.timestampWrites ?? null]);
      return new GPURenderPassEncoder();
    }
    resolveQuerySet(set, first, count, buffer, offset) {
      log.push(['resolve', first, count, offset]);
    }
    copyBufferToBuffer(from, a, to, b, bytes) {
      log.push(['copy', bytes]);
      to.pending = device.stamps.slice(0, bytes / 8);
    }
    finish() {
      return {};
    }
  }
  const buffers = [];
  const device = {
    stamps: [],
    features: new Set(timestamps ? ['timestamp-query'] : []),
    lost: new Promise(() => {}),
    createRenderPipeline: (descriptor) => ({ descriptor }),
    createRenderPipelineAsync: async (descriptor) => ({ descriptor }),
    createQuerySet: (descriptor) => ({
      descriptor,
      destroy: () => log.push(['destroy', 'queries']),
    }),
    createBuffer(descriptor) {
      const buffer = {
        descriptor,
        mapAsync: async () => {},
        getMappedRange: () => new BigUint64Array(buffer.pending.map(BigInt)).buffer,
        unmap: () => log.push(['unmap']),
        destroy: () => log.push(['destroy', descriptor.label]),
      };
      buffers.push(buffer);
      return buffer;
    },
    createCommandEncoder: () => new GPUCommandEncoder(),
    queue: { submit: (list) => log.push(['submit', list.length]) },
  };
  return { env: { GPURenderPassEncoder, GPUCommandEncoder }, device, log, buffers };
}

test('WebGPU draws and triangles are counted by what each pipeline draws', async () => {
  const { env, device } = fakeGpu();
  const originals = { ...Object.getOwnPropertyDescriptors(env.GPURenderPassEncoder.prototype) };
  const before = { create: device.createRenderPipeline };
  const profiler = new ZhudaRuntimeProfiler();
  assert.throws(() => profiler.attachWebGPU({}, env), /WebGPU device/);
  assert.throws(() => profiler.attachWebGPU(device, {}), /WebGPU device/);
  // Made before the profiler was there: counted as what WebGPU makes by default.
  const early = device.createRenderPipeline({ primitive: { topology: 'line-list' } });
  profiler.attachWebGPU(device, env);
  profiler.attachWebGPU(device, env);
  const list = device.createRenderPipeline({}),
    strip = device.createRenderPipeline({ primitive: { topology: 'triangle-strip' } }),
    lines = await device.createRenderPipelineAsync({ primitive: { topology: 'line-list' } });
  assert.deepEqual(
    lines.descriptor.primitive,
    { topology: 'line-list' },
    "the pipeline is the device's",
  );
  const pass = new env.GPURenderPassEncoder();
  profiler.beginFrame();
  pass.setPipeline(list);
  pass.draw(36, 2);
  pass.drawIndexed(30);
  pass.setPipeline(strip);
  pass.draw(4);
  pass.drawIndexed(10, 3, 0, 0, 0);
  pass.setPipeline(lines);
  pass.draw(200);
  pass.drawIndirect();
  pass.drawIndexedIndirect();
  pass.setPipeline(early);
  pass.draw(6);
  const sample = profiler.endFrame(16, 4);
  assert.equal(sample.drawCalls, 8);
  assert.equal(sample.triangles, 12 * 2 + 10 + 2 + 8 * 3 + 0 + 2);
  assert.equal(pass.pipeline, early, 'the pass is still told its pipeline');
  assert.equal(profiler.report().sources.draw, 'intercepted WebGPU render pass draws');
  // A frame starts from nothing.
  profiler.beginFrame();
  assert.equal(profiler.endFrame(16, 4).drawCalls, 0);
  profiler.dispose();
  assert.deepEqual(Object.getOwnPropertyDescriptors(env.GPURenderPassEncoder.prototype), originals);
  assert.equal(device.createRenderPipeline, before.create);
  assert.equal(Object.hasOwn(device, 'createRenderPipelineAsync'), true);
});

test('WebGPU frame time is the sum of its render passes, read a frame later', async () => {
  const { env, device, log } = fakeGpu();
  const profiler = new ZhudaRuntimeProfiler();
  const begin = env.GPUCommandEncoder.prototype.beginRenderPass;
  assert.equal(profiler.enableGpuTiming(device, env), true);
  assert.throws(() => profiler.enableGpuTiming(device, env), /already enabled/);
  const encoder = new env.GPUCommandEncoder();
  // A pass outside a frame is nobody's.
  encoder.beginRenderPass({ colorAttachments: [] });
  assert.deepEqual(log.at(-1), ['pass', null]);
  profiler.beginFrame();
  const given = { colorAttachments: [] };
  encoder.beginRenderPass(given);
  encoder.beginRenderPass({ colorAttachments: [] });
  // A pass somebody else is timing is left to them.
  encoder.beginRenderPass({ timestampWrites: { querySet: 'theirs' } });
  assert.equal(given.timestampWrites, undefined, "the caller's descriptor is not changed");
  const passes = log.filter(([name]) => name === 'pass').slice(1);
  assert.deepEqual(
    passes.map(([, writes]) => [writes.beginningOfPassWriteIndex, writes.endOfPassWriteIndex]),
    [
      [0, 1],
      [2, 3],
      [undefined, undefined],
    ],
  );
  const first = profiler.endFrame(16, 5);
  assert.equal(first.gpuMs, undefined, 'not known yet');
  assert.ok(
    !log.some(([name]) => name === 'resolve'),
    'nothing is read while the frame may be unsent',
  );
  // Pass one took 3 ms, pass two 1.5 ms; the stamps are nanoseconds.
  device.stamps = [1_000_000, 4_000_000, 10_000_000, 11_500_000];
  profiler.beginFrame();
  assert.deepEqual(
    log.filter(([name]) => ['resolve', 'copy', 'submit'].includes(name)),
    [
      ['resolve', 0, 4, 0],
      ['copy', 32],
      ['submit', 1],
    ],
  );
  profiler.endFrame(16, 5);
  await new Promise((resolve) => setTimeout(resolve, 0));
  const report = profiler.report();
  assert.equal(report.samples[0].gpuMs, 4.5);
  assert.equal(report.gpuTimeMs, 4.5);
  assert.match(report.sources.gpu, /WebGPU timestamp queries/);
  // The second frame had no pass: nothing to read, no time.
  assert.equal(report.samples[1].gpuMs, undefined);
  // More passes than pairs of queries: the first 32 are timed.
  profiler.beginFrame();
  for (let i = 0; i < 40; i++) encoder.beginRenderPass({});
  profiler.endFrame(16, 5);
  assert.equal(log.filter(([name, writes]) => name === 'pass' && writes).length, 2 + 1 + 32);
  profiler.dispose();
  assert.equal(env.GPUCommandEncoder.prototype.beginRenderPass, begin);
  assert.ok(log.some(([name, what]) => name === 'destroy' && what === 'queries'));
  assert.ok(log.some(([name, what]) => name === 'destroy' && what === 'ZhudaProfilerRead'));
  // A pass begun after disposal is untouched.
  encoder.beginRenderPass({});
  assert.deepEqual(log.at(-1), ['pass', null]);

  const without = fakeGpu({ timestamps: false });
  const plain = new ZhudaRuntimeProfiler();
  assert.equal(plain.enableGpuTiming(without.device, without.env), false);
  assert.match(plain.report().gpuTimeReason, /timestamp-query unavailable/);
});

// --- The gizmo ------------------------------------------------------------------------
const camera = {
  matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 10, 1],
  fieldOfView: 90,
  aspect: 2,
};

test('a pointer becomes a ray, and a ray finds an axis, a plane and an angle', () => {
  // The middle of the view looks straight down the camera's -Z.
  const middle = zhudaPointerRay(camera, 400, 200, 800, 400);
  close(middle.origin, [0, 0, 10]);
  close(middle.direction, [0, 0, -1]);
  // 90° up and down, twice as wide: the right edge is at 2 for 1 ahead, the top at 1.
  const corner = zhudaPointerRay(camera, 800, 0, 800, 400);
  close(
    corner.direction,
    [2, 1, -1].map((v) => v / Math.sqrt(6)),
  );
  const flat = zhudaPointerRay(
    { ...camera, orthographic: true, orthographicVerticalSize: 4 },
    800,
    400,
    800,
    400,
  );
  close(flat.origin, [4, -2, 10]);
  close(flat.direction, [0, 0, -1]);
  assert.throws(() => zhudaPointerRay(camera, 0, 0, 0, 10), /no size/);

  // A ray down -Z through (3, 1): it passes the x axis 3 along it, 1 above it, 10 from the eye.
  const ray = { origin: [3, 1, 10], direction: [0, 0, -1] };
  const pass = zhudaRayAxis(ray, [0, 0, 0], [5, 0, 0]);
  assert.ok(near(pass.along, 3) && near(pass.distance, 1) && near(pass.rayT, 10));
  assert.equal(zhudaRayAxis(ray, [0, 0, 0], [0, 0, 1]), null, 'parallel');
  // For a drag: the pointer's place along the axis on the screen, however far beside it.
  const beside = zhudaPointerRay(camera, 400 + 70, 200 - 80, 800, 400);
  assert.ok(near(zhudaRayAxis(beside, [0, 0, 0], [1, 0, 0]).along, 3.5 * (100 / 116)));
  assert.ok(near(zhudaAlongAxis(beside, [0, 0, 0], [1, 0, 0], [0, 0, 10]), 3.5));
  // An axis that points at the viewer cannot be dragged along.
  assert.equal(zhudaAlongAxis(beside, [0, 0, 0], [0, 0, 1], [0, 0, 10]), null);
  close(zhudaRayPlane(ray, [0, 0, 2], [0, 0, 1]), [3, 1, 2]);
  assert.equal(zhudaRayPlane(ray, [0, 0, 20], [0, 0, 1]), null, 'behind the eye');
  assert.equal(zhudaRayPlane(ray, [0, 0, 0], [1, 0, 0]), null, 'edge on');

  // A quarter turn round +Z, counter-clockwise seen from its tip, is +90°.
  const turn =
    zhudaAngleRound([0, 1, 0], [0, 0, 0], [0, 0, 1]) -
    zhudaAngleRound([1, 0, 0], [0, 0, 0], [0, 0, 1]);
  assert.ok(near(Math.atan2(Math.sin(turn), Math.cos(turn)), Math.PI / 2));
  // A quarter turn about +Y takes +X to -Z; two of them are a half turn.
  const quarter = zhudaAxisTurn([0, 2, 0], Math.PI / 2);
  close(quarter, [0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  close(zhudaTurnAfter(quarter, quarter), [0, 1, 0, 0]);
});

test('a handle is hit where it is drawn, and nowhere else', () => {
  const axes = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const down = (x, y) => ({ origin: [x, y, 10], direction: [0, 0, -1] });
  assert.equal(zhudaGizmoHit(down(1, 0.05), 'translate', [0, 0, 0], axes, 2), 'x');
  assert.equal(zhudaGizmoHit(down(0.1, 1.5), 'translate', [0, 0, 0], axes, 2), 'y');
  assert.equal(zhudaGizmoHit(down(1, 1), 'translate', [0, 0, 0], axes, 2), null);
  assert.equal(
    zhudaGizmoHit(down(-1, 0), 'translate', [0, 0, 0], axes, 2),
    null,
    'behind the handle',
  );
  assert.equal(zhudaGizmoHit(down(2.5, 0), 'scale', [0, 0, 0], axes, 2), null, 'past its end');
  // The ring about Z is a circle of radius 2 facing the eye.
  assert.equal(zhudaGizmoHit(down(Math.SQRT2, Math.SQRT2), 'rotate', [0, 0, 0], axes, 2), 'z');
  assert.equal(zhudaGizmoHit(down(0.5, 0.5), 'rotate', [0, 0, 0], axes, 2), null);
});

test('a drag moves, turns and scales the node along the handle it began on', () =>
  withLaya((l) => {
    const scene = { addChild() {} };
    const eye = {
      transform: { worldMatrix: { elements: camera.matrix } },
      fieldOfView: 90,
      aspectRatio: 2,
    };
    assert.throws(() => new ZhudaTransformGizmo(scene, {}), /camera is required/);
    assert.equal(
      validateZhudaTransformGizmo({
        mode: 'bend',
        space: 'view',
        size: 2,
        snap: { rotate: 0 },
        onChange: 1,
      }).length,
      5,
    );
    const changes = [];
    const gizmo = new ZhudaTransformGizmo(scene, eye, {
      size: 0.1,
      onChange: (n) => changes.push(n),
    });
    const thing = node(l);
    // Following the node is the caller's: this node's matrix is moved with its position.
    const follow = () => {
      const p = thing.transform.position;
      thing.transform.worldMatrix.elements.splice(12, 3, p.x, p.y, p.z);
    };
    // Nothing attached: nothing to hit, nothing drawn.
    assert.equal(gizmo.pointerDown(400, 200, 800, 400), false);
    gizmo.update();
    assert.equal(l.sprites[0].drawn.length, 0);
    gizmo.attach(thing);
    gizmo.update();
    // Ten away with 90° up and down the view is 20 high: a handle is a tenth of that.
    const handles = l.sprites[0].drawn;
    assert.equal(handles.length, 15);
    assert.deepEqual(handles[0].from, [0, 0, 0]);
    close(handles[0].to, [2, 0, 0], 1e-9);

    // One world unit is 20 pixels here. The pointer goes down on the x arrow, one along it.
    const px = (x, y) => [400 + x * 20, 200 - y * 20, 800, 400];
    assert.equal(
      gizmo.pointerDown(...px(5, 5)),
      false,
      "not on a handle: the pointer is the caller's",
    );
    assert.equal(gizmo.pointerMove(...px(1, 0)), false);
    assert.equal(gizmo.axis, 'x', 'the handle under the pointer lights up');
    gizmo.update();
    assert.deepEqual(l.sprites[0].drawn[0].color, [1, 0.9, 0.1]);
    assert.equal(gizmo.pointerDown(...px(1, 0)), true);
    assert.equal(gizmo.dragging, true);
    assert.equal(gizmo.pointerMove(...px(3.5, 4)), true);
    close(
      [thing.transform.position.x, thing.transform.position.y, thing.transform.position.z],
      [2.5, 0, 0],
      1e-9,
    );
    assert.equal(changes.at(-1), thing);
    gizmo.cancel();
    assert.equal(thing.transform.position.x, 0, 'back where the drag began');
    assert.equal(gizmo.dragging, false);
    // In steps of a half.
    gizmo.set({ snap: { translate: 0.5 } });
    gizmo.pointerDown(...px(1, 0));
    gizmo.pointerMove(...px(1.8, 0));
    assert.equal(thing.transform.position.x, 1);
    gizmo.pointerUp();
    follow();
    gizmo.update();
    assert.deepEqual(l.sprites[0].drawn[0].from, [1, 0, 0], 'the handles go with the node');

    // A turn: down on the ring about Z at its right, dragged a quarter of the way round.
    gizmo.set({ mode: 'rotate', snap: undefined });
    assert.equal(gizmo.pointerDown(...px(1 + 2, 0)), true);
    assert.equal(gizmo.axis, 'z');
    gizmo.pointerMove(...px(1, 2));
    const q = thing.transform.rotation;
    close(
      [q.x, q.y, q.z, q.w],
      [0, 0, Math.SQRT1_2, Math.SQRT1_2],
      1e-9,
      'a quarter turn about +Z',
    );
    gizmo.pointerUp();
    // In steps of 45°: 30° round is nearer 45° than nothing.
    gizmo.set({ snap: { rotate: 45 } });
    thing.transform.rotation = new l.Quaternion();
    gizmo.pointerDown(...px(1 + 2, 0));
    gizmo.pointerMove(...px(1 + 2 * Math.cos(Math.PI / 6), 2 * Math.sin(Math.PI / 6)));
    close(
      [thing.transform.rotation.z, thing.transform.rotation.w],
      [Math.sin(Math.PI / 8), Math.cos(Math.PI / 8)],
      1e-9,
    );
    gizmo.pointerUp();

    // A scale: the y handle pulled to one and a half times its length.
    gizmo.set({ mode: 'scale', snap: undefined });
    assert.equal(gizmo.pointerDown(...px(1, 2)), true);
    gizmo.pointerMove(...px(1, 3));
    close(
      [thing.transform.localScale.x, thing.transform.localScale.y, thing.transform.localScale.z],
      [1, 1.5, 1],
      1e-9,
    );
    gizmo.pointerMove(...px(1, -30));
    assert.equal(thing.transform.localScale.y, 0.001, 'never through nothing');
    gizmo.pointerUp();

    // Twice as far, the handles are twice as long: the same size on the screen.
    thing.transform.worldMatrix.elements.splice(12, 3, 0, 0, -10);
    gizmo.set({ mode: 'translate' });
    gizmo.update();
    close(l.sprites[0].drawn[0].to, [4, 0, -10], 1e-9);
    // A node of its own axes: a quarter turn about Y points its x handle down -Z.
    thing.transform.worldMatrix.elements.splice(0, 12, 0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0);
    gizmo.set({ space: 'local' });
    gizmo.update();
    close(l.sprites[0].drawn[0].to, [0, 0, -14], 1e-9);

    gizmo.attach(null);
    assert.equal(gizmo.pointerDown(...px(0, 0)), false);
    assert.throws(() => gizmo.attach({}), /3D node is required/);
    gizmo.dispose();
    assert.equal(l.sprites[0].destroyed, true);
    assert.equal(gizmo.pointerDown(...px(1, 0)), false);
  }));
