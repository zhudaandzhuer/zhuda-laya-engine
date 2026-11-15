# Agent task: cloth-and-spring-bones

Status: WP18 (cloth) implemented within scope, desktop WebGL and WebGPU verified, measured on a vivo V40; WP19 (spring bones) proposed, not started\
Owner: Engine/toolchain\
Last reviewed: 2026-11-15

## Source requirement

Relayed on 2026-11-15 with the request behind
`records/lit-hook-inputs/task.md`: a consumer study of a knitted cloth on a
body needs a skirt that hangs, swings and can be pulled, and characters
need hair, hems and accessories that follow a skeleton. The engine has
neither. three.js ships neither in its core (its examples carry a cloth
demo and the VRM libraries carry spring bones), so this is past the audit's
list: it is asked for in its own right.

- C1: a cloth solver: particles and distance constraints (structural,
  shear, bend), Verlet integration, a fixed time step, pinned points,
  collision against a table of "height and angle to radius" or against
  capsules, a particle that can be grabbed and dragged. Time comes from the
  existing `ZhudaLayeredClock`; no second timer.
- C2: spring bones (hair, skirt hems, accessories), which may share C1's
  core.
- Gate G5 of the request, written out under "Acceptance checks".

## Goal

A game hangs a cloth from pinned points, lets it fall against a body
without passing through it, lets the player take hold of a point and let
go, and gives a character chains of bones that lag, swing and settle; the
same input gives the same motion every time, and a pause or a lost focus
does no harm.

## Invariants

- One time source: a solver is stepped with the scaled delta of a layer of
  `ZhudaRuntimeSession.layers` (`scaledDeltas`). No `setTimeout`,
  `setInterval`, `performance.now` or `Date.now` in the solver.
- A fixed step: the delta is gathered and spent in whole steps; what is
  left waits for the next frame. A frame's steps are capped, and what is
  over the cap is dropped, not caught up: after a long gap the cloth is
  where it was, not flung.
- Deterministic: no random numbers, no dependence on the frame rate beyond
  how many whole steps a delta holds; the same deltas give the same bytes.
- The solver is plain arithmetic on typed arrays, without LayaAir: it runs
  in `node --test`. What draws it (`ZhudaDynamicMesh`) and what turns bones
  (`runZhudaAfterAnimation`) are separate owners with a `dispose`.
- The engine decides no gameplay: what may be grabbed, what a pull means
  and what a cloth is made of are the consumer's.
- Vendor files are not modified.

## Dependencies

- `ZhudaLayeredClock`, `ZhudaRuntimeSession.layers`.
- `ZhudaDynamicMesh` (`setPosition`, `updateRange`, normals, `colors` for a
  number such as stretch; `records/lit-hook-inputs/`).
- `runtime3d/Ik.ts` (`runZhudaAfterAnimation`, the quaternion helpers) for
  writing bones after the animator.
- Picking for a grab is the consumer's (the triangle query provider of
  WP14, or its own).

## Scope

### Engine

- `simulation/ParticleCore.ts` (WP18, built): the fixed step
  (`ZhudaFixedStep`: a delta spent in whole steps, a cap, the rest
  dropped); the bodies (`sphere`, `capsule`, `plane`, and `table`, a body
  given as radii by height and angle about an axis, grown square to its
  surface) and how deep a point is in one and the way out
  (`zhudaColliderDepth`, `prepareZhudaTable`, `zhudaTableRadius`).
- `simulation/Cloth.ts` (WP18, built): `createZhudaClothGrid`,
  `createZhudaClothTube`, `createZhudaClothFromMesh` (structural, shear and
  bend constraints, and spans along each thread of a sheet or a tube);
  `ZhudaClothSolver` (gravity, drag, the air on each triangle, constraints
  solved in a fixed order one way and then the other, a limit on a
  particle's distance from its pin, bodies with friction, `pin`, `movePin`,
  `unpin`, `shift`, `grab`, `dragTo`, `release`, `nearestToRay`,
  `countInside`, `measureStrain`, `inspect`). Tearing is left out.
