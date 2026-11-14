# Agent task: physical-surfaces

Status: Implemented within scope; desktop WebGL and WebGPU verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-14

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
anisotropyRotationDeg, textures })`, drawn on desktop WebGL and WebGPU.

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
  textures; `validatePhysicalSurfaceSpec`, `surfaceMaterialPasses`,
  `zhudaSrgbToLinear`, `zhudaAnisotropyRadians`, `ZHUDA_PHYSICAL_SHADER`;
  `anisotropyRotationDeg` on `pbr` too; `disposeSurfaceMaterial` detaches
  physical texture slots. Regenerated `packages/types/runtime3d/Surfaces.d.ts`.
- `tests/physical-surfaces.test.mjs`, `scripts/verify-physical-surfaces.mjs`
  with `tests/fixtures/physical-surfaces.ts`, `npm run
  verify:physical-surfaces`; the strict consumer fixture
  `tests/fixtures/public-runtime3d.ts` uses the new API.
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
   turns by 45 and 90 degrees with the rotation (405 = 45; `pbr` at 90 the
   same); glass shows the checkerboard under it, tinted by the attenuation
   colour, and is dark without the camera's opaque pass; a thin film turns
   the hue of a dark ball from its centre to its edge; bad specs and a build
   without `laya.gltf.js` are refused; thirty materials made and disposed
   leave the resource count as it was.

## Evidence to attach

- Test/build output: `verify.log`, `lint.log`, `format.log`.
- Browser/WebGL or device report: `webgl/evidence/report.json`,
  `webgpu/evidence/report.json`, `physical-*.png`.
- Resource/lifecycle report: `resources` in the reports.

## Unverified limits

- Phones, Windows and other GPUs: not run.
- Only the scalar factors, a colour texture and a normal texture were drawn;
  the other texture slots are checked by the unit test (uniform and define)
  only.
- Transmissive surfaces do not see one another (no back-face pass).

## Rollback

`9c91a26`. A physical spec can be replaced by `type: 'pbr'` with the same
colour, metallic and roughness (the extra features are then lost).
