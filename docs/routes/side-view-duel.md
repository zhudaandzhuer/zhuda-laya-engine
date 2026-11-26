# Route: A realistic side-view one-on-one duel (key-pose atlas and baked in-betweens)

A side-view duel between two fighters: realistic characters from generated art (eight key poses
each plus in-between cels baked offline, no skeleton), footwork that advances by the distance
really travelled, a sword whose hit is tested segment by segment along the drawn blade, a
breastplate that dents at the point of contact and springs back, and combat on a fixed 120 Hz
simulation. It is played with the keyboard, with the mouse held to charge, or with two thumbs on a
phone, and has a pause menu, sound settings and a victory or defeat screen. The result is Ashfall
Duel (灰燼之庭), a game by another author that was taken apart on 2026-11-25 into the modules that
are now `zhuda-engine-prefabs/2d/ashfall-duel` and `zhuda-engine-prefabs/2d/cel-motion`; the viewer's `?scene=ashfall-duel`
is pixel for pixel the same as the original game. Checked only in desktop Chrome and its touch
emulation.

- **Id:** `side-view-duel`
- **Kind:** scene
- **For:** Building a realistic side-view one-on-one duel (or another one with other characters or
  another place): a key-pose atlas with baked in-betweens, footwork by the distance really
  travelled, hit tests along the blade, armour that dents and springs back, a fixed 120 Hz
  simulation, two-thumb touch, release
- **Checked on:** desktop WebGL (Apple M4, headless Chrome 158 on macOS, 1280×720); phones only as
  Chrome's touch emulation (390×844, 844×390), no real phone
- **Status:** taken apart on 2026-11-25 from the original game (removed after it was taken apart;
  its history is kept as a git bundle under `zhuda-engine-prefabs/2d/ashfall-duel/source/`): the duel's state
  the same as the original over 240,000 steps, 12 desktop views and 6 portrait views pixel for
  pixel the same as the original game, the three prefab comparisons and the 12 touch, keyboard and
  mouse checks passed
- **Reference consumer:** this repository, `zhuda-engine-prefabs/2d/ashfall-duel/` (the game itself and
  `source/`: the git bundle, the bake scripts, the comparison tools, the new-project template
  `source/proof/library-game/`), `zhuda-engine-prefabs/2d/cel-motion/`,
  `zhuda-engine-prefabs/viewer2d/src/presets/ashfall-duel.ts`
- **Engine version:** zhuda-laya-engine 1.18.0, `def94aae9e7ebf5f9f35b915b54dbb4c3e5fe43c`
  (LayaAir 3.4.2)

## When to take this route

- It fits: a side-view, one-on-one action game with melee weapons; characters that are realistic
  pictures (generated or painted) and must look continuous and heavy, with hits landing where they
  are drawn; play with two thumbs on a phone.
- It does not fit:
  - Parts of a character pulled by the hand, cloth that swings by physics: take
    [spine-character](spine-character.md).
  - Several enemies, a top-down view, a side-scrolling platformer: `Duel` has only two characters
    and one stretch of ground 1280 wide, and its framing is made for two. Start from
    [game-2d](game-2d.md) and take only `2d/cel-motion` for the characters.
  - 3D: [new-game-project](new-game-project.md) and
    [good-looking-3d-scene](good-looking-3d-scene.md).
- The atlas and in-betweens of a new character: [pose-atlas-motion](pose-atlas-motion.md). The
  steps common to any 2D game (project, time, input, prefabs, sound): [game-2d](game-2d.md);
  prefab checks: [visual-content-prefab](visual-content-prefab.md). This route does not repeat
  them.

## Tools

- `zhuda-engine-prefabs/scripts/sync.mjs` (`2d/ashfall-duel` brings in `2d/cel-motion`, `input/hold-input`,
  `ui/dom`, `ui/game-menu`, `ui/settings-form` and `systems/storage`); the viewer `zhuda-engine-prefabs/viewer2d`
  (`npm run build && npm run view`, `?scene=ashfall-duel&view=…`).
- Engine commands: `zhuda-laya-build`, `zhuda-laya-accept` (prefab comparison), `zhuda-laya-doctor`.
  Node 24.
