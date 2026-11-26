// setZhudaTriangleMask: triangles of a drawn mesh hidden by a bit each.
// A fake mesh stands in for LayaAir's: what is written to the index buffer is checked here, not a draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countZhudaHiddenTriangles,
  createZhudaTriangleMask,
  decodeZhudaTriangleMask,
  encodeZhudaTriangleMask,
  hideZhudaTriangle,
  isZhudaTriangleHidden,
  maskZhudaIndices,
  releaseZhudaTriangleMask,
  setZhudaTriangleMask,
  unionZhudaTriangleMasks,
} from '../packages/core/runtime3d/TriangleMask.ts';

class MeshFilter {}
class SkinnedMeshRenderer {}
class MeshRenderer {}
globalThis.Laya = { MeshFilter, SkinnedMeshRenderer, MeshRenderer };

class Mesh {
  static made = 0;
  constructor(indices) {
    this.indices = indices;
    this.sets = 0;
    this.destroyed = false;
    Mesh.made++;
  }
  getIndices() {
    return this.indices.slice();
  }
  setIndices(indices) {
    assert.equal(indices.length, this.indices.length, 'the buffer keeps its length');
    assert.equal(indices.constructor, this.indices.constructor, 'and its type');
    this.indices = indices.slice();
    this.sets++;
  }
  clone() {
    return Object.assign(new Mesh(this.indices.slice()), {
      subMeshCount: this.subMeshCount,
      getSubMesh: this.getSubMesh,
    });
  }
  destroy() {
    this.destroyed = true;
  }
}
/** A node with a mesh: its filter, and a renderer that keeps a box and bones of its own. */
function meshNode(name, mesh, children = []) {
  const filter = Object.assign(new MeshFilter(), { sharedMesh: mesh });
  const box = { tag: 'moved', clone: () => ({ tag: 'moved' }) };
  const renderer = Object.assign(new SkinnedMeshRenderer(), {
    localBounds: box,
    bones: ['a', 'b'],
    rootBone: 'a',
  });
  return {
    name,
    filter,
    renderer,
    numChildren: children.length,
    getChildAt: (i) => children[i],
    getComponent: (type) =>
      type === MeshFilter ? filter : type === SkinnedMeshRenderer ? renderer : null,
  };
}
const group = (name, children) => ({
  name,
  numChildren: children.length,
  getChildAt: (i) => children[i],
  getComponent: () => null,
});
const quad = () => new Uint16Array([0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 5, 7]);

test('a mask is a bit per triangle: made, set, counted, joined, and written as text and read back', () => {
  const mask = createZhudaTriangleMask(11);
  assert.equal(mask.length, 2);
  hideZhudaTriangle(mask, 0);
  hideZhudaTriangle(mask, 9);
  assert.ok(isZhudaTriangleHidden(mask, 9) && !isZhudaTriangleHidden(mask, 8));
  assert.equal(countZhudaHiddenTriangles(mask, 11), 2);
  hideZhudaTriangle(mask, 9, false);
  assert.equal(countZhudaHiddenTriangles(mask, 11), 1);
  const other = createZhudaTriangleMask(11);
  hideZhudaTriangle(other, 10);
  const both = unionZhudaTriangleMasks(11, [mask, null, other, undefined]);
  assert.deepEqual(
    [0, 9, 10].map((t) => isZhudaTriangleHidden(both, t)),
    [true, false, true],
  );
  assert.deepEqual(decodeZhudaTriangleMask(encodeZhudaTriangleMask(both)), both);
  assert.throws(() => unionZhudaTriangleMasks(40, [mask]), /2 bytes for 40 triangles/);
});

test('hidden triangles keep their place with three corners the same; the others and the input are untouched', () => {
  const indices = quad();
  const mask = createZhudaTriangleMask(4);
  hideZhudaTriangle(mask, 1);
  hideZhudaTriangle(mask, 3);
  const out = maskZhudaIndices(indices, mask);
  assert.ok(out instanceof Uint16Array);
  assert.deepEqual([...out], [0, 1, 2, 2, 2, 2, 4, 5, 6, 6, 6, 6]);
  assert.deepEqual([...indices], [...quad()]);
  assert.deepEqual([...maskZhudaIndices(indices, null)], [...quad()]);
  assert.throws(() => maskZhudaIndices(indices, new Uint8Array(3)), /3 bytes for 4 triangles/);
});

