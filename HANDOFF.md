# Handoff: engine state and open work

Last updated: 2026-11-23. Read "State now", "Current priorities" and "Open
work" first; "History" keeps what each round did, newest first, with its
records. Check every ref again with `git log` before starting.

## State now (2026-11-23)

- `origin/main` is at `27c41b5` (the owner's priority update; CI run 164
  green on Linux, macOS and Windows). Nothing newer is on `main`.
- Branch `claude/handover-review-3q105d` (pushed, **not merged**) adds on
  `27c41b5`: `2623b15` VRM 1.0 import, `78404c8` twenty ready 2D effects,
  `c8b1889` the 2D route and its record, and the commit that carries this
  file. On that branch, in a Linux container (Node 24.22.3): `npm run
verify` 985 of 985, lint, format and `git diff --check` pass. CI runs on
  `main`, pull requests and by hand only, so the branch has no CI run yet.
  Merging is the owner's call.
- The owner's Mac (not visible from a cloud session; as the last Mac update
  left it): the local `feat/vrm` ref pointed at `6f467bb` with no commits of
  its own and the VRM parser draft there was rolled back. The VRM import on
  the branch above is a new implementation, not that draft. The review
  consumer's local `claude/zhuda-engine-review-scenes-w8btzs` is at
  `dc82408` while GitHub has `05bffa8`; `audits/VerifyZhuda` has untracked
  outputs under `review-work/main-verification/out/mac-2026-11-20/` (not
  source, not on GitHub).

## Current priorities (owner's order, 2026-11-23)

1. **A dedicated 2D route and ready 2D effects.** Done within scope on the
   branch: the workflow route [game-2d](docs/routes/game-2d.md), twenty
   presets (`ZHUDA_EFFECT_PRESETS_2D`) played by `ZhudaEffect2D` on the
   existing 2D particles, `npm run verify:effects-2d`. Drawn on desktop WebGL
   in software (SwiftShader) only. Record:
   [task](docs/plans/records/ready-effects-2d/task.md),
   [verification](docs/plans/records/ready-effects-2d/verification.md).
2. **VRM import, VRM 1.0** (the owner chose 1.0 on 2026-11-23). Done within
   scope on the branch: `ZhudaModelLibrary` reads the four `VRMC_*`
   extensions into `instance.vrm`, `ZhudaVrm` applies them (bones,
   expressions, gaze, constraints, spring bones, MToon as toon); `npm run
verify:vrm` draws an avatar the test makes itself. Guide:
   [docs/vrm.md](docs/vrm.md). Record:
   [task](docs/plans/records/vrm-import/task.md),
   [verification](docs/plans/records/vrm-import/verification.md).
3. **Mobile frame-rate checks.** Not started: they need the owner's Mac with
   the vivo V40 and the iPhone 14. Measure the 3D effect presets, picture
   materials, triplanar projection and terrain, and now also the 2D presets
   and a VRM avatar (toon with outline, springs). See
   [ready-effects](docs/plans/records/ready-effects/verification.md) and
   [review-requests-2](docs/plans/records/review-requests-2/verification.md).

## Open work

One list of what earlier rounds left open, by kind; each line names its
record.

### Waiting for the owner

- Merge `claude/handover-review-3q105d` into `main` (above).
- Whether `gtao` becomes the look's default: every scene's picture changes
  ([review-requests](docs/plans/records/review-requests/verification.md)).

### Devices and backends

- The phone frame rates of priority 3.
- The six new draw checks and `verify:film-webgpu` of the outside review's
  patches on the Windows host, the V40 and the iPhone 14; patches 07 and 08
  matter most on Direct3D 11
  ([outside-review-patches](docs/plans/records/outside-review-patches/verification.md)).
- No phone and no Windows run for: the review's requests (both rounds), the
  ready 3D effects and picture materials, the underwater seam and horizon,
  the ribbon draw range. The review's phone models load on the M4 on both
  backends with every clip moving (`beasts-hd`, `bosses-hd`); no frame rate
  was taken on a phone.
- WebGPU for the new work: `verify:vrm` and `verify:effects-2d` were not run
  on WebGPU (no device in the cloud container); the toon material's shade
  colour was drawn on WebGL only.
- A third-party VRM file (VRoid Studio, UniVRM, the Blender add-on) has not
  been loaded; nobody has judged the 2D presets in motion.
- The iPhone on WebGPU (needs HTTPS)
  ([quality-tiers](docs/plans/records/quality-tiers/verification.md)).

### Engine questions not answered

