# Verification: Prefab editor coordinates

Task: [task.md](task.md)
Date: 2026-11-09
Implementation: commit containing this record; base `77acfc78846080ec7b60c65ca58c1740562b2edc`.
Exact executable source hashes and editor bundle SHA-256 are recorded in the browser JSON reports.

## Environment

- macOS Darwin 27.0.0, Node v26.12.0, isolated headless Chrome 156.0.8078.81, actual Laya 3.4.2 WebGL.
- Neutral authored 800×1000 Sprite `.lh` and Scene `.ls`; no copied game assets.
- Viewports 1440×1200, 1100×900 and 1600×1300 before desktop page zoom.
- DPR 1 / 1.5 / 2, desktop page zoom 80% / 125% / 150%, local HTTP.
- Chrome zoom uses disposable profile preferences; assertions independently
  verify changed DPR and CSS viewport with `visualViewport.scale === 1`.

## Checks

| Check | Exact command / procedure | Result | Artifact |
| --- | --- | --- | --- |
| Pre-fix failure | Initial neutral browser fixture against unmodified `77acfc7` | FAIL as expected: first nested selection corner x=441.920625 instead of 522.646875 CSS px | `/tmp/zhuda-editor-coordinates-before-20261109/report.json` and `failure.png` |
| Existing Retina reproduction | Original consumer DPR 1 / 2 diagnostic | Original FAIL: canvas 434→217 CSS px; unchanged authored coordinates | Consumer `evidence/game305-editor-anchor-dpr-20261109/README.md` |
| Editor API / build | `node --test tests/prefab-editor.test.mjs` | PASS, 5/5 | terminal output |
| Client typecheck | `node node_modules/typescript/bin/tsc --noEmit --allowImportingTsExtensions --target es2022 --module ESNext --moduleResolution bundler --lib es2022,dom --skipLibCheck packages/types/index.d.ts packages/compiler/prefab-editor-client.ts` | PASS | terminal output |
| Build / types / declaration audit / Doctor / tests | `npm run verify` | PASS, 294/294 tests; Doctor 0 blocking errors | `/tmp/zhuda-editor-verify-20261109.log` |
| Full position regression | `EDITOR_EVIDENCE_DIR=/tmp/zhuda-editor-coordinates-20261109 npm run verify:prefab-editor` | PASS, 174 position/interaction checks | `/tmp/zhuda-editor-coordinates-20261109/report.json` and PNGs |
| Independent consumer build | In `/Users/yaowei/Documents/BDL/zhuda-bdl-consumer`: `npm run build -- --candidate` | PASS; consumer remains pinned to its existing clean SDK, since runtime APIs/bundles are unchanged | `/tmp/zhuda-editor-consumer-build-20261109.log` |
| Actual Game305 selections | `node /tmp/verify-game305-editor-coordinates.mjs` against newly built editor bundle and original game assets | PASS, 6 cases; source SHA-256 unchanged | Consumer `evidence/game305-editor-coordinate-fix-20261109/report.json` and `replay.mjs` |
| Diff hygiene | `git diff --check` | PASS | terminal output |

## Position and input criteria

The browser runner independently composes transforms from authored JSON and
checks all four DOM selection corners plus the pivot (1.5 CSS px tolerance).
Actual colored image pixels are measured from screenshots with overlays hidden
(3 CSS px raster-edge tolerance). Displayed canvas dimensions are compared to
the fitted container, and DPR changes must retain the same scale within 0.75
CSS px of native backing-pixel rounding. These are coordinate and actual-draw
checks, not a loading or console-error proxy.

Dragging tests translated, scaled, rotated and mirrored parents. Every movement
step checks parent-local position and the grabbed image point against the
actual injected cursor (0.15 CSS px tolerance). Native Laya cursor coordinates
are checked before each drag. Undo, redo, save, `.bak` existence and reload are
then checked against the independent expected coordinates.

Real CDP touch input covers competing pointers, cancellation and explicit loss
of an acquired pointer capture; focus-loss rollback is delivered through the
window blur event. Pointer identity is recorded from the actual event, and touch
movement is allowed to settle before measuring. No interaction is saved into
production game assets; save/drag testing uses only generated temporary files.

## Actual consumer evidence

Game305 `hud.lh / PortraitSoundButton` and
`auto.lh / Panel / Frame` were selected at DPR 1 / 1.5 / 2. The fitted canvas is
approximately 435×774 CSS px in all cases, with only backing-pixel rounding;
DPR 2 no longer halves the display. All four corners and pivot agree with the
live hierarchy within 0.02 CSS px. The Panel's `(104.5,150)` ancestor translation
is included. Source hashes before/after are identical. The new editor bundle
is used directly by the replay, without patching or re-pinning the consumer SDK.

Persistent copies of the neutral report, screenshots, pre-fix failure and build
logs are stored below the consumer evidence directory above (`neutral/`,
`before/`, and `logs/`).

## Limits and decision

Desktop Chromium only. No physical mobile, Windows, Safari, Firefox, WebGPU,
new npm release or hosted CI result is claimed by this local run. Consumer game
rule/art parity and production-asset dragging/saving remain outside this scope.
Runtime ownership, public API and authored game coordinates are preserved.

Decision: **Implemented within scope; macOS Chromium verified**. All 174 combined
browser checks passed, with no runtime exceptions. Executable source hashes
match the final files, and the neutral/real-consumer editor bundles have the
same SHA-256. CI now runs the same browser position gate and uploads its
report and screenshots on subsequent pushes/PRs.
