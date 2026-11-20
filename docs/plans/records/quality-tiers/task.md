# Agent task: frame-rate tiers, measured

Status: In progress; a measuring tool, numbers on three devices, the tiers and a measured ladder in the engine ([verification](verification.md))\
Owner: Engine/toolchain\
Last reviewed: 2026-11-20

## Source requirement

The owner, 2026-11-20, after being shown what desktop realism of the Unreal
kind would take: the goal is the best picture that stays smooth on mobile
devices, in three tiers named by frame rate:

- **低**: 60 frames a second or more on every target ("多端" is this Mac, the
  vivo V40 and the iPhone 14).
- **高**: 45 to 60, the picture as good as it can be made; the rate may float
  inside the band.
- **極致現實**: 10 to 45, the picture as perfect as possible, never under 10;
  for taking pictures.

Then: "開始量" (measure what the engine gives now), "做中間檔" (find a setting
for the middle band), "查 iPhone" (why the iPhone did not follow), "提交量測工具".

## Goal

One command that says, on a device, what frame rate each look level and
render scale gives, and where the time goes. No tier is defined in the engine
by this task: the numbers come first.

## Scope

### Engine

- `scripts/measure-quality-tiers.mjs` (new) and `tests/fixtures/quality-tiers.ts`
  (new). No runtime file, no public API, no declaration changes.

### Consumer or adapter

- None. The scene is the fixture's own: about 400 boxes as houses on two
  streets, grass round them (`ZhudaGrassField`), under a `ZhudaSceneLook` with
  four shadow cascades of 4096, ambient occlusion, bloom, ground fog with
  beams and clouds.

## What the tool does

- Draws the scene from two views (`street`, `wide`) on the device's own
  screen at its own size (device pixel ratio capped at 2).
- For each step (a look level at a render scale, through `look.setStep`):
  frames a second as the engine's loop draws them, paced by the browser, with
  the 95th percentile of the gaps; and milliseconds a frame drawn back to
  back with the graphics card waited for, with the part of that the page spent
  issuing the frames.
- `TIERS_STEPS=3@1,1@0.7`: which steps. `TIERS_PROFILE=1@0.7`: one step from
  the street with parts of the look and the scene taken away one at a time,
  twice each. `TIERS_TOWN=instanced`: the houses as `ZhudaInstancedMesh`
  copies instead of a node each. `TIERS_RENDERER=webgpu`: the WebGPU build.
- Three ways to reach a browser: headless Chrome on this machine; an Android
  phone's Chrome (`ZHUDA_PHONE_CHROME`, as the phone checks); `TIERS_LAN`,
  which serves on the network and waits for a browser opened by hand to send
  its report (an iPhone's Safari cannot be driven from here).
- It is a measurement: it exits 0 whatever the numbers are, and fails only
  when the page failed.

## Second round: what went into the engine

On the owner's word of the same day ("去把他們完成", after a list of what was
left). Done in this round:

- `zhudaQualitySteps`: a rung at look level 1 drawn at `lowest` (0.5),
  between level 1 at 0.7 and level 0; `effectsAtLowest: false` leaves it out.
- `ZHUDA_FRAME_TIERS`, `zhudaFrameTier(fps)`, `zhudaTierBudgetMs(tier)`: the
  three tiers as data, the tier of a measured rate, and the governor budget
  that holds one. A tier is a budget for the existing governor and ladder,
  which find the rung on each device; there is no table of devices.
- `zhudaFrameLoadAdvice({ drawCalls })` and `ZHUDA_DRAW_ADVICE_FROM` (500):
  what to do about a frame of many draws.
- `ZhudaRuntimeProfiler`: a sample carries `renderTargets` on WebGL, how
  often the frame went to another render target.
- The tool: `TIERS_ROUNDS` (medians of repeated readings), draws and render
  targets a frame, the tier beside each row.

Files: `packages/core/runtime3d/QualityGovernor.ts`,
`packages/core/effects/EffectBudget.ts`, their declarations, the two tests,
`scripts/verify-render-scale.mjs` and `tests/fixtures/quality-governor.ts`
(the ladder they expect and walk), `docs/film-scenes.md`.

Behaviour change: the default ladder has eight rungs where it had seven. A
level kept by `ZhudaQualityMemory` from before means the rung one cheaper
than it did from index 2 up.

Not done in this round, each still open: why a pass into its own target
costs the iPhone a frame; the iPhone on WebGPU; a cheaper HDR chain, light
fog at a lower resolution, cheaper smoothing at levels 2 and 3, shadow maps
drawn less often inside the ladder; a heavier scene.

## Third round: the first cut in the HDR chain

On the owner's word ("繼續做後製優化"). The tool can now list one frame's
passes (`out.trace` of the fixture). What it showed, at look level 1:

- LayaAir binds the canvas between every two passes: a frame of 25 passes
  counts 50 render targets. Holding those binds back (an experiment in the
  fixture, `lazy=1`) halves the count and joins the shadow cascades into one
  pass, and changes nothing on the iPhone (44 against 45 frames a second):
  **not the cause there, and not built into the engine.**
- With ambient occlusion off, the scene was still drawn a third time each
  frame, into a colour target with a depth buffer. `ZhudaFilmicPipeline`
  always put LayaAir's `ScalableAO` in the chain and switched it off with
  `active`; LayaAir's `PostProcess.recaculateCameraFlag` asks every effect
  what the camera must draw for it whether it is active or not, and
  `ScalableAO` asks for depth and normals.

Change: `packages/core/runtime3d/Filmic.ts` puts the occlusion effect in the
chain only when it darkens something (`ao` not false, or `aoMethod: 'gtao'`).
Look levels 1 and 2 switch occlusion off, as does any look with `ao: 0`:
each of them now draws the scene once less a frame. `pipeline.ao` is still
there; with `ao: false` it is not in the chain and making it active
afterwards does nothing.

Still open: the HDR chain's own passes (at level 1 at 0.7: eight full-screen
passes at the render size after the scene, five for bloom, three for the
clouds, two more at the canvas's size for the upscale), light fog at a lower
resolution, smoothing at levels 2 and 3, and what holds the iPhone under 60.

## Invariants

- Nothing on a phone is changed; only a blank tab or one at this machine's
  pages is used.
- The bands are the owner's and are printed beside each row; the tool does
  not decide which step is a tier.

## Non-goals

- Defining the three tiers in the engine (`zhudaQualitySteps` defaults, a
  preset for each device): after the open questions of the verification.
- A real game's scene. The fixture is far lighter in geometry than one.
- The cause of what is left on the iPhone (see the verification).

## Acceptance checks

1. `node scripts/measure-quality-tiers.mjs` prints a table and writes
   `report.json` on this machine, on WebGL and with `TIERS_RENDERER=webgpu`.
2. The same with `ZHUDA_PHONE_CHROME` on the vivo V40, and with `TIERS_LAN`
   from the iPhone 14's Safari.
3. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.

## Unverified limits

See the [verification](verification.md).

## Rollback

The two files can be removed; nothing depends on them.
