# Verification: responsive editor workspace

Task: [task.md](task.md)
Date: 2026-11-09
Implementation: commit containing this record; base `186eecbed6b03144fef453b0fdda2e3f86b052e7`.
Status: Implemented within scope; desktop Chrome verified.

## Problem and change

The old toolbar was fixed to one 54px row, workspace height subtracted that
constant and grid columns retained minimum widths. Agent View hid panels but
kept their Assets grid row. Fitting only on window resize missed container and
content-driven layout changes.

The toolbar now wraps within the actual editor width. A body grid assigns the
remaining height to the workspace. Named container queries use the editor's
width rather than assuming the outer window width; narrow Editor panels stack
and remain accessible by vertical scrolling. Agent View uses one remaining row.
Short panels retire the explanatory help text, while short Editor windows can
scroll to their panels. The canvas keeps the same authored design resolution.
A coalesced ResizeObserver watches the preview panel/help, with window and visual
viewport resize handling. Listeners/observers are retired on final page hide and
preserved for back/forward-cache restoration.

## Checks

| Check | Command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Pre-fix regression | Initial responsive fixture at 800×600, DPR 2 | Expected FAIL: Agent stage row 378px instead of the available 534px | `/tmp/zhuda-responsive-before-20261109/report.json` and `failure.png` |
| Actual pre-fix clipping | Old local server in a 600px embedded body | Save right=607.375px outside body width=600px | Consumer `before-live.json` measurements and `before-embedded.png` |
| Responsive browser gate | `EDITOR_RESPONSIVE_EVIDENCE_DIR=/tmp/zhuda-responsive-final-20261109 npm run verify:prefab-editor-responsive` | PASS, 37 cases | report and PNGs in that directory |
| Existing coordinate gate | `EDITOR_EVIDENCE_DIR=/tmp/zhuda-responsive-published-coordinates-20261109 npm run verify:prefab-editor` | PASS, 174 checks | report and PNGs in that directory |
| Existing Play gate | `EDITOR_PLAY_EVIDENCE_DIR=/tmp/zhuda-responsive-published-play-20261109 npm run verify:prefab-editor-play` | PASS, native input, edit isolation and lifecycle | report and PNGs in that directory |
| Engine verify | `npm run verify` | PASS, 301/301; build/types/declaration audit/Doctor/tests | `/tmp/zhuda-responsive-final-verify-20261109.log` |
| Client typecheck | `node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions --target es2022 --module ESNext --moduleResolution bundler --lib es2022,dom --skipLibCheck packages/types/index.d.ts packages/compiler/prefab-editor-client.ts` | PASS | terminal output |
| Actual consumer viewport/input | `node <external-evidence>/replay.mjs` | PASS, original sound.lh at narrow/zoomed sizes, Edit/Play and native mute/volume input | External consumer evidence described below |
| Independent consumer candidate build | Consumer root: `npm run build -- --candidate` | PASS | `/tmp/consumer-editor-responsive-build-20261109.log` |
| Diff hygiene | `git diff --check` | PASS | terminal output |

## Measured acceptance

The neutral gate covers widths 320–1440px, a 1440×240 short window, DPR
1 / 1.5 / 2, actual desktop Chrome zoom 125% / 150% / 200%, embedded body width
changes without an outer resize, longer status text, Editor/Agent/Play switches
and native Play clicks after fitting. It checks actual toolbar bounds and hit
targets, no workspace horizontal overflow, panel access by vertical scrolling,
full canvas containment and actual painted pixels at all four image corners.
Agent View must use the entire remaining row, not leave a hidden Assets row.

Actual consumer sound.lh was checked at 800×650 DPR 2, 600×600 DPR 1.5,
360×640 DPR 2, and 1000×800 with actual 150% page zoom. Both Edit and Play fit,
buttons remain visible, mute icons toggle and volume/percentage track native
input. The consumer's current `zhuda.editor.ts` shared sound-panel controller is
used; no controller, game or art source is changed. sound.lh is byte-identical.

## Persistent evidence and local delivery

`<external-evidence>/consumer-editor-responsive-20261109`
contains the actual report/screenshots, optional-baseline replay, neutral and
coordinate/Play reports, exact source hashes and logs. Consumer game media stays
outside the engine repository. The pre-fix diagnostic is historical; replay the
current checks without a baseline URL, or set RESPONSIVE_BASELINE_URL to an
explicit old editor instance when reproducing the before measurement.

Local editor ports 8891 (default hud.lh) and 8892 (default sound.lh) are served
from the updated official checkout. Existing query-selected assets remain
supported. The services were updated without editing consumer pins, patching
installed engine files, forcing browser reloads or rewriting authored data.

## Limits and decision

Implemented within scope for desktop Chromium. Physical devices, accessibility
zoom, Safari/Firefox and complete game art/rule parity remain separate. The
consumer's candidate build verifies its existing pinned runtime integration;
editor UI behavior is exercised against the updated official editor host.
CI runs the new responsive gate alongside the existing coordinate and Play
checks; remote publication results are recorded in the external evidence.

## CI navigation follow-up

Run `42643759281` on `d166332` failed before the first responsive measurement:
the CDP navigation command returned before the new document contained `#status`.
The responsive, coordinate and Play gates now register `Page.loadEventFired` before
navigating, await that event, then poll a null-safe readiness condition. This
changes test synchronization only; geometry, pixel and input assertions remain
intact. Local follow-up: 37 responsive cases, 174 coordinate checks, Play input
and lifecycle, and `npm run verify` (301 tests) pass. The subsequent CI run is
recorded in the external evidence.
