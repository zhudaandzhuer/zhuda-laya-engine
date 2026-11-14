# Verification record: physical-surfaces

- Task document: `docs/plans/records/physical-surfaces/task.md`
- Commits: `8f437ad` (the feature) and the commit that follows it and
  changes this file (the review of 2026-11-14), on top of `9c91a26`. Every
  check below was run again on the second.
- Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`, `MAX_TEXTURE_IMAGE_UNITS` 16. WebGPU: the WebGPU
  build of the browser SDK, native engine `WebGPURenderEngine`, adapter
  `apple` / `metal-3`, not a fallback adapter, `maxSamplersPerShaderStage`
  16 (the default; LayaAir asks for no more and this adapter has no more).
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `9c91a26`; no consumer.
- DPR, viewport and network mode: DPR 1; 960 by 540; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/physical-surfaces-evidence/review-fix/`
  (the parent folder holds the first commit's evidence).

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 541 of 541 (13 in `tests/physical-surfaces.test.mjs`, 2 of them new) | `EV/verify.log` |
| Strict consumer typecheck | `tests/public-types.test.mjs` over `tests/fixtures/public-runtime3d.ts`, which now holds the documented `as const` glass spec and the texture limit. The same snippet against the first commit's declarations: TS2345 twice (`readonly [0.3, 0.85, 0.5]` to a mutable tuple); against these: clean | PASS | part of `EV/verify.log`; `EV/as-const.log` |
| ESM and CJS exports | `require` of `dist/sdk/zhuda-laya-engine.cjs` and `import` of the ESM build: `physicalSurfaceTextureLimit` gives 6, 5 and 4, `validatePhysicalSurfaceSpec` names a rotation without anisotropy and a clear-coat normal scale without clear coat | PASS | `EV/exports.log` |
| Format, lint | `npm run format:check`, `npm run lint` | PASS | `EV/format.log`, `EV/lint.log` |
| Whitespace | `git diff --check` (working tree, before the commit) and `git diff --check 9c91a26..HEAD` (both commits, after it). The first commit alone fails the second form on the two-space line ends of these two records' header lines; they are gone | PASS | `EV/diff-check.log` |
| Physical surfaces, WebGL | `npm run verify:physical-surfaces` | PASS | `EV/webgl.log`, `EV/webgl/evidence/report.json`, `physical-*.png` |
| Physical surfaces, WebGPU | `PHYSICAL_SURFACES_RENDERER=webgpu npm run verify:physical-surfaces` | PASS | `EV/webgpu.log`, `EV/webgpu/evidence/report.json`, `physical-*.png` |

What `verify:physical-surfaces` measured; the numbers are the same on both
backends to the 8-bit value, except glass means that differ by 0.05:

| Measured | Result |
| --- | --- |
| Physical against `pbr`, same settings: clay, gold metal, a colour texture | mean brightness difference 0, 0, 0 of 255 |
| A normal texture on a tangent-framed disc under a light from above | flat 150, leaning one way 182, the other 71; physical and `pbr` with the same texture 0 apart (both read it the same way) |
| Cloth ball, without and with sheen | rim 53 -> 98, centre 57 -> 62 |
| Brushed disc lit from the camera: long-to-wide ratio and screen angle of the highlight (y down) | no anisotropy 1.0; rotation 0: 2.2 at 0 degrees; 45: 2.2 at 135; 90: 2.2 at 90; -45: 2.2 at 45, a quarter turn from +45 (LayaAir's setter would have drawn it as 0); `pbr` at 90: 2.2 at 90 |
| Glass slab over a checkerboard: brightness spread (90th less 10th percentile) of the slab's 54 236 pixels | bare checker 198; clear glass 183 (92 %); tinted glass 128 (65 %); the same surface without transmission 0 (white) |
| Glass tint: green against the mean of red and blue | bare 1.00, clear 1.00, tinted 1.60 |
| Glass without the camera's opaque pass | The slab's pixels against the same surface in black (`color` 0, no transmission): 0 of 255 apart. Tinted against clear: 0 apart. With the pass the same comparisons give 41 and 50. What is seen is a dark grey-blue slab, mean 55 (113 with the pass), spread 36: the sky it reflects, nothing behind it |
| Dark ball with a thin film (film ior 1.8, 500 nm): hue and saturation, centre / middle / edge | 160 degrees 0.52 / 243 degrees 0.13 / 319 degrees 0.26; centre to edge 159 degrees of hue. Without the film the most saturated zone is 0.009 |
| Each texture slot filled alone, on a ball with every feature on before an orange wall: mean change of the ball's pixels, of 255, over the three colours | albedo 40, metallicRoughness 12.9, occlusion 13.7, emission 3.8, specular 0.6, specularColor 0.8, clearCoat 1.0, clearCoatRoughness 0.95, clearCoatNormal 8.8, anisotropy 0.92, sheenColor 4.5, sheenRoughness 4.1, iridescence 6.2, iridescenceThickness 8.3, transmission 15.7, thickness 3.2; normal 0 (the ball has no tangents). The same material drawn twice: 0 |
| Bad specs in the page | sheen on `pbr`, a sheen colour of 2, a thickness texture without volume, an attenuation colour with 0, additive glass, a rotation without anisotropy (physical and `pbr`), a clear-coat normal scale without clear coat, seven textures: each refused with the field named |
| Build without the glTF module (`3d`, `3d-webgpu` profiles) | `Physical surface: LayaAir's glTF shader 'glTFPBR' is not registered. Load LayaAir's glTF module (laya.gltf.js: the 'gltf' feature, browser SDK profile 3d-gltf or 3d-gltf-webgpu) before Laya.init, or use type 'pbr'.` |
| Render queue of a transmissive surface; passes asked for | 3000; `{ opaqueColor: true }`, granted |
| Thirty physical materials made and disposed with a texture only they hold | resources 83 before and after; the texture is not destroyed and has 0 references. Control: a material destroyed with a bare `destroy()` takes such a texture with it (so the check can fail) |
| Page, console, renderer and WebGL errors; shader warnings (main page and the budget page within the limit) | none |

The texture limit, in a scene with a sun and a spot light casting shadows, a
point light with `ZhudaPointShadow`, six more point lights, sky light
(`applyZhudaHemisphereAmbient`) and the camera's opaque pass
(`tests/fixtures/physical-surface-budget.ts`):

| Measured | WebGPU | WebGL |
| --- | --- | --- |
| Samplers a stage holds | 16 (`maxSamplersPerShaderStage`) | 16 (`MAX_TEXTURE_IMAGE_UNITS`) |
| Ball with every feature, no texture: samplers of its pipeline or program | 10: scene 5 (`u_ShadowMap`, `u_SpotShadowMap`, `u_ZhudaPointShadowMap`, `u_LightBuffer`, `u_LightClusterBuffer`), camera 3 (depth, depth-normal and opaque pictures), renderer 1 (`u_IBLTex`), material 1 (`u_IBLDFG`) | 8: the same less the camera's depth and depth-normal pictures, which the shader does not read |
| The same with six textures (the limit): drawn; change from the ball without them | 16 samplers (5 + 3 + 1 + 7); 61 of 255 | 14 samplers; 61 |
| A square with a lightmap, five textures (the limit with `{ lightmap: true }`): drawn | 16 (5 + 3 + 2 + 6) | 14, `u_LightMap` among them |
| A square with a directional lightmap, four textures (`{ lightmap: 'directional' }`): drawn | 16 (5 + 3 + 3 + 5) | 14, `u_LightMap` and `u_LightMapDirection` among them |
| The lightmap lights the square (against the same square without it) | 12 of 255 | 12 |
| One texture more in each of the three cases | refused by `validatePhysicalSurfaceSpec`, with the count and the reason | the same |
| Control, on a page of its own: textures added by hand past the validator until the ball is no longer where it was | drawn at 6; not drawn at 7: "The number of samplers (17) in the Vertex stage exceeds the maximum per-stage limit (16)", then an invalid pipeline layout and pipeline | drawn at 6, 7 and 8; not drawn at 9: "[ShaderCompile]Error compiling shader 'glTFPBR' ... texture image units count exceeds MAX_TEXTURE_IMAGE_UNITS(16)"; `renderer.errors` stays empty |

How the count was found before it was written into the validator (scratch
pages, not kept; the fixture above repeats what matters): WebGPU keeps the
scene's and the camera's bind groups whole (`laya.webgpu_2D.js`,
`WebGPUShaderInstance._create`: only groups 2 and 3 are thinned to the
textures the shader reads), so the scene's five and the camera's three are
bound even in a scene without a shadow; without any shadow-casting light the
scene's group is 3 and a surface would have two samplers to spare, which the
limit does not hand out. With iridescence on, LayaAir's glTF shader does
not read a lightmap at all on WebGL (its samplers are gone from the
program): the lightmapped squares are drawn without iridescence.

## Lifecycle and failure cases

- Disposal detaches all 17 physical texture slots before `destroy` (unit
  test) and leaves the resource count unchanged after thirty cycles, with
  the borrowed texture alive (draw; control: a bare `destroy()` takes it).
- Refused before LayaAir is touched: every out-of-range field, a feature's
  texture without the feature, a field that only shapes a feature without
  it, more textures than the limit (also under a lightmap), a `use` that is
  not a lightmap setting, `metallicGloss` on a physical surface, physical
  fields and textures on `pbr` or `unlit`, a rotation on `unlit`, a rotation
  without anisotropy on `pbr`, additive transmission (unit test, and nine of
  them in the page).
- Missing glTF module: refused in the unit test and in a real build without
  `laya.gltf.js`, on both backends.
- Past the limit (the control): nothing is thrown. WebGPU reports it through
  `context.renderer.errors`; WebGL only as a console warning of LayaAir's.

## Found while drawing

- LayaAir's glTF shader takes its colours linear, as glTF stores them; the
  `pbr` material's `Color` is linearised by LayaAir. The first draw of the
  same clay was 106 against 175 in brightness. Physical colours are now
  linearised by the engine (`zhudaSrgbToLinear`, LayaAir's formula) and the
  two agree exactly.
- LayaAir's standard and glTF shaders read normal textures the same way
  (both turn the green round). The first spec text said otherwise; it was
  corrected after the draw.
- LayaAir's front faces turn clockwise as seen from in front; the fixture's
  disc was first culled.
- The browser SDK's boot splash lies over the canvas for about two seconds:
  the fixture waits for it before drawing.
- Review: a surface with more samplers than a stage holds is not drawn and
  nothing says so but a log line (the reviewer's finding, reproduced: with
  every feature, a ball with 13 textures on WebGL and one with 9 on WebGPU
  were not drawn in a scene with one light and sky light).
- Review: a normal texture on a mesh without tangents changes nothing.
- Review: destroying a material destroys a texture nothing else holds
  (LayaAir removes the reference inside `destroy`, where a count of 0 means
  destroy now); detaching first is what keeps a borrowed texture.

## Prefab evidence (visual work)

Not applicable: an engine material API with engine fixtures, no consumer
prefab.

## Limits and decision

- Phones, mini-game hosts, Windows and other GPUs: not run. A GPU whose
  WebGL has fewer than 16 texture units was not drawn.
- Texture slots: each was drawn alone and changes the picture. That each
  reads the channel the glTF layout names was drawn for the colour and the
  normal texture only; for the others it rests on LayaAir's shader.
- Under a lightmap the limit is checked only when the caller passes `use`;
  `createSurfaceMaterial` checks without it.
- Not counted in the limit: the animation texture of LayaAir's simple
  skinned mesh (read in its shader; not drawn). The materials LayaAir's
  loader makes for a model file are not checked against the limit.
- A physical surface in a probe volume is not lit by it: LayaAir marks only
  its `PBR` shader as taking Volumetric GI (read in `laya.d3.js`; a scratch
  page with a volume in the scene bound no sampler to the surface; not part
  of the script).
- `clearCoat` and `clearCoatNormalScale`, `specular`, `iridescence.factor`
  below 1, `sheen.roughness`, `normalScale`, `occlusionStrength`, blend
  modes other than opaque: validated and mapped by unit tests; drawn only as
  part of the ball with every feature on, not measured one by one.
- `clearCoatRoughness` without `clearCoat` on `pbr` is still dropped without
  a word (film scenes pass it; a physical surface refuses it).
- A WebGL shader that fails to compile does not reach
  `context.renderer.errors` (LayaAir warns on the console). Not changed
  here.
- A transmissive surface does not show another transmissive or transparent
  surface behind it: LayaAir copies the opaque picture once and has no
  back-face pass. Not built.
- LayaAir's glTF shader has slips in paths not used here: a texture
  transform on the specular-factor map would not compile, the iridescence
  thickness transform is not applied, and the sheen colour map's gamma test
  names the wrong define (an sRGB texture from `createSurfaceTexture` is
  not affected). The engine sets no texture transform.
- Frame cost: not measured. Art approval: the pictures are for the owner.
- Film scenes have no physical material.

Decision: **Implemented within scope**, the status `docs/plans/README.md`
defines for an implementation whose stated checks passed with device work
still listed, and the one its row and the task document carry. Not
**Accepted**: no phone was run.
