# Agent task: gltf-intake

Status: Implemented within scope; desktop WebGL and WebGPU verified\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14 (after the first review round; its findings and
fixes are in the verification record)

## Source requirement

Work package WP4, "glTF intake quick wins", of the three.js gap audit
(`docs/plans/records/threejs-gap-audit/plan.md` in the review worktree). Its
findings `loading/meshopt`, `loading/mesh-quantization`,
`loading/texture-webp-avif`, `loading/embedded-image-decode`,
`loading/lights-punctual` and `loading/gltf-scene-metadata` say that three.js
r187's GLTFLoader takes in files this engine refused or misread:

- the ratified `KHR_meshopt_compression` name and its COLOR filter;
- quantized vertices (`KHR_mesh_quantization`): LayaAir copies a normalized
  short into a float unscaled, and a file that requires the extension was
  rejected;
- `EXT_texture_webp` / `EXT_texture_avif`: LayaAir reads only
  `textures[i].source`;
- pictures embedded in a GLB: LayaAir base64-encodes each into a data URL;
- `KHR_lights_punctual`, node `extras` and cameras: LayaAir drops them.

Asked in this order, each with unit tests and a compatibility-report code; a
real draw of a quantized + Meshopt model, a WebP-textured model and a model
with punctual lights, each against a plain reference, on WebGL and WebGPU.

## Goal

A model exported with those features loads through `ZhudaModelLibrary` and
draws as its plain equivalent does, and the compatibility report says what the
engine did with each.

## Invariants

- No file under `vendor/` changes. LayaAir's importer is repaired per owned
  `glTFResource` (`prepareLaya342GltfResource`) or before it sees the bytes.
- Every rewrite runs under the existing ModelLibrary lease, provider release,
  cancellation and deadline; nothing is cached a second time.
- Raw `inspectGltfAsset` still describes what the engine will do with the
  file; a device-dependent answer (WebP/AVIF) is used only when given.
- A file that requires what the engine cannot do is refused with its code;
  a lost optional feature is `degraded`, never silent. That holds for what
  only loading shows too: a picture that does not decode, an accessor that
  reads past its view.
- One embedded picture is one texture and one decode, however many material
  slots use it, as in LayaAir's own parse.
- Only a decoder's own answer is remembered for the page. A probe that got no
  answer in time is not a "cannot decode".
- Lights are not made unless the caller asks: copies of a model would copy them.
- No claim beyond what was drawn or measured.

## Dependencies

- `ZhudaMeshoptModelDecoder` (meshoptimizer 1.3.0, pinned), `ZhudaModelLibrary`,
  `inspectGltfDocument`, `destroyLaya342ModelTree`.
- `scripts/lib/chrome-fixture.mjs`, the browser SDK build, `sharp` 0.35.5 (to
  write the WebP/AVIF/PNG fixtures), `packages/compiler/model-lod.mjs` `writeGlb`.

## Scope

### Engine

- `packages/core/runtime3d/GltfIntake.ts` (new): texture-source resolution,
  the WebP/AVIF device probe, the dequantize pass, light/camera/extras readers,
  the glTF-to-LayaAir light mapping, `applyZhudaGltfCamera`.
- `MeshoptModelDecoder.ts`: both names, the COLOR filter.
- `ModelCompatibility.ts`: report codes `DECODER_REQUIRED`,
  `DEQUANTIZED_ATTRIBUTES`, `EMBEDDED_BUFFER_REQUIRED`, `IMAGE_DECODE_UNAVAILABLE`,
  `IMAGE_DECODE_UNANSWERED`, `IMAGE_DECODE_UNCHECKED`, `IMAGE_DECODE_FAILED`,
  `LIGHT_APPROXIMATED`, `INVALID_LIGHT`, `INVALID_CAMERA` (the last two also
  for a node that names a light or camera the file does not have); the four
  extensions in `gltfExtensionCapabilities` (`implementation: 'engine'`);
  inventory fields.
