# Walking: where a character can go, the way there, and a capsule that walks it

Three pieces a game with a character on the ground needs, as numbers only: no node, no input, no
clock of their own. They live in `runtime3d` and are exported from the public entry.

| Piece | What it answers |
| --- | --- |
| `createZhudaWalkGrid` | Which cells of the ground a walker of a given size can stand in |
| `findZhudaPath`, `zhudaWalkLineClear` | The shortest way over that grid, and whether a straight run is clear |
| `ZhudaCharacterController` | Where a capsule ends up when it tries to move through that world |
| `zhudaSolidQueryProvider` | The same solids as something a ray hits, so the camera boom keeps clear of them |

**The game stays the authority on movement.** It gives the world, decides what the character
wants to do, calls these from its own fixed step, and may put the character anywhere afterwards.
Nothing here reads input, moves a node or decides a rule of the game.

## The world

A ground function and a list of solids:

```ts
import { createZhudaWalkGrid, findZhudaPath, ZhudaCharacterController, zhudaSolidQueryProvider, type ZhudaSolid } from 'zhuda-laya-engine';

const ground = (x: number, z: number) => (insideMap(x, z) ? heightAt(x, z) : null); // null: no ground
const solids: ZhudaSolid[] = [
  { kind: 'box', min: { x: 2, y: 0, z: -5 }, max: { x: 3, y: 3, z: 5 } },          // a wall
  { kind: 'cylinder', center: { x: -3, z: 3 }, radius: 0.5, minY: 0, maxY: 4 },   // a trunk
];
```

A solid is in a walker's way only if it rises above a step from the walker's feet and starts below
the walker's top: a kerb lower than `maxStep` is not a wall, and neither is a beam overhead. What
can be stood on (a platform, a stair) belongs in `ground`, not in `solids`. Caves and overhangs
are not described by a height: they need the game's own collision.

## A grid and a path

```ts
const grid = createZhudaWalkGrid({ min: { x: -20, z: -20 }, max: { x: 20, z: 20 }, cell: 0.25, ground, solids, radius: 0.3, maxStep: 0.35 });
const start = grid.nearestWalkable(npc.x, npc.z, 2), goal = grid.nearestWalkable(target.x, target.z, 2);
const path = start && goal ? findZhudaPath(grid, start, goal) : null;
if (path?.found) follow(path.points); // from start to goal, corners a straight run can skip taken out
```

- A cell can be stood in if it has ground, no solid within the walker's radius, and the game's own
  `blocked(x, z)` does not refuse it. Two neighbouring cells connect if the step between them is
  no higher than `maxStep`. A path never cuts a corner between two blocked cells.
- `findZhudaPath` is A* over eight neighbours; `visited` says what the search cost, and
  `maxVisited` bounds it. Both ends must be in walkable cells: use `nearestWalkable` first.
- The grid is made once. Rebuild it when solids change; 40 by 40 metres at 0.25 m is 25,600 cells.
- The search is the same on every run: no randomness, no dependence on time.

## A walking capsule

```ts
const body = new ZhudaCharacterController({ world: { ground, solids }, position: { x: 0, y: 0, z: 0 }, radius: 0.3, height: 1.7 });
// in the game's fixed step:
const step = body.move(dt, { x: wishX * speed, z: wishZ * speed }, { jump: pressedJump });
node.transform.position = toLaya(body.position);
if (step.landed) playLanding();
```

What `move` does, in order: over the ground in strides of at most half a radius (so nothing is
passed through at any speed), out of every solid in the way (which slides the capsule along a
wall and round a pillar), then up or down.

| Case | Result |
| --- | --- |
| A rise of at most `maxStep` | Taken: stairs and kerbs |
| A rise above `maxStep` | Refused: `blocked` is true |
| Ground that goes on rising steeper than `maxSlopeDeg` | Refused uphill; downhill is not limited |
| No ground ahead (`ground` gives null) | A wall by default; `noGround: 'fall'` lets it walk off |
| A drop deeper than `maxStep` | It leaves the ground (`fellOff`), falls under `gravity`, and lands (`landed`) |
| `jump: true` on the ground | `velocityY` becomes `jumpSpeed`; a press in the air does nothing |

`teleport(position)` puts the feet somewhere and settles whether they are on the ground. The
controller holds no time: the same calls give the same positions.

## The camera

```ts
queries.register(zhudaSolidQueryProvider(solids, 'town'));
const boom = resolveCameraBoom(focus, desired, { queries });
```

The boom then shortens in front of the same walls the character cannot pass.

## Limits

- Checked as numbers in Node (`tests/walk-and-character.test.mjs`): a grid, paths, slides, steps,
  slopes, edges, a fall, a jump and a boom. Not run in a game on a device, and no game in this
  repository uses them yet: the reference games still carry their own movement.
- One height per point: no bridges over walkable ground, no caves. Solids are boxes on the axes
  and upright cylinders: a turned box needs several boxes or the game's own shape.
- No moving platforms, no pushing of other characters, no crouching, no swimming.
- Measuring solids from a model's meshes is not here: a game writes its solids or derives them
  with its own tool.
