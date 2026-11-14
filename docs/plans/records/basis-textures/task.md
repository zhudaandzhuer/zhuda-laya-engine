# Agent task: basis-textures

Status: Implemented within scope; desktop WebGL and WebGPU verified, one phone measured\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP5): three.js has `KTX2Loader`; LayaAir 3.4.2 refuses KTX 2 and the engine
listed `KHR_texture_basisu` as unsupported ("No pinned KTX2/Basis decoder
and device upload contract is shipped in this release"). WP5 asks for a
pinned Basis transcoder, a target chosen from the device's capabilities, an
upload through LayaAir's compressed-texture path, and `KHR_texture_basisu`
in the glTF loader.

## Goal

A KTX 2 / Basis texture, alone or inside a GLB, is drawn from a block
format the graphics card samples, with the file's own mip levels, as the
picture of the same pixels uploaded uncompressed, on WebGL and on WebGPU.

## Invariants

- LayaAir 3.4.2 vendor files are not modified. The upload is LayaAir's own
  (`Texture2D._parseKTX`, `_parseDDS`).
- No code is fetched and run by the engine by itself: the game brings the
  transcoder; its WebAssembly bytes are checked against a pinned SHA-256
  before they start, and the script tag of the browser loader carries its
  integrity value.
- The transcoder is not in the engine bundle and not copied into a build
  unasked.
- A texture that cannot be read fails with the reason; inside a model it
  leaves the slot empty and the model's report says so, as other pictures do.
- Stable logical asset ids still go through `AssetProvider`; a model's
  images stay embedded.
- Start-up of the transcoder has a deadline and a cancellation; a transcoder
  that comes up late is let go.

## Dependencies

- Basis Universal transcoder (Binomial LLC, Apache-2.0), the build shipped
  in `three@0.187.0`, vendored unchanged in `vendor/basis` with its hashes.
- LayaAir 3.4.2: `Texture2D._parseKTX` / `_parseDDS`, `RenderCapable`,
  `textureContext.supportSRGB`, the WebGPU engine's device request.
- The glTF intake of record `gltf-intake` (texture source choice, the
  embedded-picture loader, the compatibility report).

## Scope

### Engine

- `packages/core/runtime3d/BasisTexture.ts` (new): `inspectZhudaKtx2`,
  `chooseZhudaBasisTarget`, `zhudaBasisSupport`, `ZhudaBasisTranscoder`,
  `loadZhudaBasisTranscoder`, `createZhudaBasisTexture`,
  `zhudaBasisContainer`, `zhudaBasisTextureBytes`.
- `GltfIntake.ts`, `ModelCompatibility.ts`, `Laya342GltfAdapter.ts`,
  `Assets.ts`: `KHR_texture_basisu` (source choice, report code
  `BASIS_TRANSCODER_MISSING`, the embedded KTX 2 image, the library's
  `basisTranscoder`).
- `Renderer.ts`: the WebGPU device is asked for the compressed-texture
  features the adapter has.
- `packages/compiler/consumer-build.mjs`: `"basis": true`.
- `vendor/basis/` (transcoder, licence, provenance).
- `tests/basis-texture.test.mjs`, `tests/gltf-basisu.test.mjs`,
  `tests/helpers/ktx2-fixture.mjs`, `tests/fixtures/basis-textures.ts`,
  `scripts/verify-basis-textures.mjs`, `npm run verify:basis-textures`.
- `docs/basis-textures.md`.

### Consumer or adapter

A game encodes its own textures and sets `"basis": true`. Nothing of a game
is converted here.

## Non-goals

- An encoder, and a `--ktx2` output of `zhuda-laya-lod` (the plan's "later").
- BC7, PVRTC, ETC1-only devices, cube/array/volume, UASTC HDR, video.
- Transcoding in a worker.
- External KTX 2 images of a `.gltf`.
- Mini-game hosts' own format checks (each host is to be run).

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. `npm run verify:basis-textures` on WebGL and with `BASIS_RENDERER=webgpu`.
3. The same page on a vivo V40.
4. The existing real-draw checks on both backends still pass (the WebGPU
   device request and the glTF adapter changed).

## Unverified limits

See the verification record.