- The touch, keyboard and mouse script `zhuda-engine-prefabs/2d/ashfall-duel/source/tools/check-controls.mjs`
  needs Playwright (or playwright-core) and Chrome. The Mac it was run on has no Playwright of its
  own: the run used a `playwright-core` 1.61.1 that belongs to another application, in a folder
  outside the workspace, with
  `CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` and `ASHFALL_VIDEO=0`
  (recording needs Playwright's own ffmpeg, which that Mac does not have).
- Pictures: the image command of the owner's `zhuda-windows` agent skill (not in this repository);
  the original author used ImageGen, and the prompts are in `zhuda-engine-prefabs/2d/ashfall-duel/source/ART.md`.
  Baking the in-betweens: Python 3 with Pillow, NumPy and OpenCV (see
  [pose-atlas-motion](pose-atlas-motion.md)). Sound effects: the engine's `renderZhudaSynthWav`
  (`source/tools/bake-audio.mjs`; a re-run is byte for byte the same).
- Release: the owner's `zhuda-windows` agent skill (not in this repository), its route B. A release
  acts outside the workspace: ask the owner first.
- Comparison: `zhuda-engine-prefabs/tools/detplay.mjs` (`PRELOAD=`) and `zhuda-engine-prefabs/tools/pixdiff.py`.

## Steps

1. **Look first.** `cd zhuda-engine-prefabs/viewer2d && npm run build && npm run view`, then open
   `index.html?scene=ashfall-duel`; `&view=impact|heavy|charge|evade|paused|sound|help|victory|defeat|duel`
   jumps straight to that moment (the views of a blow are frozen; `S.set({ freeze: false })` lets
   them go on). To see it without running anything, look at
   `zhuda-engine-prefabs/2d/ashfall-duel/preview/sheet.jpg`.
2. **Start the project.** Follow `zhuda-engine-prefabs/2d/ashfall-duel/source/proof/library-game/`:
   `package.json` pins the engine at `def94aa`; `zhuda.config.json` has
   `features: ["core","2d","ui"]`, `branding: { mode: "engine" }`, `viewport: 1280×720 full`,
   `prefabPreview: "src/prefabs.ts"` and three `prefabChecks`; `public/index.html` holds only
   `<main id="game">` and the two engine markers. Sync the module in:
   `node zhuda-engine-prefabs/scripts/sync.mjs <game dir> 2d/ashfall-duel` from a checkout of this repository,
   or from the game `node node_modules/zhuda-engine-prefabs/scripts/sync.mjs . 2d/ashfall-duel`.
   `src/Main.ts` makes two calls, `mountCourtPage({ replace })` → `startAshfallDuel(host)`, chained
   with `.then()`: **no top-level await**. `src/prefabs.ts` is one line that re-exports
   `definitions` and `createAssetProvider`. Check: `npm run verify` (build, types, Doctor).
3. **Prefab comparison.** Put the reference pictures in `references/` (for the same art use
   `zhuda-engine-prefabs/2d/ashfall-duel/source/references/`) and run `npx zhuda-laya-accept` first: the whole
   scene with `maxDiffPixels: 1000` (SwiftShader on the Mac and on Windows differ by 338 pixels, by
   at most 11/255 at any pixel), the knight and the warden at 0, and the warden unloaded and loaded
   30 times in a row. On 2026-11-25 the library version gave 338 / 0 / 0, and its three screenshots
   were byte for byte those of the original game.
4. **Fixed time.** Combat advances only inside `ZhudaSimulationClock(1/120, 16)`, with time taken
   from the runtime's `duel` layer (`layers.defineLayer("duel")`, `scaledDeltas.get("duel")`);
   while paused nothing advances and nothing is redrawn (unless the window changes size). The
   runtime gives one frame at most 0.1 s, so a frame is at most 12 steps. Moves are frame data for
   the engine's `ZhudaActionStateMachine` (at 60 fps: light slash 30 frames, active 7–19; charged
   slash 48 frames, 13–32; gauntlet 72 frames, 39–49; backstep 30 frames, 3–20; the last 30% of a
   recovery can go into the next slash, and from the last active frame on a move can go into a
   backstep). Input goes into a `ZhudaInputBuffer` (0.32 s, 2 entries).
