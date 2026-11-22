# Spring bones

Chains of a model's bones that lag, swing and settle behind what they hang
from: hair, a tail, a skirt's hem, an earring, a ribbon. Each joint of a
chain is a point at the end of a bone of fixed length, moved in fixed steps
of the engine's clock, pulled back toward where its bone points at rest, and
kept out of bodies. It shares its step and its bodies with [cloth](cloth.md).

```ts
import { ZhudaSpringBones, runZhudaAfterAnimation } from 'zhuda-laya-engine';

const springs = new ZhudaSpringBones({
  chains: [
    // the bones of a tail, each a child of the one before; the last node is its end
    { nodes: [hair1, hair2, hair3, hair4, hairEnd], stiffness: 3, drag: 3, radius: 0.03 },
    { nodes: [ribbon1, ribbon2, ribbonEnd], stiffness: 25 },
  ],
  colliders: [
    { node: chest, type: 'sphere', center: [0, 0, 0], radius: 0.18 }, // goes with the node
    { node: neck, type: 'capsule', a: [0, 0, 0], b: [0, 0.12, 0], radius: 0.05 },
    { type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] }, // stands in the world
  ],
});
// Once LayaAir's animation has posed the frame, and before the skin is worked out:
const stop = runZhudaAfterAnimation(model, () => springs.updateFrom(session.layers));
// when done with:
stop();
springs.dispose(); // the nodes are their owner's
```

- **A chain** is two or more nodes, each a child of the one before. As the
  nodes are when the springs are made is the chain's rest: each bone's
  rotation in its parent, the way to the next joint, its length. Every node
  but the last is turned; the last only marks where the chain ends. The
  bones of a chain should not be animated by a clip: what holds the first
  bone (the head, the hip) is.
- **`stiffness`** (10) is how fast a bone comes back to where it points at
  rest, a second: 0 is a rope that hangs, 3 a ponytail, 25 a ribbon that
  holds its shape. **`drag`** (4) is how fast a joint loses its speed.
  **`gravity`** is metres a second a second (`[0, -9.81, 0]`). **`radius`**
  (0.02) is how far outside a body a joint is kept.
- **Each bone its own settings**: `bones: [{ stiffness, drag, gravity,
  radius }, ...]` on a chain, from the bone nearest what it hangs from; a
  key left out takes the chain's. A VRM spring sets every joint this way
  ([VRM](vrm.md)). The same settings given per bone run bit for bit as the
  chain's.
- **Bodies** are a cloth's: `sphere`, `capsule`, `plane` and `table`. One
  given with a `node` (a sphere or a capsule in that node's own space) goes
  with it every frame. A joint that is inside a body slides round its own
  joint, away from the body, until it is out: a bone never stretches. A
  chain made inside a body (hair on a back) is moved out of it there and
  then, quietly.
- **Time** is the engine's clock: `update(seconds)` or
  `updateFrom(session.layers, layer = 'world')`, called once the frame's
  animation has posed the model. Steps of 1/120 s (`step`); at most
  `maxSteps` (8) a call, the rest dropped. A paused layer changes nothing; a
  five-second delta runs eight steps; the same deltas and the same motion of
  the model give the same chains, bit for bit. Across the steps of a frame
  the chain's root goes evenly from where it was to where it is.
- **`reset()`** puts the chains back at rest where the model is now, still:
  after the model was put somewhere else at once.
- `ZhudaSpringBoneSolver` is the arithmetic alone (no LayaAir, runs in
  node): `addChain`, `setAnchor`, `advance`, `rotations`, `tails`,
  `countInside`, `inspect`.

Measured (`npm run verify:spring-bones`, WebGL and WebGPU, and
`node --test tests/spring-bones.test.mjs`): a tail of six bones on a head
that sways 30 cm each way lies 3.5 cm from the skin of a body that goes with
the head (its joints are kept 3 cm outside it), swings 33 cm away from where
a stick's tip would be, and comes back within a tenth of a millimetre of
where it hung; read from the nodes themselves, every bone is its own length
and every joint is where the solver has it to a micron, and no joint is
inside the body in any of 2,384 steps; a second run is the same joints and
the same picture; thirty made and destroyed leave nothing.

Limits: drawn on chains of plain nodes, not on a skinned mesh (the nodes a
skin's bones are turn the same way; `runZhudaAfterAnimation` is where the
skin sees it). A joint is tested where it is, not along its path. Chains do
not meet each other. No phone.
