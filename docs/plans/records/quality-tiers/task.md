# Agent task: frame-rate tiers, measured

Status: In progress; a measuring tool and first numbers on three devices ([verification](verification.md))\
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
