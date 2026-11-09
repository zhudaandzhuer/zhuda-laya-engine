# Verification record: preview-runtime-hardening

Task document: `docs/plans/preview-runtime-hardening.md`  
Commit: `e50ff4e8d270b8d0f29504d9050c1da489c4afb7` plus the working-tree changes recorded below  
Date: 2026-11-07

## Environment

- OS / browser / device: macOS local shell; slot browser acceptance uses the existing headless WebGL fixture
- Node and package manager: Node.js 26.12.0, npm
- Engine and consumer commits: engine package 1.14.0; current checkout is detached with pre-existing local changes
- DPR, viewport and network mode: unit tests are synthetic; Prefab acceptance uses its configured browser fixture and local assets

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Build | `npm run verify` | PASS | `dist/build-manifest.json`, generated SDK bundles |
| Types | `npm run typecheck` and `cd examples/slot-symbol-prefab && npm run typecheck` | PASS | compiler output |
| Doctor | `npm run verify` (includes `npm run doctor`) | PASS, 0 blocking errors | Doctor stdout |
| Regression | `npm run verify` | PASS, 281 tests | test stdout |
| Realm guard | `node --test tests/realm-guards.test.mjs` | PASS, foreign/uninitialized/marked realms covered | test stdout |
| Preview policy | `node --test tests/slot-preview-policy.test.mjs` | PASS, release default and retain override covered | test stdout |
| 2D editor profile | `node --test tests/prefab-editor.test.mjs` | PASS, core/2d/ui and exact three vendor files covered | test stdout |
| Consumer candidate | `cd examples/slot-symbol-prefab && npm run build:candidate` | PASS | `examples/slot-symbol-prefab/dist/candidate/` |
| Browser Prefab acceptance | `cd examples/slot-symbol-prefab && npm run check:prefab` | PASS, 3 reports published | `examples/slot-symbol-prefab/evidence/` |
| Consumer release build | `cd examples/slot-symbol-prefab && npm run build` | PASS | `examples/slot-symbol-prefab/dist/release/` |
| Diff hygiene | `git diff --check` | PASS | none |

## Lifecycle and failure cases

- A foreign initialized Laya stage/canvas fails before `Laya.init` with
  `ZHUDA_FOREIGN_LAYA_REALM` and iframe guidance.
- An uninitialized vendor namespace is allowed to initialize; a successful Zhuda
  boot marks the realm so a later Zhuda session can reuse it after disposal.
- Slot Scene and GLB handles are disposed when hidden under the default
  `resourcePolicy: release`; `?resources=retain` preserves them for rapid review.
- Existing provider cancellation, stale model loads and explicit scene/model
  disposal remain covered by the existing 281-test suite.

## Prefab evidence (visual work)

| Prefab ID / child path / state | Source and dependency revisions | Isolated replay command / environment | Reference / actual / diff | Result |
| --- | --- | --- | --- | --- |
| `slot/symbol` / `Art`, `Badge` / idle, composite idle, composite selected | Current example source and manifest; engine package 1.14.0 | `cd examples/slot-symbol-prefab && npm run check:prefab` | `examples/slot-symbol-prefab/evidence/` | PASS |

The hidden-resource policy only changes lifecycle ownership after a mode switch;
it does not change the authored Prefab definition or its rendered reference.

## Limits and decision

Accepted within the desktop/browser scope above. A real foreign consumer that
already initialized Laya, Windows hardware, iOS/Android and native iframe GPU
loss recovery still require separate consumer/device reports.
