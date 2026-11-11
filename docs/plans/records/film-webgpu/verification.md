# Verification record: film-webgpu

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `4f03ccc`)  
Date: 2026-11-11

## Environment

- macOS, Google Chrome headless; WebGPU adapter reported as `apple metal-3`
  (hardware), WebGL through ANGLE Metal on Apple M4.
- Node v26.12.0, TypeScript 5.9.3.

## Checks

| Check             | Exact command or procedure                                                                                                                                       | Result |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Film on WebGPU    | `npm run verify:film-webgpu` (the seven film verifications with `ZHUDA_FILM_RENDERER=webgpu`; each must report a ready WebGPU adapter)                           | PASS   |
| Film on WebGL     | `npm run verify:film`, `verify:film-look`, `verify:film-model`, `verify:film-reflector`, `verify:film-fog`, `verify:film-animation`, `verify:film-environment`   | PASS   |
| Adapters, no GPU  | `node --test tests/webgpu.test.mjs`                                                                                                                              | PASS   |
| Full gate         | `npm run verify` (398 tests), `npm run lint`, `npm run format:check`, `git diff --check`                                                                         | PASS   |
| Consumer-size run | A film scene of six baked town models (about 290 000 triangles, JPEG textures, vertex colours) with fog, 4096 shadows and ambient occlusion, previewed on WebGPU | Drawn  |

Shadow and light measurements of `verify:film-look` are the same on both
backends (shadow share 0.0069, spot shadow 195 → 0, sixtieth lamp 191.7).

## Defects found and fixed

1. **Stale culling after a camera turn.** The environment probe captured
   black on five of six faces: Laya 3.4.2's WebGPU batch agent culls only
   every third frame unless told otherwise. A moved camera or shadow light now
   culls in that frame.
2. **Half-float read-back.** Upstream indexes 16-bit data with byte offsets
   and returns every other row. `readLaya342FloatTarget` copies the texture
   and decodes it; WebGL uses the native call.
3. **glTF depth-normal pass with fog.** `v_fogFactor` is read in the fragment
   stage and never written; the WebGPU compiler rejects it and the frame
   throws. The pass no longer accepts the fog define.
4. **Reflective surface shader.** An early `return` before texture samples is
   invalid WGSL; the surface silently drew nothing. Rewritten without it.
5. **Silent WebGPU failures.** The film host now fails a call when the device
   reported a validation error during it.

## Unverified limits

- Windows, Linux, mobile and other browsers: not run. CI machines without a
  hardware adapter cannot run `verify:film-webgpu`; it is not part of
  `npm run verify`.
- Images differ slightly between backends; no cross-backend pixel comparison
  is claimed.
- No performance measurement. The profiler's GPU timer is WebGL-only.
- Laya's limits are unchanged on WebGPU: one spot shadow, no point-light
  shadows, one environment probe.
