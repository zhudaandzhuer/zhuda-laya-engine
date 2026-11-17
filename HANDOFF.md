# Handoff: plans of 2026-11-16/17 and the defects after them

Last updated: 2026-11-18. The three plans and the defect batch under "After
the plans" (`c7ab3d1` to `1197e20`) are on `origin/main`. The V40 results of
2026-11-18 were added in a later commit: `git log origin/main..main` says
whether it is pushed.

## Done

Three plans written on 2026-11-16 into the plan index (`docs/plans/README.md`), all now implemented:

| Plan                                                                                   | State                                                                                                                       | Records                                              |
| -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| [Windows acceptance fixes](docs/plans/records/windows-acceptance/plan.md)              | All 19 items closed on the report's Windows host (desktop session, Intel UHD 770), with macOS and a vivo V40 for comparison | per item in `docs/plans/records/windows-acceptance/` |
| [Techniques from Abyssal Garden](docs/plans/records/abyssal-garden-techniques/plan.md) | AG1..AG6 implemented (desktop WebGL and WebGPU; AG2, AG3 and AG1's regression checks also on the V40)                       | linked from the plan's Progress table                |
| [Mesh boolean operations (CSG)](docs/plans/records/mesh-csg/plan.md)                   | `zhuda-laya-engine/csg` optional entry (BSP), desktop and V40                                                               | `docs/plans/records/mesh-csg/`                       |

AG1..AG6 and CSG were built in a separate session on branch
`claude/fervent-lovelace-44d9db` and merged into `main` after review, with
`npm run verify`, lint, format, the draw checks on both backends and phone
runs at each merge. CI (`.github/workflows/verify.yml`: Linux verify and
browser, macOS, Windows from a folder with spaces and CJK) is green on
`d0d17fa` (run 43955927723), the commit that put this file here.

## Decided

- The desktop host example runs Electron 45.3.3 with Forge 8.0.1 (0
  advisories); `--verify` shows its window and keeps drawing.
- `verify:film-water` compares the frame after thirty mounts with the one
  drawn just before them (QA-01); `verify:specular-aa` holds the game-sun
  highlight to a truth taken under that sun (GFX-06).
- Hardware CI lanes (Intel/NVIDIA, Chrome/Edge) stay a manual procedure:
  `docs/agent-development.md`, "Windows hardware runs".

## After the plans: the open engine defects (2026-11-17)

The owner asked for every open defect to be fixed. Record:
[engine defects](docs/plans/records/engine-defects/verification.md).

| Defect                                                                                    | State                                                                               |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Lit surfaces of one shader name with other starting values                                | fixed                                                                               |
| WP22: a rim light brighter than the sun took its shadow                                   | fixed (`installLaya342ShadowLightFirst`)                                            |
| WP23: a program that does not compile stopped drawing on WebGPU                           | fixed (its objects are left out, the frame goes on)                                 |
| MEM-01's open part: LayaAir's batch marks, WebGPU and WebGL, and WebGL's instance buffers | fixed (swept; `verify:webgpu-churn` has a `batch` kind)                             |
| `inspectEngineHealth` on a WebGPU page                                                    | fixed                                                                               |
| `strands` turned hair white at any strength (body-lab)                                    | reproduced, fixed: `strength` dims both bands                                       |
| iPhone Safari `Unable to finish` on WebGPU                                                | not reproduced on an iPhone 14 with the engine's pages; the game itself was not run |
| Browser SDK checks read a stale `dist/browser/<version>`                                  | fixed: they build a fresh folder                                                    |

Checked on macOS (every `verify:*` check on both backends), the Windows
host, the iPhone 14 and the vivo V40 (2026-11-18, both backends).

## Open

- On the Windows host `verify:instanced-mesh` WebGL differed by 1/255 at one
  pixel in 2 of 26 runs of `95aee18`; 0 of 24 since the instance buffers are
  destroyed at the next frame's start, 0 of 19 before the sweep. Whether
  those two were the change or Direct3D 11's own first-frame 1/255 (QA-01)
  is not known.
- QA-01: why a browser session's first one or two frames differ by 1/255 at
  one pixel on Intel Direct3D 11 was not found.
- The Windows host's packaged consumer web is the DIST-02 one; not rebuilt
  from the current engine.
- Other plans in the index that were already in progress before this work
  (3D model editor, quality defaults, phone costs, phone checks, quality
  route's unbuilt areas, three.js gap audit) were not part of it.

## Next step

Nothing is waiting.

Earlier: the two Adreno findings of the phone runs were fixed
([record](docs/plans/records/phone-findings-adreno/verification.md)), and
GitHub issue #8 (WebGPU glTFPBR pipeline invalid after ~70 s) is fixed in
[webgpu-node-bindings](docs/plans/records/webgpu-node-bindings/verification.md)
and verified in the game by its own session (0 errors in 11 rounds on
`renderer: auto`).

## Machines

- Windows host (`win-bdl`): work folder
  `D:\claude-workstation\zhuda-windows-batch1` (checkouts `fixed`, `base`,
  logs and evidence). No test install or scheduled task of this work is
  left; GPU checks there run in the signed-in desktop session through a
  scheduled task, never over SSH (session 0).
- iPhone 14: Safari was left on a page of this Mac's check server
  (`https://192.168.2.59:8765/control.html`, the server is stopped); close
  the tab. Safari keeps an exception for that self-signed certificate.
- vivo V40: checks through `ZHUDA_PHONE_CHROME` with
  `adb forward tcp:9333 localabstract:chrome_devtools_remote`; the forward is
  removed after use.
