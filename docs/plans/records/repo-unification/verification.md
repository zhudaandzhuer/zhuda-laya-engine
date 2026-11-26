# Verification: repo-unification

Checked on 2026-11-25 in a Linux container with no npm registry: Node 24.22.3, TypeScript 5.9.3
in place of the pinned compiler, esbuild 0.28.2 in place of 0.27.1, prettier 3.8.1, no eslint,
headless Chromium 153 on SwiftShader. `npm ci` was not possible; dependencies were linked by hand.

| Check                                                          | Result                                                                                                                                                                                                                                                                                                                               |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run build`, then `git status`                             | builds; no tracked file changes (public declarations: 0 updated)                                                                                                                                                                                                                                                                     |
| `npm run typecheck`, `npm run audit:declarations`              | no errors                                                                                                                                                                                                                                                                                                                            |
| `npm run doctor`                                               | HEALTHY                                                                                                                                                                                                                                                                                                                              |
| `npm test`                                                     | 1000 run, 998 pass. The 2 failures are the same two as on `def94aa` in this container (996 run, 994 pass): both compare the bundler's version with the pinned one                                                                                                                                                                    |
| `npm run verify:games`                                         | 8 of 8: build, `tsc`, Doctor (pin `file:../..`), 54 tests                                                                                                                                                                                                                                                                            |
| `prettier --check` on the paths `format:check` names           | 14 files warn, the same 14 as on `def94aa` with this prettier version; no file new or changed here warns except one that warned before                                                                                                                                                                                               |
| `tests/consumer-route.test.mjs`                                | new case: in-repository pin accepted, other `file:` paths refused; output inside the project accepted, inside its sources, outside the project or inside an engine directory refused                                                                                                                                                 |
| `tests/docs-index.test.mjs`                                    | 3 of 3                                                                                                                                                                                                                                                                                                                               |
| `node packages/mcp-server/index.mjs --tool list_routes`        | 23 routes; `tests/implementation-routes.test.mjs` passes                                                                                                                                                                                                                                                                             |
| `games/zhuda-guard` in headless Chromium against this checkout | the bot holds all twelve waves (2 stars, no page error); a run with real clicks builds on pads 1, 4, 3 and 6 and plays three waves; markers from `stage.worldToScreen` sit on their stones (`docs/evidence/bot.jpg`, `hands.jpg`)                                                                                                    |
| `games/zhuda-beat` in headless Chromium against this checkout  | 54 real key presses at the published times, 54 perfect, mean 5 ms early, with a pause and resume; `getSamplePositionSec` read 1,315 times, never more than 10.2 ms from the page clock, no jump; output latency reported 32 ms. With no gesture (the bot's run) the position is null and the page clock carries the song: 113 of 113 |
| Patches 11 and 12 as commits on `def94aa`                      | applied with `git am`, in order                                                                                                                                                                                                                                                                                                      |
| Sponsor block                                                  | wallet address, banner, QR link and support page link present in `README.md` and `docs/zh-CN/README.md`; the owner's own lines (showcase game, stable release, licence) copied by script and compared                                                                                                                                |

## Not checked

- `npm ci`, the pinned TypeScript and esbuild, `npm run lint`, CI (the new `games` job has never
  run), `npm run pack:tarball` and what the package contains after this change.
- The other six games in a browser against this checkout: their recorded runs under
  `docs/evidence/` were made against `def94aa` before the move (they build and pass their tests here).
- A phone, a GPU, a person playing, sound heard.
- Whether an agent given only this repository follows a route to a working game.
- `npm install` in a game on a machine with the registry (here the same links were made by hand).

## After the record: which branch is used (2026-11-26)

`unified` is the branch in use. The owner chose to leave the old review branch
(`claude/zhuda-engine-review-scenes-w8btzs`) as it is for now: it remains GitHub's default branch
and is neither committed to nor deleted. Neither the Mac's account (no admin rights) nor the cloud
session (its proxy refuses repository-settings writes) could change the default; that step is the
owner's, on the web. The current state and the deferred steps are at the top of `HANDOFF.md`.

