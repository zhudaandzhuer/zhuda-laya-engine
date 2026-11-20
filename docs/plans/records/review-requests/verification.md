# Verification record: three requests of the outside review's scenes and models

Task document: [task](task.md)\
Commit: the one that carries this record, on `0a003e9`\
Date: 2026-11-21

## Environment

- macOS (Darwin 27.2), Apple M4. Chrome 157 headless; the film host reports
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)` on WebGL. Node 26.13.1.
- The review's models: `VerifyZhuda` at `3c182f0`, `deliverables/`. They are
  read from there and not copied here.

## Checks

| Check                           | Exact command or procedure                                                                                                                                           | Result                                                                                           |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Verify, lint, format            | `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`                                                                                         | PASS, 951 tests                                                                                  |
| The model node, WebGL           | `npm run verify:film-model-distance` (new)                                                                                                                           | PASS                                                                                             |
| Film checks, WebGPU             | `npm run verify:film-webgpu`                                                                                                                                         | PASS, 25 verifications (24 before, and `verify-film-model-distance`)                             |
| Neighbouring draw checks, WebGL | `verify:film`, `verify:film-model`, `verify:film-animation`, `verify:film-gltf-vertex-data`, `verify:gltf-intake`, `verify:gltf-instancing`, `verify:prefab-models`, `verify:animation-control` | PASS, eight of eight                                                                             |
| Instanced meshes, WebGL         | `npm run verify:instanced-mesh` (it loads a character on thirty joints, which the ordering reaches)                                                                  | PASS three times running, after two runs that timed out waiting for the page ("CDP timeout", once inside a batch of checks, once alone). `0a003e9` without the change passed once in between. The cause of the two was not found |

## 1. The model node

`verify:film-model-distance`: red posts at 15, 40 and 90 m on a pale floor,
960 by 540.

| What                                              | Measured                                                             |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| No options                                        | red pixels at the three posts: 3600, 1200, 359                       |
| `cullMeters: 60`, from the first camera           | 3600, 1200, 0                                                        |
| `cullMeters: 60`, from 30 m off the far post      | 1560 at that post                                                    |
| `castShadow: false`                               | the post is drawn (3600); the floor beside it reads 193, 130 with the shadow |
| `instanced` with `cellMeters` 4 against 4000      | 0 pixels differ; 0 against the same copies as nodes                  |
| `instanced`, `cellMeters: 4`, `cullMeters: 60`    | 3600, 1200, 0                                                        |

Not measured here: the draws a frame of a scene of thousands of copies with
the squares widened (the review's 54,698 was its own count on `ba24ae4`).

## 2. Skins over 24 joints

Pieces LayaAir cuts a primitive into, counted with
`countLaya342SkinPieces` on the review's files:

| File                                    | Joints | Triangles | As in the file | Ordered |
| --------------------------------------- | ------ | --------- | -------------- | ------- |
| `bosses/gltf-standard/chiyou.glb`       | 40     | 139,156   | 43             | 2       |
| `bosses/gltf-standard/lod10/chiyou.glb` | 40     | 13,914    | 41             | 2       |
| `beasts/gltf-standard/jiuweihu.glb`     | 36     | 75,832    | 3              | 2       |
| `beasts/gltf-standard/jiuying.glb`      | 33     | 75,252    | 3              | 2       |
| `beasts-hd/jiuweihu.glb`                | 36     | 13,484    | 3              | 2       |
| `bosses-hd/chiyou.glb`                  | 40     | 37,998    | 3              | 3       |
| `bosses-hd/xuanwu.glb`                  | 34     | 38,000    | 2              | 2       |
| `beasts-hd/dijiang.glb`                 | 26     | 13,434    | 2              | 2       |

Each of those files' other primitives, and every file of 24 joints or
fewer, is one piece before and after. The ordering took 121 ms for the
largest (139,156 triangles) and under 30 ms for the phone models, in Node.

Drawn, before (`87ab247`'s build) and after, with the review's
`measure-draws.mjs` (the engine's own profiler, a still camera, shadows off;
what the model adds to the floor):

| Model                                   | Draws before | after | Triangles |
| --------------------------------------- | ------------ | ----- | --------- |
| `bosses/gltf-standard/chiyou.glb`       | 47           | 7     | 337,036 both |
| `bosses/gltf-standard/lod10/chiyou.glb` | 45           | 6     | 33,680 both  |
| `beasts-hd/jiuweihu.glb`                | 3            | 2     | 13,484 both  |
| `bosses-hd/chiyou.glb`                  | 3            | 2     | 37,998 both  |

`bosses-hd/chiyou.glb` drew in two pieces though the count above says
three for the file's own data: not looked into.

Pictures: `beasts/gltf-standard/jiuweihu.glb` and
`bosses/gltf-standard/chiyou.glb` on Idle at 0.5 s, 960 by 720, before and
after: no channel of any pixel differs. Their ten clips move (two moments of
each differ) before and after.

## 3. Occlusion

The measuring fixture's trace of one frame at look level 3, render scale 0.7
(`out.trace`): with `sao` the scene is drawn into the depth picture (70
draws), into a colour target with a depth buffer (70), and into the frame
(71), 69 render targets in all; with `aoMethod: 'gtao'` the second of those
is gone and the frame takes 63. No picture of the two was compared.

## Limits and decision

- One desktop GPU. No phone, no Windows run of any of this.
- The ordering's effect on frame rate was not measured on a device; on an
  iPhone the number of draws decides (`records/quality-tiers`), so it should
  help there most.
- No scene of the review was mounted with the new keys; its own merged
  meshes are still what it draws.
- The ordering is a greedy pass, not the fewest possible: `bosses-hd/chiyou`
  (40 joints) could be two pieces by count and is three.
- `verify:instanced-mesh` failed twice before it passed three times.

Decision: **Implemented within scope**; device runs keep it from Accepted.
