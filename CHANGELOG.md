# Changelog

What each release added, newest first. The version source of truth is `package.json`; tagged
releases are on [GitHub](https://github.com/zhudaandzhuer/zhuda-laya-engine/releases). The sections
below 1.18.0 were moved here from the README as they were written at the time.

## After 2.0.1 (not released)

- A route for a pop-up papercraft diorama made of code alone
  ([papercraft-diorama](docs/routes/papercraft-diorama.md)): an outside skill's rules for the
  look, the paper structures, the folds and the rules against flicker, set against what this
  engine has. Not built here yet.
- `tests/minigame-toolchain.test.mjs` is in the form `npm run format:check` asks for: the check
  passes again.
- The browser SDK 2.0.1 is published ([releases](docs/browser-sdk-releases.json)): six bundles and,
  for the first time in a recorded release, the backend loader. Templates and
  [the SDK page](docs/browser-sdk.md) point at it.

## 2.0.1 (2026-11-26)

What came after 2.0.0 the same week, released together. Where a document says "after 2.0.0",
it is in this release.

- **A film scene drawn live on a page: the lens is applied, and a quality governor may reach
  level 0** ([record](docs/plans/records/stage-on-a-page/verification.md), route
  [interactive-film-viewer](docs/routes/interactive-film-viewer.md)). Found by an outside agent
  that built a viewer on 2.0.0 from the routes. `stage.prepare(aspect)` now gives the camera the
  field of view of the focal length last set; before, a page that called only `setCamera` and
  `prepare` drew every focal length at the camera's default angle, and the reference games
  called `stage.lens.apply(aspect)` by hand (the call is still allowed; a page that set
  `camera.fieldOfView` itself now has it replaced: set the focal length). `stage.setQuality`
  keeps what was fixed at mount: bounce light stays at every level, and the scene's colour table
  goes with the grade at level 0 and comes back; before, level 0 threw `setLook cannot change the
  bounceLight` (or `colorTable`). `setLook` may stop using the loaded colour table and name it
  again. New: `ZhudaPhysicalCameraRig.sampling`. `chromeFixture`'s `evaluate` takes a function
  as well as text, and `screenshot` returns the PNG. A film rendered offline is unchanged.
- **A consumer reached through a symbolic link registers its component classes**
  ([record](docs/plans/records/consumer-symlink-entry/verification.md)). The build's plugin knew
  the entry by the path it was given, while esbuild names files by their real path: through a
  linked checkout, or under macOS's temporary directories, the entry was bundled without the
  class registry and the build still succeeded. The plugin now knows the entry by its real path
  as well; the bundle is the same file either way, and a project with no link in its path builds
  to the bytes it built to before.
- **`zhuda-laya-watch --candidate` answers a save that changes only scripts by rebuilding
  `app.js` alone** ([rules](docs/consumer-tooling.md#the-watcher-saves-that-change-only-scripts),
  [record](docs/plans/records/watch-scripts-only/verification.md)). The bundle comes from an
  esbuild context the watcher keeps, with the full build's options and source gates, and has the
  bytes the full build would write. It is served from memory and never written: the output
  directory, the ZIP and the report stay the last full build, and the manifest served meanwhile
  carries no fingerprint (`zhuda-prefab-check` refuses it). Any change outside `src/`, a changed
  configuration, a project with `prefabPreview`, and a watcher without `--candidate` keep the
  full build; `--full-builds` turns the new path off. Each rebuild's log line gives its time and
  kind (`rebuilt after src/Main.ts in 17 ms, scripts only`). `zhuda-laya-build` writes the bytes
  it wrote before. `node scripts/measure-watch.mjs --project <dir>` measures the loop.
- **Interface tests that click controls by name and repeat exactly**
  ([route](docs/routes/ui-test-by-probe.md), [record](docs/plans/records/ui-test-probe/verification.md)).
  `zhuda-laya-engine/compiler/stage-probe` is a probe sent into a running page from outside: the
  Laya stage's node tree with each node's name, class, visibility, pointer listeners, text and
  rectangle in CSS pixels. It is not in the runtime; a build is not one byte larger. The scenario
  players (`prefabs/tools/detplay.mjs`, the viewers' `tools/play.mjs`) take three new steps:
  `click` by name or label, `expect`, `probe`; a failed step ends the run with its number and
  what was found. `prefabs/tools/detrepeat.mjs` runs a scenario N times on the virtual clock and
  compares every screenshot, stage report and log. `games/tools/device-measure.mjs` reports the
  stage's node counts beside the DOM's. Scenario files written before play unchanged.
- **Character kit: a skeleton and clips for a mesh that was not made here, in Node**. `games/tools/characters/mesh-skin.mjs`
  reads a textured `.glb`, welds its seams, finds its pieces and weights it from the bones'
  places; `rig-motion.mjs` poses it, reaches with arms and legs, swings hair and cloth on springs
  into the keys (loops closed) and measures a cross-fade. The engine's
  API is unchanged.
- The effect budget no longer holds BigInt literals, which have no older form: a mini-game that
  uses `ZhudaEffectBudget` can be lowered below `es2020`. A test lowers every engine source file
  to `es2017`.
- **Gaps the routes list, closed in the engine** ([record](docs/plans/records/gaps-after-2-0/verification.md)):
  - `runtime.timers.wait(seconds)` and `runtime.timers.tween({ duration, update, ease })` follow
    the clock they are on, stop with a pause and cancel with their owner; `zhudaEase`.
  - `fixedDeltaSec` on the runtime session: every frame advances its clock by the same time, so
    two builds can be compared frame for frame.
  - `whenZhudaSplashGone()` and the page's `zhuda:splash-gone` event; `__ZHUDA_SPLASH__.gone`.
  - `ModelInstance.setShadows({ cast, receive })`.
  - A GLB's JSON, manifests and the prefab library are read on a host with no `TextDecoder` or
    `TextEncoder` (`zhudaUtf8Decode`, `zhudaUtf8Encode`).
  - [Walking](docs/walking.md): `createZhudaWalkGrid`, `findZhudaPath`, `zhudaWalkLineClear`, a
    kinematic `ZhudaCharacterController` (slides, steps, slopes, edges, falls, jumps) and
    `zhudaSolidQueryProvider` for the camera boom. Numbers only; the game stays the authority.
  - `zhuda-laya-minigame`: `minigame.syntaxTarget` (down to `es2017`) and `minigame.orientation`.
    Subpackages are still refused. As first written, any target but the default failed every
    export (the bundle was built at the lower target and then compared with the web build's);
    found by a real export on the owner's Mac and corrected: compared at the web build's syntax,
    lowered after, and refused with `MINIGAME_SYNTAX` where something has no older form.
- **Two prefab modules from the stocking-tearing benches** ([record](docs/plans/records/hosiery-modules/verification.md)):
  - `3d/layered-hosiery`: a modelled lower body (MakeHuman base mesh, CC0) in fifteen kinds of
    stocking under thirteen skirts, shorts and trousers. Stockings and garments are per-vertex
    offset layers that are pulled and torn, a garment's hole lets the stocking under it be pulled
    in turn, skirts are the engine's cloth with the legs as bodies. `createHosieryWearer` takes
    rays and a frame step; `?scene=layered-hosiery` in `prefabs/viewer3d`.
  - `2d/spine-tights`: a Spine 4.2 rig (tights with ten tear sites under a pleated skirt on nine
    chains with physics and IK), everything it was made from, and `createSpineTights`, the hand
    that drives it through `ZhudaSpineCharacter`; `?scene=spine-tights` in `prefabs/viewer2d`,
    which now builds with the feature `spine42`.
  - The routes `layered-cloth-on-body` and `spine-character` name these modules as their
    reference consumers (they named a folder outside the repository).
  - The viewers' `tools/play.mjs` take a `drag` step; `games/tools/shot.mjs` takes `--hook` for a
    page whose hook is not `__GAME__`.
- **A bar for characters that are looked at closely** (route
  [high-quality-character](docs/routes/high-quality-character.md), [record](docs/plans/records/character-bar/verification.md)):
  - `games/tools/characters/motion-audit.mjs` reads a `.glb` and measures what a commercial
    showcase's character was measured by (route `smooth-character-motion`): keys a second, hair and
    cloth moving inside the clips, loops that close, pops, twist bones, joints on a vertex. On the
    reference it gives that route's numbers again.
  - `games/tools/characters/blender/raise-rig.py` (Blender headless): twist bones, hair, cloth and
    tail chains swung on springs and written into the clips, every clip dense and a whole number
    of frames. The wardrobe's body and the pig Zhuda were raised with it and pass every must; the
    raised copies replace nothing.
  - `prefabs/viewer3d`: `?scene=model-stand&file=<any rigged .glb>` shows a character in the
    engine, its clips cross-faded in seconds or frozen at a second.
- The wardrobe's skirts no longer have a row of dark points on the waistband: only the end face of
  hanging cloth that looks down is painted dark (found on a graphics card, `local-results/B1`).
  Three part files changed; shapes, masks and the three reports are as they were.
- The npm package carries `CHANGELOG.md` (2.0.0's does not: its `files` left it out, which every
  workspace game's upgrade ran into).
- The nine routes written from the workspace's games say what each game's move to 2.0.0 showed
  ([record](docs/plans/records/v2-consolidation/verification.md)).

## 2.0.0 (2026-11-26)

One repository. The owner's decision of 2026-11-26: the game centre's routes and its shared prefab
library are folded into the engine's repository, every game of the workspace is written down as a
route, and what remains outside is a `games/` folder of games that pin a release of this one. The
major number is for that change of what the repository and the package are; the engine's public
API has no breaking change from 1.18.0. Record:
[v2-consolidation](docs/plans/records/v2-consolidation/verification.md).

- **The prefab library is in the repository and in the package.** [`prefabs/`](prefabs/README.md)
  (the workspace's `commonPrefabs/` 0.10.0): its 35 modules (interface components, input, saving,
  languages, slot rounds, combat rules, cloth presets; a side-view duel, a dungeon line slot and a
  cascade slot's client as modules; three islands, their characters, walking, sound and light; a
  low-poly rigged figure), two viewers and one Go module for game servers. A game takes copies with
  `npx zhuda-prefab-sync . <module…>`; `npm run verify:prefabs` runs the library and both viewers
  against this checkout. The package grows by about 42 MB (models and sounds); `source/`,
  `preview/` and the viewers stay in the repository only. [The prefab library](docs/prefab-library.md).
- **Taken out of four workspace games into the library** (the games were not changed and do not
  use the library's copies yet): `systems/circle-merge` (circle physics with merging, from the
  drop-and-merge mini-game), `systems/minigame-host` (the WeChat host bridge, the polyfills
  WeChat on iOS needs for the engine, a package asset provider, from the raft brawl),
  `audio/casual-sfx` (41 synthesised sounds, from the counting game), `3d/seaside-pier` (a beach,
  a pier, a raft and things for the water, modelled from numbers, with a viewer preset) and a
  light Zhuda of 8,990 triangles in `3d/zhuda-characters` (both from the pole-rescue game). Each
  has tests; 39 modules in all.
- **Twelve routes from the game centre**, translated: `game-to-prefabs`, `prototype-to-center`,
  `shared-islands`, `cascade-slot`, `dungeon-line-slot`, `go-game-server`, `online-lockstep-match`,
  `side-view-duel`, `pose-atlas-motion`, `low-poly-character-from-shapes`,
  `mobile-always-landscape`, `mobile-web-fullscreen`.
- **Nine routes written from the workspace's games**, one each, from the games' own records; the
  games stay outside the repository: `apocalypse-survival-3d`, `story-counting-2d`,
  `action-adventure-3d-minigame`, `drop-merge-2d-minigame`, `raft-brawl-3d-minigame`,
  `isometric-mystery-2d`, `third-person-town-3d`, `platform-fighter-2d`, `pole-rescue-arcade-3d`.
- **A glTF model cross fades from one clip to the other.** LayaAir 3.4.2's glTF reader files a
  clip's keyframe nodes under their paths as the path strings; the animator found no node there and
  blended towards the bind pose and back. The engine's glTF adapter files the nodes
  ([animation control](docs/animation-control.md)). Found by `prefabs/3d/stickman`; checked on a
  fake clip in tests, and in the viewer by the figure that found it.
- **`boot({ layoutSize })`.** The stage is sized from a layout size the consumer gives instead of
  the container's rectangle on screen, for a game turned a quarter by CSS to fill an upright phone
  ([platform adapters](docs/platform-adapters.md)). Checked on a fake stage in tests; no phone.
- **`zhuda-laya-engine/compiler/chrome-host`** is a public entry (the headless Chrome the engine's
  browser checks use), and `prefabs/tools/detplay.mjs` plays a scenario on a virtual clock so that
  two builds can be compared pixel by pixel ([consumer tooling](docs/consumer-tooling.md)).
- **The character kit** (`games/tools/characters/`): `writeRiggedGlb` takes `sampler` and
  `generator`; `raster.mjs` exports `pngBytes`. The low-poly figure is now built from the kit here
  instead of from a copy.
- **Routes whose reference consumer had been removed** point to where it is now:
  `floating-island` to `prefabs/3d/sky-island`; `layered-cloth-on-body` and `spine-character` to
  the folder outside the workspace that keeps those games.

Not in this release: nothing was run on a phone; the workspace's games were not merged, and their
routes were written from their records, not by rebuilding them; the textures library
(`commonAssets/`, 644 MB) stays in the workspace.

## 1.18.0 (never tagged; part of 2.0.0)

- **Reference games in the repository.** Nine small games under [`games/`](games/README.md) are
  consumers of the engine in the same checkout; `npm run verify:games` builds, type-checks,
  doctors and tests each of them. The consumer build and the Doctor accept a consumer kept inside
  the engine's repository (`file:` up to the engine root) and refuse everything they refused before.
- **Genre routes.** [`docs/routes/`](docs/routes/README.md) gains `game-rules-first` and eight genre
  routes (platformer, match-three, rhythm, merge, idle with summons, survivors-like, tower defence,
  hunting action), each with its reference game here, plus `outdoor-landscape` and
  `rigged-phone-character`.
- **Audio clock.** `IframeSoundAdapter.getSamplePositionSec(id)` and `getOutputLatencySec()`
  ([audio](docs/audio.md)). Checked against a fake audio context in tests and, by
  `games/zhuda-beat`, in headless Chromium's audio context (no speaker).
- **Film scenes.** `lintZhudaFilmScene` reports `grass.draws` and `zhudaGrassMeshCount` estimates
  it; `ZhudaFilmStage.worldToScreen` and `projectZhudaFilmPoint`; `ground` takes `y`
  ([film scenes](docs/film-scenes.md), [grass](docs/grass.md)).
- **Wearing parts.** `bindZhudaSkinToSkeleton(part, body)` binds a part's skinned meshes to another
  model's joints by name, also when the part rests in another pose, scale or axis convention ([animation control](docs/animation-control.md)); `games/zhuda-wardrobe`
  dresses one character with it, and `games/tools/characters/` holds the kit its parts are made with.
- **Hiding what a part covers.** `setZhudaTriangleMask(node, mask)` hides triangles of a drawn mesh
  by a bit each, in the model file's order (LayaAir holds each glTF primitive last index first; the
  call turns it), on a copy of the mesh of the node's own; with `releaseZhudaTriangleMask` and
  helpers to make, join and encode masks ([animation control](docs/animation-control.md)).
- **Garments that nothing comes through.** The kit under `games/tools/characters/` makes a garment
  from a few numbers (cloth as the body's surface moved outwards, skinned as the skin under it,
  every edge closed), writes what it hides, and measures it twice, by surfaces and by pixels, in
  poses beyond the game's clips. Route [clip-free-garments](docs/routes/clip-free-garments.md).
- **The wardrobe's figure and clothes have the measurements of real ones.** The body was reshaped
  to a published size chart (13 girths within 6 %; it had a bust 76 % and a neck 68 % of a real
  one) and the clothes cut from real garment sheets: a T-shirt hangs straight from the bust to the
  hips, trouser legs are tubes, skirts have real lengths and sweeps, the hat is a cone and the
  pack a box. The kit gained a tape (`tape.mjs`), `volume.tube`, squared ovals, hard-edged solids
  and a third measure (the body inside loose cloth at rest). `games/zhuda-wardrobe`: 31 kit-made
  parts, none with skin through at 1 mm in 153 poses; 19 of 22 garment measurements inside the
  real range, the other three listed. Four cuts at real lengths failed the pixel measure and were
  left out. Compared by measurement and by my own looking at software renders; no person judged
  them.
- **The wardrobe's garments are one colour.** The darker band at necks, cuffs and hems was
  painted by distance to a zone's boundary, which darkened cloth wherever a zone merely enclosed
  a limb (found on a graphics card, `local-results/B1`); it is gone, and the kit's `paint` now
  gets `info.end` for the face that closes a hem. Shapes and masks are unchanged.
- **Models.** `durationSeconds` on `ZhudaModelInspector.play` / `crossFade`
  ([animation control](docs/animation-control.md)). Checked on a fake animator only.
- **Documentation.** The README is one page; release notes are here; [`docs/README.md`](docs/README.md)
  indexes every guide; [`docs/overview.md`](docs/overview.md) keeps the feature tour.

## 1.17.0: Procedural assets

Bake seamless PBR texture sets from JSON recipes, build props from a small geometry kit with colliders and surface tags, merge a whole yard into one mesh per material, and synthesise sound effects, all deterministic and file-free. Generated assets sit behind the same `AssetProvider` boundary as downloaded ones. See [procedural assets](docs/procedural-assets.md) for the API, the starter samples in `zhuda-laya-engine/demo`, and the verification scope: the data contracts are tested in Node, and a desktop WebGL draw verifies normal direction and mipmaps; WebGPU and mobile are not yet recorded.

## 1.16.0: Security, packaging and public types

The Prefab and Model editors accept only their own Host and Origin, a per-launch
capability token and JSON writes, and `/__project/` serves approved assets only.
Every npm bin works through symlinks, spaces and non-ASCII paths, and
`zhuda-laya-build` fails instead of writing output when no project
configuration exists. Public declarations are generated from the TypeScript
sources and resolve under Bundler, Node16 and NodeNext. The package ships
`./min` and `sideEffects: false`, no source maps or plan records.

**Breaking:** the legacy samples (`BenchmarkEngine`, `StaticAssetPipeline`,
`UnityBridgePipeline` and related exports) moved from the main entry to
`zhuda-laya-engine/demo`, and MCP's sample tool is now
`demo_verify_unity_migration`. Unknown MCP assets and JSON-RPC methods now fail
explicitly. See the [verification record](docs/plans/records/disclosure-hardening/verification.md).

## 1.15.0: Layout, art text and video surfaces

`computeZhudaGridLayout` and `computeZhudaTextLayout` keep authored positions in
design pixels while applying viewport and SafeArea scaling once. Consumers can
use the same reports for isolated Prefab previews and assembled Scenes, so DPR
does not get multiplied into individual coordinates. `validateZhudaBitmapFont`
and `measureZhudaBitmapText` validate glyph coverage and use authored advances
before a BitmapFont is registered. `ZhudaVideoSurface` wraps LayaAir's
`VideoNode`; decoder mode is the default because it is nestable in the Laya
hierarchy and follows normal node disposal. Player mode remains subject to the
platform's floating-video restrictions.

`createZhudaBitmapFont` registers a validated manifest through Laya's public
bitmap-font registry. `ZhudaWebViewSurface` provides an explicit Laya anchor
and lifecycle for a consumer-owned native/DOM WebView adapter; it does not hide
an iframe inside the canvas or claim that WebView content is a renderable Laya
texture.

## 1.14.0: Official mini-game packaging without the IDE

An independent consumer can call the installed LayaAir 3.4.2 CLI directly
through the public build API for WeChat, ByteDance, OPPO, VIVO, Xiaomi,
Alipay, Taobao, Bilibili and Huawei targets. The route pins the toolchain,
retains the official platform adapter, stages output atomically and records
the package fingerprint. See [mini-game packaging](docs/minigame-packaging.md).
Kuaishou, store submission and device execution are not claimed without an
official adapter and separate platform evidence.

## 1.13.0: Deterministic movie production

Sample native bone/Morph animation at exact timestamps, use a physical camera
with aperture/shutter samples, capture bounded offscreen frames, and export a
soundtrack through the existing audio mixer. `zhuda-film-export` verifies the
sequence and encodes H.264/AAC with atomic replacement of the previous movie.
The glTF unlit importer also preserves authored colors on WebGPU.

[Public movie workflow](docs/cinematics.md) · [Runnable example](examples/cinematic-capture/)
· [Verification and limits](docs/plans/cinematic-production/verification.md).
Neutral macOS WebGL/WebGPU fixtures cover actual 4K24 output, exact replay,
DPR/resize, focus/motion effects, audio timing and repeated disposal. Samples are
averaged in scene-linear light when the frame request carries the HDR chain's
`linear` handle (film scenes with a grade do), else display-linear after tone
mapping. The output is SDR. EXR output, path tracing,
Windows hardware and physical mobile/XR remain unverified or unimplemented.

## 1.13.0: Single-HTML browser entry

Use the [hosted SDK and runnable examples](https://game.qianlongxundao.com/play/zhuda-engine-sdk/)
to load the real runtime with one pinned script. [Browser SDK guide](docs/browser-sdk.md)

## 1.12.0: Asset delivery and deterministic evidence

Optional pinned Meshopt decoding now feeds the existing provider/model cache;
chunk delivery shares leases and rejects late, oversized or corrupt downloads.
Deterministic timelines, a bounded frame recorder and `zhuda-sequence-check`
provide reproducible presentation evidence. The Electron example now stages the
consumer bundle inside the package. See [model loading](docs/model-showcase.md),
[timelines](docs/cinematics.md), [desktop packaging](examples/windows-webgpu/)
and the [measured scope](docs/plans/desktop-and-agent-gates/hardening-verification.md).
macOS WebGL/WebGPU neutral-model checks pass; Windows hardware, Draco,
GPU-driven/HLOD and XR remain separate work; the 1.13.0 movie route is above.
KTX 2 / Basis textures are read with a transcoder the game brings
([docs](docs/basis-textures.md)).

## 1.11.0: WebGPU backend and delivery

Choose `renderer: "webgpu"` in the consumer compiler, or a `2d-webgpu`,
`3d-webgpu` or `3d-gltf-webgpu` browser bundle. The SDK uses the real upstream
GPU backend, reports the actual adapter, bounds initialization and retires lost
devices through the existing runtime lifecycle. Default WebGL is preserved.
[Setup, fallback and platform limits](docs/webgpu.md) include reproducible Windows
browser checks. `renderer: "auto"` (or `zhuda-loader.js` in a single HTML page)
serves both from one address: WebGPU where the browser has a hardware adapter,
WebGL elsewhere, with the reason in `context.renderer.fallbackReason`
([backend delivery](docs/backend-delivery.md)). macOS hardware rendering is measured; Windows hardware, native
EXE/Steam and physical mobile acceptance remain unverified.
The [`examples/windows-webgpu`](examples/windows-webgpu/) host provides a
reproducible Electron entry for the next Windows packaged acceptance step.

## 1.10.0: White-label, themes and presentation recovery

Keep the default splash (the LayaAir mark and "Powered by LayaAir Engine", a
tribute to the engine this one is built on), use your own brand, or explicitly disable
it through the public compiler and browser bundle. Immutable theme mappings,
SHA-verified assets, cancellable prepared replacement and authoritative-result
presentation/checkpoint coordination support a same-core, two-theme workflow.
`zhuda-laya-init --template 2d` creates a strict 2D consumer with shared isolated
Prefab definitions. See [contracts, examples and adoption limits](docs/white-label-themes.md)
and the [verification record](docs/plans/records/slot-factory-foundation/verification.md).
Slot-specific rule kits, math/RGS/wallet and Factory products belong outside
this engine repository. Signed Native and device acceptance are separate checks.

## 1.9.0: Model inspection and import reliability

Required glTF extensions now fail explicitly when unsupported; node Morph weights
and CUBICSPLINE Morph animation are preserved. Public compatibility reports,
a model inspector and same-instance Raw / Gameplay / Cinematic presentation
are available, with a `3d-gltf` HTML bundle. See the [model showcase contract](docs/model-showcase.md)
and [model pipeline contract](docs/model-pipeline.md) for the tested subset,
asset coordinate rules and unsupported features. Cinematic is real-time postprocessing,
not an offline movie renderer or a guarantee of Unreal Engine parity.

## 1.8.0: Crowd presentation and measurable budgets

Provider-backed model templates now share animation clips and release native
model resources deterministically. Crowd/snapshot presentation scheduling,
native animation LOD, important-effect fallback, adjustable particle simulation
and bounded P50/P95/P99/raw GPU profiling are available through the public SDK.
[Integration and platform boundaries](docs/crowd-runtime.md) include a reproducible
25/50/100 skinned-character consumer benchmark and 100/300/500 ordinary-instance
comparisons. These fixtures do not certify a production MMO or Windows/Steam.

## 1.7.0: Runtime reliability

DPR-independent CSS design coordinates, provider-backed streaming BGM, bounded
FIFO/priority voice retirement, a sample-backend extension and an optional
Worker frame driver are available. The full vendor declaration audit now passes
with `skipLibCheck:false` and runs inside `npm run verify`.
See [audio](docs/audio.md), [runtime sizing and recovery](docs/platform-adapters.md),
and the [measured scope and migration notes](docs/plans/records/runtime-feedback/verification.md).
Physical iOS/Android, speaker latency and a production Worklet DSP mixer remain
unverified; the extension and desktop reference test do not establish full SOP compliance.

## 1.5.0: Consumer runtime additions

Doctor now selects the current project and rejects empty scans. The existing
mixer accepts provider-backed audio samples with loops, fades and disposal.
The shared Prefab library/preview accepts typed primitive 3D trees with named
nodes, states, material slots and sockets. See [audio](docs/audio.md),
[3D Prefabs](docs/procedural-prefabs.md) and the
[verification scope](docs/plans/records/consumer-runtime-hardening/verification.md).
These additions do not establish physical mobile acceptance or approve game art.

Consumer integration feedback adds explicit lifecycle completion checks, official
`zhuda-laya-build --candidate` / `zhuda-laya-accept` commands, conservative
component dependency proofs and opt-in shared primitive Prefab resources.
Start with [candidate and evidence configuration](docs/consumer-tooling.md)
and [shared resource ownership](docs/procedural-prefabs.md). Existing consumers
keep whole-payload validation and independent resource ownership by default.
