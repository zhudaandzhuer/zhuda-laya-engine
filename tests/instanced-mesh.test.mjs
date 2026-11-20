import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ZHUDA_INSTANCE_TINT_DEFINE,
  ZhudaInstancedMesh,
  registerZhudaInstanceTintShader,
  zhudaInstanceCells,
  zhudaPlacementMatrices,
} from '../packages/core/runtime3d/InstancedMesh.ts';
import { zhudaBakedLayout, zhudaCrowdFrame } from '../packages/core/runtime3d/BakedCrowd.ts';
import { installLaya342WebGPUFix } from '../packages/core/runtime3d/WebGPU342Adapters.ts';
import { validateZhudaFilmScene } from '../packages/core/film/FilmScene.ts';
import { zhudaSrgbToLinear } from '../packages/core/runtime3d/Surfaces.ts';

const close = (got, want, what) =>
  assert.ok(
    got.length === want.length && got.every((v, i) => Math.abs(v - want[i]) < 1e-6),
    `${what}: ${[...got]} against ${want}`,
  );
/** Where a matrix puts a point. */
const through = (m, p) =>
  [0, 1, 2].map((row) => m[row] * p[0] + m[4 + row] * p[1] + m[8 + row] * p[2] + m[12 + row]);

test('a placement is a move, a turn about +Y and a size, under a parent and over a local matrix', () => {
  const identity = zhudaPlacementMatrices([[0, 0, 0, 0, 1]]);
  close(identity, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 'no placement');
  const [moved] = [zhudaPlacementMatrices([[3, 4, 5, 0, 2]])];
  close(through(moved, [1, 1, 1]), [5, 6, 7], 'sized, then moved');
  // A quarter turn about +Y takes +X to -Z, as a node with that euler rotation does.
  const turned = zhudaPlacementMatrices([[0, 0, 0, 90, 1]]);
  close(through(turned, [1, 0, 0]), [0, 0, -1], 'a quarter turn');
  close(through(turned, [0, 0, 1]), [1, 0, 0], 'a quarter turn');
  // parent * place * local: the local matrix is applied first, the parent last.
  const local = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1];
  const parent = [2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 2, 0, 10, 0, 0, 1];
  const all = zhudaPlacementMatrices([[1, 0, 0, 0, 1]], parent, local);
  close(through(all, [0, 0, 0]), [12, 2, 0], 'local, placement, parent');
  const many = zhudaPlacementMatrices([
    [0, 0, 0, 0, 1],
    [7, 0, 0, 0, 1],
  ]);
  assert.equal(many.length, 32);
  assert.equal(many[16 + 12], 7);
  assert.throws(() => zhudaPlacementMatrices([[0, 0, 0, 0]]), /\[0\] is not/);
  assert.throws(() => zhudaPlacementMatrices([[0, 0, 0, 0, 0]]), /\[0\] is not/);
  assert.throws(() => zhudaPlacementMatrices([[0, NaN, 0, 0, 1]]), /\[0\] is not/);
  assert.throws(() => zhudaPlacementMatrices('x'), /list of placements/);
  assert.throws(() => zhudaPlacementMatrices([[0, 0, 0, 0, 1]], [1, 2, 3]), /16 finite numbers/);
});

