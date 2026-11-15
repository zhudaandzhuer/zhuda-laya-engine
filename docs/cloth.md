# Cloth

A cloth is particles held apart by distance constraints (along the weave,
across it, and what keeps it flat), moved by Verlet integration in fixed
steps, hung from pins, kept out of bodies and pulled by a hand. It is a
game's cloth, not a measured fabric: a skirt, a cape, a curtain, a flag, a
towel dropped on a chair.

```ts
import {
  ZhudaCloth,
  createZhudaClothGrid,
  createZhudaClothTube,
  createZhudaClothFromMesh,
  ZhudaClothSolver, // the arithmetic alone: no LayaAir, runs in node
} from 'zhuda-laya-engine';
```

It has no timer of its own. Every frame it is handed the delta of a layer
of the engine's clock, and the same deltas give the same cloth to the last
bit: in node, in a desktop browser and on a phone alike.

## A sheet hung in front of a body

```ts
// 25 by 25 particles, 1.2 m square, its top edge at 1.9 m, hanging down.
const cloth = new ZhudaCloth(
  createZhudaClothGrid({
    columns: 25,
    rows: 25,
    width: 1.2,
    height: 1.2,
    origin: [-0.6, 1.9, 0],
  }),
  scene, // the mesh's node is added here; it stays at the origin, unturned
  { strain: { scale: 10 } }, // optional: how far the weave is stretched, to the vertex colour's alpha
);
cloth.node.meshRenderer.sharedMaterial = material.material;

const { solver } = cloth;
solver.pin(0); // the top left corner
solver.pin(24); // the top right corner
solver.addCollider({ type: 'plane', point: [0, 0, 0], normal: [0, 1, 0] }); // the floor
solver.addCollider({ type: 'sphere', center: [0, 1.66, -0.38], radius: 0.21 });

runtime.start(() => {
  cloth.updateFrom(runtime.layers); // the `world` layer's delta for this frame
});
// when it is done with:
cloth.dispose(); // the mesh and its node; the material is its owner's
```

`updateFrom(layers, layer = 'world')` reads `layers.scaledDeltas`; `update(seconds)` takes a
delta directly. Both return `{ steps, dropped }`.

## Shapes

| Function                                                                                  | Makes                                                                                                                         |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `createZhudaClothGrid({ columns, rows, width, height, origin?, right?, down? })`          | A flat sheet. Particle `row * columns + column`; row 0 is the top edge. Its front faces `cross(right, -down)` (+z by default) |
| `createZhudaClothTube({ columns, rows, center, topRadius, bottomRadius, length, axis? })` | A tube closed round: a skirt, a sleeve. Row 0 is the first ring (the waist). Its front faces outward                          |
| `createZhudaClothFromMesh({ positions, indices, uvs?, weld? })`                           | A cloth from a mesh of one's own. Vertices in one place (a seam) become one particle                                          |

A sheet or a tube has four kinds of constraint: along the weave
(structural), across its diagonals (shear), two particles apart (bend, what
keeps it flat), and **spans**: two particles of one thread four, eight or
sixteen apart, which may come nearer but get no farther apart than the
thread between them is long. Spans stretch nothing and hold nothing in
shape; they pass a pull along a thread many particles at a time. A cloth
made from a mesh has edges and bends only (no threads to span).

A shape is plain data (`particles`, `constraints`, `particleOf`, `uvs`,
`indices`); `validateZhudaClothShape` says what is wrong with one put
together by hand.

## Time: a fixed step on the engine's clock

- The cloth moves in steps of `step` seconds (default 1/240: four a frame
  at sixty frames a second). A delta is gathered and spent in whole steps;
  what is left waits for the next delta.
- **A paused layer hands it zero and it stands still**: no step, the same
  bytes, the same picture.
- **A long gap does no harm.** One call runs at most `maxSteps` steps
  (default 8, a thirtieth of a second); the time over that is dropped, not
  caught up with. Five seconds arriving in one delta (a tab that was away)
  moves the cloth by eight steps and reports `dropped: 1192`.
- A delta that is not a finite number of seconds, zero or more, is refused
  and nothing moves.
- No `setTimeout`, no `Date`, no random number. Two cloths made the same
  way and given the same deltas are the same, byte for byte; a delta cut in
  two is the delta whole while both hold the same whole steps.

## Pins

```ts
solver.pin(index); // held where it is
solver.pin(index, [x, y, z]); // held there
solver.movePin(index, x, y, z); // every frame, with what it hangs from
solver.unpin(index);
solver.shift(x, y, z); // the whole cloth carried elsewhere at once, its motion kept
```

A pinned particle does not fall and no body moves it. Move pins a little a
frame; when what the cloth hangs from is put somewhere else at once (a
character set down at another place), `shift` the cloth by the same amount:
pins moved far in one frame throw the cloth after them, and a flat sheet
thrown through its own rail can stay folded over it.

