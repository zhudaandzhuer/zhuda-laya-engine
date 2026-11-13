# Task: a mounted model's glow can change while it runs

Status: Implemented within scope; drawn on desktop WebGL, and on WebGPU in a consumer game.

## Source requirement

A consumer game with a day and a night needs the windows and lanterns of its
town models to glow after dusk and not by day. `emission` on a model node was
fixed at mount.

## Change

- `mountZhudaModel` returns `setEmission(scale)` (0..8; 1 is as authored). It
  keeps what each material was authored with, so the scale can be changed any
  number of times and disposal puts the authored value back.
- `PrefabInstance.setEmission(name, scale)` for model prefabs, by node name.
- The `emission` option of a node is now the starting scale.

## Invariants

- Engine/consumer scope: the engine scales; when and how much is the game's.
- The materials are shared by every copy of a model and by other users of the
  same asset in the same library: the scale applies to all of them. (This was
  already true of the `emission` option.)
- A model without emissive materials is unaffected.

## Non-goals

Per-copy glow; animating the scale inside the engine; emissive colour changes.

## Acceptance evidence

See [verification](verification.md).
