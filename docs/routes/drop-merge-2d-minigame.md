# Route: a drop-and-merge bowl game as a WeChat mini game

A portrait 2D game: hold and slide to aim, let go, and a piece falls into a bowl. Pieces are circles
that roll and stack; two of the same tier that touch become one of the next, through ten tiers, until
the stack stays above a line. One code base builds two skins (a Chinese one, 猪大合一合, and an English
one, Moo Merge, with another character and item chain) as `wxgame` packages under 4 MB and as a web
build. Touch or mouse. The game's records show headless Chrome at phone sizes and the WeChat developer
tools' command line; they show no play in those tools and none on a phone.

- **Id:** `drop-merge-2d-minigame`
- **Kind:** workflow
- **For:** Building a portrait 2D mini game where pieces dropped into a container fall, roll and stack as circles and two of a kind merge into the next tier, packaged for WeChat from one code base with several skins.
- **Checked on:** desktop headless Chrome at phone viewport sizes (390×844 at DPR 2 and four others),
  WebGL, GPU or software not recorded; WeChat developer tools command line for preview code and
  upload only; no run in a host recorded; no phone
- **Status:** recorded in the game's HANDOFF on 2026-11-18: `npm run verify` passed (build, types,
  Doctor HEALTHY, five physics tests), a scripted play-through in headless Chrome ended without
  errors, and `wxgame` packages were uploaded as development versions 1.0.0 and 1.0.1; nobody is
  recorded playing it in the developer tools or on a phone, and nothing was submitted for review.
- **Reference consumer:** ZhudaGameCenter `games/zhuda-hehele` (outside this repository; the workspace is not under version control)
- **Engine version:** zhuda-laya-engine 1.18.0 at commit `a5dfc6b12595e2668af63255bd96c45f8f9caa33` (the pin in the game's `package.json`). Moved to 2.0.0 (`91d21f79`) on 2026-11-26: `npm run verify` 5 of 5 with Doctor HEALTHY, `npm run build:wx` ok (the wxgame folder 4,152 KB to 4,260 KB); no run in a host

## When to take this route

- After [new-game-project](new-game-project.md), [game-rules-first](game-rules-first.md) and
  [mini-game-build](mini-game-build.md): this page adds only what this kind of game needs.
- A board that is a container of loose round pieces under gravity, merged by contact; short rounds,
  one finger, a score and a best score; a WeChat mini game, the same build also on the web.
- Several variants of one game (character, item chain, language, ad units, account) where a package
  must not contain another variant's art or text.
- Not a grid the player rearranges by dragging, with orders, energy and levels: that is
  [merge-2d](merge-2d.md). Here are no cells, no economy and no saved board: only a physics world.
- Not for bodies that are not circles, joints, or hundreds of bodies (every pair is tested). Only
  `wxgame` was built. For a browser-only phone page: [mobile-web-fullscreen](mobile-web-fullscreen.md).

## Tools

- Engine pinned as in the header; `features: ["core","2d"]`, `renderer: "webgl"`, `branding.mode:
  "none"` ([branding](../white-label-themes.md)); `zhuda-laya-build`, `zhuda-laya-doctor`,
  `zhuda-laya-minigame` ([mini-game packaging](../minigame-packaging.md)); LayaAir command line 3.4.2.
- Node 24 or newer (`node --test` runs `tests/*.test.ts` as they are); TypeScript 5.9.3; esbuild
  0.27.1, not declared by the game: it arrives through the engine's dependencies.
- WeChat developer tools command line (version not recorded); the owner opens its port and logs in.
- Pictures: the owner's image generation command (tool 1.5.0, model `gpt-image-2.6-flare`, per the
  `.json` beside each raw picture); prompts in `prompts/gen_*.sh`, which name the generator and the
  character sheets by paths on the owner's machine and do not run elsewhere. Pillow for
  `tools/process_*.py`. Sound: `tools/make_sfx.py` (numpy, ffmpeg) for every effect; music from a
  local rule-based generator ("instrument-music") and the one line in `prompts/bgm.txt`.
- No licence note for generated art or music is in the game; `store/itch/spec.json` has the owner's
  AI disclosure. Raw art (66 MB, `art/`) stays in the game; only `skins/` is packaged.

## Steps

