# Handoff: engine state and open work

Last updated: 2026-11-26 (the 2.0.1 section, the stage-on-a-page section, the watch-scripts-only section, the ui-test-probe section, the 2.0.0 section, with what came after it the same day, and the unification section; the rest is as of 2026-11-23). Read "State now", "Current priorities" and "Open
work" first; "History" keeps what each round did, newest first, with its
records. Check every ref again with `git log` before starting.

## 2.0.1 (2026-11-26)

The owner's word: "改成2.0.1". Everything on `unified` after `v2.0.0` is released as 2.0.1:
`package.json`, `zhuda.config.json` and the lockfile say 2.0.1, the changelog's "After 2.0.0"
section is the 2.0.1 section. The owner also said to put it on the engine's own, public
repository in place of what was there: 2.0.1 is on its `main` as one commit (`57b3acec`) on top
of the history that was there, tagged `v2.0.1`, and a consumer pins
`git+https://github.com/zhudaandzhuer/zhuda-laya-engine.git#v2.0.1`. The
sections below say "after 2.0.0" as they were written: all of it is in 2.0.1.

The same day, on the owner's word ("發行改2.0.1 遊戲全部升級2.0.1 / sdk 也是推到win升級2.0.1"):

- **A release page** for `v2.0.1` on the public repository (marked latest).
- **The browser SDK 2.0.1** is published on the owner's game site and recorded in
  `docs/browser-sdk-releases.json`; the six templates and `docs/browser-sdk.md` point at it. The
  published files are the local build byte for byte (20 files), and `verify:browser-sdk` runs its
  six scenarios against it. It is the first recorded release that has the backend loader.
- **The workspace's eleven game projects** (outside this repository, under the workspace's
  `games/`) are on `git+https://github.com/zhudaandzhuer/zhuda-laya-engine.git#57b3acec…`: each
  passes its own `npm run verify` with the same count before and after. Three needed more than the
  pin: two had their prefab evidence compared again on the new build (0 different pixels, baselines
  untouched), one names the engine version in its own configuration and source. Each game's
  `HANDOFF.md` has a "引擎升到 2.0.1" section and an `evidence/upgrade-2.0.1/` folder. No game
  was opened in a browser or on a phone for this, and none was published.

After the tag, the same day: the route `papercraft-diorama` (an outside skill's rules for a
pop-up paper scene made of code alone, set against this engine; not built here) and the
formatting of `tests/minigame-toolchain.test.mjs`, which made the public repository's workflow
fail on the release commit (`npm run format:check` is a step there). Both repositories carry
the two; the tags stay where they were.

## stage-on-a-page: an outside agent's report on 2.0.0, checked and closed (2026-11-26)

An outside agent (Antigravity, Gemini 4 Hydrogen) built a live 3D viewer on the tagged 2.0.0
from the routes and wrote down what broke. Every item was checked against the code. Task and
record: [stage-on-a-page](docs/plans/records/stage-on-a-page/task.md),
[verification](docs/plans/records/stage-on-a-page/verification.md).

- **Two engine defects, both reproduced in a browser before the change and closed.**
  `stage.prepare(aspect)` now applies the lens (a page that called only `setCamera` and
  `prepare` drew every focal length at the camera's default angle; the three reference games
  had a `stage.lens.apply` line of their own, now gone). `stage.setQuality` keeps what was
  fixed at mount (level 0 threw on a scene with bounce light, and on one with a colour table
  and no water).