test('copies are grouped by the square they stand on, in a fixed order, with their box', () => {
  const places = [
    [1, 0, 1, 0, 1],
    [40, 0, 1, 0, 1],
    [2, 0, 2, 0, 1],
    [1, 0, 40, 0, 1],
    [-1, 0, 1, 0, 1],
  ];
  const matrices = zhudaPlacementMatrices(places);
  const cells = zhudaInstanceCells(matrices, [-0.5, 0, -0.5], [0.5, 2, 0.5], 32);
  // By row of squares (Z), then along it (X); inside a group by place in the list.
  assert.deepEqual(
    cells.map((cell) => cell.indices),
    [[4], [0, 2], [1], [3]],
  );
  close(cells[1].min, [0.5, 0, 0.5], 'the box round two copies');
  close(cells[1].max, [2.5, 2, 2.5], 'the box round two copies');
  // The same input, the same groups.
  assert.deepEqual(zhudaInstanceCells(matrices, [-0.5, 0, -0.5], [0.5, 2, 0.5], 32), cells);
  // At most so many to a group: a crowded square is several groups.
  const crowd = zhudaPlacementMatrices(Array.from({ length: 10 }, (_, i) => [i * 0.1, 0, 0, 0, 1]));
  assert.deepEqual(
    zhudaInstanceCells(crowd, [0, 0, 0], [1, 1, 1], 32, 4).map((cell) => cell.indices.length),
    [4, 4, 2],
  );
  // A turned, sized copy: its box is the box of the turned box.
  const turned = zhudaPlacementMatrices([[0, 0, 0, 45, 2]]);
  const [cell] = zhudaInstanceCells(turned, [-1, 0, -1], [1, 1, 1], 32);
  close(cell.min, [-2 * Math.SQRT2, 0, -2 * Math.SQRT2], 'a turned box');
  close(cell.max, [2 * Math.SQRT2, 2, 2 * Math.SQRT2], 'a turned box');
  // Anchors say where a copy counts as standing: two meshes of one model fall into the same groups.
  const anchors = new Float32Array([1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1]);
  assert.deepEqual(
    zhudaInstanceCells(matrices, [-0.5, 0, -0.5], [0.5, 2, 0.5], 32, 1024, anchors).map(
      (cell) => cell.indices,
    ),
    [[0, 1, 2, 3, 4]],
  );
  assert.throws(() => zhudaInstanceCells(new Float32Array(5), [0, 0, 0], [1, 1, 1]), /16 numbers/);
  assert.throws(() => zhudaInstanceCells(matrices, [0, 0], [1, 1, 1]), /two points/);
  assert.throws(() => zhudaInstanceCells(matrices, [0, 0, 0], [1, 1, 1], 0), /cellMeters/);
  assert.throws(() => zhudaInstanceCells(matrices, [0, 0, 0], [1, 1, 1], 32, 0), /maxPerCell/);
  assert.throws(
    () => zhudaInstanceCells(matrices, [0, 0, 0], [1, 1, 1], 32, 8, new Float32Array(3)),
    /three numbers a copy/,
  );
});

