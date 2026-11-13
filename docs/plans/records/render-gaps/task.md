# Agent task: render-gaps

Status: In progress; built as far as each item could be, desktop WebGL and WebGPU only  
Owner: Engine/toolchain  
Last reviewed: 2026-11-13

## Source requirement

Owner's request of 2026-11-13: finish what `docs/quality-route.md` lists under
"Not built yet": real-time global illumination; reflections of what is off
screen; more and moving shadow-casting lights; automatic exposure, real-time
depth of field and motion blur; decals, parallax and shapes swept along a
path; volumetric clouds; skin, hair and cloth shading.

## Goal

Each item of that list is either built, drawn on desktop WebGL and WebGPU by
a script of its own and documented with its limits, or stays on the list with
the reason it is not built.

## Invariants

- LayaAir 3.4.2 vendor files are not modified. What LayaAir already has
  (`GaussianDoF`, motion vectors, clear coat, sheen, anisotropy, transmission
  in its PBR shader) is exposed and verified, not rewritten.
- Public runtime code and declarations stay in sync; every new option is
  validated and has a failing case in a unit test.
- Every new effect has a disposal path and is switched off by
  `zhudaLookForQuality` at the lower levels.
- Existing scenes draw as they do now unless they ask for a new option:
  nothing here becomes a default.
- On WebGPU a lit shader stage has 16 samplers on common adapters: a feature
  that declares scene textures says how many, and none is declared for
  scenes that do not use it where LayaAir allows that.
- No claim beyond what a script drew: desktop WebGL and WebGPU on one Apple
  M4. Phones, frame times and art approval are not part of this task.

## Dependencies

- `ZhudaFilmicPipeline`, `ZhudaLightFog`, `ZhudaPointShadow`,
  `ZhudaProbeVolume`, `ZhudaScreenReflections`, `ZhudaSceneLook`, film scenes
  and their validator, the film host and `scripts/verify-film-*.mjs`.
- LayaAir 3.4.2 `laya.postProcess.js` and the PBR shader in `laya.d3.js`.

## Scope

### Engine

In the order they are taken; each is its own commit with a row in the
verification record.

1. **Camera**: automatic exposure (the frame's average brightness steers the
   grade's exposure over time), real-time depth of field (LayaAir's
   `GaussianDoF` behind a look option), real-time motion blur from the
   camera's own movement.
2. **Shadows**: point-light shadows for a lamp that follows a model
   (redrawn as it moves), more than four point lights only if the sampler
   budget allows, more than one spot shadow only if LayaAir can draw it.
3. **Reflections**: screen reflections fall back to the environment and the
   sky where the frame holds nothing; box projection for the environment
   probe.
4. **Surfaces**: decals projected onto what lies under them; parallax from a
   height map; shapes swept along a path.
5. **Bounce light**: probes re-captured a few at a time while the scene runs;
   less leaking through thin walls.
6. **Materials and sky**: skin, hair and cloth through LayaAir's own PBR
   features where they exist; clouds.

### Consumer or adapter

- None. `films/river-town-prefab` is used read-only as a picture check.

## Non-goals

- Parity with Unreal Engine's Lumen or Nanite: no ray tracing, no software
  ray marching of the whole scene, no virtual geometry. The README's statement
  that parity is not guaranteed stands.
- Phones and mini-game hosts; frame-time budgets.
- Changing any default of an existing look.

## Acceptance evidence

- `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
- A `verify:film-*` script per item, passing on WebGL and through
  `verify:film-webgpu`, with a picture a person can look at.
- `docs/quality-route.md` "Not built yet" rewritten to what is true after
  each item; `docs/plans/records/render-gaps/verification.md` with command,
  commit, environment, result and artifact path, and every limit.
