# Verification record: rpg-feedback-hardening

Task: [task.md](task.md)  
Date: 2026-11-05  
Source: 1.5.0 implementation in the commit containing this record, based on
`5ab0ff592dac027f1ad3754c402902d9c2e13d94`. The published commit is recorded in the
external acceptance `source-revisions.json` after commit/push. Consumer baseline:
`dawn-realm-rpg` at `007fc30b07af13971130455e65a9b5b729d8b8aa`.

## Environment and reproducibility

macOS 27.0.1 (26A434), Node 26.12.0, npm 11.20.0, Chrome 156.0.8078.80.
Independent consumers install the packed SDK without source aliases. Acceptance
root outside this repository:
`/Users/yaowei/Desktop/zhuda-rpg-hardening-acceptance-20261105` (below: `A`).
Packed SDK SHA-256:
`7f59e96b88aef37b775123d3a39b0c99e4d834be86d735280b4438be6d948dd7`.
Installed runtime/preview/check/build bytes were compared with engine source.

## Checks

| Check | Exact command/procedure | Result | Artifact |
| --- | --- | --- | --- |
| Engine build/types/Doctor/regressions/exports | `npm run verify` at engine root | PASS, 154/154 tests | `A/engine-verify.log` |
| Whitespace | `git diff --check` | PASS | commit review |
| Independent neutral consumer | `cd A/neutral && npm run accept && npm run verify` | PASS, installed tarball | `A/neutral-accept.log`, `A/neutral-verify.log` |
| Independent game | `cd A/game && npm run accept:prefabs && npm run verify` | PASS, 12 game tests | `A/game-prefab-accept.log`, `A/game-verify.log` |
| Selective invalidation with actual browser proofs | `cd A && node selective-invalidation.mjs` | PASS | `A/selective-invalidation.json` |
| Old premature lifecycle evidence | New checker against original 1.4.1 preview, hero, `cycles=30` | EXPECTED FAIL; missing completion/snapshots | `A/old-preview-negative.json` |
| Full game WebGL replay | HTTP 51880 `/?qa=1`; click Run legal campaign replay, then Capture current state | PASS; 121.315 simulation seconds, quest 9, 3 bosses, 0 deaths | `A/game/evidence/shared-campaign.json`, ending PNG and console JSON |
| Physical iOS/Android, audible output, long-duration GPU profiling | No device/hearing/profiling run performed | UNAVAILABLE | no pass claimed |

The old reproduction can be rerun with the installed `zhuda-prefab-check`:
`--url='http://127.0.0.1:51877/prefab-preview.html?id=hero&state=idle&width=640&height=480&dpr=1&cycles=30'`
and the original hero baseline/output paths. It requires serving the old 1.4.1
build; the original game is upgraded after acceptance, so retain its Git revision.

## Lifecycle and publication

Unit fixtures cover incomplete/late/error cycles, wrong selection, nonzero
references/pending, changed resource snapshots, capture, failed comparison,
source changes during acceptance and configured check tampering. Shared runtime
fixtures cover cancellation, failed state mount, instance isolation, material
copying, final-lease release and 30 cycles. Existing cache/provider timeout and
failure coverage remains part of the full suite.

Real neutral evidence proved an unrelated Main change keeps all three component
proofs valid. Changing the leaf invalidates leaf and parent while `other` keeps
its proof. Release rejects stale evidence and preserves SHA-256 of web index,
payload manifest, build report and ZIP. The test restores source and successfully
rebuilds afterward. This is staged publication with rollback, not a power-loss
atomic snapshot guarantee.

## Prefab and scene evidence

- Neutral: leaf, parent, other; 640×480, DPR 1, 30 completed cycles each;
  `A/neutral/evidence/final/*.json`, all zero different pixels and scoped proofs.
- RPG: 17 selections from `A/game/zhuda.config.json`, unchanged approved references
  in `A/game/evidence/references/` (exact relative paths are in each report);
  `A/game/evidence/shared/*.json`, all zero different pixels and 30 completed
  cycles. Same definitions/options are mounted by the World.
- A first candidate merged identical sibling meshes within a tree; the shrine
  failed with 16 different pixels at coplanar joins. That failed evidence remains
  in `A/game/evidence/first-shared-candidate/`. Final implementation preserves
  node-path mesh identity within each tree, sharing only across instances. The
  added regression prevents reintroducing that merge. No reference/tolerance was
  changed to hide the failure.
- Full scene: viewport 1280×720, browser DPR 2, canvas 1920×1080 (existing cap).
  Original vs final: 180 instances both; meshes **860 → 105**, reported resources
  **1489 → 174**, estimated bytes **35,656,204 → 25,865,052**. Texture/render-target
  counts stay 12/5. See `A/resource-comparison.json`. Counts and memory estimates
  are not GPU heap measurements or an FPS improvement claim.
- The copied game's QA report still had a hardcoded old SDK label. The external
  comparison records this explicitly and identifies the installed tarball/hash;
  the production consumer upgrade corrects the label.

## Limits and decision

Implemented and verified on desktop; physical-device acceptance remains
UNAVAILABLE, so this is not unrestricted platform acceptance. Dependency scope
is conservative at emitted-module level: a shared giant definitions file still
invalidates its users together; undeclared/external loads fall back to the whole
payload. Parents with restrictive asset lists must include observed child assets.
Different visual states still need independent checks. The RPG keeps its existing
combined definitions file and whole-payload gate; the neutral consumer demonstrates
the granular route. No arbitrary dependency inference is claimed.

Shared resource mode is opt-in. Raw shared mesh/material objects must be treated
as immutable; use `makeMaterialUnique` for instance material changes and independent
mode for arbitrary geometry mutation. It does not promise automatic draw-call
batching. Existing vendor declaration debt and mobile/audio limits remain explicit.