- `runtime3d/Cloth.ts` (WP18, built): `ZhudaCloth` binds a solver to a
  `ZhudaDynamicMesh` (positions, normals worked out again, the whole mesh
  uploaded when a step ran, how far each place is stretched written to the
  vertex colour's alpha with `strain`), `update(seconds)`,
  `updateFrom(layers, layer)`, `dispose`.
- `simulation/SpringBones.ts` (new, WP19): chains under a skeleton's bones
  (stiffness toward the animated pose, drag, gravity, a radius), colliders
  that follow bones, written after the animator each frame; the same core.
- Public declarations, `docs/cloth.md`, the MCP guard `GUARD_CLOTH`,
  `verify:cloth` (built); `verify:spring-bones` (WP19).

### Consumer or adapter

- The cloth's shape, pins, colliders' sizes, material and what input grabs
  it.

## Non-goals

- Self-collision of a cloth, tearing, two-way coupling with Bullet, cloth
  on the GPU (a compute pass could carry it later: WP16's
  `ZhudaComputePass`), soft bodies with volume.
- A physically measured fabric: the constraints are a game's cloth.

## Acceptance checks

1. Unit (`tests/cloth.test.mjs`, `tests/spring-bones.test.mjs`):
   - the same deltas give the same positions, byte for byte, twice over
     and in a second solver made the same way; a delta cut in two gives the
     same as the delta whole when both hold the same whole steps;
   - a hanging sheet comes to rest: its energy falls and its constraints
     end within a stated share of their rest length;
   - a pinned point does not move; a grabbed point is within its hand's
     slack of where it is dragged to, and out of reach the hand waits at the
     cloth; released, it falls;
   - a pause (deltas of zero) changes nothing; a gap of five seconds in one
     delta spends no more than the cap and leaves every position finite
     and within the cloth's reach of its pins;
   - no particle ends inside a sphere, a capsule or the table collider
     after each step, with a stated tolerance;
   - bad input is refused with a message (a constraint to a missing
     particle, a table that is not a grid, a step that is not positive).
2. Lifecycle: thirty times made and destroyed (the solver, its mesh, its
   bone writer) with nothing left in `inspectSceneResources`, and no
   listener left on the runtime.
3. Draw, on WebGL and on WebGPU (`npm run verify:cloth`,
   `npm run verify:spring-bones` with the renderer switch): a cloth hung by
   two corners over a body, a point grabbed, pulled and let go; counted
   from the solver, no vertex inside the collider in any frame; from the
   picture, the body is not seen through the cloth; the picture after a
   fixed number of steps is the same in a second run. A chain of bones
   hung from a bone that is moved lags, swings and settles, and does not
   pass through its collider.
4. `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`; one verification record for WP18 and one for WP19;
   a phone measured, or said not to be.

## Evidence to attach

- WP18: `records/cloth-and-spring-bones/verification-cloth.md`.
- WP19: not started.

## Unverified limits

- WP18: one phone (a vivo V40, WebGL), one run: 7.1 ms a frame for 1,681
  particles and 3.0 ms for a skirt of 576 (desktop: 2.4 ms and 1.1 ms).
  WebGPU on a phone is not run.
- WP18: a table is one rigid shape about one axis, so a leg that bends is
  two; its ends are flat, and a cloth over a sharp rim shows the rim.
- WP18: no self-collision; a body thinner than `maxSpeed * step` may be
  crossed; a free cloth over small supports stretches about a tenth.
- WP19: nothing is built.

## Rollback

WP18 is one commit on top of `6668933` and adds files only (two exports in
`packages/core/index.ts` and `runtime3d/index.ts`): reverting it removes the
cloth and changes nothing else. WP19 will be its own commit.