test('the first mask gives the node a mesh of its own; the shared mesh and other instances keep theirs', () => {
  const shared = new Mesh(quad());
  const one = meshNode('one', shared),
    two = meshNode('two', shared);
  const mask = createZhudaTriangleMask(4);
  hideZhudaTriangle(mask, 2);
  assert.deepEqual(
    setZhudaTriangleMask(one, null),
    { triangles: 4, hidden: 0, own: true },
    'no mask yet and none asked: nothing is copied',
  );
  assert.equal(one.filter.sharedMesh, shared);
  assert.deepEqual(setZhudaTriangleMask(one, mask), { triangles: 4, hidden: 1, own: true });
  assert.notEqual(one.filter.sharedMesh, shared);
  // Bit 2 of the file is the mesh's triangle 4 - 1 - 2: LayaAir holds a glTF primitive last index first.
  assert.deepEqual([...one.filter.sharedMesh.indices], [0, 1, 2, 2, 2, 2, 4, 5, 6, 6, 5, 7]);
  assert.deepEqual([...shared.indices], [...quad()], 'the shared mesh is as it was loaded');
  assert.equal(two.filter.sharedMesh, shared);
  // The renderer's own box and bones survive the change of mesh (a bound part's box was moved to the body's space).
  assert.equal(one.renderer.localBounds.tag, 'moved');
  assert.deepEqual(one.renderer.bones, ['a', 'b']);
  // A second mask replaces the first on the same copy; null shows everything again.
  const own = one.filter.sharedMesh,
    made = Mesh.made;
  const next = createZhudaTriangleMask(4);
  hideZhudaTriangle(next, 0);
  setZhudaTriangleMask(one, next);
  assert.equal(one.filter.sharedMesh, own);
  assert.equal(Mesh.made, made, 'no second copy');
  assert.deepEqual([...own.indices], [0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 6, 6]);
  // A mask made from the mesh itself names the mesh's own triangles.
  setZhudaTriangleMask(one, next, { order: 'mesh' });
  assert.deepEqual([...own.indices], [0, 0, 0, 2, 1, 3, 4, 5, 6, 6, 5, 7]);
  assert.deepEqual(setZhudaTriangleMask(one, null), { triangles: 4, hidden: 0, own: true });
  assert.deepEqual([...own.indices], [...quad()]);
});

test('releasing gives the node its mesh back and frees the copy', () => {
  const shared = new Mesh(quad());
  const node = meshNode('node', shared);
  assert.equal(releaseZhudaTriangleMask(node), false, 'never masked');
  const mask = createZhudaTriangleMask(4);
  hideZhudaTriangle(mask, 1);
  setZhudaTriangleMask(node, mask);
  const own = node.filter.sharedMesh;
  assert.equal(releaseZhudaTriangleMask(node), true);
  assert.equal(node.filter.sharedMesh, shared);
  assert.ok(own.destroyed);
  assert.equal(releaseZhudaTriangleMask(node), false);
});

test("the file's order: each primitive of the file is held last index first, and bits run through the primitives in turn", () => {
  // Two primitives: three triangles, then one. In the mesh each is reversed within its own sub-mesh.
  const indices = new Uint16Array([10, 11, 12, 20, 21, 22, 30, 31, 32, 40, 41, 42]);
  const ranges = [
    { start: 0, count: 9 },
    { start: 9, count: 3 },
  ];
  const mask = createZhudaTriangleMask(4);
  hideZhudaTriangle(mask, 0); // the first triangle of the first primitive: the last of its sub-mesh
  hideZhudaTriangle(mask, 3); // the only triangle of the second
  assert.deepEqual(
    [...maskZhudaIndices(indices, mask, { ranges })],
    [10, 11, 12, 20, 21, 22, 30, 30, 30, 40, 40, 40],
  );
  // Without sub-meshes the whole list is one primitive.
  assert.deepEqual(
    [...maskZhudaIndices(indices, mask, {})],
    [10, 10, 10, 20, 21, 22, 30, 31, 32, 40, 40, 40],
  );
  assert.throws(
    () => maskZhudaIndices(indices, mask, { ranges: [{ start: 0, count: 9 }] }),
    /sub-meshes hold 3 triangles of its 4/,
  );
  // A loaded mesh says where its sub-meshes lie.
  const mesh = new Mesh(indices);
  mesh.subMeshCount = 2;
  mesh.getSubMesh = (i) => ({ _indexStart: ranges[i].start, _indexCount: ranges[i].count });
  const node = meshNode('two-primitives', mesh);
  setZhudaTriangleMask(node, mask);
  assert.deepEqual(
    [...node.filter.sharedMesh.indices],
    [10, 11, 12, 20, 21, 22, 30, 30, 30, 40, 40, 40],
  );
});

test('a mesh LayaAir cannot copy (indices wider than 16 bits) is masked in place, and says so', () => {
  const shared = new Mesh(new Uint32Array(quad()));
  const node = meshNode('big', shared);
  const mask = createZhudaTriangleMask(4);
  hideZhudaTriangle(mask, 0);
  assert.deepEqual(setZhudaTriangleMask(node, mask), { triangles: 4, hidden: 1, own: false });
  assert.equal(node.filter.sharedMesh, shared);
  assert.deepEqual([...shared.indices], [0, 1, 2, 2, 1, 3, 4, 5, 6, 6, 6, 6]);
  assert.equal(releaseZhudaTriangleMask(node), true);
  assert.deepEqual([...shared.indices], [...quad()], 'put back as loaded');
});

test('the target is the one mesh under a model; several meshes, none, or a mask of another model is an error', () => {
  const part = group('shirt', [group('joints', []), meshNode('shirt-mesh', new Mesh(quad()))]);
  const mask = createZhudaTriangleMask(4);
  hideZhudaTriangle(mask, 3);
  assert.equal(
    setZhudaTriangleMask({ node: part }, mask).hidden,
    1,
    'a model instance: its node is searched',
  );
  const body = group('body', [
    meshNode('region-a', new Mesh(quad())),
    meshNode('region-b', new Mesh(quad())),
  ]);
  assert.throws(
    () => setZhudaTriangleMask(body, mask),
    /body holds 2 meshes; pass the node of the one to mask/,
  );
  assert.throws(() => setZhudaTriangleMask(group('empty', []), mask), /holds 0 meshes/);
  assert.throws(
    () => setZhudaTriangleMask(meshNode('other', new Mesh(new Uint16Array(30))), mask),
    /1 bytes for 10 triangles \(2\)/,
  );
});
