// bindZhudaSkinToSkeleton: a part's skinned meshes pointed at another model's joints by name.
// Fake nodes stand in for LayaAir's: the matching and the refusal are checked here, not a draw.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bindZhudaSkinToSkeleton,
  releaseZhudaSkinBinding,
} from '../packages/core/runtime3d/SkinBinding.ts';

class SkinnedMeshRenderer {}
class MeshFilter {}
class Matrix4x4 {
  elements = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
}
/** Stands in for a node the binding makes: it records its parent and the local matrix it is given. */
class Sprite3D {
  constructor(name) {
    this.name = name;
    this.transform = {};
    this.destroyed = false;
  }
  destroy() {
    this.destroyed = true;
  }
}
class Vector3 {
  constructor(x, y, z) {
    Object.assign(this, { x, y, z });
  }
}
globalThis.Laya = { SkinnedMeshRenderer, MeshFilter, Matrix4x4, Sprite3D, Vector3 };
function node(name, children = [], renderer) {
  return {
    name,
    numChildren: children.length,
    getChildAt: (i) => children[i],
    getComponent: (type) => (type === SkinnedMeshRenderer ? (renderer ?? null) : null),
  };
}
/** A model: a mesh node beside a root joint with a spine and two arms, as the glTF writer lays it out. */
function model(label, joints = ['root', 'spine', 'armL', 'armR'], uses = joints) {
  const made = Object.fromEntries(joints.map((name) => [name, node(name)]));
  const tree = node(
    'root',
    joints.slice(1).map((name) => made[name]),
  );
  made.root = tree;
  const renderer = Object.assign(new SkinnedMeshRenderer(), {
    bones: uses.map((name) => made[name] ?? node(name)),
    rootBone: tree,
  });
  return { node: node(label, [node(`${label}-mesh`, [], renderer), tree]), renderer, joints: made };
}

test("a part is bound to the joints of the same names, in the part's own order, and to the body's root", () => {
  const body = model('body'),
    shirt = model('shirt', ['root', 'spine', 'armL', 'armR'], ['armR', 'spine', 'armL']);
  const report = bindZhudaSkinToSkeleton(shirt, body);
  assert.deepEqual(report, { renderers: 1, joints: 4, missing: [], offsets: 0 });
  assert.deepEqual(shirt.renderer.bones, [body.joints.armR, body.joints.spine, body.joints.armL]);
  assert.equal(shirt.renderer.rootBone, body.joints.root);
  // A node works as well as an instance.
  const hat = model('hat', ['root', 'spine'], ['spine']);
  assert.equal(bindZhudaSkinToSkeleton(hat.node, body.node).renderers, 1);
  assert.equal(hat.renderer.bones[0], body.joints.spine);
});

test("a mesh node of the body that carries a joint's name is not taken for the joint", () => {
  const body = model('body');
  // A region of the body named like a joint, before the joints in the tree, with its own skinned mesh.
  const region = node(
    'spine',
    [],
    Object.assign(new SkinnedMeshRenderer(), {
      bones: [body.joints.spine],
      rootBone: body.joints.root,
    }),
  );
  const cut = node('body', [region, body.node]);
  const belt = model('belt', ['root', 'spine'], ['spine']);
  assert.equal(bindZhudaSkinToSkeleton(belt, cut).renderers, 1);
  assert.equal(belt.renderer.bones[0], body.joints.spine);
  assert.notEqual(belt.renderer.bones[0], region);
  // Bare joints with no mesh are matched by node name.
  const bare = node('rig', [node('root', [node('spine')])]);
  const sash = model('sash', ['root', 'spine'], ['spine']);
  assert.equal(bindZhudaSkinToSkeleton(sash, bare).renderers, 1);
  assert.equal(sash.renderer.bones[0].name, 'spine');
});

test('a part that needs a joint the body lacks is not bound at all, and the joint is named', () => {
  const body = model('body'),
    cape = model('cape', ['root', 'spine', 'capeTail'], ['spine', 'capeTail']);
  const before = [...cape.renderer.bones];
  assert.deepEqual(bindZhudaSkinToSkeleton(cape, body), {
    renderers: 0,
    joints: 3,
    missing: ['capeTail'],
    offsets: 0,
  });
  assert.deepEqual(cape.renderer.bones, before);
  assert.equal(cape.renderer.rootBone, cape.joints.root);
});

test('a part with no skinned mesh binds nothing; a missing argument is an error', () => {
  const body = model('body');
  assert.deepEqual(bindZhudaSkinToSkeleton(node('prop'), body), {
    renderers: 0,
    joints: 0,
    missing: [],
    offsets: 0,
  });
  assert.throws(() => bindZhudaSkinToSkeleton(null, body), /required/);
});

// ---- a part made elsewhere: another rest pose ------------------------------------------------
const mul = (a, b) => {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
};
const translate = (x, y, z) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
const point = (m, p) =>
  [0, 1, 2].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