5. **Footwork by the distance really travelled.** `Footwork.move(target speed)` works out how far
   this step wants to go; after the arena's edges or a move's impulse have changed the position,
   only the part that is "in the same direction, and no more than was wanted" goes to `travel()`.
   Only then does the step cycle not turn on the spot and the feet not pass through the ground. A
   boot that has just landed makes the footfall sound and the dust. The knight walks 215 px/s (78
   while charging), the warden 109; the arena's left edge is 137, its right edge 1154, and the two
   stay at least 201 apart.
6. **The sword.** The sword is 306 long, in 24 segments along the drawn blade. It bends as a
   cantilever (straight at the grip, the tip lagging by `bend·u²(1.5−0.5u)`); the load comes from
   angular acceleration (±13), with spring 1400, damping 43 and a limit of ±35. **Standing,
   walking, charging and in startup the sword is straight** (`trackStraight`); it takes load only
   in the active frames, before it has hit, while sweeping forward. The hit: the blade's polyline
   is intersected with a 19×22 ellipse in front of the breastplate (between two sample points
   too). After a hit the sword is "planted" on the dented surface (`plantBlade`, compression
   `13 + 23 × force`) and let go in the recovery, at 0.55–0.73, or when it has moved 18 px away.
   Where the player clicks sets the height aimed at (−1 helmet, 0 breastplate, 1 waist plate; it
   counts only within 150 px of the warden).
7. **Hit feedback.** Damage `16 + 20 × force`; hit stop `0.043 + 0.052 × force` seconds; a dent of
   `8 + 12 × force` px (spring −560x − 15v), the breastplate's mesh pushed in inside a 55×29
   ellipse at the contact point; dust and chips of armour come from the same contact point (an LCG
   with a fixed seed, at most 330 particles); screen shake `2.2 + 3.1 × force`.
8. **Framing.** Landscape: the whole 1280×720 fitted in at its own proportions. Portrait: the
   width is the distance between the two plus 308 (clamped to 630–1280), following the midpoint
   between them, with the ground at `min(0.75 × height, height − 115)`; the backdrop separately
   fills the screen and follows with only 35% parallax. A screen point becomes a world point
   through the scale and offset of the scene's root node (`worldAt`).
9. **Controls.** Held actions use `input/hold-input`: the move pad, the attack button, the dodge
   button and the battlefield itself each belong to one finger or one key, from press to release;
   `clear()` drops them silently on pause, when the device is turned (`orientation` changes), when
   the desktop window loses focus and when the page is hidden. The buttons along the top and the
   start button use `press()` from `ui/dom` (a phone sends no click while another finger is held
   down). Pause, help and the result screen use `ui/game-menu`; the sound settings use
   `ui/settings-form` with `systems/storage` (`ashfall-duel.sound`).
10. **Sound.** One `IframeSoundAdapter` (14 voices, first in first out when full); on the first
    input, `unlockAudio` and load the four WAVs (through the same provider); the title demo makes
    no sound.
