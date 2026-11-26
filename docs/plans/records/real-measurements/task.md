# Task: a figure and clothes with the measurements of real ones

- Id: `real-measurements`
- Asked by: the owner, 2026-11-25 ("whether it looks good is judged against real pictures you look
  up yourself, not against what you make up"), after [triangle-mask](../triangle-mask/task.md)
- Base: the unified branch at `3937ed7`
- Scope: `games/tools/characters/` (the consumers' kit) and `games/zhuda-wardrobe`. Nothing under
  `packages/` changed.

## Why

The wardrobe's garments passed both clipping measures and had been compared with nothing. Measured
with a tape, the figure's bust was 76 % of a real size 8, its neck 68 %, its mid-thigh 67 %; the
T-shirt followed the waist in and ended at the waist; trouser legs narrowed to the ankle; the
short skirt was 26 cm long; the conical hat was a disc and a dome.

## What was done

1. Looked up a body size chart (ASTM D5585 size 8), garment specification sheets (T-shirt, jeans,
   skirts), sizes of conical hats and 20-litre packs, and real photographs. Sources and numbers
   are in `games/zhuda-wardrobe/tools/reference.mjs`; no photograph is in the repository.
2. A tape for meshes (`games/tools/characters/tape.mjs`) and a report
   (`games/zhuda-wardrobe/tools/measure.mjs`, `npm run measure`).
3. The body reshaped until the tape read within a few per cent of the chart, with a real
   shoulder slope and foot length.
4. The catalogue cut again: positions read off the body's own distance field; tops that hang
   straight from the bust (`drape`, squared ovals); trouser legs as tubes (`volume.tube`);
   necklines by width and drops; skirts at real lengths and sweeps; a cone and a box as solids
   (`solid.lathe`, `solid.block`).
5. A third measure, at rest: the body inside loose cloth (`standsOut`), and nothing through a
   hard object.

## Not in scope

Folds, seams, pockets, buttons and textures; simulation; other body shapes; a person's judgement.
