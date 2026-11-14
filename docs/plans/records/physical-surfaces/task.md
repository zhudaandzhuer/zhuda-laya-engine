# Agent task: physical-surfaces

- Status: Implemented within scope; desktop WebGL and WebGPU verified
- Owner: Engine/toolchain
- Last reviewed: 2026-11-14 (after review: texture limit, see "Review of 2026-11-14")

## Source requirement

WP7 of the three.js gap audit plan (`records/threejs-gap-audit/plan.md`,
not on this branch's base yet: "Material authoring surface: exposes shader
paths LayaAir already has"), from the
owner's goal of 2026-11-14 to surpass three.js in every respect. Findings
`materials/sheen`, `materials/iridescence`, `materials/ior-specular`,
`materials/transmission`, `materials/thickness-attenuation`,
`materials/clearcoat` and `materials/anisotropy`: LayaAir's glTF shader
(`glTFPBR`, registered by `laya.gltf.js`) has sheen, iridescence, ior and
specular, transmission with volume, clear-coat maps and anisotropy, but only
a glTF file reached them; LayaAir's anisotropy rotation setter stops at
1 radian.

## Goal

Game code makes those materials itself:
`createSurfaceMaterial({ type: 'physical', sheen, iridescence, ior, specular,
transmission: { factor, volume }, clearCoat…, anisotropy,
anisotropyRotationDeg, textures })`, drawn on desktop WebGL and WebGPU. A
spec the validator passes is one that is drawn.

## Invariants

- LayaAir 3.4.2 vendor files are not modified. The material is LayaAir's
  own glTF shader, made as `laya.gltf.js` `createDefaultMaterial` makes it
  (`new Laya.Material()`, `setShaderName('glTFPBR')`); uniform and define
  names were taken from `laya.gltf.js` and `laya.d3.js` by search.
- Specs are validated before LayaAir is touched; a bad spec, a field that
  belongs to another type, or a missing glTF module is refused with a
  message naming the field or what to load. LayaAir's own fallback (warn and
  draw Blinn-Phong) is never reached.
- Colours mean what they mean on `pbr`: display colours, linearised the way
  LayaAir's `Color` is. With the same settings and no extra feature a
  physical surface draws what a `pbr` surface draws.
- One owner of camera passes: transmission asks for the opaque picture
  through `configureSurfacePasses` (`surfaceMaterialPasses(spec)` says which).
- Borrowed textures are detached before a physical material is destroyed.
- A spec that passes `validatePhysicalSurfaceSpec` is drawn on both backends
  in a scene with every light and shadow the engine has. A shader stage
  holds 16 samplers; LayaAir's WebGPU layout gives 10 of them to the scene,
  the camera, the renderer and the shader's reflectance lookup whatever the
  scene uses, so a surface fills 6 texture slots at most (5 with a
  lightmap, 4 with a directional one). The limit is one number for both
  backends.
- A field or a texture that only shapes a feature is refused without the
  feature (`clearCoatRoughness`, `clearCoatNormalScale`,
  `anisotropyRotationDeg`, the feature textures), not dropped.
- No claim beyond what a script drew: desktop WebGL and WebGPU on one Apple
  M4.

## Dependencies

- `laya.gltf.js` (the `gltf` feature, profiles `3d-gltf`, `3d-gltf-webgpu`).
- `configureSurfacePasses`, `createSurfaceTexture`, `ZhudaDynamicMesh`,
  `computeMeshTangents`, `applyZhudaHemisphereAmbient`.
- `scripts/lib/chrome-fixture.mjs`, the browser SDK build.

## Scope

### Engine

- `packages/core/runtime3d/Surfaces.ts`: `type: 'physical'`, its fields and
  textures; `validatePhysicalSurfaceSpec(spec, use?)`,
  `physicalSurfaceTextureLimit(use?)` and `PhysicalSurfaceUse`,
  `surfaceMaterialPasses`, `zhudaSrgbToLinear`, `zhudaAnisotropyRadians`,
  `ZHUDA_PHYSICAL_SHADER`; `anisotropyRotationDeg` on `pbr` too;
  `disposeSurfaceMaterial` detaches physical texture slots; the colours of a
  spec are readonly tuples, so a literal `as const` spec is taken.
  Regenerated `packages/types/runtime3d/Surfaces.d.ts`.
- `tests/physical-surfaces.test.mjs`, `scripts/verify-physical-surfaces.mjs`
  with `tests/fixtures/physical-surfaces.ts` and
  `tests/fixtures/physical-surface-budget.ts`, `npm run
  verify:physical-surfaces`; the strict consumer fixture
  `tests/fixtures/public-runtime3d.ts` uses the new API, the documented
  `as const` spec included.
- Docs: `docs/filmic-rendering.md` (Physical surfaces), one paragraph in
  `docs/3d-integration.md`, the not-built line on sheen in
  `docs/quality-route.md` and `packages/mcp-server/quality-route.mjs`.

### Consumer or adapter

- None. Film scenes are not changed (`FilmScene.ts`, `FilmStage.ts` belong
  to another package of work): a film material has no physical type.

## Non-goals

