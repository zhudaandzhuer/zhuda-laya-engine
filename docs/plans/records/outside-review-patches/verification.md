# Verification record: ten patches from the outside review

Task document: [task](task.md)\
Commit: the one that carries this record, on `a5dfc6b`\
Date: 2026-11-20

## Environment

- macOS (Darwin 27.2), Apple M4. Chrome 157.0.8103.79, headless; the film host
  reports `ANGLE (Apple, ANGLE Metal Renderer: Apple M4)` on WebGL. The WebGPU
  runs do not print their adapter's name.
- Node 26.13.1, npm 11.20.0. Two of the review's tests need
  `--experimental-transform-types`, which Node 26 no longer has: those ran on
  Node 24.22.3.
- Engine: `a5dfc6b` with the ten patches. The review's files:
  `VerifyZhuda`, branch `claude/zhuda-engine-review-scenes-w8btzs`, `fc89029`.

## Checks

| Check                           | Exact command or procedure                                                                                                                                             | Result                                                                                         |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Build                           | `npm run build`                                                                                                                                                        | PASS                                                                                           |
| Verify                          | `npm run verify`                                                                                                                                                       | PASS, 937 tests (935 before, one of patch 02, one of patch 10)                                 |
| Lint, format, whitespace        | `npm run lint`, `npm run format:check`, `git diff --check`                                                                                                             | PASS                                                                                           |
| Draw checks, WebGL              | every `verify:film*` script but `verify:film-webgpu`, and `verify:lens-finish`, `verify:edge-smoothing`, `verify:live-look`, `verify:gltf-intake`, `verify:prefab-models`, `verify:hdr-environment`: 30 scripts, one after another | PASS, 30 of 30                                                                                 |
| Draw checks, WebGPU             | `npm run verify:film-webgpu`                                                                                                                                           | PASS, 24 verifications (20 before, and panorama, lut, cloud-depth, gltf-vertex-data)           |
| The same two rows without the patches | the same commands in a clone of `a5dfc6b`                                                                                                                         | PASS, 25 of 25 and 20 verifications: the patches change no result of an existing check        |
| The review's reproductions, before | `ENGINE=<a5dfc6b> bash run-repros.sh --slow`                                                                                                                         | 36 run; the defects of patches 03, 04, 06, 07 (film), 09, 10 fail as the review saw; 01, 08, the `ZhudaHdrEnvironment` half of 07 and the 1080p still of 02 pass on this GPU |
| The review's reproductions, after | `ENGINE=<a5dfc6b with the patches> bash run-repros.sh --patched`                                                                                                      | every reproduction a patch fixes passes                                                        |
| LIFE-03, LIFE-05 on Node 24     | `node --experimental-transform-types --no-warnings --test <repro>` in each tree                                                                                         | LIFE-03: 0 of 2 pass before, 2 of 2 after. LIFE-05 (no patch): 0 of 2 in both                 |

Logs of the review's reproductions and of the runs in the two clones are in
`VerifyZhuda`, `review-work/main-verification/out/mac-2026-11-20/`
(`SUMMARY.md`, `PATCH-EVALUATION.md`). The runs in this checkout wrote their
logs to a session folder that is not kept.

## Lifecycle and failure cases

- 03: a caller's cancel ends that caller's wait and not the shared load; the
  load ends at the provider's own deadline or at `dispose()`
  (`LIFE-01-manifest-shared-cancel.test.mjs`, 4 of 4).
- 04: `dispose()` with a multi-model prefab still loading does not throw and
  the model library is released when the acquisition ends
  (`LIFE-02-prefab-models-dispose-pending.test.mjs`).
- 05: a refused `dispose()` leaves the library usable and a second call
  finishes (`LIFE-03-film-assets-dispose-once.test.mjs`).

## Limits and decision

Not verified:

- No run on Windows (Direct3D 11), Android or an iPhone. Patches 01 and 08 and
  the `ZhudaHdrEnvironment` half of 07 fix what was seen only on SwiftShader
  (software rendering, Linux); on the M4 the defect is absent before and after.
  Direct3D 11 treats LayaAir's default anisotropy differently (GFX-03), so 07
  and 08 are the ones to look at there.
- Patch 02 on a slow device: on the M4 no still comes near 30 s.
- No consumer game was drawn with the patches. Models with shade baked into
  `COLOR_0` draw brighter; how the games' scenes look now is theirs to check.
- The panorama sky without mip levels: whether small stars flicker when the
  camera turns was not looked at.
- The WebGPU adapter is not named in the logs.
- The six new draw checks are not in CI, like the other film draw checks.

Decision: **In progress**. Implemented and verified on one desktop GPU on both
backends; the device runs and the consumers' look at `COLOR_0` keep it from
Accepted.
