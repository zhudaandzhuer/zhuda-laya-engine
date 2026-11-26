# Verification record: watch-scripts-only

Task document: [`task.md`](task.md)  
Commit: the commit that adds this file, on `4d881cf6` (branch `unified`)  
Date: 2026-11-26

## Environment

- OS / browser / device: macOS 27.2 (Darwin 27.2.0), Apple M4; Chrome 158 (headless, for one
  picture) and the desktop app's own browser pane (for the reload).
- Node and package manager: Node 26.13.1, npm; esbuild 0.27.1.
- Engine and consumer commits: `4d881cf6` plus this change; `games/zhuda-match`,
  `games/zhuda-hunt` as committed; `prefabs/viewer3d` with another session's uncommitted
  `src/presets/stickman.ts`, the same file before and after.
- DPR, viewport and network mode: not relevant to the times (taken on the watcher's event
  stream, no browser); the picture is 540×960 at DPR 1.

## What was built, and how the output is kept apart

- **Sorting.** A change is a script change only if its path is inside `src/`. A build is
  scripts-only only when every path since the last build is one, the last full build succeeded,
  `zhuda.config.json` and `package.json` still hold the bytes that build read, the watcher runs
  with `--candidate`, and the project is a consumer with none of `prefabPreview`,
  `prefabChecks`, `prefabEvidence` and with no page input (`htmlTemplate`, `publicDir`,
  `branding.logo`) inside `src/`. Everything else is the full build.
- **What depends on the scripts.** In a consumer build: `app.js`; inside it the component class
  registry (the plugin scans `src/` at every bundle, so a new or removed class is picked up by
  the kept context too: tested); the prefab preview bundles when `prefabPreview` is set (such a
  project keeps the full build); and, through `app.js`, the manifest, the ZIP and the report.
  The engine features and libraries come from `zhuda.config.json` alone, so no script change can
  alter them; a changed configuration is caught by comparing the two files' bytes before every
  scripts-only rebuild, whether or not a file event arrived.
- **The same bytes.** The kept context is made from `consumerScriptOptions`, the function the
  full build now calls too, minify included (a minified rebuild costs what an unminified one
  does). A test builds a real consumer both ways and compares the hashes.
- **The same refusals.** The scripts-only rebuild runs `auditConsumerGates` first: the visual
  contract, the layout contracts and the consumer source guards, as the full build does.
- **Kept apart by never being written.** The scripts-only `app.js` lives in the watcher's
  memory; its server answers `app.js` from there and answers `payload-manifest.json` with
  `fingerprint: null`, no `prefabDependencies` and a `stale` entry. The output directory,
  `game.zip` and `consumer-build.json` are the last full build, untouched. Read before choosing:
  `zhuda-laya-accept` never takes a candidate from disk (it builds its own under the lock, serves
  that directory on its own port, and its release build is compared with that fingerprint:
  "Candidate changed during acceptance"), so the only way a watcher's output could reach
  evidence was a browser check pointed at the watcher's port recording the manifest's
  fingerprint. That manifest now has none, and `zhuda-prefab-check` refuses one marked `stale`.
- **Why not a marked file on disk.** A scripts-only `app.js` written into the candidate directory
  would leave the ZIP and the report behind it (packing 25 to 50 MB is most of what the full
  build costs), so the directory would hold parts of two builds and every reader would have to
  know a third state. Leaving the directory alone keeps "what is on disk is one whole build".
- **Why only with `--candidate`.** Without it the watcher's output directory is the release
  (`dist/web`), which the scenario players, the Doctor and the mini-game tool read from disk; a
  release watcher that left it behind the sources would mislead them silently.
- **Left out after weighing.** A full build when the watcher stops (a second Ctrl-C during it
  would leave the build lock behind; the watcher says instead that the directory is older). A
  full build in the background after each save (the consumer build is synchronous in the
  watcher's process and would stall the page it has just reloaded; in another process it would
  meet a build the developer starts through the lock). A shorter debounce (unchanged at 120 ms).

## Checks

### The edit loop, measured

`node scripts/measure-watch.mjs --project <dir> [--full-builds]`: the watcher is started as a
process, one client listens on its event stream, `src/Main.ts` is written back nine times with
the bytes it has, and each time is taken from just before the write to the `reload` event. The
120 ms debounce is inside every number. Median of nine, in milliseconds; "own" is the median of
the times in the watcher's own log lines.

