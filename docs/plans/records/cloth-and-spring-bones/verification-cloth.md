# Verification record: cloth (WP18 of cloth-and-spring-bones)

Task document: `docs/plans/records/cloth-and-spring-bones/task.md`\
Commit: the commit that adds this file, on top of `6668933`\
Date: 2026-11-15

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback.
- Phone: vivo V40 (V2348, Android 16, Adreno 720), Chrome 156, WebGL
  (`ANGLE (Qualcomm, Adreno (TM) 720, OpenGL ES 3.2)`), device pixel ratio
  2.625; the page of the WebGL check served on loopback through
  `adb reverse` and read over Chrome's remote debugging port. Nothing on
  the phone was changed.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `6668933`; no consumer.
- DPR, viewport and network mode: DPR 1, 480 by 360, loopback.
- Evidence (outside the repository): `batch2-evidence/cloth/` in the
  session's notes folder: both reports and their pictures, and the sweep's
  logs.

## Checks

| Check                                     | Exact command or procedure                                     | Result                                                             |
| ----------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------ |
| Build, types, declarations, doctor, tests | `npm run verify`                                               | PASS, 781 of 781 (17 in `tests/cloth.test.mjs`)                    |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check`     | PASS                                                               |
| Cloth, WebGL                              | `npm run verify:cloth`                                         | PASS                                                               |
| Cloth, WebGPU                             | `CLOTH_RENDERER=webgpu npm run verify:cloth`                   | PASS                                                               |
| Cloth, vivo V40 (WebGL)                   | the same page as the WebGL check, opened in the phone's Chrome | PASS: every number the check judges is the desktop's, to the digit |
| The older draws, WebGL                    | the 45 draws with a WebGPU switch and the thirteen without     | PASS, 58 of 58                                                     |
| The older draws, WebGPU                   | the same 45 with the WebGPU switch                             | PASS, 45 of 45                                                     |

The 45 are the 44 of `records/lit-hook-inputs/verification.md` and the
cloth's own.

## Gate G5, point by point

The numbers are the same on WebGL, on WebGPU and on the phone to the last
digit shown, and where the arithmetic alone is run in node (the solver does
not know which it is in).

### The same input gives the same result

- Unit: two cloths made the same way and given the same 180 deltas (some a
  thirtieth, most a sixtieth of a second), with wind, a ball, a hand that
  takes a particle, drags it and lets go: the same positions and previous
  positions, byte for byte. A delta cut in two is the delta whole (480
  steps either way). A cloth put back (`reset`) and run again is the same
  again.
- Draw: each of the two sheets is run twice, each in a scene of its own.
  The positions' hash is the same both times (`2d21c966` dropped,
  `b019dd76` hung: the same on WebGL, on WebGPU, in node and on the phone)
  and no pixel of the two pictures differs.

### Made and destroyed thirty times, nothing left

Thirty cloths of 17 by 17, each with a lit surface material of its own
(sheen, the stretch read from the vertex colour), two pins and a ball,
moved for six frames, drawn and destroyed: `inspectSceneResources` is where
it was after every one of the thirty. Each part of the page also leaves
nothing (the page's `left`, all zeros). A cloth registers nothing with the
runtime: it is called, it does not listen.

### No burst after a pause or a lost focus

In the hung sheet's run, while a hand presses the cloth against the body:

- The clock's `world` layer is paused for 45 frames: no step runs, the
  positions' hash is the same, no pixel of the picture differs.
- Then one delta of five seconds: 8 steps run (the cap), 1,192 are dropped,
  no particle is inside a body, and the most any thread is stretched after
  it is 0.07. The run goes on as if a thirtieth of a second had passed (the
  unit test compares it with a cloth that was given exactly that, byte for
  byte).
- A delta that is not a number, or less than zero, is refused and nothing
  moves (unit).

### A hanging cloth taken, pulled and let go, with no vertex inside the body

`hang-rest.png`, `hang-front.png`, `hang-pressed.png`, `hang-round.png`,
`hang-released.png`, `hang-settled.png`. A sheet of 25 by 25 (1.2 m square)
hung by its two top corners in front of a body (its axis 38 cm behind the
sheet) made of a table of
radii (a column 1.5 m tall, wider in the middle, oval) with a ball on it,
over a floor.

| Moment                                                          | Measured                                                                                |
| --------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| It falls into place and hangs (360 frames)                      | at rest; stretched 0.19 at most while it falls, 0.06 as it hangs                        |
| A hand takes the middle of its hem and brings it forward        | the hand is at its target (0.000 m off), the particle 4.2 mm from the hand (slack 5 mm) |
| The hand asks for the body's own axis                           | the particle stops 10.0 mm clear of the body's skin (the cloth's thickness)             |
| The layer paused, then a five-second delta                      | as above                                                                                |
| The hand carries it round the body's far side                   | stretched 0.09 at most in the hand                                                      |
| Let go                                                          | it swings (kinetic energy 1.8), then comes to rest 6 cm from where it hung              |
| **Particles inside a body, counted after each of 1,615 frames** | **0**                                                                                   |

6,464 steps in all.

### The other draws

- **Dropped over bodies** (`drape-bodies.png`, `drape-top.png`,
  `drape-side.png`). A free sheet of 41 by 41 (2 m square) dropped over a
  ball, a rod and a table with a round shoulder, onto a floor. No particle
  inside a body grown by the cloth's thickness, and none inside a body
  itself, after any of 480 frames (1,920 steps). Seen from straight above,
  the bodies are 13,832 red pixels before the cloth and **0** once it lies
  on them. It comes to rest; stretched 0.12 at most, 0.10 at rest.
- **A skirt on a body that sways** (`skirt-rest.png`, `skirt-sway.png`,
  `skirt-stopped.png`). A tube of 36 by 16 pinned by its first ring to a
  body (a table for the hips, two rods for the legs) that goes 35 cm each
  way every 1.6 seconds, the bodies and the pins moved every frame. No
  particle inside the moving body in any of 1,008 frames; the hem trails
  the waist by 15 cm as it passes the middle; stretched 0.08 at most; when
  the body stops the hem is under the waist again within a millimetre.

## Lifecycle and failure cases

- Refused with a message (unit): a shape whose constraint names a missing
  particle; a body with a missing or wrong field, a table whose radii are
  not rows times columns, an axis that is not a unit, a forward not square
  to it; an option unknown or out of range; a step that is not 1/1000 to
  1/10; a pin on a particle a hand holds and a hand on a pinned particle;
  a hand, a pin or a body that is not there; any call after `dispose`.
- A check of the check: with the bodies' last word taken out of a copy of
  the solver (in the scratchpad, not in the repository), the dropped sheet
  ends with 13 particles inside a body; the count sees it.

## What was found on the way

- A table pushed a particle straight out from its axis. On a shoulder
  (where the radius falls with height) that threw the cloth sideways off
  the body, a frame at a time, and it never came to rest; and a margin
  measured out from the axis left the cloth three millimetres above a
  shallow shoulder, whose top then showed through the triangles. A table is
  now grown, and left, square to its surface.
- Hung from two corners with only the weave's own constraints, a sheet
  stretched 0.37 at its pins. A limit on each particle's distance from its
  pin, and spans along each thread, bring that to 0.06.
- A hand that holds a particle rigidly and is asked to go where the cloth
  cannot reach stretched the threads at the particle by a quarter. The hand
  now eases off where those threads are stretched and waits at the cloth.
- Pins moved half a metre in one frame, in the sheet's own plane, left the
  sheet folded over its rail for good. `shift` carries a cloth elsewhere;
  the guide says so.
- A particle put on a body's surface is left a hair inside or outside by
  single precision; pushed again for it every pass, every body was asked
  four times a step. A micron is now "on the skin".

## Prefab evidence (visual work)

Not applicable: engine fixtures only, no consumer prefab.

## Limits and decision

Not verified, not built:

- One phone, WebGL, one run. WebGPU on a phone is not run. Times (the
  mesh written and uploaded): 2.4 ms a frame for the 1,681 particles and
  1.1 ms for the skirt of 576 on the desktop; 7.1 ms and 3.0 ms on the vivo
  V40.
- No collision of a cloth with itself, no tearing.
- A free cloth over small supports stretches about a tenth at the default
  step; the guide gives what smaller steps and more rounds buy.
- A body thinner than `maxSpeed * step` (2.5 cm) may be crossed by a fast
  cloth: nothing is tested along a particle's path.
- A cloth made from a mesh has no spans; none was drawn.
- A table's ends are flat: a cloth over a sharp rim shows the rim.
- The mesh has no tangents.
- The times above read the time of day and are reported, never judged.
- WP19 (spring bones) is not started.

**Accepted within scope** for WP18: gate G5 on desktop WebGL and WebGPU,
and the same page on one phone (WebGL).
