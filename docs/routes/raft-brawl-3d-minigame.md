# Route: Four pigs fighting on a raft, a landscape 3D mini game for WeChat

A landscape 3D WeChat mini game (重生之我在海上当猪大): the player and three computer pigs stand on
a raft of 25 tiles at sea. Every blow raises a pig's damage and throws it further, a shark takes
edge tiles, whoever falls in is out and the last one standing wins. A thumb stick on the left, a
camera drag on the right, two buttons. The rules are pure, seeded and tested in Node, the
fighting comes from a shared prefab module. The game's records show eight rule tests passing and
the title screen on an iPhone in WeChat; no match on the phone, no picture of the brawl. Nothing
was run again to write this page.

- **Id:** `raft-brawl-3d-minigame`
- **Kind:** workflow
- **For:** a landscape 3D mini game for WeChat where several characters knock each other off a shrinking raft of tiles: seeded pure rules with bots, combat from a shared prefab module, one slimmed skinned model in a subpackage, a 4 MB main package
- **Checked on:** Node (rule tests); an iPhone in WeChat (mini-game host, WebGL; iPhone 14 in the game's earlier entries): subpackage load and title screen only; no browser run of the brawl recorded
- **Status:** recorded in the game's HANDOFF on 2026-11-19: 8 rule tests pass, 40 bot matches were
  run for balance, the model subpackage loaded on the iPhone and the title ran at 41–54 fps. Not
  recorded: a match played on the phone (remote taps did not land in landscape), the frame rate
  in a match after the performance changes (22 fps before them), any scripted browser run or
  screenshot of the brawl. Nothing is committed (draft)
- **Reference consumer:** ZhudaGameCenter `games/zhuda-raft-survival` (outside this repository; the workspace is not under version control)
- **Engine version:** zhuda-laya-engine 1.18.0 pinned at `a5dfc6b12595e2668af63255bd96c45f8f9caa33`. Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 8 of 8 with Doctor HEALTHY; main package 3,199,416 to 3,283,566 bytes, the subpackage unchanged; a match played in headless Chrome with 0 errors; no run in a host

## When to take this route

A small arena fight in 3D for a mini-game host: a few skinned characters, an arena of tiles that
can be taken away, a ring-out instead of a health bar, computer opponents, a 4 MB main package.
Take [new-game-project](new-game-project.md), [mini-game-build](mini-game-build.md) and
[game-rules-first](game-rules-first.md) first; a larger game on the same host files and helper
is [action-adventure-3d-minigame](action-adventure-3d-minigame.md).

Not this route: a 2D fight ([platform-fighter-2d](platform-fighter-2d.md),
[side-view-duel](side-view-duel.md)); one large monster ([hunting-action-3d](hunting-action-3d.md));
play between phones ([online-lockstep-match](online-lockstep-match.md)); landscape in a phone
browser ([mobile-always-landscape](mobile-always-landscape.md)).

The folder first held a portrait survival game (2026-11-18: a hook, building, hunger and thirst,
seven days). What survives of it in the code: the mini-game setup, the asset provider, the
polyfills, the host bridge, the look and water settings, the particles, and its debris, shark
and island as scenery. Its rules, tests and play script were removed without a commit (commit
before changing genre) and cannot be followed; every screenshot in `evidence/` is of that game.

## Tools

- Engine pin above; Node 24 or later (exact version not recorded); TypeScript 5.9.3; the LayaAir
  3.4.2 command line behind the build ([mini-game packaging](../minigame-packaging.md)).
- `zhuda-engine-prefabs/systems/pig-combat` (library 0.4.0 in `common-prefabs.lock.json`). It and the model
  come from the game of [third-person-town-3d](third-person-town-3d.md); how the model was made
  and its licence are not recorded here.
- `@gltf-transform/core`, `extensions`, `functions` ^4.1.1, `meshoptimizer` ^0.22.0, `sharp`
  ^0.34.4 for `tools/slim-model.mjs`; the engine's Chrome fixture for `tools/shot.mjs`.
- The WeChat developer tools (version not recorded), a WeChat mini-game account for the app id,
  and the owner's `wxgame` helper (a workstation skill outside this repository): `lower`,
  `subpack`, `check-pkg`, `preview`.

## Steps

1. **Template, config, boot.** `zhuda-laya-init <dir> --template minigame`. `zhuda.config.json`:
   `renderer: "webgl"`, `features` `core, 3d, gltf, postProcess`, `branding.mode: "none"`,
   `viewport` 1334×750 `fixedheight`, the app id under `minigame.targets.wxgame`.
   `ZhudaEngine.boot` takes the same size with `dprCap: 2`. `tsconfig.json` sets
   `allowImportingTsExtensions`: the rules import the shared module as `.ts`, so Node runs them.
2. **Host files before anything else.** First line of `src/Main.ts` is `import './polyfills'`
   (`TextDecoder`, `structuredClone`). `src/assets.ts` (34 lines) is the `AssetProvider`
   ([asset loading](../asset-loading.md)): `wx.getFileSystemManager().readFile` in WeChat,
   `fetch` in a browser; it goes to `new ZhudaModelLibrary({ provider, timeoutMs: 60_000 })`.
3. **Take the fighting from the prefab library.**
   `node node_modules/zhuda-engine-prefabs/scripts/sync.mjs . systems/pig-combat` copies
   `jobs.ts` and `targets.ts` to `src/common/systems/pig-combat/`. Used here: `JOBS` (three
   callings, each a round of five attacks and a skill), `newCombat`, `pressAttack`, `pressSkill`,
   `stepCombat`, `current`; `REACH`, `struck`, `aimAt`, `aimRange`, `landAhead`, `SHATTER`.
4. **The match as data: `src/brawl.ts`** (449 lines, no engine import). `createBrawl(job, seed)`:
   a 5×5 grid of 1.2 m tiles, four pigs 1.8 m from the middle facing it, the three bots one of
   each calling in an order shuffled by `rand(state)`. `setIntent(state, id, intent)` (move,
   attack, skill) is the only input. `stepBrawl(state, dt)` clamps `dt` to 0.1 s and returns
   events (`attack`, `land`, `hit`, `refused`, `fall`, `out`, `warn`, `tileLost`, `won`). In a
   step: a 3 s countdown; per pig, bot thinking, presses (turning to the nearest foe with
   `aimAt`, arc 220°), `stepCombat`, feet, pushes; pigs pushed apart (radius 0.35 m); delayed
   strikes; the shark; who is off the raft falls for 0.9 s and is out; one left wins.
5. **Feet never leave the raft, pushes do.** `walkOn` tries the move, then each axis alone, with
   a 0.1 m margin; walking is 3 m/s (0.45 of it during an attack). A strike adds
   `force × FORCE_SCALE[effect] × 1.4 × (1 + damage / 120)` m/s (×1.3 when frozen), which decays
   at 3.5 per second. Damage is 0.35 of the prefab's number, a freeze half its length. The
   long reaches are scaled down (`crescent` 0.55, `chop` 0.7), single charms up (1.3 to 1.6).
6. **The shark shrinks the arena.** First 21 s after the countdown, then every
   `max(4, 11 − time / 20)` s plus up to 3 s. It picks a random edge tile (one missing a
   neighbour, never the middle), the tile flashes for 2.4 s (`warn`), then goes (`tileLost`).
7. **Bots** (`think`, every 0.2–0.45 s): leave a doomed tile or the edge for the raft's middle;
   keep a target unless another is 2 m nearer; use the skill in range (ninja 7 m, Taoist 5 m,
   boxer 2.4 m) with chance 0.7 or 0.45; in reach, strike with chance 0.4, else sidestep; else
   close in. One bot starts on the player, two on each other. Recorded over 40 bot matches:
   median about 35 s; wins boxer 20, ninja 15, Taoist 5.
8. **Tests: `tests/brawl.test.ts`**, 8, under `node --test`: same seed same match
   (`assert.deepEqual`); one of each calling; four bots end with places 1 to 4 (three seeds);
   walking never leaves the raft; more damage throws further; the shark warns, takes a tile and
   the pig on it places last; revive; nobody moves in the countdown.
9. **One slimmed model, four times.** `tools/slim-model.mjs <in> <out>` with `--keep <clips>`,
   `--drop-materials <names>` and `RATIO=0.2 ERROR=0.008`: `weld`, `simplify` (meshoptimizer),
   `resample`, `dedup`, `prune`, textures to 512 JPEG, no normal map or tangents. Recorded:
   0.93 MB and 12k triangles out (the source is 3.97 MB), lantern and pole removed. Each pig is
   `models.instantiate('models/zhuda-fighter.glb', { independentMaterials: true })`, so a frozen
   one is tinted alone. `src/animated.ts` plays the 17 clips through `ZhudaAnimationBlend`
   ([animation control](../animation-control.md)); an attack's clip is sped to last the
   `seconds` its `attack` event gives.
10. **Sea, light, camera** ([quality route](../quality-route.md), water in
    [film scenes](../film-scenes.md)). `ZhudaSceneLook`: preset `day`, sun azimuth 150° elevation
    42°, shadows 22 m at 1024 with one cascade, exposure 1.0, bloom 0.25, ao 0.4, start quality 1.
    `ZhudaWaterSurface`: 260 m square, flow `[0, 0.12]`, color `[0.02, 0.36, 0.5]`, clarity 0.6,
    `waveMeters` 1.8, waves 0.2, reflection 0.7, glow 1.1, `foamDepth` 0.16, resolution 512. Each
    frame `setRipples` (raft: radius 3.4, strength 0.4; shark: 0.5, and 0.8 or 1.4), `update`,
    `setTime`, and `render()` every frame at quality 2, every second at 1, every third at 0.
    `ZhudaQualityGovernor({ budgetMs: 1000 / 50 })` feeds `look.setQuality`. No `lightFog`.
    `ZhudaCameraRig` ([3D integration](../3d-integration.md)): `orbit`, fov 52, pitch 0.36,
    distance 6.4, target eased to 1 m above the player's pig.
11. **Everything else from primitives: `src/view3d.ts`.** A tile is a plank box on two logs and
    swaps to a red material when doomed; a ring in each pig's colour, headgear per calling on
    the `head` bone, shark, island, drifting junk. `syncTiles` and `syncPigs` in `src/Main.ts`
    copy state to nodes: removed tiles sink for 1.4 s, a falling pig splashes once. `src/fx.ts`
    holds 11 emitters on `ZhudaParticleSystem3D`, sprites painted in code; `onEvents` maps each
    event to a burst, a sound, a shake or a vibration.
12. **Touch.** `ZhudaPointerInput` is refused in a mini game: `Laya.stage` `MOUSE_DOWN`, `MOVE`,
    `UP` with `e.stageX`, `e.stageY`, `e.touchId`; `hud.tap` first. A press on the left 45%
    (below y 130) is the stick: full tilt at 80 px, dead zone 0.15, the base follows past 110 px.
    Any other press drags the camera (`rig.rotate(dx, dy × 0.7)`). `steer` turns the stick by
    the rig's yaw before `setIntent`. Keys (WASD, J, K) serve the desktop.
13. **HUD: `src/hud.ts`**, Laya sprites at design height 750. `safeArea` in `src/platform.ts`
    converts `wx.getSystemInfoSync().safeArea` and the capsule button's rectangle to design
    pixels; cards (calling, damage %) sit between notch and capsule and are redrawn only when
    their text changes. 攻击 (radius 92) and 技能 (66) bottom right. Names over heads come from
    `camera.worldToViewportPoint` (`screenOf`). Title: pick a calling; the health advice text.
14. **Host bridge: `src/platform.ts`.** Best place and calling in `wx` storage or
    `localStorage`; share menu; vibration; a rewarded video for `revivePlayer` (once, button
    only when an ad has loaded, reward only when watched to the end); an interstitial at most
    every third round and 60 s. Sound: `Laya.SoundManager` in `src/sound.ts` ([audio](../audio.md)).
15. **Package.** `npm run build:minigame -- --platform wxgame`, then on
    `dist/minigames/wxgame/game`: `wxgame lower <dir> --appid <appid> --name <name>` with
    `--orientation landscape` (ES2017), `wxgame subpack <dir> assets/models --name models`, the
    helper's `check-pkg`. `loadSubpackage('models')` runs before `instantiate`. Recorded: main
    3.05 MB, subpackage 0.93 MB. The engine gate is 8 MB (`maxMainPackageBytes`).
16. **Hooks for a script.** `window.__RAFT__` has `ready`, `error`, `phase` and an `api`: `start`,
    `state`, `fast(seconds)`, `move`, `look`, `attack`, `skill`, `tap`. `?quality=0..2` pins the look.

## Pitfalls

- **22 fps in a match on the iPhone**, against 41–54 on the title. Changed since, not measured:
  the 12k-triangle model, HUD text drawn only on change, the water mirror every third frame.
- **No model, then a blank screen, on the iPhone only.** WeChat on iOS has no `TextDecoder`
  (the GLB JSON chunk) and no `structuredClone` (the engine copies look and water options with
  it). `src/polyfills.ts` installs both when missing.
- **The main package ran out.** The landscape build was 3.74 MB with a 0.54 MB pig; the 0.93 MB
  fighter went to a subpackage. The engine's gate sees the whole output, so it was raised to
  8 MB and the real 4 MB check became the helper's.
- **Numbers tuned for a town were too strong on a raft 6 m wide.** Hence `FORCE_SCALE`,
  `DAMAGE_SCALE` and `FREEZE_SCALE` in `src/brawl.ts`; a full freeze was a free knock-out.
- **Short taps missed, as if a long press were needed.** `stage.mouseX` can hold the previous
  position during a short tap. Use the event's `stageX`, `stageY`.
- **The whole sea grey at quality 1 and 2** with `lightFog` and a camera above water
  (`evidence/q-compare.png`, from the earlier game). Leave `lightFog` off.
- **Remote taps did not land in landscape**, so nobody has played a match on a phone.
- **Left in:** `SHOW_FPS`, boot `log` lines, startup error text, the old title in `index.html`.

## Engine gaps and their workarounds

As met at the pinned commit; no engine plan item is known unless one is named.

- No asset provider for a mini-game host (`DirectoryAssetProvider` is refused): `src/assets.ts`.
- No `TextDecoder` or `structuredClone` fallback for WeChat on iOS: `src/polyfills.ts`.
- `zhuda-laya-minigame` has no subpackage cut, orientation or ES2017 lowering, and one size
  number for the whole output: the owner's `wxgame` helper; gate at 8 MB.
- `lightFog` greys water seen from above at quality 1 and 2; cause not found: left off.
- No host bridge (storage, safe area, ads, share, vibration): `src/platform.ts`.
- The Chrome fixture had no public entry: closed in 2.0.0 as
  `zhuda-laya-engine/compiler/chrome-host` ([consumer tooling](../consumer-tooling.md)); the
  game's `tools/shot.mjs` still imports it by path until it is upgraded.

## Checks

All from the game's HANDOFF of 2026-11-19 unless dated otherwise; none repeated here.

- `node --test`: `tests/brawl.test.ts`, 8 tests pass. `npm run verify` (build, `tsc --noEmit`,
  Doctor, tests) is not recorded as run.
- 40 bot matches: median about 35 s; wins 20, 15, 5 (the script is not in the folder).
  Package: main 3.05 MB, subpackage 0.93 MB.
- iPhone in WeChat: the subpackage loads; title 41–54 fps. Just before the brawl, the landscape
  scene with one pig: capsule and notch clear, 40–57 fps at quality 0.
- `evidence/` (all 2026-11-18, the earlier portrait game): `q-compare.png` shows the look's
  levels and the fog fault, `play-3/` the engine water and shadows. No file shows the brawl.

## Not checked

- Anything at engine 2.0.0; anything by the writer of this page.
- A match on a phone: stick, camera drag, buttons, revive video, interstitial, share, sound.
- Frame rate in a match after the changes; Android; any other host; the developer tools' version.
- Any browser run of the brawl: no play script exists, and `tools/shot.mjs` is not recorded
  against it. Whether `npm run verify` and the Doctor pass today (`node_modules` is absent).
- Balance by a person: the Taoist won 5 of 40 bot matches and nothing was retuned.
- Release: no upload or review is recorded, and the name change in the WeChat backend waits on
  the owner; see the owner's portals (`PORTALS.md` in the workspace). Online play.

## Boundaries

The game owns `src/brawl.ts` and its numbers, the bots, the HUD and its text, the props from
code, the slimmed model, app id, ad units and advice text. The prefab library owns
`zhuda-engine-prefabs/systems/pig-combat`: change it there and sync, never in `src/common/`. The engine owns
the look, the water, the governor, the camera rig, the model library, clip blending, particles
and the mini-game build; the files named under Engine gaps are game code until it takes them.
