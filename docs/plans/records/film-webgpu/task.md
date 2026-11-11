# Agent task: film-webgpu

Status: Implemented within scope; desktop WebGPU (Apple Metal) verified  
Owner: Engine/toolchain  
Last reviewed: 2026-11-11

## Source requirement

The user asked for film scenes to move to WebGPU ("然後我們要用webgpu") as the
base for the next realism work (shadowed light shafts, foliage, water).

## Goal

The film host draws the same film scenes on Laya's WebGPU backend, chosen by
the operator, with every existing film verification passing on it.

## Invariants

- One renderer per page; no automatic fallback. A WebGPU request without a
  hardware adapter fails.
- Vendor files stay unmodified; upstream seams are contained in
  `WebGPU342Adapters.ts`.
- WebGL stays the default and keeps passing unchanged.
- A shader or pipeline the device rejects is a failed call, not an empty frame.

## Scope

### Engine

- `ZhudaFilmHost({ renderer })`, `--film-renderer`, `ZHUDA_FILM_RENDERER`;
  the page loads the `3d-gltf-webgpu` bundle.
- Adapters: cull in the frame a camera or shadow light moved; whole
  half-float read-back; no fog define in the glTF depth-normal pass.
- `ZhudaReflectiveSurface` shader without an early return before sampling.
- `verify:film-webgpu`, unit tests, docs.

### Consumer or adapter

- None.

## Non-goals

WebGPU-only features (compute, storage textures), Windows or mobile
acceptance, pixel equality between backends, performance claims.

## Acceptance checks

1. The seven film verifications pass with the film host on WebGPU and report
   a ready hardware adapter.
2. The same seven still pass on WebGL.
3. Unit tests cover the three adapters without a GPU.
4. `npm run verify`, lint, format and `git diff --check` pass.
