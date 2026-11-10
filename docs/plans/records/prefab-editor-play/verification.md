# Verification: Prefab editor interactive Play

Task: [task.md](task.md)
Date: 2026-11-09
Implementation: commit containing this record, base `391db934e6103ba873ff518d9d4159ecca2288a0`.
Status: Implemented within scope; desktop Chrome verified.

## Environment and scope

macOS, Node v26.12.0, real Laya 3.4.2 WebGL in isolated headless Chrome.
Neutral 800×1000 generated Prefab and an original consumer sound.lh.
DPR 1 / 1.5 / 2; native CDP mouse gestures; Editor and Agent View; resize.
The compiler/editor changes and public type-only contract do not alter runtime
SDK JavaScript. Editor and controllers share `/__editor/sdk.js`, with an actual
second-boot guard assertion proving the same active engine session is reused.

## Checks

| Check | Command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Engine build/types/declarations/Doctor/tests | `npm run verify` | PASS, 301/301 | `/tmp/zhuda-editor-play-verify-20261109.log` |
| Preview lifecycle/API/strict public consumer | `node --test tests/prefab-editor-preview.test.mjs tests/prefab-editor.test.mjs` | PASS, 11/11 | terminal output |
| Client typecheck | `node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions --target es2022 --module ESNext --moduleResolution bundler --lib es2022,dom --skipLibCheck packages/types/index.d.ts packages/compiler/prefab-editor-client.ts` | PASS | terminal output |
| Neutral Play interaction | `EDITOR_PLAY_EVIDENCE_DIR=/tmp/zhuda-editor-play-final-20261109 npm run verify:prefab-editor-play` | PASS | `/tmp/zhuda-editor-play-final-20261109/report.json` and PNGs |
| Existing coordinate regression | `EDITOR_EVIDENCE_DIR=/tmp/zhuda-editor-play-coordinate-regression-20261109 npm run verify:prefab-editor` | PASS, 174 checks | report and PNGs in that directory |
| Actual consumer sound interaction | `node /tmp/verify-consumer-editor-play.mjs` | PASS; all DPRs, mute, continuous volume drag, Agent View and 30 audio cleanup cycles | Consumer `evidence/consumer-editor-play-20261109/report.json`, PNGs and `replay.mjs` |
| Actual adapter public typecheck | TypeScript strict `allowJs/checkJs`, moduleResolution Bundler, candidate public SDK type entry, file `games/consumer-game/zhuda.editor.mjs` | PASS | terminal output |
| Existing consumer typecheck | In consumer root: `npm run typecheck` | PASS | `/tmp/consumer-editor-play-typecheck-20261109.log` |
| Independent consumer candidate build | In consumer root: `npm run build -- --candidate` | PASS | `/tmp/consumer-editor-play-build-20261109.log` |
| Diff hygiene | `git diff --check` | PASS | terminal output |

## Observable behavior

Native click changes a preview label and native mouse drag moves a preview grip.
Play cannot move the editor-selected node, save source, change edit history or
show editing overlays. Stop restores the prior unsaved X=90 edit, while the file
on disk remains X=80; Undo and Redo still recover X=80 and X=90. Agent View and
resize preserve interactive control behavior. Page hide retires Play and page
restoration rebuilds the editable snapshot.

Thirty browser Play/Stop cycles return active controller counts to zero and
retain one stage canvas. Unit tests cover 30 ownership cycles, reverse cleanup,
missing nodes, invalid/missing/private controller imports, mount failure,
timeout, non-cooperative late completion, cleanup exceptions and idempotent Stop.
A late controller is disposed once; owned listeners are retired even before an
async mount finishes. The public consumer fixture compiles with strict checking
and skipLibCheck:false.

consumer uses a consumer-owned controller and its original assets. It updates
mute icons, mute grip, volume fill, numeric percentage and volume grip through
one `IframeSoundAdapter` mixer. Actual amount and mixer gain agree; display
percentage equals the measured amount rounded to percent. Native Laya pointer
quantization may yield one percentage point difference at the intended midpoint
when the canvas is fitted down. All created AudioContexts are closed after Stop,
including 30 repeated sound-panel sessions. Authored sound.lh bytes are unchanged.

## Artifacts and limits

Persistent copies of neutral/coordinate reports and logs are stored under the
external consumer evidence directory above, with exact source SHA-256 values.
Game-specific media and controller source remain outside the engine repository.
The production consumer SDK pin remains at 391db93; its original typecheck/build
is a compatibility check. The new editor runs directly from the updated official
checkout and loads the new controller through the public SDK host.

No automatic BGM, physical speaker/autoplay, mobile, Safari/Firefox, WebGPU,
full-game wallet/RGS or art/rule parity is claimed. This is an isolated editor
interaction feature, not a complete game-port acceptance. Controller modules
must own external side effects through the documented cleanup/signal contract.
CI now runs both coordinate and Play browser gates and uploads their artifacts;
its remote result is recorded separately after publication.
