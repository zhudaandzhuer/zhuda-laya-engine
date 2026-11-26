# Verification record: consumer-symlink-entry

Task document: [`task.md`](task.md)  
Commit: the commit that adds this file, on `44228176` (branch `unified`)  
Date: 2026-11-26

## Environment

- OS / browser / device: macOS 27.2 (Darwin 27.2.0), Apple M4; no browser.
- Node and package manager: Node 26.13.1, npm; esbuild 0.27.1.
- Engine and consumer commits: `44228176` plus this change.
- DPR, viewport and network mode: not relevant.

## What was wrong, and the change

`zhudaConsumerPlugin` adds the component registry to the entry when esbuild loads it, and knew
the entry by `path.resolve(args.path) === path.resolve(entry)`. esbuild reports the real path of
a file; `entry` is spelled from the project root as the caller gave it. Through a link the two
differ, the handler returned nothing, and the entry was bundled without the generated imports
and `EngineGuard.registerComponent(...)` calls. The build succeeded.

Now the plugin holds the entry's names: the path as given and, found again at the start of every
build, its real path by `fs.realpathSync` and by `fs.realpathSync.native`. A file esbuild loads
is the entry when its path is one of them. Nothing else changed: the registry's imports are
still spelled from the given root (esbuild resolves them to the same real files the entry's own
relative imports reach, so a class file is one module), and the test for "this class is in the
entry file" compares two paths spelled from the same root.

Checked for the same kind of comparison:

- `packages/compiler/zhuda-minigame.mjs` takes the real path of the project and the engine
  before anything else, so its use of the plugin was not affected.
- `buildPrefabPreview` compares paths spelled from one root and loads no entry through a plugin.
- `runZhudaBuild` (`zhuda-build.mjs`) decides "this is the engine workbench" by
  `projectRoot !== engineRoot` as strings: see the limits.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| The defect, as a test | `node --test tests/consumer-symlink.test.mjs` on `44228176` | FAIL as expected: `zhuda://ExtraScript through the link`, 0 instead of 1 | |
| The fix | the same command with the change | PASS: through the link each of two classes (one in a file of its own that the entry also imports, one in the entry) is registered once, the shared file's body is in the bundle once, the bundle has the SHA-256 of the one built through the real path, and the watcher's kept bundle made through the link has it too | `tests/consumer-symlink.test.mjs` |
| The watcher's tests without the workaround | `node --test tests/watch-scripts-only.test.mjs tests/prefab-watch.test.mjs` (the real-consumer test now builds under macOS's `/var` link) | PASS, 15 of 15 | |
| A build without a link writes what it wrote | `node packages/compiler/zhuda-build.mjs --project <dir> --candidate` for `games/zhuda-match`, `games/zhuda-hunt`, `prefabs/viewer3d`; fingerprint, ZIP size, entry count, ZIP SHA-256 | PASS: identical to `local-results/watch-fast-path/after-fingerprints.txt` (itself identical to the list taken on `4d881cf6`) | that file |
| Regression | `npm run verify` (build, typecheck, declaration audit, Doctor, tests) | PASS for every step but the tests in the first run, at a load average of 18: 1088 of 1089, the one a timing test of `browser-process` that has failed before on a busy machine; that file alone then 6 of 6, and `npm test` again 1089 of 1089 | |
| Lint | `npm run lint` | PASS | |
| Reference games | `npm run verify:games` | PASS, nine of nine; the nine release builds keep the fingerprints and ZIP sizes in `local-results/watch-fast-path/release-before.txt` | that file |
| Format | `npx prettier --check` on the three files of code touched; `npm run format:check` | PASS for the files touched. The whole check fails on `tests/minigame-toolchain.test.mjs`, as before | |
| Whitespace | `git diff --check` | PASS | |
| Windows, Linux | a junction, a drive letter in another case, a substituted drive | UNAVAILABLE (not tried) | |

## Lifecycle and failure cases

A missing entry: the real path cannot be found, the plugin keeps the given name, and the build
reports the missing entry as before (`CONSUMER_ENTRY_MISSING` from the source guards, which run
first).

## Prefab evidence (visual work)

None.

## Limits and decision

- **Not tried:** Windows and Linux. On Windows both `fs.realpathSync` and its `native` form are
  asked, because they disagree about substituted drives and letter case; which of them esbuild
  agrees with there was not observed.
- **Not changed:** a project whose entry file is a link to a file outside `src/` is refused by
  the source guards (they do not read linked files): `PUBLIC_SDK_IMPORT_MISSING`. Seen while
  writing the test; that shape was never supported.
- **Found, not fixed:** the engine workbench reached through a link (`--project` or the working
  directory spelled through a symbolic link to the engine's checkout) is taken for a consumer,
  because `runZhudaBuild` compares the project and the engine root as strings; it stops with
  `ENOENT … public/index.html`. Seen with a link in a temporary directory. It fails loudly and
  only engine development meets it.

**Decision: Done within scope.** Not Accepted: Windows was not tried.