1. **Project.** As [new-game-project](new-game-project.md). `zhuda.config.json`: `viewport` 750×1334
   `fixedwidth`, `minigame.maxMainPackageBytes: 4194304` (WeChat's main-package limit), the `appid`.
2. **Tier table** (`src/tiers.ts`). Radii in design pixels at width 750: 26, 35, 45, 56, 68, 82, 97,
   113, 131, 150 (the bowl is 682 wide). Points `(i+1)(i+2)/2`. Only the five smallest are dropped,
   weights 30, 27, 20, 14, 9 (`pickDropTier(random)`, tested). Names and colours come from the skin.
3. **Circle physics and merging with no engine import** (`src/physics.ts`, 195 lines): `World(bounds,
   radii, points)`, `add`, `step(dt)` returning merge events, `highestSettledTop(grace)`. Gravity
   2200 px/s²; `dt` capped at 1/20 s, 6 substeps of 3 collision passes; restitution 0.12, friction
   0.04, velocity × 0.998 per substep, mass as r². Two overlapping bodies of one tier die and one of
   the next appears at their midpoint; two of the top tier vanish for twice the top points. Check:
   `tests/physics.test.ts`: rests on the floor inside the walls; two alike merge with the next tier's
   points; two top-tier vanish; a mixed stack of 12 settles at least 0.9 of the summed radii apart.
4. **Boot and layout** (`src/Main.ts`). `ZhudaEngine.boot` with `designSize` 750×1334, `scaleMode:
   'fixedwidth'`, `dprCap: 2` ([runtime sizing](../platform-adapters.md#runtime-sizing-drivers-and-recovery-170)).
   On `Laya.Event.RESIZE`: fixed width when the screen is at least as tall as the design, otherwise
   the game sets `Laya.stage.scaleMode` to show-all, centred. Then `H = max(1334, stage.height)`,
   floor `H − 142` (bodies move with it), lose line `max(inset + 420, floor − 900)` (step 7's inset). The
   engine's layout helpers ([layout](../layout-and-media.md)) are not used. Check: `tools/viewports.mjs`.
5. **Draw.** A `world2d` sprite that shakes (bowl, pieces, character, effects) under HUD and panel
   layers. One `Laya.Sprite` per body with a rotating child, `graphics.drawTexture` at radius × 1.03;
   pop-in over 0.28 s, a squash spring fed by impacts above 380 px/s; `src/fx.ts` (crumbs, ring,
   score, shake); `src/zhuda.ts` (seven aligned frames as clips). Frame: `context.runtime.start`.
6. **Input and round rules.** Stage `MOUSE_DOWN`, `MOUSE_MOVE`, `MOUSE_UP` with `stage.mouseX/Y` in
   design units: hold and slide aims, release drops (`vy` 160), then a 0.5 s cooldown; buttons are
   rectangles tested in the same handlers. Losing: a body older than 1.6 s and slower than 260 px/s
   above the line fills a timer; 2.4 s ends the round. A merge within 1.1 s of the last adds `combo × 2`.
7. **Host bridge** (`src/platform.ts`, 146 lines). `isWeChat` is "`wx.getSystemInfoSync` exists";
   every call sits in `try`, with a browser fallback where one makes sense. Save:
   `wx.getStorageSync` / `setStorageSync`, else `localStorage`, numbers only (best score, highest
   tier made, tutorial seen, mute). Vibration: `wx.vibrateShort` on merges from the sixth tier up
   and at the end of a round. Top inset: `wx.getMenuButtonBoundingClientRect().bottom + 8` in design
   pixels, clear of the capsule button. Share: `wx.showShareMenu`, `onShareAppMessage`,
   `onShareTimeline`, a button on the result card only in WeChat, no reward for sharing. Ads: unit
   ids from the skin (empty: no ads, no button); rewarded video only from a button that says it
   plays a video and shows once an ad has loaded, the reward (clear the upper 45% of the bowl, once
   a round) only when `onClose` reports `isEnded`; interstitial only at the end of a round, every
   third round, 60 s apart, not in the first 30 s.
8. **Sound** (`src/sound.ts`). `Laya.SoundManager.playSound` and `playMusic(url, 0)` at `musicVolume`
   0.45, started on the first button release; the engine's audio authority ([audio](../audio.md)) is
   not used. Effects (`drop`, `pop01` to `pop10` rising with the tier, `big`, `over`, `click`): mono
   MP3, 64 kbit/s, about 40 KB for 14 files. Music: 16 bars at 112 BPM, 34.286 s cut to loop, 240 KB.
9. **Art.** One base pose per character, then each expression as an edit of that picture ("keep
   everything identical, only change the face"); all frames through one crop box (the union of their
   alpha boxes), bottom-aligned, 420 px, 256 colours, so they swap without a jump. Pieces: a round
   silhouette filling about 92% of a square, cropped to the alpha box plus 2%, radius × 3.2 px (96 to 320).
10. **Skins.** `src/skin.ts` defines `Skin` (id, title, ten names, ten colours, `healthAdvice`, `ads`,
    strings `t`); `src/skins/<id>.ts` fills it; `skins/<id>/assets/` holds the same 19 file names
    (about 0.5 MB); `skins/common/sfx/` is shared. `npm run skin:<id>` (`tools/use-skin.mjs`) writes
    `src/skin-current.ts`, a one-line re-export so only that skin is bundled, replaces `public/assets`
    and sets the page's title and `lang`. Recorded on 2026-11-18: the English package was confirmed
    to hold no picture or text of the other skin.
11. **A report and hooks on `globalThis.__HEHELE__`**: `ready`, `phase`, `score`, `bodies`, `error`,
    `api` (`start`, `dropAt`, `stepFast`, `overfill`, `tapAt`, `buttons`, `resetProgress`).
    `tools/play-check.mjs` drives them in headless Chrome (the engine's `chromeFixture`): title, 40
    drops, unlock banner, overfill, result, play again; it prints state and page errors, six shots.
12. **Package.** `npm run skin:<id>`, then `npm run build:wx` (`zhuda-laya-minigame --platform wxgame
    && node tools/patch-wx.mjs`). The patch lowers every `.js` of the package to ES2017 with esbuild
    and rewrites `project.config.json`: `es6`, `enhance`, `minified`, `postcss` on, `urlCheck` off,
    the skin's project name and `appid` (the mainland skin reads `WX_APPID`). Sizes: 2.5 MB and 2.76
    MB in the HANDOFF; 2,896,137 bytes (13:32, 13:33) and 2,546,922 (20:07) in `evidence/wechat/*.json`.
13. **Preview, upload, store material.** The developer tools' command line makes a preview code and
    uploads a development version; every upload and backend change is asked of the owner first.
    `store/icon-512.png`, `icon-144.png`; for a web portal, `store/itch/`: a 630×500 cover, three
    780×1688 screenshots from the play check, `spec.json` (texts, tags, AI disclosure). The HANDOFF
    holds the owner's notes of the platform's 2026 rules (4 MB main package, health notice on a
    mainland start screen, no personal data in a single-player game, ads never forced).

## Pitfalls

- **The developer tools refused the package: `invalid file: js/index.js`, a syntax error.** The
  bundle had syntax newer than the tool's check accepts (the patch names object spread and optional
  chaining). Fix: `tools/patch-wx.mjs` after the official build.
- **The name and the category decided the art.** A first name was flagged as an industry term that
  needs a business licence: rename, new logo. The owner's account could only choose the overseas
  games category, whose self-test excludes pigs and asks for English or a local language: hence a
  second skin (another character, an item chain without beef or pork, no health notice, no ads) and
  a second account for the mainland skin. Settle both before generating a logo or a character.
- **An account may already carry a released game.** The second account did: an upload and release
  would replace it. Only a preview code was made there.
- **Selecting a skin edits source files** (`src/skin-current.ts`, `public/assets`,
  `public/index.html`): the folder is whichever skin was chosen last, so select and build in one
  command line. Without `WX_APPID` the mainland skin is packaged as `touristappid`.
- **Ad unit ids belong to one account**: keep them in the skin built for it. The HANDOFF notes that
  an account opens ads only above a visitor threshold (UV over 500).
- **Rules that tests reach are imported with `.ts` endings** and must not touch `Laya`, parameter
  properties or enums. `tiers.ts` imports the current skin, so tests run against the selected one.
- **Runs do not repeat**: `Math.random`, no seed, no bot; take both from `game-rules-first`.
- **`tools/process_art.py` is from before skins** (it writes `zhuda_*.png` into `public/assets`) and
  `process_skin.py` knows only the `cow` prefix: no recorded command rebuilds `skins/zhuda/assets`.

## Engine gaps and their workarounds

- `zhuda-laya-minigame` has no syntax target, one `appid` per target and no per-variant
  `project.config.json`: `tools/patch-wx.mjs` does all three. By the order of the two commands, the
  engine's payload check and `game.zip` describe the files before the patch.
- No host bridge for mini-game storage, vibration, share, ads or the capsule inset
  ([platform adapters](../platform-adapters.md) has none): `src/platform.ts`.
- The packaging guide lists browser audio providers and WASM physics as refused for a mini game: the
  game calls `Laya.SoundManager` itself (not heard in a host) and carries its own physics.
- No "fixed width, but the whole design on a wide screen" scale mode: set on resize by the game.
- No build-time variant that leaves another variant's files out of a package; the run-time theme
  contracts ([themes](../white-label-themes.md)) were not tried: `tools/use-skin.mjs`.
- Closed in 2.0.0: the headless Chrome helper is the public export
  `zhuda-laya-engine/compiler/chrome-host`. Both of the game's tools still import the file by path.
- Doctor reports HEALTHY though all is drawn from code: `visual-content-prefab` was not followed.
- No item under `docs/plans/` was found for any of these.

## Checks

- `npm run verify` (`zhuda-laya-build`, `tsc --noEmit`, `zhuda-laya-doctor --project .`,
  `node --test`): passed, Doctor HEALTHY, five tests; HANDOFF, 2026-11-18. Not re-run since.
- `node tools/play-check.mjs <url> <dir>`: headless Chrome, 390×844 at DPR 2, start to result to
  play again with no page error; HANDOFF, 2026-11-18. Screenshot sets under `evidence/`: `web-1` to
  `web-7`, `skin-zhuda`, `cow-web`, `final-zhuda`, `final-cow`, `ads-zhuda`, and `live-*` for the
  published web build (no errors, per `PORTALS.md` in the workspace, 2026-11-18).
- `node tools/viewports.mjs <url> <dir>`: title and play at 375×667, 390×844, 430×932, 768×1024 and
  1280×800; screenshots of 2026-11-18 in `evidence/viewports*` and `cow-viewports`, no values kept.
- `npm run build:wx`, 2026-11-18: under the 4 MB gate (step 12). Developer tools command line, same
  day: development versions 1.0.0 (first skin) and 1.0.1 (English skin) uploaded to a WeChat
  mini-game account; preview codes in `evidence/wechat/`.

## Not checked

- Play in the developer tools' simulator or on a phone: the HANDOFF's "not verified" list says
  neither happened, and its later records of previews and uploads name nobody who scanned and played.
- Real touch or mouse input by script: the play check calls `api.dropAt` and `api.tapAt` and sends
  no pointer event, so no record covers the stage handlers, the aim line or the mute button.
- In a host: sound (`Laya.SoundManager` to `InnerAudioContext`), storage, vibration, the share menu,
  the capsule inset, a rewarded video, an interstitial, the emoji used as icons, the font stack;
  anywhere: the music's loop seam, loudness when effects overlap (`play` sets a global volume).
- Frame rate, memory and load time on any device; more bodies than the play check makes; the Chrome
  version and whether WebGL ran on a GPU; how the music WAV became the MP3.
- Review, filing and release (nothing was submitted); the platform's rules themselves; engine 2.0.0.

## Boundaries

- **Game:** tier values, names, art, strings, ad unit ids, lose timings, `src/Main.ts`, store
  material; where it is published: the owner's portals (see `PORTALS.md` in the workspace).
- **Prefab library (`prefabs/` in this repository); the game uses no shared module today.**
  Candidates: `src/physics.ts` with its test (no imports: a circle world that merges by tier);
  `src/platform.ts` (a `wx` back end beside the library's browser-only `systems/storage`, plus the
  ad pacing); the skin switch (`src/skin.ts`, `tools/use-skin.mjs`: tied to two skin ids and the
  page title; `systems/i18n` covers run-time language, not build-time exclusion); `src/fx.ts`, the
  frame-clip character in `src/zhuda.ts`, `tools/make_sfx.py`.
- **Engine:** boot, sizing, the build, the Doctor and the `wxgame` package. The ES2017 lowering and
  per-variant project settings belong in the mini-game build, not in a game's tool.
- **Platform and owner:** account, filing, review, release, whatever needs the owner's scan or consent.
