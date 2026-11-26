# Route: a finished game dissolved into shared prefabs, then the original project removed

A game that is finished but no longer maintained on its own has its scenes, characters, systems
and assets taken apart into modules of the prefab library (`prefabs/`): any game can fetch them
with `sync.mjs`, the viewer shows them at `?scene=<id>`, and every module has preview pictures
and a README. Afterwards the modules are compared with the original game pixel by pixel, on the
same engine, in the same Chrome, on a virtual clock, and only when they are the same is the
original project moved to the Trash. On 2026-11-25 three games (the floating island, the home
island and the garden island) were taken apart this way: projects of about 1.4 GB became modules
of about 30 MB.

- **Id:** `game-to-prefabs`
- **Kind:** workflow
- **For:** A game is to be retired, but its scenes, characters, systems and assets must stay where any later agent can call them up to use and to look at.
- **Checked on:** desktop WebGPU (Apple M4, headless Chrome 158, 1280 by 720); no phone
- **Status:** 2026-11-25: six games taken apart. The three 3D islands (garden island 6 frames,
  floating island 15, home island 10) and three 2D games (the duel `ashfall-duel` 18 frames,
  Dungeon Spin 26, the slot machine's maths round by round) are the same as the original games;
  the library's 147 tests and `verify` in both viewers all pass.
- **Reference consumer:** `prefabs/3d/` (the three islands), `prefabs/2d/` (ashfall-duel,
  dungeon-spin, slot-ui and others), `prefabs/viewer3d/`, `prefabs/viewer2d/`,
  `prefabs/tools/detplay.mjs`.
- **Engine version:** zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`

Everything on this page was done and checked on 2026-11-25, when the prefab library and the two
comparison tools were still in the ZhudaGameCenter workspace, beside the engine (outside this
repository). The paths are written as they are in this repository; nothing was run again from
them.

## When to take this route

- Fits: a game that is finished or stopped, with things in it that another game can use (a
  scene, a character that moves, a set of sounds, an interface), when it has been decided to
  remove the original project.
- Does not fit:
  - A game still in development: take shared modules out of it directly; no proof and no
    removal are needed.
  - A feature the engine should have: record it under the route's engine gaps.
  - A reference project that has a method but no reusable code: write the method as a route,
    and tidy the code and the assets away somewhere else for keeping. Judge "no reusable code"
    with care: the two stocking-tearing projects were first judged so and tidied into a folder
    outside the workspace (2026-11-25); the next day the owner had them made into the modules
    `3d/layered-hosiery` and `2d/spine-tights`, because a route that names files nobody can
    open is half a route. Those two were moved in without this route's pixel proof against a
    running original; what was compared instead is written in each module's README.
- Read first: `prefabs/README.md` and `prefabs/AGENTS.md` (the module rules, the folder rules,
  sync).

## Tools

- `prefabs/scripts/sync.mjs`: copies modules into a game
  (`node prefabs/scripts/sync.mjs <game dir> <module…>` from a checkout of this repository, or
  from a game `node node_modules/zhuda-laya-engine/prefabs/scripts/sync.mjs . <module…>`). `.ts`
  files go to `src/common/`, other files (models, sounds) go unchanged to `public/common/`;
  `--check` compares byte by byte.
- `prefabs/viewer3d/`: a consumer project of the engine. `?scene=<id>` opens any scene;
  `tools/play.mjs` plays `scenarios/*.json` in headless Chrome and takes screenshots;
  `npm run verify`.
- `prefabs/tools/detplay.mjs`: a player on a virtual clock (every frame is 1/60 s;
  `performance.now`, `Date` and the timers follow it; `Math.random` has a fixed seed;
  `BLOCK=<regex>` answers 404 for some files, `NOTRANSITIONS=1` turns CSS transitions off).
- `prefabs/tools/pixdiff.py`: the number of differing pixels between PNGs of the same name in
  two folders (Python 3 with Pillow).
- For taking several games apart in parallel: Claude sub-agents, each with an isolated work area
  of its own.
- Finder (through `osascript`) moves the original project to the Trash and keeps "Put Back".

## Steps

1. **Take stock.** Read the original project's README and HANDOFF; list the files and sizes of
   `src/`, `public/`, `tools/`, `work/` and `evidence/`. Across projects, find files that are
   **the same byte for byte** with `cmp` or `md5 -r` (the three islands: 6 source files, all the
   island models, the plants, the sound effects and Zhuda's lines were the same). Take one copy
   of what is the same.
2. **Make sure the engine version has what the game uses.** The original project may have been
   built against an engine branch that was never merged (the floating island once used
   `engines/zhuda-laya-engine-island` in the workspace). Look for those APIs in the installed
   engine's types (`setBenders`, `lightFog.maxDistance`, the cloud sea's `baseMeters`) and make
   sure the version now pinned has them all; only then can every module be pinned to one
   version.
3. **Shared base modules first, with the differences as options.** Example: two copies of
   `sky.ts` differed only in shadow distance, fog and cloud, so `3d/day-look` gained a
   `DaySetting` (`CLOUD_SEA`, `OCEAN`); `tiers.ts` differed only in the amount of grass, so
   `makeTiers(grass)`. **Prove by program that the output is unchanged**: give the original file
   and the new module the same inputs and compare the `JSON.stringify` of the results (day-look:
   three original files by 8,730 combinations of hour, weather and switches, all the same).
4. **Shared assets become modules first** (`3d/zhuda-characters`, `3d/nature-pack`), because
   several scenes need them; write down where the master files are (those of Zhuda and Zhuer are
   in the owner's character folder, outside the workspace).
5. **The viewer must build and run first.** Start with one minimal preset (`nature-pack`) to
   make sure that binary assets sync, that `common/…` URLs load, and that the build, the types
   and the Doctor all pass.
6. **One sub-agent for each game, each in an isolated work area.** `rsync` a copy of `prefabs/`
   (without `node_modules` and `viewer3d/dist`), with `node_modules` as a symlink back to the
   real one. In its work area a sub-agent may change `catalog.json` and `presets.ts`; only the
   main agent merges into the real library. Say plainly: which files to read, how to cut the
   modules, what it must not touch (the engine, other work areas, the original game, the owner's
   site), that it must not publish, and what it must hand back.
7. **How to cut the modules.** The scene itself has one entry (`createGardenIsland()`,
   `createSkyIsland()`: built in one call, one `update()` a frame, returning its queries and a
   `dispose()`); the character, walking, sound and the interface are each a module; **code that
   was hard-wired to one island takes it by injection instead** (`PigWorld`, `WalkWorld`), so it
   can be used on another island. The parts that do not touch the engine (ground queries, rules,
   the table of lines) go in a file of their own, so that node can test them. The original
   game's node tests move into `prefabs/tests/` with them.
8. **A viewer preset reproduces the original game.** Keep every URL parameter it had; offer the
   original `window.__ISLAND__` hook unchanged as `window.__SCENE__` (with `ready` added), so
   that an original scenario file runs once `I.` is replaced by `S.`.
9. **The proof of equivalence.**
   - Copy the original game into the work area (without `node_modules`, `dist`, `evidence` and
     `work`), **change only the engine pin**, and point `node_modules` at the same engine;
     confirm with `diff -r` that `src/` and `public/` are identical to the original project.
   - Run the original game and the viewer with `detplay.mjs` on the same scenario and the same
     URL parameters, then compare with `pixdiff.py`.
   - **Always measure the original game against itself**: the same build run twice. Only when
     the two runs are the same does the comparison mean anything; when they differ, find the
     cause (see Pitfalls).
   - The main agent runs at least one scenario again itself and does not go by the sub-agent's
     numbers alone; it also confirms that the two sides really are different builds (the `md5`
     differs, and the viewer's bundle holds other presets).
10. **Preview pictures.** In each scene module's `preview/`: one jpg for each representative
    view (1280×720, quality about 85) and one `sheet.jpg` that shows them all; look at them
    yourself before handing over.
11. **Merge.** `diff -rq` against the real library (excluding `node_modules` and `dist`) lists
    what the sub-agent changed, which should be what it reported; copy the modules, tests,
    presets and scenarios; add the new entries to `catalog.json` by program (do not overwrite
    the whole file: another sub-agent's entries would be lost); merge `presets.ts` by hand;
    after `node ../scripts/sync.mjs .`, `npm run verify` in both the library and the viewer; run
    every preset of the merged viewer once, and compare pixels with the original game once more.
12. **A finished work that is not code goes elsewhere.** Example: the short film shot on the
    garden island moved to the workspace's `films/zhuda-garden-island-a-day-off/` (the mp4, the
    narration, the storyboard); the single frames are not kept.
13. **Documents.** The module table and the version record (raise the version) in
    `prefabs/README.md`, the rules in its `AGENTS.md`; each module's own README (how to call it,
    a code example, the parameters, what was verified, what was not, where it came from).
14. **Find what refers to the original project from outside.** `grep -rl` over the whole
    workspace (excluding `node_modules` and `dist`); a "Reference consumer" in a route or a
    document must be changed to point to the new module (the one in this repository's routes
    that was left as a to-do is the last row of the gaps below).
15. **Remove.** Stop any preview server that uses the project and change any
    `.claude/launch.json` that points to it; move it to the Trash with Finder (so that it can be
    "Put Back"); write in the library's version record where it went and what was not verified.

## Pitfalls

- **Two runs on real time differ.** On a busy machine (load above 100), two runs of the original
  game's own `play.mjs` differed by 260,000 to 720,000 pixels in each screenshot: petals,
  fireflies, the sway of the grass and the character's pose depend on how many frames really ran
  in those seconds. Use a virtual clock (`detplay.mjs`): every frame exactly 1/60 s, every
  source of time replaced, a fixed seed for random numbers.
- **0 pixels of difference, and nothing was compared.** Found on 2026-11-25 while Dungeon Spin
  was taken apart: the virtual clock's `Date.now()` had a fraction, the game ledger's
  `Number.isSafeInteger` check refused most rounds, both sides failed together and the
  screenshots were the same all the same. `detplay.mjs` now counts whole milliseconds; **with
  every screenshot compare the game's state as well** (`state()`, or the points, round and
  health that the script returns), never the pixels alone.
- **A 2D game needs the viewer that is fixed to WebGL.** The 3D viewer is `renderer: auto`
  (headless Chrome takes WebGPU) and the original 2D games are WebGL; drawn differently, they
  cannot be compared pixel by pixel. Use `prefabs/viewer2d` for 2D. A 2D build opens with about
  5 s of engine logo; `ready` must wait until it is over.
- **The original game has no `__SCENE__` hook.** `detplay.mjs` takes `HOOK=<global name>`
  (Dungeon Spin's `__DUNGEON_GAME__`, for example) or `PRELOAD=<script>` (the duel used a hook
  that only reads the DOM, defined before the first frame), so the original game can be stepped
  frame by frame as well.
- **A themed game made after someone else's work.** Take only the technique that carries no
  theme (the flow, the maths engine, the server); after proving equivalence in the work area
  with the original configuration, keep neither the configuration nor the art (2026-11-25, an
  earlier slot game in the workspace).
- **The original game itself draws in two ways.** Run again on the virtual clock, the floating
  island and the home island still switch between two results (they differ at edges, on the
  water and around the character: at most 130 pixels, each by no more than 8 in brightness).
  Run the original game two or three times first and note how many results it has; a module
  passes when it is the same pixel for pixel as **one** of them. Seen on 2026-11-25: the new
  module had 0 pixels of difference from one run of the original game, and its difference from
  the original's other result was the same as the difference between the original's two
  results.
- **Anything on real time breaks the comparison.** The playback time of an `<audio>` element
  (the home island's song): compare with `BLOCK=song`, which makes the song file a 404. CSS
  transitions (a hint fading out): `NOTRANSITIONS=1`. The song and the sync to its beat are
  checked apart, on real time (it plays; `songTime` advances).
- **`sync.mjs` used to read text only.** Models and sounds read and written as UTF-8 are
  broken. From version 0.7.0 of the library everything that is not `.ts` or `.css` is copied as
  bytes and compared as bytes. Run `tests/sync.test.mjs` first when adding a file type.
- **The library's typecheck has `erasableSyntaxOnly` on.** No enum, no namespace, no
  constructor parameter properties.
- **Overwriting the whole of `catalog.json` eats someone else's entries.** Two sub-agents start
  from the same copy and each adds entries; when merging, add only the new keys.
- **The user account's Trash folder cannot be listed in this environment (Operation not
  permitted), and `mv` into it is not reliable either.** Use
  `osascript -e 'tell application "Finder" to delete {POSIX file "…", …}'`, which keeps "Put
  Back".
- **A sub-agent cannot read some outside files** (on 2026-11-25 reading `HomeIsland.astro` of
  the owner's site was refused). In the README mark that part as presumed; do not write it as
  confirmed.

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| The engine's runtime has no fixed-clock mode for comparing two builds | `prefabs/tools/detplay.mjs`, which ships in the package since 2.0.0, replaces `requestAnimationFrame`, `performance.now`, `Date`, the timers and `Math.random` before the page's scripts run **After 2.0.0:** `fixedDeltaSec` on the session fixes its clock per frame (timers, waits, tweens, layers, `update(dt)`); it does not replace the page's clocks, which `detplay.mjs` still does. |

Closed in 2.0.0: the headless Chrome host is a public entry
(`zhuda-laya-engine/compiler/chrome-host`; when the route was checked the tools imported the
installed package's file by path), and [floating-island](floating-island.md) names
`prefabs/3d/sky-island` as its reference consumer instead of the removed game.

## Checks

```sh
cd prefabs && npm run verify                                  # types (against engine def94aa) and node tests
cd viewer3d && node ../scripts/sync.mjs . && npm run verify   # sync check, build, types, Doctor, tests
# from the repository root: the original game (a copy with only the pin changed) and the viewer,
# on the same scenario with the same parameters
node prefabs/tools/detplay.mjs <original game>/dist/web <scenario.json> "width=1280&height=720&fx=high&governor=0" <out A>
node prefabs/tools/detplay.mjs prefabs/viewer3d/dist/web <scenario.json> "scene=<id>&width=1280&height=720&fx=high&governor=0" <out B>
python3 prefabs/tools/pixdiff.py <out A> <out B>
npm run verify                                                # in the repository root: its route audit checks the format of this page
```

Results of 2026-11-25: the garden island, 6 frames, 0 pixels (the same when the main agent ran
it again itself and when it was run after the merge); the floating island's hero, grab and pond,
15 frames, and the home island's home and back, 10 frames, 0 pixels against the same one of the
original game's results; `rendererErrors` and `pageErrors` were empty every time.

## Not checked

- None of the scenes taken apart has been on a phone (the vivo V40 numbers in the garden
  island's README were measured on the older engine `a5dfc6b`).
- Sound was verified only for loading, unlocking, play events and the absence of errors; nobody
  has listened to it for how it sounds or for the balance of volumes.
- The steps to rebuild the home island for the owner's site were built only as far as the WebGL
  client; nothing was written into the site and nothing was published.
- Compared only on WebGPU in headless Chrome on a desktop; the WebGL builds were checked only in
  the original games, at their time.
- There is no proof that the original project is never needed again after its removal: it is in
  the Trash and can be put back until the Trash is emptied.

## Boundaries

- The game: its play, its levels, the content of its lines, its publishing settings. A new game
  made after the taking apart writes only a thin layer (boot, wiring the modules, input, the
  frame loop); the viewer's `src/presets/*.ts` are the examples of that layer.
- The prefab library (`prefabs/`): reusable scenes, character behaviour, walking, sound,
  interface and assets, with their preview pictures, how they were made (`source/`) and their
  tests.
- The engine: general features such as rendering, grass, water surfaces, particles, spring bones
  and the quality governor. What the engine turns out to lack while a game is taken apart goes
  under the route's engine gaps; do not quietly build a copy of an engine feature in a game or
  in the prefab library.
