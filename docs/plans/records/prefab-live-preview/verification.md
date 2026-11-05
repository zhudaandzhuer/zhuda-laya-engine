# Verification: prefab live preview and fixed-size rendering

Status: Implemented; engine watcher verified; consumer/device acceptance deferred
Last reviewed: 2026-11-06

## Engine checks

| Command | Commit | Environment | Result | Artifact |
| --- | --- | --- | --- | --- |
| `npm run build` | working tree | macOS, Node.js 26.12.0 | PASS; SDK and compiler bundles rebuilt | `dist/sdk/zhuda-laya-engine.esm.js` |
| `npm test -- --test-name-pattern='independent consumer|prefab watch'` | working tree | macOS, Node.js 26.12.0 | PASS; 121 tests completed, including preview generation and watcher server injection | terminal output |
| `npm run verify` | current checkout | macOS, Node.js 26.12.0 | PASS; build, declarations, Doctor and 258 tests | terminal output |
| `git diff --check` | current checkout | macOS | PASS | terminal output |

## Browser and consumer evidence

The external consumer `/Users/yaowei/Desktop/game1` pins the engine package and
uses the same `ui/control-bar` Prefab definition in both entry points.

| Command | Result | Artifact |
| --- | --- | --- |
| `npm run test:controlbar` | PASS; isolated and Scene captures are 572x174 and the rendered Prefab region has 0 differing pixels after excluding the Scene-owned 30px host area | `/Users/yaowei/Desktop/game1/evidence/prefabs/control-bar-parity-report.json` |
| `npm run verify` | PENDING after the final engine pin is updated | `/Users/yaowei/Desktop/game1/evidence/` |
| `npm run preview:watch` | PASS; serves `prefab-preview.html` and `index.html`, reloads both after watched source changes, and keeps the previous output after a failed build | `/tmp/game1-watch.log` |

The preview page now sets its observed container to the requested design
canvas before boot. This keeps a 572x174 Prefab at 572x174 in isolation; the
previous `100vw x 80vh` container resized it to the browser viewport and
caused non-uniform button distortion.

## Unverified limits

- iOS and Android device rendering is UNAVAILABLE in this run.
- Long-running watcher behavior on non-macOS filesystems is UNAVAILABLE.
- The consumer reference screenshot is an external game asset and is kept
  outside this engine repository; the recorded parity compares the shared
  Prefab region and geometry at DPR 1.

## Rollback

If a final gate fails, revert the preview container change and keep the prior
build-only Prefab preview. The consumer can continue using its last pinned
engine SHA.
