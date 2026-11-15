# Task: grass that does not look like a lawn of plastic

## Source requirement

User (2026-11-16), looking at a consumer 3D game's riverside grass: "the grass
still looks too fake".

## What made it look fake (from pictures of the game's grass)

- Every blade the same saturated green; lightness varied by ±16 % only.
- Every blade lit like the ground (normal nearly straight up): no blade
  lighter or darker than the next, no light through a blade.
- Short, wide blades tapering from the foot (`1 - t²`): a cartoon shape.

## Change (engine, `packages/core/runtime3d/Grass.ts`)

- Colour: per blade a lightness (0.72..1.22), a green between a bluer and a
  yellower one of `tip`, land-scale lush/pale tint, browned tips on about
  half the blades, and a few dead straw blades (2.5 % + 12 % × `dryness`).
- Lighting: the normal leans 0.7 toward the blade's facing (still toward the
  eye's side) and is rounded across the width; `subsurface` lobe
  (`wrap 0.3`, `back 0.55`) with thickness thinnest at the tip, tinted by
  the blade's green (straw for a dead blade); roughness 0.48 (0.8 dead).
- Shape: width `sqrt(1 - t⁴)`: about as wide along most of the blade,
  pointed at the tip.

The options and their meaning are unchanged; the defaults draw differently.
A consumer tunes its own colours and heights (the game here moved to narrower,
taller, less saturated grass in its own repository).

## Non-goals

- Blades pushed by a foot, shadow casting, textures on blades.
- Phones (not measured).
