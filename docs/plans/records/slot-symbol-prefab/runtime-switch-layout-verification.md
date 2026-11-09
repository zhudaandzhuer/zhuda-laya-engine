# Verification record: runtime switching and responsive inspector

Task document: [`runtime-switch-layout-task.md`](runtime-switch-layout-task.md)
Date: 2026-11-07
Commit: working tree (uncommitted implementation)

## Environment

- OS: macOS
- Browser: Google Chrome 156 headless, `--enable-unsafe-swiftshader`
- Runtime: pinned `zhuda-laya-engine` 1.14.0 / LayaAir 3.4.2 libraries
- Preview: `http://127.0.0.1:8894/index.html?scene=slot-machine`

## Checks

| Check | Exact command or procedure | Result | Artifact |
| --- | --- | --- | --- |
| Consumer types | `npm run typecheck` in `examples/slot-symbol-prefab` | PASS | terminal output |
| Candidate build | `npm run build:candidate` | PASS | `dist/candidate/consumer-build.json` |
| Prefab gate | `npm run check:prefab` | PASS; 3 reports, 30 cycles each | `evidence/*.json` |
| Scene WebGL boot | Chrome headless at the preview URL | PASS; `window.slotMachineScene.ready === true`, no boot error | `/tmp/slot-scene-latest.png` |
| Scene root selection | Click Scene canvas empty space | PASS; selection returns to `SlotMachineScene · Scene`, bounds `1280 × 720`, highlight `1280 × 720` | `/tmp/slot-scene-root-fixed.png` |
| Responsive layout | CDP emulation at 756×413 CSS px | PASS; hierarchy and Inspector both overlay the stage; Inspector top is 58 px | `/tmp/slot-scene-latest.png` |
| Panel collapse | Click `#hierarchy-toggle` and `#metrics-toggle` in the same browser run | PASS; both rails measured 48 px | `/tmp/cdp_copy_toggle.py` output |
| Runtime switching | Click `prefabs` → `slot-symbol.lh` → `scenes` → `slot-machine.ls` | PASS; navigation entries 1, app requests 1, runtime stays ready, canvas count unchanged | `/tmp/cdp_switch.py` output |
| Scene COPY | Click `#hierarchy-copy` after Scene selection | PASS; button reports `COPIED`, one shared handler | `/tmp/cdp_copy_toggle.py` output |

## Limits

Physical devices, native packaging, and GPU hardware backends remain
UNAVAILABLE in this run. The visual capture proves the desktop WebGL preview
route and responsive editor chrome only.