- `Laya342GltfAdapter.ts`: texture source per device, Blob-URL embedded
  pictures (one load a picture, not kept in LayaAir's URL cache, the textures
  that did not load remembered), the node snapshot, `createLaya342GltfLight`.
- `Assets.ts`: the intake order, `instantiate(id, {lights})`,
  `ModelInstance.gltfNodes`, `ModelLibraryOptions.imageDecode` (a host's own
  answer in place of the probe), refusals from the dequantize pass and
  pictures that did not load added to the model's report.
- `index.ts` (shared; lines added), regenerated `packages/types`.
- `tests/gltf-intake.test.mjs`, `tests/fixtures/gltf-intake.mjs`,
  `tests/fixtures/gltf-intake.ts`, `scripts/verify-gltf-intake.mjs`,
  `package.json` `verify:gltf-intake` (a line added), `docs/model-showcase.md`.

### Consumer or adapter

None. A consumer opts into lights per instantiate and reads `gltfNodes`.

## Non-goals

- Draco and KTX2/Basis (other work packages).
- Keeping quantized attributes compact on the GPU (needs LayaAir vertex
  declaration changes).
- `EXT_mesh_gpu_instancing`, texCoord 1 for AO/lightmap slots, Meshopt in
  workers (listed in WP4; not done here).
- Shadows from file lights; physically based light units in LayaAir's shader.
- Files with several scenes (LayaAir builds the default scene only).

## Acceptance checks

1. `node --test tests/gltf-intake.test.mjs`: every feature and its failing paths.
2. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
3. `npm run verify:gltf-intake` and `INTAKE_RENDERER=webgpu npm run verify:gltf-intake`:
   - quantized + KHR Meshopt torus and quantized-only torus against the float
     one: mean channel difference under 0.5, under 0.2 % of pixels off by more
     than 24;
   - lossless WebP (alone; with a different PNG fallback) and AVIF pictures
     against the PNG one;
   - a texture that offers AVIF, WebP and a PNG, each a different picture: the
     AVIF is drawn on this device; the WebP and then the PNG through libraries
     told the device decodes less; a WebP-only file is then refused;
   - the device asked for the first time while the main thread is busy for
     3.5 s still answers yes to both;
   - four materials on one picture, and one material with colour and a packed
     metallic-roughness and occlusion picture: the same number of textures and
     the same texture bytes as LayaAir's own parse, one Blob URL a picture, the
     same pixels;
   - a PNG that does not decode: the model is `degraded` with
     `IMAGE_DECODE_FAILED`, its Blob URL revoked, nothing left in LayaAir's URL
     cache;
   - the room with punctual lights and the file camera against the plain room
     lit and aimed by hand from the documented mapping; no lights unless asked;
   - an orthographic camera from a file: the picture's edges in the frame at
     the pixels the lens and the node's position give, and equal to the view
     set by hand;
   - a library without the decoder refuses the Meshopt file with
     `DECODER_REQUIRED`; thirty load/unload cycles of four models at once (the
     compressed torus, the room with its lights made, a WebP picture, the
     shared pictures) leave resources, the scene's light lists and Blob URLs
     as they were;
   - LayaAir's embedded-picture path against the engine's: same picture; the
     engine's median time below LayaAir's and its sampled JavaScript heap peak
     under a tenth (the measured values are in the record).

## Evidence to attach

- Test/build output: `verification.md`.
- Browser report and pictures: `report.json` and PNGs from both runs.

## Unverified limits

- Phones, mini-game hosts, Safari and Firefox (WebP/AVIF decoders, memory).
- A device that really lacks a decoder, and a decoder that really gives no
  answer: both are drawn or tested only with the answer given by hand.
- Seller or DCC-exported files (all fixtures are generated in code).
- Physical light units against three.js or a DCC render.

## Rollback

Last known good commit `9c91a26`. Reverting this task's commits restores the
previous behaviour: Meshopt under the EXT name only, quantized and WebP/AVIF
files rejected or degraded by the report, lights/extras/cameras dropped.
