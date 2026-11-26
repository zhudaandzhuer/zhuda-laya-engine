# Route: run a LayaAir IDE project in the browser with the official CLI

Someone hands over a LayaAir IDE 3.x project (a `.laya` file, `assets/*.ls` scenes
with `.meta` UUIDs, scripts under `src/` registered with `@Laya.regClass`) and wants
to see it run, without the IDE window. The official LayaAir CLI builds the web
release headlessly; three defects of the 3.4.2 publish step are patched after the
build, and a static server with cross-origin isolation serves it. Checked on a
MacBook (Apple silicon) in desktop Chrome with WebGL, mouse only.

- **Id:** `laya-ide-project-cli-web`
- **Kind:** workflow
- **For:** Building and running someone else's LayaAir IDE project (scenes, prefabs, regClass scripts, WASM add-ons) as a web page from the command line, without opening the IDE and without changing the original folder.
- **Checked on:** desktop WebGL (Chrome, macOS arm64); no phone
- **Status:** 2026-11-26: a 1.6 GB IDE 3.4 project (a character showcase with a
  C++/WASM cloth solver, seven characters, custom toon shaders) built with CLI 3.4.2
  in about a minute, served with COOP/COEP, reached its ready state with the WASM
  backend (9 cloths, 21 colliders); animation buttons and the character switch worked.
- **Reference consumer:** the folder `陽光需求/SuisuiLaya` on the Desktop of the owner's Mac (outside this
  repository; the scripts are beside it in `../run/`, the notes in `../HANDOFF.md`).
- **Engine version:** not used: LayaAir CLI 3.4.2 at `~/.layaair/3.4.2`, project
  format 3.4.0 (`.laya`).

## When to take this route

Take it when the project was made in the LayaAir IDE and only needs to be built and
looked at (a client delivery, a plug-in demo, an upstream sample). It does not fit a
game on this engine (`new-game-project`), a mini-game package (`mini-game-build`) or a
prototype that must be one file (`single-html-page`). To edit scenes or cloth
selections, the IDE window is still needed; this route only builds.

## Tools

- LayaAir CLI, installed with `curl -fsSL https://raw.githubusercontent.com/layabox/layaair-cli/master/install.sh | bash && ~/.layaair/layaair install <version>`
  (`layaair list` shows what is installed; on this Mac 3.4.2 and 3.4.0-beta.3).
  With `-p <project>` it picks the runtime matching the `.laya` version, else the
  newest with a warning. `layaair build --list-platforms -p <project>` lists targets
  (web, single-html, wechat, bytedance, poki, …).
- macOS `cp -Rc` (APFS clone: the copy costs no space until a file changes).
- Node 20+ for the static server.
- The reference consumer's `run/` folder: `build.sh`, `postbuild.sh`,
  `uuid-alias.js`, `serve-isolated.mjs`. Nothing from the delivered project is
  copied into this repository (its models and textures may be third-party).

## Steps

1. **Read the project first.** `.laya` gives the format version;
   `settings/PlayerSettings.json` gives `startupScene` as `res://<uuid>`, found in
   `assets/*.ls.meta`; `settings/BuildSettings.json` lists the engine modules. Compare
   the README with the folder: a trimmed delivery often lacks the folders its README
   names (here `native/`, `tools/`, `docs/` and the sample scenes were absent, so the
   WASM could not be rebuilt from it).
2. **Clone, never build in place.** The CLI writes `library/` (asset cache, as large
   as the assets), `bin/`, `local/` and `temp/` into the project. `cp -Rc <project> <work>/<name>`
   and create `<work>/<name>/local/` (without it the CLI prints a harmless
   `buildLog.json` ENOENT at the end).
3. **Keep every component script.** Write
   `settings/CompilerSettings.json` = `{"keepUnusedComponentScripts": true}` in the
   clone. Check: `grep -c '<class uuid>' <out>/js/bundle.js` for each `_$type` in the
   startup scene that is not an engine type.
4. **Build.** `~/.layaair/layaair build web -p <clone> -o <work>/web`; it ends with
   `Build end, result=Success`. About 60 s with an empty `library/`.
5. **Patch the output** (`postbuild.sh`): add `js/uuid-alias.js` between
   `js/bundle.js` and `js/index.js` in `index.html` (it registers every class under
   both its full and its compressed UUID in `Laya.ClassUtils._classMap`), and copy any
   runtime file a project build plug-in failed to export (here
   `resources/wasm/magiccloth.js` and `.wasm`).
6. **Serve with cross-origin isolation.** `node serve-isolated.mjs <work>/web 8971`
   sends `Cross-Origin-Opener-Policy: same-origin`,
   `Cross-Origin-Embedder-Policy: require-corp` and
   `Cross-Origin-Resource-Policy: same-origin`, and `application/wasm` for `.wasm`.
   A WASM add-on with shared memory needs `crossOriginIsolated === true`; opening
   `index.html` from disk is not enough. In this workspace it is the
   `suisui-laya-web` entry of `.claude/launch.json`.
7. **Check in the page**, not by eye: `crossOriginIsolated`, the project's own ready
   marker (here `#showcase-status[data-state=running]` and the console line
   `SHOWCASE_READY running 9 21`), then click through its controls.

## Pitfalls

- **`missing component type '<uuid>'` for the project's own scripts.** The 3.4.2
  release bundle keeps only component scripts it counts as used by exported assets,
  and it did not count several that the startup scene uses (each had
  `@Laya.regClass("<uuid literal>")` followed by `@Laya.classInfo({...})`). Fix: step 3.
- **Component references resolve to `null` (here every cloth collider: "Registered
  Laya cloth collider components required").** In the published `.lh`, a reference
  `{"_$ref": …, "_$type": …}` is written with the compressed class id while the
  component itself and its `regClass` keep the full UUID, so one of the two spellings
  is never registered. Fix: the alias shim of step 5. Compare a reference and its
  target in the published prefab to see it.
- **A build plug-in's runtime files are missing.** A plug-in that decides in
  `onCollectAssets` whether a feature is used sees the scenes but apparently not yet
  the prefabs they instance, so it skipped its own `onAfterExportAssets` copy. Look
  for the 404 in the server log; copy the files in the post-build step.
- **A hidden browser pane looks like a hang.** With the Claude browser pane hidden,
  `requestAnimationFrame` ran about once a second; a character switch that warms
  shaders one frame at a time took over a minute. Do not measure frame rate there.
- **Console floods with `GL_INVALID_OPERATION: Active draw buffers with missing fragment
  shader outputs`** from the reference consumer's custom shaders; the picture matched
  the project's own preview image. Not traced.

## Engine gaps and their workarounds

None in this engine: the route does not use zhuda-laya-engine. The gaps are in
LayaAir CLI 3.4.2's web publish (steps 3 and 5). The 3.4.3 notes list a fix for
parsing class-registration decorators, which may remove the first two pitfalls; not
tried.

## Checks

- `layaair build web …` prints `result=Success`.
- In the page: `crossOriginIsolated === true`; `Laya.ClassUtils.getClass(id)` is truthy
  for every class id in the startup scene; the project's ready marker appears.
- Server log shows no 404.
- Screenshot compared with the project's own preview image.

## Not checked

The IDE window; CLI 3.4.3; `layaair run` (the CLI's preview server) and whether it
sends COOP/COEP; WebGPU; phones and touch; frame rate; other build targets; projects
with sub-packages or remote resources.

## Boundaries

Everything stays beside the delivered project: the clone and build in a cache folder,
the scripts in its `run/` folder. Only this page belongs here.
