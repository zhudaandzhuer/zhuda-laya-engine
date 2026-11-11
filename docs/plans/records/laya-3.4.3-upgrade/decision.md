# Decision record: stay on LayaAir 3.4.2

Status: Decided — not upgrading to 3.4.3  
Owner: Engine/toolchain  
Date: 2026-11-12

## Decision

The engine stays on LayaAir 3.4.2. LayaAir 3.4.3 (released 2026-11-11) was
tried on a throwaway branch and measured; nothing from it is in this
repository. The branch and the extracted libraries were removed afterwards.

## Why not

1. **It fixes none of the defects this engine works around.** With each
   WebGPU adapter switched off in turn on 3.4.3:

   | Adapter (`WebGPU342Adapters.ts`)            | Without it on 3.4.3                                                |
   | ------------------------------------------- | ------------------------------------------------------------------ |
   | Cull in the frame a camera moved            | The environment probe captures black (`verify:film-environment`)   |
   | Half-float render target read-back          | The environment probe captures black (`verify:film-environment`)   |
   | No fog define in the glTF depth-normal pass | A glTF model with fog and ambient occlusion fails to compile       |
   | 32-bit indices in merged batches            | A 1 000 000-triangle tree drawn twice comes out as a fan of shards |

   The 3.4.3 notes list a fix for camera projection parameters not being
   synced before culling. That is a different defect from the deferred cull
   handled here, which is unchanged.

2. **Its other WebGPU fixes did not affect any check we have.** Spot light
   batch culling, custom draw state, buffer unbinding and the binding cache
   were changed upstream; all eight film verifications already pass on both
   backends with 3.4.2.

3. **Adopting it is not free.** The IDE ships unminified libraries (about
   20 MB against the 15 MB vendored now), so the pinned hashes, the bundle
   sizes in `docs/browser-sdk.md` and the published browser SDK would all have
   to be redone, and the browser distribution test fails until they are.

4. **Most of the engine was not exercised against it.** Only `npm run verify`
   and the film verifications were run; the mini-game toolchain, the prefab
   and model editors, 2D, Spine, physics and particles were not checked on
   real hardware with 3.4.3.

## What was measured

Environment: macOS, Chrome headless, Apple M4; WebGL through ANGLE Metal and
WebGPU on `apple metal-3`; Node v26.12.0. The 40 vendored libraries were
taken unmodified from `LayaAirIDE-mac-arm64-3.4.3.dmg`
(`Contents/Resources/engine/libs`). Upstream had no `v3.4.3` source tag yet.

| Check                                          | Result on 3.4.3                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `npm run verify`                               | 406 of 407; the failure is the test that pins 3.4.2 bundle bytes |
| Eight film verifications on WebGL              | PASS                                                             |
| `npm run verify:film-webgpu` (eight on WebGPU) | PASS                                                             |

So 3.4.3 is compatible with the adapters as written, and the text the
translucency patch matches in `PBRLighting.glsl` is unchanged.

## When to look again

- A consumer needs something only 3.4.3 has: WebGPU or dual WebGL+WebGPU
  publishing for WeChat mini-games, WebP atlases, `FogMode.EXP2Standard`.
- Upstream fixes one of the four defects above; the matching adapter can
  then be dropped, which is worth an upgrade by itself.
- A later 3.4.x or 3.5 release: repeat this measurement rather than assume.

To repeat it: copy the vendored file names from the new IDE's
`engine/libs` into `vendor/laya-<version>/libs`, write its
`webgpu-provenance.json`, point the compilers at it, run `npm run verify`,
the film verifications on both backends, and each adapter switched off.
