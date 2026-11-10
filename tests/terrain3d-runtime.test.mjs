import test from 'node:test';
import assert from 'node:assert/strict';
import { ZhudaHeightfield, ZhudaTerrain3D } from '../packages/core/terrain/index.ts';

// Minimal Laya 3.4.2 surface used by ZhudaDynamicMesh/ZhudaTerrain3D. It records
// uploads and destruction so lifecycle and dirty propagation are observable.
function installLaya() {
  const log = { uploads: 0, destroyedNodes: 0, destroyedMeshes: 0, roots: [] };
  const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  class Node {
    constructor(name) {
      this.name = name;
      this.children = [];
      this.destroyed = false;
      this.transform = { worldMatrix: { elements: identity() } };
    }
    addChild(child) {
      this.children.push(child);
      child.parent = this;
    }
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      log.destroyedNodes++;
      if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    }
  }
  class Sprite3D extends Node {
    constructor(name) {
      super(name);
      log.roots.push(this);
    }
  }
  class MeshSprite3D extends Node {
    constructor(mesh) {
      super('mesh');
      this.mesh = mesh;
      this.meshRenderer = {};
    }
  }
  const previous = globalThis.Laya;
  globalThis.Laya = {
    Sprite3D,
    MeshSprite3D,
    Vector3: class {
      constructor(x, y, z) {
        Object.assign(this, { x, y, z });
      }
    },
    Bounds: class {
      constructor(min, max) {
        Object.assign(this, { min, max });
      }
    },
    VertexMesh: { getVertexDeclaration: (s) => s },
    PrimitiveMesh: {
      _createMesh: (declaration, vertices, indices) => ({
        declaration,
        vertices,
        indices,
        _vertexBuffer: { setData: () => log.uploads++ },
        destroy: () => log.destroyedMeshes++,
      }),
    },
  };
  return { log, restore: () => (globalThis.Laya = previous) };
}

const material = { destroyed: false };
const flat = (cells, h = 0) =>
  new ZhudaHeightfield({
    schemaVersion: 1,
    dimension: 3,
    cellsX: cells,
    cellsZ: cells,
    cellSize: 1,
    heights: Array((cells + 1) * (cells + 1)).fill(h),
  });
const down = (x, z) => ({ origin: { x, y: 50, z }, direction: { x: 0, y: -1, z: 0 } });

test('terrain rejects invalid materials, chunk sizes, budgets, UV scales and solids', () => {
  const { restore } = installLaya();
  try {
    const field = flat(8);
    assert.throws(() => new ZhudaTerrain3D(field, {}), /live terrain material/);
    assert.throws(() => new ZhudaTerrain3D(field, { material: { destroyed: true } }), /live/);
    assert.throws(() => new ZhudaTerrain3D(field, { material, chunkCells: 6 }), /multiple of 4/);
    assert.throws(() => new ZhudaTerrain3D(field, { material, maxResidentChunks: 0 }), /budget/);
    assert.throws(() => new ZhudaTerrain3D(field, { material, uvScale: [1, NaN] }), /UV/);
    assert.throws(() => new ZhudaTerrain3D(field, { material, solid: { depth: 0 } }), /solid/);
  } finally {
    restore();
  }
});

