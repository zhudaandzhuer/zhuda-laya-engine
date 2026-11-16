# Verification record: windows-acceptance GFX-01

Task document: `docs/plans/records/windows-acceptance/gfx-01-task.md`\
Commits: `521a598` (optional features as data), `f0cfc93` (launcher fix
found while verifying); base `1e75db1`\
Date: 2026-11-17

## Checks

| Check                                                                                                                                                                                                                                                                                 | Where                                                                    | Result                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit: a LayaAir-like `_initAdapter` warns nothing after the patch, `optionalFeatures.missing` names the absent feature, the device gets what LayaAir would have kept, release restores LayaAir's method                                                                               | `tests/webgpu.test.mjs`                                                  | PASS                                                                                                                                                          |
| `npm run verify`                                                                                                                                                                                                                                                                      | macOS                                                                    | PASS 876/876                                                                                                                                                  |
| The report's GFX-01 checks on WebGPU, at base                                                                                                                                                                                                                                         | Windows host, desktop session, standard token, Chrome 157, Intel UHD 770 | `hand`, `basis-textures`: FAIL on `warning: WebGPU: texture-compression-etc2 / -astc is not supported by the adapter.` (4 lines each), as in the report       |
| The same 17 checks at `521a598`: post-quality, basis-textures, spring-bones, shadow-updates, lit-surface, instanced-mesh, hand, developer-tooling, animation-control, render-scale, stylized-shading, shader-warm-up, lighting-depth, hdr-environment, gltf-instancing, dither, cloth | same                                                                     | 16 PASS, no adapter line in any log. `render-scale` FAIL at `rung 2: the canvas is covered` (1 ≠ 0): QA-02, now reached because the notice no longer stops it |
| `verify:lit-surface`, `verify:hand` on WebGPU without `ZHUDA_PHONE_NOTICES`                                                                                                                                                                                                           | vivo V40, Adreno 720, Chrome 157 Android                                 | PASS, no adapter line                                                                                                                                         |
| `verify:lit-surface` WebGPU                                                                                                                                                                                                                                                           | macOS                                                                    | PASS                                                                                                                                                          |

## Found while verifying

At base, `verify:lit-surface` failed once on the Windows desktop session
with `fetch failed: bad port` and `Browser.close: DevTools unreachable`:
the WIN-04 launcher had read the profile's `DevToolsActivePort` while it
still said port 0. Fixed in `f0cfc93` (`devToolsPortFileEndpoint` accepts a
real port and a whole browser id only, and the file must read the same
twice). Afterwards, 40 launches, page lists and closes in a row in that
session: 40 graceful, no failure.

## Limits and decision

- Intel adapter only (Chrome's default on that host); the RTX was not
  selected.
- No consumer option to require a feature; the engine requires none.
- `render-scale` on Intel WebGPU is QA-02, not part of this item.

Decision: **Implemented within scope**, verified on the Windows host's
desktop session and the vivo V40.