No particle gets farther from the pin it hangs from than the cloth between
them is long (`tether`, 2% of slack by default). Without it a cloth hung
from few pins stretches like rubber where it hangs.

## A hand

```ts
const index = solver.nearestToRay(rayOrigin, rayDirection, 0.1); // -1 when the ray touches no cloth
if (index >= 0 && !solver.isPinned(index)) solver.grab(index);
solver.dragTo(index, x, y, z); // every frame while it is held
solver.release(index); // the particle keeps the motion it had
```

- The hand goes toward where it is asked to be no faster than `grabSpeed`
  (10 m/s), and pulls the particle to itself outright.
- It never gets more than `grabStretch` of the weave's spacing (a tenth)
  ahead of the particle. Where the threads at the particle are stretched by
  more than a twentieth, that lead is cut step by step: **a hand asked to go
  where the cloth cannot reach waits at the cloth** and does not stretch it
  to follow. `solver.handOf(index)` is where the hand really is.
- A held particle is kept out of bodies like any other: asked for the middle
  of a body, it stops at the body's skin.
- Which particle a pointer takes, and what a pull means, are the game's.

## Bodies

```ts
const id = solver.addCollider(body);
solver.setCollider(id, movedBody); // every frame, for a body that moves
solver.removeCollider(id);
```

| Body                                                                     | Is                                                                    |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `{ type: 'sphere', center, radius }`                                     | A ball                                                                |
| `{ type: 'capsule', a, b, radius }`                                      | A rod with round ends: an arm, a leg                                  |
| `{ type: 'table', origin, axis, forward, height, rows, columns, radii }` | A body turned about an axis, its radius looked up by height and angle |
| `{ type: 'plane', point, normal }`                                       | A floor or a wall without end                                         |

**A table** is for a torso, a leg, a vase: `radii` holds `rows` rings of
`columns` radii, the ring at the foot of the axis first; a ring's first
radius is in the direction `forward` and the rest go round toward
`cross(axis, forward)`. Between its values the radius is interpolated
(`zhudaTableRadius(table, height, angle)` is the same lookup, for drawing
the body from the same numbers). Its two ends are closed flat. A cloth laid
over a sharp rim shows the rim through its triangles: round the profile off
toward an end, or put a ball on it. One table is one rigid shape about one
axis: a leg that bends is two.

- The cloth is kept `thickness` outside a body (1 cm), measured square to
  its surface. Make it at least as much as a triangle of the cloth can cut
  into the body's roundest part.
- `friction` (0.5) is how well the cloth grips: it lies on a slope whose
  rise over its run is less than that, and slides on a steeper one.
- A step ends with no particle inside a body: after the constraints, the
  bodies have the last word. `solver.countInside()` counts particles deeper
  than a tenth of a millimetre inside a body grown by the thickness
  (`countInside(1e-4, 0)`: inside a body itself). A pin is its owner's
  business: one put inside a body is counted and not moved.
- **Thin bodies.** A particle is tested where it is, not along its path: it
  cannot cross a body whose radius is more than `maxSpeed * step` (2.5 cm by
  default; `inspect().safeRadius`). A thinner body may be crossed by a fast
  cloth: make the step smaller or the body thicker.
- There is no collision of the cloth with itself.

## Air

`drag` (1) is how fast a particle loses its speed whichever way it moves.
`windDrag` (2) is how hard the air pushes a triangle that meets it face on:
it is what a wind blows a cloth with (`wind`, or `setWind(x, y, z)`, metres a
second), and what stops a cloth swinging, since still air resists a cloth
that moves face on and lets it slide edge on. `windDrag: 0` is no air.

## Options

| Option        | Default                                      | Is                                                                                |
| ------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `step`        | 1/240                                        | Seconds a step (1/1000 to 1/10)                                                   |
| `rounds`      | 2                                            | Times a step goes over the constraints (1 to 32)                                  |
| `maxSteps`    | 8                                            | Steps one delta may run; the rest are dropped (1 to 64)                           |
| `gravity`     | `[0, -9.81, 0]`                              | Metres a second a second                                                          |
| `drag`        | 1                                            | Speed lost whichever way a particle moves (0 to 20)                               |
| `wind`        | `[0, 0, 0]`                                  | The air's velocity, metres a second                                               |
| `windDrag`    | 2                                            | How hard air met face on pushes (0 to 50; 0: no air)                              |
| `compliance`  | `{ structural: 0, shear: 3e-4, bend: 2e-4 }` | How much each kind of constraint gives (0 is as stiff as the rounds make it)      |
| `tether`      | 0.02                                         | Slack in the limit on a particle's distance from its pin; `false` for no limit    |
| `thickness`   | 0.01                                         | Metres the cloth is kept outside a body (0 to 0.5)                                |
| `friction`    | 0.5                                          | How well it grips a body (0 to 4)                                                 |
| `maxSpeed`    | 6                                            | The fastest a particle moves, metres a second                                     |
| `grabSpeed`   | 10                                           | The fastest a hand moves, metres a second                                         |
| `grabStretch` | 0.1                                          | How far ahead of the cloth a hand may get, as a share of the weave's spacing      |
| `strain`      | off                                          | `ZhudaCloth` only: the stretch to the vertex colour's alpha (`true`, `{ scale }`) |