| Project (lines of script, size of the output) | Unchanged code (`4d881cf6`) | Changed code, `--full-builds` | Changed code | Own, scripts only |
| --- | --- | --- | --- | --- |
| `games/zhuda-match` (2D, 0.7k, 1.8 MB) | 263 (246 to 274) | 362 (296 to 407) | **143** (141 to 159) | 11 |
| `games/zhuda-hunt` (3D, 1.7k, 29 MB) | 899 (864 to 939) | 1206 (1179 to 1338) | **145** (143 to 164) | 13 |
| `prefabs/viewer3d` (3D, 10.2k, 50 MB) | 1459 (1403 to 1716) | 2119 (2003 to 2457) | **157** (153 to 241) | 24 |

- The first column was taken at 16:14 before anything was changed, and agrees with the task's
  background (292, 878, 1456). The other two were taken together at 17:24, each project's two
  runs one after the other, while other sessions were working on the same Mac (1-minute load
  average 7.3 to 8.5; it had been above 100 for most of the hour). **The full build is slower in
  the second column than in the first because of that load, not because of the change.** To
  tell the two apart, `runConsumerBuild` of the unchanged code (the three changed modules as
  they are in `4d881cf6`) and of the changed code were run in one process, turn about, seven
  times each (17:33, load 8.6 to 9.6): 220 and 224 ms, 1292 and 1297 ms, 2359 and 2371 ms, the
  same fingerprint each time. A run on a machine as quiet as the first column's was not obtained.
- Earlier runs of the same pair under heavier load (16:49, load 5.5 to 8.8, the disk busy):
  scripts only 156, 160, 174; `--full-builds` 362, 1792, 4854. The scripts-only path moved by
  about 20 ms; the full build by a factor of three.
- Start of the watcher (to its first build done), unchanged code: 433, 1115, 1664 ms. The
  scripts-only path adds nothing before that line; the kept context is made after it, in the
  background (75 to 100 ms of work once, measured apart).
- What a scripts-only rebuild is made of, each measured apart in a script (median of 7, for the
  three projects): the kept context's rebuild 12, 15, 46 ms, of which the scan for component
  classes 3, 5, 28 ms; the source guards 4, 7, 37 ms. Those two passes parse every script with
  TypeScript and grow with the project, so both now remember each file by its text and parse
  only what a save changed. For `prefabs/viewer3d` the sum of the parts was 83 ms; the
  watcher's own log now says 24 ms.

### Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| The new tests | `node --test tests/watch-scripts-only.test.mjs tests/prefab-watch.test.mjs` | PASS, 15 of 15 | the test files |
| A full build writes what it wrote | `node packages/compiler/zhuda-build.mjs --project <dir> --candidate` for `games/zhuda-match`, `games/zhuda-hunt`, `prefabs/viewer3d`, before the change and with the final code; fingerprint, ZIP size, entry count and the ZIP's SHA-256 compared | PASS: the two lists are identical | `local-results/watch-fast-path/before-fingerprints.txt`, `after-fingerprints.txt` |
| The scripts-only bundle is the full build's | in the test "a real consumer": the bytes served after a scripts-only rebuild, then a full build of the same sources, SHA-256 of `app.js` compared; also seen in the browser check (369,447 bytes served again after the file was restored, the size of the full build's `app.js`) | PASS | the test |
| The directory is not written | in the same test: `app.js`, `index.html`, `payload-manifest.json`, `game.zip`, `consumer-build.json` hashed before and after scripts-only rebuilds and failed ones; no `.zhuda*` file left | PASS | the test |
| The served manifest is of no build | in the same test, and in the browser check: `fingerprint: null`, `stale.files: ["app.js"]`; after the next full build the disk's manifest again | PASS | the test |
| A real edit in a browser | see below | PASS | `local-results/watch-fast-path/edited-title.jpg` |
| Regression | `npm run verify` (build, typecheck, declaration audit, Doctor, tests) | PASS, 1088 of 1088 tests (17:27, load about 10). A first run at a load average of 100 to 240 gave 1082 of 1088: six timing tests, see the limits; their five files then passed alone, 30 of 30. A third run of the tests after the documents were written, at a load of 20: 1087 of 1088; the one (`audio-samples`, a time-out test) passed alone three times | |
| Lint | `npm run lint` | PASS | |
| Reference games | `npm run verify:games` | PASS, nine of nine. The nine release builds it made have the fingerprints and ZIP sizes of the builds that were on disk before the change | `local-results/watch-fast-path/release-before.txt`, `release-after.txt` |
| Format | `npx prettier --check` on the eight files of code touched; `npm run format:check` | PASS for the files touched. The whole check fails on `tests/minigame-toolchain.test.mjs`, as before this task | |
| Whitespace | `git diff --check` | PASS | |
| Real WebGL/device | a phone on the LAN through `--host 0.0.0.0` | UNAVAILABLE (not tried) | |
| Windows, Linux | the watcher's file events there | UNAVAILABLE (not tried) | |