/** As much of LayaAir as an instanced mesh touches; buffers keep what they were given. */
function fakeLaya() {
  const live = { nodes: 0, buffers: 0, states: 0, geometries: 0 };
  class Vector3 {
    constructor(x, y, z) {
      Object.assign(this, { x, y, z });
    }
  }
  const defines = new Map();
  const laya = {
    live,
    Vector3,
    Bounds: class {
      constructor(min, max) {
        Object.assign(this, { min, max });
      }
    },
    BufferUsage: { Static: 1 },
    VertexElementFormat: { Vector4: 'vec4' },
    VertexElement: class {
      constructor(offset, format, usage) {
        Object.assign(this, { offset, format, usage });
      }
    },
    VertexDeclaration: class {
      constructor(stride, elements) {
        Object.assign(this, { stride, elements });
      }
    },
    VertexMesh: {
      instanceWorldMatrixDeclaration: 'world',
      instanceLightMapScaleOffsetDeclaration: 'lightmap',
    },
    MeshSprite3DShaderDeclaration: { SHADERDEFINE_GPU_INSTANCE: 'GPU_INSTANCE' },
    Shader3D: {
      getDefineByName: (name) => {
        if (!defines.has(name)) defines.set(name, name);
        return defines.get(name);
      },
    },
    Laya3DRender: {
      renderOBJCreate: {
        createVertexBuffer3D(bytes) {
          live.buffers++;
          return {
            bytes,
            setData(buffer) {
              this.data = new Float32Array(buffer.slice(0));
            },
            destroy() {
              live.buffers--;
            },
          };
        },
      },
    },
    BufferState: class {
      constructor() {
        live.states++;
      }
      applyState(buffers, index) {
        Object.assign(this, { buffers, index });
      }
      destroy() {
        live.states--;
      }
    },
    MeshInstanceGeometry: class {
      constructor(subMesh) {
        this.subMesh = subMesh;
        live.geometries++;
      }
      destroy() {
        live.geometries--;
      }
    },
    MeshSprite3D: class {
      constructor(mesh) {
        live.nodes++;
        this.mesh = mesh;
        const elements = Array.from({ length: mesh.subMeshCount }, () => ({
          _renderElementOBJ: { canDynamicBatch: true },
          setGeometry(geometry) {
            this.geometry = geometry;
          },
        }));
        this.meshRenderer = {
          _renderElements: elements,
          _baseRenderNode: {
            shaderData: {
              defines: [],
              addDefine(define) {
                this.defines.push(define);
              },
            },
          },
        };
      }
      destroy() {
        this.destroyed = true;
        live.nodes--;
      }
    },
  };
  return laya;
}
const fakeMesh = (subMeshCount = 1) => ({
  subMeshCount,
  bounds: { getMin: () => ({ x: -0.5, y: 0, z: -0.5 }), getMax: () => ({ x: 0.5, y: 1, z: 0.5 }) },
  _bufferState: { _vertexBuffers: ['mesh-vertices'] },
  _indexBuffer: 'mesh-indices',
  getSubMesh: (i) => 'sub' + i,
});

test('an instanced mesh makes one node a group, with the copies in an instance buffer', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const added = [];
    // A parent moved 10 along X: places under it are drawn 10 further on.
    const parent = {
      addChild: (node) => added.push(node),
      transform: { worldMatrix: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1] } },
    };
    const material = { shader: { name: 'PBR' } };
    const matrices = zhudaPlacementMatrices([
      [1, 0, 1, 0, 1],
      [40, 0, 1, 0, 2],
      [2, 0, 2, 0, 1],
    ]);
    const mesh = fakeMesh(2);
    const instanced = new ZhudaInstancedMesh(parent, mesh, material, matrices, { label: 'Props' });
    assert.deepEqual(instanced.stats, { copies: 3, groups: 2, drawsPerPass: 4 });
    assert.equal(instanced.count, 3);
    assert.deepEqual(
      instanced.groups.map((group) => group.count),
      [2, 1],
    );
    assert.deepEqual(
      added.map((node) => node.name),
      ['Props:0', 'Props:1'],
    );
    const [first, second] = instanced.groups;
    const renderer = first.renderer;
    assert.deepEqual(
      renderer.sharedMaterials,
      [material, material],
      'one material for each sub-mesh',
    );
    assert.equal(renderer.castShadow, true);
    assert.equal(renderer.receiveShadow, true);
    assert.deepEqual(renderer._baseRenderNode.shaderData.defines, ['GPU_INSTANCE']);
    for (const element of renderer._renderElements) {
      assert.equal(
        element._renderElementOBJ.canDynamicBatch,
        false,
        "kept out of LayaAir's batches",
      );
      assert.equal(element.geometry.instanceCount, 2);
    }
    // One buffer state for both sub-meshes: the mesh's own buffers, then the copies'.
    const state = renderer._renderElements[0].geometry.bufferState;
    assert.equal(renderer._renderElements[1].geometry.bufferState, state);
    assert.equal(state.index, 'mesh-indices');
    assert.equal(state.buffers[0], 'mesh-vertices');
    const [, world, lightmap] = state.buffers;
    assert.equal(world.vertexDeclaration, 'world');
    assert.equal(world.instanceBuffer, true);
    assert.equal(lightmap.vertexDeclaration, 'lightmap');
    // Twenty numbers a copy: its matrix in the world (the parent's 10 added), then 1.
    assert.equal(world.data.length, 40);
    close([...world.data.slice(12, 17)], [11, 0, 1, 1, 1], 'the first copy');
    close([...world.data.slice(20 + 12, 20 + 17)], [12, 0, 2, 1, 1], 'the second copy');
    close([...lightmap.data], [1, 1, 0, 0, 1, 1, 0, 0], 'no lightmap');
    // The box is in the parent's space, where the node is.
    close(
      [renderer.geometryBounds.min.x, renderer.geometryBounds.min.z, renderer.geometryBounds.max.x],
      [0.5, 0.5, 2.5],
      'the group box',
    );
    close(second.centre, [40, 1, 1], 'a group of one sized 2');
    assert.deepEqual(laya.live, { nodes: 2, buffers: 4, states: 2, geometries: 4 });
    instanced.dispose();
    instanced.dispose();
    assert.deepEqual(laya.live, { nodes: 0, buffers: 0, states: 0, geometries: 0 });

    const options = { castShadow: false, receiveShadow: false, cellMeters: 1000, layer: 5 };
    const one = new ZhudaInstancedMesh(parent, fakeMesh(), [material], matrices, options);
    assert.equal(one.groups.length, 1);
    assert.equal(one.groups[0].renderer.castShadow, false);
    assert.equal(one.groups[0].renderer.receiveShadow, false);
    assert.equal(one.groups[0].node.layer, 5);
    one.dispose();
  } finally {
    globalThis.Laya = before;
  }
});

