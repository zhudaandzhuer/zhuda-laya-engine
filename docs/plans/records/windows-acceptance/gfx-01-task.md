# Agent task: windows-acceptance GFX-01, optional WebGPU features reported as warnings

Status: In progress\
Owner: Engine/toolchain\
Last reviewed: 2026-11-17

## Source requirement

[Windows acceptance plan](plan.md), GFX-01 (report section 6): 58 runs on
the Windows host failed only because the console carried
`WebGPU: texture-compression-etc2 is not supported by the adapter.` and the
same for ASTC, and the draw checks accept no console warning. Desktop GPUs
sample BC, not ETC2 or ASTC; these are optional WebGPU features.

## What happens

LayaAir 3.4.2 fills `deviceDescriptor.requiredFeatures` with a fixed wish
list of thirteen features (`laya.webgpu_2D.js`, around line 14876: depth
clip control, depth32float-stencil8, BC, ETC2, ASTC, timestamps, indirect
first instance, f16, rg11b10 renderable, bgra8 storage, float32 filtering,
format tiers 1 and 2). In `_initAdapter` it drops those the adapter lacks
with one `console.warn` each and goes on; its capability table then says
what it has. A desktop adapter lacks ETC2 and ASTC; a phone's lacks BC,
float32 filtering and others. Nothing in the engine requires any of them.

## Goal

The wish list is treated as what it is, optional: the adapter's missing
features are recorded in the renderer's diagnostics as data and do not
reach the console, so a draw check judges shader, validation and device
messages without a list of exceptions. Nothing else is silenced.

## Invariants

- No console line is filtered or whitelisted; LayaAir is simply not given
  features the adapter does not have.
- Shader, validation, uncaptured-error and device-loss messages unchanged.
- What the device gets is what LayaAir would have kept (the same filter,
  earlier), so capabilities and texture format choice are unchanged.

## Scope

- `packages/core/runtime3d/Renderer.ts`: `_initAdapter` patched in the
  WebGPU branch; `RendererDiagnostics.optionalFeatures` (`requested`,
  `missing`).
- `packages/types/runtime3d/Renderer.d.ts` (generated), `tests/webgpu.test.mjs`.
- Docs: `docs/agent-development.md` phone note.

## Non-goals

- A consumer option to require features (none is required by the engine;
  add when a consumer needs one, failing the boot when missing).
- GFX-04 (Basis on WebGL) and the other GFX items.

## Acceptance checks

1. Unit: a fake engine whose `_initAdapter` warns like LayaAir's: no warning
   after the patch, `optionalFeatures.missing` lists what the adapter lacks,
   the descriptor holds only what it has; WebGL path unchanged.
2. Draw checks that failed in the report on this message alone pass on the
   Windows host's desktop session with no notice file, on Intel and RTX if
   the GPU can be chosen; the V40 runs a WebGPU check without
   `ZHUDA_PHONE_NOTICES`.
3. `npm run verify` passes.

## Rollback

Revert the commit; the wish list warnings return.
