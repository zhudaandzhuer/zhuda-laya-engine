# Verification record: ui-test-probe

Task document: [`task.md`](task.md)  
Commit: the commit that adds this file, on `unified` after `92d7da5c`  
Date: 2026-11-26

## Environment

- OS / browser / device: macOS 27.2.1, Apple M4; Google Chrome 158.0.8127.89, headless, started by
  `packages/compiler/chrome-host.mjs`. No phone, no iOS, no mini-game runtime.
- Node and package manager: Node 26.13.1, npm.
- Engine and consumer commits: zhuda-laya-engine 2.0.0 (`unified` after `92d7da5c`);
  `games/zhuda-match` built from this checkout (`npm run build` in its folder, no splash).
- DPR, viewport and network mode: 540×960 at 1 for the repeated runs; 1280×720 at 1, 540×960 at 1
  and 390×844 at 3 (emulated phone) for the probe check; pages served from loopback.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build, types, declarations, Doctor, tests | `npm run verify` | PASS: 1076 tests, 0 fail (see the note below the table) | terminal |
| Lint | `npm run lint` | PASS | terminal |
| Format of the files touched | `npx prettier --check packages/compiler/stage-probe.mjs tests/stage-probe.test.mjs scripts/verify-stage-probe.mjs package.json` | PASS | terminal |
| Format of everything | `npm run format:check` | FAIL on one file this task did not touch: `tests/minigame-toolchain.test.mjs` (already listed as open in `HANDOFF.md`); every other file passes | terminal |
| Prefab library | `npm run verify:prefabs` | PASS: prefabs 206 tests, viewer2d 3, viewer3d 3 | terminal |
| Reference games | `npm run verify:games` | PASS: nine of nine (`zhuda-match` 7 tests; run as eight games and then `zhuda-match`, so that it was not rebuilt while its scenarios were being repeated) | terminal |
| The probe and the steps on a stand-in stage | `node --test tests/stage-probe.test.mjs` | PASS: 16 tests | terminal |
| The probe in a real browser | `STAGE_PROBE_OUT=local-results/stage-probe npm run verify:stage-probe` | PASS: at three shapes of page the five named controls are 0 px from the game's own points; the count equals a plain walk (21 on the title, 50 on the board, while the page has 35 DOM nodes on both); clicks by name and by label open the board and go back; a stage turned by LayaAir (`screenMode` 'horizontal' on 540×962) reports `turned` and is clicked by name | `local-results/stage-probe/stage-probe.json` |
| `ui-flow.json` 20 times | `HOOK=__GAME__ READY=ready VIEWPORT=540x960 node prefabs/tools/detrepeat.mjs 20 games/zhuda-match/dist/web games/zhuda-match/tools/scenarios/ui-flow.json "fresh=1&seed=7" local-results/stage-probe/full/ui-flow` | PASS: `identical: true`; 3 pictures, 3 stage reports and the log each the same in 20 of 20 runs; 108 s | `local-results/stage-probe/ui-flow.repeat.json`, `ui-flow.jpg` |
| `bot-to-result.json` 20 times | the same with `bot-to-result.json` and `"fresh=1&seed=3&auto=1&level=1"` | PASS: `identical: true`; 3 pictures, 3 stage reports and the log each the same in 20 of 20 runs; 410 s | `local-results/stage-probe/bot-to-result.repeat.json`, `bot-to-result.jpg` |
| A failing expectation | a scenario whose third step expects `{"name":"mute","text":"聲音：關","within":0.5}` on the board | PASS (it fails as it should): exit 1, `FAILED step 3 of 4: expected … within 0.5 s: found no node named "mute"; shown names: ZhudaRootScene, design, menu`, `failed.png` written | terminal |
| A click on a name that is not there | `[{ "wait": 0.2 }, { "click": "settings" }]` | PASS (fails as it should): exit 1, `FAILED step 2 of 2: click {"name":"settings"}: found no node named "settings"; shown names: ZhudaRootScene, design, level-0, level-1, level-2, level-3, mute` | terminal |
| The viewers' player, new steps, real time | in `prefabs/viewer2d`: `node tools/play.mjs scenarios/dungeon-spin-named.json "scene=dungeon-spin"` | PASS: 320 nodes read, 49 shown; the splash waited out; the spin button clicked by its label; the round ran | terminal |
| A click under a page element | the same scene, a click by label one second after ready | PASS (fails as it should): exit 1, `… is under the page element <div#zhudaLogoSplash.zhuda-splash-tribute>, which would take the click` | terminal |
| Scenario files written before | `prefabs/viewer2d`: `node tools/play.mjs scenarios/dungeon-spin.json "scene=dungeon-spin"` (26 pictures, exit 0); `node prefabs/tools/detplay.mjs prefabs/viewer2d/dist/web prefabs/viewer2d/scenarios/stage-check.json "scene=dungeon-spin" <out>` (exit 0); every scenario file of both viewers read by `checkScenario` in the tests | PASS | terminal |
| The measuring script's counts | a stand-in page in `tests/stage-probe.test.mjs` | PASS; UNAVAILABLE through Playwright (not installed where this session may use it) | terminal |
| Real WebGL/device | none | UNAVAILABLE | |

`npm run verify` was run once before this file existed and failed one test of 1076
(`CHANGELOG.md -> docs/plans/records/ui-test-probe/verification.md`, the link to this page); it
was run again with the page in place: 1076 tests, 1076 pass, exit 0.

## Lifecycle and failure cases

- A step that fails ends the run: exit code 1, the step number and what was found on stderr, the
  log up to that step on stdout, `failed.png` in the out dir. Before, a thrown error ended a
  player with a stack trace and no log.
- An expectation with `within` is asked again every tenth of a second of the player's clock
  (virtual frames under `detplay.mjs`, real time under `play.mjs`) and fails when the time is over.
- A repeat run that fails or differs keeps its folder; `repeat.json` names the file and, for a
  picture, the number of differing pixels. Seen once, by this task's own doing: the first 20 runs
  of `bot-to-result.json` were going while a field (`listens`) was added to the probe, and the
  stage reports of runs 5 to 20 differed from run 1 at that line while every picture and the log
  were the same in all 20. Both scenarios were run again from the start with the final code;
  those are the runs in the table.

## Prefab evidence (visual work)

None: no visual content was added or changed.

## Unverified limits

- No phone, no iOS, nothing inside a mini-game runtime, no model-driven runner.
- `games/tools/device-measure.mjs` not run through Playwright on this machine.
- Pixel identity on another machine or graphics backend was not compared.
- The probe's cost on a stage of thousands of nodes was not measured.
- A stage turned with CSS (route `mobile-always-landscape`) is not handled by the probe.
- Only `games/zhuda-match` of the reference games has its names on its nodes.