test('asked to follow, the copies are placed again once after the parent has moved', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  globalThis.Laya = laya;
  // Group nodes say when anything above them moved, and LayaAir calls later before it draws.
  const listeners = [],
    later = [];
  laya.Event = { TRANSFORM_CHANGED: 'transformchanged' };
  laya.timer = { callLater: (caller, method) => later.push(() => method.call(caller)) };
  const Node = laya.MeshSprite3D;
  laya.MeshSprite3D = class extends Node {
    transform = {
      on: (type, caller, method) => listeners.push({ type, caller, method }),
      off: (type, caller, method) => {
        const at = listeners.findIndex((l) => l.caller === caller && l.method === method);
        if (at >= 0) listeners.splice(at, 1);
      },
    };
  };
  try {
    const world = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 0, 0, 1];
    const parent = { addChild() {}, transform: { worldMatrix: { elements: world } } };
    const matrices = zhudaPlacementMatrices([
      [1, 0, 1, 0, 1],
      [2, 0, 2, 0, 1],
    ]);
    const places = (mesh) => {
      const data = mesh.groups[0].renderer._renderElements[0].geometry.bufferState.buffers[1].data;
      return [data[12], data[13], data[14], data[32], data[33], data[34]];
    };
    // Not asked: nothing listens, and a parent that moves leaves them where they were.
    const still = new ZhudaInstancedMesh(parent, fakeMesh(), {}, matrices);
    assert.equal(listeners.length, 0);
    still.refresh();
    assert.deepEqual(places(still), [11, 0, 1, 12, 0, 2]);
    still.dispose();
    const following = new ZhudaInstancedMesh(parent, fakeMesh(), {}, matrices, { follow: true });
    assert.deepEqual(places(following), [11, 0, 1, 12, 0, 2]);
    assert.equal(listeners.length, 1, 'one listener, on a group node');
    // The caller's matrices are kept as they were given: changing them afterwards changes nothing.
    matrices[12] = 99;
    // Moved three times before a frame: placed again once.
    world[12] = 20;
    world[13] = 5;
    for (let i = 0; i < 3; i++) listeners[0].method.call(listeners[0].caller);
    assert.equal(later.length, 1);
    assert.deepEqual(places(following), [11, 0, 1, 12, 0, 2], 'not before the frame');
    later.shift()();
    assert.deepEqual(places(following), [21, 5, 1, 22, 5, 2]);
    // And again after the next move; at once when asked.
    world[12] = 0;
    listeners[0].method.call(listeners[0].caller);
    assert.equal(later.length, 1);
    following.refresh();
    assert.deepEqual(places(following), [1, 5, 1, 2, 5, 2]);
    // Disposed: it listens no more, and a call that was still to come does nothing.
    listeners[0].method.call(listeners[0].caller);
    following.dispose();
    assert.equal(listeners.length, 0);
    for (const call of later.splice(0)) call();
    assert.deepEqual(laya.live, { nodes: 0, buffers: 0, states: 0, geometries: 0 });
  } finally {
    globalThis.Laya = before;
  }
});

