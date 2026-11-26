# Task: close the engine gaps the routes list, where that can be done without a device

- Id: `gaps-after-2-0`
- Asked by: the owner, 2026-11-26 ("你去把能補上都補上"), after being told which kinds of game this
  repository is not enough for
- Base: `unified` at `aca6d5f4` (2.0.0 plus the wardrobe's colour fixes)
- Scope: engine (`packages/core`, `packages/compiler`), its tests and guides, and the gap rows of
  the routes that named these gaps. No game and no prefab module was changed.

## Source requirement

The "Engine gaps and their workarounds" tables of the routes (76 rows on 2026-11-26) and the gap
table of [v2-consolidation](../v2-consolidation/verification.md).

## What was chosen, and why these

Gaps that are logic and can be proved with numbers in Node, that more than one route names, and
that need no graphics card to be believed:

1. Waits and tweens on the runtime clock; a fixed clock for the session.
2. A signal that the splash has gone.
3. A shadow switch on a model copy.
4. Text in and out of bytes on a host with no `TextDecoder` or `TextEncoder`.
5. A walk grid and path finding from a ground function and solids.
6. A kinematic character controller over the same world, and the same solids for the camera boom.
7. The mini-game tool's syntax target and orientation.

## Invariants

- The game stays the authority on movement: the controller and the path finder own no node, read
  no input and keep no clock.
- One time source: waits and tweens are on `ZhudaTimerScheduler`, not a second clock.
- Nothing is claimed for a device: every piece is labelled as checked in Node only.

## Not in scope (still open, each in its route's table)

Subpackages and a size gate per package for mini-games; a host bridge and an asset provider for a
mini-game host in the engine; freeing what a destroyed scene leaves; more than 32 clips in a
blend; a tree generator, blended ground colour, a second water mirror, lamps of a game's own in
`ZhudaSceneLook`; 2D scenes with height and light; characters by key poses; level of detail by a
triangle range; quantizing and merging in `zhuda-laya-lod`; portal variants of the build's zip;
everything that needs a phone, a person or CI.
