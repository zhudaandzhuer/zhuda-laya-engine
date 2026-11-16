# Task: water ripples from moving bodies

Status: Implemented within scope; desktop WebGL and WebGPU verified
Owner: engine
Last reviewed: 2026-11-16

## Source requirement

A consumer game (豬大時空3D, 2026-11-16) lets its character swim across a river
drawn with `ZhudaWaterSurface`, and moors a rocking boat at a jetty. Nothing
disturbs the surface where they are. The swimmer looks pasted onto the water.
The user's standing direction is to put a missing capability into the engine
rather than fake it in a game, and to match or beat three.js. Three.js's
`Water`/`Water2` have no interaction either; the usual answer there is a
height-field simulation or decals.

## Goal

A game passes up to four ripple sources a frame (position, radius, strength,
velocity). The water then shows:

- rings spreading from each source;
- a V-shaped wake trailing a moving source, with transverse waves inside the V;
- a little froth at the waterline and close behind a moving source.

All of these bend the reflection, the refraction and the sun glint, because
they tilt the same surface normal.

## Design

- `ZhudaWaterSurface.setRipples(sources)`: up to `ZHUDA_WATER_MAX_RIPPLES` (4)
  sources of `{ x, z, radius, strength, velocity? }`. An empty list turns them off.
- Shader:
  - Each source is two `vec4` uniforms. The number of sources is in the free
    lane of `u_ZhudaWaterFlags`, and the whole ripple branch is skipped when it is 0.
  - The ripple height is an analytic function of position and time:
    - Rings: λ 0.32 m, 1 Hz, decaying over 1.4 m.
    - Wake arms: each point of the path sends out a ring that spreads at 0.5 m/s,
      so the arms open at `atan(0.5 / speed)`; crests 0.35 m apart, gone after about 2.5 s.
    - Transverse waves: λ = 2πv²/g, held in the source's frame, as in a Kelvin wake.
  - Its slope is taken by finite differences and added to the water's own
    slope before the normal is normalised.
- `zhudaWaterRipple` is the same function in TypeScript, for tests and for a
  game that wants to know the height, as `zhudaWaterAbsorption` is for the depth tint.
- `validateZhudaWaterRipples` names each wrong field.
- Film scenes: a `water` node takes `ripples` (the same fields, with
  `position: [x, z]`). A film can then show a boat's wake, and the
  real-GPU water check can draw ripples on both backends.

## Invariants

- No sources: the shader takes the same path as before. The only additions
  are a branch on a uniform and eight unused uniforms. The existing water check
  frames stay as they were.
- Ripples are drawn, not simulated. They do not move the water's level, its
  foam line or anything floating on it. The caller supplies the sources
  every frame from its own rules (the engine decides nothing about where a body is).
- Both backends draw the same code (the `ZhudaShaderMaterial` surface).

## Dependencies

- `packages/core/shaders/WaterSurface.ts`
- `packages/core/film/FilmScene.ts`, `FilmStage.ts`
- `scripts/verify-film-water.mjs`, `scripts/verify-film-webgpu.mjs`
- `tests/water-surface.test.mjs`
- Generated declarations in `packages/types`.

## Scope

### Engine

- The files above and `docs/film-scenes.md`.

### Consumer or adapter

- The game re-pins and calls `setRipples` with the swimmer and the boat.
  That is consumer work, outside this repository.

## Non-goals

- A height-field simulation (waves reflecting off banks, interference
  between many bodies).
- Splashes as particles.
- Displacing the surface geometry. The mesh is a flat quad; only the normal changes.
- Mobile GPU cost measurement (no device in this run).

## Acceptance checks

1. `node --test tests/water-surface.test.mjs`:
   - The TypeScript ripple function has rings near a still source and nothing
     under its middle or 8 m away.
   - A moving source's wake is on the arms behind it, opening at
     `atan(0.5/speed)`, and not in front.
   - Strength 0 gives a flat surface.
   - Validation names each wrong field.
2. `npm run verify:film-water`, on WebGL, with a new section:
   - A still source changes pixels within 2.5 m and not 8 m away.
   - A moving source changes more pixels behind it than in front of it.
   - The calm frames without ripples are unchanged from before.
3. `ZHUDA_FILM_RENDERER=webgpu node scripts/verify-film-water.mjs`: the same on WebGPU.
4. Pictures of a still source and a moving one, on both backends, kept in the evidence folder.
5. GPU cost: frame time of a large water view with no source, one still
   source and four moving sources, on WebGL and WebGPU.
6. `npm run verify`, `git diff --check`, `git status --short`.

## Evidence to attach

See [verification.md](verification.md).

## Unverified limits

- Mobile GPUs: not measured.
- Art direction: the amplitudes are tuned for a body of about 0.3–1.5 m at
  walking and swimming speeds. A fast boat may want stronger arms; `strength`
  goes up to 2.