test('tints go with a material of the lit template and are refused otherwise', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  globalThis.Laya = laya;
  try {
    const parent = { addChild() {} };
    const matrices = zhudaPlacementMatrices([
      [0, 0, 0, 0, 1],
      [1, 0, 0, 0, 1],
    ]);
    const tints = new Float32Array([1, 0.5, 0, 1, 0, 0, 1, 0.25]);
    const stock = { shader: { name: 'PBR' } };
    assert.throws(
      () => new ZhudaInstancedMesh(parent, fakeMesh(), stock, matrices, { tints }),
      /tints need materials from ZhudaLitSurfaceMaterial/,
    );
    registerZhudaInstanceTintShader(laya, 'ZhudaLitThing');
    const lit = { shader: { name: 'ZhudaLitThing' } };
    const instanced = new ZhudaInstancedMesh(parent, fakeMesh(), lit, matrices, { tints });
    const renderer = instanced.groups[0].renderer;
    assert.deepEqual(renderer._baseRenderNode.shaderData.defines, [
      'GPU_INSTANCE',
      ZHUDA_INSTANCE_TINT_DEFINE,
    ]);
    const tint = renderer._renderElements[0].geometry.bufferState.buffers[3];
    assert.equal(tint.vertexDeclaration.elements[0].usage, 15, 'the fourth custom attribute');
    // Display colours, handed to the shader linear; the spare number as it is.
    close([...tint.data], [1, zhudaSrgbToLinear(0.5), 0, 1, 0, 0, 1, 0.25], 'tints');
    instanced.dispose();
    assert.throws(
      () =>
        new ZhudaInstancedMesh(parent, fakeMesh(), lit, matrices, { tints: new Float32Array(4) }),
      /four numbers a copy/,
    );
    assert.throws(
      () =>
        new ZhudaInstancedMesh(parent, fakeMesh(), lit, matrices, {
          tints: new Float32Array(8).fill(-1),
        }),
      /tints 0\.\.16/,
    );
    assert.deepEqual(laya.live, { nodes: 0, buffers: 0, states: 0, geometries: 0 });
  } finally {
    globalThis.Laya = before;
  }
});

