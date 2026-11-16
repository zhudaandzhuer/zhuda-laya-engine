# Handoff: plans of 2026-11-16/17

Last updated: 2026-11-17. State of `main` at the commit that adds this file
(pushed to `origin`).

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

## Open (not started)

- Phone findings outside these plans, both the same before the changes
  (`docs/plans/records/windows-acceptance/gfx-06-verification.md`): SMAA Low changes
  202 pixels of faint grain on Adreno WebGL (`verify:post-quality`), and a
  zero-strength normal map moves 2.8 levels on Adreno WebGPU
  (`verify:specular-aa`). Both checks are labelled desktop-only.
- QA-01: why a browser session's first one or two frames differ by 1/255 at
  one pixel on Intel Direct3D 11 was not found.
- The Windows host's packaged consumer web is the DIST-02 one; not rebuilt
  from the current engine.
- Other plans in the index that were already in progress before this work
  (3D model editor, quality defaults, phone costs, phone checks, quality
  route's unbuilt areas, three.js gap audit) were not part of it.

## Next step

Nothing in these three plans is left. The phone findings above are the
natural next task.

## Machines

- Windows host (`win-bdl`): work folder
  `D:\claude-workstation\zhuda-windows-batch1` (checkouts `fixed`, `base`,
  logs and evidence). No test install or scheduled task of this work is
  left; GPU checks there run in the signed-in desktop session through a
  scheduled task, never over SSH (session 0).
- vivo V40: checks through `ZHUDA_PHONE_CHROME` with
  `adb forward tcp:9333 localabstract:chrome_devtools_remote`; the forward is
  removed after use.