11. **Other characters or another place.** `2d/cel-motion` is shared; `2d/ashfall-duel` is this
    game itself (the knight's and the warden's joint tables, the warden's AI, the interface text):
    do not change it, or a copy of it. A new pair of characters becomes a new module `2d/<name>`:
    start from `combat.ts`, `render.ts` and `motion.ts` and change the data (joint tables,
    proportions, move timetables, the breastplate's surface), make the atlas and the in-betweens
    by [pose-atlas-motion](pose-atlas-motion.md), and shoot its own prefab references and
    `preview/`.
12. **Release (ask the owner first).** Route B of the owner's `zhuda-windows` agent skill (not in
    this repository): copy `dist/game.zip` to the Windows host, unpack it outside the site's
    folder, and run `scripts/publish.py <id> <folder> --title "<name>"`. After the release, run
    `check-controls.mjs` again against the public address and keep a record in the format of
    `zhuda-engine-prefabs/2d/ashfall-duel/source/release-records/public-release-20261125.json`.

## Pitfalls

Commit ids below are in the original game's history (the git bundle).

- **The light slash was too slow.** At the opening distance a light slash took 333.3 ms from
  letting go to contact, and felt sluggish. → The light slash was given a shorter arc, another
  timetable at close range, and a start from where the wrist is at that moment: 241.7 ms (measured
  at 120 Hz; `251a602`).
- **The blade bent early.** The sword was already bending while walking, charging and in startup.
  → At those times `trackStraight` follows the angle and the bend goes to zero; the blade takes
  load only in the active frames, sweeping forward, before it has hit (`a3f65f9`). The test "walk,
  charge and startup keep steel straight" guards it.
- **With two thumbs held down, a third finger on pause did nothing.** A phone does not turn a
  touch into a click while another finger is down. → Buttons take `pointerdown` directly through
  `press()` (`ca53724`); check 6 of the touch script guards it, and fails on the version before
  the change.
- **Frames jittered.** With one origin shared by all key poses, the figure jumps when the pose
  changes. → Every key pose has its own measured sole origin.
- **A move's impulse or the arena's edge made the walking feet turn past the ground.** → Give the
  footwork only the part "in the same direction, and no more than the distance wanted"
  (`walked()`).
- **The whole-scene comparison is not 0 on the Mac.** SwiftShader on the Mac and on Windows differ
  by 338 pixels over the whole scene (each ≤ 11/255). → The whole scene has `maxDiffPixels: 1000`;
  the knight and the warden compared alone are 0 on both and stay at 0; the reference pictures
  were not shot again.
- **The ZIP release entry does not accept `.lh`.** `ssh_publish.py` answers 422 `file_type`. → Use
  `publish.py` (route B).
- **The first `npm run build` of a new project fails, saying `evidence/courtyard.json` is
  missing.** A release build with `prefabChecks` set reads the comparison results. → Run
  `npx zhuda-laya-accept` first (it uses a candidate build and does not need those files); after
  that `npm run build` passes.
- **Top-level await in the entry fails the build.** The engine bundles the entry as an ES2020
  script ("Top-level await is not available"). → `.then()`, or wrap it in an async function.
- **While taking it into the library:** a JSON import (`motion-cels.json`) is treated by sync as
  an asset and put in `public/` → it became `motion-cels.ts`; the library has
  `erasableSyntaxOnly` on, so constructor parameter properties had to become ordinary fields; the
  library's DOM types have no NodeList iterator → `Array.from()`. None of the three changes
  behaviour (the state is the same over 240,000 steps).
- **The static server's MIME types.** An SVG sent as `application/octet-stream` is not drawn by
  `<img>` (the co-branding mark on the title disappears). → Both `zhuda-engine-prefabs/viewer2d/tools/serve.mjs`
  and `zhuda-engine-prefabs/tools/detplay.mjs` need `.svg` (and, while there, `.webp`, `.wav`, `.lh`).
- **The viewer's own background style also applied to the new `#game`.** → The preset adds one
  rule, `#theatre>#game{background:none}`; after that it is pixel for pixel the same as the
  original game.
- **Comparing pixels alone misses things.** While another 2D game was being taken apart on
  2026-11-25, the old `detplay.mjs` turned out to return a `Date.now()` with a fraction, which made
  that game's save check (`Number.isSafeInteger`) fail on both sides together while the
  screenshots differed by 0. → Run again with the version that gives whole milliseconds, and for
  every screenshot also compare the scene's frame count and the page's state (`states.py`: mode,
  health, stamina, the warden's health, menu, result text). Ashfall Duel's own code reads no
  `Date`, timer or random number: pictures and state were the same before and after the re-run.
- **The original game itself sometimes draws its bars another way.** Over 11 runs on the virtual
  clock, in 3 the three HTML bars (`.meter i`, `transform: scaleX()`) of the four views charge,
  heavy blow, backstep and walk differed by 121–2,083 pixels, 1/255 each, with the canvas the same;
  the viewer did the same in 1 run of 11. → Run the original game at least two or three times and
  note how many ways it draws itself; each picture of the new version need only be byte for byte
  the same as one of them, and the differences must be confirmed to lie only in the bars
  (`variants.py` prints the box of the difference).

## Engine gaps and their workarounds

| Gap | Workaround |
| --- | --- |
| No character animation by "key-pose atlas plus in-betweens" (the engine's 2D characters are Spine) | `zhuda-engine-prefabs/2d/cel-motion`: `PoseTrack` and `CelSprite` (every frame draws a 16×20 deforming mesh with `graphics.drawTriangles`) |
| No hit test along an arbitrary polyline, no weapon that bends as a cantilever | The game's own `motion.ts` (`intersectsPlate`, `plantBlade`, `FlexibleBlade`) |
| The engine's opening screen (the LayaAir mark) is a CSS animation in real time, and goes only after a `setTimeout` of 2.18 s and the page's load | Screenshots and comparisons wait for it to finish (`ready` is true only once the opening has left and 10 frames have run); on a virtual clock use `NOTRANSITIONS=1` and shoot 0.5 s or more after the hook appears **After 2.0.0:** it still runs on real time, but `whenZhudaSplashGone()` says when it has gone, so a script waits for that and not for a fixed time. |
| The engine's headless comparison has no clock entry for a game without a hook | `PRELOAD=` of `detplay.mjs`: it loads `zhuda-engine-prefabs/2d/ashfall-duel/source/proof/original-hook.js`, which, when `#theatre` leaves `loading` (before the first frame), attaches a `__SCENE__` that reads its values from the DOM |

## Checks

The commands are written for this repository's `zhuda-engine-prefabs/`; the results are those of 2026-11-25,
from before the library moved into this repository.

```sh
cd prefabs && npm run verify        # includes tests/ashfall-duel.test.mjs (15 tests), cel-motion (3), ashfall-page (1)
cd viewer2d && node ../scripts/sync.mjs . && npm run verify                          # sync check, build, types, Doctor, tests
OUT=/tmp/v node tools/play.mjs scenarios/ashfall-duel.json "scene=ashfall-duel"       # one picture per view; read rendererErrors, pageErrors
# a new project (the library-game template): npm run verify; npx zhuda-laya-accept (338 / 0 / 0)
# touch, keyboard and mouse: after node tools/serve.mjs 8957
ASHFALL_VIDEO=0 ASHFALL_PLAYWRIGHT=<playwright-core> CHROME_BIN=<Chrome> node ../2d/ashfall-duel/source/tools/check-controls.mjs "http://127.0.0.1:8957/index.html?scene=ashfall-duel" /tmp/controls
```

Results on 2026-11-25: the library's 105 tests and the viewer's verify all passed; the 12 touch,
keyboard and mouse checks passed, with the position and size of the buttons in portrait and in
landscape exactly those of the original game's record; prefab comparison 338 / 0 / 0; the
pixel-for-pixel comparison with the original game is in the verification section (「驗證」) of
`zhuda-engine-prefabs/2d/ashfall-duel/README.md`.

## Not checked

- Real phones (iOS, Android): only Chrome's touch emulation; frame time on a phone was not
  measured.
- WebGPU: only WebGL was built (the default `renderer`).
- Sound was verified only to load and play without errors; nobody has listened to it.
- The interface is in Traditional Chinese only; `systems/i18n` is not connected.
- A new project made from the library has never been released; what is on the public site is
  `ca53724`, built from the original project.
- A new pair of characters as a new module: never done. Step 11 is the method, not a verified
  result.
- A recording of a duel (Playwright's ffmpeg is not on that Mac).

## Boundaries

- The game (or a `2d/<name>` game module): the character pictures, joint tables, move timetables,
  the warden's AI, the numbers, the interface's text and layout, sound, release settings and
  records.
- The prefab library (`zhuda-engine-prefabs/`): `2d/cel-motion` (motion and drawing for any side-view
  character), `input/hold-input`, `ui/game-menu`, `ui/settings-form`, `ui/dom`, `systems/storage`;
  and `2d/ashfall-duel`, the game itself as taken apart.
- The engine: the action frame state machine, the input buffer, the fixed clock and time layers,
  prefabs and their comparison, sound, build and Doctor. The hit test, the cantilever sword and
  the atlas mesh deformation are for now in the game and the library; when the engine takes them
  on, move them from here.
