# Handoff: plans of 2026-11-16/17 and the defects after them

Last updated: 2026-11-20 ("Next step": the outside review's patches). The three plans and the defect batch under "After
the plans" (`c7ab3d1` to `1197e20`) are on `origin/main`. The V40 results of
2026-11-18 were added in a later commit: `git log origin/main..main` says
whether it is pushed.

## Done

Three plans written on 2026-11-16 into the plan index (`docs/plans/README.md`), all now implemented:

| Plan                                                                                   | State                                                                                                                       | Records                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Windows acceptance fixes](docs/plans/records/windows-acceptance/plan.md)              | All 19 items closed on the report's Windows host (desktop session, Intel UHD 770), with macOS and a vivo V40 for comparison | per item in `docs/plans/records/windows-acceptance/` |
| [Techniques from Abyssal Garden](docs/plans/records/abyssal-garden-techniques/plan.md) | AG1..AG6 implemented (desktop WebGL and WebGPU; AG2, AG3 and AG1's regression checks also on the V40)                       | linked from the plan's Progress table                |
| [Mesh boolean operations (CSG)](docs/plans/records/mesh-csg/plan.md)                   | `zhuda-laya-engine/csg` optional entry (BSP), desktop and V40                                                               | `docs/plans/records/mesh-csg/`                       |

AG1..AG6 and CSG were built in a separate session on branch
`claude/fervent-lovelace-44d9db` and merged into `main` after review, with
`npm run verify`, lint, format, the draw checks on both backends and phone
runs at each merge. CI (`.github/workflows/verify.yml`: Linux verify and
browser, macOS, Windows from a folder with spaces and CJK) is green on
`d0d17fa` (run 43955927723), the commit that put this file here.

## Decided

- The desktop host example runs Electron 45.3.3 with Forge 8.0.1 (0
  advisories); `--verify` shows its window and keeps drawing.
- `verify:film-water` compares the frame after thirty mounts with the one
  drawn just before them (QA-01); `verify:specular-aa` holds the game-sun
  highlight to a truth taken under that sun (GFX-06).
- Hardware CI lanes (Intel/NVIDIA, Chrome/Edge) stay a manual procedure:
  `docs/agent-development.md`, "Windows hardware runs".

## After the plans: the open engine defects (2026-11-17)

The owner asked for every open defect to be fixed. Record:
[engine defects](docs/plans/records/engine-defects/verification.md).

| Defect                                                                                    | State                                                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Lit surfaces of one shader name with other starting values                                | fixed                                                                               |
| WP22: a rim light brighter than the sun took its shadow                                   | fixed (`installLaya342ShadowLightFirst`)                                            |
| WP23: a program that does not compile stopped drawing on WebGPU                           | fixed (its objects are left out, the frame goes on)                                 |
| MEM-01's open part: LayaAir's batch marks, WebGPU and WebGL, and WebGL's instance buffers | fixed (swept; `verify:webgpu-churn` has a `batch` kind)                             |
| `inspectEngineHealth` on a WebGPU page                                                    | fixed                                                                               |
| `strands` turned hair white at any strength (body-lab)                                    | reproduced, fixed: `strength` dims both bands                                       |
| iPhone Safari `Unable to finish` on WebGPU                                                | not reproduced on an iPhone 14 with the engine's pages; the game itself was not run |
| Browser SDK checks read a stale `dist/browser/<version>`                                  | fixed: they build a fresh folder                                                    |

Checked on macOS (every `verify:*` check on both backends), the Windows
host, the iPhone 14 and the vivo V40 (2026-11-18, both backends).

## Open

- On the Windows host `verify:instanced-mesh` WebGL differed by 1/255 at one
  pixel in 2 of 26 runs of `95aee18`; 0 of 24 since the instance buffers are
  destroyed at the next frame's start, 0 of 19 before the sweep. Whether
  those two were the change or Direct3D 11's own first-frame 1/255 (QA-01)
  is not known.
- QA-01: why a browser session's first one or two frames differ by 1/255 at
  one pixel on Intel Direct3D 11 was not found.
- The Windows host's packaged consumer web is the DIST-02 one; not rebuilt
  from the current engine.
- Other plans in the index that were already in progress before this work
  (3D model editor, quality defaults, phone costs, phone checks, quality
  route's unbuilt areas, three.js gap audit) were not part of it.

## Next step

The outside review ended and its ten patches are on `main` as `87ab247`
(2026-11-20), merged on the owner's word by fast-forward from the branch
`fix/outside-review-patches`, which is still there and holds nothing else.
`git log origin/main..main` says whether it is pushed. Record:
[task](docs/plans/records/outside-review-patches/task.md),
[verification](docs/plans/records/outside-review-patches/verification.md).

- Done: the review's repository cloned beside the engine
  (`ZhudaGameCenter/audits/VerifyZhuda`, private, branch
  `claude/zhuda-engine-review-scenes-w8btzs`; its own `HANDOFF.md` is the way
  in). Its reproductions run on this Mac against `e453b60` and `a5dfc6b`
  (the same results; an Apple M4, the first real GPU they ran on), the ten
  patches applied here, documents updated, every check of the record green
  on WebGL and WebGPU.
- Decided by the owner: `COLOR_0` is read as glTF's linear value. Models with
  shade baked into vertex colours draw brighter; consumers are to look.
- Open, in order: (1) push `main` on the owner's word; (2) run the six new draw checks and `verify:film-webgpu` on
  the Windows host, the vivo V40 and the iPhone 14 (patches 07 and 08 matter
  most on Direct3D 11); (3) tell the consumers about `COLOR_0`; (4) the
  review's findings without a patch (its `deliverables/engine-patches/README.md`,
  second table) are not started.
- This Mac: `node@24` is installed beside the default Node (Homebrew,
  keg-only, `/opt/homebrew/opt/node@24/bin`); the default went from 26.12.0 to
  26.13.1 the same day. The checkout got its `node_modules` again with
  `npm ci`, and `dist/` here was built from `87ab247`'s tree.

Frame-rate tiers (2026-11-20, the same day). The owner set the rendering
goal: the best picture that stays smooth on mobile devices, in three tiers by
frame rate (60 and over on this Mac, the vivo V40 and the iPhone 14; 45 to
60; 10 to 45, never under 10). Record:
[task](docs/plans/records/quality-tiers/task.md),
[verification](docs/plans/records/quality-tiers/verification.md), which has
the numbers.

- Done: `scripts/measure-quality-tiers.mjs` and its fixture, on `main` as
  `f56f8a4` (`git log origin/main..main` says whether it is pushed).
  Measured on the three devices. No runtime file
  changed and no tier is defined in the engine.
- Second round, the same day, on the branch `feat/quality-tiers-engine`
  (`git log main..feat/quality-tiers-engine` says whether it is merged): the
  tiers as data (`ZHUDA_FRAME_TIERS`, `zhudaFrameTier`, `zhudaTierBudgetMs`),
  a rung at level 1 drawn at 0.5 in the default ladder, advice for a frame
  of many draws, render targets counted by the profiler, repeated readings
  and counters in the tool. `npm run verify` 941 of 941.
  `verify:quality-governor` fails on this Mac today on both backends, **also
  without the change** (timed assertions, the machine under load): run it
  again on a quiet machine before trusting either result.
- Third round, on the same branch: `ZhudaFilmicPipeline` no longer keeps an
  idle occlusion effect in its chain (LayaAir drew the whole scene again for
  its normals at look levels 1 and 2, and for any look with `ao: 0`). V40,
  level 1 at 0.7: 57 to 60 frames a second; iPhone: 44..47 to 51..54. 35 draw
  checks on WebGL and 24 on WebGPU pass. An experiment that held back
  LayaAir's binds of the canvas between passes gained nothing on the iPhone
  and was not built. `verify:quality-governor` passes on WebGPU and fails on
  WebGL, also at `87ab247`.
- Found: on the V40 a smaller render scale brings a level into a band (level
  1 at 0.7 is 56 to 60); on the iPhone the number of draws decides, and
  houses drawn as instanced copies take level 1 at 0.7 from 31..35 to 45..49.
- Open: (1) on the iPhone any pass into a target of its own takes the rate
  under 60 though the frames drawn back to back take 7 to 10 ms: not
  explained, the guess (targets not discarded on a tile-based GPU) is not
  tested; (2) the iPhone on WebGPU (needs HTTPS); (3) the instanced town on
  the V40; (4) repeat runs, a heavier scene; (5) then the tiers as steps for
  each device, and a warning for too many draws.
- Reports: `ZhudaGameCenter/audits/quality-tiers-2026-11-20/`. The iPhone is
  driven through the mobile-control service: it must be unlocked and awake,
  and its Safari was left at a page of this Mac (`192.168.50.80`, the server
  is stopped).

Added on 2026-11-18, in the commit that carries this note: the route
[a small floating island](docs/routes/floating-island.md), its row in the
routes index and its record (`docs/plans/records/floating-island-route/`).
It was written from the consumer `games/zhuda-sky-island` and its records;
nothing was drawn again.

On the owner's word the same day, three leftover local branches, all
contained in `main`, were deleted with their two worktrees:
`feat/sky-island-effects` (`engines/zhuda-laya-engine-island`),
`claude/fervent-lovelace-44d9db`
(`.claude/worktrees/angry-varahamihira-a9083c`) and
`claude/angry-varahamihira-a9083c`. Only `main` is left, here and on origin;
no issue or pull request is open. The floating-island consumer's build notes
and its `tsconfig.engine-dev.json` still name the `zhuda-laya-engine-island`
folder, which is gone: it builds against `main` instead (`ZHUDA_ENGINE_ROOT`
at this checkout, or a pin at `a961cc6` or later). Its source typechecks
against `e453b60`. That change is the consumer's and was not made.

An outside review was started (it has since ended: see "Next step"). On
2026-11-18 a Claude Code cloud session on the Claude account of the iPhone 14
(not this Mac's account; session title "豬大引擎架構審查與史…", Fable 5.2)
was given a zip of `e453b60` and one brief, which is that session's first
message: review the architecture, then build ten film scenes in a consumer
project outside the engine, in one run without stopping to ask. It is to
hand over a `deliverables` zip to download from that session
(`ARCHITECTURE-REVIEW.md`, `epic-scenes/`, `engine-patches/`). Its own
baseline on the zip: `npm run verify`, lint and format pass.

When it ends: download the zip from that session, and treat each finding as
a report to reproduce here before acting on it. The scenes are consumer
content and stay outside this repository.

Earlier: the two Adreno findings of the phone runs were fixed
([record](docs/plans/records/phone-findings-adreno/verification.md)), and
GitHub issue #8 (WebGPU glTFPBR pipeline invalid after ~70 s) is fixed in
[webgpu-node-bindings](docs/plans/records/webgpu-node-bindings/verification.md)
and verified in the game by its own session (0 errors in 11 rounds on
`renderer: auto`).

## Machines

- Windows host (`win-bdl`): work folder
  `D:\claude-workstation\zhuda-windows-batch1` (checkouts `fixed`, `base`,
  logs and evidence). No test install or scheduled task of this work is
  left; GPU checks there run in the signed-in desktop session through a
  scheduled task, never over SSH (session 0).
- iPhone 14: Safari was left on a page of this Mac's check server
  (`https://192.168.2.59:8765/control.html`, the server is stopped); close
  the tab. Safari keeps an exception for that self-signed certificate.
- vivo V40: checks through `ZHUDA_PHONE_CHROME` with
  `adb forward tcp:9333 localabstract:chrome_devtools_remote`; the forward is
  removed after use.
