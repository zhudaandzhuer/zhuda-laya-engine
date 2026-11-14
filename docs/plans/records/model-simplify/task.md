# Agent task: model-simplify

Status: Implemented within scope; a build-time tool, checked on two consumer models  
Owner: Engine/toolchain  
Last reviewed: 2026-11-14

## Source requirement

Owner's goal of 2026-11-14: surpass three.js in every respect, starting with
phones. Measured on a vivo V40 (Adreno 720, Chrome 156, WebGL2) with the
city-walk game: with every effect of the look off, a frame of 2.9 million
triangles takes 23 ms and one of 10 million 58 ms; shadows redraw the same
models in every split. The models are scanned trees of 19 000 and 77 000
triangles with no lighter version.

## Goal

A consumer can make lighter versions of a `.glb` model with one command, for
the `lod` levels the engine already draws.

## Invariants

- Build-time only: no new runtime code, no new runtime dependency
  (`meshoptimizer` is already a dependency).
- The same model and options give the same bytes.
- What is not geometry is kept as it is.
- No consumer asset enters this repository; tests generate their meshes.

## Scope

### Engine

- `packages/compiler/model-lod.mjs` (`zhuda-laya-lod`, `simplifyGlb`,
  `thinCards`, `readGlb`, `writeGlb`), `tests/model-lod.test.mjs`,
  `docs/model-lod.md`.

### Consumer or adapter

- `films/river-town-prefab` uses it for its trees (its own record).

## Non-goals

- Impostors, merged materials, smaller textures, simplification at run time.

## Acceptance evidence

- `npm run verify`, `npm run lint`, `npm run format:check`, `git diff --check`.
- The two tree models of the game through the tool, drawn beside the originals.
