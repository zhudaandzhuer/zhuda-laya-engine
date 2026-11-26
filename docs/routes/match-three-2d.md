# Route: A match-three board

Swap two neighbours, lines of three burst, the rest falls, new pieces drop in, chains follow; four leave a line-clearer, five a colour-clearer. The rules return each round of a move and the screen plays them back.

- **Id:** `match-three-2d`
- **Kind:** workflow
- **For:** building a swap-and-match puzzle with cascades, special pieces and move-limited levels
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** four levels built on 2026-11-25; two bots measured over 40 boards per level; real drags and taps recorded (draft)
- **Reference consumer:** this repository, `games/zhuda-match`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

A grid of pieces where a move sets off a cascade. The same shape serves any board whose move has
several visible stages (merge chains, falling blocks).

## Tools

- Engine 2D only: one atlas, one sprite redrawn per frame, `ZhudaEffect2D`, the vector button.
- `tools/make-items.py` cuts an atlas from Noto Color Emoji (the container's font) — placeholder art.

## Steps

1. Every piece has an **id**. The board is an array of `{ kind, special, id }`.
2. A new board is filled so that it has no line of three and at least one move; same seed, same board.
3. `move(a, b)` returns `null` when the swap bursts nothing (and costs nothing), else a list of
   rounds: `{ burst, points, made, after }` where `after` is the whole board once that round has
   fallen and refilled.
4. The view keeps a map id → `{ x, y, scale, alpha }`. Per round: pieces whose id is not in `after`
   shrink away; every id in `after` tweens to its cell; ids never seen start above the board (or,
   for a special just made, at the cell it was made in).
5. After the last round, if the rules shuffled a stuck board, every piece tweens to where it now is.
6. Input: a drag past 40% of a cell towards a neighbour, or tap one then tap its neighbour.
7. Balance with `tools/balance.ts`: a first-move-seen player and a best-score-now player, 40 seeds
   per level; put each level's target between the two.

## Pitfalls

- A bot that copies the board with the same seed knows which pieces will drop. Change the copy's seed.
- Uncapped chain multipliers let careful play score ten times careless play; the cap here is ×3
  and the gap is still about five times.
- After a shuffle, check again for lines and for a move, in one loop, before returning.
- Match the view by id. Matching by cell index breaks on the first cascade.

## Engine gaps and their workarounds

- None met. Tweens are the game's own (`kit.ts`), driven from the `ui` layer.

## Checks

- A refused drag comes back and `movesLeft` is unchanged (recorded).
- The board never rests with a line on it or without a move (asserted after every bot move).
- Careless bot: wins 29/40 of level 1, 0/40 of levels 3–4. Careful bot: 40, 40, 32, 23.

## Not checked

- Where a person scores between the two bots. Goals other than "score in N moves".

## Boundaries

No blockers, no collection goals, no boosters, no lives, no purchases.
