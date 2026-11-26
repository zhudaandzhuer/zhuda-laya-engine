# Route: A merge board with orders

Tap a source to drop an item, drag two alike together to make the next one, hand finished items to orders, earn coins and experience; energy limits taps.

- **Id:** `merge-2d`
- **Kind:** workflow
- **For:** building a drag-and-merge board with item chains, orders, energy and levels
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** three chains of six tiers and ten levels built on 2026-11-25; three seeds played to the top level by a bot with hours checked; real drags recorded (draft)
- **Reference consumer:** this repository, `games/zhuda-merge`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

A board the player rearranges by dragging, with a slow economy around it.

## Tools

- Engine 2D; stage pointer events turned into design coordinates
  (`root.globalToLocal(new Laya.Point(Laya.stage.mouseX, Laya.stage.mouseY))`); one atlas.

## Steps

1. Board = array of cells (`null`, item, source). Actions: tap a source, move, merge, deliver, bin.
2. Drag: on down pick the item under the pointer; while moving draw it at the pointer; on up
   decide by the cell under it — same kind and tier merges, empty moves, anything else swaps;
   outside the board it goes back.
3. Orders ask for items the player's sources can reach at their level; a new one replaces each
   delivered.
4. Energy: regenerates by the clock (passed in), tops up on level-up, can be bought with coins.
5. Play it to the top level with a bot on three seeds and assert total hours inside a band.
6. The report publishes every cell's client position; the recorded run really drags.

## Pitfalls

- **If one tap's worth of coins buys back more than one energy, energy is infinite.** Price it so
  the ratio is well under 1 (0.44 here) and keep the test that says so.
- `onResize` fires inside `boot`: the handler here marks cell positions and must wait for `ready`.
- A full board with no merge is a dead end: keep a bin, and let the bot's run assert the board never jams.
- Experience needed per level: `20 + level² · 14` passed; linear was over in minutes.

## Engine gaps and their workarounds

- No drag helper for 2D sprites in design space: about 50 lines in `Main.ts`.

## Checks

- Merges and moves by real drags, taps on sources and a served order (recorded). Hours to top level per seed.
- A reload keeps the board.

## Not checked

- Days of real play; whether orders feel fair; touch drag on a device.

## Boundaries

No purchases, no timed events, no decoration layer.
