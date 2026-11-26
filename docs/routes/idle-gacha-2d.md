# Route: An idle game with a gacha, portrait

Auto-battle through stages, earn while away, summon heroes at published rates with a pity counter, upgrade with one button. All currency comes from play.

- **Id:** `idle-gacha-2d`
- **Kind:** workflow
- **For:** building a portrait idle/collection game with offline earnings, a summon screen and an upgrade economy
- **Checked on:** desktop WebGL (headless Chromium 153 on SwiftShader, Linux container); no phone, no GPU, no human player
- **Status:** eleven heroes built on 2026-11-25; a simulated week over four seeds; 200,000 summons checked against the published rates; real clicks recorded (draft)
- **Reference consumer:** this repository, `games/zhuda-idle`
- **Engine version:** zhuda-laya-engine 1.18.0; built at `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`, `npm run verify:games` re-run against this repository's engine

Read `game-rules-first` first: this file only adds what is particular to the genre.

## When to take this route

Progress is numbers that grow, sessions are short, the screen is menus. The economy is the game:
most of the work is the simulation in step 4.

## Tools

- Engine 2D: a 720 × 1280 design root fitted to the screen, `ZhudaUI.createVectorButton` /
  `createGlassPanel`, `ZhudaEffect2D`, runtime timers; `localStorage` for the save.

## Steps

1. State is one serialisable object with a `version`; every action is a function on it; the
   clock is passed in (`now`), never read inside the rules.
2. Offline earnings = rate × min(elapsed, cap), computed on load from the saved timestamp.
3. Summon: rates in a table that the screen shows; a pity counter that guarantees the top rarity
   by a stated pull (60 here, and never ten without the middle rarity); duplicates become shards,
   shards become stars. Test by drawing 200,000 times.
4. **Simulate a week** with a bot that plays a few sessions a day: assert the wall (no stage
   cleared in a day) never lasts two days running, and that nothing was bought. Growth factors that passed here: hero power
   ×1.08 per level, level cost ×1.10, idle income and rewards ×1.12 per stage, stage strength ×1.16.
5. Screens are rebuilt from state on every change (destroy children, draw again): simple, and fast
   enough for menus.
6. Name every control (`button(..., name)`) so the recorded run finds and clicks it; add a red dot
   where an action is available.

## Pitfalls

- Stage strength growing faster than everything the player can buy is a wall within a day: fix
  the factors, not single numbers.
- "Auto" must stop on a stated condition and say why ("not strong enough"), or a script — and a
  player — cannot tell it from a hang.
- Large numbers need a short form (萬 / 億) and fixed-width fields, or the layout jumps.

## Engine gaps and their workarounds

- No list, tab or scroll widgets in `ZhudaUI` beyond buttons and panels: pages instead of scrolling.
- No design-root helper: `kit.ts`.

## Checks

- Measured rates within tolerance of the published ones; pity triggers by its stated pull (tests).
- Idle earnings grow with time, stop at twelve hours and reset on a claim (test with a passed-in clock).
- The recorded run summons, upgrades and clears a stage with real clicks.

## Not checked

- Retention, pacing over real days, any person's sense of reward. Save migration between versions.

## Boundaries

No purchases, no ads, no server, no events: do not add a real-money path to this shape without
the owner asking for it and the store's and the law's disclosure rules being met.
