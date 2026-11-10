# Verification record: disclosure-hardening

Task document: [task.md](task.md)  
Commit: the commit containing this record (base `b8a174f`, SDK 1.15.0)  
Date: 2026-11-10

## Environment

- OS / browser / device: macOS (Darwin 27), Google Chrome 157 headless (real
  GPU WebGL/WebGPU where the script requests it). No physical mobile device.
- Node and package manager: Node v26.12.0, npm 11.20.0 (`engines` is `>=24`;
  hosted CI uses Node 24). An earlier pass of the same patch set ran on
  Linux with Node 24.22.2 (`npm run verify` 321/321).
- Engine and consumer commits: engine base `b8a174f` plus this change;
  consumer `zhuda-bdl-consumer` (not a Git repository), tested in a copy.
- DPR, viewport and network mode: per script (DPR 1 / 1.5 / 2 / 3), loopback only.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Clean install | `npm ci` | PASS | terminal log |
| Build/types/declarations/Doctor/tests | `npm run verify` | PASS, 322/322 (321 before the module-resolution follow-up) | terminal log |
| Lint / format | `npm run lint`, `npm run format:check` | PASS | terminal log |
| Repeated build leaves tree unchanged | `npm run build` then `git status --porcelain` | PASS (no change after verify, build and all browser batches) | terminal log |
| New disclosure tests | `node --test tests/editor-security.test.mjs tests/cli-entry.test.mjs tests/disclosure-contracts.test.mjs tests/agent-contract-package.test.mjs tests/terrain3d-runtime.test.mjs tests/declarative-facade.test.mjs tests/build-failure-paths.test.mjs` | PASS, 20/20 | terminal log |
| Original audit reproduction | Audit `reproduce.mjs` re-run against this tree (output redirected; unknown-asset call wrapped because it now throws) | PASS: every `/__project/.env`, `.git/config`, hidden asset read is 403 on both servers; cross-origin `text/plain` save is 403 and the file is untouched; MCP, visual-contract, visual-asset and layout produce identical output directly and through a symlink; notification returns nothing, unknown method returns -32601, serverInfo version 1.15.0, unknown asset raises | local reproduction JSON (not committed) |
| Packed tarball | `npm pack --json --foreground-scripts=false` | PASS: 408 files, 5.79 MB packed / 24.4 MB unpacked, no `.map`, no `docs/plans/records`, no `/Users/` string | terminal log |
| Clean tarball install | Install the tarball in a directory whose path contains a space and CJK characters; run every `node_modules/.bin/*` with `--help`; import `zhuda-laya-engine`, `/min`, `/demo` | PASS: all 19 bins exit 0; main 162 / min 162 / demo 6 exports; `UnityBridgePipeline` only in `/demo` | terminal log |
| Published types under Node16/NodeNext | `node --test tests/types-module-resolution.test.mjs` (stages the `npm pack` declaration set, strict, no `skipLibCheck`); plus a real tarball install compiled with `tsc --module nodenext/node16/bundler` | PASS for Bundler, Node16 and NodeNext. Without the fix the test fails (Node16: `has no exported member 'TopologyResolver'`): generated declarations used extensionless relative paths, and the package shipped `packages/types/*.ts` sources that consumers type-checked instead of the `.d.ts`. Declarations now use `.js` specifiers and the sources are excluded by `packages/types/.npmignore`; an installed package still bundles the editor client | terminal log |
| Empty-directory build | `zhuda-laya-build` in an empty directory | PASS: exit 1, zero files written | terminal log |
| Prefab browser gate | `npm run verify:prefab-browser` | PASS | local evidence directory |
| Editor batches | `npm run verify:prefab-editor-responsive`, `verify:prefab-editor`, `verify:prefab-editor-play` | PASS | local evidence directory |
| Consumer runtime batches | `verify:slot-foundation`, `verify:runtime-feedback`, `verify:crowd`, `verify:model-showcase`, `verify:next-round` | PASS | local evidence directory |
| Browser SDK + branding | `node packages/compiler/browser-sdk.mjs --out <fresh>`, then `verify-browser-sdk.mjs` and `verify-branding-browser.mjs` with `SDK_BROWSER_DIR=<fresh>` | PASS, 6 browser scenarios | local evidence directory |
| WebGPU | `verify:webgpu`, `verify:webgpu-consumer` | PASS (macOS desktop GPU) | terminal log |
| Cinematic | `npm run verify:cinematic` | PASS. The Linux `Invalid offline audio cue: note` failure does not reproduce; `OfflineMix.ts` and the cinematic fixture are format-only changes against `b8a174f`, so it is an environment result, not a regression | terminal log |
| Mini-game packaging | `npm run verify:minigame` | PASS, all registered targets plus previous-package preservation | terminal log |
| Consumer typecheck/tests | Copy of `zhuda-bdl-consumer` with the packed tarball as `node_modules/zhuda-laya-engine`: `npm run typecheck`, `npm test` | PASS, 146/146 | terminal log |
| Consumer candidate build | Same copy, sibling engine = clean checkout of this change, `engineCommit` pinned to it: `npm run build:candidate` | PASS (baseline check verified, 276-entry archive within 50 MB) | terminal log |
| Consumer release build | Same copy: `npm run build` | BLOCKED by design: the 15 Prefab evidence reports are stale for the new engine fingerprint. See "Consumer build" below | terminal log |
| Game305 editor replays | Consumer `evidence/game305-editor-{responsive,coordinate-fix}-20261109/replay.mjs`, output redirected outside the consumer | PASS; Game305 source hashes unchanged | local evidence directory |
| Game305 Play replay | Consumer `evidence/game305-editor-play-20261109/replay.mjs` | FAIL on both this tree and clean `b8a174f` at the same assertion (`report().audio` is undefined): the replay predates the consumer's current editor controller. Not an engine regression; the consumer owns the refresh | terminal log |
| Windows full tests | `.github/workflows/verify.yml` `windows` job (`npm test`) | First hosted run (42760722925) FAILED in 6 tests: POSIX-only test assumptions (raw `import()` of drive paths, `/tmp` and `/opt` literals, `/`-only regexes). Tests now use `pathToFileURL`, `os.tmpdir()`, `path.resolve` and separator-agnostic patterns; product code was unchanged. The second run (42762746232) also showed the new module-resolution test spawning `npm` directly, which Windows cannot start without a shell; it now runs npm's CLI through Node. Run 42765245489 (`be4b8ea`): PASS, 322/322 | GitHub Actions |
| Hosted browser batches | `browser` job | First run FAILED at `verify:crowd`: its image comparison required Python Pillow. It now compares PNGs with the `pngjs` dependency (same RGB threshold and foreground rule); local `verify:crowd` PASS. Runs 42763543516 and 42765245489: PASS | GitHub Actions |
| Diff hygiene | `git diff --check` | PASS | terminal output |

