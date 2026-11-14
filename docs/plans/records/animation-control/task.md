# Agent task: animation-control

Status: Implemented within scope; desktop WebGL and WebGPU verified\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP10): three.js mixes any number of clips by weight (`AnimationMixer`,
`AnimationAction.weight`, `crossFadeTo`) and has an inverse-kinematics
solver for chains (`CCDIKSolver`). The engine could play one clip, or pose
a model at a time of one clip (`ZhudaModelAnimationSampler`). WP10 asks for
a typed cross-fade, a blend of N clips by weight with the arithmetic of a
blend along a line and over a plane, a mask for part of the skeleton, and
inverse kinematics with feet on sloping ground.

## Goal

A character whose walk turns into a run as it speeds up, with a wave laid
over its upper body, and whose feet stand on the ground it is given, each
bone where the arithmetic says: on WebGL and on WebGPU.

## Invariants

- LayaAir 3.4.2 vendor files are not modified.
- No clock: the caller gives the phase of a blend and the time of a clip.
- A model is posed by one thing at a time: a blend, a sampler and LayaAir's
  own playback do not fight over an animator.
- Each clip is evaluated by LayaAir's own evaluator: a blend of all of one
  clip is that clip exactly.
- The solvers change rotations only; bone lengths are kept.
- The arithmetic (weights, the solvers, the quaternion helpers) needs no
  runtime.

## Dependencies

- `ZhudaModelAnimationSampler` (the evaluator path and the animator claim),
  `ZhudaModelInspector`.
- LayaAir 3.4.2: `WebAnimatorEvaluator`, `LayerTask`, `AnimatorPlayState`,
  `prepareStateOwners`, the state's `_realtimeDatas` and `_nodeOwners`,
  `Animator.crossFade`, `Script.onAfterSceneUpdate`.

## Scope

### Engine

- `packages/core/runtime3d/AnimationBlendMath.ts` (new): `zhudaBlend1D`,
  `zhudaBlend2D`, `zhudaNormalizeWeights`, `zhudaBlendSeconds`.
- `packages/core/runtime3d/AnimationBlend.ts` (new): `ZhudaAnimationBlend`
  (`apply`, `overlay`).
- `packages/core/runtime3d/Ik.ts` (new): `zhudaSolveTwoBone`,
  `zhudaSolveChain`, `zhudaAimTurn`, the quaternion helpers,
  `ZhudaTwoBoneIK`, `ZhudaChainIK`, `ZhudaAimIK`, `runZhudaAfterAnimation`.
- `ModelInspector.ts`: `crossFade` in seconds.
  `ModelAnimationSampler.ts`: `claimZhudaAnimator`, `releaseZhudaAnimator`.
- `tests/animation-blend.test.mjs`, `tests/fixtures/animation-control.ts`,
  `scripts/verify-animation-control.mjs`,
  `npm run verify:animation-control`.
- `docs/animation-control.md`.

### Consumer or adapter

A game brings its characters, says how fast they go and where the ground
is. None is checked in: the check makes a capsule on a chain of bones.

## Non-goals

- Wrappers for LayaAir's own IK module (`laya.ik.js`, the plan's wording):
  it is not among the browser SDK's features and was never drawn. The
  solvers here are the engine's own arithmetic, checked without a runtime.
- Joint limits, foot rotation to the ground's slope, a foot-lock.
- Blending what is not a position, rotation or scale (material numbers,
  morph weights); additive clips; root motion.
- A state machine or a blend tree description; `ZhudaActionStateMachine`
  remains the game's own frame data.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:animation-control` on WebGL and with
   `ANIMATION_RENDERER=webgpu`.
3. The existing draws that pose models still pass on both backends.

## Unverified limits

See the verification record.
