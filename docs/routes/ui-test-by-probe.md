# Route: an interface test that clicks controls by name and repeats exactly

A test of a game's interface written as a JSON file: each step clicks a control found on the
Laya stage by its name or by what its label says, and states what must then be true (a node is
shown, a label reads so, an expression on the page hook holds). No model runs it and no
coordinates are written in it: a probe sent into the page from outside reads the stage's node
tree with every node's rectangle in CSS pixels, the player clicks the middle of the rectangle
with the browser's own mouse events, and a failed step ends the run with its number and what was
found instead. On the virtual clock the same file gives the same screenshots and the same node
tree every run. Checked in headless Chrome on a Mac at three shapes of page; on no phone.

- **Id:** `ui-test-by-probe`
- **Kind:** workflow
- **For:** A regression test of a game's or a scene's interface that names its controls instead of pixel positions, asserts after every step, costs no model tokens to run, and gives the same result every run.
- **Checked on:** desktop headless Chrome 158 (Apple M4, macOS 27.2), pages of 1280×720, 540×960
  and an emulated 390×844 phone at 3 device pixels to one; no phone
- **Status:** 2026-11-26: two scenarios of `games/zhuda-match` made only of named clicks and
  expectations each ran 20 times on the virtual clock with every screenshot, every stage report
  and the log identical; the probe's click points agree with the game's own to the pixel at
  three shapes of page; a scene of the 2D viewer was driven the same way on real time.
- **Reference consumer:** `games/zhuda-match` in this repository (`tools/scenarios/ui-flow.json`,
  `tools/scenarios/bot-to-result.json`, `src/ui/kit.ts`); `prefabs/viewer2d/scenarios/dungeon-spin-named.json`
- **Engine version:** zhuda-laya-engine 2.0.0 (LayaAir 3.4.2), branch `unified` after `92d7da5c`

## When to take this route

- Fits: the screens and buttons of a 2D game or of a 3D game's Laya interface (menus, a level
  list, a result panel, a shop); a flow that must still work after a change (open a level, go
  back, mute, play again); a check that a label shows the right number; the count of stage nodes
  after a flow, to catch a leak.
- Fits less: what is drawn on one sprite without nodes (a match-three board drawn as textures on
  one `Graphics`, particles). The probe sees one node there. Give the test a way in through the
  page hook (`expect: { "js": … }`, a `js` step), or let the game's own bot play
  ([game-rules-first](game-rules-first.md)) and test the screens around it, as
  `bot-to-result.json` does.
- Does not fit: an interface made of HTML elements over the canvas (test it with the browser's
  own selectors; the probe reports only the Laya stage, and a named click refuses to click a
  stage node that a page element covers); judging whether a picture looks right (that is a
  screenshot and a person, or [visual-content-prefab](visual-content-prefab.md)); comparing two
  builds pixel by pixel ([game-to-prefabs](game-to-prefabs.md) uses the same player for that).

## Tools

- `packages/compiler/stage-probe.mjs`, also the package entry
  `zhuda-laya-engine/compiler/stage-probe`: the probe (`zhudaStageProbe`, sent to the page with
  `stageProbeExpression()`), `findStageNodes`, `checkStageExpectation`, `stageClickPoint`, and
  `stageSteps` (the named click and the expectation for any player). It is not in the engine's
  runtime: a release build is not one byte larger, and a page built before the probe existed can
  be read as it is. It needs `window.Laya` on the page, which every web build of this engine has.
- `prefabs/tools/detplay.mjs`: plays a scenario on a virtual clock (fixed frames of 1/60 s, a
  seeded `Math.random`, a frozen `Date`). `prefabs/tools/detrepeat.mjs`: runs one scenario N
  times under it and says whether every run gave the same files.
- `prefabs/viewer2d/tools/play.mjs` (the same file in `viewer3d`): the same steps on real time,
  for the viewers' scenes.
