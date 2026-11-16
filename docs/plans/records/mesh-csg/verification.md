# Verification record: mesh-csg

Task document: `docs/plans/records/mesh-csg/task.md`\
Commit: the commit that adds this file, on top of `47581de`\
Date: 2026-11-17

## Environment

- macOS 27.0.1, Apple M4; Node 26.12.0, npm 11.20.0; Google Chrome 157
  headless through the repository's `chromeFixture` (WebGL: ANGLE Metal;
  WebGPU: apple / metal-3).
- Evidence (outside the repository): `EV` =
  `/Users/yaowei/Documents/ZhudaGameCenter/audits/mesh-csg-2026-11-17/`:
  `webgl/`, `webgpu/` (pictures, reports, logs), `repeated-cuts.txt`.

## Checks

| Check                                     | Exact command or procedure                                                                    | Result           | Artifact               |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------- | ---------------------- |
| Build, types, declarations, doctor, tests | `npm run verify`                                                                              | PASS, 927 of 927 | —                      |
| Lint, format, whitespace                  | `npm run lint`, `npm run format:check`, `git diff --check`                                    | PASS             | —                      |
| Geometry fixtures                         | `node --test tests/csg.test.mjs`                                                              | PASS, 8          | —                      |
| Consumer typecheck of the subpath         | `tests/types-module-resolution.test.mjs` (Bundler, Node16, NodeNext, strict, no skipLibCheck) | PASS             | —                      |
| ESM, CJS, not in the main bundle          | `tests/csg.test.mjs` (the subpath test)                                                       | PASS             | —                      |
| Draw, WebGL                               | `npm run verify:csg`                                                                          | PASS             | `EV/webgl/`            |
| Draw, WebGPU                              | `CSG_RENDERER=webgpu npm run verify:csg`                                                      | PASS             | `EV/webgpu/`           |
| Repeated cuts                             | a script cutting windows and spheres one after another                                        | see below        | `EV/repeated-cuts.txt` |

## What the fixtures show

- A 2 m box minus a sphere of 720 triangles inside it: volume 8 minus the
  faceted sphere's to 1e-5, closed, every face toward its normals, 12 + 720
  triangles (the box's faces split by the sphere's planes come back whole).
  Union gives the box, intersection the sphere.
- A sphere through the corner: A − B and A ∩ B make A, A ∪ B and A ∩ B make
  A and B, to 1e-4; all three closed.
- Overlapping boxes: union 13, subtract 5, intersect 3 m³, closed. Coplanar
  (shared top and bottom) and touching (face to face) boxes: closed, 12 and
  16 m³; nothing in common gives no triangles.
- A wall 4 × 3 × 0.3 m with a door 1 × 2.1 m: 2.97 m³, closed, 90 triangles
  from 24.
- A triangle without area in an input is left out; an input with a hole is
  refused: "a cannot be cut: 3 open edges: the mesh has a hole".
- The same cut twice gives the same arrays.

## Draw

|                          | WebGL                    | WebGPU                 |
| ------------------------ | ------------------------ | ---------------------- |
| Through the door         | 255, 0, 255 (background) | 255, 0, 255            |
| The wall beside the door | 181, 172.6, 165          | 181, 172.6, 165        |
| Wall: triangles, time    | 90, 2.4 ms               | 90, 2.6 ms             |
| Box minus sphere         | 462 triangles, 12.5 ms   | 462 triangles, 12.4 ms |

## Repeated cuts (Node, desktop)

| Cuts one after another        | Triangles after each                | Closed                                            |
| ----------------------------- | ----------------------------------- | ------------------------------------------------- |
| Five windows in a wall        | 88, 232, 388, 564, 664 (3 to 13 ms) | every one                                         |
| Five spheres apart in a block | 1 204, 2 946, 4 463 (18 to 78 ms)   | the third has 3 open edges; the fourth is refused |
| Spheres overlapping           | 1 384, 3 918 (19, 55 ms)            | the second has 6 open edges; the third is refused |

On the way, two ways of mending seams were tried for the overlapping case:
within 0.1 mm (40 edges of more than two triangles) and within 0.1 µm after
snapping points 0.1 mm apart into one (6 open edges); the second is kept.

## Limits and decision

- BSP suits a few cuts, planar ones best. Curved cutters splinter and, cut
  after cut, break closedness; the report shows it and the next cut refuses
  the result. The plan's other bases (a BVH clip, manifold-3d) are the way
  on if a consumer cuts curved shapes repeatedly.
- No consumer, no worker. Phone (added at the merge into `main`):
  `verify:csg` PASS on a vivo V40 (Adreno 720), WebGL and WebGPU.

Decision: **Implemented** as an optional entry for a few cuts; not accepted
for destructible scenery cut many times.