- **Not reproduced:** `Camera opaque MRT does not support MSAA` with screen reflections
  (WebGL and WebGPU, offline and live, through every level; the engine never sets the option
  LayaAir's message is about), and speckled shadow from a point light in a closed room. Both
  need the reporter's scene.
- **Already closed after 2.0.0:** the splash in a first screenshot (`whenZhudaSplashGone`).
  **The tagged 2.0.0 has none of this**: a consumer pinned to the tag still needs the two
  workarounds the route lists. Whether to tag a 2.0.1 is the owner's decision.
- New route: [interactive-film-viewer](docs/routes/interactive-film-viewer.md). Its orbit
  camera and mounting again are from the report, not drawn by a check here.
- Checks: `npm run verify:live-look` (also with `LIVE_LOOK_RENDERER=webgpu`) has the page
  checks; unit tests in `tests/bounce-light.test.mjs`, `cinematic-capture.test.mjs`,
  `chrome-wait.test.mjs`.

## watch-scripts-only: the watcher answers a script save in about 0.15 s (2026-11-26)

The owner compared the edit loop with a Cocos Creator set-up a friend described (0.39 s from
saving a script to the build being ready to refresh). Here it was 0.26 s for a small 2D game
and 0.90 to 1.46 s for 3D projects, because every save ran the whole release-grade build. Task
and record: [watch-scripts-only](docs/plans/records/watch-scripts-only/task.md),
[verification](docs/plans/records/watch-scripts-only/verification.md); the rules for users:
[consumer tooling](docs/consumer-tooling.md#the-watcher-saves-that-change-only-scripts); the
Mac's numbers and a summary in Chinese: `local-results/watch-fast-path/`.

- **Done.** `zhuda-laya-watch --candidate` rebuilds `app.js` alone when every change since the
  last build is inside `src/` (`packages/compiler/consumer-scripts.mjs`): an esbuild context
  kept for the watcher's life, the full build's options and source gates, the same bytes the
  full build writes. The log line of every build gives its time and kind
  (`rebuilt after src/Main.ts in 13 ms, scripts only`). `--full-builds` turns it off.
  `scripts/measure-watch.mjs` measures the loop.
- **How its output is kept apart (decided here).** It is never written. The watcher's server
  answers `app.js` from memory and answers `payload-manifest.json` with no fingerprint and a
  `stale` entry; the output directory, `game.zip` and `consumer-build.json` stay the last full
  build. `zhuda-prefab-check` refuses a manifest marked stale; `zhuda-laya-build` and
  `zhuda-laya-accept` build from the sources and never read a watcher. The directory catches up
  at the next full build; the watcher says so when it starts and when it is stopped.
- **Keeps the full build:** any change outside `src/`; a changed `zhuda.config.json` or
  `package.json`; a project with `prefabPreview`, `prefabChecks` or `prefabEvidence`; a watcher
  without `--candidate` (its directory is the release, which other tools read from disk).
- **Measured on the Mac** (save to the `reload` event, median of nine, 120 ms debounce inside):
  `games/zhuda-match` 263 to 143 ms, `games/zhuda-hunt` 899 to 145 ms, `prefabs/viewer3d` 1459
  to 157 ms. The machine was busy with other sessions for the "after" runs; the record gives the
  load beside each number and an interleaved run that shows the full build itself costs what it
  did (220 and 224, 1292 and 1297, 2359 and 2371 ms). A plain build writes the bytes it wrote:
  the candidates of three projects and the releases of the nine games have their old
  fingerprints. One real edit was seen in a browser (a title string, reloaded by itself, then
  restored). `npm run verify` 1088 of 1088, lint, `verify:games` nine of nine.
- **Not done:** Windows and Linux, a phone on the LAN (`--host 0.0.0.0`), a project above 10k
  lines, a quiet machine for the "after" runs; scripts-only rebuilds of prefab preview bundles.
- **Found, and fixed the same day on the owner's word:** a project whose path goes through a
  symbolic link got no component class registry in `app.js`, from the full build too
  (`zhudaConsumerPlugin` compared esbuild's real path with the configured one). The plugin now
  knows the entry by its real path as well; the bundle is the same file either way; builds with
  no link are byte for byte what they were. Record:
  [consumer-symlink-entry](docs/plans/records/consumer-symlink-entry/verification.md).
- **Found, not fixed:** the watcher's start line prints a `prefab-preview.html` address for
  projects that have no such page; the engine workbench reached through a symbolic link is taken
  for a consumer (`runZhudaBuild` compares the two roots as strings) and stops with a missing
  `public/index.html`; timing tests in six files fail when the machine is heavily loaded and
  pass when run alone (listed in the record).
- **State: two commits on `unified`, pushed 2026-11-26** together with the stage-on-a-page commit (`git log -2 -- packages/compiler/consumer-build.mjs`).
  Pushing is the owner's word. The exact next step, if wanted: the same for a project with
  `prefabPreview` (keep a context per preview bundle and serve those from memory too).

## ui-test-probe: interface tests that click by name and repeat exactly (2026-11-26)

The owner asked whether the repository has what a friend's "LayaQA" scheme has (a probe of the
Laya node tree, JSON cases that click a named control and assert each step, no model at run time,
identical repeats, exceptions and stage node count and heap over the Chrome protocol). Most of it
was a convention of each game; the gaps are closed. Route:
[ui-test-by-probe](docs/routes/ui-test-by-probe.md); task and record:
[ui-test-probe](docs/plans/records/ui-test-probe/task.md),
[verification](docs/plans/records/ui-test-probe/verification.md); the Mac's reports and a summary
in Chinese: `local-results/stage-probe/`.

- **Done.** `packages/compiler/stage-probe.mjs` (entry `zhuda-laya-engine/compiler/stage-probe`):
  a probe sent into the page as text, so nothing is added to the runtime or to a build. The
  scenario players (`prefabs/tools/detplay.mjs`, both viewers' `tools/play.mjs`, still one file)
  take `click` by name or label, `expect`, `probe`, and `hold` on a click; a failed step exits 1
  with its number and what was found. `prefabs/tools/detrepeat.mjs` runs a scenario N times on the
  virtual clock and compares pictures, stage reports and the log. `games/tools/device-measure.mjs`
  reports `stageNodes` and `stageNodesShown`. `npm run verify:stage-probe` checks the probe in a
  real browser against `games/zhuda-match`.
- **Measured on the Mac (headless Chrome 158).** Two scenarios of `games/zhuda-match` made only of
  named clicks and expectations, 20 runs each: every picture, stage report and log identical. The
  probe's click points are 0 px from the game's own at 1280×720, 540×960 and 390×844 at 3×. A
  scene of the 2D viewer driven by label on real time.
- **Not done** (the route's "Not checked" and "Engine gaps"): a phone, iOS, inside a mini-game
  runtime, a model-driven runner on real phones; `device-measure.mjs` through Playwright (not
  installed where the session could use it; its counts are tested with a stand-in page); named
  drags; LayaAir's own hit test before a click; a stage turned with CSS; the other five reference
  games still keep their control names only in their `hot` map (one line each in `src/ui/kit.ts`).
- **State: committed and pushed to `unified` on the owner's word ("推上去", 2026-11-26):
  `34cb266d`.** Nothing of it is in progress. The exact next step, if wanted: run the same scenarios on the Android phone through
  `scripts/lib/phone-chrome.mjs` (the probe needs only `evaluate`).

## 2.0.0: one repository (2026-11-26)

Read this first. On 2026-11-26 the owner decided that the game centre's routes and its shared
prefab library live in this repository, that every game of the workspace is written down as a
route, and that what stays outside is a `games/` folder of games that pin a release of this one;
that state is version 2.0.0. Task and record:
[v2-consolidation](docs/plans/records/v2-consolidation/task.md),
[verification](docs/plans/records/v2-consolidation/verification.md).

**What is where now.**

- [`prefabs/`](prefabs/README.md): the prefab library (39 modules at 2.0.0, 41 since the two
  hosiery modules; two viewers, Go packages), from
  the workspace's `commonPrefabs/` 0.10.0 plus five things taken out of games. It ships in the npm
  package; a game copies modules with `npx zhuda-prefab-sync`. Guide:
  [docs/prefab-library.md](docs/prefab-library.md). Check: `npm run verify:prefabs` (`:go` with Go).
- [`docs/routes/`](docs/routes/README.md): 47 routes: the engine's 26, the game centre's 12
  (translated), and 9 written from the workspace's games.
- Engine changes: glTF clips cross fade (`indexLaya342ClipNodes`), `boot({ layoutSize })`, the
  export `zhuda-laya-engine/compiler/chrome-host`, the bin `zhuda-prefab-sync`.
- Tag `v2.0.0` on `unified` in the verification repository. **Not on the engine's own GitHub
  repository**, which is public and still at `def94aa`: pushing this line there would publish the
  library's art, voices and songs, and nobody but the owner decides that.

**The nine games of the workspace are on it** (2026-11-26): each pins
`git+https://github.com/<owner>/VerifyZhuda.git#91d21f79203a092b7944adb20d51c8dc24cef1ca`,
each one's `npm run verify` passes, none needed a change to its own code because of the engine,
and each one's `HANDOFF.md` says what changed and how to undo it. The table and what the moves
turned up are at the end of the
[verification record](docs/plans/records/v2-consolidation/verification.md).

**The next step, exactly.** Nothing is in progress. What comes next is the owner's: the decisions
under "Open", and looking at the games at 2.0.0 (nothing was published; every game's `dist/` is a
2.0.0 build that is not what is live).

**Decided by the owner (2026-11-26).** One repository; nothing from the BDL platform in it; games
stay outside, unmerged; 3D scenes and assets taken out of games may come in; `commonPrefabs/` is to
be deleted from the workspace later (not done: deleting is the owner's step).

**After 2.0.0, in the cloud session (2026-11-26).** The owner asked for the gaps that could be
closed to be closed. Done in the engine, each checked as numbers in Node and in no browser, on no
device and in no game: waits and tweens on the runtime clock and a fixed session clock
([runtime hardening](docs/runtime-hardening.md)); `whenZhudaSplashGone()`; a model copy's
`setShadows`; text without `TextDecoder`; a walk grid, path finding and a character controller
([walking](docs/walking.md)); `minigame.syntaxTarget` and `minigame.orientation`. The routes that
named these gaps say so in their tables. Task and record:
[gaps-after-2-0](docs/plans/records/gaps-after-2-0/task.md). Still open from those tables:
mini-game subpackages and a host bridge in the engine, freeing a destroyed scene's resources, more
than 32 clips in a blend, trees, blended ground colour, a second water mirror, 2D scenes with
height and light, key-pose characters, and everything under "Not built" below. The next step that
would make the new pieces real is a game using them: none does yet.

**After 2.0.0, on the Mac: the two stocking benches as prefab modules (2026-11-26).** The owner
pointed at the folder kept on the Desktop since 2026-11-25 (`撕襪技術精華-2026-11-25`: the benches
`stocking-tear` and `stocking-tear-2d`, tidied out of the workspace as "no reusable code") and said
"做成共用元件". They are now `prefabs/3d/layered-hosiery` (a modelled lower body in fifteen kinds of
stocking under thirteen bottoms; layers pulled and torn per vertex, skirts as cloth) and
`prefabs/2d/spine-tights` (a Spine 4.2 rig, everything it was made from, and the hand that drives
it), each with a viewer preset (`?scene=layered-hosiery`, `?scene=spine-tights`), tests, a README
in Chinese, sources and pictures. The benches' own sources build unchanged against this engine and
draw the same pictures as the modules (3D: 0.000% of pixels over 8 of 255 in six pictures; 2D:
nothing below the swaying skirt). The routes `layered-cloth-on-body` and `spine-character` name the
modules as their reference consumers. Task and record:
[hosiery-modules](docs/plans/records/hosiery-modules/task.md),
[verification](docs/plans/records/hosiery-modules/verification.md); the Mac's logs and sheets are in
`local-results/hosiery-modules/`. Not done: a phone, a person looking, a quiet-machine frame cost,
re-running the scripts that made the body (Blender with MPFB, which is GPL-3 and stays out of the
repository) and the rig (zhuda-spine2D). Nothing in the workspace uses the modules. **State: committed and pushed to
`unified` on the owner's word ("好，推上去", 2026-11-26); `git log -- prefabs/3d/layered-hosiery` gives
the commits.** Nothing of it is in progress. What is left is the owner's: looking at the pictures,
a phone run, and the Desktop folder (item 7 under Open).

**After 2.0.0, on the Mac: a bar for characters that are looked at closely (2026-11-26).** The
owner asked for another session's research on characters (an outside LayaAir project's showcase
taken apart: the route `smooth-character-motion`) to be made into a route by which an agent can
make high-quality characters. It is [high-quality-character](docs/routes/high-quality-character.md):
eleven steps, each with its check. With it: `games/tools/characters/motion-audit.mjs` (the
research's measures on any `.glb`, as musts and shoulds; on the reference it gives the research's
numbers again and finds one loop that does not close), `games/tools/characters/blender/raise-rig.py`
(Blender headless: twist bones, hair and cloth and tails swung on springs and written into the
clips, whole frames), and `prefabs/viewer3d` at `?scene=model-stand` (any rigged `.glb` in the
engine). The wardrobe's body and the pig Zhuda were raised with it, pass every must and were
photographed in the engine beside themselves as they were; the raised copies replace nothing.
Task and record: [character-bar](docs/plans/records/character-bar/task.md),
[verification](docs/plans/records/character-bar/verification.md); the Mac's files are in
`local-results/character-bar/`. **Not done:** no character was made from nothing by the route
(the body, a long idle, the order at run time and the shading are written, not run); nobody
judged a picture; corrective bones, props and the face's shadow are still gaps. **State: committed
and pushed to `unified` on the owner's word ("好，推上去", 2026-11-26)**, together with the other
session's two routes (`smooth-character-motion`, `laya-ide-project-cli-web`) and the hosiery
record's last four files. The exact next step: the first real use, a character made by the route
with a person judging at steps 2 and 11.

**Open.**

1. The engine's own repository: whether `unified` becomes its `main` (it is public), and with what
   history. Until then `zhuda-laya-init` needs `--engine` with the verification repository's spec.
2. The workspace's `routes/mobile-web-fullscreen.md` is the only place that still names where the
   mobile practice was learned and in which files (left out here on the owner's "不包含 win 主機的
   BDL"); keep it until the owner says whether those pointers belong here.
   The workspace still holds `commonPrefabs/`, `routes/` (both superseded by this repository) and
   `commonAssets/` (644 MB of textures, not moved: too large to ride in every clone without the
   owner saying so).
3. What the game routes named and was not moved into `prefabs/`, with the reasons (licences not
   recorded, size, code still tied to one game): in the verification record.
4. Engine gaps the routes list that are still open: the table in the verification record.
5. No phone, no person, no CI run: as before.
6. From the games' moves: `zhuda-dao` cannot build its mini-game package (its own code and size,
   not the engine); `zhuda-spacetime-3d` has 331 KB left under its package cap; one black frame
   seen once there; `pigfall-apocalypse`'s walk transitions changed with the cross-fade fix and
   were not looked at.
7. The Desktop folder `撕襪技術精華-2026-11-25` is in the Trash since 2026-11-26 (moved by Finder on
   the owner's word, so "Put Back" works until the Trash is emptied). Checked file by file before
   the move (the verification record's last section): of its 159 files, 116 are on the remote byte
   for byte, 2 are in this repository's history, 22 were changed on purpose on the way in
   (scrubbed, cropped or converted) and 15 are package scaffolding and blank templates. Four were in
   neither list and were added after the first push (`prefabs/2d/spine-tights/source/Main-2026-11-15.ts`,
   `prefabs/3d/layered-hosiery/source/hud-2026-11-15.ts` and `old-patterns-test-2026-11-15.mjs`,
   `local-results/hosiery-modules/digest-README-2026-11-25.md`), with the two READMEs' lists
   corrected; they were committed and pushed the same day on the owner's word, so the Trash holds
   nothing that the remote lacks but the originals of the 22 files changed on purpose.

## Repository unification (2026-11-25)

Read this first if you are on the `unified` line. It is the engine at
`def94aa` plus the commits below, made in a cloud container and pushed as a
branch to the owner's verification repository; publishing it is the owner's
step. Record: [repo-unification](docs/plans/records/repo-unification/verification.md).

### Where the work is: `unified`. The old branch is left as it is (the owner, 2026-11-26)

**Work on `unified`.** It is the one line of work: the engine, the nine reference
games, the routes, the character kit and the local machine's results. Every new
commit goes here. `unified` on GitHub is what the owner's Mac and the cloud
session have.

**The old review branch is not to be touched for now** (the owner, 2026-11-26:
"先不去動舊的"). `claude/zhuda-engine-review-scenes-w8btzs` stays as it is: still
there, still GitHub's default branch. Nobody commits to it, deletes it or changes
the default until the owner says so. What that means when you start:

- A plain `git clone` checks out the old branch. Ask for this one:
  `git clone -b unified https://github.com/<owner>/VerifyZhuda.git`, or in
  a clone you have, `git fetch origin && git switch unified`.
- The repository's front page on GitHub shows the old branch's `README.md` and
  `HANDOFF.md`. Their first paragraph says the branch is archived and gives four
  steps "to do first" (make `unified` the default, check it, check the tag,
  delete the branch). **Those steps are put off, not next.** This section is
  later than that note and replaces it; the note itself stays, because the
  branch is not to be touched.
- A pull request opened on GitHub aims at the old branch unless you choose
  `unified` as its base.
- CI has still not run on this line (see "Open" below): running it by hand needs
  the workflow on the default branch.

**If the owner later wants the old branch gone**, these are the steps, and who
can do each:

1. Make `unified` the default branch: on GitHub, signed in as the repository's
   owner account, Settings, General, Default branch, choose
   `unified`, Update, and confirm in the box that opens. Only that account on
   the web can: the account on the Mac (`zhudaandzhuer`) may push but not
   administer and was refused (HTTP 404); the cloud session's token has admin
   rights, but its network proxy refuses repository-settings writes (HTTP 403,
   "Repository settings writes are not permitted through this proxy"), and a
   policy refusal is not worked round.
2. Check it took: `git ls-remote --symref origin HEAD` must say
   `ref: refs/heads/unified`. (On 2026-11-26 it still said the review branch
   after the owner reported the change twice: do not skip this check.)
3. Check the archive tag: `git ls-remote origin refs/tags/archive/review-scenes-2026-11-25`
   must print `a32a7c7a23739e759b645c6562b732fec6baf734`.
4. Only then, and only on the owner's word: `git push origin --delete claude/zhuda-engine-review-scenes-w8btzs`
   (any account that may push). Everything on it up to `a32a7c7a` stays
   reachable through the tag; the one commit after the tag (`413834ee`) is the
   note described above.

Whatever is decided: do not delete the two `archive/…` tags, and do not touch
the checkout `ZhudaGameCenter/audits/VerifyZhuda/` on the Mac, which holds about
170 MB that are on no branch
([left-behind](docs/plans/records/repo-unification/left-behind.md)).

**As it stood on 2026-11-26** (checked from the cloud session): default branch
the review branch, tip `413834ee`; tag `archive/review-scenes-2026-11-25` at
`a32a7c7a`; tag `archive/xianxia-select-2026-11-25` at `760e2c0f`; the 問道台
branch deleted earlier that day.

**Done** (all of it committed and pushed to `unified`).

- The pinned toolchain ran on this tree: `npm ci`, `npm run verify` (1013 of
  1013), `npm run lint`, `npm run format:check`, `npm run verify:games` (nine of
  nine). Three things it found are fixed: a route with a ninth section, a win
  count in `games/zhuda-swarm` that held on one machine only, eleven `bin`
  files tracked without the executable bit. Each game's page carries an empty
  icon so that a real Chrome logs no 404.
- [`LOCAL-REQUESTS.md`](LOCAL-REQUESTS.md), the cloud sessions' list of what
  needs a real machine or a person, is answered item by item in
  [`local-results/README.md`](local-results/README.md) (in Traditional Chinese,
  as the list is). Done there: A1, A2, C4, D1, E1, E2, F1; the Mac half of C1
  and C3; a first version of D3; pictures for B1; a sheet from the file for F2.
- New tools: `games/tools/shot.mjs --gpu` (the installed Chrome on the
  machine's graphics card), `games/tools/device-measure.mjs`,
  `games/tools/blender/` (`inspect-parts.py`, `cloth-truth.py`,
  `model-sheet.py`), `games/zhuda-wardrobe/tools/look-book.mjs`. Playwright is
  still not a dependency: `PLAYWRIGHT_PATH`.
- On GitHub: `unified` pushed; the two old tips tagged
  (`archive/review-scenes-2026-11-25` = `a32a7c7a`,
  `archive/xianxia-select-2026-11-25` = `760e2c0f`); the 問道台 branch deleted.

**Decided by the owner.**

- One branch, `unified` the main one; what is not needed removed (2026-11-25).
- "全部執行" on 2026-11-26: push `unified`, tag the old tips, make `unified` the
  default, delete the old branches. The first two were done on the Mac, and one
  old branch (問道台) was deleted.
- Later on 2026-11-26, after neither the Mac nor the cloud session could change
  the default branch: `unified` is what is used from now on, and the old review
  branch is left alone for the time being ("目前改用什麼為主，先不去動舊的").
  Changing the default and deleting that branch wait for the owner's word.

**Open, in the order it matters.**

1. *What the measures do not see* (found, not fixed; nothing under
   `games/tools/characters/` was changed):
   - *Fixed on 2026-11-26 (cloud session):* the dark patches and the dark band at
     every opening. The band was painted by distance to the zone's boundary in
     space, which is not distance to the garment's rim: a zone that merely
     encloses a limb runs close to the cloth there (the seat of trousers, a
     dress over the hips). A garment is now one colour; only the face that
     closes a hem from below is dark. The shapes are the same to the byte
     (`wardrobe.json` and `masks.json` did not change), so the three reports
     stand. [B1](local-results/B1/notes.md).
   - *Found on the way, not fixed:* in a stride, triangular teeth hang below a
     hem. They are the face that closes the hem: its inner edge is on the leg
     and goes down with it while the rim stays with the hips. They used to be
     dark, which is what read as torn edges. Two ways out, neither tried: a
     closing face that rises inwards (a funnel, attached 5 cm up the leg), or a
     closing face with one side, with the pixel measure taught to cull as the
     graphics card does. Straps and sleeve ends also show the cut's thickness
     as a ledge.
   - *Tried and not kept:* putting every vertex within a centimetre of a cut
     back on the cut. Hems came out straight at rest, the surface measure
     passed, and the pixel measure found slivers seen through on five parts
     (up to 2.4 cm², limit 1): the faces at the corner turn over when their
     vertices are moved onto one line. The corner the mesher rounds off is
     still ragged.
   - Cloth with two sides shares its vertices; Blender keeps one side, and a
     part that has been through it no longer passes the measure.
     [A2](local-results/A2/notes.md).
   - A dressed character costs by the pixel, not by the triangle: 60 frames a
     second at 1280x720 and 41 to 46 at 1920x1080 on an Apple M4.
     [C1](local-results/C1/notes.md).
   - The kit's tee is a median 1.1 to 2.0 cm from a simulated one in the clips
     a game plays, up to 12 cm at the hem; the skirt's simulation is not clean.
     [D3](local-results/D3/notes.md).
2. *CI has never run on this line.* The workflow runs on `main`, pull requests
   and by hand; by hand needs the workflow on the default branch, so not while
   the old branch is the default.
3. *Needs the phones* (both were unreachable on 2026-11-26): the phone half of
   C1, C2, WebGPU on the iPhone. The vivo needs wireless debugging on; the
   iPhone unlocked and awake on the same network.
4. *Needs a person*: B1's questions (the pictures are there), B2, B3, D2, E6.
5. *Needs the owner's word*: G1 to G7; installing a MakeHuman add-on into the
   owner's Blender (D4); a real character sheet (F2), which does not match the
   model in the repository; F3; which generated pictures to make (F1).
6. *Not started*: D5, E3, E4, E5. A canvas and a woven-bamboo texture were not
   found (E1).
7. One test, `tests/browser-process.test.mjs` "a browser that does not answer
   is ended by force", failed once while the machine was busy and passes alone;
   the browser is given 5 s to quit. Not changed.
8. Moving `unified` to the engine's own repository
   (`zhudaandzhuer/zhuda-laya-engine`, `main` still at `def94aa`): the Mac can
   push there; it waits for the owner (G7).

What changed:

- **Reference games.** Eight consumers under [`games/`](games/README.md) build
  against this checkout (`file:../..`); `npm run verify:games` runs them. The
  consumer build's output guard and the Doctor's pin rule accept a consumer
  kept inside the engine repository and nothing else new.
- **Routes.** `game-rules-first`, eight genre routes, `outdoor-landscape` and
  `rigged-phone-character` (the last two are drafts against an earlier engine
  commit whose reference consumer is not published).
- **Engine.** `grass.draws` lint advice and `zhudaGrassMeshCount`,
  `stage.worldToScreen` and `projectZhudaFilmPoint`, `durationSeconds` on model
  playback, `ground.y` ([round-9-consumer-fixes](docs/plans/records/round-9-consumer-fixes/verification.md));
  `getSamplePositionSec` and `getOutputLatencySec`
  ([audio-sample-clock](docs/plans/records/audio-sample-clock/verification.md)).
- **Pages.** One-page README (release notes moved to `CHANGELOG.md`, the
  feature tour to `docs/overview.md`), `docs/README.md` as the index of every
  guide, `docs/zh-CN/README.md` rewritten to match with the routes table.
  `docs/plans/` did not move: its index and templates are in the agent contract.

- **Dressing a character** (added the same day, after the unification): `bindZhudaSkinToSkeleton`
  ([skin-binding](docs/plans/records/skin-binding/verification.md)), the reference game
  `games/zhuda-wardrobe`, the character kit under `games/tools/characters/`, routes
  `outfit-swap-3d` and `humanoid-from-shapes`. Open from it: every region and part is a draw call
  in every pass and nothing merges them; a part from another tool is carried through offset
  nodes (checked with a script-written part in a modelling program's conventions, not with a real
  export) but is not refitted to other proportions;
  `material.albedoColor` set on a glTF material does nothing and says nothing (`setTint` works);
  the kit's textured path is not in this repository; nobody has judged how the figure looks.

- **Garments that nothing comes through** (added the same day): `setZhudaTriangleMask`
  ([triangle-mask](docs/plans/records/triangle-mask/verification.md)), and in the kit a garment
  maker, two measures (by surfaces, by pixels) and a catalogue of 32 garments and objects for the
  wardrobe; route `clip-free-garments`. What to know before touching it:
  - LayaAir 3.4.2 holds each glTF primitive **last index first**. A mask is in the file's order
    and the call turns it. Anything else that names triangles of a loaded mesh by their place in
    the file has the same trap.
  - `node tools/build-parts.mjs` in `games/zhuda-wardrobe` builds and measures (about two
    minutes) and fails if skin comes through a kit-made part; `node tools/look-report.mjs` looks
    from all round (about nine minutes); `node tools/measure.mjs` measures against real sizes. All
    three write `docs/evidence/`, which the game's tests read: rebuild a part and the tests fail
    until all three have been run again.
  - The measures are the author's own, checked against pictures the author looked at, in software
    rendering. They say nothing comes through in this body's five clips and three extreme poses;
    they do not say the clothes look good, and nobody has looked on a phone.
  - The one part made elsewhere (`knit`) does not pass and is listed so on purpose.
  - Since then (record [real-measurements](docs/plans/records/real-measurements/task.md)) the
    figure has a real size chart's measurements and the clothes are cut from real garment sheets;
    `node tools/measure.mjs` takes them with a tape and writes a third report the tests read.
    Three measurements are outside the real range (the T-shirt's hem, the skirts' hip ease) and
    the test names them. Long hair hangs too far off the back; the pack's straps stop at the
    chest; four cuts at real lengths were left out because they failed the pixel measure.
  - Open: the kit and the measures are consumer tools tied to bodies made of the kit's shapes; a
    masked mesh is a copy of its own; masks are 85 KB of JSON for 32 parts; the parts are 5.2 MB.

Before it is published:

- One CI run (the workflow has a new `games` job that has never run). The
  pinned toolchain itself ran on the owner's Mac on 2026-11-26
  ([local-results/A1](local-results/A1/notes.md)).
- The owner states the licence of the art under `games/`
  ([ASSETS.md](games/ASSETS.md)); it includes the owner's character model.
- The README still says the stable release is v1.17.0 while `package.json` is
  1.18.0; left as the owner wrote it.

Open, found while building the reference games:

- **2D batching drop, cause not found.** In `games/zhuda-swarm`, once a
  `level-up`, `confetti` or `explosion` effect has been drawn, the scene stays
  at 60 to 90 draw calls with no effect alive (3 without; `sparkle` and
  `hit-spark` keep it at 3 to 6). A separate project with the same effects
  stays at 1 to 3. Reproduce with `?fxfull=1`; numbers in
  `games/zhuda-swarm/docs/evidence/draws-*.log.json`.
- The Doctor reports HEALTHY for a 2D game that skips the `game-2d` route's
  prefab-first steps; the eight games draw from code.
- A consumer's prefab evidence fingerprint covers the whole engine bundle, so
  a different bundler version alone makes the evidence stale (seen with
  esbuild 0.28.2 in place of 0.27.1).
- Every game carries the same helpers (`src/ui/kit.ts`): a design-size root,
  the page position of a named control, tweens.
- `games/zhuda-beat` follows `getSamplePositionSec` and `games/zhuda-guard`
  places its markers with `stage.worldToScreen`; `games/zhuda-hunt` still
  projects by hand, and no game uses `durationSeconds`.
- The synth stops at 10 s and 16 layers per recipe. A song is mixed by the
  game from `renderZhudaSynth` and `encodeZhudaWav` (`games/zhuda-beat`, about
  0.1 s for 37 s of sound); no guide says so.
- `playSample` returns false and plays nothing while muted.
- `ZhudaTerrain2DRenderer` draws a tile as a square of one colour; shaped
  tiles are the game's to draw.
- Grass is reported by the lint, not made cheaper.
- In the review container, a consumer type-check with TypeScript 6.0.3 failed
  on the engine's declarations; the games pin 5.9.3. Not looked at again.

## State now (2026-11-23)

- `origin/main` is at `27c41b5` (the owner's priority update; CI run 164
  green on Linux, macOS and Windows). Nothing newer is on `main`.
- Branch `claude/handover-review-3q105d` (pushed, **not merged**) adds on
  `27c41b5`: `2623b15` VRM 1.0 import, `78404c8` twenty ready 2D effects,
  `c8b1889` the 2D route and its record, and the commit that carries this
  file. On that branch, in a Linux container (Node 24.22.3): `npm run
verify` 985 of 985, lint, format and `git diff --check` pass. CI runs on
  `main`, pull requests and by hand only, so the branch has no CI run yet.
  Merging is the owner's call.
- The owner's Mac (not visible from a cloud session; as the last Mac update
  left it): the local `feat/vrm` ref pointed at `6f467bb` with no commits of
  its own and the VRM parser draft there was rolled back. The VRM import on
  the branch above is a new implementation, not that draft. The review
  consumer's local `claude/zhuda-engine-review-scenes-w8btzs` is at
  `dc82408` while GitHub has `05bffa8`; `audits/VerifyZhuda` has untracked
  outputs under `review-work/main-verification/out/mac-2026-11-20/` (not
  source, not on GitHub).

## Current priorities (owner's order, 2026-11-23)

1. **A dedicated 2D route and ready 2D effects.** Done within scope on the
   branch: the workflow route [game-2d](docs/routes/game-2d.md), twenty
   presets (`ZHUDA_EFFECT_PRESETS_2D`) played by `ZhudaEffect2D` on the
   existing 2D particles, `npm run verify:effects-2d`. Drawn on desktop WebGL
   in software (SwiftShader) only. Record:
   [task](docs/plans/records/ready-effects-2d/task.md),
   [verification](docs/plans/records/ready-effects-2d/verification.md).
2. **VRM import, VRM 1.0** (the owner chose 1.0 on 2026-11-23). Done within
   scope on the branch: `ZhudaModelLibrary` reads the four `VRMC_*`
   extensions into `instance.vrm`, `ZhudaVrm` applies them (bones,
   expressions, gaze, constraints, spring bones, MToon as toon); `npm run
verify:vrm` draws an avatar the test makes itself. Guide:
   [docs/vrm.md](docs/vrm.md). Record:
   [task](docs/plans/records/vrm-import/task.md),
   [verification](docs/plans/records/vrm-import/verification.md).
3. **Mobile frame-rate checks.** Not started: they need the owner's Mac with
   the vivo V40 and the iPhone 14. Measure the 3D effect presets, picture
   materials, triplanar projection and terrain, and now also the 2D presets
   and a VRM avatar (toon with outline, springs). See
   [ready-effects](docs/plans/records/ready-effects/verification.md) and
   [review-requests-2](docs/plans/records/review-requests-2/verification.md).

## Open work

One list of what earlier rounds left open, by kind; each line names its
record.

### Waiting for the owner

- What the cloud sessions need from a local machine for assets and game development (a pinned
  verify, a person's eyes, devices, files from real authoring tools, downloaded materials): one
  list, `LOCAL-REQUESTS.md` in the owner's verification repository, with where to put results.

- Merge `claude/handover-review-3q105d` into `main` (above).
- Whether `gtao` becomes the look's default: every scene's picture changes
  ([review-requests](docs/plans/records/review-requests/verification.md)).

### Devices and backends

- The phone frame rates of priority 3.
- The six new draw checks and `verify:film-webgpu` of the outside review's
  patches on the Windows host, the V40 and the iPhone 14; patches 07 and 08
  matter most on Direct3D 11
  ([outside-review-patches](docs/plans/records/outside-review-patches/verification.md)).
- No phone and no Windows run for: the review's requests (both rounds), the
  ready 3D effects and picture materials, the underwater seam and horizon,
  the ribbon draw range. The review's phone models load on the M4 on both
  backends with every clip moving (`beasts-hd`, `bosses-hd`); no frame rate
  was taken on a phone.
- WebGPU for the new work: `verify:vrm` and `verify:effects-2d` were not run
  on WebGPU (no device in the cloud container); the toon material's shade
  colour was drawn on WebGL only.
- A third-party VRM file (VRoid Studio, UniVRM, the Blender add-on) has not
  been loaded; nobody has judged the 2D presets in motion.
- The iPhone on WebGPU (needs HTTPS)
  ([quality-tiers](docs/plans/records/quality-tiers/verification.md)).

### Engine questions not answered

- QA-01: why a browser session's first one or two frames differ by 1/255
  at one pixel on Intel Direct3D 11. On the Windows host
  `verify:instanced-mesh` WebGL differed by 1/255 at one pixel in 2 of 26
  runs of `95aee18` (0 of 24 since instance buffers are destroyed at the
  next frame's start, 0 of 19 before the sweep): that change or QA-01 is not
  known.
- The iPhone: any pass into a target of its own takes the rate under 60
  though frames drawn back to back take 7 to 10 ms; the guess (targets not
  discarded on a tile-based GPU) is not tested.
- The V40: about 20 s of about 50 FPS after loading
  ([draw-warm-up](docs/plans/records/draw-warm-up/verification.md)).
- `verify:quality-governor` fails on WebGL on the Mac, also at `87ab247`,
  and passes on WebGPU (timed assertions under load): run it on a quiet
  machine before trusting either result.
- The page's and the film host's draw counts are not brought together (17
  draws and 141,000 triangles of the review's scene 01 untraced); thin lines
  between probe cells in a dark scene lit by a glow (seen, not looked into)
  ([review-requests-2](docs/plans/records/review-requests-2/verification.md)).

### Not built (each named in its record)

- Area and line lights; a recipe mask by height above ground; lit or soft
  particles.
- VRM: VRM 0.x, `.vrma` clips, extended colliders, MToon's matcap and UV
  animation, a spring's `center` space, first-person layers
  ([docs/vrm.md](docs/vrm.md)).
- Frame-rate tiers as steps for each device and a warning for too many
  draws; the instanced town on the V40; repeat runs and a heavier scene
  ([quality-tiers](docs/plans/records/quality-tiers/verification.md)).
- The quality route's unbuilt areas
  ([render-gaps](docs/plans/records/render-gaps/verification.md)).

### Consumers and the outside review

- Tell the consumers that `COLOR_0` is read as glTF's linear value: models
  with shade baked into vertex colours draw brighter.
- The review's findings without a patch (its
  `deliverables/engine-patches/README.md`, second table) are not started.
- Scene routes for an outdoor landscape and a rigged phone character are in
  `docs/routes/` as drafts written against an earlier commit, not re-run on
  this one; no agent was run on any route to see whether it follows them.
- `zhuda-spacetime-3d` to switch from its prototype to
  `zhudaWarmUpByDrawing`, measured on the V40.
- The floating-island consumer's build notes and `tsconfig.engine-dev.json`
  still name the removed `zhuda-laya-engine-island` folder (it builds
  against `main`; the change is the consumer's).
- The Windows host's packaged consumer web is the DIST-02 one, not rebuilt
  from the current engine.

### Plans still in progress (plan index)

3D model editor, quality defaults and the quality route, what a frame costs
on a phone, phone checks, frame-rate tiers, the quality route's unbuilt
areas, the procedural hand (how it looks is the owner's to judge), and the
three.js gap audit (Proposed). See [docs/plans/README.md](docs/plans/README.md).

## Decided

- VRM 1.0, not 0.x (owner, 2026-11-23).
- The built-in example Prefabs and the Minesweeper scene stay (owner,
  2026-11-23). All eleven files under `assets/` are read by tests, the
  showcase or the guides; nothing is removed. The 2026-11-21 ready-effects
  record was written while this was still open.
- `COLOR_0` is read as glTF's linear value (owner, 2026-11-20).
- LayaAir stays on 3.4.2
  ([decision](docs/plans/records/laya-3.4.3-upgrade/decision.md)).
- The desktop host example runs Electron 45.3.3 with Forge 8.0.1 (0
  advisories); `--verify` shows its window and keeps drawing.
- `verify:film-water` compares the frame after thirty mounts with the one
  drawn just before them (QA-01); `verify:specular-aa` holds the game-sun
  highlight to a truth taken under that sun (GFX-06).
- Hardware CI lanes (Intel/NVIDIA, Chrome/Edge) stay a manual procedure:
  `docs/agent-development.md`, "Windows hardware runs".

## Working in a cloud session

- Node 24 is required (`engines`); the container's default is 22. Use
  `export PATH=/opt/node24/bin:$PATH`, then `npm ci`.
- Draw checks: `export CHROME_BIN=/opt/pw-browsers/chromium`. WebGL is
  SwiftShader (software); there is no WebGPU device. Record WebGPU and every
  device check as UNAVAILABLE, never as a pass.
- The browser checks bundle `dist/sdk`: run `npm run build` (or `npm run
verify`) after a source change and before a `verify:*` check, or it draws
  the old engine.
- `verify:stylized-shading` times out in its 1280 by 720 timing step on
  SwiftShader (the page is too busy to answer); its picture assertions pass
  when that step is left out of a scratch copy.

## History (newest first)

**2026-11-23, cloud session (branch `claude/handover-review-3q105d`).** The
handoff was checked against the repository: its links resolve, `npm run
verify` passed on `27c41b5`, its claims about 2D and VRM held, and its
stale parts (push notes, the CI line, the outside review's download step,
two Safari addresses) were rewritten here. Then priorities 1 and 2 (above).
Defects found on the way and fixed: `ZhudaToonMaterial` copied its spec
through JSON and failed on a real texture in `material.textures` (as its
own guide shows); the 2D particle sprites were marked as plain data, so
LayaAir's 2D pipeline showed a half-alpha pixel at 191 of 255 instead of 135. New on the way: per-bone spring settings, a toon shade colour.

**2026-11-23, owner.** Priorities set (`27c41b5`).

**2026-11-21, ready effects and picture materials.** Eighteen 3D effect
presets on sprites made by a program, `ZhudaEffect3D`, a film scene's
`effect` node, a film material that is a picture among the assets. The
pictures live outside this repository: `ZhudaGameCenter/commonAssets/` (not
a git repository) holds 48 tileable sets with `catalog.json`, a README and
an example scene (point `--film-assets` at it); their 512 versions are also
in `VerifyZhuda/textures/`. Record:
[task](docs/plans/records/ready-effects/task.md),
[verification](docs/plans/records/ready-effects/verification.md).

**2026-11-21, the underwater horizon** (`dc642b2`). The consumer's re-check
of the seam fix found a step at the horizon with light fog on. The medium
counts `maxDistance` of open water on both sides of the horizon and the
backdrop carries the rest; the consumer's frame 1380 reads level on both
backends. Record: the second round of
[underwater-seam](docs/plans/records/underwater-seam/verification.md).

**2026-11-21, routes as formal documents.** Every route is one page in
`docs/routes/<id>.md` in one format, listed by `list_routes` and `get_route`
and by a "Start here" table in `AGENTS.md` and `README.md`. Record:
[task](docs/plans/records/route-registry/task.md),
[verification](docs/plans/records/route-registry/verification.md).

**2026-11-21, the rest of the review's requests** (branch
`feat/review-requests-2`, merged). Prop nodes' `castShadow`, `cullMeters`,
`lod`; materials' `blend`, `alphaCutoff`, `doubleSided`, `opacity`; a
recipe's `alpha` and `shape` masks; `detail`; `grass` and `terrain` nodes;
`projection: 'triplanar'`; `film_scene_query`; packs read again when
edited; glow through `bounceLight` with a check and advice. Nine draw
checks, all in `verify:film-webgpu`. For the review, sixteen tileable
texture sets were generated (gpt-image-2.6-flare) and pushed to
`VerifyZhuda` as `7ee3f17`; the source pictures (102 MB) are on the Mac only
(`audits/VerifyZhuda/textures/raw/`). The review is told in its
`ENGINE-REPLY.md`. Record:
[task](docs/plans/records/review-requests-2/task.md),
[verification](docs/plans/records/review-requests-2/verification.md).

**2026-11-21, three requests of the review.** A film model node's
`cullMeters`, `castShadow`, `cellMeters`; skins over 24 joints ordered at
load into few pieces; `gtao` as the occlusion without the extra scene pass.
Record: [task](docs/plans/records/review-requests/task.md),
[verification](docs/plans/records/review-requests/verification.md).

**2026-11-21, the line across clear water.** Found by the consumer film
`films/pelagic-grove` (its `ENGINE-TASK-underwater-seam.md`): a backdrop
sphere behind the water in `Underwater.ts`, and the view counting all the
water to the surface. Ten stills `engine-fix-*.png` went to the consumer's
`evidence/` (five kept in `audits/underwater-seam-2026-11-21/consumer/`).
Record: [task](docs/plans/records/underwater-seam/task.md),
[verification](docs/plans/records/underwater-seam/verification.md).

**2026-11-20, the outside review's ten patches** (`87ab247`, merged by
fast-forward on the owner's word; the day's branches deleted). The review's
repository is cloned beside the engine (`ZhudaGameCenter/audits/VerifyZhuda`,
private, branch `claude/zhuda-engine-review-scenes-w8btzs`; its own
`HANDOFF.md` is the way in); its reproductions ran on the Mac (Apple M4)
against `e453b60` and `a5dfc6b`. The Mac has `node@24` beside the default
Node (`/opt/homebrew/opt/node@24/bin`). Record:
[task](docs/plans/records/outside-review-patches/task.md),
[verification](docs/plans/records/outside-review-patches/verification.md).

**2026-11-20, frame-rate tiers.** The owner's goal: the best picture that
stays smooth on mobile, in three tiers (60 and over on the Mac, the V40 and
the iPhone 14; 45 to 60; 10 to 45, never under 10). `f56f8a4` the
measuring tool; `f9f1e86` the tiers as data (`ZHUDA_FRAME_TIERS`,
`zhudaFrameTier`, `zhudaTierBudgetMs`), a rung at level 1 drawn at 0.5,
advice for many draws, render targets counted; `94eb400`
`ZhudaFilmicPipeline` keeps no idle occlusion effect (V40 level 1 at 0.7: 57
to 60; iPhone 44..47 to 51..54). On the V40 a smaller render scale brings a
level into a band; on the iPhone the number of draws decides (instanced
houses: 31..35 to 45..49). Reports: `ZhudaGameCenter/audits/quality-tiers-2026-11-20/`.
Record: [task](docs/plans/records/quality-tiers/task.md),
[verification](docs/plans/records/quality-tiers/verification.md).

**2026-11-20, ribbon draw range** (`025dc21`). A 3D ribbon or particle
system whose count changed after its first draw kept the first count;
fixed in `DynamicParticleMesh3D.submit()`, `verify:ribbon-growth` on both
backends. The game that found it re-pinned and dropped its workaround.
Record: [task](docs/plans/records/dynamic-mesh-draw-range/task.md),
[verification](docs/plans/records/dynamic-mesh-draw-range/verification.md).

**2026-11-20, draw warm-up.** `zhudaWarmUpByDrawing` draws a scene behind
its loading screen from the eyes a game names; the fixture's first frame
then compiles nothing (7 ms WebGL, 32 ms WebGPU; 306 / 1252 ms cold). Found
by `zhuda-spacetime-3d` on a V40. Record:
[task](docs/plans/records/draw-warm-up/task.md),
[verification](docs/plans/records/draw-warm-up/verification.md).

**2026-11-18.** The route [a small floating island](docs/routes/floating-island.md)
(from the consumer `games/zhuda-sky-island`; nothing drawn again; record in
`docs/plans/records/floating-island-route/`). Three leftover local
branches, all in `main`, were deleted with their worktrees on the owner's
word. An outside review started on a zip of `e453b60` in a cloud session of
the iPhone's Claude account; it ended on 2026-11-20 with the patches above.

**2026-11-17, the open engine defects.** The owner asked for every open
defect to be fixed. Checked on macOS (every `verify:*` check on both
backends), the Windows host, the iPhone 14 and the V40 (2026-11-18, both
backends). Record: [engine defects](docs/plans/records/engine-defects/verification.md).

| Defect                                                                                    | State                                                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Lit surfaces of one shader name with other starting values                                | fixed                                                                               |
| WP22: a rim light brighter than the sun took its shadow                                   | fixed (`installLaya342ShadowLightFirst`)                                            |
| WP23: a program that does not compile stopped drawing on WebGPU                           | fixed (its objects are left out, the frame goes on)                                 |
| MEM-01's open part: LayaAir's batch marks, WebGPU and WebGL, and WebGL's instance buffers | fixed (swept; `verify:webgpu-churn` has a `batch` kind)                             |
| `inspectEngineHealth` on a WebGPU page                                                    | fixed                                                                               |
| `strands` turned hair white at any strength (body-lab)                                    | reproduced, fixed: `strength` dims both bands                                       |
| iPhone Safari `Unable to finish` on WebGPU                                                | not reproduced on an iPhone 14 with the engine's pages; the game itself was not run |
| Browser SDK checks read a stale `dist/browser/<version>`                                  | fixed: they build a fresh folder                                                    |

**2026-11-16/17, three plans**, all implemented:

| Plan                                                                                   | State                                                                                                                       | Records                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Windows acceptance fixes](docs/plans/records/windows-acceptance/plan.md)              | All 19 items closed on the report's Windows host (desktop session, Intel UHD 770), with macOS and a vivo V40 for comparison | per item in `docs/plans/records/windows-acceptance/` |
| [Techniques from Abyssal Garden](docs/plans/records/abyssal-garden-techniques/plan.md) | AG1..AG6 implemented (desktop WebGL and WebGPU; AG2, AG3 and AG1's regression checks also on the V40)                       | linked from the plan's Progress table                |
| [Mesh boolean operations (CSG)](docs/plans/records/mesh-csg/plan.md)                   | `zhuda-laya-engine/csg` optional entry (BSP), desktop and V40                                                               | `docs/plans/records/mesh-csg/`                       |

AG1..AG6 and CSG were built in a separate session on branch
`claude/fervent-lovelace-44d9db` and merged into `main` after review, with
`npm run verify`, lint, format, the draw checks on both backends and phone
runs at each merge.

**Earlier.** The two Adreno findings of the phone runs were fixed
([record](docs/plans/records/phone-findings-adreno/verification.md)); GitHub
issue #8 (WebGPU glTFPBR pipeline invalid after about 70 s) is fixed in
[webgpu-node-bindings](docs/plans/records/webgpu-node-bindings/verification.md)
and verified in the game by its own session (0 errors in 11 rounds on
`renderer: auto`).

## Machines

- Windows host (`win-bdl`): work folder
  `D:\claude-workstation\zhuda-windows-batch1` (checkouts `fixed`, `base`,
  logs and evidence). No test install or scheduled task of this work is
  left; GPU checks there run in the signed-in desktop session through a
  scheduled task, never over SSH (session 0).
- iPhone 14: Safari was last left on a page of a check server on the Mac,
  which is stopped; earlier updates named two addresses on different days
  (`https://192.168.2.59:8765/control.html` and `192.168.50.80`): close the
  tab. Safari keeps an exception for that self-signed certificate. It is
  driven through the mobile-control service and must be unlocked and awake.
- vivo V40: checks through `ZHUDA_PHONE_CHROME` with
  `adb forward tcp:9333 localabstract:chrome_devtools_remote`; the forward is
  removed after use.
