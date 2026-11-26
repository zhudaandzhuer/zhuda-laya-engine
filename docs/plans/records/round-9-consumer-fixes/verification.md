# Verification record: round-9-consumer-fixes

## Environment

- Base commit `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, 2026-11-25.
- Linux container, Node 24. **No npm registry**: dependencies were not
  installed with `npm ci`. TypeScript 5.9.3 (the pin) from its GitHub tag;
  `meshoptimizer`, `pngjs`, `i18next`, `@webgpu/types`,
  `abortcontroller-polyfill` from their GitHub sources; **esbuild 0.28.2
  (pin 0.27.1) and sharp 0.35.4 (pin 0.35.5) as found in the container**.
  eslint could not run (its config's plugins are not installed): **no lint
  was run**. The changed source and test files were formatted with prettier
  3.8.1 as found in the container (pin 3.6.2); one hunk it wanted in old
  code of `tests/film-scene.test.mjs` was left out.
- Browser: headless Chromium 153, SwiftShader. No GPU, no device.

## Checks

| Check | Command | Result |
| --- | --- | --- |
| Build | `npm run build` | pass |
| Types | `tsc --noEmit -p tsconfig.json` | pass |
| Declarations | `node scripts/audit-public-declarations.mjs` | pass |
| Doctor | `node packages/compiler/zhuda-doctor.mjs` | HEALTHY |
| Tests | `node --test tests/*.test.mjs` | 995 run, 993 pass, 2 fail |
| `npm run verify` as one command | | **not run** (it would stop at the two failures below) |
| `git diff --check` | | pass |

The two failures are the same two that fail on the untouched base commit in
this environment, both with "Browser bundler version differs from the exact
package pin; reinstall dependencies" (the esbuild version above):
"browser distribution is deterministic, integrity-pinned…" and "the page is
given as long to draw a frame as the host waits for it". They must be seen
to pass after `npm ci`.

New and changed tests (all pass): the grass mesh count (6 cases), the
`grass.draws` advice (fires at 256 meshes over 96 patches, names a reach
that clears it, leaves a small lawn alone), the projection (5 tests:
centre, handedness, the lens's edge, behind and outside, straight down and
bad input), timed playback against a fake animator (3 tests), `ground.y`
validation.

The grass count against a drawn frame: for a 72 by 42 m field, `distanceM`
70, eye 18 m outside it, the count is 256 meshes; the frame measured 525
draws with the field and 45 without (480 more: 1.9 times the count, which
fits one more pass over the ground than the colour pass; the passes were not
counted one by one). For a 54 m square field, cutting `distanceM` from 34 to
20 lowers the count by 114 (bands and turf) and lowered the measured frame by
108 to 116.

One real draw: a consumer scene (the VerifyZhuda tower-defence game, a
scratch copy built against this change) with its DOM markers placed by
`stage.worldToScreen` and its field a `ground` at `y: -0.005` over a
terrain's level part: the twelve pad markers and the health bars sit on the
pads and beasts they mark, at 960x540. One frame was looked at.

## Lifecycle and failure cases

No loading, ownership or disposal changed. Refusals added: `durationSeconds`
not above zero, a clip without a length, `speed` together with
`durationSeconds`; an aspect not above zero and a camera looking at its own
eye in the projection; a `ground.y` that is not a number.

## Prefab evidence (visual work)

Not applicable: no visual content changed.

## Limits and decision

- Not run with the pinned toolchain; no eslint; `npm run format:check` not run with the pinned prettier; no device; no GPU.
- `durationSeconds` was checked against a fake animator only: no pose was
  drawn with it. In the consumer game the same arithmetic (`crossFade` then
  `setAnimationSpeed(length / seconds)`) has been drawn.
- `stage.worldToScreen` was looked at for one camera and one picture size.
  It uses the lens of the camera last set; a host that changes the Laya
  camera's field of view by hand is not followed.
- `ground.y` was drawn once; `stage.raycast` against a raised ground was not
  asked.
- The grass advice threshold (150 meshes) is a judgement: half of a phone's
  300 draws, counted before the second pass.

Decision: ready for review as a patch; not to be called verified until
`npm ci && npm run verify` passes on the owner's machine.
