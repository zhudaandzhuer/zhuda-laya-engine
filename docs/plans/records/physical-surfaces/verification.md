# Verification record: physical-surfaces

Task document: `docs/plans/records/physical-surfaces/task.md`  
Commit: the commit that adds this file, on top of `9c91a26`  
Date: 2026-11-14

## Environment

- OS / browser / device: macOS 27.0.1, Apple M4; Google Chrome 157 headless
  through the repository's `chromeFixture`. WebGL: `ANGLE (Apple, ANGLE Metal
Renderer: Apple M4)`. WebGPU: the WebGPU build of the browser SDK, native
  engine `WebGPURenderEngine`, adapter `apple` / `metal-3`, not a fallback
  adapter.
- Node and package manager: Node 26.12.0, npm 11.20.0.
- Engine and consumer commits: on top of `9c91a26`; no consumer.
- DPR, viewport and network mode: DPR 1; 960 by 540; loopback only.
- Evidence (outside the repository): `EV` =
  `~/Library/Application Support/Claude/side-session-notes/local_a205c175-47c6-4f56-9eb8-a180c0efb2ac/physical-surfaces-evidence/`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, doctor, tests | `npm run verify` | PASS, 539 of 539 (528 before, 11 new in `tests/physical-surfaces.test.mjs`) | `EV/verify.log` |
| Strict consumer typecheck | `tests/public-types.test.mjs` over `tests/fixtures/public-runtime3d.ts`, which now uses the physical API; a string `anisotropyRotationDeg` made it fail (TS2322), as it should | PASS | part of `EV/verify.log` |
| ESM and CJS exports | `require` of `dist/sdk/zhuda-laya-engine.cjs` and `import` of the ESM build: `surfaceMaterialPasses`, `validatePhysicalSurfaceSpec`, `ZHUDA_PHYSICAL_SHADER` present and working | PASS | by hand, this session |
| Format, lint, whitespace | `npm run format:check`, `npm run lint`, `git diff --check` | PASS | `EV/format.log`, `EV/lint.log` |
| Physical surfaces, WebGL | `npm run verify:physical-surfaces` | PASS | `EV/webgl.log`, `EV/webgl/evidence/report.json`, `physical-*.png` |
| Physical surfaces, WebGPU | `PHYSICAL_SURFACES_RENDERER=webgpu npm run verify:physical-surfaces` | PASS | `EV/webgpu.log`, `EV/webgpu/evidence/report.json`, `physical-*.png` |

What `verify:physical-surfaces` measured; the numbers are the same on both
backends to the 8-bit value, except glass means that differ by 0.05:

| Measured | Result |
| --- | --- |
| Physical against `pbr`, same settings: clay, gold metal, a colour texture | mean brightness difference 0, 0, 0 of 255 |
| A normal texture on a tangent-framed disc under a light from above | flat 150, leaning one way 182, the other 71; physical and `pbr` with the same texture 0 apart (both read it the same way) |
| Cloth ball, without and with sheen | rim 53 -> 98, centre 57 -> 62 |
| Brushed disc lit from the camera: long-to-wide ratio and screen angle of the highlight (y down) | no anisotropy 1.0; rotation 0: 2.2 at 0 degrees; 45: 2.2 at 135; 90: 2.2 at 90; 405: 2.2 at 135; `pbr` at 90: 2.2 at 90 |
| Glass slab over a checkerboard: brightness spread (90th less 10th percentile) of the slab's 54 236 pixels | bare checker 198; clear glass 183 (92 %); tinted glass 128 (65 %); the same surface without transmission 0 (white) |
| Glass tint: green against the mean of red and blue | bare 1.00, clear 1.00, tinted 1.60 |
| Glass without the camera's opaque pass | mean 55 against 113 with it |
| Dark ball with a thin film (film ior 1.8, 500 nm): hue and saturation, centre / middle / edge | 160 degrees 0.52 / 243 degrees 0.13 / 319 degrees 0.26; centre to edge 159 degrees of hue. Without the film the most saturated zone is 0.009 |
| Bad specs in the page | sheen on `pbr`, a sheen colour of 2, a thickness texture without volume, an attenuation colour with 0, additive glass: each refused with the field named |
| Build without the glTF module (`3d`, `3d-webgpu` profiles) | `Physical surface: LayaAir's glTF shader 'glTFPBR' is not registered. Load LayaAir's glTF module (laya.gltf.js: the 'gltf' feature, browser SDK profile 3d-gltf or 3d-gltf-webgpu) before Laya.init, or use type 'pbr'.` |
| Render queue of a transmissive surface; passes asked for | 3000; `{ opaqueColor: true }`, granted |
| Thirty physical materials with borrowed textures made and disposed | resources 57 before and after; the borrowed texture is not destroyed |
| Page, console, renderer and WebGL errors; shader warnings | none |

## Lifecycle and failure cases

- Disposal detaches all 17 physical texture slots before `destroy` (unit
  test) and leaves the resource count unchanged after thirty cycles (draw).
- Refused before LayaAir is touched: every out-of-range field, a feature's
  texture without the feature, `metallicGloss` on a physical surface,
  physical fields and textures on `pbr` or `unlit`, a rotation on `unlit`,
  additive transmission (unit test, and five of them in the page).
- Missing glTF module: refused in the unit test and in a real build without
  `laya.gltf.js`, on both backends.

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

## Prefab evidence (visual work)

Not applicable: an engine material API with engine fixtures, no consumer
prefab.

## Limits and decision

- Phones, mini-game hosts, Windows and other GPUs: not run.
- Texture slots other than the colour and normal textures (metallicRoughness,
  occlusion, emission, clear-coat, sheen, iridescence, transmission,
  thickness, specular and anisotropy maps) are checked for uniform and
  define by the unit test only; none was drawn.
- `clearCoat` and `clearCoatNormalScale`, `specular`, `iridescence.factor`
  below 1, `sheen.roughness`, `normalScale`, `occlusionStrength`, blend
  modes other than opaque: validated and mapped by unit tests, not drawn
  on a physical surface.
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

Decision: **In progress**. Implemented and drawn on desktop WebGL and WebGPU
on one machine; no phone was run and most texture slots were not drawn,
which keeps it from Accepted.
