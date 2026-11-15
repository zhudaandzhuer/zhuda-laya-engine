# Agent task: spine-character

Status: Implemented within scope  
Owner: consumer-side agent (stocking-tear-2d), at the user's request  
Last reviewed: 2026-11-15

## Source requirement

The user (2026-11-15), about the zhuda-spine2D toolkit (github.com/zhudaandzhuer/zhuda-spine2D):
fold it into the engine repository's tool support. Agreed form: keep the toolkit its own
repository and connect it: a route, a runtime helper for what LayaAir's Spine node gets
wrong for a hand-driven rig, and a tooling note.

## Goal

A consumer loads a zhuda-spine2D export and drives it by hand (bones, IK, attachments, physics)
through one public class, without rediscovering LayaAir's Spine2DRenderNode settings and its
coordinate offset; an agent finds the whole path in `docs/routes/spine-character.md`.

## Invariants

- The toolkit, its Spine Runtimes copy and any character art stay outside this repository.
- No second Spine runtime: the class uses LayaAir's `spine42` topology as it is.
- No clock of its own: the consumer calls `update()` from `context.runtime.start`.
- Unknown bone, slot, attachment and IK names are refused by name; numbers must be finite.

## Dependencies

- LayaAir `Spine2DRenderNode` and spine-core 4.2 (the `spine42` feature).
- Consumer evidence: `games/stocking-tear-2d` (`spine/outfit/`, `src/Main.ts`, `HANDOFF.md`).

## Scope

### Engine

- `packages/core/SpineCharacter.ts`, its export in `packages/core/index.ts`, generated
  `packages/types/SpineCharacter.d.ts` and `packages/types/index.d.ts`.
- Tests: `tests/spine-character.test.mjs`, `tests/public-spine-character-types.test.mjs`, the SDK
  export list in `tests/compiler-and-mcp.test.mjs`.
- Docs: `docs/routes/spine-character.md`, its row in `docs/routes/README.md`, a section in
  `docs/consumer-tooling.md`, this record.

### Consumer or adapter

- `games/stocking-tear-2d/src/Main.ts` rewritten on the class (outside this repository).

## Non-goals

- Vendoring zhuda-spine2D or its runtime; loading Spine through `AssetProvider`.
- Comparing LayaAir's Spine physics with spine-webgl's number for number.
- Multi-touch, several characters, rigs with other bounds conventions.

## Acceptance checks

1. `node --test tests/spine-character.test.mjs`: renderer settings kept after LayaAir resets
   them, canvas conversions both ways, bones and IK and attachments, refusals, disposal.
2. `node --test tests/public-spine-character-types.test.mjs`: a strict consumer compiles against
   the public package.
3. `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`: pass.
4. The consumer built against this branch: a real mouse stretches and tears a leg and lifts the
   skirt, on WebGL and WebGPU; `diagnostics()` reads physicsUpdate 2, useFastRender false,
   straight alpha.

## Evidence to attach

- Test/build output: local logs (see verification).
- Browser report: `games/stocking-tear-2d/evidence/helper-sheet.jpg` (outside this repository).

## Unverified limits

- No phone run of the Spine version; no physics comparison with spine-webgl.