- `games/tools/device-measure.mjs` (a script for `games/tools/shot.mjs`, which needs Playwright):
  reports `stageNodes` and `stageNodesShown` beside `domNodes`.
- `npm run verify:stage-probe` (`scripts/verify-stage-probe.mjs`): the probe against a built
  `games/zhuda-match` in a real browser.
- Chrome installed on the machine (the players start it headless through
  `packages/compiler/chrome-host.mjs`). Nothing to install, nothing to commit but the scenario
  files; a run's pictures go where `local-results/README.md` says (full-size ones stay on the
  machine).

## Steps

1. **Give every control a name on its node.** The probe finds a control by `node.name`. Where a
   game keeps its own map of names (the `hot` map of `src/ui/kit.ts` in the reference games), set
   the node's name in the same place: `games/zhuda-match/src/ui/kit.ts`, `button()` and
   `clickable()` (`b.root.name = name`). A label needs no name: it is found by what it says.
   Check: a step `{ "probe": "title" }` in a scenario writes `title.stage.json`, the whole tree,
   where every node has `name`, `class`, `visible`, `shown`, `mouseEnabled`, `listens`, `text`
   and `rect`; the control is there under its name.
2. **Say when the game is ready.** The page hook (`window.__GAME__`, or `__SCENE__` in the
   viewers) has a property that turns true when the first screen is built (`ready`). With
   `HOOK=__GAME__ READY=ready` the virtual clock lets loading take the frames it takes and holds
   them from the moment the game is ready, so every run starts from the same clock and the same
   random numbers. A build for repeated runs has no splash (`"branding": { "mode": "none" }` in
   `zhuda.config.json`, as the reference games have): the splash runs on real time and covers the
   canvas.