test('terrain keeps only required chunks, enforces its budget and rebuilds on stride change', () => {
  const { log, restore } = installLaya();
  try {
    const terrain = new ZhudaTerrain3D(flat(16), { material, chunkCells: 4, maxResidentChunks: 4 });
    terrain.setRegion({ minX: 0, minZ: 0, maxX: 8, maxZ: 8 });
    assert.equal(terrain.report().residentChunks, 4);
    assert.equal(terrain.report().vertices, 4 * 25);
    assert.deepEqual(terrain.chunkSnapshot('1:1').xs, [4, 5, 6, 7, 8]);
    assert.equal(terrain.chunkSnapshot('3:3'), null);
    assert.throws(
      () => terrain.setRegion({ minX: 0, minZ: 0, maxX: 16, maxZ: 16 }),
      /resident chunk budget/,
    );
    assert.throws(() => terrain.setRegion({ minX: 2, minZ: 0, maxX: 1, maxZ: 4 }), /Invalid/);
    const destroyedBefore = log.destroyedMeshes;
    terrain.setRegion({ minX: 0, minZ: 0, maxX: 8, maxZ: 8 }, 2);
    assert.equal(log.destroyedMeshes - destroyedBefore, 4, 'stride change rebuilds every chunk');
    assert.deepEqual(terrain.chunkSnapshot('0:0').xs, [0, 2, 4]);
    terrain.setRegion({ minX: 0, minZ: 0, maxX: 4, maxZ: 4 }, 2);
    assert.equal(terrain.report().residentChunks, 1, 'chunks outside the region are released');
    terrain.dispose();
  } finally {
    restore();
  }
});

test('height edits mark only intersecting chunks dirty and flush uploads matching vertices', () => {
  const { log, restore } = installLaya();
  try {
    const field = flat(8);
    const terrain = new ZhudaTerrain3D(field, { material, chunkCells: 4 });
    terrain.setRegion({ minX: 0, minZ: 0, maxX: 8, maxZ: 8 });
    const uploads = log.uploads;
    field.setHeight(1, 1, 3);
    terrain.flush();
    assert.equal(
      log.uploads - uploads,
      1,
      'only the chunk containing (1,1) and its border uploads',
    );
    const snapshot = terrain.chunkSnapshot('0:0');
    const k = 1 * snapshot.xs.length + 1;
    assert.equal(snapshot.vertices[k * 8 + 1], 3);
    assert.equal(snapshot.bounds.max.y, 3, 'bounds are refreshed after the upload');
    terrain.flush();
    assert.equal(log.uploads - uploads, 1, 'a clean flush uploads nothing');
    terrain.dispose();
  } finally {
    restore();
  }
});

test('raycasts follow the rendered surface, root transform, solid underside and disposal', () => {
  const { log, restore } = installLaya();
  try {
    const field = flat(8, 2);
    const terrain = new ZhudaTerrain3D(field, {
      material,
      chunkCells: 4,
      solid: { depth: 3 },
    });
    terrain.setRegion({ minX: 0, minZ: 0, maxX: 8, maxZ: 8 });
    assert.equal(terrain.report().renderMeshes, 8, 'every chunk owns a surface and a shell');
    const hit = terrain.raycast(down(2.5, 2.5));
    assert.ok(Math.abs(hit.position.y - 2) < 1e-6);
    assert.ok(Math.abs(hit.distance - 48) < 1e-6);
    assert.ok(hit.normal.y > 0.99);
    const below = terrain.raycast({
      origin: { x: 2.5, y: -20, z: 2.5 },
      direction: { x: 0, y: 1, z: 0 },
    });
    assert.ok(Math.abs(below.position.y - -1) < 1e-6, 'solid bottom sits depth below the surface');
    assert.ok(below.normal.y < -0.99);
    assert.equal(terrain.raycast(down(2.5, 2.5), 10), null, 'max distance is respected');
    assert.throws(() => terrain.raycast(down(1, 1), -1), /ray distance/);
    const provider = terrain.queryProvider('ground');
    assert.equal(provider.raycast(down(2.5, 2.5), 100).instanceId, '2:2');

    terrain.root.transform.worldMatrix.elements[13] = 10; // translate root by +10 on Y
    const moved = terrain.raycast(down(2.5, 2.5));
    assert.ok(Math.abs(moved.position.y - 12) < 1e-6, 'world transform applies to hits');

    const root = terrain.root;
    terrain.dispose();
    terrain.dispose();
    assert.equal(root.destroyed, true);
    assert.equal(log.destroyedMeshes, 8);
    assert.throws(() => terrain.flush(), /Disposed/);
    assert.throws(() => terrain.raycast(down(1, 1)), /Disposed/);
    field.setHeight(0, 0, 1); // the unsubscribed field must not touch released chunks
  } finally {
    restore();
  }
});
