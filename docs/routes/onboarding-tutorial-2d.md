# Route: Interactive first-time onboarding tutorial on the 2D Laya stage

A reusable declarative step-by-step onboarding overlay (`systems/tutorial` + `2d/tutorial-coach`) that spotlights a real game button or board cell through a four-panel cutout dim mask, animates a pointer hand (`tap`, `double-tap`, `drag`, or `hold`), highlights secondary zones, nudges gently on wrong actions without deducting hearts/health, and works in browsers and WeChat mini games with zero DOM dependencies.

- **Id:** `onboarding-tutorial-2d`
- **Kind:** workflow
- **For:** Adding an interactive spotlight tutorial with animated hand gestures and mistake-safe nudges to any 2D Laya web game or WeChat mini game without per-game overlay boilerplates.
- **Checked on:** Node unit tests (Mac, Node 24+); desktop WebGL in headless Chrome via `viewer2d` and `zhuda-sudoku` (web and mobile touch viewports; no physical phone run)
- **Status:** 2026-11-26: prefab tests pass with mock Laya + `TutorialRunner` state machine tests, `viewer2d` preset `?scene=tutorial-coach` builds cleanly under `zhuda-laya-doctor`, and `zhuda-sudoku` runs the interactive Level 1 tutorial across browser & WeChat `wxgame` builds
- **Reference consumer:** ZhudaGameCenter `games/zhuda-sudoku` (`src/ui/GameApp.ts`, `src/common/systems/tutorial/tutorial.ts`, `src/common/2d/tutorial-coach/tutorial-coach.ts`) and `zhuda-engine-prefabs/viewer2d/src/presets/tutorial-coach.ts`
- **Engine version:** zhuda-laya-engine 2.0.0 (`unified`, `LayaAir 3.4.2`)

## When to take this route

- Fits: any 2D Laya stage game (puzzle, merge, card, shooter, mini-game) that needs a multi-step interactive FTUE (spotlight hole, live board/button clicks or drags passing straight through the cutout, hand cue, safe wrong-tap nudges, skip/replay).
- Does not fit: linear voiced cutscenes without live gameplay targets — use `ui/visual-novel` ([story-counting-2d](story-counting-2d.md)) or DOM choices `ui/dialog`.

## Tools

- Prefab modules synced via `zhuda-prefabs-sync`: `systems/tutorial` and `2d/tutorial-coach` (pulled automatically together because `2d/tutorial-coach` depends on `systems/tutorial`).
- Node 24+ built-in `node --test`, `zhuda-laya-build`, `zhuda-laya-doctor`, `zhuda-laya-minigame`, and Playwright headless Chromium.

## Steps

1. **Sync the shared tutorial modules into the game.** Run `node zhuda-engine-prefabs/scripts/sync.mjs <gameDir> 2d/tutorial-coach` (or `npx zhuda-prefabs-sync . 2d/tutorial-coach` once the engine release is pinned). This installs `src/common/systems/tutorial/tutorial.ts` (zero DOM/engine state machine) and `src/common/2d/tutorial-coach/tutorial-coach.ts` (`StageTutorialCoach`).
2. **Mount `StageTutorialCoach` above gameplay and modal layers.** Instantiate `new StageTutorialCoach(coachLayer, { width, height, topInset, bottomInset, theme, onSound })` once in your UI controller, forward `coach.update(dt)` inside the runtime frame loop, and forward stage resizes to `coach.resize(...)`. Never place browser DOM nodes (`document.*`) inside the overlay so `npm run build:wx` mini-game guards stay green.
3. **Author declarative steps with dynamic target getters and event predicates.** Define `TutorialStep[]` where `target: () => rect` reads live cell/button coordinates in stage pixels, `gesture: { type: 'double-tap' | 'tap' | 'drag' | 'hold' }` selects the animated pointer style, `waitFor: 'my_event'` + `accept: (payload) => ...` gates progression on genuine player actions, and `{ ok: false, rejectText }` delivers non-punishing coaching nudges instead of instant failure.
4. **Emit real gameplay events into the coach and wire a replay entry.** Call `coach.emit('event_name', payload)` from board/button handlers, persist completion via `TutorialSeenTracker` or game save (`tutorialShown`), and expose a Help (`?`) replay trigger so returning players or QA probes can reopen the guided flow anytime.
5. **Apply the game's art skin via `TutorialTheme` and expose `coach.report()`.** Pass `drawCard` and `drawButton` callbacks in `theme` to reuse 9-slice parchment/wood panels seamlessly, and expose `coach.report()` on the debug probe hook so headless Chrome checks can verify step transitions, hole bounds, non-overlapping card placement, and button clicks deterministically.

## Pitfalls

- **Text-only banners fail first-time comprehension.** Portals and first-time players bounce when rules are explained only in a static top paragraph; always pair the instruction card with a spotlight cutout, animated hand gesture, and highlighted exclusion/safe zones until the player completes the real gesture.
- **Full-screen blocking scrims break drags and double-taps.** Never cover the hole with an intercepting sprite and try to forward clicks synthetically; `StageTutorialCoach` splits the dim overlay into four outer `Laya.Sprite` bands around the hole (`top`, `bottom`, `left`, `right`) so native `MOUSE_DOWN` / `MOUSE_MOVE` / `MOUSE_UP` pass cleanly through to underlying board cells and controls.
- **Coarse target getters stale on resize.** Always pass `target: () => rect` as a closure rather than a fixed static rect if your canvas scales dynamically across `375×667` to `1280×720`.

## Engine gaps and their workarounds

None.

## Checks

- Engine prefabs suite: `npm run verify:library` (runs `tests/tutorial.test.mjs`, `typecheck`, `viewer2d` and `viewer3d`).
- Routes & catalog audit: `npm run verify` inside the engine repository (runs `implementation-routes.test.mjs`).
- Consumer game checks (`games/zhuda-sudoku`): `npm run verify`, `npm run verify:browser`, `npm run build:wx`, and live Playwright walkthrough clicking through the interactive spotlight tutorial and verifying no JS errors or hole overlap.

## Not checked

- `StageTutorialCoach` was checked in desktop headless Chromium (including mobile touch viewport emulation `390×844`) and Node mock tests; physical iPhone Safari, physical Android Chrome, and physical WeChat runtime were not run for this route.

## Boundaries

- Belongs in prefabs (`systems/tutorial`, `2d/tutorial-coach`): generic step runner, `TutorialSeenTracker`, four-quadrant cutout scrim, vector animated hand (`drawCoachHand`), secondary highlight frames, smart top/bottom placement (`computeCoachCardRect`), and `StageTutorialCoach`.
- Stays in the consumer game: domain copy/i18n strings, level rule validation, custom painted 9-slice panel skins passed via `TutorialTheme`, save-file schema flags, and when to launch or replay the flow.
