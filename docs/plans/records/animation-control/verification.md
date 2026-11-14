# Verification record: animation-control

Task document: `docs/plans/records/animation-control/task.md`\
Commit: the commit that adds this file, on top of `d969e32`\
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
  Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, adapter
  apple / metal-3, not a fallback. No phone: nothing here depends on the
  graphics card, and the arithmetic costs microseconds.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `d969e32`; no consumer.
- DPR, viewport and network mode: DPR 1; 480 by 300; loopback.
- Evidence (outside the repository): `batch2-evidence/animation-control/`
  in the session's notes folder: the two reports, their pictures and logs.

## Checks

| Check | Exact command or procedure | Result |
| --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 681 of 681 (7 in `tests/animation-blend.test.mjs`) |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS |
| Animation control, WebGL | `npm run verify:animation-control` | PASS |
| Animation control, WebGPU | `ANIMATION_RENDERER=webgpu npm run verify:animation-control` | PASS |
| Draws that pose models, WebGL | film-animation, cinematic, instanced-mesh, stylized-shading, model-showcase | PASS, 5 of 5 |
| On WebGPU | instanced-mesh, stylized-shading, cinematic with the WebGPU switches | PASS, 3 of 3 |

## What is drawn

Nothing is checked in. The check makes a capsule on a chain of twelve bones
with two clips of a second (a bend about one axis, a sway about another),
and the same capsule on three bones as a leg
(`tests/helpers/toon-fixture.mjs`). Most of what is asserted is read from
the bones themselves after a pose; pictures are compared where a picture
says more, and kept for looking at.

## Results

The same on WebGL and on WebGPU unless given.

- **All of one clip is that clip.** A blend with all its weight on one clip
  leaves every bone where LayaAir's own animation puts it (no difference in
  any rotation) and gives the same picture (bit for bit on WebGL).
- **A mix is the two poses mixed.** For weights of a half, a quarter and
  nine tenths, each bone's rotation is the two clips' rotations added by
  the weights and made a unit again, to within 5.5e-7; the pictures lie
  between the two clips', nearer the one with more weight. The same weights
  and phase give the same pose again, as does a whole round later.
- **An overlay leaves the rest alone.** One clip laid over the other from
  the seventh joint up: the six joints below are the base clip's exactly,
  the six from it up the overlay's exactly; at half weight they are half
  way (within 4.4e-6).
- **A pose from two clips on twelve bones takes 0.0025 ms.**
- **Ownership.** A sampler is refused while a blend lives and taken again
  after it is disposed; a disposed blend is refused.
- **Cross-fade in seconds.** With a clip playing, `crossFade` to the other
  over 0.2 s ends, half a second later, in the other clip.
- **Feet on sloping ground.** Five legs hung by the hip over ground that
  rises a quarter of a metre a metre. Four feet are on the ground exactly
  (0 from their targets) with their knees toward the pole; the fifth, whose
  ground is further than the leg is long, is said to be out of reach and
  left almost straight. Both bones keep their lengths to the last digit
  read. Each leg is drawn along its shin where its bones say.
- **Half the weight** leaves the foot half way from where it hung to the
  target. After a clip has posed the leg the solver starts from that pose
  and still reaches.
- **While LayaAir plays a clip by itself**, solved through
  `runZhudaAfterAnimation` the foot stays on its target and the leg is
  drawn there. Solved in a late update it is undone (the foot ends 1.7 m
  off); solved before the draw the bones are on the target and the mesh is
  not. Both are asserted, so a LayaAir that changes its order shows here.
- **A chain of twelve joints** reaches a point within 0.1 mm, its root
  where it was and its bones their lengths; a point out of reach is
  stretched toward. **An aim** turns a box to face a point, and by exactly
  the 20 degrees it is allowed.

## Found on the way

- **LayaAir poses the bones in its scene update and works out the skin
  straight afterwards.** The first legs were drawn straight although their
  bones were bent: the animator, playing by default, had posed the knees
  again. A solve in `onLateUpdate` is undone the same frame; a solve in
  `onPreRender` moves the bones after the skin matrices of that frame were
  taken. `Script.onAfterSceneUpdate` runs between the two, and
  `runZhudaAfterAnimation` uses it.
- **`Animator.crossFade` takes its time as a share of the playing clip's
  length**, not of the new clip's and not in seconds.

## Deviations and unverified limits

- The engine's own solvers, not wrappers for LayaAir's IK module (see the
  task's non-goals).
- The mask is a list of node names for an overlay, not LayaAir's
  `AvatarMask` on a layer.
- One desktop GPU; no phone.
- The check's character is a capsule on a straight chain; both its clips
  animate the same bones with rotations only. A clip that leaves some bones
  alone (made up with rest values), positions and scales in a mix, and a
  blend of three or more clips were not drawn. The arithmetic for a line
  and a plane is unit-tested, not driven by a moving character.
- No authored character was animated; no foot was turned to the slope.
- `crossFade` was checked for where it ends, not for the poses on the way.
