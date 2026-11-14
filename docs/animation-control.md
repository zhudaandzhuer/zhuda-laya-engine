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
