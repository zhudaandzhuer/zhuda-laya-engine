# Animation control: mixing clips and bending bones

LayaAir's animator plays one clip, or fades from one to another. Three
things are added, each drawn on WebGL and on WebGPU by
`npm run verify:animation-control`:

- several clips at once, by weight (`ZhudaAnimationBlend`), with the
  arithmetic of a blend along a line or over a plane;
- LayaAir's own cross-fade, asked for in seconds
  (`ZhudaModelInspector.crossFade`);
- bones bent to reach a point after the animation: two bones, a chain, an
  aim (`ZhudaTwoBoneIK`, `ZhudaChainIK`, `ZhudaAimIK`).

Nothing here keeps time. The caller says where in a clip or a round the
model is, from the clock the scene runs on.

## Mixing clips

```ts
import { ZhudaAnimationBlend, zhudaBlend1D, zhudaBlendSeconds } from 'zhuda-laya-engine';

const blend = new ZhudaAnimationBlend(model, '$', ['Idle', 'Walk', 'Run']);
let phase = 0;
function frame(deltaSeconds: number, speed: number) {
  const weights = zhudaBlend1D([0, 1.5, 4], speed); // idle at 0, walk at 1.5 m/s, run at 4
  const round = zhudaBlendSeconds(
    weights,
    blend.clips.map((clip) => clip.seconds),
  );
  phase = (phase + deltaSeconds / round) % 1;
  blend.apply(weights, phase);
  blend.overlay('Wave', waveSeconds, 1, ['Spine']); // a wave on the spine and what hangs from it
}
```

- `apply(weights, phase)` poses the model from every clip at once: each
  bone's position, rotation and scale is the clips' own values weighed by
  the weights (which are made to add up to 1). `phase` is where in the
  round the blend is, 0..1: each clip is read at that share of its own
  length, so a walk and a run of different lengths put the same foot down
  together. All of one clip is that clip exactly as LayaAir poses it.
- `overlay(clip, seconds, weight, under)` lays one clip over the pose the
  model has, on the nodes named in `under` and everything below them, and
  leaves the rest alone. Call it after `apply`.
- `zhudaBlend1D(positions, value)`: weights for clips placed along a line
  (a speed). `zhudaBlend2D(points, x, y)`: weights for clips placed on a
  plane (a direction and a speed). `zhudaBlendSeconds(weights, seconds)`:
  how long a round of the mix lasts.
- A blend takes the model's animator: LayaAir's own playback and a
  `ZhudaModelAnimationSampler` are refused while it lives; `dispose()`
  gives the animator back.