## Coverage

`node --test --experimental-test-coverage tests/*.test.mjs` (line %):
`zhuda-build.mjs` 67.97 (audit baseline 6.24), `DeclarativeSDK.ts` 52.18
(28.67), `Terrain3D.ts` 90.64 (10.55), all loaded files 46.36 (43.92). The
figures include loaded generated output and exclude browser draws.

## Consumer build

The consumer release build runs `check-engine-baseline.mjs`, which requires a
sibling `../zhuda-laya-engine` checkout that is clean and at
`zhuda.config.json#engineCommit`. In a copy of the consumer, with the sibling
engine pointed at a clean checkout of this change and the pin updated, the
candidate build passes. The release build stops at the Prefab evidence gate,
because every report's fingerprint now differs. That is the intended behaviour:
the consumer must re-run and approve its Prefab comparisons for the new engine
(its `verify:ui:prefabs` captures only unapproved references), then publish.
`zhuda-laya-accept --project .` cannot be used directly, because the consumer
stages `game305` assets in its own build script (`assetInclude path is missing:
game305`). The consumer's real pin, its evidence and the editor on port 8891
were not modified; they are updated by the consumer after push.

## Limits and decision

- Hosted Windows CI is not Windows GPU hardware acceptance.
- Physical devices, Windows GPU hardware and a real malicious-site DNS
  rebinding run are not covered; HTTP defenses are tested at the server.
- The browser SDK for 1.15.0 now builds different bytes from the hosted
  1.15.0 release that `examples/browser-sdk/` pins (demo split, strict build).
  The templates still point at the published release. A new browser release
  needs a version bump; moving demo exports to `/demo` is a breaking change
  for anyone importing them from the main entry.
- The Game305 Play replay must be refreshed in the consumer.
- Consumer release publication waits on its Prefab re-approval for this engine.

Decision: **Implemented within scope; desktop verified.** Hosted verify, browser and
Windows jobs pass (run 42765245489). Not Accepted until the consumer pins
this engine and re-approves its Prefab evidence.