test('an instanced mesh refuses what it cannot draw and leaves nothing behind', () => {
  const laya = fakeLaya();
  const before = globalThis.Laya;
  const one = zhudaPlacementMatrices([[0, 0, 0, 0, 1]]);
  const material = { shader: { name: 'PBR' } };
  const parent = { addChild() {} };
  try {
    globalThis.Laya = {};
    assert.throws(
      () => new ZhudaInstancedMesh(parent, fakeMesh(), material, one),
      /3D render module/,
    );
    globalThis.Laya = laya;
    assert.throws(() => new ZhudaInstancedMesh(null, fakeMesh(), material, one), /parent node/);
    assert.throws(() => new ZhudaInstancedMesh(parent, {}, material, one), /live LayaAir mesh/);
    assert.throws(
      () => new ZhudaInstancedMesh(parent, fakeMesh(), material, new Float32Array(0)),
      /at least one copy/,
    );
    assert.throws(
      () => new ZhudaInstancedMesh(parent, fakeMesh(), material, new Float32Array(16).fill(NaN)),
      /finite/,
    );
    assert.throws(
      () => new ZhudaInstancedMesh(parent, fakeMesh(1), [material, material], one),
      /one live material, or one a sub-mesh \(1\)/,
    );
    assert.throws(
      () => new ZhudaInstancedMesh(parent, fakeMesh(), { destroyed: true }, one),
      /one live material/,
    );
    // A mirrored copy would need the other facing, and a group is one draw.
    const mirrored = new Float32Array([-1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    assert.throws(() => new ZhudaInstancedMesh(parent, fakeMesh(), material, mirrored), /mirrored/);
    assert.deepEqual(
      laya.live,
      { nodes: 0, buffers: 0, states: 0, geometries: 0 },
      'a refusal leaves nothing',
    );
  } finally {
    globalThis.Laya = before;
  }
});

test('on WebGPU renderers that cast shadows stay out of the batches LayaAir never shadows', () => {
  class Agent {
    _canBatch(element) {
      return element.batchable;
    }
    appendRenderElement() {
      return 'appended';
    }
  }
  const native = { WebGPUMeshRenderBatchAgent: Agent, Stat: { loopCount: 1 } };
  installLaya342WebGPUFix(native);
  installLaya342WebGPUFix(native);
  const agent = new Agent();
  assert.equal(agent._canBatch({ batchable: true, owner: { castShadow: false } }), true);
  assert.equal(agent._canBatch({ batchable: true, owner: { castShadow: true } }), false);
  assert.equal(agent._canBatch({ batchable: false, owner: { castShadow: false } }), false);
  assert.equal(
    agent._canBatch({ batchable: true }),
    true,
    'an element without an owner is as before',
  );
  assert.equal(agent.appendRenderElement(), 'appended');
});

test('a film scene takes instanced copies only with placements', () => {
  const scene = (model) => ({
    schemaVersion: 1,
    id: 'instanced-check',
    camera: { eye: [0, 1, 6], target: [0, 1, 0], focalLengthMm: 35 },
    nodes: [{ id: 'ferns', type: 'model', asset: 'set/fern.glb', position: [0, 0, 0], ...model }],
  });
  const issues = (model) =>
    validateZhudaFilmScene(scene(model)).filter((issue) => /instanced/.test(issue));
  assert.deepEqual(issues({ placements: [[0, 0, 0, 0, 1]], instanced: true }), []);
  assert.deepEqual(issues({ placements: [[0, 0, 0, 0, 1]] }), []);
  assert.equal(issues({ instanced: true }).length, 1);
  assert.match(issues({ instanced: true })[0], /needs placements/);
  assert.match(issues({ placements: [[0, 0, 0, 0, 1]], instanced: 'yes' })[0], /true or false/);
});

test('a film scene model node takes a cell size, a cull distance and no shadow', () => {
  const scene = (model) => ({
    schemaVersion: 1,
    id: 'model-distance-check',
    camera: { eye: [0, 1, 6], target: [0, 1, 0], focalLengthMm: 35 },
    nodes: [{ id: 'pines', type: 'model', asset: 'set/pine.glb', position: [0, 0, 0], ...model }],
  });
  const issues = (model) =>
    validateZhudaFilmScene(scene(model)).filter((issue) => /nodes\[0\]/.test(issue));
  const copies = { placements: [[0, 0, 0, 0, 1]] };
  assert.deepEqual(
    issues({ ...copies, instanced: true, cellMeters: 1000, cullMeters: 4000, castShadow: false }),
    [],
  );
  // On a single model too: a distance and no shadow need no copies.
  assert.deepEqual(issues({ cullMeters: 60, castShadow: false }), []);
  assert.match(issues({ ...copies, cellMeters: 64 })[0], /cellMeters: needs instanced/);
  assert.match(issues({ ...copies, instanced: true, cellMeters: 0.1 })[0], /cellMeters: use 0\.5/);
  assert.match(issues({ ...copies, instanced: true, cellMeters: '64' })[0], /cellMeters: use 0\.5/);
  assert.match(issues({ castShadow: 0 })[0], /castShadow: true or false/);
  assert.match(issues({ cullMeters: 0 })[0], /cullMeters: use a distance above 0/);
  assert.match(issues({ cullMeters: 200000 })[0], /cullMeters: use a distance above 0/);
  assert.match(
    issues({ cullMeters: 60, lightmap: 'set/pine.hdr' }).find((issue) => /cullMeters/.test(issue)),
    /cullMeters: not with lightmap/,
  );
});

test('a film scene prop node takes a shadow switch, a cull distance and levels', () => {
  const scene = (prop) => ({
    schemaVersion: 1,
    id: 'prop-distance-check',
    camera: { eye: [0, 1, 6], target: [0, 1, 0], focalLengthMm: 35 },
    nodes: [{ id: 'crowd', type: 'prop', prop: 'people', position: [0, 0, 0], ...prop }],
  });
  const issues = (prop) =>
    validateZhudaFilmScene(scene(prop)).filter((issue) =>
      /nodes\[0\]\.(castShadow|cullMeters|lod)/.test(issue),
    );
  assert.deepEqual(
    issues({
      castShadow: false,
      cullMeters: 120,
      lod: [
        { fromMeters: 15, params: { detail: 0.5 } },
        { fromMeters: 40, params: { detail: 0 } },
      ],
    }),
    [],
  );
  assert.match(issues({ castShadow: 'no' })[0], /castShadow: true or false/);
  assert.match(issues({ cullMeters: -1 })[0], /cullMeters: beyond the last level/);
  assert.match(
    issues({ cullMeters: 30, lod: [{ fromMeters: 40, params: {} }] })[0],
    /cullMeters: beyond the last level/,
  );
  assert.match(
    issues({
      lod: [
        { fromMeters: 40, params: {} },
        { fromMeters: 20, params: {} },
      ],
    })[0],
    /lod\[1\]\.fromMeters: must rise/,
  );
  assert.match(issues({ lod: [] })[0], /lod: one to four levels/);
  assert.match(issues({ lod: [{ fromMeters: 10 }] })[0], /lod\[0\]\.params: object required/);
  assert.match(issues({ lod: [{ fromMeters: 10, params: {}, extra: 1 }] }).join(' '), /lod\[0\]/);
});

test('a film scene takes a grass node: an area, level ground, strips kept clear', () => {
  const scene = (grass) => ({
    schemaVersion: 1,
    id: 'grass-node-check',
    camera: { eye: [0, 1, 6], target: [0, 1, 0], focalLengthMm: 35 },
    nodes: [
      { id: 'meadow', type: 'grass', area: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 }, ...grass },
    ],
  });
  const issues = (grass) =>
    validateZhudaFilmScene(scene(grass)).filter((issue) => /nodes\[0\]/.test(issue));
  assert.deepEqual(issues({}), []);
  assert.deepEqual(
    issues({
      y: 2,
      clear: [{ minX: -1, maxX: 1, minZ: -10, maxZ: 10 }],
      avoidSolids: false,
      density: 300,
      heightM: [0.1, 0.3],
      distanceM: 50,
      tip: [0.4, 0.6, 0.2],
      dryness: 0.2,
      wind: { directionDeg: 30, strength: 0.4 },
      seed: 7,
      turf: false,
    }),
    [],
  );
  assert.match(issues({ area: { minX: 5, maxX: 1, minZ: 0, maxZ: 1 } })[0], /area: minX < maxX/);
  assert.match(issues({ density: 5 })[0], /density: 20\.\.1500/);
  assert.match(issues({ y: 'low' })[0], /\.y: a height in metres/);
  assert.match(
    issues({ clear: [{ minX: 2, maxX: 1, minZ: 0, maxZ: 1 }] })[0],
    /clear: up to 32 rectangles/,
  );
  assert.match(issues({ avoidSolids: 'yes' })[0], /avoidSolids: true or false/);
  assert.match(issues({ ground: 3 }).join(' '), /nodes\[0\]/);
});

test('a baked animation is laid out clip after clip, frame after frame, four texels a bone', () => {
  const layout = zhudaBakedLayout(
    [
      { name: 'Walk', seconds: 1 },
      { name: 'Wave', seconds: 0.5 },
    ],
    [12, 3],
    30,
  );
  // Fifteen bones in all: a frame is sixty texels; the second mesh's bones begin after the first's.
  assert.equal(layout.frameTexels, 60);
  assert.deepEqual(layout.bases, [0, 12]);
  // A second at 30 frames is 30 steps and the frame of its end.
  assert.deepEqual(layout.clips, [
    { name: 'Walk', seconds: 1, frames: 31, start: 0 },
    { name: 'Wave', seconds: 0.5, frames: 16, start: 31 * 60 },
  ]);
  assert.equal(layout.texels, 47 * 60);
  // The smallest power of two that holds them: a matrix never straddles two rows.
  assert.equal(layout.size, 64);
  assert.ok(layout.size * layout.size >= layout.texels && layout.size % 4 === 0);
  assert.equal(zhudaBakedLayout([{ name: 'A', seconds: 0.01 }], [1]).clips[0].frames, 2);
  assert.equal(zhudaBakedLayout([{ name: 'A', seconds: 2 }], [1], 10).clips[0].frames, 21);
  assert.throws(() => zhudaBakedLayout([], [1]), /1\.\.64 clips/);
  assert.throws(() => zhudaBakedLayout([{ name: 'A', seconds: 1 }], []), /skinned meshes/);
  assert.throws(() => zhudaBakedLayout([{ name: 'A', seconds: 1 }], [0]), /bones/);
  assert.throws(() => zhudaBakedLayout([{ name: 'A', seconds: 0 }], [1]), /must last/);
  assert.throws(
    () =>
      zhudaBakedLayout(
        [
          { name: 'A', seconds: 1 },
          { name: 'A', seconds: 1 },
        ],
        [1],
      ),
    /name of its own/,
  );
  assert.throws(() => zhudaBakedLayout([{ name: 'A', seconds: 1 }], [1], 0), /fps/);
  // Ten minutes of a thousand bones is more than a texture holds.
  assert.throws(() => zhudaBakedLayout([{ name: 'A', seconds: 600 }], [1000], 60), /do not fit/);
});

test('a copy of a crowd shows the frame of its clip at the time it is given, and goes round', () => {
  const clip = { seconds: 1, frames: 31 };
  assert.equal(zhudaCrowdFrame(clip, 0), 0);
  assert.equal(zhudaCrowdFrame(clip, 0.5), 15);
  assert.equal(zhudaCrowdFrame(clip, 0.9), 27);
  // The frame of the end is the frame of the beginning of the next round.
  assert.equal(zhudaCrowdFrame(clip, 1), 0);
  assert.equal(zhudaCrowdFrame(clip, 1.5), 15);
  assert.equal(zhudaCrowdFrame(clip, 0.999), 29);
  // A copy that began later, or plays faster or backwards in time.
  assert.equal(zhudaCrowdFrame(clip, 0.5, 0.25), 22);
  assert.equal(zhudaCrowdFrame(clip, 0.25, 0, 2), 15);
  assert.equal(zhudaCrowdFrame(clip, -0.5), 15);
  assert.equal(zhudaCrowdFrame(clip, 3, 0, 0), 0, 'a copy that stands still');
  assert.equal(zhudaCrowdFrame({ seconds: 1, frames: 1 }, 0.7), 0, 'a clip of one frame');
  // The same time, the same frame: it keeps no clock.
  assert.equal(zhudaCrowdFrame(clip, 12.3456, 0.1, 1.3), zhudaCrowdFrame(clip, 12.3456, 0.1, 1.3));
  assert.throws(() => zhudaCrowdFrame(clip, NaN), /finite/);
});