- Film scene materials; `Zhuda3D.createMaterial`; `ZhudaLitSurfaceMaterial`
  (its `alpha`, `normalTS` and alpha-hash widening in WP7 is not done here).
- Texture transforms (`KHR_texture_transform` uniforms), dispersion, a
  back-face pass so glass shows glass behind it, bicubic refraction.
- Phones, mini-game hosts, frame cost.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`:
   pass.
2. `npm run verify:physical-surfaces` and
   `PHYSICAL_SURFACES_RENDERER=webgpu npm run verify:physical-surfaces`:
   pass, with pictures. They assert: physical equals `pbr` with the same
   settings (colour, metal, a colour texture, a normal texture); sheen
   brightens the rim of a cloth ball far more than its centre; a brushed
   disc's highlight is round without anisotropy and a streak whose axis
   turns by 45 and 90 degrees with the rotation, and the other way for -45
   (`pbr` at 90 the same); glass shows the checkerboard under it, tinted by
   the attenuation colour, and without the camera's opaque pass is the same
   slab in black, tinted or clear; a thin film turns the hue of a dark ball
   from its centre to its edge; each of the seventeen texture slots, alone,
   changes the picture (`normal` only on a mesh with tangents); bad specs
   and a build without `laya.gltf.js` are refused; thirty materials made
   and disposed leave the resource count as it was and a texture only they
   held alive, where a bare `destroy()` takes it.
3. The same script, in a scene with a sun, a spot light and a point light
   that cast shadows, six more point lights and sky light: a ball with every
   feature and six textures is drawn, a lightmapped square with five and a
   directionally lightmapped one with four, without a shader or pipeline
   message; the samplers of each are counted (WebGPU 16 of 16, WebGL 14 of
   16); one texture more is refused by the validator; set by hand past it,
   the ball stops being drawn at the seventh texture on WebGPU and at the
   ninth on WebGL.

## Evidence to attach

- Test/build output: `verify.log`, `lint.log`, `format.log`.
- Browser/WebGL or device report: `webgl/evidence/report.json`,
  `webgpu/evidence/report.json`, `physical-*.png`.
- Resource/lifecycle report: `resources` in the reports.

## Unverified limits

- Phones, Windows and other GPUs: not run. The limit of 16 samplers a stage
  is WebGPU's default, which LayaAir does not raise, and this GPU's WebGL
  `MAX_TEXTURE_IMAGE_UNITS`; a GPU with fewer WebGL units was not drawn.
- Every texture slot was drawn alone and shown to change the picture; that
  each reads the channel the glTF layout names (roughness in G, and so on)
  was checked for the colour and normal textures only.
- The texture limit under a lightmap is checked when the caller passes
  `use` to `validatePhysicalSurfaceSpec`; `createSurfaceMaterial` does not
  know which renderer a material goes on and checks without one.
- Not counted in the limit: the animation texture of LayaAir's simple
  skinned mesh (one sampler more, read in LayaAir's shader, not drawn).
- A physical surface in a probe volume: LayaAir marks only its `PBR` shader
  as taking Volumetric GI (read in `laya.d3.js`, not drawn).
- The materials of a model file are made by LayaAir's loader and are not
  checked against the limit.
- Transmissive surfaces do not see one another (no back-face pass).

## Review of 2026-11-14

A reviewer drew specs the validator had passed and found them not drawn.
What was changed, point by point:

1. Major: seventeen textures with every feature passed validation and did
   not draw (WebGPU from 10 textures, WebGL from 14, in the reviewer's
   scene). Reproduced; counted where the samplers go on both backends (see
   the verification record); the validator now refuses more than
   `physicalSurfaceTextureLimit()` textures, the docs say why, and the limit
   is drawn at and past its edge on both backends.
2. The documented glass example with `as const` did not typecheck
   (TS2345, readonly tuple). The spec's colours are readonly tuples now; the
   snippet is in the strict consumer fixture.
3. The glass check without the opaque pass had no margin, and "black" was a
   dark grey-blue slab. The slab is compared with the same surface in black
   (0 of 255 apart) and tinted with clear (0 apart; 50 apart with the pass);
   the text says what is seen.
4. Two checks could not fail. The borrowed texture is now held by the
   thirty materials alone, with a control that a bare `destroy()` takes such
   a texture with it. The 405-degree draw is replaced by -45 degrees, which
   LayaAir's setter would have stopped at 0; folding an angle into one turn
   is left to the unit test, since the shader takes any angle.
5. `anisotropyRotationDeg` without `anisotropy`, and `clearCoatRoughness`
   and `clearCoatNormalScale` without `clearCoat`, are refused on a physical
   surface; `anisotropyRotationDeg` without `anisotropy` on `pbr` too.
   `clearCoatRoughness` without `clearCoat` on `pbr` is left as it was
   (dropped): it shipped with the render-gaps work and film scenes pass it.
6. The status in `docs/plans/README.md` and the decision in the
   verification record now say the same thing.
7. The header lines of both records no longer end in two spaces, and
   `git diff --check` is recorded for the commit range.

## Rollback

`9c91a26`. A physical spec can be replaced by `type: 'pbr'` with the same
colour, metallic and roughness (the extra features are then lost).