/** A joint node resting at a world matrix, able to take the binding's offset nodes as children. */
function joint(name, world) {
  const made = {
    name,
    numChildren: 0,
    children: [],
    transform: { worldMatrix: { elements: world } },
  };
  made.getChildAt = (i) => made.children[i];
  made.getComponent = () => null;
  made.addChild = (child) => (
    (child.parent = made),
    made.children.push(child),
    (made.numChildren = made.children.length)
  );
  return made;
}
function skinned(label, bones, binds, box) {
  const renderer = Object.assign(new SkinnedMeshRenderer(), { bones, rootBone: bones[0] });
  if (box) {
    const corner = (v) => ({ x: v[0], y: v[1], z: v[2] });
    renderer.localBounds = {
      min: corner(box[0]),
      max: corner(box[1]),
      getMin() {
        return this.min;
      },
      getMax() {
        return this.max;
      },
      setMin(v) {
        this.min = v;
      },
      setMax(v) {
        this.max = v;
      },
    };
  }
  const filter = Object.assign(new MeshFilter(), {
    sharedMesh: { _inverseBindPoses: binds.map((elements) => ({ elements })) },
  });
  return {
    name: label,
    numChildren: 0,
    getChildAt: () => null,
    getComponent: (type) =>
      type === SkinnedMeshRenderer ? renderer : type === MeshFilter ? filter : null,
    renderer,
  };
}

test("a part whose joints rest turned and scaled is bound through offset nodes, and its vertices land where the body's do", () => {
  // The body: an elbow resting at (0.3, 1.4, 0), not turned; its inverse bind undoes that position.
  const elbow = joint('elbow', translate(0.3, 1.4, 0));
  const bodyMesh = skinned('body-mesh', [elbow], [translate(-0.3, -1.4, 0)]);
  const body = {
    name: 'body',
    numChildren: 2,
    getChildAt: (i) => [bodyMesh, elbow][i],
    getComponent: () => null,
  };
  // The part: the same elbow, but its file is in centimetres with z up (x, y, z) -> (x, z, -y) in metres:
  // the armature's matrix is that turn and scale, and the joint rests at the same place seen through it.
  const armature = [0.01, 0, 0, 0, 0, 0, -0.01, 0, 0, 0.01, 0, 0, 0, 0, 0, 1];
  const partRest = mul(armature, translate(30, 0, 140)); // (30, 0, 140) cm, z up, is (0.3, 1.4, 0) m, y up
  assert.deepEqual(
    point(partRest, [0, 0, 0]).map((v) => +v.toFixed(6)),
    [0.3, 1.4, 0],
  );
  const partElbow = joint('elbow', partRest);
  const partBind = translate(-30, 0, -140); // mesh (cm) to the joint's own space
  // The sleeve's own box, in its file's centimetres: 20 to 40 across, 135 to 150 up (the file's z).
  const sleeve = skinned(
    'sleeve-mesh',
    [partElbow],
    [partBind],
    [
      [20, -5, 135],
      [40, 5, 150],
    ],
  );
  const part = {
    name: 'sleeve',
    numChildren: 2,
    getChildAt: (i) => [sleeve, partElbow][i],
    getComponent: () => null,
    transform: { worldMatrix: { elements: translate(0, 0, 0) } },
  };
  const report = bindZhudaSkinToSkeleton(part, body);
  assert.deepEqual(report, { renderers: 1, joints: 1, missing: [], offsets: 1 });
  const offset = sleeve.renderer.bones[0];
  assert.equal(offset.parent, elbow, "the offset node hangs under the body's joint");
  assert.equal(offset.name, 'elbow@sleeve');
  // A vertex of the sleeve 5 cm past the elbow along the file's z axis (up): skinned through the offset
  // node and the part's own bind matrix, with the body at rest, it is 5 cm above the body's elbow.
  const local = Array.from(offset.transform.localMatrix.elements);
  const skinning = mul(mul(translate(0.3, 1.4, 0), local), partBind);
  assert.deepEqual(
    point(skinning, [30, 0, 145]).map((v) => +v.toFixed(5)),
    [0.3, 1.45, 0],
  );
  // And when the body's elbow moves, the vertex moves with it.
  const moved = mul(mul(translate(0.5, 1.0, 0.2), local), partBind);
  assert.deepEqual(
    point(moved, [30, 0, 145]).map((v) => +v.toFixed(5)),
    [0.5, 1.05, 0.2],
  );
  // The box LayaAir culls by is now in the body's metres, about the body's root joint (the elbow here).
  const box = sleeve.renderer.localBounds;
  const round = (v) => [v.x, v.y, v.z].map((x) => +x.toFixed(4));
  assert.deepEqual(round(box.getMin()), [-0.1, -0.05, -0.05]);
  assert.deepEqual(round(box.getMax()), [0.1, 0.1, 0.05]);
  assert.equal(releaseZhudaSkinBinding(part), 1);
  assert.equal(offset.destroyed, true);
  assert.equal(releaseZhudaSkinBinding(part), 0);
});

test("a part made on the body's own skeleton gets no offset nodes", () => {
  const elbow = joint('elbow', translate(0.3, 1.4, 0));
  const bodyMesh = skinned('body-mesh', [elbow], [translate(-0.3, -1.4, 0)]);
  const body = {
    name: 'body',
    numChildren: 2,
    getChildAt: (i) => [bodyMesh, elbow][i],
    getComponent: () => null,
  };
  const partElbow = joint('elbow', translate(0.3, 1.4, 0));
  const cuff = skinned('cuff-mesh', [partElbow], [translate(-0.3, -1.4, 0)]);
  // The part instance stands somewhere else in the scene: its joints are read against its own root.
  partElbow.transform.worldMatrix.elements = translate(5.3, 1.4, 2);
  const part = {
    name: 'cuff',
    numChildren: 2,
    getChildAt: (i) => [cuff, partElbow][i],
    getComponent: () => null,
    transform: { worldMatrix: { elements: translate(5, 0, 2) } },
  };
  assert.deepEqual(bindZhudaSkinToSkeleton(part, body), {
    renderers: 1,
    joints: 1,
    missing: [],
    offsets: 0,
  });
  assert.equal(cuff.renderer.bones[0], elbow);
});