3. **Write the scenario.** A JSON list of steps; in one step the keys run in this order: `click`,
   `js`, `wait`, `expect`, `probe`, `shot` (in the viewers' player `drag` comes after `click`).
   - `"click": "level-0"`, `{ "name": "level-0" }`, `{ "text": "選單" }` or
     `{ "textMatches": "^第一園" }` (`"class"` and `"nth"` narrow it). Exactly one shown node must
     match. With a name the node is the control; with the text alone it is the label, whose
     middle is the middle of its button. `"hold": 0.2` keeps the button down for a control that
     listens for the press and the release (`listens` in the report says which).
   - `"expect": { "name": "menu" }` (shown), `{ "name": "mute", "text": "聲音：關" }` (it, or a
     label inside it, says so), `{ "text": "豐收！", "count": 0 }` (no shown label says so),
     `{ "name": "again", "visible": false }` (there and hidden), `{ "js": "S.screen === 'play'" }`
     (`S` is the page hook), or a list of them. `"within": 5` asks again as the clock runs, a
     tenth of a second at a time, and fails when the time is over.
   - `"wait": 0.2` before a `shot`: on the virtual clock the picture is the last frame drawn, and
     a click draws nothing until a frame runs. An expectation needs no wait: the stage is read,
     not the picture.
   - File: `games/zhuda-match/tools/scenarios/ui-flow.json` (title, mute and back by its label, a
     closed level that must do nothing, the first level, back to the title).
4. **Run it once.**
   `HOOK=__GAME__ READY=ready VIEWPORT=540x960 node prefabs/tools/detplay.mjs games/zhuda-match/dist/web games/zhuda-match/tools/scenarios/ui-flow.json "fresh=1&seed=7" <out dir>`
   prints the log (every click with its point and the node's path, every expectation with the
   time it waited) and exits 0. A step that fails exits 1 with, on stderr,
   `FAILED step 3 of 4: expected {"name":"mute","text":"聲音：關"} within 0.5 s: found no node named "mute"; shown names: ZhudaRootScene, design, menu`,
   and leaves `failed.png` in the out dir.
5. **Run it N times.**
   `HOOK=__GAME__ READY=ready VIEWPORT=540x960 node prefabs/tools/detrepeat.mjs 20 games/zhuda-match/dist/web games/zhuda-match/tools/scenarios/ui-flow.json "fresh=1&seed=7" <out dir>`
   compares every run with the first: each screenshot by its decoded pixels, each stage report by
   its bytes, the log by its bytes. `<out dir>/repeat.json` has `"identical": true` and, per
   file, how many runs were the same; where a picture differs it says in how many pixels. Exit 1
   if a run failed or differed.
6. **Where the board has no nodes, let the game play.** `bot-to-result.json` opens
   `?auto=1&level=1&seed=3`: the game's own bot plays the level, the test waits for the result
   panel (`"expect": { "name": "again", "within": 180 }`), checks it and takes its picture in the
   next step, clicks `again` and `next` by name. Virtual seconds are cheap: a level of 5.5 s is
   the same 5.5 s every run.
7. **Count the stage's nodes where memory is measured.** `games/tools/device-measure.mjs` reports
   `stageNodes` and `stageNodesShown` in every sample's `memory`, beside `domNodes` and the heap.
   In a scenario, `{ "probe": "after" }` writes the counts to the log; a flow that returns to
   where it started must return to the same count (the title of the reference game: 21 nodes
   before and after a level).

## Pitfalls

- **A click that lands on the page, not on the game.** Seen in the 2D viewer: one second after
  the scene was ready, the engine's splash (a page element) still covered the canvas, the click
  at the button's point went to it, and the scene did nothing. A named click now refuses with
  `… is under the page element <div#zhudaLogoSplash.zhuda-splash-tribute>, which would take the click`.
  Wait for it: `{ "expect": { "js": "window.__ZHUDA_SPLASH__ && window.__ZHUDA_SPLASH__.gone === true", "within": 20 } }`,
  or build without a splash.
- **A screenshot of the frame before.** On the virtual clock frames are held between steps. A
  `shot` in the step of a click shows the screen before the click unless the step has a `wait`.
  A picture taken before any frame has run shows nothing of the game. The same after `within`: the clock
  stops on the frame that made the expectation true, before that frame is drawn, and in a step
  `wait` runs before `expect`. Seen here: the result panel was on the stage (the expectation
  passed) and not in the picture, the same way in all 20 runs. Put the picture in the next step:
  `{ "expect": { …, "within": 180 } }`, then `{ "wait": 0.2, "shot": "result" }`.
- **A control that takes no click.** A button that acts on press and release (`listens:
  ["mousedown", "mouseup"]`, as the spin button of `prefabs/2d/slot-ui`) may tell a tap from a
  long press by time: give the click a `hold`.
- **A label inside a Label.** LayaAir's `Label` holds a `Text` with the same words. A selector by
  text alone counts the pair once (the outer node); asked for by `"class": "Text"`, both are
  there.
- **A label wider than its words.** The click point is the middle of the node's rectangle. A
  left-aligned label 600 units wide is clicked 300 units from its first letter. Click the control
  by its name instead.
- **The probe changing while a repeat is running.** `detrepeat.mjs` starts a new player for every
  run; editing `stage-probe.mjs` or the scenario between runs shows up as runs that differ. Seen
  here: the 3 stage reports "differed" from run 5 on (the pictures and the log did not), because
  a field was added to the report while the 20 runs were going.
- **`mouseEnabled` false on a node that is clicked.** LayaAir delivers pointer events to a node
  that listens even when `mouseEnabled` was never set. Read `listens`, not `mouseEnabled`, to
  know what can be clicked.

## Engine gaps and their workarounds

- **A click is not checked against Laya's own hit test.** A named click checks that the canvas is
  the top page element at the point, not that the node (and not a veil drawn over it on the
  stage) is what LayaAir would deliver the click to. Until then the next `expect` catches it: a
  click on a covered control changes nothing. No plan item.
- **No named drag.** `detplay.mjs` has no `drag` step and the players' `drag` takes points only.
  A board is played by the game's bot or by a `js` step.
- **A stage turned with CSS** (route [mobile-always-landscape](mobile-always-landscape.md)): the
  probe maps through the canvas's client rectangle, which is the upright box of a turned canvas;
  rectangles there are wrong. A stage LayaAir turned itself (`screenMode`) is handled and was
  checked. No plan item.
- **Reference games other than `zhuda-match`** keep their names only in the `hot` map: the same
  one-line change in each `src/ui/kit.ts` (`zhuda-beat`, `zhuda-idle`, `zhuda-jump`,
  `zhuda-merge`, `zhuda-swarm`) is not made.

## Checks

- `node --test tests/stage-probe.test.mjs`: 16 tests on a stand-in stage (the tree, class names
  under minified constructors, rectangles under scale, pivot and a turn, a stage turned by
  LayaAir, selectors, expectations and their failure messages, every scenario file of the
  repository still read, the named click and its refusals, `within` on a clock, the measuring
  script's counts).
- `npm run verify:stage-probe` (headless Chrome, a built `games/zhuda-match`): at 1280×720,
  540×960 and 390×844 at 3×, each of the game's five named controls is found, and the middle of
  the probe's rectangle is 0 px from the point the game computes itself; the probe's count equals
  a plain walk of `Laya.stage` (21 nodes on the title, 50 on the board); clicks by name and by
  label open the board and go back; with `screenMode` 'horizontal' on the upright page the report
  says `turned` and clicks by name still land.
- The 20 runs of step 5, for `ui-flow.json` (3 pictures, 3 stage reports) and `bot-to-result.json`
  (3 pictures, 3 stage reports, the bot playing the first level to its end twice): `identical: true`, 20 of
  20 the same for every file. Reports: `local-results/stage-probe/`.
- Deliberate failures: an expectation that cannot hold and a click on a name that does not exist
  each exit 1 with the step and what was found.
- `prefabs/viewer2d`: `node tools/play.mjs scenarios/dungeon-spin-named.json "scene=dungeon-spin"`
  (real time): the probe reads 320 nodes, 49 shown; the spin button is clicked by its label and
  the round runs.

## Not checked

- No phone. `scripts/lib/phone-chrome.mjs` gives the same `evaluate` on an Android phone's Chrome
  over adb, so the probe and `stageSteps` should run there with touch events for `press`; nobody
  ran it.
- iOS: no driver in the repository (Safari's remote inspector is not the Chrome protocol).
- Inside the WeChat mini-game runtime (and other mini-game hosts): there is no page to send the
  probe to from outside. It would have to be bundled into a debug build and answer over the
  host's own channel; not built.
- A model-driven black-box runner on real phones (a model looking at screenshots and choosing
  what to tap, with this probe as its ground truth): not built.
- `games/tools/device-measure.mjs` was not run through Playwright on this machine (Playwright is
  not installed where this session may use it); its counts are checked by a test with a stand-in
  page, and the same probe expression was run in Chrome by `verify:stage-probe`.
- WebGPU: the runs were on Chrome's default backend for the reference game (WebGL). Pixel
  identity on another machine or another graphics card was not compared; the claim is the same
  machine, 20 times.
- The viewers' real-time player was run once on one scene; real time is not repeatable to the
  pixel and was not compared.
- A stage with thousands of nodes: the probe stops adding to the tree at 20000 (`truncated`);
  its cost on a large stage was not measured.

## Boundaries

- The game: the names of its controls, its page hook and what it says there, its scenarios, its
  bot. A name is part of the game's test surface: renaming a control breaks the scenarios that
  use it, which is the point.
- The engine: the probe, the selectors and expectations, the two players, the repeat runner, the
  measuring script. The probe reads LayaAir's own node tree; it adds nothing to the runtime and
  asks nothing of a game but `window.Laya` and names.