- QA-01: why a browser session's first one or two frames differ by 1/255
  at one pixel on Intel Direct3D 11. On the Windows host
  `verify:instanced-mesh` WebGL differed by 1/255 at one pixel in 2 of 26
  runs of `95aee18` (0 of 24 since instance buffers are destroyed at the
  next frame's start, 0 of 19 before the sweep): that change or QA-01 is not
  known.
- The iPhone: any pass into a target of its own takes the rate under 60
  though frames drawn back to back take 7 to 10 ms; the guess (targets not
  discarded on a tile-based GPU) is not tested.
- The V40: about 20 s of about 50 FPS after loading
  ([draw-warm-up](docs/plans/records/draw-warm-up/verification.md)).
- `verify:quality-governor` fails on WebGL on the Mac, also at `87ab247`,
  and passes on WebGPU (timed assertions under load): run it on a quiet
  machine before trusting either result.
- The page's and the film host's draw counts are not brought together (17
  draws and 141,000 triangles of the review's scene 01 untraced); thin lines
  between probe cells in a dark scene lit by a glow (seen, not looked into)
  ([review-requests-2](docs/plans/records/review-requests-2/verification.md)).

### Not built (each named in its record)

- Area and line lights; a recipe mask by height above ground; lit or soft
  particles.
- VRM: VRM 0.x, `.vrma` clips, extended colliders, MToon's matcap and UV
  animation, a spring's `center` space, first-person layers
  ([docs/vrm.md](docs/vrm.md)).
- Frame-rate tiers as steps for each device and a warning for too many
  draws; the instanced town on the V40; repeat runs and a heavier scene
  ([quality-tiers](docs/plans/records/quality-tiers/verification.md)).
- The quality route's unbuilt areas
  ([render-gaps](docs/plans/records/render-gaps/verification.md)).

### Consumers and the outside review

- Tell the consumers that `COLOR_0` is read as glTF's linear value: models
  with shade baked into vertex colours draw brighter.
- The review's findings without a patch (its
  `deliverables/engine-patches/README.md`, second table) are not started.
- Scene routes for an outdoor landscape and a rigged phone character wait
  for the review's next round on the current engine; no agent was run on
  the routes to see whether it follows them; `docs/zh-CN/README.md` has no
  "Start here" table of routes.
- `zhuda-spacetime-3d` to switch from its prototype to
  `zhudaWarmUpByDrawing`, measured on the V40.
- The floating-island consumer's build notes and `tsconfig.engine-dev.json`
  still name the removed `zhuda-laya-engine-island` folder (it builds
  against `main`; the change is the consumer's).
- The Windows host's packaged consumer web is the DIST-02 one, not rebuilt
  from the current engine.

### Plans still in progress (plan index)

3D model editor, quality defaults and the quality route, what a frame costs
on a phone, phone checks, frame-rate tiers, the quality route's unbuilt
areas, the procedural hand (how it looks is the owner's to judge), and the
three.js gap audit (Proposed). See [docs/plans/README.md](docs/plans/README.md).

## Decided

- VRM 1.0, not 0.x (owner, 2026-11-23).
- The built-in example Prefabs and the Minesweeper scene stay (owner,
  2026-11-23). All eleven files under `assets/` are read by tests, the
  showcase or the guides; nothing is removed. The 2026-11-21 ready-effects
  record was written while this was still open.
- `COLOR_0` is read as glTF's linear value (owner, 2026-11-20).
- LayaAir stays on 3.4.2
  ([decision](docs/plans/records/laya-3.4.3-upgrade/decision.md)).
- The desktop host example runs Electron 45.3.3 with Forge 8.0.1 (0
  advisories); `--verify` shows its window and keeps drawing.
- `verify:film-water` compares the frame after thirty mounts with the one
  drawn just before them (QA-01); `verify:specular-aa` holds the game-sun
  highlight to a truth taken under that sun (GFX-06).
- Hardware CI lanes (Intel/NVIDIA, Chrome/Edge) stay a manual procedure:
  `docs/agent-development.md`, "Windows hardware runs".

## Working in a cloud session

- Node 24 is required (`engines`); the container's default is 22. Use
  `export PATH=/opt/node24/bin:$PATH`, then `npm ci`.
- Draw checks: `export CHROME_BIN=/opt/pw-browsers/chromium`. WebGL is
  SwiftShader (software); there is no WebGPU device. Record WebGPU and every
  device check as UNAVAILABLE, never as a pass.
- The browser checks bundle `dist/sdk`: run `npm run build` (or `npm run
verify`) after a source change and before a `verify:*` check, or it draws
  the old engine.
- `verify:stylized-shading` times out in its 1280 by 720 timing step on
  SwiftShader (the page is too busy to answer); its picture assertions pass
  when that step is left out of a scratch copy.

## History (newest first)

**2026-11-23, cloud session (branch `claude/handover-review-3q105d`).** The
handoff was checked against the repository: its links resolve, `npm run
verify` passed on `27c41b5`, its claims about 2D and VRM held, and its
stale parts (push notes, the CI line, the outside review's download step,
two Safari addresses) were rewritten here. Then priorities 1 and 2 (above).
Defects found on the way and fixed: `ZhudaToonMaterial` copied its spec
through JSON and failed on a real texture in `material.textures` (as its
own guide shows); the 2D particle sprites were marked as plain data, so
LayaAir's 2D pipeline showed a half-alpha pixel at 191 of 255 instead of 135. New on the way: per-bone spring settings, a toon shade colour.

**2026-11-23, owner.** Priorities set (`27c41b5`).

**2026-11-21, ready effects and picture materials.** Eighteen 3D effect
presets on sprites made by a program, `ZhudaEffect3D`, a film scene's
`effect` node, a film material that is a picture among the assets. The
pictures live outside this repository: `ZhudaGameCenter/commonAssets/` (not
a git repository) holds 48 tileable sets with `catalog.json`, a README and
an example scene (point `--film-assets` at it); their 512 versions are also
in `VerifyZhuda/textures/`. Record:
[task](docs/plans/records/ready-effects/task.md),
[verification](docs/plans/records/ready-effects/verification.md).

**2026-11-21, the underwater horizon** (`dc642b2`). The consumer's re-check
of the seam fix found a step at the horizon with light fog on. The medium
counts `maxDistance` of open water on both sides of the horizon and the
backdrop carries the rest; the consumer's frame 1380 reads level on both
backends. Record: the second round of
[underwater-seam](docs/plans/records/underwater-seam/verification.md).

**2026-11-21, routes as formal documents.** Every route is one page in
`docs/routes/<id>.md` in one format, listed by `list_routes` and `get_route`
and by a "Start here" table in `AGENTS.md` and `README.md`. Record:
[task](docs/plans/records/route-registry/task.md),
[verification](docs/plans/records/route-registry/verification.md).

**2026-11-21, the rest of the review's requests** (branch
`feat/review-requests-2`, merged). Prop nodes' `castShadow`, `cullMeters`,
`lod`; materials' `blend`, `alphaCutoff`, `doubleSided`, `opacity`; a
recipe's `alpha` and `shape` masks; `detail`; `grass` and `terrain` nodes;
`projection: 'triplanar'`; `film_scene_query`; packs read again when
edited; glow through `bounceLight` with a check and advice. Nine draw
checks, all in `verify:film-webgpu`. For the review, sixteen tileable
texture sets were generated (gpt-image-2.6-flare) and pushed to
`VerifyZhuda` as `7ee3f17`; the source pictures (102 MB) are on the Mac only
(`audits/VerifyZhuda/textures/raw/`). The review is told in its
`ENGINE-REPLY.md`. Record:
[task](docs/plans/records/review-requests-2/task.md),
[verification](docs/plans/records/review-requests-2/verification.md).

**2026-11-21, three requests of the review.** A film model node's
`cullMeters`, `castShadow`, `cellMeters`; skins over 24 joints ordered at
load into few pieces; `gtao` as the occlusion without the extra scene pass.
Record: [task](docs/plans/records/review-requests/task.md),
[verification](docs/plans/records/review-requests/verification.md).

**2026-11-21, the line across clear water.** Found by the consumer film
`films/pelagic-grove` (its `ENGINE-TASK-underwater-seam.md`): a backdrop
sphere behind the water in `Underwater.ts`, and the view counting all the
water to the surface. Ten stills `engine-fix-*.png` went to the consumer's
`evidence/` (five kept in `audits/underwater-seam-2026-11-21/consumer/`).
Record: [task](docs/plans/records/underwater-seam/task.md),
[verification](docs/plans/records/underwater-seam/verification.md).

**2026-11-20, the outside review's ten patches** (`87ab247`, merged by
fast-forward on the owner's word; the day's branches deleted). The review's
repository is cloned beside the engine (`ZhudaGameCenter/audits/VerifyZhuda`,
private, branch `claude/zhuda-engine-review-scenes-w8btzs`; its own
`HANDOFF.md` is the way in); its reproductions ran on the Mac (Apple M4)
against `e453b60` and `a5dfc6b`. The Mac has `node@24` beside the default
Node (`/opt/homebrew/opt/node@24/bin`). Record:
[task](docs/plans/records/outside-review-patches/task.md),
[verification](docs/plans/records/outside-review-patches/verification.md).

**2026-11-20, frame-rate tiers.** The owner's goal: the best picture that
stays smooth on mobile, in three tiers (60 and over on the Mac, the V40 and
the iPhone 14; 45 to 60; 10 to 45, never under 10). `f56f8a4` the
measuring tool; `f9f1e86` the tiers as data (`ZHUDA_FRAME_TIERS`,
`zhudaFrameTier`, `zhudaTierBudgetMs`), a rung at level 1 drawn at 0.5,
advice for many draws, render targets counted; `94eb400`
`ZhudaFilmicPipeline` keeps no idle occlusion effect (V40 level 1 at 0.7: 57
to 60; iPhone 44..47 to 51..54). On the V40 a smaller render scale brings a
level into a band; on the iPhone the number of draws decides (instanced
houses: 31..35 to 45..49). Reports: `ZhudaGameCenter/audits/quality-tiers-2026-11-20/`.
Record: [task](docs/plans/records/quality-tiers/task.md),
[verification](docs/plans/records/quality-tiers/verification.md).

**2026-11-20, ribbon draw range** (`025dc21`). A 3D ribbon or particle
system whose count changed after its first draw kept the first count;
fixed in `DynamicParticleMesh3D.submit()`, `verify:ribbon-growth` on both
backends. The game that found it re-pinned and dropped its workaround.
Record: [task](docs/plans/records/dynamic-mesh-draw-range/task.md),
[verification](docs/plans/records/dynamic-mesh-draw-range/verification.md).

**2026-11-20, draw warm-up.** `zhudaWarmUpByDrawing` draws a scene behind
its loading screen from the eyes a game names; the fixture's first frame
then compiles nothing (7 ms WebGL, 32 ms WebGPU; 306 / 1252 ms cold). Found
by `zhuda-spacetime-3d` on a V40. Record:
[task](docs/plans/records/draw-warm-up/task.md),
[verification](docs/plans/records/draw-warm-up/verification.md).

**2026-11-18.** The route [a small floating island](docs/routes/floating-island.md)
(from the consumer `games/zhuda-sky-island`; nothing drawn again; record in
`docs/plans/records/floating-island-route/`). Three leftover local
branches, all in `main`, were deleted with their worktrees on the owner's
word. An outside review started on a zip of `e453b60` in a cloud session of
the iPhone's Claude account; it ended on 2026-11-20 with the patches above.

**2026-11-17, the open engine defects.** The owner asked for every open
defect to be fixed. Checked on macOS (every `verify:*` check on both
backends), the Windows host, the iPhone 14 and the V40 (2026-11-18, both
backends). Record: [engine defects](docs/plans/records/engine-defects/verification.md).

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

**2026-11-16/17, three plans**, all implemented:

| Plan                                                                                   | State                                                                                                                       | Records                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Windows acceptance fixes](docs/plans/records/windows-acceptance/plan.md)              | All 19 items closed on the report's Windows host (desktop session, Intel UHD 770), with macOS and a vivo V40 for comparison | per item in `docs/plans/records/windows-acceptance/` |
| [Techniques from Abyssal Garden](docs/plans/records/abyssal-garden-techniques/plan.md) | AG1..AG6 implemented (desktop WebGL and WebGPU; AG2, AG3 and AG1's regression checks also on the V40)                       | linked from the plan's Progress table                |
| [Mesh boolean operations (CSG)](docs/plans/records/mesh-csg/plan.md)                   | `zhuda-laya-engine/csg` optional entry (BSP), desktop and V40                                                               | `docs/plans/records/mesh-csg/`                       |

AG1..AG6 and CSG were built in a separate session on branch
`claude/fervent-lovelace-44d9db` and merged into `main` after review, with
`npm run verify`, lint, format, the draw checks on both backends and phone
runs at each merge.

**Earlier.** The two Adreno findings of the phone runs were fixed
([record](docs/plans/records/phone-findings-adreno/verification.md)); GitHub
issue #8 (WebGPU glTFPBR pipeline invalid after about 70 s) is fixed in
[webgpu-node-bindings](docs/plans/records/webgpu-node-bindings/verification.md)
and verified in the game by its own session (0 errors in 11 rounds on
`renderer: auto`).

## Machines

- Windows host (`win-bdl`): work folder
  `D:\claude-workstation\zhuda-windows-batch1` (checkouts `fixed`, `base`,
  logs and evidence). No test install or scheduled task of this work is
  left; GPU checks there run in the signed-in desktop session through a
  scheduled task, never over SSH (session 0).
- iPhone 14: Safari was last left on a page of a check server on the Mac,
  which is stopped; earlier updates named two addresses on different days
  (`https://192.168.2.59:8765/control.html` and `192.168.50.80`): close the
  tab. Safari keeps an exception for that self-signed certificate. It is
  driven through the mobile-control service and must be unlocked and awake.
- vivo V40: checks through `ZHUDA_PHONE_CHROME` with
  `adb forward tcp:9333 localabstract:chrome_devtools_remote`; the forward is
  removed after use.
