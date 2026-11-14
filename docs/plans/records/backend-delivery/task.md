# Agent task: backend-delivery

Status: Implemented within scope; desktop verified, no phone\
Owner: Engine/toolchain\
Last reviewed: 2026-11-14

## Source requirement

The three.js gap audit of 2026-11-14 (`records/threejs-gap-audit/plan.md`,
WP12): three.js's `WebGPURenderer` falls back to WebGL 2 by itself and has
no compiler to download. This engine throws `WEBGPU_UNAVAILABLE`, a page
holds one backend, and a WebGPU page carries 5.9 MB of GLSL-to-WGSL
compilers. WP12 asks for a page that starts the right backend by itself and
says why, for the compilers to be fetched late and kept, for a look at
whether the `ui` library can leave the 3D bundles, and for the size of each
bundle as it travels.

## Goal

One page address that starts WebGPU where the browser has a real adapter
and WebGL everywhere else, with the reason in the renderer's report; a
WebGPU page that downloads its compilers once for an origin, not once for
each release; and numbers for what each bundle weighs.

## Invariants

- One backend a realm. Nothing is loaded for the backend that was not
  chosen, and nothing falls back after a backend's libraries have run: the
  page is loaded again instead.
- The choice is made before LayaAir or the engine is loaded, by a script of
  its own that needs neither.
- A WebGPU request that fails still fails: `ZhudaEngine.boot` does not
  return WebGL for it. `fallbackReason` is `null` on WebGPU, and on a page
  that never preferred WebGPU.
- The compilers' bytes are checked against their pinned SHA-256 wherever
  they come from, a cache included. A cache that is missing, refused or
  wrong never fails a boot.
- The existing bundles keep their names and their one-file form; what is
  new is added beside them.
- Vendor files are not modified. No release is published by this task.

## Dependencies

- `packages/compiler/browser-sdk.mjs`, `webgpu-loader.mjs`,
  `consumer-build.mjs`; `packages/core/runtime3d/Renderer.ts`;
  `TopologyResolver`.
- `scripts/release-browser-sdk.mjs` reads the built distribution; it has to
  go on accepting the recorded releases.

## Scope

### Engine

- `packages/core/runtime3d/BackendChoice.ts` (new): the decision as a table
  (`chooseZhudaBackend`), the question to the browser
  (`probeZhudaBackend`), the loader (`loadZhudaBackend`), the way back to
  WebGL for a WebGPU that loaded and did not start (`retryZhudaBackend`).
- `packages/compiler/backend-loader.mjs` (new): that file as
  `zhuda-loader.js`, and the call a consumer page makes.
- Browser SDK: `zhuda-loader.js` and an `example-<profile>-auto.html` for
  each pair of bundles; `--wasm external` for bundles that fetch their
  compilers instead of carrying them.
- Consumer build: `"renderer": "auto"`.
- The WebGPU compilers kept in the origin's Cache Storage by their hash.
- `RendererDiagnostics.fallbackReason`: the loader's reason, on WebGL.
- Whether `ui` can leave the 3D profiles: built and drawn without it, and
  what it would save. Gzip and Brotli sizes of every bundle (in the draw
  check's report).
- The Doctor audits both library orders of an auto page; a release record
  may carry the loader.
- `tests/backend-delivery.test.mjs`, `scripts/verify-backend-delivery.mjs`,
  `npm run verify:backend-delivery`, `docs/backend-delivery.md`.

### Consumer or adapter

A game that lets its player turn WebGPU off sets
`window.ZhudaBackendPrefer = 'webgl'` from its own settings before the
loader runs, and decides what to show when `ZhudaEngine.boot` rejects.

## Non-goals

- WGSL without the compilers (the plan's "large"; LayaAir's shaders are
  GLSL).
- A fallback inside a running realm, or two backends in one page.
- WebGPU compatibility mode.
- Publishing an SDK release with the new files.

## Acceptance checks

1. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
2. Unit: the decision table; the loader's order, fallback and retry; the
   compilers' cache.
3. Draw: the three auto pages with WebGPU, without `navigator.gpu`, with no
   adapter, with a software adapter, with a WebGPU bundle that does not
   load, and after a retry; a consumer build with `"renderer": "auto"` on
   both; the compilers fetched once.
4. Size: gzip and Brotli of every bundle; the 3D bundle without `ui`.
5. The existing WebGPU and browser SDK checks still pass.

## Unverified limits

See the verification record.
