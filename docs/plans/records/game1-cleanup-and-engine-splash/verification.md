# Verification record: game1-cleanup-and-engine-splash

Task document: `docs/plans/records/game1-cleanup-and-engine-splash/task.md`  
Commit: `4e246d49a4a6a9d385159c24107d2c324459e09c` (engine splash
implementation)  
Date: 2026-11-04

## Environment

- OS: macOS on the local Codex host; no real iOS or Android device attached.
- Node / npm: recorded by `node --version` and `npm --version` below.
- Engine base: `9dc6d7b95866757acd5f3a6a42fb2b313e8f3395`; implementation:
  `4e246d49a4a6a9d385159c24107d2c324459e09c`.
- Consumer: `/Users/yaowei/Desktop/game1`, plain directory with no `.git` or
  GitHub remote; dependency is pinned to
  `8c630ade6ce1585201bf12943518b1b273d4dd64`.
- Browser: generated HTML inspection and local desktop browser execution;
  device compositor timing remains unavailable.

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Engine build, types, doctor and regression suite | `npm run verify` from `/Users/yaowei/Desktop/Zhuda-LayaAir` | PASS; 122/122 tests, including the mandatory responsive splash test | `dist/web/index.html`, `dist/web/assets/branding/zhuda-layaair-mark.svg` |
| Engine whitespace and repository state | `git diff --check` and `git status --short` | PASS after removing timestamp-only report churn; only splash, test and task-record files remain | repository working tree |
| Consumer install and build | `npm install --ignore-scripts` and `npm run build` from `/Users/yaowei/Desktop/game1` | PASS against engine `8c630ade6ce1585201bf12943518b1b273d4dd64` | `/Users/yaowei/Desktop/game1/dist/` |
| Consumer control-bar parity | `npm run test:controlbar` from `/Users/yaowei/Desktop/game1` | PASS; `differentPixels: 0` | `game1/evidence/prefabs/control-bar-parity-report.json` |
| Consumer complete verification | `npm run verify` from `/Users/yaowei/Desktop/game1` | PASS; 95/95 gates | `/Users/yaowei/Desktop/game1/dist/`, verification output |
| Splash browser behavior | Open generated `dist/web/index.html`, inspect `#zhudaLogoSplash`, and observe the overlay before release after 2180 ms | PASS on local desktop browser path; markup, asset path, responsive `svh`/safe-area rules, orientation rule and reduced-motion fallback are present | `dist/web/index.html` |
| Real WebGL / iOS / Android device | Run the consumer on a physical device and measure compositor timing and input/audio behavior | UNAVAILABLE; no physical device was attached | — |

## Lifecycle and failure cases

The splash has one bounded release timer, removes its overlay after the fade,
clears the document scroll lock, and exposes `window.__ZHUDA_SPLASH__` for
deterministic inspection. It does not create audio, a second engine clock, or a
consumer asset/provider path. `prefers-reduced-motion: reduce` collapses the
CSS animation durations while preserving the release path.

The consumer compiler continues to use `/Users/yaowei/Desktop/game1/public/index.html`
as its page template; the engine splash contract is verified in the engine's
own generated workbench entry. Consumer page branding remains consumer-owned.

Consumer cleanup retained the source, runtime assets, server, generated output,
canonical Prefab/Scene evidence and final delivery media. Rebuildable frame
caches, candidate previews, debug captures and superseded reports were removed;
the exact inventory is in `/Users/yaowei/Desktop/game1/CLEANUP-REPORT.md`.

## Prefab evidence (visual work)

| Prefab ID / child path / state | Source and dependency revisions | Isolated replay command / environment | Reference / actual / diff | Result |
| --- | --- | --- | --- | --- |
| `ui/control-bar` canonical report | Consumer source assets; engine `8c630ade6ce1585201bf12943518b1b273d4dd64` | `npm run test:controlbar` with the existing local preview server on `127.0.0.1:8891` | 572×174 crop; report records zero different pixels | PASS |
| Engine splash overlay | Engine-owned `assets/branding/zhuda-layaair-mark.svg` | `npm run verify`; inspect generated `dist/web/index.html` | SVG source and generated HTML; no device image available | PASS for generated contract; device visual timing UNAVAILABLE |

## Limits and decision

- Physical iOS/Android rendering, compositor timing, touch latency and audio
  hardware behavior are unverified.
- The consumer directory has no Git metadata, so no GitHub repository or remote
  was inferred or created.
- The local preview server on port 8891 was already owned by PID 939; starting
  a second server was unavailable, while the existing server served the
  validated consumer build.

Decision: **In progress** until a physical-device report is attached. The
engine and consumer desktop/build gates pass and the checked-in fallback is the
responsive reduced-motion splash.

## Rollback

Before this change, the engine base was
`9dc6d7b95866757acd5f3a6a42fb2b313e8f3395`. Reverting the splash implementation,
branding asset, test and this record restores the previous generated index;
the consumer pin can be rolled back to the same base revision if needed.
