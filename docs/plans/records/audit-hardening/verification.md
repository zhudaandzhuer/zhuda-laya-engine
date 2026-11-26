# Verification record: audit-hardening

Task document: [`task.md`](task.md)\
Commit: the one that adds this file, on `unified` after `900f3321`\
Date: 2026-11-26

## Environment

- macOS 27.2 on an Apple M4; Node 26.13.1, npm; the pinned toolchain.
- Engine: `unified` at `900f3321` plus this change. The public repository at `fff3223` (the
  export of `6d2a9184`) stood in for "before" where a before was drawn.
- Headless Chrome 158 on the graphics card for the browser checks. No Windows, no Linux, no
  phone: the public workflow runs the tests on both when this is exported.

## The audit, finding by finding

The audit read the public repository at `5ccc746`. "Read" is a claim checked in the code; "run"
is one checked by running something.

| Finding of the audit (its severity) | Verdict | How it was checked |
| --- | --- | --- |
| The public workflow fails at `format:check` (high) | **Past** | Run (`gh run list`): the tagged commit `57b3acec` failed there; `5ccc746` and `fff3223` pass all five jobs |
| `local-results/` and `LOCAL-REQUESTS.md` are committed and may leak local paths (high) | **Not true** | Read: 382 files, 25 MB, kept on purpose (`.gitignore` says so; documents link to them). Run: no file under them names a home folder; the export rewrites those |
| Four MCP tools pass caller paths on without a boundary (high) | **Half true; closed** | Read: `compile_project` and `run_ci_gate` do not exist anywhere in the repository. `audit_visual_migration` and `audit_visual_contract` did take any path; both only read (file names, hashes, one JSON file), neither writes through MCP. Now bounded: see below |
| ESLint is too loose (high) | **True, less than stated; tightened** | Read: the configuration was as described. Run: with the rules as they are now set, no unknown name anywhere in the plain JavaScript outside one audio worklet fixture (its names are the worklet's own), 59 unused names and 7 empty catches at first; with `typescript-eslint`'s whole recommended set, about 1,900 uses of `any` on top |
| `runZhudaBuild` compares the roots as strings; `outDir` may leave the project (medium) | **True; closed** | Run before: the engine named through a link stops at a missing `public/index.html` (this repository's handoff already listed it). Read: a consumer's build already kept its output inside the project and off links (`consumerOutputConflicts`); the engine's own build did not |
| The MCP server does not validate arguments at run time (medium) | **True; closed** | Read: 35 input schemas declared, none enforced |
| The browser SDK is at 1.17.0 and the reference games at 2.0.0 (medium) | **Past, and half wrong** | The SDK 2.0.1 was published the same day (`6d2a9184`); the games under `games/` depend on `file:../..`, not on a version |
| Actions are named by tag (medium) | **True; closed** | Read: twelve `uses:` lines at `@v4`. The workflow has `contents: read` and no secret, so the reach was small |
| Timing tests fail under load; WebGPU and release gaps (medium) | True; left | The audit copied these from `HANDOFF.md`, where they stay |
| The upstream path is written out; many scripts; no `noUncheckedIndexedAccess` (low) | True; left | Read: `vendor/laya-3.4.2` in 8 files, 14 places; 124 npm scripts |

Not checked: the outside score the audit quotes, and its list of strengths.

## What changed

| | |
| --- | --- |
| Allowed folders | `packages/mcp-server/roots.mjs`: the working directory, `--root DIRECTORY` (repeatable), `ZHUDA_MCP_ROOTS`. A path argument is resolved, its real path is taken (the deepest part that exists decides), and it must be an allowed folder or lie inside one. `audit_visual_migration` (`sourceRoot`, `targetRoot`, `contractPath`) and `audit_visual_contract` (`projectRoot`, and `manifestPath` taken from it) go through it |
| Arguments | `packages/mcp-server/arguments.mjs`: `type`, `properties`, `required`, `items`, `minItems`, `maxItems`, `enum`, which is all the manifests use (a test fails when a manifest uses anything else). Checked in `executeMcpTool`, and for the film tools before a session is looked up or a browser started. A `validate_*` tool is not fronted by it: it answers a malformed recipe itself |
| The engine's own build | `sameDirectory` (real paths) decides whether the project is the engine; `resolveWorkbenchOutput` refuses an `outDir` that is the project, leaves it, or lands in a source folder, before anything is written |
| Lint | `eslint.config.mjs`: `no-empty` without the catch exemption; unused names (a leading underscore says "on purpose"); `no-undef` for `.mjs` and `.js` (TypeScript keeps it with the compiler); `process`, `Buffer`, `__dirname`, `__filename`, `global` and `node:*` refused under `packages/core` and `src`. One exemption, with its reason in the file: `packages/compiler/branding.mjs`, whose `runBrandSplash` is written into every built page with `toString()` |
| The clean-up | 72 places in 45 files (66 reported at first, 7 more that came to light as helpers went, one exempted): unused imports and locals removed, four `catch (e)` that never read `e`, six empty catches given the reason nothing is done. Where the unused name held a call with an effect (a prefab instantiated, a screenshot taken, a configuration parsed) the call stays |
| In the runtime | Three lines of dead code: `measureZhudaBitmapText` validated the font and dropped the report; `ZhudaSceneBudget.report` built an object it never used; a lit material's `dispose` read `Laya` and did nothing with it. The rest under `packages/core` is two unused type imports and one comment |
| Workflow | `actions/checkout`, `actions/setup-node` and `actions/upload-artifact` at the commits `v4` named on 2026-11-26 (4.4.0, 4.4.0, 4.6.2), read with `gh api repos/actions/<name>/commits/v4` |

## Checks

| Check | Result |
| --- | --- |
| `node --test tests/mcp-arguments.test.mjs` | 5 of 5: the keywords one by one; every manifest inside what is checked; a wrong type, a missing argument and a film tool's bad call refused with the argument named, a validator still answering; a folder outside refused for each path argument, a folder added with `configureAllowedRoots` and with `ZHUDA_MCP_ROOTS` read, `..` and a link out of an allowed folder refused; the command line with and without `--root` |
| `node --test tests/build-failure-paths.test.mjs` | 7 of 7, three new: a link and its target are one directory; the output folder's rules; an `outDir` of `../…` stops a build with nothing written, inside or outside the project |
| `node --test tests/workflow-pins.test.mjs` | 1 of 1: every `uses:` is a 40-character commit with a release in its comment |
| The engine built through a symbolic link | Before (`fff3223`): exit 1, `ENOENT … /public/index.html`. After: exit 0, the workbench build, the SDK included |
| `npm run verify` | build, typecheck, declaration audit, Doctor, 1,100 tests of 1,100 (1,091 before, nine new) |
| `npm run lint`, `npm run format:check` | clean |
| `npm run verify:games` | nine of nine |
| `npm run verify:prefabs` | library 209 of 209, both viewers 3 of 3 |
| The tests that call MCP tools (`compiler-and-mcp`, `disclosure-contracts`, `film-scene`, `implementation-routes`, `model-decoder`, `terrain-shader`) | 66 of 66, unchanged but for the one below |

One behaviour was caught by an existing test while this was written: the first form of the
argument check refused `validate_particle_effect` with `effect: null`, which is asked to answer
`passed: false`. The validators were taken out from behind the check.

## Browser checks

The checks whose fixture or tool this change touched, one after another on the same Mac
(headless Chrome on the graphics card):

| Check | What of this change it draws through | Result |
| --- | --- | --- |
| `verify:animation-control`, `verify:grass`, `verify:instanced-mesh`, `verify:lighting-depth`, `verify:lit-surface`, `verify:physical-surfaces`, `verify:vrm` | fixtures that lost unused helpers | pass, each |
| `verify:runtime-feedback` | a fixture's unused import | pass |
| `verify:slot-foundation` | `examples/slot-symbol-prefab` (unused locals and imports, its scripts) | pass |
| `verify:prefab-browser`, `verify:prefab-editor-responsive` | the compiler's browser tools | pass |
| `verify:stage-probe` | `packages/compiler/stage-probe.mjs` (four catches) | pass |
| `verify:prefab-editor` | `packages/compiler/model-editor-client.ts` (an unused import) | **failed in the batch, passed alone**: `CDP timeout Input.dispatchMouseEvent` after 172 s; run again by itself, 174 coordinate checks pass in 93 s |
| `verify:prefab-editor-play` | the same client | **failed in the batch, passed alone**: `CDP timeout Runtime.evaluate` on a wait for two animation frames, after 461 s; run again by itself it passes in 18 s |

The two failures came one after the other near the end of the batch, and both are a page that
stopped answering, not a wrong result. Why the page stopped was not
found: the machine's load was ordinary at the end of the batch (2.5) and the display does not
sleep, but other sessions use this Mac and the owner stopped this session at about that time. The
same two checks passed in the public checkout an hour before, on the commit before this change.
What can be said: both pass on this change when run alone, once each.

## What a consumer meets

- An agent that calls `audit_visual_migration` on a Unity project elsewhere on the disk gets
  `sourceRoot: <path> is outside the folders this server may read (…). Start the server with
  --root DIRECTORY (repeatable) or set ZHUDA_MCP_ROOTS to allow another one.` The operator adds
  the folder once.
- `get_route` without an `id` is now refused (`arguments.id: required`); before, it answered
  with the list of known routes. `list_routes` gives that list.
- The browser SDK built from this source is not the published 2.0.1: the six bundles are each
  60 bytes shorter (the dead code), the loader is the same. `npm run browser:drift` fails, as it
  is meant to: the version is raised before the next SDK release.

## Not checked

- Windows and Linux. The path rules use `path.relative` and real paths and the link test asks
  for a junction, so they should hold there; the public workflow will say when this is exported.
- A real MCP client driving the server over stdio with `--root`: the command line and
  `handleJsonRpcMessage` are tested, the pair inside an editor is not.
- Whether an agent recovers from the new refusals without help.
- A game outside this repository on this change: none was moved to it.