### A real edit, in a browser

The watcher was started on `games/zhuda-match` (`--candidate --port 18941`) and its page opened
in the desktop app's browser pane. Read from the page: the stage's first text `豬大果園`,
`app.js` 369,447 bytes, the manifest's fingerprint `d6da22f2…` (the one of the unchanged code's
build). The title string in `src/Main.ts` was changed to `豬大果園・已自動重載`. Without
touching the page: its `performance.timeOrigin` changed (it reloaded), the stage's first text
read `豬大果園・已自動重載`, `app.js` was 369,483 bytes, the manifest served had
`fingerprint: null` and the `stale` entry; on disk `dist/candidate/web/app.js` did not contain
the new string and the manifest kept its fingerprint. The watcher's log:
`rebuilt after src/Main.ts and 1 more in 257 ms, scripts only` (the machine was under a load
above 50 at that minute; "1 more" is the editor's temporary file). A headless Chrome 158 took the
picture of the same page. The string was put back, the page reloaded again to `豬大果園` with
369,447 bytes, and `git status --short games/zhuda-match` printed nothing.

## Lifecycle and failure cases

- A failed scripts-only rebuild (a stand-in that throws; a real source that breaks a source gate;
  a real source that does not compile): `rebuild` gives null, the page's event stream gets
  `error` with the message, `app.js` is still answered with the last good bytes, the candidate
  directory is byte for byte what it was, and the next good save reloads. Tested.
- A full build that fails after scripts-only rebuilds: the page keeps what it had (the bundle in
  memory over the directory), and every later change takes the full build until one succeeds.
  Tested.
- The kept bundle cannot be made: that change and the later ones take the full build, said once
  in the log, not tried again until the configuration changes. Tested.
- A change of another kind arriving during a build decides the next build. Tested.
- Stopping the watcher drains the build in flight, lets the kept context go and builds nothing;
  after a scripts-only rebuild it says that the directory is older than the scripts. Tested.

## Prefab evidence (visual work)

None: no picture of a game changes. A project with `prefabPreview` never takes the new path.

## Limits and decision

- **Not measured:** Windows and Linux (the path sorting accepts both separators in a unit test;
  no watcher was run there); a phone on the LAN through `--host 0.0.0.0`; a project larger than
  10k lines of script; any of the times on a quiet machine after 16:14 (see above).
- **Not built:** scripts-only rebuilds for a project with `prefabPreview` (its preview bundles
  come from the same scripts and are what evidence is taken from; it keeps the full build), and
  for a watcher without `--candidate`.
- **Known and left:** the output directory lags the scripts between full builds, by design; the
  watcher says so when it starts and when it is stopped. A change to the engine's own libraries
  or to `node_modules` during a watch is not seen (it was not seen before either).
- **Found, not fixed (not this task's):** (item 1 was fixed the same day:
  [consumer-symlink-entry](../consumer-symlink-entry/verification.md))
  1. `zhudaConsumerPlugin` knows the entry by comparing the path esbuild reports with the
     configured one as strings. When the project's path goes through a symbolic link (macOS's
     `/var` temporary directories, a linked checkout) esbuild reports the real path, the
     comparison fails and the component classes are not registered in `app.js`, in the full
     build as well. Seen with a project under `os.tmpdir()`; the test here uses the real path.
  2. The watcher's start line prints `…/prefab-preview.html?id=ui/control-bar` for every
     project, also one with no prefab preview, where that page does not exist; the game is at `/`.
  3. Under a load average above 100, six timing tests in five files fail (`browser-process`,
     `cli-entry`, `live-look`, `mesh-query`, `model-editor`: spawn time-outs and "built in N ms"
     limits), and at a load of 20 one in `audio-samples` did once. They pass when run alone.

**Decision: Done within scope.** The goal is met on this Mac for the three projects (0.14 to
0.16 s from save to reload, from 0.26, 0.90 and 1.46 s). It is not Accepted: no person has used
it, and Windows and a phone were not tried.
