# Route: A 2D tile platformer

A side-scrolling jump game on a tile grid: the level is the engine's `ZhudaTerrain2D`, collision asks it, `ZhudaTerrain2DRenderer` draws the tiles in view, and the jump button goes through `ZhudaInputBuffer`.

- **Id:** `platformer-2d`
- **Kind:** workflow
- **For:** building a run-and-jump game with tile levels, variable jump height, coyote time and jump buffering
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** three levels built on 2026-11-25; a look-ahead bot finishes all three, a run-right bot dies in all three; real key presses recorded (draft)
- **Reference consumer:** this repository, `games/zhuda-jump`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

Levels made of square tiles, one character with gravity. Not for slopes, moving platforms or
physics objects: `ZhudaTerrain2D` knows blocked or not per cell and nothing else.

## Tools

- `ZhudaTerrain2D` (`isBlocked`, `getTile`), `validateTerrain2D`, `ZhudaTerrain2DRenderer`
  (`setView`, `flush`, `residentChunks`), `ZhudaInputBuffer`, `ZhudaPointerInput`, `ZhudaEffect2D`.

## Steps

1. Units are tiles, y down, feet at `(x, y)`; step at a fixed 60 Hz. Starting numbers that a bot
   could finish with: gravity 46, jump speed 15.2, run 6.4 tiles/s, acceleration 60, fall cap 22,
   body half-width 0.34, height 0.86.
2. Variable height: on release while rising, multiply upward speed by 0.45. Coyote time 0.09 s.
   Jump buffer: `input.push('jump', time)` on key down, `input.consume('jump', time)` when grounded
   or within coyote; window 0.12 s.
3. Move x then y, each resolved against `terrain.isBlocked` at the body's corners.
4. **Write levels as data, not as drawn characters**: lists of pits, steps, ledges, spikes,
   walkers and coins, turned into rows by a builder, then into a `Terrain2DSpec` (palette entries
   with `blocked`). Rules that kept levels finishable: ledges two tiles above where the jump
   starts; pits at most three wide; nothing solid overhead within five tiles of a pit or spikes.
5. Draw: one world sprite scaled so the level's height fills the screen; the renderer as its child;
   camera = the world sprite's x. Call `renderer.setView` with the visible rectangle, then `flush`.
6. Things that move (player, walkers, coins, flag) are one sprite's graphics redrawn each frame.
7. Test with two bots: one that tries four options 1.5 s ahead on a fork of the game (must finish
   every level), one that only runs right (must die in every level).

## Pitfalls

- The renderer draws a tile as a square of its palette colour. Spikes, turf, anything with a shape
  is drawn by the game on top, for the columns in view.
- A ledge above a hazard makes the jump over it bump its head and fall in.
- Clear the input buffer on blur, or a jump pressed before the tab lost focus fires on return.

## Engine gaps and their workarounds

- No tile pictures in `ZhudaTerrain2DRenderer` (colour only): draw shaped tiles yourself.
- No slopes or one-way platforms in `ZhudaTerrain2D`: stay on square tiles.

## Checks

- Jump height differs between a tap and a hold (test); a buffered jump fires on landing (test).
- In the page, an arrow key moves the character and space raises it (recorded: 8 tiles, 2.4 tiles).
- `renderer.residentChunks` stays small on a long level (2 with `chunkCells: 16` on 92 columns).

## Not checked

- Feel. The numbers were set so that a bot could finish, not by anyone's hands.
- Touch controls on a device.

## Boundaries

One screen-height of level, no vertical scrolling, no checkpoints, no moving platforms.