Limits: only positions, rotations and scales of nodes are mixed. What else
a clip animates (a material's number, a morph weight) is left alone. A node
that some of the clips do not animate is made up with its rest value.

## Cross-fade in seconds

`new ZhudaModelInspector(model).crossFade('$', 'Run', { seconds: 0.25 })`
fades from the clip LayaAir is playing to another over that time (LayaAir
itself takes the fade as a share of the playing clip's length). With
nothing playing it starts the clip.

Clips read from a glTF or GLB file cross fade from one clip to the other since 2.0.0. LayaAir
3.4.2's glTF reader files each keyframe node under its path as the path string, where its `.lani`
reader files the node; the animator pairs the two clips' nodes through that entry, found none, and
blended towards the bind pose and back (arms dropped, then snapped into the next clip). The
engine's glTF adapter now files the nodes when it makes a clip. A consumer that corrected this
itself (`repairGltfCrossFade` in `zhuda-engine-prefabs/3d/stickman`) finds nothing left to correct.

## A clip in a given time

A game's move has its own length (its frame data); the clip an artist made
rarely has the same. `play('$', 'Slash', { durationSeconds: 0.47 })` and
`crossFade('$', 'Slash', { seconds: 0.06, durationSeconds: 0.47 })` play
the whole clip in that time: they set the animator's speed to the clip's
length over it, which `inspect()` reports as `durationSeconds`. `play`
takes `speed` or `durationSeconds`, not both. The speed stays until the
next call sets it: a clip played after it without either option on
`crossFade` runs at the same speed, so give a looping clip its own
(`setAnimationSpeed(path, 1)` or `durationSeconds`).

## Bones bent to reach a point

```ts
import { ZhudaTwoBoneIK, runZhudaAfterAnimation } from 'zhuda-laya-engine';

const leg = new ZhudaTwoBoneIK(hip, knee, foot); // nodes, each below the one before
const stop = runZhudaAfterAnimation(model.node, () => {
  const ground = terrain.heightAt(footX, footZ); // the game's own query
  leg.solve([footX, ground, footZ], { pole: kneeForward, weight: 1 });
});
```

- `ZhudaTwoBoneIK(root, mid, end).solve(target, { pole, weight })`: the
  exact answer for two bones. The middle joint bends toward `pole` (a world
  point; without it, the way the animation bent it). Returns whether the
  target was within reach; out of reach, the limb points at it almost
  straight. Bone lengths are never changed.
- `ZhudaChainIK(nodes).solve(target, { iterations, tolerance, weight })`: a
  chain of any length, its first joint fixed (FABRIK).
- `ZhudaAimIK(node, forward).solve(target, { maxDeg, weight })`: a node
  turned to face a point, by at most an angle from its animated pose.
- `zhudaSolveTwoBone`, `zhudaSolveChain`, `zhudaAimTurn` and the quaternion
  helpers are the plain arithmetic, usable without a runtime.

**When to solve.** A solver changes the pose the animation made this
frame; the next frame's animation starts from its own pose again, so a
solver runs every frame.

- With `ZhudaModelAnimationSampler` or `ZhudaAnimationBlend` posing the
  model: right after `sample` or `apply`.
- While LayaAir plays a clip by itself: in `runZhudaAfterAnimation(node,
solve)`. LayaAir poses the bones in its scene update, after scripts'
  `onUpdate` and `onLateUpdate` (a solve there is undone the same frame),
  and works out the skin straight afterwards, before `onPreRender` (a solve
  there moves the bones and not the mesh). The helper runs between the two.

Limits: the solvers know nothing of joint limits (a knee can bend either
way: give a pole), of the ground (the game says where it is) or of each
other (two solvers on one bone: the later wins).

## Wearing a part on another model's skeleton

Clothes, hair, armour or a held prop can be a skinned model of its own whose joints have the same
names as the body's. `bindZhudaSkinToSkeleton(part, body)` points the part's skinned meshes at the
body's joints, so whatever poses the body poses the part, and the part needs no animation:

```ts
import { bindZhudaSkinToSkeleton } from 'zhuda-laya-engine';

const body = await library.instantiate('parts/body.glb', { independentMaterials: true });
const jacket = await library.instantiate('parts/jacket.glb', { independentMaterials: true });
const report = bindZhudaSkinToSkeleton(jacket, body); // { renderers, joints, missing }
if (!report.renderers) throw Error(`the body lacks ${report.missing.join(', ')}`);
body.node.addChild(jacket.node);
jacket.setTint([0.35, 0.03, 0.03, 1]); // linear; the part was made a neutral grey
```

The body's joints are the ones its own skinned meshes use, so a mesh node of the body that happens
to carry a joint's name (a body cut into `head`, `hips`...) is not mistaken for the joint. Either
every skinned mesh of the part is bound or none: `missing` names the joints the body does not have.

The part need not come from the tool that made the body. It may have fewer joints, in another
order; its joints may be turned in the rest pose (bones along another axis); it may sit under an
armature that is turned or scaled (a mesh in centimetres, z up). Where a part's joint rests
differently from the body's, the part is bound to a small node under the body's joint that holds
the difference, and `offsets` counts them (0 for a part made on the body's own skeleton). The box
LayaAir culls the part by is moved into the body's space as well. Without both, such a part
reports as bound and is not drawn. Three things are assumed and not checked:

- the part is bound right after it is instantiated, before anything poses it (its joints are read
  where they rest); the body may be in any pose;
- the joints are in the same places: a part made for other proportions is carried as it was made;
- the body's own mesh is in the body's model space (no scale or turn between it and its joints).

When a bound part is disposed while the body lives on, `releaseZhudaSkinBinding(part)` removes its
offset nodes. See the route [outfit-swap-3d](routes/outfit-swap-3d.md) and its reference game.

Checked with fake nodes and matrices in `tests/skin-binding.test.mjs`, and drawn in headless
Chromium by `games/zhuda-wardrobe`: 35 parts of the body's own kit (no offsets) and one written
by another tool in the conventions above (fourteen offsets), through four clips. Not checked on a
phone, and not with a file exported by a modelling program itself.

## Hiding what a part covers

Skin under a sleeve, a shirt under a coat: what cannot be seen need not be drawn, and what is not
drawn cannot come through what covers it, whatever the pose. `setZhudaTriangleMask(node, mask)`
hides triangles of the mesh a node draws:

```ts
import {
  setZhudaTriangleMask,
  unionZhudaTriangleMasks,
  decodeZhudaTriangleMask,
} from 'zhuda-laya-engine';

// A mask is a bit per triangle, in the order the triangles have in the model file. A tool that
// knows the models writes it (which triangles of the body lie under this garment); here two
// worn parts each hide some of the torso.
const torso = body.find('region-torso');
const mask = unionZhudaTriangleMasks(triangles, [
  decodeZhudaTriangleMask(shirt.torso),
  decodeZhudaTriangleMask(belt.torso),
]);
const { hidden } = setZhudaTriangleMask(torso, mask);
torso.active = hidden < triangles; // all of it hidden: do not draw the node at all
setZhudaTriangleMask(torso, null); // everything shown again
```

Hidden triangles stay in the index buffer with their three corners made one vertex, which draws
nothing; the buffer keeps its length, so sub-meshes and skinning are untouched and a mask can be
replaced at any time. The first mask on a node gives that node a copy of its mesh, so other
instances of the model keep theirs (`releaseZhudaTriangleMask` gives the node its mesh back and
frees the copy). A mesh with more than 65,535 vertices cannot be copied by LayaAir 3.4.2 and is
masked in place: the report's `own` is then false and every instance drawing it shows the mask.

The order matters and is easy to get wrong. LayaAir 3.4.2 reads each primitive of a glTF file last
index first, so triangle `t` of a primitive of `n` is triangle `n - 1 - t` of its sub-mesh. A mask
in the file's order (the default) is turned accordingly; pass `{ order: 'mesh' }` for one made from
the loaded mesh's own index list. A mask of the wrong length is an error: it was made for another
model. A mask in the wrong order is not, and hides the wrong triangles: have a run read the hidden
triangles back and compare them with the file, as `games/zhuda-wardrobe` does.

What to hide is the consumer's knowledge. Hide only under what moves with the surface below it
(cloth lying on the body) or encloses it (a closed volume); under cloth that hangs and swings, a
hidden triangle becomes a hole. The route [clip-free-garments](routes/clip-free-garments.md) makes
garments with their masks and measures the result.

Checked on fake meshes in `tests/triangle-mask.test.mjs`; in headless Chromium `games/zhuda-wardrobe`
masks the body's regions and worn parts and reads back from ten loaded meshes that the triangles
hidden are the ones the masks name. Not checked on a phone or a GPU, on WebGPU, on a mesh with
several primitives in a real file, or with a baked crowd.
