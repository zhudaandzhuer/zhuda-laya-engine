# Verification record: spring bones (WP19 of cloth-and-spring-bones)

Task document: `docs/plans/records/cloth-and-spring-bones/task.md`\
Commit: the commit that adds this file, on top of `9fb0527`\
Date: 2026-11-15

## Environment

- macOS 27.0.1, Apple M4; Google Chrome 157 headless through the
  repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal Renderer:
Apple M4)`. WebGPU: adapter apple / metal-3. Node 26.12.0, npm 11.20.0.
- DPR 1, 480 by 360, loopback. No consumer. No phone.
- Evidence (outside the repository): `batch2-evidence/spring-bones/`.

## Checks

| Check                                     | Exact command or procedure                                 | Result                                                |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                           | PASS, 791 of 791 (6 in `tests/spring-bones.test.mjs`) |
| Format, lint, whitespace                  | `npm run format:check`, `npm run lint`, `git diff --check` | PASS                                                  |
| Spring bones, WebGL                       | `npm run verify:spring-bones`                              | PASS                                                  |
| Spring bones, WebGPU                      | `SPRING_BONES_RENDERER=webgpu npm run verify:spring-bones` | PASS (three times)                                    |

The older draws were not run again: this adds files and two exports and
changes none.

## Gate G5

The numbers are the same on both backends.

- **The same input, the same result.** Unit: two solvers given the same 240
  deltas and anchors (two chains, a ball): the same joints and rotations,
  byte for byte. Draw: the whole run twice, each in a scene of its own: the
  same joints (`9591ebca`) and no pixel of the two pictures differs.
- **Thirty made and destroyed.** Thirty scenes with a head, a tail, a ribbon
  and their springs, moved and drawn and destroyed: `inspectSceneResources`
  is where it was after every one.
- **A pause, a lost focus.** The layer paused for 45 frames while the tail
  swings: no step, the same joints. One delta of five seconds: 8 steps, 592
  dropped, no joint inside the body. A delta that is not a number is refused
  (unit).
- **A chain hung from a bone that moves does not pass through its
  collider.** `springs-rest.png`, `springs-swing.png`, `springs-settled.png`.
  A tail of six bones behind a head, over a body (a ball of 18 cm) that goes
  with the head; a ribbon of four bones that points sideways at rest. The
  head sways 30 cm each way every 1.2 seconds for 288 frames. Counted after
  every one of 1,189 frames: **0** joints inside the body grown by the
  joints' radius. Read from the nodes: every bone its own length to the last
  digit, every joint within a micron of where the solver has it. At rest the
  tail's nearest joint is 3.5 cm from the body's skin (kept 3 cm outside
  it); swinging, its tip is up to 33 cm from where a stick's would be;
  stopped, it is back within 0.12 mm of where it hung.
- **From LayaAir's frame.** Called by `runZhudaAfterAnimation` for sixty
  frames: 120 steps; stopped, called no more.

## What was found on the way

- A joint pushed straight out of a body and pulled back to its bone's
  length ends inside the body again when it meets it head on. It slides
  round its own joint instead, and what a body moves it by is not kept as
  motion of its own (it was thrown out at twelve metres a second).
- A chain made inside a body (hair on a back) thrashed for two seconds. It
  is moved out of the body when it is laid out, with no motion.
- On WebGPU the canvas shows a frame's transforms only after three
  flushed frames, not two: the fixture flushes three, as the others do.

## Limits and decision

- Chains of plain nodes were drawn, not a skinned mesh.
- No phone. Chains do not meet each other; nothing is tested along a
  joint's path.

**Accepted within scope** for WP19: gate G5 on desktop WebGL and WebGPU.