An unknown option is refused by name. A woven cloth gives little along its
threads and much across them: with a stiff shear a sheet behaves like a
sheet of paper.

`setGravity`, `setWind` and `setCompliance` change a cloth while it runs.

## How much it stretches, and what that costs

A stiff cloth is the hard case for this kind of solver: a pull is passed
from particle to particle a round at a time. Spans and the pin limit pass
it farther; smaller steps do more than more rounds. Measured on the two
sheets of `npm run verify:cloth` (stretch is the most any thread is longer
than its rest length):

| Cloth                                                     | While it moves                      | At rest |
| --------------------------------------------------------- | ----------------------------------- | ------- |
| 25 by 25, hung by two corners                             | 0.19 (as it first falls into place) | 0.06    |
| The same, in a hand                                       | 0.09                                |         |
| A skirt of 36 by 16 pinned at the waist, the body swaying | 0.08                                | 0.04    |
| 41 by 41, free, dropped over a ball, a rod and a table    | 0.12                                | 0.10    |

The free sheet again, with other settings (node, Apple M4, one cloth of
1,681 particles and four bodies, a frame of a sixtieth):

| Settings        | While it moves | At rest | A frame |
| --------------- | -------------- | ------- | ------- |
| 1/240, 2 rounds | 0.12           | 0.10    | 2.9 ms  |
| 1/240, 4 rounds | 0.11           | 0.06    | 4.1 ms  |
| 1/480, 2 rounds | 0.09           | 0.04    | 4.7 ms  |
| 1/120, 4 rounds | 0.63           | 0.20    | 2.1 ms  |

In the browser, with the mesh's positions, normals and stretch written and
uploaded:

| Device                                   | 1,681 particles, four bodies | A skirt of 576, four bodies |
| ---------------------------------------- | ---------------------------- | --------------------------- |
| Apple M4, Chrome 157                     | 2.4 ms a frame               | 1.1 ms a frame              |
| vivo V40 (Adreno 720), Chrome 156, WebGL | 7.1 ms a frame               | 3.0 ms a frame              |

Size a cloth by the phone: a skirt is a fifth of a frame at sixty frames a
second, the big sheet nearly half of one. The phone gave the same bytes as
the desktop (the same hash of the positions) and the same counts.

## Reading a cloth

- `solver.positions` (three numbers a particle) may be read at any time.
- `solver.inspect()`: particles, constraints, bodies, pins, hands, steps
  run and dropped, `inside`, `maxStretch`, `kineticEnergy`, `safeRadius`.
- `solver.measureStrain()` fills `solver.strain` (a number a particle: how
  much longer than at rest its threads are, as a share) and returns the
  most. With `strain`, `ZhudaCloth` writes it to the mesh's vertex colour,
  where a [lit surface's hook](filmic-rendering.md#what-the-hook-is-given-to-read-the-eye-the-meshs-normal-a-number-a-vertex-sheen)
  reads it as `s.vertexColor.a`: a knit that thins where it is stretched,
  a colour that shows the pull.

## Limits

- Positions are in one space, the world's: pins and bodies are given in it,
  and the mesh's node must stay at the origin, unturned, under a parent that
  is too.
- No collision of the cloth with itself, no tearing, no two-way push on
  what it touches.
- The mesh has no tangents: a normal map on a cloth goes through a lit
  surface's hook (`s.normalTS` works without them).
- A free cloth (no pins) over small supports stretches more than a pinned
  one; see the table.
- Verified on desktop WebGL and WebGPU and on one phone (a vivo V40, WebGL).
  WebGPU on a phone is not.

## Checks

`node --test tests/cloth.test.mjs` (the arithmetic: shapes, bodies, the
fixed step, the same deltas twice, a pause, a long gap, pins, a hand, the
air) and `npm run verify:cloth` (`CLOTH_RENDERER=webgpu` for WebGPU): a
sheet dropped over a ball, a rod and a table with no particle inside a body
in any of 1,920 steps and no pixel of a body seen through it from above; a
sheet hung by two corners, taken, pulled, pressed against a body, carried
round it and let go; a skirt on a body that sways; thirty cloths made and
destroyed with nothing left.
