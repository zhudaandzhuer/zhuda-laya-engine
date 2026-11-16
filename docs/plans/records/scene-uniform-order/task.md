# Agent task: scene-uniform-order

Status: Done; WebGL and WebGPU verified on the desktop (Apple M4) only
Owner: Engine/toolchain
Last reviewed: 2026-11-17

## Source requirement

`npm run verify:film-remount` failed on `main` on macOS with the WebGL film
host, recorded as open in
`docs/plans/records/windows-acceptance/mem-01-verification.md`:
`scripts/verify-film-remount.mjs:97` expected no stray green and found
`[1265, 1265, 1265, 1265, 1265]`, the same on the first mount and on every
remount. It failed at `bd03844` and `2d7fc04` too, before the MEM-01 changes.

## Goal

The `yard` scene of `verify:film-remount` draws as it did before the defect
(byte-identical to the last good commit) on WebGL, and the check passes on
WebGL and WebGPU.

## What was found

- **Not a remount defect.** Every draw of the scene was wrong: the containers,
  the barriers and the far ground came out blown-out white with green rims
  (the green rims are what the check counts).
- **Introduced by `45f8664`** (foliage that sways in the wind). `git bisect`
  between `49586e0` (good) and `1e75db1` (bad), `npm run build` and the check
  at each step; `777f04c`, its parent, draws correctly.
- **Cause.** `installLaya342Foliage` adds the wind, `u_ZhudaWind` (a
  `vec4`), to LayaAir's `Scene3D` uniform map when LayaAir registers
  `Sprite3DVertex.glsl`. That happens inside `Laya.init` before
  `Scene3D.shaderValueInit` makes the map, so the patch made the map itself
  and the wind became its first entry; LayaAir then appended its own. The
  map as read in the running film host:

  ```text
  u_ZhudaWind, u_ZhudaPointShadowMap, u_Time, u_FogParams, u_FogColor,
  u_LightBuffer, u_LightClusterBuffer, u_GIRotate, u_DirationLightCount
  ```

- **Why it matters on WebGL only.** With uniform blocks on
  (`Config._uniformBlock`, WebGL 2), LayaAir packs the numbers of that map
  into one buffer in the map's order
  (`sceneData.createUniformBuffer('Scene3D', map._idata)`), while every
  shader declares the block from fixed text in `Scene.glsl`:

  ```glsl
  uniform Scene3D{float u_Time;vec4 u_FogParams;vec4 u_FogColor;float u_GIRotate;int u_DirationLightCount;};
  ```

  The wind's 16 bytes in front moved each member: shaders read the wind as
  the time, the time as the fog parameters, the fog parameters as the fog
  colour and the bits of the fog colour's green as the number of directional
  lights. WebGPU was not affected: the check passed there before the fix.
  The point-light shadow's texture is also put in front, but a texture takes
  no place in the buffer; with the parent of `45f8664` the check passes with
  it there.

- **Not only this check.** Of the 20 film draws `verify:film-webgpu` runs, 6
  failed on WebGL without the fix: `verify-film-look` (fog changes the
  distant frame), `-environment` (the mirror shows the red lamp),
  `-remount`, `verify-quality-route` (a metrics flag on the day yard),
  `-point-shadow` (identical frame after other scenes were mounted) and
  `-finishes` (a highlight under a clear coat). All 20 pass with it.
- **Why the foliage task did not see it.** Its unmarked-materials comparison
  used `verify-film-water`, which is among the 14 that still passed; its
  record lists no other film draw.

## Invariants

- LayaAir 3.4.2, no second renderer, smallest change where the defect lives.
- In a map LayaAir declares as a GLSL uniform block (`Scene3D`, `BaseCamera`,
  `Shadow`, `ReflectionProbe`, `VolumetricGIProbe`), LayaAir's own numbers
  stay first and in LayaAir's order; an engine addition comes after them.
- The wind keeps working on both backends (`verify:foliage`).
- The check's threshold and reference are unchanged.

## Scope

### Engine

- `packages/core/runtime3d/Foliage.ts`: `declareWind` adds the wind to
  LayaAir's map when it exists, otherwise right after
  `Scene3D.shaderValueInit` has made it (the method is wrapped once and put
  back on its first call). It no longer makes the map itself. With no map and
  no `shaderValueInit` the wind is not declared, `zhudaFoliageStatus().wind`
  is false and `ZhudaFoliageWind` throws that it is not installed, instead of
  corrupting every lit shader.
- `tests/foliage.test.mjs`: a runtime faked from the vendored LayaAir text
  (its `Scene3D` registrations and its `Scene.glsl` block) checks that the
  block's members stay first and the wind comes last, installed before or
  after LayaAir made the map, and that without a map nothing is declared.
  The test fails on the code of `45f8664`.

### Consumer or adapter

None. A consumer gets the fix with the next pinned SDK.

## Non-goals

- The other engine uniforms: `ObjectMotion` adds to `Sprite3D`, which is not
  a GLSL block; `PointShadow` adds a texture. Neither changes a block's
  layout, so they are left as they are.
- Rewriting the MEM-01 records; the open item there points here.

## Acceptance checks

1. `npm run verify:film-remount` (WebGL): PASS, five mounts byte-identical,
   no stray green, no WebGL error; the frame byte-identical to `777f04c`'s.
2. `ZHUDA_FILM_RENDERER=webgpu node scripts/verify-film-remount.mjs`: PASS on
   a ready WebGPU adapter.
3. `node scripts/verify-foliage.mjs` and with `FOLIAGE_RENDERER=webgpu`: PASS,
   the marked card and its shadow still move.
4. `node --test tests/foliage.test.mjs`: PASS; the new test fails with the
   previous `declareWind`.
5. `npm run verify`, `npm run lint`, `npm run format:check`,
   `git diff --check`: PASS.

## Unverified limits

- Desktop only (Apple M4, ANGLE Metal); no phone run of this change.
- WebGL 1 (no uniform blocks) was not run; the wind's order does not matter
  there.

## Rollback

Last good commit for this check: `777f04c`. Reverting this change brings the
defect back on WebGL; reverting `45f8664`'s install in
`ZhudaEngine.boot` removes the wind and the defect together.
